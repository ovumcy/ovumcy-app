// Buying, restoring and acknowledging the one-time pregnancy-module purchase.
// The store's purchase list is the only truth: every function re-reads it and
// never infers ownership from how the purchase sheet ended. Nothing is
// persisted, and nothing here touches managed billing or a sync session.

import { storeClient } from "../billing/store-client";
import {
  PREGNANCY_MODULE_PRODUCT_ID,
  type StoreClient,
} from "../billing/store-contract";
import { resolvePregnancyModulePurchaseState } from "./pregnancy-store-entitlement-source";

export type PregnancyUnlockOffer =
  | { status: "owned" }
  | { status: "pending" }
  | { status: "available"; displayPrice: string }
  | { status: "unavailable" };

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
 * What the unlock screen shows on open. An already-owned module skips the
 * product lookup; a product the store does not sell here reads as
 * "unavailable" rather than as a buy button without a price.
 */
export async function loadPregnancyUnlockOffer(
  client: StoreClient = storeClient,
): Promise<PregnancyUnlockOffer> {
  try {
    const state = resolvePregnancyModulePurchaseState(
      await client.listPurchases(),
    );
    if (state === "owned") {
      await acknowledgeQuietly(client);
      return { status: "owned" };
    }
    if (state === "pending") {
      return { status: "pending" };
    }

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
  let cancelled = false;
  try {
    cancelled = (await client.purchase(PREGNANCY_MODULE_PRODUCT_ID)) === "cancelled";
  } catch {
    // Fall through to the re-read below.
  }

  const state = await readState(client);
  if (state === "owned") {
    await acknowledgeQuietly(client);
    return "owned";
  }
  if (state === "pending") {
    return "pending";
  }
  return cancelled && state === "not_owned" ? "cancelled" : "unavailable";
}

/**
 * "Restore purchases": the store keeps the purchase with the store account,
 * so restoring is a re-read plus the acknowledgment a reinstall may still owe.
 */
export async function restorePregnancyModulePurchase(
  client: StoreClient = storeClient,
): Promise<PregnancyRestoreResult> {
  const state = await readState(client);
  if (state === "owned") {
    await acknowledgeQuietly(client);
    return "owned";
  }
  if (state === "pending") {
    return "pending";
  }
  return state === "not_owned" ? "not_found" : "unavailable";
}

/**
 * Launch task. A purchase that was pending when the app last ran may have
 * been charged since; the store refunds a purchase left unacknowledged for
 * three days. Never rejects.
 */
export async function acknowledgePregnancyModulePurchase(
  client: StoreClient = storeClient,
): Promise<void> {
  try {
    const purchases = await client.listPurchases();
    const owed = purchases.some(
      (purchase) =>
        purchase.productId === PREGNANCY_MODULE_PRODUCT_ID &&
        purchase.state === "purchased" &&
        !purchase.acknowledged,
    );
    if (owed) {
      await client.acknowledge(PREGNANCY_MODULE_PRODUCT_ID);
    }
  } catch {
    // Best effort: the next launch, or the unlock screen, retries.
  }
}

async function readState(client: StoreClient) {
  try {
    return resolvePregnancyModulePurchaseState(await client.listPurchases());
  } catch {
    return "unavailable" as const;
  }
}

// Ownership does not wait on the acknowledgment: a failed one is retried at
// the next launch, well inside the store's three-day window.
async function acknowledgeQuietly(client: StoreClient): Promise<void> {
  try {
    await client.acknowledge(PREGNANCY_MODULE_PRODUCT_ID);
  } catch {
    // Retried by acknowledgePregnancyModulePurchase.
  }
}
