export const MANAGED_SYNC_BASE_URL = "https://sync.ovumcy.com";

export const SUPPORTED_SYNC_MODES = ["managed", "self_hosted"] as const;
export const SUPPORTED_SYNC_SETUP_STATUSES = [
  "not_configured",
  "local_ready",
] as const;

export type SyncMode = (typeof SUPPORTED_SYNC_MODES)[number];
export type SyncSetupStatus = (typeof SUPPORTED_SYNC_SETUP_STATUSES)[number];

export type NormalizedSyncEndpoint = {
  mode: SyncMode;
  baseURL: string;
  host: string;
  isLocalNetwork: boolean;
  isSecure: boolean;
};

export type SyncPreferencesRecord = {
  mode: SyncMode;
  endpointInput: string;
  normalizedEndpoint: string;
  deviceLabel: string;
  setupStatus: SyncSetupStatus;
  preparedAt: string | null;
};

export type SyncDeviceIdentity = {
  deviceID: string;
  deviceLabel: string;
  createdAt: string;
};

export type WrappedSyncKeyMetadata = {
  algorithm: "xchacha20poly1305";
  kdf: "bip39_seed_hkdf_sha256";
  mnemonicWordCount: 12;
  wrapNonceHex: string;
  wrappedMasterKeyHex: string;
  phraseFingerprintHex: string;
};

export type EncryptedSyncEnvelope = {
  algorithm: "xchacha20poly1305";
  nonceHex: string;
  ciphertextHex: string;
};

export type SyncSecretsRecord = {
  device: SyncDeviceIdentity;
  masterKeyHex: string;
  deviceSecretHex: string;
  wrappedKey: WrappedSyncKeyMetadata;
  authSessionToken: string | null;
};

export function normalizeSyncMode(
  value: string | null | undefined,
): SyncMode {
  return SUPPORTED_SYNC_MODES.includes(value as SyncMode)
    ? (value as SyncMode)
    : "managed";
}

export function normalizeSyncSetupStatus(
  value: string | null | undefined,
): SyncSetupStatus {
  return SUPPORTED_SYNC_SETUP_STATUSES.includes(value as SyncSetupStatus)
    ? (value as SyncSetupStatus)
    : "not_configured";
}

export function createDefaultSyncPreferencesRecord(): SyncPreferencesRecord {
  return {
    mode: "managed",
    endpointInput: "",
    normalizedEndpoint: MANAGED_SYNC_BASE_URL,
    deviceLabel: "",
    setupStatus: "not_configured",
    preparedAt: null,
  };
}
