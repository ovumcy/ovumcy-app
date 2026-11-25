// Store-backed ownership of the pregnancy module: the store's own purchase
// record, read on the device. Nothing here may import managed billing, a sync
// session or the billing snapshot — a subscription neither grants nor revokes
// the module (docs/sync-trust-model.md, Purchase flows).
//
// Ownership is never written to app storage: the store's cache answers
// offline, and a refunded or revoked purchase drops out of it on its own.
//
// The store is asked only from the pregnancy surfaces that call this source or
// the purchase service — never at launch: starting the store's billing client
// also starts the store vendor's own diagnostics (docs/privacy.md, Egress).

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
 * Starts the acknowledgment a purchased module purchase still owes, without
 * waiting for it. The store refunds a purchase left unacknowledged for three
 * days, and one that was pending when the app last ran may have been charged
 * since — so every read of the store's list is also the retry. Pending,
 * acknowledged and foreign purchases (a subscription included) are left alone.
 */
export function acknowledgeOwedPregnancyPurchase(
  client: StoreClient,
  purchases: readonly StorePurchase[],
): void {
  const owed = purchases.some(
    (purchase) =>
      purchase.productId === PREGNANCY_MODULE_PRODUCT_ID &&
      purchase.state === "purchased" &&
      !purchase.acknowledged,
  );
  if (owed) {
    client.acknowledge(PREGNANCY_MODULE_PRODUCT_ID).catch(() => {
      // Best effort: the next read of the store retries.
    });
  }
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
      acknowledgeOwedPregnancyPurchase(client, purchases);
      return resolvePregnancyModulePurchaseState(purchases) === "owned";
    },
  };
}
