import type {
  SyncAuthResult,
  SyncBlobRecord,
  SyncCapabilityDocument,
  SyncDeviceRecord,
} from "./sync-contract";

export type SyncAPIErrorCode =
  | "invalid_registration_input"
  | "registration_failed"
  | "invalid_credentials"
  | "unauthorized"
  | "invalid_device"
  | "too_many_devices"
  | "invalid_blob"
  | "stale_generation"
  | "blob_not_found"
  | "origin_not_allowed"
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
  register(
    input: { login: string; password: string },
  ): Promise<
    | { ok: true; auth: SyncAuthResult }
    | { ok: false; errorCode: SyncAPIErrorCode }
  >;
};

type FetchLike = typeof fetch;

type ErrorPayload = {
  error?: string;
};

type RawSyncAuthResult = {
  account_id: string;
  session_token: string;
  session_expires_at: string;
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
      case "unauthorized":
      case "invalid_device":
      case "too_many_devices":
      case "invalid_blob":
      case "stale_generation":
      case "blob_not_found":
      case "origin_not_allowed":
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

function isRawSyncAuthResult(value: unknown): value is RawSyncAuthResult {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.session_token === "string" &&
    typeof value.session_expires_at === "string"
  );
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

function mapSyncAuthResult(raw: RawSyncAuthResult): SyncAuthResult {
  return {
    accountID: raw.account_id,
    sessionToken: raw.session_token,
    sessionExpiresAt: raw.session_expires_at,
  };
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
