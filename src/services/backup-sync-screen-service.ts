import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  clearLocalSyncSession,
  connectSyncAccount,
  disconnectSyncAccount,
  recoverSyncAccess,
  runSyncRestore,
  runSyncUpload,
  type SyncConnectErrorCode,
  type SyncRecoverErrorCode,
  type SyncRunErrorCode,
} from "../sync/sync-client-service";
import type { SyncPreferencesRecord } from "../sync/sync-contract";
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
type SyncRecoverScreenErrorCode = SyncRecoverErrorCode;
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
      currentState.managedPremiumAccess,
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
      currentState.managedPremiumAccess,
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
      // recoveryCode is the plaintext account-level recovery code returned
      // exactly once at register. Undefined on login. Callers must surface it
      // immediately to the owner — the server never reissues the same code.
      recoveryCode?: string;
    }
  | {
      // The password verified but the account has TOTP enabled. No session
      // is held yet. The caller must drive the challenge UI, call
      // `completeTOTPChallenge`, and then finalise the connection with the
      // returned session token. Until that happens, no secrets are persisted.
      ok: true;
      totpChallengeRequired: true;
      challengeID: string;
      challengeExpiresAt: string;
      preferences: SyncPreferencesRecord;
      accountID: string;
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

  if ("totpChallengeRequired" in result) {
    return {
      ok: true,
      totpChallengeRequired: true,
      challengeID: result.challengeID,
      challengeExpiresAt: result.challengeExpiresAt,
      preferences: result.preferences,
      accountID: result.accountID,
    };
  }

  const success: {
    ok: true;
    state: LoadedSettingsState;
    connected: boolean;
    recoveryCode?: string;
  } = {
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
      result.capabilities,
      currentState.managedPremiumAccess,
    ),
  };
  if (result.recoveryCode) {
    success.recoveryCode = result.recoveryCode;
  }
  return success;
}

export async function recoverBackupSyncAccess(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  credentials: { login: string; password: string },
  recoveryPhrase: string,
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: SyncRecoverScreenErrorCode;
    }
> {
  const result = await recoverSyncAccess(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
    credentials,
    recoveryPhrase,
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
      true,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      result.capabilities,
      currentState.managedPremiumAccess,
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
      currentState.managedPremiumAccess,
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
      currentState.managedPremiumAccess,
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
      {
        planStatus: "unknown",
        doctorPDF: false,
        reminders: false,
      },
    ),
  };
}

export async function clearUnauthorizedBackupSyncSession(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
): Promise<LoadedSettingsState> {
  const nextPreferences = await clearLocalSyncSession(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
  );

  return createLoadedSettingsState(
    currentState.profile,
    nextPreferences,
    currentState.hasStoredSyncSecrets,
    false,
    currentState.symptomRecords,
    currentState.exportState,
    nextPreferences,
    null,
    {
      planStatus: "unknown",
      doctorPDF: false,
      reminders: false,
    },
  );
}
