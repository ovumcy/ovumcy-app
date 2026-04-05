import type { SyncAuthResult } from "./sync-contract";

export type ManagedCloudAPIErrorCode =
  | "invalid_registration_input"
  | "registration_failed"
  | "invalid_credentials"
  | "unauthorized"
  | "sync_not_allowed"
  | "sync_bridge_unavailable"
  | "origin_not_allowed"
  | "network_failed"
  | "invalid_response"
  | "generic";

export type ManagedCloudEntitlement = {
  syncAllowed: boolean;
  source: string;
  updatedAt: string;
  effectiveAt: string;
  explanation: string;
};

export type ManagedCloudSessionView = {
  accountID: string;
  email: string;
  sessionExpiresAt: string;
  entitlement: ManagedCloudEntitlement;
};

export type ManagedCloudPremiumFeatures = {
  advancedInsights: boolean;
  advancedFertility: boolean;
  doctorPDF: boolean;
  extendedReports: boolean;
};

export type ManagedCloudBillingSnapshot = {
  premiumFeatures: ManagedCloudPremiumFeatures;
};

export type ManagedCloudAuthResult = {
  accountID: string;
  email: string;
  sessionToken: string;
  sessionExpiresAt: string;
  entitlement: ManagedCloudEntitlement;
};

export type ManagedCloudAPIClient = {
  createSyncSession(
    sessionToken: string,
  ): Promise<
    | { ok: true; auth: SyncAuthResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  getBillingSnapshot(
    sessionToken: string,
  ): Promise<
    | { ok: true; billing: ManagedCloudBillingSnapshot }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  getSession(
    sessionToken: string,
  ): Promise<
    | { ok: true; session: ManagedCloudSessionView }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  login(
    input: { email: string; password: string },
  ): Promise<
    | { ok: true; auth: ManagedCloudAuthResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
  logout(
    sessionToken: string,
  ): Promise<{ ok: true } | { ok: false; errorCode: ManagedCloudAPIErrorCode }>;
  register(
    input: { email: string; password: string },
  ): Promise<
    | { ok: true; auth: ManagedCloudAuthResult }
    | { ok: false; errorCode: ManagedCloudAPIErrorCode }
  >;
};

type FetchLike = typeof fetch;

type RawSyncAuthResult = {
  account_id: string;
  session_token: string;
  session_expires_at: string;
};

type RawManagedCloudEntitlement = {
  sync_allowed: boolean;
  source: string;
  updated_at: string;
  effective_at: string;
  explanation: string;
};

type RawManagedCloudAuthResult = RawSyncAuthResult & {
  email: string;
  sync_entitlement: RawManagedCloudEntitlement;
};

type RawManagedCloudSessionView = {
  account_id: string;
  email: string;
  session_expires_at: string;
  sync_entitlement: RawManagedCloudEntitlement;
};

type RawManagedCloudBillingSnapshot = {
  premium_features?: {
    advanced_fertility?: boolean;
    advanced_insights?: boolean;
    doctor_pdf?: boolean;
    extended_reports?: boolean;
  };
};

type ErrorPayload = {
  error?: string;
};

export function createManagedCloudAPIClient(
  baseURL: string,
  fetchImpl: FetchLike = fetch,
): ManagedCloudAPIClient {
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

    async getSession(sessionToken) {
      return requestJSON<RawManagedCloudSessionView>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/session",
        {
          method: "GET",
          sessionToken,
        },
        isRawManagedCloudSessionView,
      ).then((result) =>
        result.ok
          ? { ok: true, session: mapSessionView(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async createSyncSession(sessionToken) {
      return requestJSON<RawSyncAuthResult>(
        fetchImpl,
        normalizedBaseURL,
        "/auth/sync-session",
        {
          method: "POST",
          sessionToken,
        },
        isRawSyncAuthResult,
      ).then((result) =>
        result.ok
          ? { ok: true, auth: mapSyncAuthResult(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },

    async getBillingSnapshot(sessionToken) {
      return requestJSON<RawManagedCloudBillingSnapshot>(
        fetchImpl,
        normalizedBaseURL,
        "/account/billing",
        {
          method: "GET",
          sessionToken,
        },
        isRawManagedCloudBillingSnapshot,
      ).then((result) =>
        result.ok
          ? { ok: true, billing: mapBillingSnapshot(result.payload) }
          : { ok: false, errorCode: result.errorCode },
      );
    },
  };
}

async function requestAuthResult(
  fetchImpl: FetchLike,
  baseURL: string,
  path: string,
  input: { email: string; password: string },
): Promise<
  | { ok: true; auth: ManagedCloudAuthResult }
  | { ok: false; errorCode: ManagedCloudAPIErrorCode }
> {
  const result = await requestJSON<RawManagedCloudAuthResult>(
    fetchImpl,
    baseURL,
    path,
    {
      method: "POST",
      body: input,
    },
    isRawManagedCloudAuthResult,
  );

  return result.ok
    ? { ok: true, auth: mapAuthResult(result.payload) }
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
): Promise<{ ok: true } | { ok: false; errorCode: ManagedCloudAPIErrorCode }> {
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
    method: "GET" | "POST";
    body?: unknown;
    sessionToken?: string;
  },
  guard: (value: unknown) => value is T,
): Promise<
  | { ok: true; payload: T }
  | { ok: false; errorCode: ManagedCloudAPIErrorCode }
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
    return { ok: false, errorCode: "invalid_response" };
  }

  if (!guard(payload)) {
    return { ok: false, errorCode: "invalid_response" };
  }

  return { ok: true, payload };
}

async function performFetch(
  fetchImpl: FetchLike,
  url: string,
  options: {
    method: "GET" | "POST" | "DELETE";
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

    return await fetchImpl(url, requestInit);
  } catch {
    return new Response(JSON.stringify({ error: "network_failed" }), {
      status: 599,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function readErrorCode(response: Response): Promise<ManagedCloudAPIErrorCode> {
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
      case "sync_not_allowed":
      case "sync_bridge_unavailable":
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

function isRawManagedCloudEntitlement(
  value: unknown,
): value is RawManagedCloudEntitlement {
  return (
    isObject(value) &&
    typeof value.sync_allowed === "boolean" &&
    typeof value.source === "string" &&
    typeof value.updated_at === "string" &&
    typeof value.effective_at === "string" &&
    typeof value.explanation === "string"
  );
}

function isRawManagedCloudAuthResult(
  value: unknown,
): value is RawManagedCloudAuthResult {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.email === "string" &&
    typeof value.session_token === "string" &&
    typeof value.session_expires_at === "string" &&
    isRawManagedCloudEntitlement(value.sync_entitlement)
  );
}

function isRawManagedCloudSessionView(
  value: unknown,
): value is RawManagedCloudSessionView {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.email === "string" &&
    typeof value.session_expires_at === "string" &&
    isRawManagedCloudEntitlement(value.sync_entitlement)
  );
}

function isRawManagedCloudBillingSnapshot(
  value: unknown,
): value is RawManagedCloudBillingSnapshot {
  if (!isObject(value)) {
    return false;
  }

  const features = value.premium_features;
  if (typeof features === "undefined") {
    return true;
  }

  return (
    isObject(features) &&
    (typeof features.doctor_pdf === "boolean" ||
      typeof features.doctor_pdf === "undefined") &&
    (typeof features.advanced_fertility === "boolean" ||
      typeof features.advanced_fertility === "undefined") &&
    (typeof features.advanced_insights === "boolean" ||
      typeof features.advanced_insights === "undefined") &&
    (typeof features.extended_reports === "boolean" ||
      typeof features.extended_reports === "undefined")
  );
}

function isRawSyncAuthResult(value: unknown): value is RawSyncAuthResult {
  return (
    isObject(value) &&
    typeof value.account_id === "string" &&
    typeof value.session_token === "string" &&
    typeof value.session_expires_at === "string"
  );
}

function mapEntitlement(
  raw: RawManagedCloudEntitlement,
): ManagedCloudEntitlement {
  return {
    syncAllowed: raw.sync_allowed,
    source: raw.source,
    updatedAt: raw.updated_at,
    effectiveAt: raw.effective_at,
    explanation: raw.explanation,
  };
}

function mapAuthResult(raw: RawManagedCloudAuthResult): ManagedCloudAuthResult {
  return {
    accountID: raw.account_id,
    email: raw.email,
    sessionToken: raw.session_token,
    sessionExpiresAt: raw.session_expires_at,
    entitlement: mapEntitlement(raw.sync_entitlement),
  };
}

function mapSessionView(raw: RawManagedCloudSessionView): ManagedCloudSessionView {
  return {
    accountID: raw.account_id,
    email: raw.email,
    sessionExpiresAt: raw.session_expires_at,
    entitlement: mapEntitlement(raw.sync_entitlement),
  };
}

function mapBillingSnapshot(
  raw: RawManagedCloudBillingSnapshot,
): ManagedCloudBillingSnapshot {
  const features = isObject(raw.premium_features) ? raw.premium_features : {};

  return {
    premiumFeatures: {
      advancedFertility: features.advanced_fertility === true,
      advancedInsights: features.advanced_insights === true,
      doctorPDF: features.doctor_pdf === true,
      extendedReports: features.extended_reports === true,
    },
  };
}

function mapSyncAuthResult(raw: RawSyncAuthResult): SyncAuthResult {
  return {
    accountID: raw.account_id,
    sessionToken: raw.session_token,
    sessionExpiresAt: raw.session_expires_at,
  };
}
