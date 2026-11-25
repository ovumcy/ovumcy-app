// Transport-free store contract. Services and screens see only these types;
// the store library is imported in exactly one adapter (store-client.native).
//
// Two things are absent on purpose:
// - a consume operation — the only product sold through this contract is a
//   non-consumable, and consuming it would let the store sell it again while
//   erasing the purchase that proves ownership;
// - the purchase token — nothing outside the adapter needs it for a purchase
//   decided on the device, so it cannot reach storage, logs or a route.

export const PREGNANCY_MODULE_PRODUCT_ID = "pregnancy_module";

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
};
