import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { fromByteArray, toByteArray } from "base64-js";

import {
  buildSyncPayloadAad,
  createRecoveredSyncSecretsRecord,
  createSyncSecretsRecord,
  decryptSyncSnapshotPayload,
  encryptSyncPayload,
  isValidRecoveryPhrase,
  isValidSyncGeneration,
} from "../security/sync-crypto";
import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createDefaultManagedBillingCacheRecord,
  type LocalAppStorage,
} from "../storage/local/storage-contract";
import {
  normalizeSyncEndpoint,
  type NormalizeSyncEndpointErrorCode,
} from "./sync-endpoint-policy";
import {
  applyManagedAuthResultToSecrets,
  clearManagedSessionFromSecrets,
  endManagedSessionRefresh,
  settleInFlightManagedRefresh,
} from "./managed-session-refresh-service";
import {
  callWithManagedSession,
  type ManagedSessionCallFailure,
} from "./managed-session-call";
import { clearPendingManagedRecoveryRotation } from "./managed-recovery-rotation-service";
import { isPasswordTooLong, isPasswordTooShort } from "./password-policy";
import {
  isSyncDeviceLabelLengthValid,
  isSyncLoginLengthValid,
} from "./sync-input-limits";
import type {
  EncryptedSyncEnvelope,
  SyncBlobRecord,
  SyncCapabilityDocument,
  SyncDeviceRecord,
  SyncPreferencesRecord,
  SyncSecretsRecord,
  SyncSetupStatus,
} from "./sync-contract";
import {
  MANAGED_CLOUD_AUTH_BASE_URL,
  MANAGED_SYNC_BASE_URL,
  createDefaultSyncPreferencesRecord,
} from "./sync-contract";
import type { LocalReminderScheduler } from "../services/local-reminder-scheduler-contract";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIClient,
  type ManagedCloudAPIErrorCode,
} from "./managed-cloud-api-client";
import {
  createSyncAPIClient,
  type SyncAPIClient,
  type SyncAPIErrorCode,
  type SyncAPIFailure,
  type SyncRecoveryKeyStepUp,
} from "./sync-api-client";
import {
  buildSyncSnapshot,
  decodeSyncSnapshot,
  encodeSyncSnapshot,
  restoreSyncSnapshot,
  SYNC_SNAPSHOT_SCHEMA_VERSION,
} from "./sync-snapshot-service";

export type SyncConnectErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "sync_not_prepared"
  | "login_required"
  | "password_required"
  | "password_too_short"
  | "password_too_long"
  | "login_invalid_length"
  | "device_label_invalid_length"
  | "sync_not_allowed"
  | "invalid_registration_input"
  | "registration_failed"
  | "registration_disabled"
  | "invalid_credentials"
  | "unauthorized"
  | "too_many_devices"
  | "rate_limited"
  | "network_failed"
  | "generic";

export type SyncRecoverErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "device_label_required"
  | "device_label_invalid_length"
  | "recovery_phrase_required"
  | "invalid_recovery_phrase"
  | "recovery_not_available"
  | "recovery_package_not_found"
  | "login_required"
  | "password_required"
  | "sync_not_allowed"
  | "invalid_credentials"
  | "unauthorized"
  | "too_many_devices"
  | "rate_limited"
  | "network_failed"
  | "generic";

export type SyncRunErrorCode =
  | "sync_not_prepared"
  | "not_connected"
  | "sync_not_allowed"
  | "unauthorized"
  | "blob_not_found"
  | "invalid_blob"
  | "stale_generation"
  // The server holds a backup this device has not seen (another device
  // uploaded since); the upload refused to overwrite it. Restore first.
  | "remote_backup_changed"
  | "invalid_payload"
  | "upload_over_backup_declined"
  | "restore_older_backup_declined"
  // The upload would replace the server's recovery-key package, which a
  // community server allows only after the account password (and a current
  // TOTP code when 2FA is on). The caller prompts and retries with the step-up.
  | "recovery_key_step_up_required"
  | "recovery_key_code_required"
  | "invalid_current_password"
  | "totp_invalid_code"
  | "totp_replayed"
  | "recovery_key_step_up_rate_limited"
  // The managed account's recovery phrase was rotated (on another device, or
  // by an unconfirmed rotation here) and this device holds the old package.
  | "managed_recovery_key_overwrite"
  // Self-hosted: this device has uploaded under its key before, and the
  // server now stores a different package, so another device replaced it.
  | "recovery_key_changed_elsewhere"
  // The encrypted snapshot exceeds the server's advertised maxBlobBytes.
  | "backup_too_large"
  | "rate_limited"
  | "server_busy"
  | "network_failed"
  | "generic";

export type SyncDeviceManagementErrorCode =
  | "sync_not_prepared"
  | "not_connected"
  | "sync_not_allowed"
  | "unauthorized"
  | "device_not_found"
  | "rate_limited"
  | "network_failed"
  | "generic";

// Seconds the server asked the caller to wait (429/503 on a blob call).
export type SyncRetryAfter = { retryAfterSeconds?: number };

function withRetryAfter<T extends { ok: false }>(
  failure: T,
  source: SyncAPIFailure | { ok: false },
): T & SyncRetryAfter {
  return "retryAfterSeconds" in source && source.retryAfterSeconds !== undefined
    ? { ...failure, retryAfterSeconds: source.retryAfterSeconds }
    : failure;
}

/**
 * Data-loss guard policy for `runSyncUpload`: a device that has never
 * uploaded or restored (lastRemoteGeneration === null) while the server
 * already holds a backup blob is about to overwrite that backup with a
 * possibly near-empty local database (fresh install → connect → upload
 * before restore). The wall-clock generation scheme does not protect here
 * because a fresh device's clock exceeds the stored generation.
 */
export function requiresUploadOverBackupConfirmation(input: {
  lastRemoteGeneration: number | null;
  remoteBackupExists: boolean;
}): boolean {
  return input.lastRemoteGeneration === null && input.remoteBackupExists;
}

export type UploadOverBackupGuard = {
  // Invoked only when the policy above fires. Resolving false (the safe
  // dismissal answer) aborts the upload with "upload_over_backup_declined".
  confirmUploadOverExistingBackup: () => Promise<boolean>;
};

/**
 * Rollback guard policy for `runSyncRestore`: `lastRemoteGeneration` is the
 * device's floor — the highest generation it has uploaded or restored. A blob
 * whose sealed generation is below it, or a legacy blob that seals none, may
 * be an older backup the server is replaying. A device without a floor has
 * nothing to compare against.
 */
function requiresRestoreOlderBackupConfirmation(input: {
  rollbackFloor: number | null;
  sealedGeneration: number | null;
}): boolean {
  if (input.rollbackFloor === null) {
    return false;
  }
  return input.sealedGeneration === null || input.sealedGeneration < input.rollbackFloor;
}

export type RestoreOlderBackupGuard = {
  // Invoked only when the policy above fires. Resolving false (the safe
  // dismissal answer) aborts the restore with "restore_older_backup_declined".
  confirmRestoreOlderBackup: () => Promise<boolean>;
};

type SyncAPIClientFactory = (baseURL: string) => SyncAPIClient;
type ManagedCloudAPIClientFactory = (baseURL: string) => ManagedCloudAPIClient;

export type ConnectSyncAccountResult =
  | {
      ok: true;
      capabilities: SyncCapabilityDocument;
      preferences: SyncPreferencesRecord;
      // recoveryCode is the plaintext account-level recovery code returned by
      // the server exactly once at register. It is undefined on login (the
      // server never reissues an existing recovery code). The caller is
      // expected to surface it once to the owner and then forget it.
      recoveryCode?: string;
    }
  | {
      // totpChallengeRequired indicates the password verified but the account
      // has TOTP enabled. The connection is NOT established yet. The caller
      // owns the challenge id (memory-only) and must drive the user through
      // `completeTOTPChallenge` then call `finalizeSyncTOTPLogin` with the
      // resulting session token to finish setup.
      ok: true;
      totpChallengeRequired: true;
      challengeID: string;
      challengeExpiresAt: string;
      preferences: SyncPreferencesRecord;
      accountID: string;
    }
  | {
      ok: false;
      errorCode: SyncConnectErrorCode;
      // Set when register created the account but a later step failed: the
      // only copy of the recovery code, to be shown like a successful one.
      recoveryCode?: string;
    };

export async function connectSyncAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  credentials: { login: string; password: string },
  mode: "register" | "login",
  now: Date,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<ConnectSyncAccountResult> {
  const login = credentials.login.trim();
  if (login.length === 0) {
    return { ok: false, errorCode: "login_required" };
  }
  if (credentials.password.length === 0) {
    return { ok: false, errorCode: "password_required" };
  }
  // Register-only pre-validation: a new account password below the shared
  // server minimum is rejected here so the owner gets a specific "too short"
  // message instead of the ambiguous invalid_registration_input the server
  // folds it into. Login is deliberately exempt — a pre-existing account could
  // hold a legacy short password, and authenticating it is the server's call.
  if (mode === "register" && isPasswordTooShort(credentials.password)) {
    return { ok: false, errorCode: "password_too_short" };
  }
  if (mode === "register" && isPasswordTooLong(credentials.password)) {
    return { ok: false, errorCode: "password_too_long" };
  }
  // The managed cloud registers an email address and validates it itself.
  if (
    mode === "register" &&
    preferences.mode === "self_hosted" &&
    !isSyncLoginLengthValid(login)
  ) {
    return { ok: false, errorCode: "login_invalid_length" };
  }

  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return normalizedEndpoint;
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }

  if (preferences.mode === "managed") {
    const managedClient = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const authResult =
      mode === "register"
        ? await managedClient.register({
            email: login,
            password: credentials.password,
          })
        : await managedClient.login({
            email: login,
            password: credentials.password,
          });
    if (!authResult.ok) {
      return {
        ok: false,
        errorCode: mapManagedConnectAPIError(authResult.errorCode),
      };
    }

    // Login may legitimately succeed at the password layer and then defer the
    // session until the TOTP second factor is satisfied. The server returns an
    // empty session_token + a totp_challenge handoff. We must NOT persist the
    // empty token; the caller drives the challenge UI and finalises later.
    if (authResult.auth.totpChallenge) {
      return {
        ok: true,
        totpChallengeRequired: true,
        challengeID: authResult.auth.totpChallenge.challengeID,
        challengeExpiresAt: authResult.auth.totpChallenge.challengeExpiresAt,
        accountID: authResult.auth.accountID,
        preferences,
      };
    }

    await secretStore.writeSyncSecrets(
      applyManagedAuthResultToSecrets(
        { ...secrets, authSessionToken: null },
        authResult.auth,
      ),
    );

    const nextPreferences: SyncPreferencesRecord = {
      ...preferences,
      normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
      setupStatus: "connected",
      // A real register/login/TOTP-finalized session is never a guest —
      // clear any stale marker left by an earlier guest-partner session on
      // this device (see SyncPreferencesRecord.guestSessionExpiresAt).
      guestSessionExpiresAt: null,
      guestSessionRenewable: false,
    };
    await storage.writeSyncPreferencesRecord(nextPreferences);

    // New managed session (possibly a different account): drop billing-cache
    // state derived under the previous session. The post-connect billing
    // refresh repopulates it.
    await storage.writeManagedBillingCacheRecord(
      createDefaultManagedBillingCacheRecord(),
    );

    const success: {
      ok: true;
      capabilities: SyncCapabilityDocument;
      preferences: SyncPreferencesRecord;
      recoveryCode?: string;
    } = {
      ok: true,
      capabilities: buildManagedCapabilitiesDocument(
        authResult.auth.entitlement.syncAllowed,
      ),
      preferences: nextPreferences,
    };
    if (authResult.auth.recoveryCode) {
      success.recoveryCode = authResult.auth.recoveryCode;
    }
    return success;
  }

  const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
  const authResult =
    mode === "register"
      ? await client.register({ login, password: credentials.password })
      : await client.login({ login, password: credentials.password });
  if (!authResult.ok) {
    return {
      ok: false,
      errorCode: mapConnectAPIError(authResult.errorCode),
    };
  }

  // See managed branch above for the rationale: TOTP-enabled login defers the
  // real session until the caller completes the challenge, so we bail out
  // before any device/blob/recovery-key handshake runs against an empty token.
  if (authResult.auth.totpChallenge) {
    return {
      ok: true,
      totpChallengeRequired: true,
      challengeID: authResult.auth.totpChallenge.challengeID,
      challengeExpiresAt: authResult.auth.totpChallenge.challengeExpiresAt,
      accountID: authResult.auth.accountID,
      preferences,
    };
  }

  // The account exists from here on and the server never reissues its
  // recovery code, so a later failure still hands the code to the caller.
  const issuedRecoveryCode = authResult.auth.recoveryCode;
  const failAfterRegister = (errorCode: SyncConnectErrorCode): ConnectSyncAccountResult =>
    issuedRecoveryCode
      ? { ok: false, errorCode, recoveryCode: issuedRecoveryCode }
      : { ok: false, errorCode };

  const capabilitiesResult = await client.getCapabilities(authResult.auth.sessionToken);
  if (!capabilitiesResult.ok) {
    return failAfterRegister(mapConnectAPIError(capabilitiesResult.errorCode));
  }

  const attachDeviceResult = await client.attachDevice(authResult.auth.sessionToken, {
    deviceID: secrets.device.deviceID,
    deviceLabel: secrets.device.deviceLabel,
  });
  if (!attachDeviceResult.ok) {
    return failAfterRegister(mapConnectAPIError(attachDeviceResult.errorCode));
  }

  // Only a fresh account stores its package here. On login the stored package
  // may guard an existing backup, so the upload replaces it after the
  // overwrite confirm and the step-up prompt.
  if (mode === "register") {
    const syncedRecoveryKey = await syncRecoveryKeyIfSupported(
      client,
      authResult.auth.sessionToken,
      capabilitiesResult.capabilities,
      secrets.wrappedKey,
      { currentPassword: credentials.password },
    );
    // A step-up refusal does not fail the connect: the next upload prompts.
    if (!syncedRecoveryKey.ok && !isRecoveryKeyStepUpCode(syncedRecoveryKey.errorCode)) {
      return failAfterRegister(mapConnectAPIError(syncedRecoveryKey.errorCode));
    }
  }

  await secretStore.writeSyncSecrets({
    ...secrets,
    authSessionToken: authResult.auth.sessionToken,
  });

  const nextPreferences: SyncPreferencesRecord = {
    ...preferences,
    normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
    setupStatus: "connected",
    // Self-hosted community sync has no guest-partner concept; clear any
    // stale marker carried over from a prior managed guest session.
    guestSessionExpiresAt: null,
    guestSessionRenewable: false,
  };
  await storage.writeSyncPreferencesRecord(nextPreferences);

  const success: {
    ok: true;
    capabilities: SyncCapabilityDocument;
    preferences: SyncPreferencesRecord;
    recoveryCode?: string;
  } = {
    ok: true,
    capabilities: capabilitiesResult.capabilities,
    preferences: nextPreferences,
  };
  if (authResult.auth.recoveryCode) {
    success.recoveryCode = authResult.auth.recoveryCode;
  }
  return success;
}

/**
 * finalizeSyncSessionAfterTOTP completes a sync setup whose initial login was
 * deferred by a TOTP challenge. After the UI runs
 * `completeTOTPChallenge` (from sync-totp-service) and obtains a real
 * session token, this helper takes over the rest of the connect handshake:
 *
 * - for managed: pulls the latest session/entitlement, persists the managed
 *   session token, and writes connected preferences;
 * - for self-hosted: getCapabilities + attachDevice + recovery-key sync,
 *   then persists the session token and connected preferences.
 *
 * The function deliberately mirrors the post-auth tail of `connectSyncAccount`
 * so both entry points (password-only login and post-TOTP login) leave the
 * local state in the same shape.
 */
export async function finalizeSyncSessionAfterTOTP(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  // The refresh fields are optional so a caller that only has the session
  // token still compiles; a managed login that received a refresh token passes
  // it through here, or the finalized session would silently lose the ability
  // to renew itself and expire in hours.
  input: {
    sessionToken: string;
    sessionExpiresAt?: string;
    refreshToken?: string;
    refreshTokenExpiresAt?: string;
  },
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | {
      ok: true;
      capabilities: SyncCapabilityDocument;
      preferences: SyncPreferencesRecord;
    }
  | {
      ok: false;
      errorCode: SyncConnectErrorCode;
    }
> {
  if (input.sessionToken.length === 0) {
    return { ok: false, errorCode: "unauthorized" };
  }

  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return normalizedEndpoint;
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }

  if (preferences.mode === "managed") {
    const managedClient = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    // The completeTOTPChallenge response collapsed entitlement to satisfy the
    // unified SyncAuthResult shape. Re-read the session here so we persist the
    // managed capabilities document with the right syncAllowed flag.
    const sessionResult = await managedClient.getSession(input.sessionToken);
    if (!sessionResult.ok) {
      return {
        ok: false,
        errorCode: mapManagedConnectAPIError(sessionResult.errorCode),
      };
    }

    await secretStore.writeSyncSecrets({
      ...secrets,
      authSessionToken: null,
      managedAuthSessionToken: input.sessionToken,
      managedAuthSessionExpiresAt: input.sessionExpiresAt ?? null,
      managedRefreshToken: input.refreshToken ?? null,
      managedRefreshTokenExpiresAt: input.refreshTokenExpiresAt ?? null,
    });

    const nextPreferences: SyncPreferencesRecord = {
      ...preferences,
      normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
      setupStatus: "connected",
      // A real register/login/TOTP-finalized session is never a guest —
      // clear any stale marker left by an earlier guest-partner session on
      // this device (see SyncPreferencesRecord.guestSessionExpiresAt).
      guestSessionExpiresAt: null,
      guestSessionRenewable: false,
    };
    await storage.writeSyncPreferencesRecord(nextPreferences);

    // Same session-boundary purge as the password-only connect path.
    await storage.writeManagedBillingCacheRecord(
      createDefaultManagedBillingCacheRecord(),
    );

    return {
      ok: true,
      capabilities: buildManagedCapabilitiesDocument(
        sessionResult.session.entitlement.syncAllowed,
      ),
      preferences: nextPreferences,
    };
  }

  const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
  const capabilitiesResult = await client.getCapabilities(input.sessionToken);
  if (!capabilitiesResult.ok) {
    return {
      ok: false,
      errorCode: mapConnectAPIError(capabilitiesResult.errorCode),
    };
  }

  const attachDeviceResult = await client.attachDevice(input.sessionToken, {
    deviceID: secrets.device.deviceID,
    deviceLabel: secrets.device.deviceLabel,
  });
  if (!attachDeviceResult.ok) {
    return {
      ok: false,
      errorCode: mapConnectAPIError(attachDeviceResult.errorCode),
    };
  }

  // A TOTP challenge only follows a login, so the package is left to the
  // upload, as on a login connect.
  await secretStore.writeSyncSecrets({
    ...secrets,
    authSessionToken: input.sessionToken,
  });

  const nextPreferences: SyncPreferencesRecord = {
    ...preferences,
    normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
    setupStatus: "connected",
    // Self-hosted community sync has no guest-partner concept; clear any
    // stale marker carried over from a prior managed guest session.
    guestSessionExpiresAt: null,
    guestSessionRenewable: false,
  };
  await storage.writeSyncPreferencesRecord(nextPreferences);

  return {
    ok: true,
    capabilities: capabilitiesResult.capabilities,
    preferences: nextPreferences,
  };
}

/**
 * persistGuestPartnerSession persists the session minted by the
 * unauthenticated guest-partner-accept endpoint using the same mechanics as
 * a normal managed connect (see the managed branch of `connectSyncAccount`
 * above): the session token replaces `managedAuthSessionToken` in the
 * secure-storage-backed `SyncSecretsRecord` (never `authSessionToken`, which
 * is reserved for self-hosted community sync), preferences are forced to
 * managed/connected, and the managed-billing cache is reset for the new
 * account boundary — identical to what a fresh managed register/login does.
 *
 * Unlike `connectSyncAccount`, there is no prior "prepare local sync" step to
 * require here: a guest account is reachable only through a single-use
 * invite link and must accept in one tap with no form, so when the device
 * has no local sync secrets yet this generates a fresh `SyncSecretsRecord`
 * (the same generator `prepareSyncSetup` uses internally) instead of failing
 * closed with `sync_not_prepared`. A device that already prepared local sync
 * (or is already managed-connected) keeps its existing device/master-key
 * material untouched — this only ever overwrites the auth-session fields on
 * top of an existing record, so it can never silently regenerate keys out
 * from under an already-set-up device.
 *
 * The `guestSessionExpiresAt` preference is the ONLY local marker that this
 * device's managed session is a guest one (see the field's doc comment on
 * `SyncPreferencesRecord`), and it records the moment this device loses
 * access if it does nothing.
 *
 * A guest that declared refresh support gets a short access session plus a
 * refresh token, exactly like any other managed client, so the refresh
 * material is persisted and `ensureFreshManagedSession` renews it with no
 * special-casing. That deadline is the refresh token's, and it slides
 * forward on every use — `guestSessionRenewable` records that, so the "save
 * your access" nudge withholds a countdown it would otherwise name wrongly.
 * A guest without refresh material keeps the long session and the accurate
 * countdown it has always had.
 */
export async function persistGuestPartnerSession(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: {
    sessionToken: string;
    sessionExpiresAt: string;
    refreshToken?: string;
    refreshTokenExpiresAt?: string;
  },
  now: Date,
): Promise<{
  capabilities: SyncCapabilityDocument;
  preferences: SyncPreferencesRecord;
}> {
  const existingSecrets = await secretStore.readSyncSecrets();
  const baseSecrets: SyncSecretsRecord =
    existingSecrets ?? createSyncSecretsRecord("", now).record;

  // Both refresh fields arrive together or not at all (the client mapper
  // enforces that), so one check decides whether this session renews. The
  // check has to be the narrowing expression itself rather than a precomputed
  // boolean: through a boolean the compiler cannot see the fields are set,
  // and the `?? null` it would then demand is a branch nothing can reach.
  //
  // Either shape is written whole, nulls included: refresh material left over
  // from an earlier owner session on this device must never survive into a
  // guest one — inheriting it would let the guest session mint sessions for
  // somebody else's account.
  const refreshFields =
    input.refreshToken && input.refreshTokenExpiresAt
      ? {
          managedAuthSessionExpiresAt: input.sessionExpiresAt,
          managedRefreshToken: input.refreshToken,
          managedRefreshTokenExpiresAt: input.refreshTokenExpiresAt,
        }
      : {
          managedAuthSessionExpiresAt: null,
          managedRefreshToken: null,
          managedRefreshTokenExpiresAt: null,
        };

  await secretStore.writeSyncSecrets({
    ...baseSecrets,
    authSessionToken: null,
    managedAuthSessionToken: input.sessionToken,
    ...refreshFields,
  });

  const nextPreferences: SyncPreferencesRecord = {
    ...preferences,
    mode: "managed",
    endpointInput: "",
    normalizedEndpoint: MANAGED_SYNC_BASE_URL,
    setupStatus: "connected",
    // The deadline this device faces if it does nothing: the refresh token's
    // when there is one to renew with, the session's own when there is not.
    guestSessionExpiresAt:
      refreshFields.managedRefreshTokenExpiresAt ?? input.sessionExpiresAt,
    guestSessionRenewable: refreshFields.managedRefreshToken !== null,
  };
  await storage.writeSyncPreferencesRecord(nextPreferences);

  // New account boundary (a guest account is always freshly minted): drop
  // any billing-cache state derived under a previous session, same as a
  // normal managed connect.
  await storage.writeManagedBillingCacheRecord(
    createDefaultManagedBillingCacheRecord(),
  );

  return {
    // Guest partner accounts carry no sync entitlement by construction
    // (server-side SyncEntitlement.SyncAllowed=false — see
    // PartnerService.AcceptInviteAsGuest in the managed cloud) — never
    // inferred from a client guess, and the guest endpoint's response has no
    // entitlement field to read one from anyway.
    capabilities: buildManagedCapabilitiesDocument(false),
    preferences: nextPreferences,
  };
}

export type UpgradeGuestPartnerAccountErrorCode =
  | "unauthorized"
  | "account_not_guest"
  | "invalid_registration_input"
  | "registration_failed"
  | "rate_limited"
  | "network_failed"
  | "generic";

export type UpgradeGuestPartnerAccountResult =
  | {
      ok: true;
      accountID: string;
      email: string;
      // recoveryCode is the plaintext account-level recovery code, returned
      // exactly once by the server (same contract as the register-flow
      // code) and never re-fetchable. The caller must surface it once and
      // then forget it.
      recoveryCode: string;
      preferences: SyncPreferencesRecord;
    }
  | {
      ok: false;
      errorCode: UpgradeGuestPartnerAccountErrorCode;
      // preferences is always returned (even on failure) so the caller can
      // refresh its state in one place: it differs from the input only when
      // errorCode is "account_not_guest", where guestSessionExpiresAt has
      // just been cleared — see below.
      preferences: SyncPreferencesRecord;
    };

/**
 * upgradeGuestPartnerAccount converts the guest-partner account behind this
 * device's CURRENT managed session into a normal email+password account
 * (POST /account/upgrade). Bearer auth is the stored managed session, renewed
 * and retried once on a 401 like every managed call; unlike
 * connectSyncAccount/persistGuestPartnerSession the upgrade itself never
 * issues or revokes a session, so it writes no secrets of its own — the same
 * managed session keeps authenticating every subsequent call after it succeeds.
 *
 * On success the local `guestSessionExpiresAt` marker is cleared so the
 * "Keep your access" CTA and expiry nudge disappear immediately, without
 * waiting for the next getSession() focus-load to notice. The same clear
 * also happens on `account_not_guest` (409): that code means the account
 * was already upgraded (on this device or another one) or was never a
 * guest in the first place — a benign convergence with server truth, not a
 * failure worth retrying, so the local marker is brought in line with it
 * right away instead of lingering until the next reload.
 */
export async function upgradeGuestPartnerAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: { email: string; password: string },
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<UpgradeGuestPartnerAccountResult> {
  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.managedAuthSessionToken) {
    return { ok: false, errorCode: "unauthorized", preferences };
  }

  const managedClient = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
  const credentials = { email: input.email.trim(), password: input.password };
  const result = await callWithManagedSession(
    secretStore,
    (sessionToken) => managedClient.upgradeGuestAccount(sessionToken, credentials),
    { managedClientFactory },
  );

  if (!result.ok) {
    if (isManagedSessionEnded(result.errorCode)) {
      return { ok: false, errorCode: "unauthorized", preferences };
    }
    if (result.errorCode === "account_not_guest") {
      const clearedPreferences: SyncPreferencesRecord = {
        ...preferences,
        guestSessionExpiresAt: null,
        guestSessionRenewable: false,
      };
      await storage.writeSyncPreferencesRecord(clearedPreferences);
      return {
        ok: false,
        errorCode: "account_not_guest",
        preferences: clearedPreferences,
      };
    }

    return {
      ok: false,
      errorCode: mapManagedSessionCallError(
        result.errorCode,
        mapUpgradeGuestPartnerAccountAPIError,
      ),
      preferences,
    };
  }

  const nextPreferences: SyncPreferencesRecord = {
    ...preferences,
    guestSessionExpiresAt: null,
    guestSessionRenewable: false,
  };
  await storage.writeSyncPreferencesRecord(nextPreferences);

  return {
    ok: true,
    accountID: result.result.accountID,
    email: result.result.email,
    recoveryCode: result.result.recoveryCode,
    preferences: nextPreferences,
  };
}

function mapUpgradeGuestPartnerAccountAPIError(
  errorCode: ManagedCloudAPIErrorCode,
): UpgradeGuestPartnerAccountErrorCode {
  switch (errorCode) {
    case "unauthorized":
    case "invalid_registration_input":
    case "registration_failed":
    case "rate_limited":
    case "network_failed":
      return errorCode;
    default:
      return "generic";
  }
}

export async function loadConnectedSyncCapabilities(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | {
      ok: true;
      capabilities: SyncCapabilityDocument;
    }
  | {
      ok: false;
      errorCode: SyncConnectErrorCode;
    }
> {
  if (preferences.mode === "managed") {
    const secrets = await secretStore.readSyncSecrets();
    if (!secrets?.managedAuthSessionToken) {
      return {
        ok: false,
        errorCode: "unauthorized",
      };
    }

    const managedClient = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const sessionResult = await callWithManagedSession(
      secretStore,
      (sessionToken) => managedClient.getSession(sessionToken),
      { managedClientFactory },
    );
    if (!sessionResult.ok) {
      if (isManagedSessionEnded(sessionResult.errorCode)) {
        await clearSyncSessionToken(secretStore);
        return { ok: false, errorCode: "unauthorized" };
      }
      return {
        ok: false,
        errorCode: mapManagedSessionCallError(
          sessionResult.errorCode,
          mapManagedConnectAPIError,
        ),
      };
    }

    if (!sessionResult.session.entitlement.syncAllowed) {
      await clearSyncSessionToken(secretStore);
    }

    return {
      ok: true,
      capabilities: buildManagedCapabilitiesDocument(
        sessionResult.session.entitlement.syncAllowed,
      ),
    };
  }

  const prepared = await readPreparedSyncContext(secretStore, preferences);
  if (!prepared.ok) {
    return {
      ok: false,
      errorCode: mapPreparedContextToConnectError(prepared.errorCode),
    };
  }

  const client = apiClientFactory(prepared.baseURL);
  const capabilitiesResult = await client.getCapabilities(prepared.secrets.authSessionToken);
  if (!capabilitiesResult.ok) {
    return {
      ok: false,
      errorCode: mapConnectAPIError(capabilitiesResult.errorCode),
    };
  }

  return {
    ok: true,
    capabilities: capabilitiesResult.capabilities,
  };
}

export async function recoverSyncAccess(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  credentials: { login: string; password: string },
  recoveryPhrase: string,
  now: Date,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | RecoverSyncAccessSuccess
  | {
      // Self-hosted only: the password verified but the account has TOTP on.
      // Nothing is stored yet; the caller completes the challenge and calls
      // `finalizeSyncRecoveryAfterTOTP` with the issued token and the phrase.
      ok: true;
      totpChallengeRequired: true;
      challengeID: string;
      challengeExpiresAt: string;
    }
  | {
      ok: false;
      errorCode: SyncRecoverErrorCode;
    }
> {
  const login = credentials.login.trim();
  if (login.length === 0) {
    return { ok: false, errorCode: "login_required" };
  }
  if (credentials.password.length === 0) {
    return { ok: false, errorCode: "password_required" };
  }
  if (preferences.deviceLabel.trim().length === 0) {
    return { ok: false, errorCode: "device_label_required" };
  }
  if (!isSyncDeviceLabelLengthValid(preferences.deviceLabel)) {
    return { ok: false, errorCode: "device_label_invalid_length" };
  }

  const normalizedRecoveryPhrase = recoveryPhrase.trim();
  if (normalizedRecoveryPhrase.length === 0) {
    return { ok: false, errorCode: "recovery_phrase_required" };
  }
  if (!isValidRecoveryPhrase(normalizedRecoveryPhrase)) {
    return { ok: false, errorCode: "invalid_recovery_phrase" };
  }

  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return normalizedEndpoint;
  }

  if (preferences.mode === "managed") {
    const managedClient = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const authResult = await managedClient.login({
      email: login,
      password: credentials.password,
    });
    if (!authResult.ok) {
      return {
        ok: false,
        errorCode: mapManagedRecoverAPIError(authResult.errorCode),
      };
    }
    if (!authResult.auth.entitlement.syncAllowed) {
      return {
        ok: false,
        errorCode: "sync_not_allowed",
      };
    }

    const syncSessionResult = await managedClient.createSyncSession(
      authResult.auth.sessionToken,
    );
    if (!syncSessionResult.ok) {
      return {
        ok: false,
        errorCode: mapManagedRecoverAPIError(syncSessionResult.errorCode),
      };
    }

    const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
    const recoveryKeyResult = await client.getRecoveryKey(
      syncSessionResult.auth.sessionToken,
    );
    if (!recoveryKeyResult.ok) {
      return {
        ok: false,
        errorCode: mapRecoverAPIError(recoveryKeyResult.errorCode),
      };
    }

    let recoveredSecrets: SyncSecretsRecord;
    try {
      recoveredSecrets = createRecoveredSyncSecretsRecord(
        normalizedRecoveryPhrase,
        recoveryKeyResult.recoveryKey,
        preferences.deviceLabel,
        now,
      );
    } catch {
      return {
        ok: false,
        errorCode: "invalid_recovery_phrase",
      };
    }

    const capabilities = buildManagedCapabilitiesDocument(true);
    const attachDeviceResult = await client.attachDevice(
      syncSessionResult.auth.sessionToken,
      {
        deviceID: recoveredSecrets.device.deviceID,
        deviceLabel: recoveredSecrets.device.deviceLabel,
      },
    );
    if (!attachDeviceResult.ok) {
      return {
        ok: false,
        errorCode: mapRecoverAPIError(attachDeviceResult.errorCode),
      };
    }

    await syncRecoveryKeyIfSupported(
      client,
      syncSessionResult.auth.sessionToken,
      capabilities,
      recoveredSecrets.wrappedKey,
    );

    await secretStore.writeSyncSecrets(
      applyManagedAuthResultToSecrets(
        {
          ...recoveredSecrets,
          authSessionToken: syncSessionResult.auth.sessionToken,
        },
        authResult.auth,
      ),
    );

    const nextPreferences: SyncPreferencesRecord = {
      ...createDefaultSyncPreferencesRecord(),
      ...preferences,
      deviceLabel: preferences.deviceLabel.trim(),
      endpointInput: "",
      normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
      setupStatus: "connected",
      preparedAt: now.toISOString(),
      lastRemoteGeneration: null,
      lastSyncedAt: null,
      // Recovery authenticates with a real password (managedClient.login
      // above) — a guest account has none, so this path can never actually
      // be reached for a guest. Clear defensively so a stale marker carried
      // in `...preferences` can never survive onto this freshly recovered
      // session.
      guestSessionExpiresAt: null,
      guestSessionRenewable: false,
    };
    await storage.writeSyncPreferencesRecord(nextPreferences);

    // Recovery establishes a fresh managed session context as well.
    await storage.writeManagedBillingCacheRecord(
      createDefaultManagedBillingCacheRecord(),
    );

    return {
      ok: true,
      capabilities,
      preferences: nextPreferences,
    };
  }

  const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
  const authResult = await client.login({
    login,
    password: credentials.password,
  });
  if (!authResult.ok) {
    return {
      ok: false,
      errorCode: mapRecoverAPIError(authResult.errorCode),
    };
  }

  // The deferred login carries an empty session token; nothing may run on it.
  if (authResult.auth.totpChallenge) {
    return {
      ok: true,
      totpChallengeRequired: true,
      challengeID: authResult.auth.totpChallenge.challengeID,
      challengeExpiresAt: authResult.auth.totpChallenge.challengeExpiresAt,
    };
  }

  return completeCommunityRecovery(
    storage,
    secretStore,
    preferences,
    client,
    normalizedEndpoint.endpoint.baseURL,
    authResult.auth.sessionToken,
    normalizedRecoveryPhrase,
    now,
  );
}

type RecoverSyncAccessSuccess = {
  ok: true;
  capabilities: SyncCapabilityDocument;
  preferences: SyncPreferencesRecord;
};

/**
 * finalizeSyncRecoveryAfterTOTP finishes a self-hosted phrase recovery whose
 * login `recoverSyncAccess` deferred for a TOTP challenge. The caller completes
 * the challenge (`completeTOTPChallenge` in sync-totp-service) and passes the
 * issued session token with the phrase, both held in memory only.
 */
export async function finalizeSyncRecoveryAfterTOTP(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: { sessionToken: string; recoveryPhrase: string },
  now: Date,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
): Promise<
  | RecoverSyncAccessSuccess
  | {
      ok: false;
      errorCode: SyncRecoverErrorCode;
    }
> {
  if (preferences.mode !== "self_hosted") {
    return { ok: false, errorCode: "generic" };
  }
  if (input.sessionToken.length === 0) {
    return { ok: false, errorCode: "unauthorized" };
  }
  if (preferences.deviceLabel.trim().length === 0) {
    return { ok: false, errorCode: "device_label_required" };
  }
  if (!isSyncDeviceLabelLengthValid(preferences.deviceLabel)) {
    return { ok: false, errorCode: "device_label_invalid_length" };
  }
  const normalizedRecoveryPhrase = input.recoveryPhrase.trim();
  if (normalizedRecoveryPhrase.length === 0) {
    return { ok: false, errorCode: "recovery_phrase_required" };
  }
  if (!isValidRecoveryPhrase(normalizedRecoveryPhrase)) {
    return { ok: false, errorCode: "invalid_recovery_phrase" };
  }
  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return normalizedEndpoint;
  }

  return completeCommunityRecovery(
    storage,
    secretStore,
    preferences,
    apiClientFactory(normalizedEndpoint.endpoint.baseURL),
    normalizedEndpoint.endpoint.baseURL,
    input.sessionToken,
    normalizedRecoveryPhrase,
    now,
  );
}

async function completeCommunityRecovery(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  client: SyncAPIClient,
  baseURL: string,
  sessionToken: string,
  normalizedRecoveryPhrase: string,
  now: Date,
): Promise<
  | RecoverSyncAccessSuccess
  | {
      ok: false;
      errorCode: SyncRecoverErrorCode;
    }
> {
  const capabilitiesResult = await client.getCapabilities(sessionToken);
  if (!capabilitiesResult.ok) {
    return {
      ok: false,
      errorCode: mapRecoverAPIError(capabilitiesResult.errorCode),
    };
  }
  if (!capabilitiesResult.capabilities.recoverySupported) {
    return {
      ok: false,
      errorCode: "recovery_not_available",
    };
  }

  const recoveryKeyResult = await client.getRecoveryKey(sessionToken);
  if (!recoveryKeyResult.ok) {
    return {
      ok: false,
      errorCode: mapRecoverAPIError(recoveryKeyResult.errorCode),
    };
  }

  let recoveredSecrets: SyncSecretsRecord;
  try {
    recoveredSecrets = createRecoveredSyncSecretsRecord(
      normalizedRecoveryPhrase,
      recoveryKeyResult.recoveryKey,
      preferences.deviceLabel,
      now,
    );
  } catch {
    return {
      ok: false,
      errorCode: "invalid_recovery_phrase",
    };
  }

  const attachDeviceResult = await client.attachDevice(sessionToken, {
    deviceID: recoveredSecrets.device.deviceID,
    deviceLabel: recoveredSecrets.device.deviceLabel,
  });
  if (!attachDeviceResult.ok) {
    return {
      ok: false,
      errorCode: mapRecoverAPIError(attachDeviceResult.errorCode),
    };
  }

  await secretStore.writeSyncSecrets({
    ...recoveredSecrets,
    authSessionToken: sessionToken,
  });

  const nextPreferences: SyncPreferencesRecord = {
    ...createDefaultSyncPreferencesRecord(),
    ...preferences,
    deviceLabel: preferences.deviceLabel.trim(),
    endpointInput:
      preferences.mode === "self_hosted" ? preferences.endpointInput.trim() : "",
    normalizedEndpoint: baseURL,
    setupStatus: "connected",
    preparedAt: now.toISOString(),
    lastRemoteGeneration: null,
    lastSyncedAt: null,
    // Community-sync recovery authenticates with a real password; a guest
    // account has none, so clear defensively (same reasoning as the managed
    // recovery branch above).
    guestSessionExpiresAt: null,
    guestSessionRenewable: false,
  };
  await storage.writeSyncPreferencesRecord(nextPreferences);

  return {
    ok: true,
    capabilities: capabilitiesResult.capabilities,
    preferences: nextPreferences,
  };
}

function mapPreparedContextToConnectError(
  errorCode: SyncRunErrorCode,
): SyncConnectErrorCode {
  switch (errorCode) {
    case "sync_not_prepared":
      return "sync_not_prepared";
    case "unauthorized":
      return "unauthorized";
    case "network_failed":
      return "network_failed";
    default:
      return "generic";
  }
}

export async function runSyncUpload(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  now: Date,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
  uploadOverBackupGuard?: UploadOverBackupGuard,
  // Held only for this call; never stored or logged.
  recoveryKeyStepUp?: SyncRecoveryKeyStepUp,
): Promise<
  | {
      ok: true;
      preferences: SyncPreferencesRecord;
    }
  | {
      ok: false;
      errorCode: SyncRunErrorCode;
      retryAfterSeconds?: number;
    }
> {
  // A restore that stopped partway left local data incomplete; uploading it
  // would replace the backup. The stored flag is read rather than the
  // caller's copy, which may predate the restore.
  const storedPreferences = await storage.readSyncPreferencesRecord();
  if (storedPreferences.restoreInProgress === true) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }

  const prepared = await readPreparedSyncContext(
    secretStore,
    preferences,
    apiClientFactory,
    managedClientFactory,
  );
  if (!prepared.ok) {
    return prepared;
  }

  const client = apiClientFactory(prepared.baseURL);

  // Fresh-install guard: probe the server for an existing backup before this
  // never-synced device is allowed to overwrite it. The probe runs only when
  // lastRemoteGeneration is null, so steady-state uploads pay no extra
  // request. Fail closed on probe errors other than "no blob yet": if the
  // remote state is unknown, overwriting is exactly the risk being guarded.
  // undefined = not probed; null = the server holds no blob.
  let remoteBlob: SyncBlobRecord | null | undefined;
  if (preferences.lastRemoteGeneration === null) {
    const remoteBlobResult = await client.getBlob(prepared.secrets.authSessionToken);
    if (!remoteBlobResult.ok && remoteBlobResult.errorCode !== "blob_not_found") {
      return withRetryAfter(
        { ok: false, errorCode: mapRunAPIError(remoteBlobResult.errorCode) },
        remoteBlobResult,
      );
    }
    remoteBlob = remoteBlobResult.ok ? remoteBlobResult.blob : null;

    if (
      requiresUploadOverBackupConfirmation({
        lastRemoteGeneration: preferences.lastRemoteGeneration,
        remoteBackupExists: remoteBlobResult.ok,
      })
    ) {
      const confirmed = uploadOverBackupGuard
        ? await uploadOverBackupGuard.confirmUploadOverExistingBackup()
        : false;
      if (!confirmed) {
        return { ok: false, errorCode: "upload_over_backup_declined" };
      }
    }
  }

  const snapshot = await buildSyncSnapshot(storage, now);
  const payload = encodeSyncSnapshot(snapshot);
  const generation = nextRemoteGeneration(preferences, now);
  if (!isValidSyncGeneration(generation)) {
    return { ok: false, errorCode: "stale_generation" };
  }
  const encryptedEnvelope = encryptSyncPayload(
    prepared.secrets.masterKeyHex,
    payload,
    buildSyncPayloadAad(SYNC_SNAPSHOT_SCHEMA_VERSION, generation),
  );
  const ciphertextBytes = encodeEncryptedEnvelope(encryptedEnvelope);
  const checksumSHA256 = bytesToHex(sha256(ciphertextBytes));

  const capabilitiesResult = await client.getCapabilities(prepared.secrets.authSessionToken);
  if (!capabilitiesResult.ok) {
    // Fail closed: without the capabilities the recovery-key package cannot be
    // kept in step with the blob, so a new-key blob could land under the old
    // package.
    return { ok: false, errorCode: mapRunAPIError(capabilitiesResult.errorCode) };
  }
  const capabilities = capabilitiesResult.capabilities;
  // The server refuses a blob over its limit only after the package write.
  if (capabilities.maxBlobBytes > 0 && ciphertextBytes.length > capabilities.maxBlobBytes) {
    return { ok: false, errorCode: "backup_too_large" };
  }

  // The step-up is a community-server check; a managed sync host is not the
  // auth host and never receives the password or code.
  const syncedRecoveryKey =
    preferences.mode === "self_hosted"
      ? await syncRecoveryKeyBeforeBlob(
          client,
          prepared.secrets.authSessionToken,
          capabilities,
          prepared.secrets.wrappedKey,
          {
            generation,
            rollbackFloor: readRollbackFloor(preferences),
            remoteBlob,
          },
          recoveryKeyStepUp,
        )
      : await putRecoveryKeyWithoutStepUp(
          client,
          prepared.secrets.authSessionToken,
          capabilities,
          prepared.secrets.wrappedKey,
        );
  if (!syncedRecoveryKey.ok) {
    const errorCode = syncedRecoveryKey.errorCode;
    if (errorCode === "recovery_key_changed_elsewhere") {
      return { ok: false, errorCode };
    }
    return {
      ok: false,
      errorCode:
        preferences.mode === "self_hosted" && isRecoveryKeyStepUpCode(errorCode)
          ? errorCode
          : mapRunAPIError(errorCode as SyncAPIErrorCode),
    };
  }

  const putBlobResult = await putBlobComparingGeneration(
    client,
    prepared.secrets.authSessionToken,
    {
      schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
      generation,
      checksumSHA256,
      ciphertextBase64: fromByteArray(ciphertextBytes),
    },
    remoteBlob === undefined
      ? (readRollbackFloor(preferences) ?? undefined)
      : (remoteBlob?.generation ?? undefined),
    preferences.lastSyncedAt,
  );
  if (!putBlobResult.ok) {
    if (putBlobResult.errorCode === "remote_backup_changed") {
      return { ok: false, errorCode: "remote_backup_changed" };
    }
    return withRetryAfter(
      { ok: false, errorCode: mapRunAPIError(putBlobResult.errorCode) },
      putBlobResult,
    );
  }

  // The floor is the generation this device sealed, never the server's echo.
  const nextPreferences = buildSyncedPreferences(
    preferences,
    generation,
    putBlobResult.blob.updatedAt,
    "connected",
  );
  await storage.writeSyncPreferencesRecord(nextPreferences);

  return { ok: true, preferences: nextPreferences };
}

export async function runSyncRestore(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
  reminderScheduler?: LocalReminderScheduler,
  restoreOlderBackupGuard?: RestoreOlderBackupGuard,
): Promise<
  | {
      ok: true;
      preferences: SyncPreferencesRecord;
    }
  | {
      ok: false;
      errorCode: SyncRunErrorCode;
      retryAfterSeconds?: number;
    }
> {
  const prepared = await readPreparedSyncContext(
    secretStore,
    preferences,
    apiClientFactory,
    managedClientFactory,
  );
  if (!prepared.ok) {
    return prepared;
  }

  const client = apiClientFactory(prepared.baseURL);
  const blobResult = await client.getBlob(prepared.secrets.authSessionToken);
  if (!blobResult.ok) {
    if (blobResult.errorCode === "blob_not_found") {
      // No backup is left for an unfinished restore to protect or finish.
      const stored = await storage.readSyncPreferencesRecord();
      if (stored.restoreInProgress === true) {
        await storage.writeSyncPreferencesRecord(stored, {
          restoreInProgress: false,
        });
      }
    }
    return withRetryAfter(
      { ok: false, errorCode: mapRunAPIError(blobResult.errorCode) },
      blobResult,
    );
  }

  const reportedGeneration = blobResult.blob.generation;
  if (!isValidSyncGeneration(reportedGeneration)) {
    return { ok: false, errorCode: "invalid_blob" };
  }

  let encryptedEnvelope: EncryptedSyncEnvelope;
  let opened: { payload: Uint8Array; sealedGeneration: number | null };
  try {
    encryptedEnvelope = decodeEncryptedEnvelope(
      toByteArray(blobResult.blob.ciphertextBase64),
    );
    opened = decryptSyncSnapshotPayload(
      prepared.secrets.masterKeyHex,
      encryptedEnvelope,
      blobResult.blob.schemaVersion,
      reportedGeneration,
      prepared.secrets.device.deviceID,
    );
  } catch {
    return { ok: false, errorCode: "invalid_payload" };
  }

  let snapshot;
  try {
    snapshot = decodeSyncSnapshot(opened.payload);
  } catch {
    return { ok: false, errorCode: "invalid_payload" };
  }

  const rollbackFloor = readRollbackFloor(preferences);
  // A stored floor that is present but not a valid generation cannot be
  // compared, so it asks rather than reading as "no floor".
  const floorUnreadable =
    rollbackFloor === null && preferences.lastRemoteGeneration !== null;
  if (
    floorUnreadable ||
    requiresRestoreOlderBackupConfirmation({
      rollbackFloor,
      sealedGeneration: opened.sealedGeneration,
    })
  ) {
    const confirmed = restoreOlderBackupGuard
      ? await restoreOlderBackupGuard.confirmRestoreOlderBackup()
      : false;
    if (!confirmed) {
      return { ok: false, errorCode: "restore_older_backup_declined" };
    }
  }

  const nextPreferences: SyncPreferencesRecord = {
    ...buildSyncedPreferences(
      preferences,
      nextRollbackFloor(rollbackFloor, opened.sealedGeneration, reportedGeneration),
      blobResult.blob.updatedAt,
      "connected",
    ),
    restoreInProgress: false,
  };
  await restoreSyncSnapshot(
    storage,
    snapshot,
    nextPreferences,
    reminderScheduler,
    preferences,
  );

  return { ok: true, preferences: nextPreferences };
}

/**
 * listSyncDevices returns every device attached to the sync account plus the
 * id of the device this install registered under, so callers can mark "this
 * device" themselves — the server response carries no such marker. Works in
 * both modes through the same prepared-session resolution as upload/restore
 * (managed mode mints a bridged sync session first). The current device may
 * legitimately be absent from the list: managed connect does not attach a
 * device (only recovery does), and another device may have removed this one.
 */
export async function listSyncDevices(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | {
      ok: true;
      devices: SyncDeviceRecord[];
      currentDeviceID: string;
    }
  | {
      ok: false;
      errorCode: SyncDeviceManagementErrorCode;
    }
> {
  const prepared = await readPreparedSyncContext(
    secretStore,
    preferences,
    apiClientFactory,
    managedClientFactory,
  );
  if (!prepared.ok) {
    return {
      ok: false,
      errorCode: mapPreparedContextToDeviceManagementError(prepared.errorCode),
    };
  }

  const client = apiClientFactory(prepared.baseURL);
  const listResult = await client.listDevices(prepared.secrets.authSessionToken);
  if (!listResult.ok) {
    return {
      ok: false,
      errorCode: mapDeviceManagementAPIError(listResult.errorCode),
    };
  }

  return {
    ok: true,
    devices: listResult.devices,
    currentDeviceID: prepared.secrets.device.deviceID,
  };
}

/**
 * removeSyncDevice detaches one device from the account so its slot is freed.
 * The server allows removing the currently connected device: sessions are not
 * device-bound, so sync on this install keeps working and the device simply
 * re-registers on the next sign-in or recovery. The distinct confirmation for
 * that case is owned by the caller; this function only reports whether the
 * removed id was the current device's.
 */
export async function removeSyncDevice(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  deviceID: string,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | {
      ok: true;
      removedCurrentDevice: boolean;
    }
  | {
      ok: false;
      errorCode: SyncDeviceManagementErrorCode;
    }
> {
  const prepared = await readPreparedSyncContext(
    secretStore,
    preferences,
    apiClientFactory,
    managedClientFactory,
  );
  if (!prepared.ok) {
    return {
      ok: false,
      errorCode: mapPreparedContextToDeviceManagementError(prepared.errorCode),
    };
  }

  const client = apiClientFactory(prepared.baseURL);
  const removeResult = await client.removeDevice(
    prepared.secrets.authSessionToken,
    { deviceID },
  );
  if (!removeResult.ok) {
    return {
      ok: false,
      errorCode: mapDeviceManagementAPIError(removeResult.errorCode),
    };
  }

  return {
    ok: true,
    removedCurrentDevice: deviceID === prepared.secrets.device.deviceID,
  };
}

function mapPreparedContextToDeviceManagementError(
  errorCode: SyncRunErrorCode,
): SyncDeviceManagementErrorCode {
  switch (errorCode) {
    case "sync_not_prepared":
    case "not_connected":
    case "sync_not_allowed":
    case "unauthorized":
    case "rate_limited":
    case "network_failed":
      return errorCode;
    default:
      return "generic";
  }
}

function mapDeviceManagementAPIError(
  errorCode: SyncAPIErrorCode,
): SyncDeviceManagementErrorCode {
  switch (errorCode) {
    case "unauthorized":
    case "device_not_found":
    case "rate_limited":
    case "network_failed":
      return errorCode;
    case "sync_disabled":
      return "sync_not_allowed";
    case "server_busy":
      return "network_failed";
    default:
      // invalid_device: an empty id cannot come from the rendered list.
      return "generic";
  }
}

export async function disconnectSyncAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
  remoteTimeoutMs: number = DISCONNECT_REMOTE_TIMEOUT_MS,
): Promise<{ ok: true; preferences: SyncPreferencesRecord }> {
  // The local wipe below must not wait on a slow or hanging server.
  await settleWithin(
    revokeRemoteSessions(
      secretStore,
      preferences,
      apiClientFactory,
      managedClientFactory,
    ),
    remoteTimeoutMs,
  );

  const nextPreferences = await clearLocalSyncSession(
    storage,
    secretStore,
    preferences,
  );

  return { ok: true, preferences: nextPreferences };
}

const DISCONNECT_REMOTE_TIMEOUT_MS = 10_000;

async function revokeRemoteSessions(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  apiClientFactory: SyncAPIClientFactory,
  managedClientFactory: ManagedCloudAPIClientFactory,
): Promise<void> {
  const managed = preferences.mode === "managed";
  if (managed) {
    // A renewal in flight rotates the refresh token: revoke what it wrote,
    // not the token it spent.
    await settleInFlightManagedRefresh();
  }
  const secrets = await secretStore.readSyncSecrets();
  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );

  const revocations: Promise<unknown>[] = [];
  if (secrets?.authSessionToken && normalizedEndpoint.ok) {
    const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
    revocations.push(client.logout(secrets.authSessionToken));
  }
  const managedCredentials = {
    sessionToken: secrets?.managedAuthSessionToken || null,
    refreshToken: secrets?.managedRefreshToken || null,
  };
  if (managed && (managedCredentials.sessionToken || managedCredentials.refreshToken)) {
    revocations.push(
      revokeManagedSession(
        managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL),
        managedCredentials,
      ),
    );
  }
  await Promise.all(revocations);
}

async function revokeManagedSession(
  managedClient: ManagedCloudAPIClient,
  credentials: { sessionToken: string | null; refreshToken: string | null },
): Promise<void> {
  const result = await managedClient.logout(credentials);
  // A 5xx means the logout rolled back and the family is still live.
  if (!result.ok && result.errorCode === "network_failed") {
    await managedClient.logout(credentials);
  }
}

async function settleWithin(work: Promise<unknown>, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work.catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function clearLocalSyncSession(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
): Promise<SyncPreferencesRecord> {
  if (preferences.mode === "managed") {
    endManagedSessionRefresh();
  }
  clearPendingManagedRecoveryRotation();
  const secrets = await secretStore.readSyncSecrets();
  const nextManagedAuthSessionToken =
    preferences.mode === "managed" ? null : secrets?.managedAuthSessionToken ?? null;
  if (secrets) {
    const base =
      preferences.mode === "managed"
        ? clearManagedSessionFromSecrets(secrets)
        : secrets;
    await secretStore.writeSyncSecrets({
      ...base,
      authSessionToken: null,
      managedAuthSessionToken: nextManagedAuthSessionToken,
    });
  }

  const nextHasManagedCloudSession =
    preferences.mode === "managed" &&
    typeof nextManagedAuthSessionToken === "string" &&
    nextManagedAuthSessionToken.length > 0;
  const nextPreferences: SyncPreferencesRecord = {
    ...preferences,
    setupStatus: nextHasManagedCloudSession
      ? "connected"
      : secrets
        ? "local_ready"
        : "not_configured",
    // Disconnect/unauthorized-clear ends the session boundary; a later
    // reconnect on this device always goes through connect/recover/guest
    // accept, each of which sets this field to its own correct value. Clear
    // it here so a stale guest marker never survives past this boundary.
    guestSessionExpiresAt: null,
    guestSessionRenewable: false,
  };
  await storage.writeSyncPreferencesRecord(nextPreferences);

  // Session boundary: the cached billing snapshot (and dismissed offer ids)
  // belong to the managed account context that just ended — same invariant
  // as the pending partner-invite buffer.
  await storage.writeManagedBillingCacheRecord(
    createDefaultManagedBillingCacheRecord(),
  );

  return nextPreferences;
}

async function readPreparedSyncContext(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | {
      ok: true;
      baseURL: string;
      secrets: SyncSecretsRecord & {
        authSessionToken: string;
        managedAuthSessionToken: string | null;
      };
    }
  | {
      ok: false;
      errorCode: SyncRunErrorCode;
    }
> {
  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }

  if (preferences.mode === "managed") {
    if (!secrets.managedAuthSessionToken) {
      return { ok: false, errorCode: "not_connected" };
    }

    const managedClient = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const sessionResult = await callWithManagedSession(
      secretStore,
      (sessionToken) => managedClient.getSession(sessionToken),
      { managedClientFactory },
    );
    if (!sessionResult.ok) {
      return {
        ok: false,
        errorCode: await mapManagedSessionRunFailure(
          secretStore,
          sessionResult.errorCode,
        ),
      };
    }
    if (!sessionResult.session.entitlement.syncAllowed) {
      await clearSyncSessionToken(secretStore);
      return { ok: false, errorCode: "sync_not_allowed" };
    }

    const minted = { underSessionToken: "" };
    const syncSessionResult = await callWithManagedSession(
      secretStore,
      (sessionToken) => {
        minted.underSessionToken = sessionToken;
        return managedClient.createSyncSession(sessionToken);
      },
      { managedClientFactory },
    );
    if (!syncSessionResult.ok) {
      return {
        ok: false,
        errorCode: await mapManagedSessionRunFailure(
          secretStore,
          syncSessionResult.errorCode,
        ),
      };
    }

    // Re-read: a renewal inside either call rotated the managed tokens, and a
    // write from the record read above would put the spent pair back. A record
    // no longer on the minting session belongs to a sign-out or another account.
    const current = await secretStore.readSyncSecrets();
    if (
      !current?.managedAuthSessionToken ||
      current.managedAuthSessionToken !== minted.underSessionToken
    ) {
      return { ok: false, errorCode: "not_connected" };
    }
    const nextSecrets = {
      ...current,
      authSessionToken: syncSessionResult.auth.sessionToken,
    };
    await secretStore.writeSyncSecrets(nextSecrets);

    return {
      ok: true,
      baseURL: normalizedEndpoint.endpoint.baseURL,
      secrets: {
        ...nextSecrets,
        managedAuthSessionToken: current.managedAuthSessionToken,
      },
    };
  }

  if (!secrets.authSessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  return {
    ok: true,
    baseURL: normalizedEndpoint.endpoint.baseURL,
    secrets: {
      ...secrets,
      authSessionToken: secrets.authSessionToken,
      managedAuthSessionToken: secrets.managedAuthSessionToken,
    },
  };
}

type ManagedSessionEndedCode = ManagedSessionCallFailure["errorCode"];

function isManagedSessionEnded(
  errorCode: ManagedCloudAPIErrorCode | ManagedSessionEndedCode,
): errorCode is ManagedSessionEndedCode {
  return errorCode === "session_expired" || errorCode === "no_session";
}

// callWithManagedSession passes a 401 through only with the credentials kept,
// and callers answer "unauthorized" by ending the local session.
function mapManagedSessionCallError<C>(
  errorCode: ManagedCloudAPIErrorCode,
  mapAPIError: (errorCode: ManagedCloudAPIErrorCode) => C,
): C | "generic" {
  return errorCode === "unauthorized" ? "generic" : mapAPIError(errorCode);
}

async function mapManagedSessionRunFailure(
  secretStore: SyncSecretStore,
  errorCode: ManagedCloudAPIErrorCode | ManagedSessionEndedCode,
): Promise<SyncRunErrorCode> {
  if (errorCode === "no_session") {
    return "not_connected";
  }
  if (errorCode === "session_expired") {
    await clearSyncSessionToken(secretStore);
    return "unauthorized";
  }
  return mapManagedSessionCallError(errorCode, mapManagedRunAPIError);
}

// In managed mode the sync session is minted from the managed session, so it
// ends with it or with the sync entitlement.
async function clearSyncSessionToken(secretStore: SyncSecretStore): Promise<void> {
  const current = await secretStore.readSyncSecrets();
  if (current?.authSessionToken) {
    await secretStore.writeSyncSecrets({ ...current, authSessionToken: null });
  }
}

function buildSyncedPreferences(
  preferences: SyncPreferencesRecord,
  generation: number,
  syncedAt: string,
  setupStatus: SyncSetupStatus,
): SyncPreferencesRecord {
  return {
    ...preferences,
    setupStatus,
    lastRemoteGeneration: generation,
    lastSyncedAt: syncedAt,
  };
}

function readRollbackFloor(preferences: SyncPreferencesRecord): number | null {
  return isValidSyncGeneration(preferences.lastRemoteGeneration)
    ? preferences.lastRemoteGeneration
    : null;
}

/**
 * The floor never moves down, and only a sealed generation raises it. A
 * legacy blob's generation is server-chosen: it never moves an existing
 * floor, and on a device with none it is capped at the current time, so a
 * forged value cannot push later uploads past what the server accepts.
 */
function nextRollbackFloor(
  rollbackFloor: number | null,
  sealedGeneration: number | null,
  reportedGeneration: number,
): number {
  if (sealedGeneration !== null) {
    return rollbackFloor === null
      ? sealedGeneration
      : Math.max(rollbackFloor, sealedGeneration);
  }
  return rollbackFloor ?? Math.min(reportedGeneration, Date.now());
}

function nextRemoteGeneration(
  preferences: SyncPreferencesRecord,
  now: Date,
): number {
  const nowGeneration = now.getTime();
  const floor = readRollbackFloor(preferences);
  return floor === null ? nowGeneration : Math.max(nowGeneration, floor + 1);
}

type BlobPutInput = Parameters<SyncAPIClient["putBlob"]>[1];

/**
 * Writes the blob only while the server still stores the generation this
 * device last read or wrote, so another device's newer backup is never
 * overwritten blind. A 409 or a lost reply is reconciled with a GET:
 * - the stored blob is this attempt's own (same generation and checksum):
 *   the write landed and its reply was lost;
 * - the stored blob is the one this device last synced (same server
 *   timestamp) under another generation, as after a confirmed older
 *   restore: retry once against it;
 * - anything else came from another device: refuse with
 *   `remote_backup_changed`.
 * A server that predates `expected_generation` rejects the unknown field
 * with 400 invalid_json; the write is retried once without it.
 */
async function putBlobComparingGeneration(
  client: SyncAPIClient,
  sessionToken: string,
  input: BlobPutInput,
  expectedGeneration: number | undefined,
  lastSyncedAt: string | null,
): Promise<
  | { ok: true; blob: SyncBlobRecord }
  | SyncAPIFailure
  | { ok: false; errorCode: "remote_backup_changed" }
> {
  const first = await client.putBlob(
    sessionToken,
    expectedGeneration === undefined ? input : { ...input, expectedGeneration },
  );
  if (first.ok) {
    return first;
  }
  if (first.errorCode === "invalid_json" && expectedGeneration !== undefined) {
    return reconcileAmbiguousPut(
      client,
      sessionToken,
      input,
      await client.putBlob(sessionToken, input),
    );
  }
  if (first.errorCode !== "stale_generation") {
    return reconcileAmbiguousPut(client, sessionToken, input, first);
  }

  const stored = await client.getBlob(sessionToken);
  if (!stored.ok) {
    return { ok: false, errorCode: "remote_backup_changed" };
  }
  if (isSameBlob(stored.blob, input)) {
    return stored;
  }
  if (
    expectedGeneration !== undefined &&
    lastSyncedAt !== null &&
    stored.blob.updatedAt === lastSyncedAt &&
    stored.blob.generation < input.generation
  ) {
    const retried = await client.putBlob(sessionToken, {
      ...input,
      expectedGeneration: stored.blob.generation,
    });
    if (retried.ok || retried.errorCode !== "stale_generation") {
      return reconcileAmbiguousPut(client, sessionToken, input, retried);
    }
  }
  return { ok: false, errorCode: "remote_backup_changed" };
}

// A network failure or a 5xx leaves the write's outcome unknown; the stored
// blob says whether it landed.
async function reconcileAmbiguousPut(
  client: SyncAPIClient,
  sessionToken: string,
  input: BlobPutInput,
  result: { ok: true; blob: SyncBlobRecord } | SyncAPIFailure,
): Promise<{ ok: true; blob: SyncBlobRecord } | SyncAPIFailure> {
  if (
    result.ok ||
    (result.errorCode !== "network_failed" && result.errorCode !== "server_busy")
  ) {
    return result;
  }
  const stored = await client.getBlob(sessionToken);
  return stored.ok && isSameBlob(stored.blob, input) ? stored : result;
}

function isSameBlob(blob: SyncBlobRecord, input: BlobPutInput): boolean {
  return (
    blob.generation === input.generation &&
    blob.checksumSHA256.toLowerCase() === input.checksumSHA256.toLowerCase()
  );
}

function encodeEncryptedEnvelope(envelope: EncryptedSyncEnvelope): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(envelope));
}

function decodeEncryptedEnvelope(ciphertextBytes: Uint8Array): EncryptedSyncEnvelope {
  const parsed = JSON.parse(new TextDecoder().decode(ciphertextBytes)) as Partial<EncryptedSyncEnvelope>;
  if (
    parsed?.algorithm !== "xchacha20poly1305" ||
    typeof parsed.nonceHex !== "string" ||
    typeof parsed.ciphertextHex !== "string"
  ) {
    throw new Error("invalid_encrypted_envelope");
  }

  return parsed as EncryptedSyncEnvelope;
}

function mapConnectAPIError(errorCode: SyncAPIErrorCode): SyncConnectErrorCode {
  switch (errorCode) {
    case "invalid_registration_input":
    case "registration_failed":
    case "registration_disabled":
    case "invalid_credentials":
    case "unauthorized":
    case "too_many_devices":
    case "rate_limited":
    case "network_failed":
      return errorCode;
    case "sync_disabled":
      return "sync_not_allowed";
    // The device id is generated locally, so the label is what failed.
    case "invalid_device":
      return "device_label_invalid_length";
    case "server_busy":
      return "network_failed";
    default:
      return "generic";
  }
}

function mapManagedConnectAPIError(
  errorCode: ManagedCloudAPIErrorCode,
): SyncConnectErrorCode {
  switch (errorCode) {
    case "invalid_registration_input":
    case "registration_failed":
    case "invalid_credentials":
    case "unauthorized":
    case "sync_not_allowed":
    case "rate_limited":
    case "network_failed":
      return errorCode;
    case "sync_bridge_unavailable":
      return "network_failed";
    default:
      return "generic";
  }
}

function mapRecoverAPIError(errorCode: SyncAPIErrorCode): SyncRecoverErrorCode {
  switch (errorCode) {
    case "invalid_credentials":
    case "unauthorized":
    case "too_many_devices":
    case "rate_limited":
    case "network_failed":
    case "recovery_package_not_found":
      return errorCode;
    case "sync_disabled":
      return "sync_not_allowed";
    case "invalid_device":
      return "device_label_invalid_length";
    case "server_busy":
      return "network_failed";
    default:
      return "generic";
  }
}

function mapManagedRecoverAPIError(
  errorCode: ManagedCloudAPIErrorCode,
): SyncRecoverErrorCode {
  switch (errorCode) {
    case "invalid_credentials":
    case "unauthorized":
    case "sync_not_allowed":
    case "rate_limited":
    case "network_failed":
      return errorCode;
    case "sync_bridge_unavailable":
      return "network_failed";
    default:
      return "generic";
  }
}

function mapRunAPIError(errorCode: SyncAPIErrorCode): SyncRunErrorCode {
  switch (errorCode) {
    case "unauthorized":
    case "invalid_blob":
    case "stale_generation":
    case "blob_not_found":
    case "rate_limited":
    case "server_busy":
    case "network_failed":
    case "managed_recovery_key_overwrite":
      return errorCode;
    case "sync_disabled":
      return "sync_not_allowed";
    default:
      return "generic";
  }
}

function mapManagedRunAPIError(
  errorCode: ManagedCloudAPIErrorCode,
): SyncRunErrorCode {
  switch (errorCode) {
    case "unauthorized":
    case "sync_not_allowed":
    case "rate_limited":
    case "network_failed":
      return errorCode;
    case "sync_bridge_unavailable":
      return "network_failed";
    default:
      return "generic";
  }
}

type RecoveryKeyStepUpErrorCode =
  | "recovery_key_step_up_required"
  | "recovery_key_code_required"
  | "invalid_current_password"
  | "totp_invalid_code"
  | "totp_replayed"
  | "recovery_key_step_up_rate_limited";

function isRecoveryKeyStepUpCode(
  code: SyncAPIErrorCode | RecoveryKeyStepUpErrorCode,
): code is RecoveryKeyStepUpErrorCode {
  switch (code) {
    case "recovery_key_step_up_required":
    case "recovery_key_code_required":
    case "invalid_current_password":
    case "totp_invalid_code":
    case "totp_replayed":
    case "recovery_key_step_up_rate_limited":
      return true;
    default:
      return false;
  }
}

// A community server re-verifies the account before it replaces a stored
// package (the same package is a no-op). Without a step-up its refusal means
// "ask for one", not "wrong"; with one it judges what was sent. Managed
// sessions are exempt server-side, so they never see these answers.
async function syncRecoveryKeyIfSupported(
  client: SyncAPIClient,
  sessionToken: string,
  capabilities: SyncCapabilityDocument,
  wrappedKey: SyncSecretsRecord["wrappedKey"],
  stepUp?: SyncRecoveryKeyStepUp,
): Promise<
  | { ok: true }
  | { ok: false; errorCode: SyncAPIErrorCode | RecoveryKeyStepUpErrorCode }
> {
  if (!capabilities.recoverySupported) {
    return { ok: true };
  }

  const recoveryKeyResult = await client.putRecoveryKey(
    sessionToken,
    wrappedKey,
    stepUp,
  );
  if (recoveryKeyResult.ok) {
    return { ok: true };
  }

  const errorCode = recoveryKeyResult.errorCode;
  const codeSent = (stepUp?.code?.trim() ?? "").length > 0;
  switch (errorCode) {
    case "invalid_current_password":
      return {
        ok: false,
        errorCode: stepUp ? errorCode : "recovery_key_step_up_required",
      };
    case "totp_invalid_code":
    case "totp_replayed":
      return {
        ok: false,
        errorCode: !stepUp
          ? "recovery_key_step_up_required"
          : codeSent
            ? errorCode
            : "recovery_key_code_required",
      };
    // The step-up bucket answers 429 after repeated wrong passwords.
    case "rate_limited":
      return {
        ok: false,
        errorCode: stepUp ? "recovery_key_step_up_rate_limited" : errorCode,
      };
    default:
      return { ok: false, errorCode };
  }
}

/**
 * Interim guard until the server writes the package and the blob atomically:
 * a package write lands only when the blob after it can still be accepted, so
 * a failed upload never leaves the old backup under a package that wraps a new
 * key. An unchanged package is not rewritten. A different stored package is
 * replaced only by a device that has not uploaded under its key yet (the
 * fresh-install overwrite confirm and the step-up still gate it); a device
 * that has uploaded holds the key it published, so a different package there
 * was replaced elsewhere and must be recovered, not overwritten.
 */
async function syncRecoveryKeyBeforeBlob(
  client: SyncAPIClient,
  sessionToken: string,
  capabilities: SyncCapabilityDocument,
  wrappedKey: SyncSecretsRecord["wrappedKey"],
  upload: {
    generation: number;
    rollbackFloor: number | null;
    // undefined = not probed yet; null = the server holds no blob.
    remoteBlob: SyncBlobRecord | null | undefined;
  },
  stepUp?: SyncRecoveryKeyStepUp,
): Promise<
  | { ok: true }
  | {
      ok: false;
      errorCode:
        | SyncAPIErrorCode
        | RecoveryKeyStepUpErrorCode
        | "recovery_key_changed_elsewhere";
    }
> {
  if (!capabilities.recoverySupported) {
    return { ok: true };
  }

  const stored = await client.getRecoveryKey(sessionToken);
  if (stored.ok) {
    if (isSameRecoveryKeyPackage(stored.recoveryKey, wrappedKey)) {
      return { ok: true };
    }
    if (upload.rollbackFloor !== null) {
      return { ok: false, errorCode: "recovery_key_changed_elsewhere" };
    }
  } else if (stored.errorCode !== "recovery_package_not_found") {
    return { ok: false, errorCode: stored.errorCode };
  }

  let remoteBlob = upload.remoteBlob;
  if (remoteBlob === undefined) {
    const remoteBlobResult = await client.getBlob(sessionToken);
    if (!remoteBlobResult.ok && remoteBlobResult.errorCode !== "blob_not_found") {
      return { ok: false, errorCode: remoteBlobResult.errorCode };
    }
    remoteBlob = remoteBlobResult.ok ? remoteBlobResult.blob : null;
  }
  // The server accepts only a strictly higher generation.
  if (remoteBlob !== null && upload.generation <= remoteBlob.generation) {
    return { ok: false, errorCode: "stale_generation" };
  }

  return syncRecoveryKeyIfSupported(
    client,
    sessionToken,
    capabilities,
    wrappedKey,
    stepUp,
  );
}

// Mirrors the server's normalisation before its whole-package no-op check.
function isSameRecoveryKeyPackage(
  stored: SyncSecretsRecord["wrappedKey"],
  local: SyncSecretsRecord["wrappedKey"],
): boolean {
  const normalize = (value: string) => value.trim().toLowerCase();
  return (
    normalize(stored.algorithm) === normalize(local.algorithm) &&
    normalize(stored.kdf) === normalize(local.kdf) &&
    stored.mnemonicWordCount === local.mnemonicWordCount &&
    normalize(stored.wrapNonceHex) === normalize(local.wrapNonceHex) &&
    normalize(stored.wrappedMasterKeyHex) === normalize(local.wrappedMasterKeyHex) &&
    normalize(stored.phraseFingerprintHex) === normalize(local.phraseFingerprintHex)
  );
}

async function putRecoveryKeyWithoutStepUp(
  client: SyncAPIClient,
  sessionToken: string,
  capabilities: SyncCapabilityDocument,
  wrappedKey: SyncSecretsRecord["wrappedKey"],
): Promise<{ ok: true } | { ok: false; errorCode: SyncAPIErrorCode }> {
  if (!capabilities.recoverySupported) {
    return { ok: true };
  }
  const result = await client.putRecoveryKey(sessionToken, wrappedKey);
  return result.ok ? { ok: true } : { ok: false, errorCode: result.errorCode };
}

function buildManagedCapabilitiesDocument(
  syncAllowed: boolean,
): SyncCapabilityDocument {
  return {
    mode: "managed",
    syncEnabled: syncAllowed,
    recoverySupported: true,
    pushSupported: false,
    portalSupported: false,
    advancedCloudInsights: false,
    maxDevices: 5,
    maxBlobBytes: 16 << 20,
  };
}
