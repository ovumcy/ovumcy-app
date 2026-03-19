import {
  MANAGED_SYNC_BASE_URL,
  type NormalizedSyncEndpoint,
  type SyncMode,
} from "../models/sync";

export type NormalizeSyncEndpointErrorCode =
  | "endpoint_required"
  | "invalid_endpoint"
  | "unsupported_scheme"
  | "insecure_public_http";

export function normalizeSyncEndpoint(
  mode: SyncMode,
  input: string,
): {
  ok: true;
  endpoint: NormalizedSyncEndpoint;
} | {
  ok: false;
  errorCode: NormalizeSyncEndpointErrorCode;
} {
  if (mode === "managed") {
    const managedURL = new URL(MANAGED_SYNC_BASE_URL);
    return {
      ok: true,
      endpoint: {
        mode: "managed",
        baseURL: managedURL.toString().replace(/\/$/, ""),
        host: managedURL.hostname,
        isLocalNetwork: false,
        isSecure: true,
      },
    };
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      errorCode: "endpoint_required",
    };
  }

  const normalizedInput = ensureEndpointScheme(trimmed);

  let parsed: URL;
  try {
    parsed = new URL(normalizedInput);
  } catch {
    return {
      ok: false,
      errorCode: "invalid_endpoint",
    };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return {
      ok: false,
      errorCode: "unsupported_scheme",
    };
  }

  const host = parsed.hostname.toLowerCase();
  const isLocalNetwork = isLocalNetworkHost(host);
  const isSecure = parsed.protocol === "https:";

  if (!isSecure && !isLocalNetwork) {
    return {
      ok: false,
      errorCode: "insecure_public_http",
    };
  }

  return {
    ok: true,
    endpoint: {
      mode: "self_hosted",
      baseURL: buildNormalizedBaseURL(parsed),
      host,
      isLocalNetwork,
      isSecure,
    },
  };
}

function ensureEndpointScheme(input: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) {
    return input;
  }

  return isLocalNetworkHost(extractHostCandidate(input))
    ? `http://${input}`
    : `https://${input}`;
}

function extractHostCandidate(input: string): string {
  const [hostWithMaybePath] = input.split("/", 1);
  const [host] = (hostWithMaybePath ?? "").split(":", 1);
  return (host ?? "").trim().toLowerCase();
}

function buildNormalizedBaseURL(parsed: URL): string {
  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  const pathname = normalizedPath && normalizedPath !== "/" ? normalizedPath : "";
  return `${parsed.protocol}//${parsed.host}${pathname}`;
}

function isLocalNetworkHost(host: string): boolean {
  if (!host) {
    return false;
  }

  if (host === "localhost" || host === "::1" || host.endsWith(".local")) {
    return true;
  }

  if (/^127\./.test(host)) {
    return true;
  }

  if (/^10\./.test(host)) {
    return true;
  }

  if (/^192\.168\./.test(host)) {
    return true;
  }

  const private172 = /^172\.(1[6-9]|2\d|3[0-1])\./;
  return private172.test(host);
}
