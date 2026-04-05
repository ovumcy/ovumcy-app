import type { LocalAppStorage } from "../storage/local/storage-contract";
import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudPremiumFeatures,
} from "../sync/managed-cloud-api-client";
import { MANAGED_CLOUD_AUTH_BASE_URL, type SyncMode } from "../sync/sync-contract";
import { loadSyncSetupState } from "../sync/sync-setup-service";

export const EMPTY_MANAGED_PREMIUM_FEATURES: ManagedCloudPremiumFeatures = {
  advancedFertility: false,
  advancedInsights: false,
  doctorPDF: false,
  extendedReports: false,
  partnerAccess: false,
  reminders: false,
};

export async function loadManagedPremiumFeatures(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
): Promise<ManagedCloudPremiumFeatures> {
  if (syncMode !== "managed") {
    return EMPTY_MANAGED_PREMIUM_FEATURES;
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.managedAuthSessionToken) {
    return EMPTY_MANAGED_PREMIUM_FEATURES;
  }

  const billingResult = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).getBillingSnapshot(secrets.managedAuthSessionToken);

  return billingResult.ok
    ? billingResult.billing.premiumFeatures
    : EMPTY_MANAGED_PREMIUM_FEATURES;
}

export async function loadManagedPremiumFeaturesForCurrentSession(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
): Promise<ManagedCloudPremiumFeatures> {
  try {
    const syncState = await loadSyncSetupState(storage, secretStore);
    if (!syncState.hasAuthSession || syncState.preferences.mode !== "managed") {
      return EMPTY_MANAGED_PREMIUM_FEATURES;
    }

    return loadManagedPremiumFeatures(secretStore, syncState.preferences.mode);
  } catch {
    return EMPTY_MANAGED_PREMIUM_FEATURES;
  }
}
