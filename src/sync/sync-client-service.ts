import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { fromByteArray, toByteArray } from "base64-js";

import {
  buildSyncPayloadAad,
  createRecoveredSyncSecretsRecord,
  decryptSyncPayload,
  encryptSyncPayload,
  isValidRecoveryPhrase,
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
import { isPasswordTooShort } from "./password-policy";
import type {
  EncryptedSyncEnvelope,
  SyncCapabilityDocument,
  SyncPreferencesRecord,
  SyncSecretsRecord,
  SyncSetupStatus,
} from "./sync-contract";
import {
  MANAGED_CLOUD_AUTH_BASE_URL,
  createDefaultSyncPreferencesRecord,
} from "./sync-contract";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIClient,
  type ManagedCloudAPIErrorCode,
} from "./managed-cloud-api-client";
import {
  createSyncAPIClient,
  type SyncAPIClient,
  type SyncAPIErrorCode,
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
  | "sync_not_allowed"
  | "invalid_registration_input"
  | "registration_failed"
  | "invalid_credentials"
  | "unauthorized"
  | "too_many_devices"
  | "network_failed"
  | "generic";

export type SyncRecoverErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "device_label_required"
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
  | "invalid_payload"
  | "upload_over_backup_declined"
  | "network_failed"
  | "generic";

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

    await secretStore.writeSyncSecrets({
      ...secrets,
      authSessionToken: null,
      managedAuthSessionToken: authResult.auth.sessionToken,
    });

    const nextPreferences: SyncPreferencesRecord = {
      ...preferences,
      normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
      setupStatus: "connected",
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

  const capabilitiesResult = await client.getCapabilities(authResult.auth.sessionToken);
  if (!capabilitiesResult.ok) {
    return {
      ok: false,
      errorCode: mapConnectAPIError(capabilitiesResult.errorCode),
    };
  }

  const attachDeviceResult = await client.attachDevice(authResult.auth.sessionToken, {
    deviceID: secrets.device.deviceID,
    deviceLabel: secrets.device.deviceLabel,
  });
  if (!attachDeviceResult.ok) {
    return {
      ok: false,
      errorCode: mapConnectAPIError(attachDeviceResult.errorCode),
    };
  }

  const syncedRecoveryKey = await syncRecoveryKeyIfSupported(
    client,
    authResult.auth.sessionToken,
    capabilitiesResult.capabilities,
    secrets.wrappedKey,
  );
  if (!syncedRecoveryKey.ok) {
    return {
      ok: false,
      errorCode: mapConnectAPIError(syncedRecoveryKey.errorCode),
    };
  }

  await secretStore.writeSyncSecrets({
    ...secrets,
    authSessionToken: authResult.auth.sessionToken,
  });

  const nextPreferences: SyncPreferencesRecord = {
    ...preferences,
    normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
    setupStatus: "connected",
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
  input: { sessionToken: string },
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
    });

    const nextPreferences: SyncPreferencesRecord = {
      ...preferences,
      normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
      setupStatus: "connected",
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

  const syncedRecoveryKey = await syncRecoveryKeyIfSupported(
    client,
    input.sessionToken,
    capabilitiesResult.capabilities,
    secrets.wrappedKey,
  );
  if (!syncedRecoveryKey.ok) {
    return {
      ok: false,
      errorCode: mapConnectAPIError(syncedRecoveryKey.errorCode),
    };
  }

  await secretStore.writeSyncSecrets({
    ...secrets,
    authSessionToken: input.sessionToken,
  });

  const nextPreferences: SyncPreferencesRecord = {
    ...preferences,
    normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
    setupStatus: "connected",
  };
  await storage.writeSyncPreferencesRecord(nextPreferences);

  return {
    ok: true,
    capabilities: capabilitiesResult.capabilities,
    preferences: nextPreferences,
  };
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
    const sessionResult = await managedClient.getSession(
      secrets.managedAuthSessionToken,
    );
    if (!sessionResult.ok) {
      if (sessionResult.errorCode === "unauthorized") {
        await secretStore.writeSyncSecrets({
          ...secrets,
          authSessionToken: null,
          managedAuthSessionToken: null,
        });
      }
      return {
        ok: false,
        errorCode: mapManagedConnectAPIError(sessionResult.errorCode),
      };
    }

    if (secrets.authSessionToken) {
      await secretStore.writeSyncSecrets({
        ...secrets,
        authSessionToken: sessionResult.session.entitlement.syncAllowed
          ? secrets.authSessionToken
          : null,
      });
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
  | {
      ok: true;
      capabilities: SyncCapabilityDocument;
      preferences: SyncPreferencesRecord;
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

    await secretStore.writeSyncSecrets({
      ...recoveredSecrets,
      authSessionToken: syncSessionResult.auth.sessionToken,
      managedAuthSessionToken: authResult.auth.sessionToken,
    });

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

  const capabilitiesResult = await client.getCapabilities(authResult.auth.sessionToken);
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

  const recoveryKeyResult = await client.getRecoveryKey(authResult.auth.sessionToken);
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

  const attachDeviceResult = await client.attachDevice(authResult.auth.sessionToken, {
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
    authSessionToken: authResult.auth.sessionToken,
  });

  const nextPreferences: SyncPreferencesRecord = {
    ...createDefaultSyncPreferencesRecord(),
    ...preferences,
    deviceLabel: preferences.deviceLabel.trim(),
    endpointInput:
      preferences.mode === "self_hosted" ? preferences.endpointInput.trim() : "",
    normalizedEndpoint: normalizedEndpoint.endpoint.baseURL,
    setupStatus: "connected",
    preparedAt: now.toISOString(),
    lastRemoteGeneration: null,
    lastSyncedAt: null,
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
): Promise<
  | {
      ok: true;
      preferences: SyncPreferencesRecord;
    }
  | {
      ok: false;
      errorCode: SyncRunErrorCode;
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

  // Fresh-install guard: probe the server for an existing backup before this
  // never-synced device is allowed to overwrite it. The probe runs only when
  // lastRemoteGeneration is null, so steady-state uploads pay no extra
  // request. Fail closed on probe errors other than "no blob yet": if the
  // remote state is unknown, overwriting is exactly the risk being guarded.
  if (preferences.lastRemoteGeneration === null) {
    const remoteBlobResult = await client.getBlob(prepared.secrets.authSessionToken);
    if (!remoteBlobResult.ok && remoteBlobResult.errorCode !== "blob_not_found") {
      return { ok: false, errorCode: mapRunAPIError(remoteBlobResult.errorCode) };
    }

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
  const encryptedEnvelope = encryptSyncPayload(
    prepared.secrets.masterKeyHex,
    payload,
    buildSyncPayloadAad(prepared.secrets.device.deviceID),
  );
  const ciphertextBytes = encodeEncryptedEnvelope(encryptedEnvelope);
  const checksumSHA256 = bytesToHex(sha256(ciphertextBytes));
  const generation = nextRemoteGeneration(preferences, now);

  const capabilitiesResult = await client.getCapabilities(prepared.secrets.authSessionToken);
  if (capabilitiesResult.ok) {
    const syncedRecoveryKey = await syncRecoveryKeyIfSupported(
      client,
      prepared.secrets.authSessionToken,
      capabilitiesResult.capabilities,
      prepared.secrets.wrappedKey,
    );
    if (!syncedRecoveryKey.ok) {
      return { ok: false, errorCode: mapRunAPIError(syncedRecoveryKey.errorCode) };
    }
  } else if (capabilitiesResult.errorCode === "unauthorized") {
    return { ok: false, errorCode: "unauthorized" };
  }

  const putBlobResult = await client.putBlob(prepared.secrets.authSessionToken, {
    schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
    generation,
    checksumSHA256,
    ciphertextBase64: fromByteArray(ciphertextBytes),
  });
  if (!putBlobResult.ok) {
    return { ok: false, errorCode: mapRunAPIError(putBlobResult.errorCode) };
  }

  const nextPreferences = buildSyncedPreferences(
    preferences,
    putBlobResult.blob.generation,
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
): Promise<
  | {
      ok: true;
      preferences: SyncPreferencesRecord;
    }
  | {
      ok: false;
      errorCode: SyncRunErrorCode;
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
    return { ok: false, errorCode: mapRunAPIError(blobResult.errorCode) };
  }

  let encryptedEnvelope: EncryptedSyncEnvelope;
  let decryptedPayload: Uint8Array;
  try {
    encryptedEnvelope = decodeEncryptedEnvelope(
      toByteArray(blobResult.blob.ciphertextBase64),
    );
    decryptedPayload = decryptSyncPayload(
      prepared.secrets.masterKeyHex,
      encryptedEnvelope,
      buildSyncPayloadAad(prepared.secrets.device.deviceID),
    );
  } catch {
    return { ok: false, errorCode: "invalid_payload" };
  }

  let snapshot;
  try {
    snapshot = decodeSyncSnapshot(decryptedPayload);
  } catch {
    return { ok: false, errorCode: "invalid_payload" };
  }

  const nextPreferences = buildSyncedPreferences(
    preferences,
    blobResult.blob.generation,
    blobResult.blob.updatedAt,
    "connected",
  );
  await restoreSyncSnapshot(storage, snapshot, nextPreferences);

  return { ok: true, preferences: nextPreferences };
}

export async function disconnectSyncAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<{ ok: true; preferences: SyncPreferencesRecord }> {
  const secrets = await secretStore.readSyncSecrets();
  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );

  if (secrets?.authSessionToken && normalizedEndpoint.ok) {
    const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
    await client.logout(secrets.authSessionToken);
  }
  if (secrets?.managedAuthSessionToken && preferences.mode === "managed") {
    const managedClient = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    await managedClient.logout(secrets.managedAuthSessionToken);
  }

  const nextPreferences = await clearLocalSyncSession(
    storage,
    secretStore,
    preferences,
  );

  return { ok: true, preferences: nextPreferences };
}

export async function clearLocalSyncSession(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
): Promise<SyncPreferencesRecord> {
  const secrets = await secretStore.readSyncSecrets();
  const nextManagedAuthSessionToken =
    preferences.mode === "managed" ? null : secrets?.managedAuthSessionToken ?? null;
  if (secrets) {
    await secretStore.writeSyncSecrets({
      ...secrets,
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
    const sessionResult = await managedClient.getSession(
      secrets.managedAuthSessionToken,
    );
    if (!sessionResult.ok) {
      if (sessionResult.errorCode === "unauthorized") {
        await secretStore.writeSyncSecrets({
          ...secrets,
          authSessionToken: null,
          managedAuthSessionToken: null,
        });
        return { ok: false, errorCode: "unauthorized" };
      }

      return {
        ok: false,
        errorCode: mapManagedRunAPIError(sessionResult.errorCode),
      };
    }
    if (!sessionResult.session.entitlement.syncAllowed) {
      await secretStore.writeSyncSecrets({
        ...secrets,
        authSessionToken: null,
      });
      return { ok: false, errorCode: "sync_not_allowed" };
    }

    const syncSessionResult = await managedClient.createSyncSession(
      secrets.managedAuthSessionToken,
    );
    if (!syncSessionResult.ok) {
      return {
        ok: false,
        errorCode: mapManagedRunAPIError(syncSessionResult.errorCode),
      };
    }

    await secretStore.writeSyncSecrets({
      ...secrets,
      authSessionToken: syncSessionResult.auth.sessionToken,
    });

    return {
      ok: true,
      baseURL: normalizedEndpoint.endpoint.baseURL,
      secrets: {
        ...secrets,
        authSessionToken: syncSessionResult.auth.sessionToken,
        managedAuthSessionToken: secrets.managedAuthSessionToken,
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

function nextRemoteGeneration(
  preferences: SyncPreferencesRecord,
  now: Date,
): number {
  const nowGeneration = now.getTime();
  if (
    typeof preferences.lastRemoteGeneration === "number" &&
    Number.isFinite(preferences.lastRemoteGeneration)
  ) {
    return Math.max(nowGeneration, preferences.lastRemoteGeneration + 1);
  }

  return nowGeneration;
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
    case "invalid_credentials":
    case "unauthorized":
    case "too_many_devices":
    case "network_failed":
      return errorCode;
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
    case "network_failed":
    case "recovery_package_not_found":
      return errorCode;
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
    case "network_failed":
      return errorCode;
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
    case "network_failed":
      return errorCode;
    case "sync_bridge_unavailable":
      return "network_failed";
    default:
      return "generic";
  }
}

async function syncRecoveryKeyIfSupported(
  client: SyncAPIClient,
  sessionToken: string,
  capabilities: SyncCapabilityDocument,
  wrappedKey: SyncSecretsRecord["wrappedKey"],
): Promise<
  | { ok: true }
  | { ok: false; errorCode: SyncAPIErrorCode }
> {
  if (!capabilities.recoverySupported) {
    return { ok: true };
  }

  const recoveryKeyResult = await client.putRecoveryKey(sessionToken, wrappedKey);
  if (!recoveryKeyResult.ok) {
    return {
      ok: false,
      errorCode: recoveryKeyResult.errorCode,
    };
  }

  return { ok: true };
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
