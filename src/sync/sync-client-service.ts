import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { fromByteArray, toByteArray } from "base64-js";

import {
  createRecoveredSyncSecretsRecord,
  decryptSyncPayload,
  encryptSyncPayload,
  isValidRecoveryPhrase,
} from "../security/sync-crypto";
import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  normalizeSyncEndpoint,
  type NormalizeSyncEndpointErrorCode,
} from "./sync-endpoint-policy";
import type {
  EncryptedSyncEnvelope,
  SyncCapabilityDocument,
  SyncPreferencesRecord,
  SyncSecretsRecord,
  SyncSetupStatus,
} from "./sync-contract";
import {
  createDefaultSyncPreferencesRecord,
  supportsInlineSyncAccountAuth,
} from "./sync-contract";
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
  | "managed_inline_auth_disabled"
  | "sync_not_prepared"
  | "login_required"
  | "password_required"
  | "invalid_registration_input"
  | "registration_failed"
  | "invalid_credentials"
  | "unauthorized"
  | "too_many_devices"
  | "network_failed"
  | "generic";

export type SyncRecoverErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "managed_inline_auth_disabled"
  | "device_label_required"
  | "recovery_phrase_required"
  | "invalid_recovery_phrase"
  | "recovery_not_available"
  | "recovery_package_not_found"
  | "login_required"
  | "password_required"
  | "invalid_credentials"
  | "unauthorized"
  | "too_many_devices"
  | "network_failed"
  | "generic";

export type SyncRunErrorCode =
  | "sync_not_prepared"
  | "not_connected"
  | "unauthorized"
  | "blob_not_found"
  | "invalid_blob"
  | "stale_generation"
  | "invalid_payload"
  | "network_failed"
  | "generic";

type SyncAPIClientFactory = (baseURL: string) => SyncAPIClient;

export async function connectSyncAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  credentials: { login: string; password: string },
  mode: "register" | "login",
  now: Date,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
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
  if (!supportsInlineSyncAccountAuth(preferences.mode)) {
    return { ok: false, errorCode: "managed_inline_auth_disabled" };
  }

  const login = credentials.login.trim();
  if (login.length === 0) {
    return { ok: false, errorCode: "login_required" };
  }
  if (credentials.password.length === 0) {
    return { ok: false, errorCode: "password_required" };
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
  if (!supportsInlineSyncAccountAuth(preferences.mode)) {
    return { ok: false, errorCode: "managed_inline_auth_disabled" };
  }

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
  const prepared = await readPreparedSyncContext(secretStore, preferences);
  if (!prepared.ok) {
    return prepared;
  }

  const snapshot = await buildSyncSnapshot(storage, now);
  const payload = encodeSyncSnapshot(snapshot);
  const encryptedEnvelope = encryptSyncPayload(prepared.secrets.masterKeyHex, payload);
  const ciphertextBytes = encodeEncryptedEnvelope(encryptedEnvelope);
  const checksumSHA256 = bytesToHex(sha256(ciphertextBytes));
  const generation = nextRemoteGeneration(preferences, now);

  const client = apiClientFactory(prepared.baseURL);
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
  const prepared = await readPreparedSyncContext(secretStore, preferences);
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
  if (secrets) {
    await secretStore.writeSyncSecrets({
      ...secrets,
      authSessionToken: null,
    });
  }

  const nextPreferences: SyncPreferencesRecord = {
    ...preferences,
    setupStatus: secrets ? "local_ready" : "not_configured",
  };
  await storage.writeSyncPreferencesRecord(nextPreferences);

  return nextPreferences;
}

async function readPreparedSyncContext(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
): Promise<
  | {
      ok: true;
      baseURL: string;
      secrets: SyncSecretsRecord & { authSessionToken: string };
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
  if (!secrets.authSessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  return {
    ok: true,
    baseURL: normalizedEndpoint.endpoint.baseURL,
    secrets: {
      ...secrets,
      authSessionToken: secrets.authSessionToken,
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
