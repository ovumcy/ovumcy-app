import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudPremiumFeatures,
} from "../sync/managed-cloud-api-client";
import { MANAGED_CLOUD_AUTH_BASE_URL, type SyncMode } from "../sync/sync-contract";

export const EMPTY_MANAGED_PREMIUM_FEATURES: ManagedCloudPremiumFeatures = {
  advancedFertility: false,
  advancedInsights: false,
  doctorPDF: false,
  extendedReports: false,
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
