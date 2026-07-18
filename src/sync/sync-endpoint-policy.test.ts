import { normalizeSyncEndpoint } from "./sync-endpoint-policy";

describe("sync-endpoint-policy", () => {
  it("returns the canonical managed endpoint", () => {
    const result = normalizeSyncEndpoint("managed", "");

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        mode: "managed",
        baseURL: "https://sync.ovumcy.cloud",
        isSecure: true,
      }),
    });
  });

  it("defaults public self-hosted domains to https", () => {
    const result = normalizeSyncEndpoint("self_hosted", "sync.example.com");

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        baseURL: "https://sync.example.com",
        host: "sync.example.com",
        isLocalNetwork: false,
        isSecure: true,
      }),
    });
  });

  it("defaults local self-hosted hosts to http", () => {
    const result = normalizeSyncEndpoint("self_hosted", "192.168.1.20:8080");

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        baseURL: "http://192.168.1.20:8080",
        host: "192.168.1.20",
        isLocalNetwork: true,
        isSecure: false,
      }),
    });
  });

  it("rejects insecure public http endpoints", () => {
    const result = normalizeSyncEndpoint("self_hosted", "http://example.com");

    expect(result).toEqual({
      ok: false,
      errorCode: "insecure_public_http",
    });
  });

  it("accepts localhost http endpoints and strips trailing slashes", () => {
    const result = normalizeSyncEndpoint(
      "self_hosted",
      "http://localhost:8080/api/",
    );

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        baseURL: "http://localhost:8080/api",
        host: "localhost",
        isLocalNetwork: true,
        isSecure: false,
      }),
    });
  });

  // Regression: hostname classification must not approve plaintext HTTP for
  // FQDNs whose label structure starts with private-IP octets but resolve to
  // attacker-controlled DNS. A prefix regex over the hostname string used to
  // match these and let the policy fall through to http://.
  it.each([
    "192.168.1.1.attacker.com",
    "10.0.0.1.attacker.com",
    "127.0.0.1.attacker.com",
    "172.16.0.1.attacker.com",
    "localhost.attacker.com",
    "192.168.1.1.local.attacker.com",
  ])("rejects bare http on private-octet-prefixed FQDN %s", (host) => {
    const result = normalizeSyncEndpoint("self_hosted", host);

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        baseURL: `https://${host}`,
        host,
        isLocalNetwork: false,
        isSecure: true,
      }),
    });
  });

  it("rejects explicit http on a private-octet-prefixed FQDN", () => {
    const result = normalizeSyncEndpoint(
      "self_hosted",
      "http://192.168.1.1.attacker.com",
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "insecure_public_http",
    });
  });

  it("accepts a literal .local mDNS host over http", () => {
    const result = normalizeSyncEndpoint("self_hosted", "ovumcy.local:8080");

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        baseURL: "http://ovumcy.local:8080",
        host: "ovumcy.local",
        isLocalNetwork: true,
        isSecure: false,
      }),
    });
  });

  // Regression: WHATWG URL yields hostname "[::1]" (bracketed) for an IPv6
  // loopback literal, not "::1". A bare string-equality check against "::1"
  // never matched, permanently sending IPv6-loopback self-hosted endpoints
  // down the public-http rejection path.
  it("accepts IPv6 loopback http endpoints", () => {
    const result = normalizeSyncEndpoint(
      "self_hosted",
      "http://[::1]:8080/api/",
    );

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        baseURL: "http://[::1]:8080/api",
        host: "[::1]",
        isLocalNetwork: true,
        isSecure: false,
      }),
    });
  });

  // Regression: a bracketed IPv6 literal typed without a scheme used to be
  // mis-split on its internal colons (`extractHostCandidate` truncated
  // "[::1]:8080" to "["), so the loopback check missed and the endpoint
  // defaulted to https instead of matching the schemed form above.
  it("defaults a bare bracketed IPv6 loopback host with a port to http", () => {
    const result = normalizeSyncEndpoint("self_hosted", "[::1]:8080");

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        baseURL: "http://[::1]:8080",
        host: "[::1]",
        isLocalNetwork: true,
        isSecure: false,
      }),
    });
  });

  it("defaults a bare bracketed IPv6 loopback host without a port to http", () => {
    const result = normalizeSyncEndpoint("self_hosted", "[::1]");

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        baseURL: "http://[::1]",
        host: "[::1]",
        isLocalNetwork: true,
        isSecure: false,
      }),
    });
  });

  it("rejects insecure public http for link-local (169.254.0.0/16) addresses", () => {
    // 169.254.0.0/16 is deliberately not classified as local-network — see
    // the comment on isPrivateIPv4. Pin the fail-closed behavior.
    const result = normalizeSyncEndpoint("self_hosted", "http://169.254.1.5:8080");

    expect(result).toEqual({
      ok: false,
      errorCode: "insecure_public_http",
    });
  });

  it("defaults the self-hosted pin set to null when no options are supplied", () => {
    const result = normalizeSyncEndpoint("self_hosted", "sync.example.com");

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        pinnedSPKIFingerprints: null,
      }),
    });
  });

  it("threads a single supplied pin into a self-hosted endpoint", () => {
    const fingerprint = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const result = normalizeSyncEndpoint("self_hosted", "sync.example.com", {
      pinnedSPKIFingerprints: [fingerprint],
    });

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        host: "sync.example.com",
        pinnedSPKIFingerprints: [fingerprint],
      }),
    });
  });

  it("threads multiple supplied pins for self-hosted cert rotation overlap", () => {
    const fingerprintA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const fingerprintB = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=";
    const result = normalizeSyncEndpoint("self_hosted", "sync.example.com", {
      pinnedSPKIFingerprints: [fingerprintA, fingerprintB],
    });

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        pinnedSPKIFingerprints: [fingerprintA, fingerprintB],
      }),
    });
  });

  it("drops malformed and duplicate fingerprints from the self-hosted pin set", () => {
    const fingerprintA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const result = normalizeSyncEndpoint("self_hosted", "sync.example.com", {
      pinnedSPKIFingerprints: [
        fingerprintA,
        "malformed",
        fingerprintA, // duplicate
        "" as string,
      ],
    });

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        pinnedSPKIFingerprints: [fingerprintA],
      }),
    });
  });

  it("collapses an all-malformed self-hosted pin set to null", () => {
    const result = normalizeSyncEndpoint("self_hosted", "sync.example.com", {
      pinnedSPKIFingerprints: ["malformed", ""],
    });

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        pinnedSPKIFingerprints: null,
      }),
    });
  });

  it("rejects an empty self-hosted endpoint input", () => {
    const result = normalizeSyncEndpoint("self_hosted", "   ");

    expect(result).toEqual({
      ok: false,
      errorCode: "endpoint_required",
    });
  });

  it("rejects a self-hosted endpoint with an unsupported URL scheme", () => {
    const result = normalizeSyncEndpoint("self_hosted", "ftp://sync.example.com");

    expect(result).toEqual({
      ok: false,
      errorCode: "unsupported_scheme",
    });
  });

  it("fails closed to invalid_endpoint for an unterminated bracketed IPv6 literal", () => {
    // Regression: extractHostCandidate returns "" for an unterminated `[` so
    // isLocalNetworkHost("") short-circuits to false (non-local), which sends
    // ensureEndpointScheme down the https:// default. The resulting URL is
    // still an incomplete IPv6 literal and must fail closed rather than throw
    // an unhandled exception or silently coerce to some other host.
    const result = normalizeSyncEndpoint("self_hosted", "[::1");

    expect(result).toEqual({
      ok: false,
      errorCode: "invalid_endpoint",
    });
  });

  // Regression: isPrivateIPv4 must classify local network ranges by bucketing
  // the parsed dotted-quad octets, never by prefix-matching the hostname
  // string. Pin the octet-range boundaries directly with bare IPv4 literals
  // (not FQDNs) so a change to the bucketing logic itself is caught here,
  // separate from the FQDN-spoofing regression suite above.
  it.each([
    ["127.0.0.1", "loopback (127.0.0.0/8)"],
    ["127.255.255.254", "loopback upper bound"],
    ["10.0.0.1", "private class A (10.0.0.0/8)"],
    ["10.255.255.255", "private class A upper bound"],
    ["172.16.0.1", "private class B lower bound (172.16.0.0/12)"],
    ["172.31.255.255", "private class B upper bound"],
  ])("classifies bare IPv4 %s as local network (%s)", (host) => {
    const result = normalizeSyncEndpoint("self_hosted", `${host}:8080`);

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        baseURL: `http://${host}:8080`,
        host,
        isLocalNetwork: true,
        isSecure: false,
      }),
    });
  });

  it.each([
    ["172.15.255.255", "just below the 172.16.0.0/12 lower bound"],
    ["172.32.0.0", "just above the 172.16.0.0/12 upper bound"],
    ["8.8.8.8", "a public IPv4 address"],
  ])("rejects insecure http for bare IPv4 %s (%s)", (host) => {
    const result = normalizeSyncEndpoint("self_hosted", `http://${host}`);

    expect(result).toEqual({
      ok: false,
      errorCode: "insecure_public_http",
    });
  });

  it("fails closed to invalid_endpoint for an out-of-range IPv4 octet", () => {
    // 999 cannot be a real octet. The WHATWG URL parser itself rejects this
    // host during `new URL(...)` (isPrivateIPv4's own octet-range guard is
    // defense-in-depth behind that parser, not reachable from here), so the
    // request fails closed to invalid_endpoint rather than being coerced
    // into some other host or silently passing.
    const result = normalizeSyncEndpoint("self_hosted", "http://999.1.1.1");

    expect(result).toEqual({
      ok: false,
      errorCode: "invalid_endpoint",
    });
  });

  it("drops a non-string fingerprint entry from the self-hosted pin set", () => {
    // pinnedSPKIFingerprints ultimately traces back to stored/parsed JSON
    // (cert-pin-store), so a corrupted entry is untrusted input, not just a
    // type-checker formality. Defensive normalization must not throw or
    // include it.
    const fingerprintA = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    const result = normalizeSyncEndpoint("self_hosted", "sync.example.com", {
      pinnedSPKIFingerprints: [
        fingerprintA,
        42 as unknown as string,
      ],
    });

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        pinnedSPKIFingerprints: [fingerprintA],
      }),
    });
  });

  it("resolves the managed pin set from build-time constants regardless of caller options", () => {
    // Managed pins are owned by the ovumcy team and shipped via app
    // release, not supplied by callers. Any options passed for managed
    // mode are ignored; the policy resolves the constant directly. While
    // the constant is still empty (real fingerprints pending), the
    // resolved set is null so the enforcement layer falls back to
    // standard CA chain trust.
    const result = normalizeSyncEndpoint("managed", "", {
      pinnedSPKIFingerprints: ["AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="],
    });

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        mode: "managed",
        pinnedSPKIFingerprints: null,
      }),
    });
  });
});
