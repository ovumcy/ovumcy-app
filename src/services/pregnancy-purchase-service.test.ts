import type { StoreClient, StorePurchase } from "../billing/store-contract";
import {
  acknowledgePregnancyModulePurchase,
  isPregnancyPurchaseSupported,
  loadPregnancyUnlockOffer,
  purchasePregnancyModule,
  restorePregnancyModulePurchase,
} from "./pregnancy-purchase-service";

type StoreCalls = Omit<StoreClient, "supported">;
type MockStoreClient = { supported: boolean } & {
  [K in keyof StoreCalls]: jest.Mock;
};

function createClient(overrides: Partial<MockStoreClient> = {}): MockStoreClient {
  return {
    supported: true,
    loadProduct: jest
      .fn()
      .mockResolvedValue({ productId: "pregnancy_module", displayPrice: "€4.99" }),
    listPurchases: jest.fn().mockResolvedValue([]),
    purchase: jest.fn().mockResolvedValue("completed"),
    acknowledge: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function purchase(overrides: Partial<StorePurchase> = {}): StorePurchase {
  return {
    productId: "pregnancy_module",
    state: "purchased",
    acknowledged: false,
    ...overrides,
  };
}

const unavailable = () => Promise.reject(new Error("store_unavailable"));

describe("purchasePregnancyModule", () => {
  it("acknowledges a completed purchase and never consumes it", async () => {
    const client = createClient({
      listPurchases: jest.fn().mockResolvedValue([purchase()]),
    });

    await expect(purchasePregnancyModule(client)).resolves.toBe("owned");

    expect(client.purchase).toHaveBeenCalledWith("pregnancy_module");
    expect(client.acknowledge.mock.calls).toEqual([["pregnancy_module"]]);
    // The contract has no consume operation at all.
    expect(Object.keys(client).sort()).toEqual([
      "acknowledge",
      "listPurchases",
      "loadProduct",
      "purchase",
      "supported",
    ]);
  });

  it("reports ownership without waiting for the acknowledgment", async () => {
    const neverAcknowledged = jest.fn(() => new Promise<void>(() => undefined));
    const client = createClient({
      listPurchases: jest.fn().mockResolvedValue([purchase()]),
      acknowledge: neverAcknowledged,
    });

    await expect(purchasePregnancyModule(client)).resolves.toBe("owned");
    await expect(restorePregnancyModulePurchase(client)).resolves.toBe("owned");
    await expect(loadPregnancyUnlockOffer(client)).resolves.toEqual({
      status: "owned",
    });
    expect(neverAcknowledged).toHaveBeenCalledTimes(3);
  });

  it("reports a pending payment as pending and acknowledges nothing", async () => {
    const client = createClient({
      listPurchases: jest.fn().mockResolvedValue([purchase({ state: "pending" })]),
    });

    await expect(purchasePregnancyModule(client)).resolves.toBe("pending");
    expect(client.acknowledge).not.toHaveBeenCalled();
  });

  it("reports a cancelled sheet as cancelled", async () => {
    const client = createClient({
      purchase: jest.fn().mockResolvedValue("cancelled"),
    });

    await expect(purchasePregnancyModule(client)).resolves.toBe("cancelled");
    expect(client.acknowledge).not.toHaveBeenCalled();
  });

  it("trusts the store's record over how the sheet ended", async () => {
    // "Already owned" surfaces as a failed sheet; the re-read finds the purchase.
    const alreadyOwned = createClient({
      purchase: jest.fn(unavailable),
      listPurchases: jest.fn().mockResolvedValue([purchase({ acknowledged: true })]),
    });
    await expect(purchasePregnancyModule(alreadyOwned)).resolves.toBe("owned");

    // A sheet that reported success without a purchase behind it grants nothing.
    const phantom = createClient();
    await expect(purchasePregnancyModule(phantom)).resolves.toBe("unavailable");
  });

  it("reports unavailable when the purchase fails or the store cannot be re-read", async () => {
    const failed = createClient({ purchase: jest.fn(unavailable) });
    await expect(purchasePregnancyModule(failed)).resolves.toBe("unavailable");

    // A sheet that completed, then an unreadable store: the payment may exist,
    // so the answer is "check again" — it still unlocks nothing.
    const unreadable = createClient({ listPurchases: jest.fn(unavailable) });
    await expect(purchasePregnancyModule(unreadable)).resolves.toBe("pending");
    expect(unreadable.acknowledge).not.toHaveBeenCalled();

    const failedUnreadable = createClient({
      purchase: jest.fn(unavailable),
      listPurchases: jest.fn(unavailable),
    });
    await expect(purchasePregnancyModule(failedUnreadable)).resolves.toBe(
      "unavailable",
    );

    const cancelledUnreadable = createClient({
      purchase: jest.fn().mockResolvedValue("cancelled"),
      listPurchases: jest.fn(unavailable),
    });
    await expect(purchasePregnancyModule(cancelledUnreadable)).resolves.toBe(
      "unavailable",
    );
  });

  it("stays owned when the acknowledgment fails; the launch task retries it", async () => {
    const client = createClient({
      listPurchases: jest.fn().mockResolvedValue([purchase()]),
      acknowledge: jest.fn(unavailable),
    });

    await expect(purchasePregnancyModule(client)).resolves.toBe("owned");
  });
});

describe("default store client", () => {
  it("buys and restores nothing under Jest, where no store is wired", async () => {
    await expect(purchasePregnancyModule()).resolves.toBe("unavailable");
    await expect(restorePregnancyModulePurchase()).resolves.toBe("unavailable");
    await expect(loadPregnancyUnlockOffer()).resolves.toEqual({
      status: "unavailable",
    });
  });
});

describe("isPregnancyPurchaseSupported", () => {
  it("follows the store client: a build with no store offers no purchase", () => {
    expect(isPregnancyPurchaseSupported(createClient())).toBe(true);
    expect(isPregnancyPurchaseSupported(createClient({ supported: false }))).toBe(
      false,
    );
    // Jest runs as iOS, where no store is wired.
    expect(isPregnancyPurchaseSupported()).toBe(false);
  });
});

describe("restorePregnancyModulePurchase", () => {
  it("restores an existing purchase and acknowledges it", async () => {
    const client = createClient({
      listPurchases: jest.fn().mockResolvedValue([purchase()]),
    });

    await expect(restorePregnancyModulePurchase(client)).resolves.toBe("owned");
    expect(client.acknowledge.mock.calls).toEqual([["pregnancy_module"]]);
    expect(client.purchase).not.toHaveBeenCalled();
  });

  it("reports pending, not found and unavailable without buying anything", async () => {
    const pending = createClient({
      listPurchases: jest.fn().mockResolvedValue([purchase({ state: "pending" })]),
    });
    await expect(restorePregnancyModulePurchase(pending)).resolves.toBe("pending");

    const subscriptionOnly = createClient({
      listPurchases: jest
        .fn()
        .mockResolvedValue([purchase({ productId: "ovumcy_cloud" })]),
    });
    await expect(restorePregnancyModulePurchase(subscriptionOnly)).resolves.toBe(
      "not_found",
    );

    const down = createClient({ listPurchases: jest.fn(unavailable) });
    await expect(restorePregnancyModulePurchase(down)).resolves.toBe("unavailable");

    for (const client of [pending, subscriptionOnly, down]) {
      expect(client.purchase).not.toHaveBeenCalled();
      expect(client.acknowledge).not.toHaveBeenCalled();
    }
  });
});

describe("loadPregnancyUnlockOffer", () => {
  it("offers the store's price when the module is not owned", async () => {
    const client = createClient();

    await expect(loadPregnancyUnlockOffer(client)).resolves.toEqual({
      status: "available",
      displayPrice: "€4.99",
    });
    expect(client.loadProduct).toHaveBeenCalledWith("pregnancy_module");
  });

  it("reports an owned module without a product lookup", async () => {
    const client = createClient({
      listPurchases: jest.fn().mockResolvedValue([purchase()]),
    });

    await expect(loadPregnancyUnlockOffer(client)).resolves.toEqual({
      status: "owned",
    });
    expect(client.loadProduct).not.toHaveBeenCalled();
    expect(client.acknowledge).toHaveBeenCalledWith("pregnancy_module");
  });

  it("reports a pending payment", async () => {
    const client = createClient({
      listPurchases: jest.fn().mockResolvedValue([purchase({ state: "pending" })]),
    });

    await expect(loadPregnancyUnlockOffer(client)).resolves.toEqual({
      status: "pending",
    });
  });

  it("reports unavailable for a store error, an unsold product or a blank price", async () => {
    const cases = [
      createClient({ listPurchases: jest.fn(unavailable) }),
      createClient({ loadProduct: jest.fn(unavailable) }),
      createClient({ loadProduct: jest.fn().mockResolvedValue(null) }),
      createClient({
        loadProduct: jest
          .fn()
          .mockResolvedValue({ productId: "pregnancy_module", displayPrice: " " }),
      }),
    ];

    for (const client of cases) {
      await expect(loadPregnancyUnlockOffer(client)).resolves.toEqual({
        status: "unavailable",
      });
    }
  });
});

describe("acknowledgePregnancyModulePurchase", () => {
  it("acknowledges a purchased, unacknowledged module purchase", async () => {
    const client = createClient({
      listPurchases: jest.fn().mockResolvedValue([purchase()]),
    });

    await acknowledgePregnancyModulePurchase(client);

    expect(client.acknowledge.mock.calls).toEqual([["pregnancy_module"]]);
  });

  it("leaves pending, acknowledged and foreign purchases alone", async () => {
    const client = createClient({
      listPurchases: jest
        .fn()
        .mockResolvedValue([
          purchase({ state: "pending" }),
          purchase({ acknowledged: true }),
          purchase({ productId: "ovumcy_cloud" }),
        ]),
    });

    await acknowledgePregnancyModulePurchase(client);

    expect(client.acknowledge).not.toHaveBeenCalled();
    expect(client.purchase).not.toHaveBeenCalled();
  });

  it("never rejects, whatever the store does", async () => {
    await expect(
      acknowledgePregnancyModulePurchase(
        createClient({ listPurchases: jest.fn(unavailable) }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      acknowledgePregnancyModulePurchase(
        createClient({
          listPurchases: jest.fn().mockResolvedValue([purchase()]),
          acknowledge: jest.fn(unavailable),
        }),
      ),
    ).resolves.toBeUndefined();
    // The default client has no store under Jest.
    await expect(acknowledgePregnancyModulePurchase()).resolves.toBeUndefined();
  });
});
