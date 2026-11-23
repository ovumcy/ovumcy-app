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
  keepManagedSessionOf,
  settleInFlightManagedRefresh,
} from "./managed-session-refresh-service";
import {
  callWithManagedSession,
  type ManagedSessionCallFailure,
} from "./managed-session-call";
import type { EntitlementTokenStore } from "../security/entitlement-token-store";
import { holdAccountChangeRecoveryPhrase } from "./account-change-recovery-phrase";
import { readSyncWipeEpoch } from "./sync-wipe-epoch";
import { entitlementTokenStore as defaultEntitlementTokenStore } from "./app-wipe-scope-secret-stores";
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
  type ManagedCloudAuthFailure,
  type ManagedCloudAuthResult,
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
  // A local wipe landed while the recovery awaited the server.
  | "sync_not_prepared"
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
  // Community server with two-factor on: removal needs the password and a
  // current code; the caller prompts and retries with them.
  | "device_step_up_required"
  | "invalid_current_password"
  | "totp_invalid_code"
  | "totp_replayed"
  | "rate_limited"
  | "network_failed"
  | "generic";

// Seconds the server asked the caller to wait (a 429/503 `Retry-After`).
export type SyncRetryAfter = { retryAfterSeconds?: number };

function withRetryAfter<T extends { ok: false }>(
  failure: T,
  source: SyncAPIFailure | ManagedCloudAuthFailure | { ok: false },
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

/**
 * The rollback floor only proves something about the account it was raised
 * under. A sign-in to any other account, or to one whose id is unknown, starts
 * the floor over, so the next upload probes the server and asks before it
 * overwrites that account's backup.
 */
export function bindSyncPreferencesToAccount(
  preferences: SyncPreferencesRecord,
  accountId: string | null | undefined,
): SyncPreferencesRecord {
  const signedInAccountId =
    typeof accountId === "string" && accountId.length > 0 ? accountId : null;
  if (signedInAccountId !== null && preferences.accountId === signedInAccountId) {
    return preferences;
  }
  return {
    ...preferences,
    accountId: signedInAccountId,
    lastRemoteGeneration: null,
    lastSyncedAt: null,
  };
}

/**
 * An unfinished-restore mark protects the backup of the account the restore
 * read. It is dropped only on a sign-in to a known, different account; an
 * unknown signed-in id may be the same account, so the mark stays.
 */
function restoreMarkWriteOptions(
  preferences: SyncPreferencesRecord,
  accountId: string | null | undefined,
): { restoreInProgress: false } | undefined {
  const storedAccountId =
    typeof preferences.accountId === "string" && preferences.accountId.length > 0
      ? preferences.accountId
      : null;
  const signedInAccountId =
    typeof accountId === "string" && accountId.length > 0 ? accountId : null;
  return storedAccountId !== null &&
    signedInAccountId !== null &&
    storedAccountId !== signedInAccountId
    ? { restoreInProgress: false }
    : undefined;
}

async function writeSignedInPreferences(
  storage: LocalAppStorage,
  nextPreferences: SyncPreferencesRecord,
  preferences: SyncPreferencesRecord,
  accountId: string | null | undefined,
): Promise<void> {
  // The stored record, not the caller's copy, holds the account the mark was
  // raised under; the copy is the fallback when storage cannot be read.
  const stored =
    (await storage.readSyncPreferencesRecord().catch(() => null)) ?? preferences;
  const options = restoreMarkWriteOptions(stored, accountId);
  if (options) {
    await storage.writeSyncPreferencesRecord(nextPreferences, options);
  } else {
    await storage.writeSyncPreferencesRecord(nextPreferences);
  }
}

type AccountKeyedSecrets = {
  secrets: SyncSecretsRecord;
  // The new key's phrase, for the gated reveal only; null when the key stays.
  recoveryPhrase: string | null;
};

/**
 * A sync key serves one account. A sign-in to an account other than the one
 * the stored key was last used with replaces the master key, recovery phrase
 * and device identity before anything reaches the server, so the new account
 * never receives the old key's ciphertext, recovery package or device id. A
 * key bound to no account yet (fresh setup, a record written before the
 * binding existed) stays. Recovery never comes here: it adopts the account's
 * own key.
 */
function keySecretsForAccount(
  secrets: SyncSecretsRecord,
  preferences: SyncPreferencesRecord,
  accountId: string | null | undefined,
  now: Date,
): AccountKeyedSecrets {
  const storedAccountId =
    typeof preferences.accountId === "string" && preferences.accountId.length > 0
      ? preferences.accountId
      : null;
  const signedInAccountId =
    typeof accountId === "string" && accountId.length > 0 ? accountId : null;
  if (storedAccountId === null || storedAccountId === signedInAccountId) {
    return { secrets, recoveryPhrase: null };
  }
  const fresh = createSyncSecretsRecord(secrets.device.deviceLabel, now);
  return {
    secrets: {
      ...fresh.record,
      authSessionToken: secrets.authSessionToken,
      managedAuthSessionToken: secrets.managedAuthSessionToken,
      managedAuthSessionExpiresAt: secrets.managedAuthSessionExpiresAt,
      managedRefreshToken: secrets.managedRefreshToken,
      managedRefreshTokenExpiresAt: secrets.managedRefreshTokenExpiresAt,
      recoveryPhraseUnrevealed: true,
    },
    recoveryPhrase: fresh.recoveryPhrase,
  };
}

// Called right after the keyed secrets are written, so the phrase is held for
// exactly the key the device now uses.
function holdNewAccountKeyPhrase(keyed: AccountKeyedSecrets): { accountKeyReset?: true } {
  if (keyed.recoveryPhrase === null) {
    return {};
  }
  holdAccountChangeRecoveryPhrase(keyed.recoveryPhrase, keyed.secrets.masterKeyHex);
  return { accountKeyReset: true };
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
      // Set when the sign-in reached another account and replaced the sync
      // key; its phrase waits in the account-change buffer, never here.
      accountKeyReset?: true;
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
      retryAfterSeconds?: number;
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

  const wipeEpoch = readSyncWipeEpoch();
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
      return withRetryAfter(
        { ok: false, errorCode: mapManagedConnectAPIError(authResult.errorCode) },
        authResult,
      );
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

    const keyed = keySecretsForAccount(
      secrets,
      preferences,
      authResult.auth.accountID,
      now,
    );
    if (readSyncWipeEpoch() !== wipeEpoch) {
      return { ok: false, errorCode: "sync_not_prepared" };
    }
    // New managed session (possibly a different account): drop billing-cache
    // state derived under the previous session BEFORE the new session is
    // stored, so a stop in between never leaves the previous account's
    // snapshot readable as this session's offline grace. The post-connect
    // billing refresh repopulates it.
    await storage.writeManagedBillingCacheRecord(
      createDefaultManagedBillingCacheRecord(),
    );
    await secretStore.writeSyncSecrets(
      applyManagedAuthResultToSecrets(
        { ...keyed.secrets, authSessionToken: null },
        authResult.auth,
      ),
    );
    const keyReset = holdNewAccountKeyPhrase(keyed);

    const nextPreferences: SyncPreferencesRecord = {
      ...bindSyncPreferencesToAccount(preferences, authResult.auth.accountID),
      normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
      setupStatus: "connected",
      // A real register/login/TOTP-finalized session is never a guest —
      // clear any stale marker left by an earlier guest-partner session on
      // this device (see SyncPreferencesRecord.guestSessionExpiresAt).
      guestSessionExpiresAt: null,
      guestSessionRenewable: false,
    };
    await writeSignedInPreferences(storage, nextPreferences, preferences, authResult.auth.accountID);
    await discardPreviousSessionBillingCache(storage);

    const success: {
      ok: true;
      capabilities: SyncCapabilityDocument;
      preferences: SyncPreferencesRecord;
      recoveryCode?: string;
      accountKeyReset?: true;
    } = {
      ok: true,
      capabilities: buildManagedCapabilitiesDocument(
        authResult.auth.entitlement.syncAllowed,
      ),
      preferences: nextPreferences,
      ...keyReset,
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
    return withRetryAfter(
      { ok: false, errorCode: mapConnectAPIError(authResult.errorCode) },
      authResult,
    );
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

  const keyed = keySecretsForAccount(secrets, preferences, authResult.auth.accountID, now);
  const attachDeviceResult = await client.attachDevice(authResult.auth.sessionToken, {
    deviceID: keyed.secrets.device.deviceID,
    deviceLabel: keyed.secrets.device.deviceLabel,
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
      keyed.secrets.wrappedKey,
      { currentPassword: credentials.password },
    );
    // A step-up refusal does not fail the connect: the next upload prompts.
    if (!syncedRecoveryKey.ok && !isRecoveryKeyStepUpCode(syncedRecoveryKey.errorCode)) {
      return failAfterRegister(mapConnectAPIError(syncedRecoveryKey.errorCode));
    }
  }

  const current = await secretStore.readSyncSecrets();
  if (!current || readSyncWipeEpoch() !== wipeEpoch) {
    return failAfterRegister("sync_not_prepared");
  }
  await secretStore.writeSyncSecrets({
    ...keepManagedSessionOf(keyed.secrets, current),
    authSessionToken: authResult.auth.sessionToken,
  });
  const keyReset = holdNewAccountKeyPhrase(keyed);

  const nextPreferences: SyncPreferencesRecord = {
    ...bindSyncPreferencesToAccount(preferences, authResult.auth.accountID),
    normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
    setupStatus: "connected",
    // Self-hosted community sync has no guest-partner concept; clear any
    // stale marker carried over from a prior managed guest session.
    guestSessionExpiresAt: null,
    guestSessionRenewable: false,
  };
  await writeSignedInPreferences(storage, nextPreferences, preferences, authResult.auth.accountID);

  const success: {
    ok: true;
    capabilities: SyncCapabilityDocument;
    preferences: SyncPreferencesRecord;
    recoveryCode?: string;
    accountKeyReset?: true;
  } = {
    ok: true,
    capabilities: capabilitiesResult.capabilities,
    preferences: nextPreferences,
    ...keyReset,
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
    // The self-hosted account the challenge signed in to; managed reads it
    // from the session. Absent, the rollback floor starts over.
    accountID?: string;
  },
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
  now: Date = new Date(),
): Promise<
  | {
      ok: true;
      capabilities: SyncCapabilityDocument;
      preferences: SyncPreferencesRecord;
      // As on connectSyncAccount: the sign-in replaced the sync key.
      accountKeyReset?: true;
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

  const wipeEpoch = readSyncWipeEpoch();
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

    const keyed = keySecretsForAccount(
      secrets,
      preferences,
      sessionResult.session.accountID,
      now,
    );
    if (readSyncWipeEpoch() !== wipeEpoch) {
      return { ok: false, errorCode: "sync_not_prepared" };
    }
    // Same session-boundary purge as the password-only connect path, before
    // the new session is stored.
    await storage.writeManagedBillingCacheRecord(
      createDefaultManagedBillingCacheRecord(),
    );
    await secretStore.writeSyncSecrets({
      ...keyed.secrets,
      authSessionToken: null,
      managedAuthSessionToken: input.sessionToken,
      managedAuthSessionExpiresAt: input.sessionExpiresAt ?? null,
      managedRefreshToken: input.refreshToken ?? null,
      managedRefreshTokenExpiresAt: input.refreshTokenExpiresAt ?? null,
    });
    const keyReset = holdNewAccountKeyPhrase(keyed);

    const nextPreferences: SyncPreferencesRecord = {
      ...bindSyncPreferencesToAccount(preferences, sessionResult.session.accountID),
      normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
      setupStatus: "connected",
      // A real register/login/TOTP-finalized session is never a guest —
      // clear any stale marker left by an earlier guest-partner session on
      // this device (see SyncPreferencesRecord.guestSessionExpiresAt).
      guestSessionExpiresAt: null,
      guestSessionRenewable: false,
    };
    await writeSignedInPreferences(storage, nextPreferences, preferences, sessionResult.session.accountID);
    await discardPreviousSessionBillingCache(storage);

    return {
      ok: true,
      capabilities: buildManagedCapabilitiesDocument(
        sessionResult.session.entitlement.syncAllowed,
      ),
      preferences: nextPreferences,
      ...keyReset,
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

  const keyed = keySecretsForAccount(secrets, preferences, input.accountID, now);
  const attachDeviceResult = await client.attachDevice(input.sessionToken, {
    deviceID: keyed.secrets.device.deviceID,
    deviceLabel: keyed.secrets.device.deviceLabel,
  });
  if (!attachDeviceResult.ok) {
    return {
      ok: false,
      errorCode: mapConnectAPIError(attachDeviceResult.errorCode),
    };
  }

  // A TOTP challenge only follows a login, so the package is left to the
  // upload, as on a login connect.
  const current = await secretStore.readSyncSecrets();
  if (!current || readSyncWipeEpoch() !== wipeEpoch) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }
  await secretStore.writeSyncSecrets({
    ...keepManagedSessionOf(keyed.secrets, current),
    authSessionToken: input.sessionToken,
  });
  const keyReset = holdNewAccountKeyPhrase(keyed);

  const nextPreferences: SyncPreferencesRecord = {
    ...bindSyncPreferencesToAccount(preferences, input.accountID),
    normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
    setupStatus: "connected",
    // Self-hosted community sync has no guest-partner concept; clear any
    // stale marker carried over from a prior managed guest session.
    guestSessionExpiresAt: null,
    guestSessionRenewable: false,
  };
  await writeSignedInPreferences(storage, nextPreferences, preferences, input.accountID);

  return {
    ok: true,
    capabilities: capabilitiesResult.capabilities,
    preferences: nextPreferences,
    ...keyReset,
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
  // Captured by the caller before the accept request went out.
  wipeEpoch: number = readSyncWipeEpoch(),
): Promise<
  | {
      ok: true;
      capabilities: SyncCapabilityDocument;
      preferences: SyncPreferencesRecord;
    }
  | { ok: false; errorCode: "sync_not_prepared" }
> {
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

  // New account boundary (a guest account is always freshly minted): drop
  // any billing-cache state derived under a previous session before the guest
  // session is stored, same as a normal managed connect.
  if (readSyncWipeEpoch() !== wipeEpoch) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }
  await storage.writeManagedBillingCacheRecord(
    createDefaultManagedBillingCacheRecord(),
  );
  await secretStore.writeSyncSecrets({
    ...baseSecrets,
    authSessionToken: null,
    managedAuthSessionToken: input.sessionToken,
    ...refreshFields,
  });

  const nextPreferences: SyncPreferencesRecord = {
    // A guest account is always freshly minted, so the floor of the previous
    // account never carries over. The kept key stays bound to the account it
    // served (a guest has no sync entitlement, so it uploads nothing with it):
    // a later sign-in to any other account still replaces it. A key minted
    // here served no account yet.
    ...preferences,
    accountId: existingSecrets ? preferences.accountId : null,
    lastRemoteGeneration: null,
    lastSyncedAt: null,
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
  await discardPreviousSessionBillingCache(storage);

  return {
    ok: true,
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
      // As on connectSyncAccount: the key last served another account and was
      // replaced; its phrase waits in the account-change buffer.
      accountKeyReset?: true;
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
 *
 * A success binds the device to the upgraded account like a sign-in: a key
 * last used with another account is replaced (its phrase goes to the gated
 * account-change reveal), and a key minted at the guest accept, bound to no
 * account, stays and is bound to this one.
 */
export async function upgradeGuestPartnerAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: { email: string; password: string },
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
  now: Date = new Date(),
): Promise<UpgradeGuestPartnerAccountResult> {
  const wipeEpoch = readSyncWipeEpoch();
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

  // A wipe during the request ended this device's session: nothing is written
  // back, and the screen treats it like any ended session.
  if (readSyncWipeEpoch() !== wipeEpoch) {
    return { ok: false, errorCode: "unauthorized", preferences };
  }

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

  const accountID = result.result.accountID;
  // Re-read: the call may have renewed the session, and keySecretsForAccount
  // carries the record's tokens over.
  const currentSecrets = await secretStore.readSyncSecrets();
  if (readSyncWipeEpoch() !== wipeEpoch) {
    return { ok: false, errorCode: "unauthorized", preferences };
  }
  let keyReset: { accountKeyReset?: true } = {};
  if (currentSecrets) {
    const keyed = keySecretsForAccount(currentSecrets, preferences, accountID, now);
    if (keyed.recoveryPhrase !== null) {
      await secretStore.writeSyncSecrets(keyed.secrets);
      keyReset = holdNewAccountKeyPhrase(keyed);
    }
  }

  const nextPreferences: SyncPreferencesRecord = {
    ...bindSyncPreferencesToAccount(preferences, accountID),
    guestSessionExpiresAt: null,
    guestSessionRenewable: false,
  };
  if (readSyncWipeEpoch() !== wipeEpoch) {
    return { ok: false, errorCode: "unauthorized", preferences };
  }
  await writeSignedInPreferences(storage, nextPreferences, preferences, accountID);

  return {
    ok: true,
    accountID,
    email: result.result.email,
    recoveryCode: result.result.recoveryCode,
    preferences: nextPreferences,
    ...keyReset,
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
      // The password verified but the account has TOTP on.
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
      retryAfterSeconds?: number;
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

  const wipeEpoch = readSyncWipeEpoch();
  if (preferences.mode === "managed") {
    const managedClient = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const authResult = await managedClient.login({
      email: login,
      password: credentials.password,
    });
    if (!authResult.ok) {
      return withRetryAfter(
        { ok: false, errorCode: mapManagedRecoverAPIError(authResult.errorCode) },
        authResult,
      );
    }
    // A deferred login carries no entitlement verdict yet; the resume reads it
    // from the post-challenge session.
    if (authResult.auth.totpChallenge) {
      return {
        ok: true,
        totpChallengeRequired: true,
        challengeID: authResult.auth.totpChallenge.challengeID,
        challengeExpiresAt: authResult.auth.totpChallenge.challengeExpiresAt,
      };
    }
    if (!authResult.auth.entitlement.syncAllowed) {
      return {
        ok: false,
        errorCode: "sync_not_allowed",
      };
    }

    return completeManagedRecovery(
      storage,
      secretStore,
      preferences,
      managedClient,
      apiClientFactory,
      normalizedEndpoint.endpoint.baseURL,
      authResult.auth,
      normalizedRecoveryPhrase,
      now,
      wipeEpoch,
    );
  }

  const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
  const authResult = await client.login({
    login,
    password: credentials.password,
  });
  if (!authResult.ok) {
    return withRetryAfter(
      { ok: false, errorCode: mapRecoverAPIError(authResult.errorCode) },
      authResult,
    );
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
    authResult.auth.accountID,
    normalizedRecoveryPhrase,
    now,
    wipeEpoch,
  );
}

async function completeManagedRecovery(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  managedClient: ManagedCloudAPIClient,
  apiClientFactory: SyncAPIClientFactory,
  baseURL: string,
  managedAuth: ManagedCloudAuthResult,
  normalizedRecoveryPhrase: string,
  now: Date,
  wipeEpoch: number,
): Promise<
  | RecoverSyncAccessSuccess
  | {
      ok: false;
      errorCode: SyncRecoverErrorCode;
    }
> {
  const syncSessionResult = await managedClient.createSyncSession(
    managedAuth.sessionToken,
  );
  if (!syncSessionResult.ok) {
    return {
      ok: false,
      errorCode: mapManagedRecoverAPIError(syncSessionResult.errorCode),
    };
  }

  const client = apiClientFactory(baseURL);
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

  // Recovery establishes a fresh managed session context as well: purge the
  // previous session's billing cache before the recovered session is stored.
  if (readSyncWipeEpoch() !== wipeEpoch) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }
  await storage.writeManagedBillingCacheRecord(
    createDefaultManagedBillingCacheRecord(),
  );
  await secretStore.writeSyncSecrets(
    applyManagedAuthResultToSecrets(
      {
        ...recoveredSecrets,
        authSessionToken: syncSessionResult.auth.sessionToken,
      },
      managedAuth,
    ),
  );

  const nextPreferences: SyncPreferencesRecord = {
    ...createDefaultSyncPreferencesRecord(),
    ...bindSyncPreferencesToAccount(preferences, managedAuth.accountID),
    deviceLabel: preferences.deviceLabel.trim(),
    endpointInput: "",
    normalizedEndpoint: baseURL,
    setupStatus: "connected",
    preparedAt: now.toISOString(),
    lastRemoteGeneration: null,
    lastSyncedAt: null,
    // Recovery authenticates with a real password (the managed login)
    // — a guest account has none, so this path can never actually
    // be reached for a guest. Clear defensively so a stale marker carried
    // in `...preferences` can never survive onto this freshly recovered
    // session.
    guestSessionExpiresAt: null,
    guestSessionRenewable: false,
  };
  await writeSignedInPreferences(storage, nextPreferences, preferences, managedAuth.accountID);
  await discardPreviousSessionBillingCache(storage);

  return {
    ok: true,
    capabilities,
    preferences: nextPreferences,
  };
}

type RecoverSyncAccessSuccess = {
  ok: true;
  capabilities: SyncCapabilityDocument;
  preferences: SyncPreferencesRecord;
};

/**
 * finalizeSyncRecoveryAfterTOTP finishes a phrase recovery whose login
 * `recoverSyncAccess` deferred for a TOTP challenge. The caller completes the
 * challenge (`completeTOTPChallenge` in sync-totp-service) and passes the
 * issued session token with the phrase, both held in memory only. A managed
 * resume also passes the session expiry and refresh pair; without them the
 * recovered session cannot renew.
 */
export async function finalizeSyncRecoveryAfterTOTP(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: {
    sessionToken: string;
    recoveryPhrase: string;
    sessionExpiresAt?: string;
    refreshToken?: string;
    refreshTokenExpiresAt?: string;
    // The self-hosted account the challenge signed in to; managed reads it
    // from the session.
    accountID?: string;
  },
  now: Date,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | RecoverSyncAccessSuccess
  | {
      ok: false;
      errorCode: SyncRecoverErrorCode;
    }
> {
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

  const wipeEpoch = readSyncWipeEpoch();
  if (preferences.mode === "managed") {
    const managedClient = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    // The challenge answer carries no entitlement; the session read is the
    // first verdict on whether this account may sync.
    const sessionResult = await managedClient.getSession(input.sessionToken);
    if (!sessionResult.ok) {
      return {
        ok: false,
        errorCode: mapManagedRecoverAPIError(sessionResult.errorCode),
      };
    }
    const session = sessionResult.session;
    if (!session.entitlement.syncAllowed) {
      return { ok: false, errorCode: "sync_not_allowed" };
    }
    const managedAuth: ManagedCloudAuthResult = {
      accountID: session.accountID,
      email: session.email,
      sessionToken: input.sessionToken,
      sessionExpiresAt: input.sessionExpiresAt || session.sessionExpiresAt,
      entitlement: session.entitlement,
      ...(input.refreshToken !== undefined
        ? { refreshToken: input.refreshToken }
        : {}),
      ...(input.refreshTokenExpiresAt !== undefined
        ? { refreshTokenExpiresAt: input.refreshTokenExpiresAt }
        : {}),
    };
    return completeManagedRecovery(
      storage,
      secretStore,
      preferences,
      managedClient,
      apiClientFactory,
      normalizedEndpoint.endpoint.baseURL,
      managedAuth,
      normalizedRecoveryPhrase,
      now,
      wipeEpoch,
    );
  }

  return completeCommunityRecovery(
    storage,
    secretStore,
    preferences,
    apiClientFactory(normalizedEndpoint.endpoint.baseURL),
    normalizedEndpoint.endpoint.baseURL,
    input.sessionToken,
    input.accountID,
    normalizedRecoveryPhrase,
    now,
    wipeEpoch,
  );
}

async function completeCommunityRecovery(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  client: SyncAPIClient,
  baseURL: string,
  sessionToken: string,
  accountID: string | undefined,
  normalizedRecoveryPhrase: string,
  now: Date,
  wipeEpoch: number,
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

  if (readSyncWipeEpoch() !== wipeEpoch) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }
  await secretStore.writeSyncSecrets({
    ...recoveredSecrets,
    authSessionToken: sessionToken,
  });

  const nextPreferences: SyncPreferencesRecord = {
    ...createDefaultSyncPreferencesRecord(),
    ...bindSyncPreferencesToAccount(preferences, accountID),
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
  await writeSignedInPreferences(storage, nextPreferences, preferences, accountID);

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
  const wipeEpoch = readSyncWipeEpoch();
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
    if (syncedRecoveryKey.replacedPackage && isDefinitiveBlobRefusal(putBlobResult.errorCode)) {
      await putBackReplacedRecoveryKey(
        client,
        prepared.secrets.authSessionToken,
        syncedRecoveryKey.replacedPackage,
        recoveryKeyStepUp,
      );
    }
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
  if (readSyncWipeEpoch() !== wipeEpoch) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }
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
  const wipeEpoch = readSyncWipeEpoch();
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
      if (readSyncWipeEpoch() !== wipeEpoch) {
        return { ok: false, errorCode: "sync_not_prepared" };
      }
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
  if (readSyncWipeEpoch() !== wipeEpoch) {
    return { ok: false, errorCode: "sync_not_prepared" };
  }
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
 * Once two-factor is on, a community server re-confirms the password and a
 * current code: a removal sent without them answers
 * `device_step_up_required`, and the caller prompts and retries. The step-up
 * is never sent to a managed sync host.
 *
 * Removing the device this install registered under revokes the community
 * session bound to it, so the local session is cleared with it and the
 * returned `preferences` carry the signed-out state. The distinct
 * confirmation for that case is owned by the caller.
 */
export async function removeSyncDevice(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  deviceID: string,
  // Held only for this call; never stored or logged.
  stepUp?: SyncRecoveryKeyStepUp,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | {
      ok: true;
      removedCurrentDevice: boolean;
      // Set when the removal ended this device's session.
      preferences: SyncPreferencesRecord | null;
    }
  | {
      ok: false;
      errorCode: SyncDeviceManagementErrorCode;
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
    return {
      ok: false,
      errorCode: mapPreparedContextToDeviceManagementError(prepared.errorCode),
    };
  }

  const selfHosted = preferences.mode === "self_hosted";
  const client = apiClientFactory(prepared.baseURL);
  const removeResult = await client.removeDevice(
    prepared.secrets.authSessionToken,
    { deviceID },
    ...(selfHosted && stepUp ? [stepUp] : []),
  );
  if (!removeResult.ok) {
    if (
      selfHosted &&
      !stepUp &&
      removeResult.errorCode === "invalid_current_password"
    ) {
      return { ok: false, errorCode: "device_step_up_required" };
    }
    return withRetryAfter(
      {
        ok: false,
        errorCode: mapDeviceManagementAPIError(removeResult.errorCode, selfHosted),
      },
      removeResult,
    );
  }

  const removedCurrentDevice = deviceID === prepared.secrets.device.deviceID;
  let signedOutPreferences: SyncPreferencesRecord | null = null;
  if (removedCurrentDevice && selfHosted) {
    try {
      signedOutPreferences = await clearLocalSyncSession(
        storage,
        secretStore,
        preferences,
      );
    } catch {
      // The server already removed the device; the revoked session fails its
      // next call and is cleared there.
    }
  }
  return { ok: true, removedCurrentDevice, preferences: signedOutPreferences };
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
  selfHosted = false,
): SyncDeviceManagementErrorCode {
  switch (errorCode) {
    case "unauthorized":
    case "device_not_found":
    case "rate_limited":
    case "network_failed":
      return errorCode;
    case "invalid_current_password":
    case "totp_invalid_code":
    case "totp_replayed":
      return selfHosted ? errorCode : "generic";
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
): Promise<{
  ok: true;
  preferences: SyncPreferencesRecord;
  remoteSignOut: SyncRemoteSignOut;
}> {
  // The local wipe below must not wait on a slow or hanging server.
  const confirmed = await settleWithin(
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

  return {
    ok: true,
    preferences: nextPreferences,
    remoteSignOut: confirmed === true ? "confirmed" : "unconfirmed",
  };
}

// The local session is cleared either way. "unconfirmed": no answer in time, a
// refusal or a transport failure, so a server session may stay live until it
// expires.
export type SyncRemoteSignOut = "confirmed" | "unconfirmed";

const DISCONNECT_REMOTE_TIMEOUT_MS = 10_000;

async function revokeRemoteSessions(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  apiClientFactory: SyncAPIClientFactory,
  managedClientFactory: ManagedCloudAPIClientFactory,
): Promise<boolean> {
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

  const revocations: Promise<boolean>[] = [];
  if (secrets?.authSessionToken) {
    revocations.push(
      normalizedEndpoint.ok
        ? apiClientFactory(normalizedEndpoint.endpoint.baseURL)
            .logout(secrets.authSessionToken)
            .then(isSignOutConfirmed)
        : Promise.resolve(false),
    );
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
  const outcomes = await Promise.all(revocations);
  return outcomes.every(Boolean);
}

// A 401 means the server holds no live session under that credential.
function isSignOutConfirmed(
  result: { ok: true } | { ok: false; errorCode: string },
): boolean {
  return result.ok || result.errorCode === "unauthorized";
}

async function revokeManagedSession(
  managedClient: ManagedCloudAPIClient,
  credentials: { sessionToken: string | null; refreshToken: string | null },
): Promise<boolean> {
  const result = await managedClient.logout(credentials);
  // A 5xx means the logout rolled back and the family is still live.
  if (!result.ok && result.errorCode === "network_failed") {
    return isSignOutConfirmed(await managedClient.logout(credentials));
  }
  return isSignOutConfirmed(result);
}

async function settleWithin<T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work.catch(() => undefined),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), timeoutMs);
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
  entitlementTokenStore: Pick<
    EntitlementTokenStore,
    "clearEntitlementToken"
  > = defaultEntitlementTokenStore,
): Promise<SyncPreferencesRecord> {
  if (preferences.mode === "managed") {
    endManagedSessionRefresh();
    // The cached entitlement token belongs to the managed session that ends
    // here; cleared before the session itself, so no offline read under a
    // later session can revive it.
    await entitlementTokenStore.clearEntitlementToken();
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

// Second half of the new-session purge: a billing load of the previous session
// that passed its session check before the first reset can still cache its
// snapshot until the new session is stored.
async function discardPreviousSessionBillingCache(
  storage: LocalAppStorage,
): Promise<void> {
  await storage.writeManagedBillingCacheRecord(
    createDefaultManagedBillingCacheRecord(),
  );
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
    const legacy = await client.putBlob(sessionToken, input);
    if (legacy.ok || legacy.errorCode !== "stale_generation") {
      return reconcileAmbiguousPut(client, sessionToken, input, legacy);
    }
    return reconcileStalePut(client, sessionToken, input, undefined, lastSyncedAt);
  }
  if (first.errorCode !== "stale_generation") {
    return reconcileAmbiguousPut(client, sessionToken, input, first);
  }
  return reconcileStalePut(
    client,
    sessionToken,
    input,
    expectedGeneration,
    lastSyncedAt,
  );
}

async function reconcileStalePut(
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
  const stored = await client.getBlob(sessionToken);
  if (!stored.ok) {
    // The remote state is unknown, not proven to be another device's.
    return stored;
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
  // replacedPackage: the different package this call overwrote, if any.
  | { ok: true; replacedPackage: SyncSecretsRecord["wrappedKey"] | null }
  | {
      ok: false;
      errorCode:
        | SyncAPIErrorCode
        | RecoveryKeyStepUpErrorCode
        | "recovery_key_changed_elsewhere";
    }
> {
  if (!capabilities.recoverySupported) {
    return { ok: true, replacedPackage: null };
  }

  const stored = await client.getRecoveryKey(sessionToken);
  if (stored.ok) {
    if (isSameRecoveryKeyPackage(stored.recoveryKey, wrappedKey)) {
      return { ok: true, replacedPackage: null };
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

  const written = await syncRecoveryKeyIfSupported(
    client,
    sessionToken,
    capabilities,
    wrappedKey,
    stepUp,
  );
  if (!written.ok) {
    return written;
  }
  return { ok: true, replacedPackage: stored.ok ? stored.recoveryKey : null };
}

// A refusal the server answered for the blob itself: the blob did not land,
// so the package replaced for it would orphan the backup still stored. A
// network failure, a 5xx or an unmapped answer may hide a blob that landed,
// so the new package stays and a retry heals it.
function isDefinitiveBlobRefusal(errorCode: SyncAPIErrorCode | "remote_backup_changed"): boolean {
  // A stale_generation answer never reaches here: the put reconciles it into
  // remote_backup_changed or into the blob read's own failure.
  switch (errorCode) {
    case "remote_backup_changed":
    case "invalid_blob":
    case "unauthorized":
    case "sync_disabled":
      return true;
    default:
      return false;
  }
}

// Best effort: a refusal (a spent TOTP step-up code is refused as a replay)
// or a failure leaves the new package in place.
async function putBackReplacedRecoveryKey(
  client: SyncAPIClient,
  sessionToken: string,
  replacedPackage: SyncSecretsRecord["wrappedKey"],
  stepUp: SyncRecoveryKeyStepUp | undefined,
): Promise<void> {
  try {
    await client.putRecoveryKey(sessionToken, replacedPackage, stepUp);
  } catch {
    // Nothing further to undo.
  }
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
): Promise<
  { ok: true; replacedPackage: null } | { ok: false; errorCode: SyncAPIErrorCode }
> {
  if (!capabilities.recoverySupported) {
    return { ok: true, replacedPackage: null };
  }
  const result = await client.putRecoveryKey(sessionToken, wrappedKey);
  return result.ok
    ? { ok: true, replacedPackage: null }
    : { ok: false, errorCode: result.errorCode };
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
