import type { StoreClient } from "../billing/store-contract";
import {
  CLOUD_SUBSCRIPTION_PURCHASE_ENABLED,
  loadCloudSubscriptionPlans,
  purchaseCloudSubscription,
} from "./cloud-subscription-service";

function createClient(overrides: Partial<StoreClient> = {}) {
  return {
    supported: true,
    loadProduct: jest.fn(),
    listPurchases: jest.fn(),
    purchase: jest.fn(),
    acknowledge: jest.fn(),
    loadSubscriptionPlans: jest
      .fn()
      .mockResolvedValue([
        { basePlanId: "yearly", displayPrice: "€34.99", freeTrial: true },
      ]),
    purchaseSubscription: jest.fn().mockResolvedValue("completed"),
    ...overrides,
  };
}

describe("cloud subscription service", () => {
  it("contacts no store while the purchase affordance is switched off", async () => {
    expect(CLOUD_SUBSCRIPTION_PURCHASE_ENABLED).toBe(false);
    const client = createClient();

    await expect(loadCloudSubscriptionPlans({ client })).resolves.toEqual([]);
    await expect(purchaseCloudSubscription("yearly", { client })).resolves.toBe(
      "unavailable",
    );
    await expect(purchaseCloudSubscription("monthly")).resolves.toBe("unavailable");
    for (const call of Object.values(client)) {
      if (typeof call === "function") {
        expect(call).not.toHaveBeenCalled();
      }
    }
  });

  it("offers nothing and buys nothing where the build has no store", async () => {
    const client = createClient({ supported: false });

    await expect(
      loadCloudSubscriptionPlans({ client, enabled: true }),
    ).resolves.toEqual([]);
    await expect(
      purchaseCloudSubscription("monthly", { client, enabled: true }),
    ).resolves.toBe("unavailable");
    expect(client.loadSubscriptionPlans).not.toHaveBeenCalled();
    expect(client.purchaseSubscription).not.toHaveBeenCalled();
  });

  it("passes the store's plans and sheet outcome through once switched on", async () => {
    const client = createClient();

    await expect(
      loadCloudSubscriptionPlans({ client, enabled: true }),
    ).resolves.toEqual([
      { basePlanId: "yearly", displayPrice: "€34.99", freeTrial: true },
    ]);
    await expect(
      purchaseCloudSubscription("yearly", { client, enabled: true }),
    ).resolves.toBe("completed");
    expect(client.purchaseSubscription).toHaveBeenCalledWith("yearly");
  });

  it("fails closed when the store errors", async () => {
    const client = createClient({
      loadSubscriptionPlans: jest.fn().mockRejectedValue(new Error("store_unavailable")),
      purchaseSubscription: jest.fn().mockRejectedValue(new Error("store_unavailable")),
    });

    await expect(
      loadCloudSubscriptionPlans({ client, enabled: true }),
    ).resolves.toEqual([]);
    await expect(
      purchaseCloudSubscription("yearly", { client, enabled: true }),
    ).resolves.toBe("unavailable");
  });
});
