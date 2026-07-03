import type { LocalAppStorage } from "../storage/local/storage-contract";
import type { SyncSecretStore } from "../security/sync-secret-store";
import type { EntitlementTokenStore } from "../security/entitlement-token-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudBillingSnapshot,
  type ManagedCloudPremiumFeatures,
} from "../sync/managed-cloud-api-client";
import { MANAGED_CLOUD_AUTH_BASE_URL, type SyncMode } from "../sync/sync-contract";
import { loadSyncSetupState } from "../sync/sync-setup-service";
import { resolveVerifiedEntitlements } from "./entitlement-token-service";

/**
 * Maps a signed-token entitlement key to the corresponding
 * `ManagedCloudPremiumFeatures` flag. ONLY the two purely-local premium
 * features are token-gated (per the memo); server-gated features
 * (sync/partner/reminders/etc.) keep reading the snapshot and are never
 * overlaid here, because the server refusing the operation is their real
 * boundary.
 */
const TOKEN_GATED_FEATURE_BY_ENTITLEMENT: Readonly<
  Record<string, "doctorPDF" | "advancedInsights">
> = Object.freeze({
  doctor_pdf: "doctorPDF",
  advanced_insights: "advancedInsights",
});

/**
 * Optional signed-entitlement-token gate. When provided, the two purely-local
 * premium features are decided by a VERIFIED token; when absent (today's
 * state) every gate behaves exactly as before — pure billing-snapshot
 * booleans. `now` is injected for deterministic verification.
 */
export type EntitlementTokenGate = {
  store: EntitlementTokenStore;
  now: number;
  // The active managed account id, bound into verification so a token minted
  // for another account is rejected.
  expectedSub?: string;
};

/**
 * Overlays a verified token's entitlements onto the two token-gated features.
 *
 * Rollout phase 1 fallback contract: when a valid token is present, it is
 * authoritative for `doctorPDF` / `advancedInsights`; when no valid token is
 * present (no gate passed, no endpoint, offline with an expired cache, tamper,
 * unknown kid, …) the original snapshot booleans stand unchanged. Server-gated
 * features are never touched.
 */
async function applyEntitlementTokenOverlay(
  features: ManagedCloudPremiumFeatures,
  gate: EntitlementTokenGate | undefined,
  managedSessionToken: string | null,
): Promise<ManagedCloudPremiumFeatures> {
  if (!gate) {
    return features;
  }

  const verified = await resolveVerifiedEntitlements({
    store: gate.store,
    managedSessionToken,
    now: gate.now,
    ...(gate.expectedSub !== undefined ? { expectedSub: gate.expectedSub } : {}),
  });

  // No valid token -> leave the snapshot booleans exactly as they were.
  if (verified.size === 0) {
    return features;
  }

  const overlaid = { ...features };
  for (const [entitlement, feature] of Object.entries(
    TOKEN_GATED_FEATURE_BY_ENTITLEMENT,
  )) {
    overlaid[feature] = verified.has(entitlement);
  }
  return overlaid;
}

export const EMPTY_MANAGED_PREMIUM_FEATURES: ManagedCloudPremiumFeatures = {
  advancedFertility: false,
  advancedInsights: false,
  doctorPDF: false,
  extendedReports: false,
  partnerAccess: false,
  reminders: false,
};

// Bounded offline grace for the LOCAL premium gates. Trade-off: bounded
// availability grace (a network blip or managed outage must not instantly
// re-lock all six premium gates on a paying device) versus strict
// fail-closed enforcement (a revoked plan keeps its local unlocks for at
// most this long while the device cannot reach billing truth). 72 hours is
// the ceiling; after it every failed fetch fails closed exactly as before.
// Server-checked actions (sync upload/restore, partner projections, renewal)
// never read this cache — the server stays their authority.
export const MANAGED_BILLING_CACHE_TTL_MS = 72 * 60 * 60 * 1000;

export function isManagedBillingCacheFresh(
  fetchedAt: string,
  now: Date,
): boolean {
  const fetchedAtMs = Date.parse(fetchedAt);
  if (Number.isNaN(fetchedAtMs)) {
    return false;
  }

  const ageMs = now.getTime() - fetchedAtMs;
  return ageMs >= 0 && ageMs <= MANAGED_BILLING_CACHE_TTL_MS;
}

/**
 * persistManagedBillingSnapshotCache refreshes the last-known-good billing
 * snapshot after any successful billing fetch. Only the locally-derived plan
 * state and premium booleans are persisted (pre token-overlay server truth);
 * server-driven affordances (subscription details, renewal flags, offers)
 * intentionally stay out so they fail closed when served from cache.
 * Cache IO failures are swallowed: caching must never break a successful
 * billing fetch.
 */
export async function persistManagedBillingSnapshotCache(
  storage: LocalAppStorage,
  billing: ManagedCloudBillingSnapshot,
  now: Date,
): Promise<void> {
  try {
    const record = await storage.readManagedBillingCacheRecord();
    await storage.writeManagedBillingCacheRecord({
      ...record,
      snapshot: {
        hasActivePlan: billing.hasActivePlan,
        premiumFeatures: { ...billing.premiumFeatures },
        fetchedAt: now.toISOString(),
      },
    });
  } catch {
    // Best-effort cache refresh; the live snapshot result stands regardless.
  }
}


async function readFreshCachedBillingSnapshot(
  storage: LocalAppStorage,
  now: Date,
): Promise<ManagedCloudBillingSnapshot | null> {
  try {
    const record = await storage.readManagedBillingCacheRecord();
    if (!record.snapshot || !isManagedBillingCacheFresh(record.snapshot.fetchedAt, now)) {
      return null;
    }

    return {
      hasActivePlan: record.snapshot.hasActivePlan,
      premiumFeatures: { ...record.snapshot.premiumFeatures },
      // Server-driven display/affordance state is never cached: countdown,
      // renewal management, and offers all degrade to their empty defaults
      // while the device is on cached billing truth.
      activeSubscription: null,
      billingManagement: {
        canManageRenewal: false,
        canCancelAtPeriodEnd: false,
        canResumeRenewal: false,
      },
      offers: [],
    };
  } catch {
    return null;
  }
}

export async function loadManagedBillingSnapshot(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  // Optional signed-token gate. Absent -> pure snapshot behaviour (today).
  tokenGate?: EntitlementTokenGate,
  now: Date = new Date(),
): Promise<ManagedCloudBillingSnapshot | null> {
  if (syncMode !== "managed") {
    return null;
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.managedAuthSessionToken) {
    // No session, no grace: the cache is only ever served underneath a
    // still-present managed session whose billing fetch failed.
    return null;
  }

  const billingResult = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).getBillingSnapshot(secrets.managedAuthSessionToken);

  let billing: ManagedCloudBillingSnapshot;
  if (billingResult.ok) {
    billing = billingResult.billing;
    await persistManagedBillingSnapshotCache(storage, billing, now);
  } else {
    const cached = await readFreshCachedBillingSnapshot(storage, now);
    if (!cached) {
      return null;
    }
    billing = cached;
  }

  // Overlay verified-token entitlements onto the two purely-local features.
  // When no gate is supplied or no valid token is present, premiumFeatures is
  // returned unchanged.
  const premiumFeatures = await applyEntitlementTokenOverlay(
    billing.premiumFeatures,
    tokenGate,
    secrets.managedAuthSessionToken,
  );
  if (premiumFeatures === billing.premiumFeatures) {
    return billing;
  }
  return { ...billing, premiumFeatures };
}

export async function loadManagedPremiumFeatures(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  tokenGate?: EntitlementTokenGate,
  now: Date = new Date(),
): Promise<ManagedCloudPremiumFeatures> {
  const billingSnapshot = await loadManagedBillingSnapshot(
    storage,
    secretStore,
    syncMode,
    tokenGate,
    now,
  );
  return billingSnapshot?.premiumFeatures ?? EMPTY_MANAGED_PREMIUM_FEATURES;
}

export async function loadManagedPremiumFeaturesForCurrentSession(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  tokenGate?: EntitlementTokenGate,
): Promise<ManagedCloudPremiumFeatures> {
  try {
    const syncState = await loadSyncSetupState(storage, secretStore);
    if (!syncState.hasAuthSession || syncState.preferences.mode !== "managed") {
      return EMPTY_MANAGED_PREMIUM_FEATURES;
    }

    return loadManagedPremiumFeatures(
      storage,
      secretStore,
      syncState.preferences.mode,
      tokenGate,
    );
  } catch {
    return EMPTY_MANAGED_PREMIUM_FEATURES;
  }
}
