import type {
  SyncAuthResult,
  SyncBlobRecord,
  SyncCapabilityDocument,
  SyncDeviceRecord,
  SyncForgotPasswordResult,
  SyncPasswordResetResult,
  SyncRegenerateRecoveryCodeResult,
  SyncTOTPChallengeHandoff,
  SyncTOTPEnrollmentStart,
  WrappedSyncKeyMetadata,
} from "./sync-contract";

export type SyncAPIErrorCode =
  | "invalid_registration_input"
  | "registration_failed"
  | "invalid_credentials"
  | "invalid_current_password"
  | "new_password_must_differ"
  | "weak_new_password"
  | "invalid_recovery_credentials"
  | "invalid_reset_token"
  | "rate_limited"
  | "unauthorized"
  | "invalid_device"
  | "too_many_devices"
  | "invalid_blob"
  | "invalid_recovery_package"
  | "stale_generation"
  | "blob_not_found"
  | "recovery_package_not_found"
  | "origin_not_allowed"
  | "totp_not_configured"
  | "totp_already_enabled"
  | "totp_invalid_code"
  | "totp_replayed"
  | "totp_challenge_invalid"
  | "totp_secret_failed"
  | "network_failed"
  | "invalid_response"
  | "generic";

export type SyncAPIClient = {
  attachDevice(
    sessionToken: string,
    input: { deviceID: string; deviceLabel: string },
  ): Promise<
    | { ok: true; device: SyncDeviceRecord }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  getBlob(
    sessionToken: string,
  ): Promise<
    | { ok: true; blob: SyncBlobRecord }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  getCapabilities(
    sessionToken: string,
  ): Promise<
    | { ok: true; capabilities: SyncCapabilityDocument }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  getRecoveryKey(
    sessionToken: string,
  ): Promise<
    | { ok: true; recoveryKey: WrappedSyncKeyMetadata }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  login(
    input: { login: string; password: string },
  ): Promise<
    | { ok: true; auth: SyncAuthResult }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  logout(
    sessionToken: string,
  ): Promise<{ ok: true } | { ok: false; errorCode: SyncAPIErrorCode }>;
  putBlob(
    sessionToken: string,
    input: {
      schemaVersion: number;
      generation: number;
      checksumSHA256: string;
      ciphertextBase64: string;
    },
  ): Promise<
    | { ok: true; blob: SyncBlobRecord }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  putRecoveryKey(
    sessionToken: string,
    input: WrappedSyncKeyMetadata,
  ): Promise<
    | { ok: true; recoveryKey: WrappedSyncKeyMetadata }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  register(
    input: { login: string; password: string },
  ): Promise<
    | { ok: true; auth: SyncAuthResult }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  changePassword(
    sessionToken: string,
    input: { currentPassword: string; newPassword: string },
  ): Promise<{ ok: true } | { ok: false; errorCode: SyncAPIErrorCode }>;
  forgotPassword(
    input: { login: string; recoveryCode: string },
  ): Promise<
    | { ok: true; result: SyncForgotPasswordResult }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  resetPassword(
    input: { resetToken: string; newPassword: string },
  ): Promise<
    | { ok: true; result: SyncPasswordResetResult }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  regenerateRecoveryCode(
    sessionToken: string,
    input: { currentPassword: string },
  ): Promise<
    | { ok: true; result: SyncRegenerateRecoveryCodeResult }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  startTOTPEnrollment(
    sessionToken: string,
    input: { currentPassword: string },
  ): Promise<
    | { ok: true; enrollment: SyncTOTPEnrollmentStart }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
  verifyTOTPEnrollment(
    sessionToken: string,
    input: { code: string },
  ): Promise<{ ok: true } | { ok: false; errorCode: SyncAPIErrorCode }>;
  disableTOTP(
    sessionToken: string,
    input: { currentPassword: string; code: string },
  ): Promise<{ ok: true } | { ok: false; errorCode: SyncAPIErrorCode }>;
  completeTOTPChallenge(
    input: { challengeID: string; code: string },
  ): Promise<
    | { ok: true; auth: SyncAuthResult }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
};

type FetchLike = typeof fetch;

type ErrorPayload = {
  error?: string;
};

type RawSyncTOTPChallenge = {
  challenge_id: string;
  challenge_expires_at: string;
};

type RawSyncAuthResult = {
  account_id: string;
  session_token: string;
  session_expires_at: string;
  recovery_code?: string;
  totp_challenge?: RawSyncTOTPChallenge;
};

type RawSyncTOTPEnrollmentStart = {
  secret_base32: string;
  provisioning_uri: string;
};

type RawSyncStatusPayload = {
  status: string;
};

type RawSyncForgotPasswordResult = {
  reset_token: string;
  reset_token_expires_at: string;
};

type RawSyncRecoveryCodePayload = {
  recovery_code: string;
};

type RawSyncChangePasswordResult = {
  status: string;
};

type RawSyncCapabilityDocument = {
  mode: "managed" | "self_hosted";
  sync_enabled: boolean;
  premium_active: boolean;
  recovery_supported: boolean;
  push_supported: boolean;
  portal_supported: boolean;
  advanced_cloud_insights: boolean;
  max_devices: number;
  max_blob_bytes: number;
};

type RawSyncDeviceRecord = {
  device_id: string;
  device_label: string;
  created_at: string;
  last_seen_at: string;
};

type RawSyncBlobRecord = {
  schema_version: number;
  generation: number;
  checksum_sha256: string;
  ciphertext_base64: string;
  ciphertext_size: number;
  updated_at: string;
};

type RawRecoveryKeyPackage = {
  algorithm: "xchacha20poly1305";
  kdf: "bip39_seed_hkdf_sha256";
  mnemonic_word_count: number;
  wrap_nonce_hex: string;
  wrapped_master_key_hex: string;
  phrase_fingerprint_hex: string;
  updated_at: string;
};

export function createSyncAPIClient(
  baseURL: string,
  fetchImpl: FetchLike = fetch,
): SyncAPIClient {
  const normalizedBaseURL = baseURL.replace(/\/+$/, "");

  return {
    async register(input) {
      return requestAuthResult(fetchImpl, normalizedBaseURL, "/auth/register", input);
    },

    async login(input) {
      return requestAuthResult(fetchImpl, normalizedBaseURL, "/auth/login", input);
    },

    async logout(sessionToken) {
      return requestNoPayload(fetchImpl, normalizedBaseURL, "/auth/session", {
        method: "DELETE",
        sessionToken,
      });
    },

    async changePassword(sessionToken, input) {
      return requestJSON<RawSyncChangePasswordResult>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/change-password",
        {
          method: "POST",
          sessionToken,
          body: {
            current_password: input.currentPassword,
            new_password: input.newPassword,
          },
        },
        isRawSyncChangePasswordResult,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? { ok: true }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async forgotPassword(input) {
      return requestJSON<RawSyncForgotPasswordResult>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/forgot-password",
        {
          method: "POST",
          body: {
            login: input.login,
            recovery_code: input.recoveryCode,
          },
        },
        isRawSyncForgotPasswordResult,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              result: {
                resetToken: result.payload.reset_token,
                resetTokenExpiresAt: result.payload.reset_token_expires_at,
              },
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async resetPassword(input) {
      return requestJSON<RawSyncRecoveryCodePayload>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/reset-password",
        {
          method: "POST",
          body: {
            reset_token: input.resetToken,
            new_password: input.newPassword,
          },
        },
        isRawSyncRecoveryCodePayload,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              result: { recoveryCode: result.payload.recovery_code },
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async regenerateRecoveryCode(sessionToken, input) {
      return requestJSON<RawSyncRecoveryCodePayload>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/recovery-code/regenerate",
        {
          method: "POST",
          sessionToken,
          body: {
            current_password: input.currentPassword,
          },
        },
        isRawSyncRecoveryCodePayload,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              result: { recoveryCode: result.payload.recovery_code },
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async startTOTPEnrollment(sessionToken, input) {
      return requestJSON<RawSyncTOTPEnrollmentStart>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/totp/enroll",
        {
          method: "POST",
          sessionToken,
          body: {
            current_password: input.currentPassword,
          },
        },
        isRawSyncTOTPEnrollmentStart,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? {
              ok: true,
              enrollment: {
                secretBase32: result.payload.secret_base32,
                provisioningURI: result.payload.provisioning_uri,
              },
            }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async verifyTOTPEnrollment(sessionToken, input) {
      return requestJSON<RawSyncStatusPayload>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/totp/verify",
        {
          method: "POST",
          sessionToken,
          body: {
            code: input.code,
          },
        },
        isRawSyncStatusPayload,
        "invalid_response",
      ).then((result) =>
        result.ok ? { ok: true } : { ok: false, errorCode: result.errorCode },
      );
    },

    async disableTOTP(sessionToken, input) {
      return requestJSON<RawSyncStatusPayload>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/totp/disable",
        {
          method: "POST",
          sessionToken,
          body: {
            current_password: input.currentPassword,
            code: input.code,
          },
        },
        isRawSyncStatusPayload,
        "invalid_response",
      ).then((result) =>
        result.ok ? { ok: true } : { ok: false, errorCode: result.errorCode },
      );
    },

    async completeTOTPChallenge(input) {
      return requestJSON<RawSyncAuthResult>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/totp/challenge",
        {
          method: "POST",
          body: {
            challenge_id: input.challengeID,
            code: input.code,
          },
        },
        isRawSyncAuthResult,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? { ok: true, auth: mapSyncAuthResult(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async getCapabilities(sessionToken) {
      return requestJSON<RawSyncCapabilityDocument>(
        fetchImpl,
        normalizedBaseURL,
        "/sync/capabilities",
        {
          method: "GET",
          sessionToken,
        },
        isRawSyncCapabilities,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? { ok: true, capabilities: mapSyncCapabilities(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async attachDevice(sessionToken, input) {
      return requestJSON<RawSyncDeviceRecord>(
        fetchImpl,
        normalizedBaseURL,
        "/sync/devices",
        {
          method: "POST",
          sessionToken,
          body: {
            device_id: input.deviceID,
            device_label: input.deviceLabel,
          },
        },
        isRawSyncDeviceRecord,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? { ok: true, device: mapSyncDeviceRecord(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async getRecoveryKey(sessionToken) {
      return requestJSON<RawRecoveryKeyPackage>(
        fetchImpl,
        normalizedBaseURL,
        "/sync/recovery-key",
        {
          method: "GET",
          sessionToken,
        },
        isRawRecoveryKeyPackage,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? { ok: true, recoveryKey: mapRecoveryKeyPackage(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async putRecoveryKey(sessionToken, input) {
      return requestJSON<RawRecoveryKeyPackage>(
        fetchImpl,
        normalizedBaseURL,
        "/sync/recovery-key",
        {
          method: "PUT",
          sessionToken,
          body: {
            algorithm: input.algorithm,
            kdf: input.kdf,
            mnemonic_word_count: input.mnemonicWordCount,
            wrap_nonce_hex: input.wrapNonceHex,
            wrapped_master_key_hex: input.wrappedMasterKeyHex,
            phrase_fingerprint_hex: input.phraseFingerprintHex,
          },
        },
        isRawRecoveryKeyPackage,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? { ok: true, recoveryKey: mapRecoveryKeyPackage(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async putBlob(sessionToken, input) {
      return requestJSON<RawSyncBlobRecord>(
        fetchImpl,
        normalizedBaseURL,
        "/sync/blob",
        {
          method: "PUT",
          sessionToken,
          body: {
            schema_version: input.schemaVersion,
            generation: input.generation,
            checksum_sha256: input.checksumSHA256,
            ciphertext_base64: input.ciphertextBase64,
          },
        },
        isRawSyncBlobRecord,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? { ok: true, blob: mapSyncBlobRecord(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async getBlob(sessionToken) {
      return requestJSON<RawSyncBlobRecord>(
        fetchImpl,
        normalizedBaseURL,
        "/sync/blob",
        {
          method: "GET",
          sessionToken,
        },
        isRawSyncBlobRecord,
        "invalid_response",
      ).then((result) =>
        result.ok
          ? { ok: true, blob: mapSyncBlobRecord(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },
  };
}

async function requestAuthResult(
  fetchImpl: FetchLike,
  baseURL: string,
  path: string,
  input: { login: string; password: string },
): Promise<
  | { ok: true; auth: SyncAuthResult }
  | { ok: false; errorCode: SyncAPIErrorCode }
> {
  const result = await requestJSON<RawSyncAuthResult>(
    fetchImpl,
    baseURL,
    path,
    {
      method: "POST",
      body: input,
    },
    isRawSyncAuthResult,
    "invalid_response",
  );

  return result.ok
    ? { ok: true, auth: mapSyncAuthResult(result.payload) }
    : { ok: false, errorCode: result.errorCode };
}

async function requestNoPayload(
  fetchImpl: FetchLike,
  baseURL: string,
  path: string,
  options: {
    method: "DELETE";
    sessionToken?: string;
  },
): Promise<{ ok: true } | { ok: false; errorCode: SyncAPIErrorCode }> {
  const response = await performFetch(fetchImpl, `${baseURL}${path}`, options);
  if (!response.ok) {
    return {
      ok: false,
      errorCode: await readErrorCode(response),
    };
  }

  return { ok: true };
}

async function requestJSON<T>(
  fetchImpl: FetchLike,
  baseURL: string,
  path: string,
  options: {
    method: "GET" | "POST" | "PUT";
    body?: unknown;
    sessionToken?: string;
  },
  guard: (value: unknown) => value is T,
  invalidResponseCode: SyncAPIErrorCode,
): Promise<
  | { ok: true; payload: T }
  | { ok: false; errorCode: SyncAPIErrorCode }
> {
  const response = await performFetch(fetchImpl, `${baseURL}${path}`, options);
  if (!response.ok) {
    return {
      ok: false,
      errorCode: await readErrorCode(response),
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, errorCode: invalidResponseCode };
  }

  if (!guard(payload)) {
    return { ok: false, errorCode: invalidResponseCode };
  }

  return { ok: true, payload };
}

async function performFetch(
  fetchImpl: FetchLike,
  url: string,
  options: {
    method: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    sessionToken?: string;
  },
): Promise<Response> {
  const headers = new Headers();
  headers.set("Accept", "application/json");
  if (options.sessionToken) {
    headers.set("Authorization", `Bearer ${options.sessionToken}`);
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const requestInit: RequestInit = {
      method: options.method,
      headers,
      // Refuse to follow redirects: this client only talks to the configured
      // sync origin, and a malicious or misconfigured upstream returning a
      // 3xx Location could otherwise cause fetch to re-send the bearer
      // session token to an attacker-controlled host on 307/308 (which
      // preserve method + headers per HTTP spec). Same-origin invariant
      // makes any redirect here unambiguously suspicious.
      redirect: "error",
    };
    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    return await fetchImpl(url, {
      ...requestInit,
    });
  } catch {
    return new Response(JSON.stringify({ error: "network_failed" }), {
      status: 599,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function readErrorCode(response: Response): Promise<SyncAPIErrorCode> {
  if (response.status === 599) {
    return "network_failed";
  }

  try {
    const payload = (await response.json()) as ErrorPayload;
    switch (payload?.error) {
      case "invalid_registration_input":
      case "registration_failed":
      case "invalid_credentials":
      case "invalid_current_password":
      case "new_password_must_differ":
      case "weak_new_password":
      case "invalid_recovery_credentials":
      case "invalid_reset_token":
      case "rate_limited":
      case "unauthorized":
      case "invalid_device":
      case "too_many_devices":
      case "invalid_blob":
      case "invalid_recovery_package":
      case "stale_generation":
      case "blob_not_found":
      case "recovery_package_not_found":
      case "origin_not_allowed":
      case "totp_not_configured":
      case "totp_already_enabled":
      case "totp_invalid_code":
      case "totp_replayed":
      case "totp_challenge_invalid":
      case "totp_secret_failed":
        return payload.error;
      default:
        return "generic";
    }
  } catch {
    return "generic";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRawSyncTOTPChallenge(value: unknown): value is RawSyncTOTPChallenge {
  return (
    isObject(value) &&
    typeof value.challenge_id === "string" &&
    typeof value.challenge_expires_at === "string"
  );
}

function isRawSyncAuthResult(value: unknown): value is RawSyncAuthResult {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.session_token === "string" &&
    typeof value.session_expires_at === "string" &&
    (typeof value.recovery_code === "string" ||
      typeof value.recovery_code === "undefined") &&
    (typeof value.totp_challenge === "undefined" ||
      isRawSyncTOTPChallenge(value.totp_challenge))
  );
}

function isRawSyncTOTPEnrollmentStart(
  value: unknown,
): value is RawSyncTOTPEnrollmentStart {
  return (
    isObject(value) &&
    typeof value.secret_base32 === "string" &&
    typeof value.provisioning_uri === "string"
  );
}

function isRawSyncStatusPayload(value: unknown): value is RawSyncStatusPayload {
  return isObject(value) && typeof value.status === "string";
}

function isRawSyncForgotPasswordResult(
  value: unknown,
): value is RawSyncForgotPasswordResult {
  return (
    isObject(value) &&
    typeof value.reset_token === "string" &&
    typeof value.reset_token_expires_at === "string"
  );
}

function isRawSyncRecoveryCodePayload(
  value: unknown,
): value is RawSyncRecoveryCodePayload {
  return isObject(value) && typeof value.recovery_code === "string";
}

function isRawSyncChangePasswordResult(
  value: unknown,
): value is RawSyncChangePasswordResult {
  return isObject(value) && typeof value.status === "string";
}

function isRawSyncCapabilities(value: unknown): value is RawSyncCapabilityDocument {
  return (
    isObject(value) &&
    (value.mode === "managed" || value.mode === "self_hosted") &&
    typeof value.sync_enabled === "boolean" &&
    typeof value.premium_active === "boolean" &&
    typeof value.recovery_supported === "boolean" &&
    typeof value.push_supported === "boolean" &&
    typeof value.portal_supported === "boolean" &&
    typeof value.advanced_cloud_insights === "boolean" &&
    typeof value.max_devices === "number" &&
    typeof value.max_blob_bytes === "number"
  );
}

function isRawSyncDeviceRecord(value: unknown): value is RawSyncDeviceRecord {
  return (
    isObject(value) &&
    typeof value.device_id === "string" &&
    typeof value.device_label === "string" &&
    typeof value.created_at === "string" &&
    typeof value.last_seen_at === "string"
  );
}

function isRawSyncBlobRecord(value: unknown): value is RawSyncBlobRecord {
  return (
    isObject(value) &&
    typeof value.schema_version === "number" &&
    typeof value.generation === "number" &&
    typeof value.checksum_sha256 === "string" &&
    typeof value.ciphertext_base64 === "string" &&
    typeof value.ciphertext_size === "number" &&
    typeof value.updated_at === "string"
  );
}

function isRawRecoveryKeyPackage(value: unknown): value is RawRecoveryKeyPackage {
  return (
    isObject(value) &&
    value.algorithm === "xchacha20poly1305" &&
    value.kdf === "bip39_seed_hkdf_sha256" &&
    value.mnemonic_word_count === 12 &&
    typeof value.wrap_nonce_hex === "string" &&
    typeof value.wrapped_master_key_hex === "string" &&
    typeof value.phrase_fingerprint_hex === "string" &&
    typeof value.updated_at === "string"
  );
}

function mapSyncAuthResult(raw: RawSyncAuthResult): SyncAuthResult {
  const result: SyncAuthResult = {
    accountID: raw.account_id,
    sessionToken: raw.session_token,
    sessionExpiresAt: raw.session_expires_at,
  };
  if (typeof raw.recovery_code === "string" && raw.recovery_code.length > 0) {
    result.recoveryCode = raw.recovery_code;
  }
  if (raw.totp_challenge !== undefined) {
    result.totpChallenge = {
      challengeID: raw.totp_challenge.challenge_id,
      challengeExpiresAt: raw.totp_challenge.challenge_expires_at,
    };
  }
  return result;
}

function mapSyncCapabilities(
  raw: RawSyncCapabilityDocument,
): SyncCapabilityDocument {
  return {
    mode: raw.mode,
    syncEnabled: raw.sync_enabled,
    premiumActive: raw.premium_active,
    recoverySupported: raw.recovery_supported,
    pushSupported: raw.push_supported,
    portalSupported: raw.portal_supported,
    advancedCloudInsights: raw.advanced_cloud_insights,
    maxDevices: raw.max_devices,
    maxBlobBytes: raw.max_blob_bytes,
  };
}

function mapSyncDeviceRecord(raw: RawSyncDeviceRecord): SyncDeviceRecord {
  return {
    deviceID: raw.device_id,
    deviceLabel: raw.device_label,
    createdAt: raw.created_at,
    lastSeenAt: raw.last_seen_at,
  };
}

function mapSyncBlobRecord(raw: RawSyncBlobRecord): SyncBlobRecord {
  return {
    schemaVersion: raw.schema_version,
    generation: raw.generation,
    checksumSHA256: raw.checksum_sha256,
    ciphertextBase64: raw.ciphertext_base64,
    ciphertextSize: raw.ciphertext_size,
    updatedAt: raw.updated_at,
  };
}

function mapRecoveryKeyPackage(
  raw: RawRecoveryKeyPackage,
): WrappedSyncKeyMetadata {
  return {
    algorithm: raw.algorithm,
    kdf: raw.kdf,
    mnemonicWordCount: 12,
    wrapNonceHex: raw.wrap_nonce_hex,
    wrappedMasterKeyHex: raw.wrapped_master_key_hex,
    phraseFingerprintHex: raw.phrase_fingerprint_hex,
  };
}
