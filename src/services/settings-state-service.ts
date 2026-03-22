import type { SyncSecretStore } from "../security/sync-secret-store";
import { loadManagedSyncCapabilities } from "../sync/sync-client-service";
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
  if (
    syncState.hasAuthSession &&
    syncState.preferences.mode === "managed" &&
    syncState.preferences.setupStatus === "connected"
  ) {
    const capabilitiesResult = await loadManagedSyncCapabilities(
      secretStore,
      syncState.preferences,
    );
    if (capabilitiesResult.ok) {
      syncCapabilities = capabilitiesResult.capabilities;
    }
  }

  return createLoadedSettingsState(
    profile,
    syncState.preferences,
    syncState.hasStoredSecrets,
    syncState.hasAuthSession,
    symptomRecords,
    exportResult.state,
    syncState.preferences,
    syncCapabilities,
  );
}
