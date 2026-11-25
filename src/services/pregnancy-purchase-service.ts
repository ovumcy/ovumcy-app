// Buying and restoring the one-time pregnancy-module purchase. The store's
// purchase list is the only truth: every function re-reads it and never
// infers ownership from how the purchase sheet ended. Nothing is persisted,
// and nothing here touches managed billing or a sync session.

import { storeClient } from "../billing/store-client";
import {
  PREGNANCY_MODULE_PRODUCT_ID,
  type StoreClient,
  type StorePurchase,
  type StorePurchaseOutcome,
} from "../billing/store-contract";
import {
  acknowledgeOwedPregnancyPurchase,
  resolvePregnancyModulePurchaseState,
  type PregnancyModulePurchaseState,
} from "./pregnancy-store-entitlement-source";

export type PregnancyUnlockOffer =
  | { status: "owned" }
  | { status: "pending" }
  | { status: "available"; displayPrice: string }
  | { status: "unavailable" }
  // This build has no store at all: nothing to retry or restore.
  | { status: "unsupported" };

export type PregnancyPurchaseResult =
  | "owned"
  | "pending"
  | "cancelled"
  | "unavailable";

export type PregnancyRestoreResult =
  | "owned"
  | "pending"
  | "not_found"
  | "unavailable";

/**
 * Whether this build can sell the module at all. A lock card offers the
 * purchase screen only where this is true; elsewhere it stays informational,
 * because an unlock action that can never succeed is worse than none. Reads a
 * constant: it does not contact the store.
 */
export function isPregnancyPurchaseSupported(
  client: StoreClient = storeClient,
): boolean {
  return client.supported;
}

/**
 * What the unlock screen shows on open. An already-owned module skips the
 * product lookup; a product the store does not sell here reads as
 * "unavailable" rather than as a buy button without a price.
 */
export async function loadPregnancyUnlockOffer(
  client: StoreClient = storeClient,
): Promise<PregnancyUnlockOffer> {
  if (!client.supported) {
    return { status: "unsupported" };
  }

  const state = await readState(client);
  if (state === "owned" || state === "pending" || state === "unavailable") {
    return { status: state };
  }

  try {
    const product = await client.loadProduct(PREGNANCY_MODULE_PRODUCT_ID);
    if (!product || product.displayPrice.trim() === "") {
      return { status: "unavailable" };
    }
    return { status: "available", displayPrice: product.displayPrice };
  } catch {
    return { status: "unavailable" };
  }
}

/**
 * Opens the store's purchase sheet. A sheet that failed is still followed by
 * a re-read: the store reports "already owned" as an error, and a purchase can
 * land even when its result never reached the app.
 */
export async function purchasePregnancyModule(
  client: StoreClient = storeClient,
): Promise<PregnancyPurchaseResult> {
  let outcome: StorePurchaseOutcome | "failed" = "failed";
  try {
    outcome = await client.purchase(PREGNANCY_MODULE_PRODUCT_ID);
  } catch {
    // Fall through to the re-read below.
  }

  const state = await readState(client);
  if (state === "owned" || state === "pending") {
    return state;
  }
  if (state === "unavailable") {
    // The sheet completed but the store could not be re-read: the payment may
    // well exist, so this is "check again", never "the store is down".
    return outcome === "completed" ? "pending" : "unavailable";
  }
  return outcome === "cancelled" ? "cancelled" : "unavailable";
}

/**
 * "Restore purchases": the store keeps the purchase with the store account,
 * so restoring is a re-read plus the acknowledgment a reinstall may still owe.
 */
export async function restorePregnancyModulePurchase(
  client: StoreClient = storeClient,
): Promise<PregnancyRestoreResult> {
  const state = await readState(client);
  return state === "not_owned" ? "not_found" : state;
}

// Every read also starts the acknowledgment an owned purchase still owes;
// ownership never waits on it.
async function readState(
  client: StoreClient,
): Promise<PregnancyModulePurchaseState | "unavailable"> {
  let purchases: readonly StorePurchase[];
  try {
    purchases = await client.listPurchases();
  } catch {
    return "unavailable";
  }
  acknowledgeOwedPregnancyPurchase(client, purchases);
  return resolvePregnancyModulePurchaseState(purchases);
}
