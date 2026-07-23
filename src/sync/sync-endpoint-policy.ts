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

// NormalizeSyncEndpointOptions carries side-channel state that the policy
// layer threads into the resulting `NormalizedSyncEndpoint` without itself
// owning that state. For self-hosted, the pin set is read by the caller
// from `cert-pin-store` (a SecureStore-backed map keyed by host). For
// managed, the pin set comes from build-time constants — callers don't
// need to supply it because the policy resolves it from `sync-contract`
// constants on its own.
export type NormalizeSyncEndpointOptions = {
  pinnedSPKIFingerprints?: readonly string[] | null;
};

export function normalizeSyncEndpoint(
  mode: SyncMode,
  input: string,
  options?: NormalizeSyncEndpointOptions,
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
        // Managed pins come from the build-time constant, not from the
        // caller. Callers passing options for managed are no-ops here:
        // the trust set for ovumcy.cloud is controlled by the ovumcy team
        // through `MANAGED_SYNC_PINNED_SPKI_FINGERPRINTS` and updated via
        // app release coordinated with their cert rotation schedule.
        pinnedSPKIFingerprints: resolveManagedPinSet(),
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
      pinnedSPKIFingerprints: normalizeFingerprintList(
        options?.pinnedSPKIFingerprints,
      ),
    },
  };
}

function normalizeFingerprintList(
  value: readonly string[] | null | undefined,
): readonly string[] | null {
  if (!value || value.length === 0) {
    return null;
  }
  const seen = new Set<string>();
  const filtered: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    if (!isWellFormedFingerprint(entry)) {
      continue;
    }
    if (seen.has(entry)) {
      continue;
    }
    seen.add(entry);
    filtered.push(entry);
  }
  return filtered.length > 0 ? filtered : null;
}

function isWellFormedFingerprint(value: string): boolean {
  // base64-encoded SHA-256 = 32 bytes = 44 chars with a single `=` pad.
  // Matches the writer-side validation in `cert-pin-store`.
  return /^[A-Za-z0-9+/]{43}=$/.test(value);
}

function resolveManagedPinSet(): readonly string[] | null {
  // Placeholder. The pin set itself is no longer an open question: the TLS
  // Pinning Posture section in docs/sync-trust-model.md records the four
  // Let's Encrypt ISRG root pins that belong here, and the pre-release
  // checklist that must pass before they are enabled. Returning null means
  // managed endpoints fall back to standard CA chain trust until pinning is
  // wired — populating this constant without the native enforcement layer
  // registered changes nothing at the handshake, so the two land together.
  return null;
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
  const candidate = (hostWithMaybePath ?? "").trim();

  // A bracketed IPv6 literal (`[::1]:8080`) carries its own internal colons,
  // so splitting on the first `:` truncates it to `[` and the port is never
  // separated correctly. Strip the port after the closing bracket instead.
  // An unterminated bracket (no `]`) is unparseable — fail closed by
  // returning an empty host, which `isLocalNetworkHost` treats as non-local
  // so the caller defaults to https rather than guessing http.
  if (candidate.startsWith("[")) {
    const closingBracketIndex = candidate.indexOf("]");
    return closingBracketIndex === -1
      ? ""
      : candidate.slice(0, closingBracketIndex + 1).toLowerCase();
  }

  const [host] = candidate.split(":", 1);
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

  if (host === "localhost" || unbracketIPv6Host(host) === "::1") {
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

// WHATWG URL wraps IPv6 literals in brackets — `new URL("http://[::1]").hostname`
// is `"[::1]"`, not `"::1"` — so a bare `host === "::1"` comparison against
// `parsed.hostname` can never match and the loopback branch is permanently
// dead. Strip one matching bracket pair before comparing.
function unbracketIPv6Host(host: string): string {
  return host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1)
    : host;
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
  // 169.254.0.0/16 (link-local/APIPA) is deliberately NOT treated as local:
  // it is unrouted and typically signals a misconfigured interface rather
  // than an intentional LAN sync server, so self-hosted endpoints on it stay
  // https-required (fail closed) instead of silently allowing plaintext HTTP.
  return false;
}
