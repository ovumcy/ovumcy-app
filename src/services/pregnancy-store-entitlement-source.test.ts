import type { StoreClient, StorePurchase } from "../billing/store-contract";
import { loadPregnancyModuleOwned } from "./pregnancy-entitlement-service";
import {
  acknowledgeOwedPregnancyPurchase,
  createStorePregnancyEntitlementSource,
  resolvePregnancyModulePurchaseState,
} from "./pregnancy-store-entitlement-source";

function clientWith(
  listPurchases: StoreClient["listPurchases"],
): StoreClient & { [K in keyof Omit<StoreClient, "supported">]: jest.Mock } {
  return {
    supported: true,
    loadProduct: jest.fn(),
    listPurchases: jest.fn(listPurchases),
    purchase: jest.fn(),
    acknowledge: jest.fn().mockResolvedValue(undefined),
  };
}

function purchase(overrides: Partial<StorePurchase> = {}): StorePurchase {
  return {
    productId: "pregnancy_module",
    state: "purchased",
    acknowledged: true,
    ...overrides,
  };
}

async function ownedFor(purchases: StorePurchase[]): Promise<boolean> {
  return loadPregnancyModuleOwned(
    createStorePregnancyEntitlementSource(clientWith(async () => purchases)),
  );
}

describe("store pregnancy entitlement source", () => {
  it("owns the module for a pregnancy_module purchase in the purchased state", async () => {
    await expect(ownedFor([purchase()])).resolves.toBe(true);
    // Ownership does not wait on the acknowledgment.
    await expect(ownedFor([purchase({ acknowledged: false })])).resolves.toBe(
      true,
    );
  });

  it("does not own the module for a pending purchase, another product, a subscription alone, or an empty store", async () => {
    await expect(ownedFor([])).resolves.toBe(false);
    await expect(ownedFor([purchase({ state: "pending" })])).resolves.toBe(false);
    await expect(ownedFor([purchase({ state: "unknown" })])).resolves.toBe(false);
    await expect(
      ownedFor([purchase({ productId: "pregnancy_module_plus" })]),
    ).resolves.toBe(false);
    await expect(
      ownedFor([purchase({ productId: "ovumcy_cloud" })]),
    ).resolves.toBe(false);
  });

  it("does not own the module when the store read fails", async () => {
    const source = createStorePregnancyEntitlementSource(
      clientWith(async () => {
        throw new Error("store_unavailable");
      }),
    );

    await expect(loadPregnancyModuleOwned(source)).resolves.toBe(false);
  });

  it("reads the store once and never buys or looks up a product", async () => {
    const client = clientWith(async () => [purchase()]);

    await createStorePregnancyEntitlementSource(client).loadOwnsPregnancyModule();

    expect(client.listPurchases).toHaveBeenCalledTimes(1);
    expect(client.purchase).not.toHaveBeenCalled();
    expect(client.loadProduct).not.toHaveBeenCalled();
    // Nothing is owed on an acknowledged purchase.
    expect(client.acknowledge).not.toHaveBeenCalled();
  });

  it("starts the acknowledgment a purchased module purchase still owes, without waiting for it", async () => {
    const client = clientWith(async () => [purchase({ acknowledged: false })]);
    client.acknowledge.mockReturnValue(new Promise<void>(() => undefined));

    await expect(
      createStorePregnancyEntitlementSource(client).loadOwnsPregnancyModule(),
    ).resolves.toBe(true);

    expect(client.acknowledge.mock.calls).toEqual([["pregnancy_module"]]);
  });

  it("leaves pending, acknowledged and foreign purchases alone", async () => {
    const client = clientWith(async () => [
      purchase({ state: "pending", acknowledged: false }),
      purchase({ state: "unknown", acknowledged: false }),
      purchase({ acknowledged: true }),
      purchase({ productId: "ovumcy_cloud", acknowledged: false }),
    ]);

    await createStorePregnancyEntitlementSource(client).loadOwnsPregnancyModule();
    acknowledgeOwedPregnancyPurchase(client, []);

    expect(client.acknowledge).not.toHaveBeenCalled();
  });

  it("never lets a failed acknowledgment change ownership", async () => {
    const client = clientWith(async () => [purchase({ acknowledged: false })]);
    client.acknowledge.mockRejectedValue(new Error("store_unavailable"));

    await expect(
      loadPregnancyModuleOwned(createStorePregnancyEntitlementSource(client)),
    ).resolves.toBe(true);
  });

  it("defaults to the platform store client, which has no store under Jest", async () => {
    await expect(
      loadPregnancyModuleOwned(createStorePregnancyEntitlementSource()),
    ).resolves.toBe(false);
  });
});

describe("resolvePregnancyModulePurchaseState", () => {
  it("prefers a purchased entry over a pending one for the same product", () => {
    expect(
      resolvePregnancyModulePurchaseState([
        purchase({ state: "pending" }),
        purchase(),
      ]),
    ).toBe("owned");
  });

  it("reports pending only for the module's own pending purchase", () => {
    expect(
      resolvePregnancyModulePurchaseState([purchase({ state: "pending" })]),
    ).toBe("pending");
    expect(
      resolvePregnancyModulePurchaseState([
        purchase({ productId: "ovumcy_cloud", state: "pending" }),
      ]),
    ).toBe("not_owned");
    expect(
      resolvePregnancyModulePurchaseState([purchase({ state: "unknown" })]),
    ).toBe("not_owned");
  });
});
