// Transport-free store contract. Services and screens see only these types;
// the store library is imported in exactly one adapter (store-client.native).
//
// Two things are absent on purpose:
// - a consume operation — the products sold through this contract are a
//   non-consumable and a subscription, and consuming the non-consumable would
//   let the store sell it again while erasing the purchase that proves
//   ownership;
// - the purchase and offer tokens — nothing outside the adapter needs them
//   today, so they cannot reach storage, logs or a route. The subscription's
//   handoff to the managed cloud (docs/sync-trust-model.md, Purchase flows) is
//   not built yet.

export const PREGNANCY_MODULE_PRODUCT_ID = "pregnancy_module";

// The Ovumcy Cloud subscription. Premium never follows from a purchase of it
// on the device: only the managed billing snapshot turns premium on.
export const CLOUD_SUBSCRIPTION_PRODUCT_ID = "ovumcy_cloud";

// The only base plans the app offers; any other plan the store returns is
// dropped.
export const CLOUD_SUBSCRIPTION_BASE_PLAN_IDS = ["monthly", "yearly"] as const;

export type CloudSubscriptionBasePlanId =
  (typeof CLOUD_SUBSCRIPTION_BASE_PLAN_IDS)[number];

export type StoreSubscriptionPlan = {
  basePlanId: CloudSubscriptionBasePlanId;
  // The recurring price, formatted by the store; shown verbatim.
  displayPrice: string;
  // True only when the store returned a free-trial offer for this store
  // account on this base plan.
  freeTrial: boolean;
};

export type StoreProduct = {
  productId: string;
  // Formatted by the store in the store account's currency; shown verbatim.
  displayPrice: string;
};

// "pending" is a purchase the store has not charged yet (a deferred payment
// method); it is not ownership. "unknown" is any state the adapter does not
// recognize and is treated like "pending" by every caller.
export type StorePurchaseState = "purchased" | "pending" | "unknown";

export type StorePurchase = {
  productId: string;
  state: StorePurchaseState;
  acknowledged: boolean;
};

// "completed" means the store's purchase sheet ended without a cancel — the
// purchase may still be pending, so callers re-read `listPurchases` instead of
// treating this as ownership.
export type StorePurchaseOutcome = "completed" | "cancelled";

/**
 * Every method rejects when the store cannot be reached or answers with an
 * error; callers treat any rejection as "store unavailable" and fail closed.
 */
export type StoreClient = {
  /**
   * Whether this build has a store wired at all. Where it has none, a
   * purchase affordance stays absent instead of leading to a dead end.
   */
  readonly supported: boolean;
  /** Resolves `null` when the store does not sell this product here. */
  loadProduct(productId: string): Promise<StoreProduct | null>;
  /** The store account's current one-time purchases, pending ones included. */
  listPurchases(): Promise<readonly StorePurchase[]>;
  purchase(productId: string): Promise<StorePurchaseOutcome>;
  /**
   * Acknowledges the purchased, not yet acknowledged purchase of this product.
   * A no-op when there is none.
   */
  acknowledge(productId: string): Promise<void>;
  /**
   * The allowlisted base plans of the cloud subscription the store sells this
   * account, in allowlist order. Empty when the store sells none of them.
   */
  loadSubscriptionPlans(): Promise<readonly StoreSubscriptionPlan[]>;
  /**
   * Opens the store's sheet for this base plan, with its free-trial offer when
   * the store returns one. Never acknowledges: that is the managed cloud's.
   */
  purchaseSubscription(
    basePlanId: CloudSubscriptionBasePlanId,
  ): Promise<StorePurchaseOutcome>;
};
