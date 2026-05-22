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
