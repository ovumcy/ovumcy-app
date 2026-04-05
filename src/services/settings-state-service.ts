import type { SyncSecretStore } from "../security/sync-secret-store";
import { createManagedCloudAPIClient } from "../sync/managed-cloud-api-client";
import { MANAGED_CLOUD_AUTH_BASE_URL } from "../sync/sync-contract";
import {
  clearLocalSyncSession,
  loadConnectedSyncCapabilities,
} from "../sync/sync-client-service";
import { loadSyncSetupState } from "../sync/sync-setup-service";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { loadLocalExportState } from "./export-service";
import {
  createLoadedSettingsState,
  type LoadedSettingsState,
} from "./settings-view-service";

export async function loadSettingsScreenState(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  now: Date,
): Promise<LoadedSettingsState> {
  const [profile, syncState, symptomRecords, exportResult] = await Promise.all([
    storage.readProfileRecord(),
    loadSyncSetupState(storage, secretStore),
    storage.listSymptomRecords(),
    loadLocalExportState(storage, now),
  ]);

  let syncCapabilities = null;
  let syncPreferences = syncState.preferences;
  let hasSyncSession = syncState.hasAuthSession;
  let managedDoctorPDFAllowed = false;
  if (
    syncState.hasAuthSession &&
    (syncState.preferences.setupStatus === "connected" ||
      syncState.preferences.mode === "managed")
  ) {
    const capabilitiesResult = await loadConnectedSyncCapabilities(
      secretStore,
      syncState.preferences,
    );
    if (capabilitiesResult.ok) {
      syncCapabilities = capabilitiesResult.capabilities;
      managedDoctorPDFAllowed = await loadManagedDoctorPDFAllowed(
        secretStore,
        syncState.preferences.mode,
      );
    } else if (capabilitiesResult.errorCode === "unauthorized") {
      syncPreferences = await clearLocalSyncSession(
        storage,
        secretStore,
        syncState.preferences,
      );
      hasSyncSession = false;
    }
  }

  return createLoadedSettingsState(
    profile,
    syncPreferences,
    syncState.hasStoredSecrets,
    hasSyncSession,
    symptomRecords,
    exportResult.state,
    syncPreferences,
    syncCapabilities,
    managedDoctorPDFAllowed,
  );
}

async function loadManagedDoctorPDFAllowed(
  secretStore: SyncSecretStore,
  syncMode: "managed" | "self_hosted",
): Promise<boolean> {
  if (syncMode !== "managed") {
    return false;
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.managedAuthSessionToken) {
    return false;
  }

  const billingResult = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).getBillingSnapshot(secrets.managedAuthSessionToken);

  return billingResult.ok ? billingResult.billing.doctorPDFAllowed : false;
}
