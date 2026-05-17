import {
  MANAGED_SYNC_BASE_URL,
  type NormalizedSyncEndpoint,
  type SyncMode,
} from "./sync-contract";

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

  if (host === "localhost" || host === "::1") {
    return true;
  }

  // `.local` is the mDNS suffix. Match only labels that end with `.local` exactly,
  // not arbitrary FQDNs whose last label happens to start with "local".
  if (/\.local$/i.test(host) && !/\.local\./i.test(host)) {
    return true;
  }

  // Anything else has to parse as a literal IPv4 address. A prefix regex over
  // the hostname string would match attacker-controlled FQDNs like
  // `192.168.1.1.attacker.com`, which a remote DNS owner can register and point
  // at a public IP — that would let the policy approve plaintext HTTP against
  // a non-local host. Require an exact dotted-quad and bucket by parsed octets.
  return isPrivateIPv4(host);
}

function isPrivateIPv4(host: string): boolean {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return false;
  }

  const first = Number.parseInt(match[1] ?? "", 10);
  const second = Number.parseInt(match[2] ?? "", 10);
  const third = Number.parseInt(match[3] ?? "", 10);
  const fourth = Number.parseInt(match[4] ?? "", 10);

  for (const octet of [first, second, third, fourth]) {
    if (Number.isNaN(octet) || octet < 0 || octet > 255) {
      return false;
    }
  }

  if (first === 127) {
    return true;
  }
  if (first === 10) {
    return true;
  }
  if (first === 192 && second === 168) {
    return true;
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }
  return false;
}
