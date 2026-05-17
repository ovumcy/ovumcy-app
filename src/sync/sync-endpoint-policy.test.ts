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
});
