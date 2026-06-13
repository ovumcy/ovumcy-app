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

export const EMPTY_MANAGED_BILLING_SNAPSHOT: ManagedCloudBillingSnapshot = {
  hasActivePlan: false,
  premiumFeatures: EMPTY_MANAGED_PREMIUM_FEATURES,
  activeSubscription: null,
  billingManagement: {
    canManageRenewal: false,
    canCancelAtPeriodEnd: false,
    canResumeRenewal: false,
  },
};

export async function loadManagedBillingSnapshot(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  // Optional signed-token gate. Absent -> pure snapshot behaviour (today).
  tokenGate?: EntitlementTokenGate,
): Promise<ManagedCloudBillingSnapshot | null> {
  if (syncMode !== "managed") {
    return null;
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.managedAuthSessionToken) {
    return null;
  }

  const billingResult = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).getBillingSnapshot(secrets.managedAuthSessionToken);

  if (!billingResult.ok) {
    return null;
  }

  // Overlay verified-token entitlements onto the two purely-local features.
  // When no gate is supplied or no valid token is present, premiumFeatures is
  // returned unchanged.
  const premiumFeatures = await applyEntitlementTokenOverlay(
    billingResult.billing.premiumFeatures,
    tokenGate,
    secrets.managedAuthSessionToken,
  );
  if (premiumFeatures === billingResult.billing.premiumFeatures) {
    return billingResult.billing;
  }
  return { ...billingResult.billing, premiumFeatures };
}

export async function loadManagedPremiumFeatures(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  tokenGate?: EntitlementTokenGate,
): Promise<ManagedCloudPremiumFeatures> {
  const billingSnapshot = await loadManagedBillingSnapshot(
    secretStore,
    syncMode,
    tokenGate,
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
      secretStore,
      syncState.preferences.mode,
      tokenGate,
    );
  } catch {
    return EMPTY_MANAGED_PREMIUM_FEATURES;
  }
}
