// Choosing and buying an Ovumcy Cloud plan through the store. A purchase here
// grants nothing on the device: premium turns on only from the managed billing
// snapshot (docs/sync-trust-model.md, Purchase flows). Nothing here touches
// managed billing, a sync session or storage.

import { storeClient } from "../billing/store-client";
import type {
  CloudSubscriptionBasePlanId,
  StoreClient,
  StoreSubscriptionPlan,
} from "../billing/store-contract";

// Off until the managed cloud can take a store purchase over: without that
// handoff a purchase reaches no account and the store refunds it. While off,
// nothing here contacts the store.
export const CLOUD_SUBSCRIPTION_PURCHASE_ENABLED = false;

export type CloudSubscriptionPurchaseResult =
  | "completed"
  | "cancelled"
  | "unavailable";

type Options = { client?: StoreClient; enabled?: boolean };

function storeIfEnabled(options: Options): StoreClient | null {
  const client = options.client ?? storeClient;
  const enabled = options.enabled ?? CLOUD_SUBSCRIPTION_PURCHASE_ENABLED;
  return enabled && client.supported ? client : null;
}

/** Empty when switched off, without a store, or when the store fails. */
export async function loadCloudSubscriptionPlans(
  options: Options = {},
): Promise<readonly StoreSubscriptionPlan[]> {
  const client = storeIfEnabled(options);
  if (!client) {
    return [];
  }
  try {
    return await client.loadSubscriptionPlans();
  } catch {
    return [];
  }
}

export async function purchaseCloudSubscription(
  basePlanId: CloudSubscriptionBasePlanId,
  options: Options = {},
): Promise<CloudSubscriptionPurchaseResult> {
  const client = storeIfEnabled(options);
  if (!client) {
    return "unavailable";
  }
  try {
    return await client.purchaseSubscription(basePlanId);
  } catch {
    return "unavailable";
  }
}
