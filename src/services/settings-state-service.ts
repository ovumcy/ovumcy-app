import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  clearLocalSyncSession,
  loadConnectedSyncCapabilities,
} from "../sync/sync-client-service";
import type { SyncPreferencesRecord } from "../sync/sync-contract";
import { loadSyncSetupState } from "../sync/sync-setup-service";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { buildEntitlementTokenGate } from "./entitlement-token-gate-service";
import { loadLocalExportState } from "./export-service";
import { loadManagedBillingSnapshotWithSource } from "./managed-premium-features-service";
import {
  createEmptySettingsManagedPremiumAccess,
  createLoadedSettingsState,
  mapBillingSnapshotToManagedPremiumAccess,
  type LoadedSettingsState,
  type SettingsManagedPremiumAccess,
} from "./settings-view-service";

async function loadSettingsManagedPremiumAccess(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  mode: SyncPreferencesRecord["mode"],
): Promise<SettingsManagedPremiumAccess> {
  // The screen's `now` is fixed at mount; token expiry and the offline-grace
  // window are decided on the live clock instead.
  const billingNow = new Date();
  const result = await loadManagedBillingSnapshotWithSource(
    storage,
    secretStore,
    mode,
    // Doctor PDF is token-gated: a verified entitlement token decides
    // `doctorPDF`; absent/invalid, the billing snapshot boolean stands.
    await buildEntitlementTokenGate(secretStore, mode, {
      nowSeconds: Math.floor(billingNow.getTime() / 1000),
    }),
    billingNow,
  );
  if (!result) {
    return createEmptySettingsManagedPremiumAccess();
  }
  if (result.source === "live") {
    return mapBillingSnapshotToManagedPremiumAccess(result.billing);
  }
  // Offline grace: the doctor PDF follows the same cached premium as every
  // other premium surface, while the plan status that gates sync
  // upload/restore stays "unknown" — only live billing decides a
  // server-checked action.
  return {
    ...createEmptySettingsManagedPremiumAccess(),
    doctorPDF: result.billing.premiumFeatures.doctorPDF,
  };
}

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
  let managedPremiumAccess: SettingsManagedPremiumAccess =
    createEmptySettingsManagedPremiumAccess();
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
    }
    if (capabilitiesResult.ok || capabilitiesResult.errorCode !== "unauthorized") {
      managedPremiumAccess = await loadSettingsManagedPremiumAccess(
        storage,
        secretStore,
        syncState.preferences.mode,
      );
    } else {
      // A sign-out that cannot finish keeps the session; the screen still
      // loads with whatever the failed sign-out left, and the next load
      // retries it.
      try {
        syncPreferences = await clearLocalSyncSession(
          storage,
          secretStore,
          syncState.preferences,
        );
        hasSyncSession = false;
      } catch {
        const leftState = await loadSyncSetupState(storage, secretStore).catch(
          () => null,
        );
        if (leftState) {
          syncPreferences = leftState.preferences;
          hasSyncSession = leftState.hasAuthSession;
        }
      }
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
