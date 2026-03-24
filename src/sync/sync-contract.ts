const runtimeEnv =
  typeof globalThis === "object" && "process" in globalThis
    ? (
        globalThis as {
          process?: {
            env?: Record<string, string | undefined>;
          };
        }
      ).process?.env
    : undefined;

const compileTimeSyncBaseURL =
  typeof process !== "undefined"
    ? process.env.EXPO_PUBLIC_OVUMCY_SYNC_BASE_URL
    : undefined;
const compileTimeManagedBaseURL =
  typeof process !== "undefined"
    ? process.env.EXPO_PUBLIC_OVUMCY_MANAGED_BASE_URL
    : undefined;

function resolvePublicBaseURL(
  compileTimeValue: string | undefined,
  runtimeKey: "EXPO_PUBLIC_OVUMCY_SYNC_BASE_URL" | "EXPO_PUBLIC_OVUMCY_MANAGED_BASE_URL",
  fallback: string,
): string {
  return compileTimeValue?.trim() || runtimeEnv?.[runtimeKey]?.trim() || fallback;
}

export const MANAGED_SYNC_BASE_URL =
  resolvePublicBaseURL(
    compileTimeSyncBaseURL,
    "EXPO_PUBLIC_OVUMCY_SYNC_BASE_URL",
    "https://sync.ovumcy.cloud",
  );
export const MANAGED_CLOUD_AUTH_BASE_URL =
  resolvePublicBaseURL(
    compileTimeManagedBaseURL,
    "EXPO_PUBLIC_OVUMCY_MANAGED_BASE_URL",
    "https://managed.ovumcy.cloud",
  );

export const SUPPORTED_SYNC_MODES = ["managed", "self_hosted"] as const;
export const SUPPORTED_SYNC_SETUP_STATUSES = [
  "not_configured",
  "local_ready",
  "connected",
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
  lastRemoteGeneration: number | null;
  lastSyncedAt: string | null;
};

export type SyncAuthResult = {
  accountID: string;
  sessionToken: string;
  sessionExpiresAt: string;
};

export type SyncCapabilityDocument = {
  mode: SyncMode;
  syncEnabled: boolean;
  premiumActive: boolean;
  recoverySupported: boolean;
  pushSupported: boolean;
  portalSupported: boolean;
  advancedCloudInsights: boolean;
  maxDevices: number;
  maxBlobBytes: number;
};

export type SyncDeviceRecord = {
  deviceID: string;
  deviceLabel: string;
  createdAt: string;
  lastSeenAt: string;
};

export type SyncBlobRecord = {
  schemaVersion: number;
  generation: number;
  checksumSHA256: string;
  ciphertextBase64: string;
  ciphertextSize: number;
  updatedAt: string;
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
  managedAuthSessionToken: string | null;
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

export function supportsInlineSyncAccountAuth(mode: SyncMode): boolean {
  return mode === "managed" || mode === "self_hosted";
}

export function createDefaultSyncPreferencesRecord(): SyncPreferencesRecord {
  return {
    mode: "managed",
    endpointInput: "",
    normalizedEndpoint: MANAGED_SYNC_BASE_URL,
    deviceLabel: "",
    setupStatus: "not_configured",
    preparedAt: null,
    lastRemoteGeneration: null,
    lastSyncedAt: null,
  };
}
