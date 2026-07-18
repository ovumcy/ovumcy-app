import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  clearLocalSyncSession,
  connectSyncAccount,
  disconnectSyncAccount,
  finalizeSyncSessionAfterTOTP,
  persistGuestPartnerSession,
  recoverSyncAccess,
  runSyncRestore,
  runSyncUpload,
  upgradeGuestPartnerAccount,
  type SyncConnectErrorCode,
  type SyncRecoverErrorCode,
  type SyncRunErrorCode,
  type UpgradeGuestPartnerAccountErrorCode,
  type UploadOverBackupGuard,
} from "../sync/sync-client-service";
import {
  MANAGED_CLOUD_AUTH_BASE_URL,
  type SyncPreferencesRecord,
} from "../sync/sync-contract";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIErrorCode,
  type ManagedCloudPartnerAccessGrant,
} from "../sync/managed-cloud-api-client";
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
import { acceptManagedPartnerInviteAsGuest } from "./managed-partner-access-service";
import {
  loadManagedBillingSnapshot,
  persistManagedBillingSnapshotCache,
} from "./managed-premium-features-service";
import {
  createEmptySettingsManagedPremiumAccess,
  createLoadedSettingsState,
  mapBillingSnapshotToManagedPremiumAccess,
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
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  fallback: SettingsManagedPremiumAccess,
): Promise<SettingsManagedPremiumAccess> {
  const billingSnapshot = await loadManagedBillingSnapshot(
    storage,
    secretStore,
    preferences.mode,
  );
  if (!billingSnapshot) {
    return fallback;
  }
  return mapBillingSnapshotToManagedPremiumAccess(billingSnapshot);
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
    storage,
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
 * acceptBackupSyncPartnerInviteAsGuest redeems a pending partner invite
 * through the unauthenticated guest endpoint and, on success, persists the
 * returned session exactly the way `connectBackupSyncAccount` persists a
 * normal managed register/login (`persistGuestPartnerSession` mirrors the
 * managed branch of `connectSyncAccount`) and refreshes the managed-plan
 * status the same way. The caller (the partner-access screen hook) is
 * responsible for the rest of the shared post-accept path — partner-share key
 * derivation/rotation and pending-invite-buffer clearing — via the SAME
 * `storeAcceptedManagedPartnerGrantKey` the logged-in accept flow already
 * uses; this function stays scoped to "redeem the invite + persist the
 * session" so that shared path is never duplicated.
 */
export async function acceptBackupSyncPartnerInviteAsGuest(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  inviteToken: string,
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
      grant: ManagedCloudPartnerAccessGrant;
    }
  | {
      ok: false;
      errorCode: ManagedCloudAPIErrorCode;
    }
> {
  const acceptResult = await acceptManagedPartnerInviteAsGuest(inviteToken);
  if (!acceptResult.ok) {
    return acceptResult;
  }

  const persisted = await persistGuestPartnerSession(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
    {
      sessionToken: acceptResult.value.sessionToken,
      sessionExpiresAt: acceptResult.value.sessionExpiresAt,
    },
    now,
  );

  const managedPremiumAccess = await resolveManagedPremiumAccessAfterConnect(
    storage,
    secretStore,
    persisted.preferences,
    currentState.managedPremiumAccess,
  );

  return {
    ok: true,
    grant: acceptResult.value.grant,
    state: createLoadedSettingsState(
      currentState.profile,
      persisted.preferences,
      true,
      true,
      currentState.symptomRecords,
      currentState.exportState,
      persisted.preferences,
      persisted.capabilities,
      managedPremiumAccess,
    ),
  };
}

/**
 * upgradeBackupSyncGuestAccount wraps `upgradeGuestPartnerAccount` for the
 * screen: it always rebuilds `state` from the returned preferences, whether
 * the call succeeded or failed, because a failure can still legitimately
 * change local state (the `account_not_guest` race clears the local guest
 * marker exactly like success does — see `upgradeGuestPartnerAccount`). This
 * lets the caller apply `result.state` unconditionally and the "Keep your
 * access" affordance disappears the instant either outcome lands, without a
 * special case for that one error code.
 */
export async function upgradeBackupSyncGuestAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  input: { email: string; password: string },
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
      email: string;
      recoveryCode: string;
    }
  | {
      ok: false;
      errorCode: UpgradeGuestPartnerAccountErrorCode;
      state: LoadedSettingsState;
    }
> {
  const result = await upgradeGuestPartnerAccount(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
    input,
  );

  const nextState = createLoadedSettingsState(
    currentState.profile,
    result.preferences,
    currentState.hasStoredSyncSecrets,
    currentState.hasSyncSession,
    currentState.symptomRecords,
    currentState.exportState,
    result.preferences,
    currentState.syncCapabilities,
    currentState.managedPremiumAccess,
  );

  if (!result.ok) {
    return { ok: false, errorCode: result.errorCode, state: nextState };
  }

  return {
    ok: true,
    state: nextState,
    email: result.email,
    recoveryCode: result.recoveryCode,
  };
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
    storage,
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
  // The controller supplies the destructive-confirm bridge; the decision of
  // WHEN to ask stays in runSyncUpload's policy (fresh install over an
  // existing remote backup). Absent guard = fail closed (never overwrite).
  uploadOverBackupGuard?: UploadOverBackupGuard,
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
    undefined,
    undefined,
    uploadOverBackupGuard,
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
      createEmptySettingsManagedPremiumAccess(),
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
    createEmptySettingsManagedPremiumAccess(),
  );
}

export type BackupSyncRenewalAction = "cancel_at_period_end" | "resume";

export type UpdateBackupSyncRenewalErrorCode =
  | "not_connected"
  | "unauthorized"
  | "billing_management_unavailable"
  | "billing_subscription_conflict"
  | "billing_provider_unavailable"
  | "network_failed"
  | "generic";

function mapRenewalAPIError(
  errorCode: ManagedCloudAPIErrorCode,
): UpdateBackupSyncRenewalErrorCode {
  switch (errorCode) {
    case "unauthorized":
    case "billing_management_unavailable":
    case "billing_subscription_conflict":
    case "billing_provider_unavailable":
    case "network_failed":
      return errorCode;
    default:
      return "generic";
  }
}

/**
 * updateBackupSyncRenewal drives PUT /account/billing/renewal for the two
 * flag-gated affordances (cancel at period end / resume renewal). The server
 * both authorises the action and returns the refreshed billing snapshot,
 * which becomes the new screen state and refreshes the offline-grace cache.
 * Confirmation UX (confirm-before-cancel) is owned by the controller; this
 * function assumes the caller already gated the destructive path.
 */
export async function updateBackupSyncRenewal(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  action: BackupSyncRenewalAction,
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: UpdateBackupSyncRenewalErrorCode;
    }
> {
  if (currentState.savedSyncPreferences.mode !== "managed") {
    return { ok: false, errorCode: "not_connected" };
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.managedAuthSessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  const renewalResult = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).updateBillingRenewal(secrets.managedAuthSessionToken, {
    cancelAtPeriodEnd: action === "cancel_at_period_end",
  });
  if (!renewalResult.ok) {
    return { ok: false, errorCode: mapRenewalAPIError(renewalResult.errorCode) };
  }

  // The response is a refreshed billing snapshot: treat it like any other
  // successful billing fetch for the offline-grace cache.
  await persistManagedBillingSnapshotCache(storage, renewalResult.billing, now);

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords,
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
      mapBillingSnapshotToManagedPremiumAccess(renewalResult.billing),
    ),
  };
}
