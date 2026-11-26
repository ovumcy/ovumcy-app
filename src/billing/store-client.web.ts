import type { StoreClient } from "./store-contract";

// The web build has no store: every call rejects, so ownership fails closed
// and the unlock screen reads "store unavailable".
function unavailable(): Promise<never> {
  return Promise.reject(new Error("store_unavailable"));
}

export const storeClient: StoreClient = {
  supported: false,
  loadProduct: unavailable,
  listPurchases: unavailable,
  purchase: unavailable,
  acknowledge: unavailable,
  loadSubscriptionPlans: unavailable,
  purchaseSubscription: unavailable,
};
