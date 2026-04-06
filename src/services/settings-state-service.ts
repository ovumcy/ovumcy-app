import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  clearLocalSyncSession,
  loadConnectedSyncCapabilities,
} from "../sync/sync-client-service";
import { loadSyncSetupState } from "../sync/sync-setup-service";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { loadLocalExportState } from "./export-service";
import { loadManagedBillingSnapshot } from "./managed-premium-features-service";
import {
  createLoadedSettingsState,
  type LoadedSettingsState,
  type SettingsManagedPremiumAccess,
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
  let managedPremiumAccess: SettingsManagedPremiumAccess = {
    planStatus: "unknown",
    doctorPDF: false,
    reminders: false,
  };
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
      const billingSnapshot = await loadManagedBillingSnapshot(
        secretStore,
        syncState.preferences.mode,
      );
      if (billingSnapshot) {
        managedPremiumAccess = {
          planStatus: billingSnapshot.hasActivePlan ? "active" : "inactive",
          doctorPDF: billingSnapshot.premiumFeatures.doctorPDF,
          reminders: billingSnapshot.premiumFeatures.reminders,
        };
      }
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
    managedPremiumAccess,
  );
}
