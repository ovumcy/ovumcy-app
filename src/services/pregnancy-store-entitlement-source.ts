// Store-backed ownership of the pregnancy module: the store's own purchase
// record, read on the device. Nothing here may import managed billing, a sync
// session or the billing snapshot — a subscription neither grants nor revokes
// the module (docs/sync-trust-model.md, Purchase flows).
//
// Ownership is never written to app storage: the store's cache answers
// offline, and a refunded or revoked purchase drops out of it on its own.

import { storeClient } from "../billing/store-client";
import {
  PREGNANCY_MODULE_PRODUCT_ID,
  type StoreClient,
  type StorePurchase,
} from "../billing/store-contract";
import type { PregnancyEntitlementSource } from "./pregnancy-entitlement-service";

export type PregnancyModulePurchaseState = "owned" | "pending" | "not_owned";

/**
 * The one place that decides what the store's purchase list means for the
 * module. Owned only for a `pregnancy_module` purchase in the purchased state:
 * a pending purchase, an unrecognized state, another product or a subscription
 * is not ownership.
 */
export function resolvePregnancyModulePurchaseState(
  purchases: readonly StorePurchase[],
): PregnancyModulePurchaseState {
  const own = purchases.filter(
    (purchase) => purchase.productId === PREGNANCY_MODULE_PRODUCT_ID,
  );
  if (own.some((purchase) => purchase.state === "purchased")) {
    return "owned";
  }
  return own.some((purchase) => purchase.state === "pending")
    ? "pending"
    : "not_owned";
}

/**
 * A store error rejects; `loadPregnancyModuleOwned` turns that into
 * "not owned".
 */
export function createStorePregnancyEntitlementSource(
  client: StoreClient = storeClient,
): PregnancyEntitlementSource {
  return {
    async loadOwnsPregnancyModule(): Promise<boolean> {
      const purchases = await client.listPurchases();
      return resolvePregnancyModulePurchaseState(purchases) === "owned";
    },
  };
}
