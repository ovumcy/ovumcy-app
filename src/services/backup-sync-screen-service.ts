import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  connectSyncAccount,
  disconnectSyncAccount,
  runSyncRestore,
  runSyncUpload,
  type SyncConnectErrorCode,
  type SyncRunErrorCode,
} from "../sync/sync-client-service";
import {
  prepareSyncSetup,
  saveSyncPreferencesDraft,
  type PrepareSyncSetupErrorCode,
  type SaveSyncPreferencesDraftErrorCode,
} from "../sync/sync-setup-service";
import { loadLocalExportState } from "./export-service";
import {
  createLoadedSettingsState,
  type LoadedSettingsState,
} from "./settings-view-service";

type SyncConnectScreenErrorCode = SyncConnectErrorCode;
type SyncRunScreenErrorCode = SyncRunErrorCode;

export async function prepareBackupSyncSetup(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
      recoveryPhrase: string;
      regenerated: boolean;
    }
  | {
      ok: false;
      errorCode: PrepareSyncSetupErrorCode;
    }
> {
  const regenerated = currentState.hasStoredSyncSecrets;
  const result = await prepareSyncSetup(
    storage,
    secretStore,
    currentState.syncPreferences,
    now,
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      result.preferences,
      true,
      currentState.hasSyncSession,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      null,
    ),
    recoveryPhrase: result.recoveryPhrase,
    regenerated,
  };
}

export async function saveBackupSyncDraft(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: SaveSyncPreferencesDraftErrorCode;
    }
> {
  const result = await saveSyncPreferencesDraft(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
    currentState.syncPreferences,
    currentState.hasStoredSyncSecrets,
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      result.preferences,
      result.hasStoredSecrets,
      currentState.hasSyncSession && result.hasStoredSecrets,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      null,
    ),
  };
}

export async function connectBackupSyncAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  credentials: { login: string; password: string },
  mode: "register" | "login",
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
      connected: boolean;
    }
  | {
      ok: false;
      errorCode: SyncConnectScreenErrorCode;
    }
> {
  const result = await connectSyncAccount(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
    credentials,
    mode,
    now,
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    connected: true,
    state: createLoadedSettingsState(
      currentState.profile,
      result.preferences,
      currentState.hasStoredSyncSecrets,
      true,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      result.preferences.mode === "managed" ? result.capabilities : null,
    ),
  };
}

export async function uploadBackupSyncSnapshot(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: SyncRunScreenErrorCode;
    }
> {
  const result = await runSyncUpload(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
    now,
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      result.preferences,
      currentState.hasStoredSyncSecrets,
      true,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function restoreBackupSyncSnapshot(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: SyncRunScreenErrorCode;
    }
> {
  const result = await runSyncRestore(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
  );
  if (!result.ok) {
    return result;
  }

  const profile = await storage.readProfileRecord();
  const symptomRecords = await storage.listSymptomRecords();
  const exportResult = await loadLocalExportState(storage, now);

  return {
    ok: true,
    state: createLoadedSettingsState(
      profile,
      result.preferences,
      currentState.hasStoredSyncSecrets,
      true,
      symptomRecords,
      exportResult.state,
      result.preferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function disconnectBackupSyncAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
): Promise<{
  ok: true;
  state: LoadedSettingsState;
}> {
  const result = await disconnectSyncAccount(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
  );

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      result.preferences,
      currentState.hasStoredSyncSecrets,
      false,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      null,
    ),
  };
}
