import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  clearLocalSyncSession,
  connectSyncAccount,
  disconnectSyncAccount,
  finalizeSyncSessionAfterTOTP,
  recoverSyncAccess,
  runSyncRestore,
  runSyncUpload,
  type SyncConnectErrorCode,
  type SyncRecoverErrorCode,
  type SyncRunErrorCode,
} from "../sync/sync-client-service";
import type { SyncPreferencesRecord } from "../sync/sync-contract";
import {
  completeTOTPChallenge,
  type CompleteTOTPChallengeErrorCode,
} from "../sync/sync-totp-service";
import {
  prepareSyncSetup,
  saveSyncPreferencesDraft,
  type PrepareSyncSetupErrorCode,
  type SaveSyncPreferencesDraftErrorCode,
} from "../sync/sync-setup-service";
import { loadLocalExportState } from "./export-service";
import { loadManagedBillingSnapshot } from "./managed-premium-features-service";
import {
  createLoadedSettingsState,
  type LoadedSettingsState,
  type SettingsManagedPremiumAccess,
} from "./settings-view-service";

type SyncConnectScreenErrorCode = SyncConnectErrorCode;
type SyncRecoverScreenErrorCode = SyncRecoverErrorCode;
type SyncRunScreenErrorCode = SyncRunErrorCode;

// After a managed connect (register/login/TOTP finalisation) the cloud plan
// status must be re-fetched from the billing snapshot. Reusing the pre-connect
// managedPremiumAccess leaves planStatus stuck at "unknown", which renders the
// cloud-plan step as "could not confirm" and keeps sync locked until the screen
// is reopened. For self-hosted mode loadManagedBillingSnapshot returns null and
// the prior access value is preserved.
async function resolveManagedPremiumAccessAfterConnect(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  fallback: SettingsManagedPremiumAccess,
): Promise<SettingsManagedPremiumAccess> {
  const billingSnapshot = await loadManagedBillingSnapshot(
    secretStore,
    preferences.mode,
  );
  if (!billingSnapshot) {
    return fallback;
  }
  return {
    planStatus: billingSnapshot.hasActivePlan ? "active" : "inactive",
    doctorPDF: billingSnapshot.premiumFeatures.doctorPDF,
    reminders: billingSnapshot.premiumFeatures.reminders,
    activeSubscription: billingSnapshot.activeSubscription,
  };
}

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

  const managedPremiumAccess = await resolveManagedPremiumAccessAfterConnect(
    secretStore,
    result.preferences,
    currentState.managedPremiumAccess,
  );

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
      managedPremiumAccess,
    ),
  };
  if (result.recoveryCode) {
    success.recoveryCode = result.recoveryCode;
  }
  return success;
}

/**
 * completeBackupSyncTOTPChallenge consumes the pending TOTP challenge issued
 * by `connectBackupSyncAccount` and finalises the sync setup with the freshly
 * issued session token. The challenge id travels via screen state only — it
 * is never persisted.
 *
 * The error surface keeps the TOTP-specific distinctions
 * (`totp_invalid_code` is retryable in place; `totp_challenge_invalid` means
 * the caller must restart from `connectBackupSyncAccount`) but collapses any
 * finalisation failure into the broader `SyncConnectScreenErrorCode` so the
 * UI can reuse the existing connect-error strings.
 */
export async function completeBackupSyncTOTPChallenge(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  preferences: SyncPreferencesRecord,
  input: { challengeID: string; code: string },
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
      connected: boolean;
    }
  | {
      ok: false;
      errorCode: CompleteTOTPChallengeErrorCode | SyncConnectScreenErrorCode;
    }
> {
  const challengeResult = await completeTOTPChallenge(preferences, input);
  if (!challengeResult.ok) {
    return { ok: false, errorCode: challengeResult.errorCode };
  }

  const finalizeResult = await finalizeSyncSessionAfterTOTP(
    storage,
    secretStore,
    preferences,
    { sessionToken: challengeResult.auth.sessionToken },
  );
  if (!finalizeResult.ok) {
    return { ok: false, errorCode: finalizeResult.errorCode };
  }

  const managedPremiumAccess = await resolveManagedPremiumAccessAfterConnect(
    secretStore,
    finalizeResult.preferences,
    currentState.managedPremiumAccess,
  );

  return {
    ok: true,
    connected: true,
    state: createLoadedSettingsState(
      currentState.profile,
      finalizeResult.preferences,
      currentState.hasStoredSyncSecrets,
      true,
      currentState.symptomRecords,
      currentState.exportState,
      finalizeResult.preferences,
      finalizeResult.capabilities,
      managedPremiumAccess,
    ),
  };
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
        activeSubscription: null,
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
      activeSubscription: null,
    },
  );
}
