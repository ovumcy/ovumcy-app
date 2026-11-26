import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  requestPurchase,
} from "expo-iap";

import {
  STORE_CALL_TIMEOUT_MS,
  createStoreClient,
  storeClient,
} from "./store-client.native";

const mockInit = jest.mocked(initConnection);
const mockFetchProducts = jest.mocked(fetchProducts);
const mockGetPurchases = jest.mocked(getAvailablePurchases);
const mockRequestPurchase = jest.mocked(requestPurchase);
const mockFinish = jest.mocked(finishTransaction);

const TOKEN = "play-purchase-token-do-not-leak";

type RawPurchase = Awaited<ReturnType<typeof getAvailablePurchases>>[number];

function rawPurchase(overrides: Record<string, unknown> = {}): RawPurchase {
  return {
    id: "GPA.0000-0000-0000-00000",
    productId: "pregnancy_module",
    ids: ["pregnancy_module"],
    purchaseState: "purchased",
    purchaseToken: TOKEN,
    isAcknowledgedAndroid: false,
    isAutoRenewing: false,
    quantity: 1,
    store: "google",
    storeId: "play",
    transactionDate: 1_780_000_000_000,
    ...overrides,
  } as unknown as RawPurchase;
}

function androidClient(timeoutMs?: number) {
  return createStoreClient({
    platformOS: "android",
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
}

describe("store client (native adapter)", () => {
  beforeEach(() => {
    mockInit.mockReset().mockResolvedValue(true);
    mockFetchProducts.mockReset().mockResolvedValue([]);
    mockGetPurchases.mockReset().mockResolvedValue([]);
    mockRequestPurchase.mockReset().mockResolvedValue([]);
    mockFinish.mockReset().mockResolvedValue(undefined);
  });

  it("maps store purchases onto the contract without the purchase token", async () => {
    mockGetPurchases.mockResolvedValue([
      rawPurchase(),
      rawPurchase({
        productId: "ovumcy_cloud",
        ids: ["ovumcy_cloud"],
        purchaseState: "pending",
        isAcknowledgedAndroid: true,
      }),
      rawPurchase({ purchaseState: "unknown", ids: null }),
      rawPurchase({ ids: [], isAcknowledgedAndroid: null }),
    ]);

    const purchases = await androidClient().listPurchases();

    expect(purchases).toEqual([
      { productId: "pregnancy_module", state: "purchased", acknowledged: false },
      { productId: "ovumcy_cloud", state: "pending", acknowledged: true },
      { productId: "pregnancy_module", state: "unknown", acknowledged: false },
      { productId: "pregnancy_module", state: "purchased", acknowledged: false },
    ]);
    expect(JSON.stringify(purchases)).not.toContain(TOKEN);
  });

  it("acknowledges a purchased, unacknowledged purchase and never consumes it", async () => {
    const owed = rawPurchase();
    mockGetPurchases.mockResolvedValue([
      rawPurchase({ purchaseState: "pending" }),
      owed,
    ]);

    await androidClient().acknowledge("pregnancy_module");

    expect(mockFinish.mock.calls).toEqual([
      [{ purchase: owed, isConsumable: false }],
    ]);
  });

  it("acknowledges nothing when no purchase of the product is owed", async () => {
    mockGetPurchases.mockResolvedValue([
      rawPurchase({ isAcknowledgedAndroid: true }),
      rawPurchase({ purchaseState: "pending" }),
      rawPurchase({ productId: "ovumcy_cloud", ids: ["ovumcy_cloud"] }),
    ]);

    await androidClient().acknowledge("pregnancy_module");

    expect(mockFinish).not.toHaveBeenCalled();
  });

  it("requests a one-time purchase of exactly the product asked for", async () => {
    await expect(androidClient().purchase("pregnancy_module")).resolves.toBe(
      "completed",
    );

    expect(mockRequestPurchase.mock.calls).toEqual([
      [{ request: { google: { skus: ["pregnancy_module"] } }, type: "in-app" }],
    ]);
  });

  it("reports a dismissed purchase sheet as cancelled", async () => {
    mockRequestPurchase.mockRejectedValue({ code: "user-cancelled" });

    await expect(androidClient().purchase("pregnancy_module")).resolves.toBe(
      "cancelled",
    );
  });

  it("rejects a failed purchase without retrying it or quoting the store error", async () => {
    mockRequestPurchase.mockRejectedValue({
      code: "service-error",
      message: `debug text with ${TOKEN}`,
    });

    await expect(androidClient().purchase("pregnancy_module")).rejects.toThrow(
      /^store_unavailable$/,
    );
    expect(mockRequestPurchase).toHaveBeenCalledTimes(1);

    // An error with no readable code is a failure, never a cancel.
    for (const thrown of ["boom", null]) {
      mockRequestPurchase.mockRejectedValue(thrown);
      await expect(androidClient().purchase("pregnancy_module")).rejects.toThrow(
        /^store_unavailable$/,
      );
    }
  });

  it("rejects with a bare store_unavailable error whatever the library threw", async () => {
    const leak = Object.assign(new Error(`debug text with ${TOKEN}`), {
      code: "service-error",
      purchaseToken: TOKEN,
    });
    mockGetPurchases.mockRejectedValue(leak);
    mockFetchProducts.mockRejectedValue(leak);
    mockRequestPurchase.mockRejectedValue(leak);
    const client = androidClient();
    const settle = (call: Promise<unknown>) =>
      call.then(
        () => null,
        (error: unknown) => error,
      );

    const failures = [
      await settle(client.listPurchases()),
      await settle(client.loadProduct("pregnancy_module")),
      await settle(client.acknowledge("pregnancy_module")),
      await settle(client.purchase("pregnancy_module")),
    ];

    // The acknowledge call itself failing, after a successful purchase read.
    mockGetPurchases.mockResolvedValue([rawPurchase()]);
    mockFinish.mockRejectedValue(leak);
    failures.push(await settle(client.acknowledge("pregnancy_module")));

    for (const failure of failures) {
      expect(failure).toBeInstanceOf(Error);
      const error = failure as Error & { cause?: unknown };
      expect(error.message).toBe("store_unavailable");
      expect(error.cause).toBeUndefined();
      expect(Object.keys(error)).toEqual([]);
    }
  });

  it("connects again after a purchase that failed to connect", async () => {
    mockInit.mockResolvedValueOnce(false).mockResolvedValue(true);
    const client = androidClient();

    await expect(client.purchase("pregnancy_module")).rejects.toThrow(
      /^store_unavailable$/,
    );
    expect(mockRequestPurchase).not.toHaveBeenCalled();

    await expect(client.purchase("pregnancy_module")).resolves.toBe("completed");
    expect(mockInit).toHaveBeenCalledTimes(2);
  });

  it("returns the store's formatted price for a product it sells", async () => {
    mockFetchProducts.mockResolvedValue([
      { id: "pregnancy_module", displayPrice: "€4.99" },
    ] as unknown as Awaited<ReturnType<typeof fetchProducts>>);

    await expect(androidClient().loadProduct("pregnancy_module")).resolves.toEqual(
      { productId: "pregnancy_module", displayPrice: "€4.99" },
    );
    expect(mockFetchProducts).toHaveBeenCalledWith({
      skus: ["pregnancy_module"],
      type: "in-app",
    });
  });

  it("resolves null for a product the store does not sell", async () => {
    mockFetchProducts.mockResolvedValue(null);

    await expect(
      androidClient().loadProduct("pregnancy_module"),
    ).resolves.toBeNull();
  });

  it("connects once and reuses the connection across calls", async () => {
    const client = androidClient();

    await client.listPurchases();
    await client.listPurchases();

    expect(mockInit).toHaveBeenCalledTimes(1);
  });

  it("retries a failed read once on a fresh connection", async () => {
    mockGetPurchases
      .mockRejectedValueOnce(new Error("service disconnected"))
      .mockResolvedValue([rawPurchase()]);

    await expect(androidClient().listPurchases()).resolves.toHaveLength(1);

    expect(mockInit).toHaveBeenCalledTimes(2);
    expect(mockGetPurchases).toHaveBeenCalledTimes(2);
  });

  it("rejects when the store refuses the connection", async () => {
    mockInit.mockResolvedValue(false);

    await expect(androidClient().listPurchases()).rejects.toThrow(
      /^store_unavailable$/,
    );
    expect(mockGetPurchases).not.toHaveBeenCalled();
  });

  it("rejects instead of hanging when the store never answers", async () => {
    mockGetPurchases.mockReturnValue(new Promise(() => undefined));

    await expect(androidClient(20).listPurchases()).rejects.toThrow(
      /^store_unavailable$/,
    );
    expect(mockGetPurchases).toHaveBeenCalledTimes(1);
    // The limit a screen can wait on a cached read in the shipped client.
    expect(STORE_CALL_TIMEOUT_MS).toBe(5_000);
  });

  it("holds the retry to the same deadline as the first try", async () => {
    // First read fails late, the retry never answers: one deadline covers both.
    mockGetPurchases
      .mockImplementationOnce(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error("x")), 30)),
      )
      .mockReturnValue(new Promise(() => undefined));
    const started = Date.now();

    await expect(androidClient(50).listPurchases()).rejects.toThrow(
      /^store_unavailable$/,
    );
    expect(Date.now() - started).toBeLessThan(500);
    expect(mockGetPurchases).toHaveBeenCalledTimes(2);
  });

  it("rejects instead of hanging when the connection, the product lookup or the acknowledgment never answers", async () => {
    const never = () => new Promise<never>(() => undefined);

    mockInit.mockImplementation(never);
    const disconnected = androidClient(20);
    await expect(disconnected.listPurchases()).rejects.toThrow(/^store_unavailable$/);
    await expect(disconnected.purchase("pregnancy_module")).rejects.toThrow(
      /^store_unavailable$/,
    );
    expect(mockGetPurchases).not.toHaveBeenCalled();
    expect(mockRequestPurchase).not.toHaveBeenCalled();

    mockInit.mockReset().mockResolvedValue(true);
    mockFetchProducts.mockImplementation(never);
    mockGetPurchases.mockResolvedValue([rawPurchase()]);
    mockFinish.mockImplementation(never);
    const connected = androidClient(20);
    await expect(connected.loadProduct("pregnancy_module")).rejects.toThrow(
      /^store_unavailable$/,
    );
    await expect(connected.acknowledge("pregnancy_module")).rejects.toThrow(
      /^store_unavailable$/,
    );
  });

  it("gives the product lookup longer than the cached purchase read", async () => {
    const afterTwoReadTimeouts = <T,>(value: T) =>
      new Promise<T>((resolve) => setTimeout(() => resolve(value), 40));
    mockFetchProducts.mockImplementation(() =>
      afterTwoReadTimeouts([
        { id: "pregnancy_module", displayPrice: "€4.99" },
      ] as unknown as Awaited<ReturnType<typeof fetchProducts>>),
    );
    mockGetPurchases.mockImplementation(() => afterTwoReadTimeouts([]));
    const client = androidClient(20);

    await expect(client.loadProduct("pregnancy_module")).resolves.toEqual({
      productId: "pregnancy_module",
      displayPrice: "€4.99",
    });
    await expect(client.listPurchases()).rejects.toThrow(/^store_unavailable$/);
  });

  it("rejects every call off Google Play without touching the store library", async () => {
    expect(androidClient().supported).toBe(true);

    for (const platformOS of ["ios", "web", "windows"]) {
      const client = createStoreClient({ platformOS });
      expect(client.supported).toBe(false);

      await expect(client.listPurchases()).rejects.toThrow(/^store_unavailable$/);
      await expect(client.loadProduct("pregnancy_module")).rejects.toThrow();
      await expect(client.purchase("pregnancy_module")).rejects.toThrow();
      await expect(client.acknowledge("pregnancy_module")).rejects.toThrow();
    }

    expect(mockInit).not.toHaveBeenCalled();
    expect(mockRequestPurchase).not.toHaveBeenCalled();
    expect(mockFinish).not.toHaveBeenCalled();
  });

  it("loads the real store library without its native module, as where it is not linked", async () => {
    // iOS excludes the library's native module from autolinking, so importing
    // it must not reach for native code; only a call may fail.
    const actual = jest.requireActual<typeof import("expo-iap")>("expo-iap");

    expect(typeof actual.requestPurchase).toBe("function");
    await expect(actual.initConnection()).rejects.toBeDefined();
  });

  describe("cloud subscription plans", () => {
    type Phase = {
      priceAmountMicros: string;
      formattedPrice: string;
      recurrenceMode: number;
    };
    const phase = (price: string, micros: string, recurrenceMode = 1): Phase => ({
      priceAmountMicros: micros,
      formattedPrice: price,
      recurrenceMode,
    });
    const FREE_MONTH = phase("Free", "0", 2);

    function offer(basePlanId: string, offerToken: string, phases: Phase[], id = basePlanId) {
      return {
        id,
        basePlanIdAndroid: basePlanId,
        offerTokenAndroid: offerToken,
        displayPrice: phases.at(-1)!.formattedPrice,
        price: 0,
        type: "introductory",
        pricingPhasesAndroid: { pricingPhaseList: phases },
      };
    }

    function storeReturns(offers: unknown[], productId = "ovumcy_cloud") {
      mockFetchProducts.mockResolvedValue([
        { id: productId, type: "subs", platform: "android", subscriptionOffers: offers },
      ] as unknown as Awaited<ReturnType<typeof fetchProducts>>);
    }

    const MONTHLY = offer("monthly", "offer-token-monthly", [phase("€3.99", "3990000")]);
    const MONTHLY_TRIAL = offer(
      "monthly",
      "offer-token-monthly-trial",
      [FREE_MONTH, phase("€3.99", "3990000")],
      "trial-1m-monthly",
    );
    const YEARLY = offer("yearly", "offer-token-yearly", [phase("€34.99", "34990000")]);
    const YEARLY_TRIAL = offer(
      "yearly",
      "offer-token-yearly-trial",
      [FREE_MONTH, phase("€34.99", "34990000")],
      "trial-1m-yearly",
    );

    it("offers only the allowlisted monthly and yearly base plans, at the store's renewing price", async () => {
      storeReturns([
        offer("weekly", "offer-token-weekly", [phase("€1.49", "1490000")]),
        YEARLY_TRIAL,
        MONTHLY,
        YEARLY,
        MONTHLY_TRIAL,
      ]);

      const plans = await androidClient().loadSubscriptionPlans();

      expect(plans).toEqual([
        { basePlanId: "monthly", displayPrice: "€3.99", freeTrial: true },
        { basePlanId: "yearly", displayPrice: "€34.99", freeTrial: true },
      ]);
      expect(mockFetchProducts).toHaveBeenCalledWith({
        skus: ["ovumcy_cloud"],
        type: "subs",
      });
      expect(JSON.stringify(plans)).not.toMatch(/offer-token/);
    });

    it("notes a free trial only when the store returns a free-trial offer", async () => {
      storeReturns([MONTHLY, YEARLY]);

      await expect(androidClient().loadSubscriptionPlans()).resolves.toEqual([
        { basePlanId: "monthly", displayPrice: "€3.99", freeTrial: false },
        { basePlanId: "yearly", displayPrice: "€34.99", freeTrial: false },
      ]);
    });

    it("offers nothing for another product, an offer without a token, or a store error", async () => {
      storeReturns([MONTHLY], "pregnancy_module");
      await expect(androidClient().loadSubscriptionPlans()).resolves.toEqual([]);

      storeReturns([offer("yearly", "", [phase("€34.99", "34990000")])]);
      await expect(androidClient().loadSubscriptionPlans()).resolves.toEqual([]);

      mockFetchProducts.mockRejectedValue(new Error("debug text from the store"));
      await expect(androidClient().loadSubscriptionPlans()).rejects.toThrow(
        /^store_unavailable$/,
      );
    });

    it("prices an intro-priced offer at its renewing phase, or its last phase when none renews forever", async () => {
      storeReturns([
        offer("monthly", "offer-token-monthly-intro", [
          phase("€0.99", "990000", 2),
          phase("€3.99", "3990000"),
        ]),
        offer("yearly", "offer-token-yearly-finite", [
          phase("€9.99", "9990000", 2),
          phase("€34.99", "34990000", 2),
        ]),
      ]);

      await expect(androidClient().loadSubscriptionPlans()).resolves.toEqual([
        { basePlanId: "monthly", displayPrice: "€3.99", freeTrial: false },
        { basePlanId: "yearly", displayPrice: "€34.99", freeTrial: false },
      ]);
    });

    it("offers nothing for a plan whose only price is free or blank, or a store answer without offers or phases", async () => {
      storeReturns([
        offer("monthly", "offer-token-free-only", [FREE_MONTH]),
        offer("yearly", "offer-token-unpriced", [phase("", "34990000")]),
      ]);
      await expect(androidClient().loadSubscriptionPlans()).resolves.toEqual([]);

      const { pricingPhasesAndroid: _phases, ...withoutPhases } = MONTHLY;
      storeReturns([withoutPhases]);
      await expect(androidClient().loadSubscriptionPlans()).resolves.toEqual([]);

      mockFetchProducts.mockResolvedValue([
        { id: "ovumcy_cloud", type: "subs", platform: "android", subscriptionOffers: null },
      ] as unknown as Awaited<ReturnType<typeof fetchProducts>>);
      await expect(androidClient().loadSubscriptionPlans()).resolves.toEqual([]);

      mockFetchProducts.mockResolvedValue(
        null as unknown as Awaited<ReturnType<typeof fetchProducts>>,
      );
      await expect(androidClient().loadSubscriptionPlans()).resolves.toEqual([]);
    });

    it("buys the chosen base plan with its free-trial offer when the store returns one, otherwise with the base plan", async () => {
      storeReturns([MONTHLY, MONTHLY_TRIAL, YEARLY]);
      const client = androidClient();

      await expect(client.purchaseSubscription("monthly")).resolves.toBe("completed");
      await expect(client.purchaseSubscription("yearly")).resolves.toBe("completed");

      expect(mockRequestPurchase.mock.calls).toEqual([
        [
          {
            request: {
              google: {
                skus: ["ovumcy_cloud"],
                subscriptionOffers: [
                  { sku: "ovumcy_cloud", offerToken: "offer-token-monthly-trial" },
                ],
              },
            },
            type: "subs",
          },
        ],
        [
          {
            request: {
              google: {
                skus: ["ovumcy_cloud"],
                subscriptionOffers: [
                  { sku: "ovumcy_cloud", offerToken: "offer-token-yearly" },
                ],
              },
            },
            type: "subs",
          },
        ],
      ]);
      expect(mockFinish).not.toHaveBeenCalled();
    });

    it("never opens the sheet for a base plan the store does not return", async () => {
      storeReturns([MONTHLY]);

      await expect(androidClient().purchaseSubscription("yearly")).rejects.toThrow(
        /^store_unavailable$/,
      );
      expect(mockRequestPurchase).not.toHaveBeenCalled();
    });

    it("reports a cancelled subscription sheet as cancelled and a failed one as store unavailable", async () => {
      storeReturns([YEARLY]);
      mockRequestPurchase.mockRejectedValueOnce({ code: "user-cancelled" });
      await expect(androidClient().purchaseSubscription("yearly")).resolves.toBe(
        "cancelled",
      );

      mockRequestPurchase.mockRejectedValueOnce(new Error("debug text from the store"));
      await expect(androidClient().purchaseSubscription("yearly")).rejects.toThrow(
        /^store_unavailable$/,
      );
    });
  });

  it("exports a default client bound to the running platform", async () => {
    // Jest runs as iOS, where no store is wired.
    await expect(storeClient.listPurchases()).rejects.toThrow(
      /^store_unavailable$/,
    );
  });
});
