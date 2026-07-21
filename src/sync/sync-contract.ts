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
  // pinnedSPKIFingerprints is the set of base64-encoded SHA-256 hashes of
  // leaf certificate Subject Public Key Info (SPKI) values that the connect
  // path will accept for this host. Multiple entries support graceful cert
  // rotation: include the current pin plus the next planned pin so a single
  // rotation does not brick installs that haven't received the next app
  // release.
  //
  // For `self_hosted` endpoints the array carries the owner-entered
  // fingerprint(s) from `cert-pin-store`. Typically one entry; a second can
  // be added by the operator's deployment runbook when they're about to
  // rotate so the app accepts both old and new during the cutover window.
  //
  // For `managed` endpoints the array carries the static pin set baked
  // into the app at build time (see `MANAGED_SYNC_PINNED_SPKI_FINGERPRINTS`
  // / `MANAGED_CLOUD_AUTH_PINNED_SPKI_FINGERPRINTS`). The ovumcy team owns
  // the rotation schedule: each release that touches managed pins must ship
  // current + next so the rotation window spans at least one release cycle.
  //
  // Null (or absent) means the host is in the TOFU bootstrap window — no
  // pin has been entered yet for self-hosted, or the managed constants are
  // intentionally empty during local development against staging.
  pinnedSPKIFingerprints?: readonly string[] | null;
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
  // guestSessionExpiresAt is the ONLY local marker of "this device's managed
  // session was established via guest-partner accept" (see
  // `persistGuestPartnerSession`). Null for every non-guest session. Doubles
  // as the expiry-nudge data source: the guest-partner session dies with no
  // renewal path (single-use invite, no password), so the client surfaces a
  // "save your access" nudge as this approaches. Cleared back to null the
  // moment the account stops being a guest — a real register/login/recover,
  // a disconnect, or a successful `/account/upgrade` — so it can never
  // survive onto a non-guest session.
  guestSessionExpiresAt: string | null;
};

export type SyncAuthResult = {
  accountID: string;
  sessionToken: string;
  sessionExpiresAt: string;
  // refreshToken renews the session without the password. Only the managed
  // cloud issues these; a self-hosted community server has no refresh flow, so
  // its results leave both fields unset and its sessions stay long-lived.
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
  // recoveryCode is the plaintext account-level recovery code. It is set only
  // on register responses; login and managed-bridge sessions never carry it.
  // The app surfaces it exactly once at sync setup and then forgets it.
  recoveryCode?: string;
  // totpChallenge is set ONLY on login responses when the account has TOTP
  // enabled on the server. When present, sessionToken is empty and the caller
  // must complete the challenge through `completeTOTPChallenge` before any
  // session can be used. Register responses never set this field.
  totpChallenge?: SyncTOTPChallengeHandoff;
};

// SyncTOTPChallengeHandoff is the wire shape of a pending TOTP login second
// factor. The challenge id is single-use, short-lived, and must travel via
// memory only — it never gets persisted alongside the password.
export type SyncTOTPChallengeHandoff = {
  challengeID: string;
  challengeExpiresAt: string;
};

// SyncTOTPEnrollmentStart carries the freshly generated TOTP secret to the
// caller. The plaintext base32 secret is surfaced exactly once (for manual
// entry); the provisioning URI embeds the same secret in an `otpauth://` URL
// that authenticator apps can ingest from a QR code.
export type SyncTOTPEnrollmentStart = {
  secretBase32: string;
  provisioningURI: string;
};

export type SyncForgotPasswordResult = {
  resetToken: string;
  resetTokenExpiresAt: string;
};

export type SyncPasswordResetResult = {
  recoveryCode: string;
};

export type SyncRegenerateRecoveryCodeResult = {
  recoveryCode: string;
};

export type SyncCapabilityDocument = {
  mode: SyncMode;
  syncEnabled: boolean;
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
  // managedAuthSessionExpiresAt is the ISO expiry the managed cloud stamped on
  // the current access session. It is what lets the app renew a short-lived
  // session before it lapses instead of discovering the expiry as a failed
  // request. Null on a legacy record, or when the server never reported one.
  managedAuthSessionExpiresAt: string | null;
  // managedRefreshToken renews the managed access session without asking for
  // the password again. It is a bearer secret with the same handling rules as
  // the session token — secure store only, never logged, never in a URL — and
  // is single-use: every renewal replaces it with its successor. Null when the
  // server did not issue one (an older managed deployment, or a session minted
  // before this device declared refresh support).
  managedRefreshToken: string | null;
  managedRefreshTokenExpiresAt: string | null;
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
    guestSessionExpiresAt: null,
  };
}
