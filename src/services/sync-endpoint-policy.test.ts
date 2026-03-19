import { normalizeSyncEndpoint } from "./sync-endpoint-policy";

describe("sync-endpoint-policy", () => {
  it("returns the canonical managed endpoint", () => {
    const result = normalizeSyncEndpoint("managed", "");

    expect(result).toEqual({
      ok: true,
      endpoint: expect.objectContaining({
        mode: "managed",
        baseURL: "https://sync.ovumcy.com",
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
});
