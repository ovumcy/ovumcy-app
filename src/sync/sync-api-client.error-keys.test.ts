import {
  createSyncAPIClient,
  mapServerErrorKey,
  parseRetryAfterSeconds,
} from "./sync-api-client";

function errorResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const blobInput = {
  schemaVersion: 1,
  generation: 1,
  checksumSHA256: "00",
  ciphertextBase64: "",
};

describe("mapServerErrorKey", () => {
  it.each([
    ["registration_disabled", 403, "registration_disabled"],
    ["sync_disabled", 403, "sync_disabled"],
    ["rate_limited", 429, "rate_limited"],
    ["not_ready", 503, "server_busy"],
    ["totp_not_configured", 503, "totp_not_configured"],
    ["totp_enrollment_discarded", 409, "totp_enrollment_discarded"],
    ["stale_generation", 409, "stale_generation"],
    ["invalid_json", 400, "generic"],
    ["invalid_ciphertext", 400, "generic"],
    ["unsupported_media_type", 415, "generic"],
    ["not_found", 404, "generic"],
    ["host_not_allowed", 403, "generic"],
    ["session_device_bound", 409, "generic"],
    ["recovery_key_conflict", 409, "generic"],
    ["managed_bridge_disabled", 503, "server_busy"],
    ["internal_error", 500, "generic"],
    [undefined, 503, "server_busy"],
    [undefined, 502, "generic"],
    ["a_key_added_later", 400, "generic"],
  ])("answers %s (HTTP %i) with %s", (key, status, expected) => {
    expect(mapServerErrorKey(key, status)).toBe(expected);
  });
});

describe("parseRetryAfterSeconds", () => {
  it.each([
    ["30", 30],
    [" 5 ", 5],
    ["3600", 3600],
    ["0", null],
    ["3601", null],
    ["-1", null],
    ["1.5", null],
    ["Wed, 21 Oct 2026 07:28:00 GMT", null],
    ["", null],
    [null, null],
  ])("reads %p as %p", (value, expected) => {
    expect(parseRetryAfterSeconds(value)).toBe(expected);
  });
});

describe("sync API client failures", () => {
  it("carries Retry-After seconds on a busy blob upload", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(errorResponse(503, "<html>busy</html>", { "Retry-After": "30" }));
    const client = createSyncAPIClient("https://sync.example", fetchImpl);

    await expect(client.putBlob("session-1", blobInput)).resolves.toEqual({
      ok: false,
      errorCode: "server_busy",
      retryAfterSeconds: 30,
    });
  });

  it("carries Retry-After seconds on a rate-limited blob download", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        errorResponse(429, JSON.stringify({ error: "rate_limited" }), { "Retry-After": "12" }),
      );
    const client = createSyncAPIClient("https://sync.example", fetchImpl);

    await expect(client.getBlob("session-1")).resolves.toEqual({
      ok: false,
      errorCode: "rate_limited",
      retryAfterSeconds: 12,
    });
  });

  it("omits the seconds when the header is absent or not delta-seconds", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(429, JSON.stringify({ error: "rate_limited" })))
      .mockResolvedValueOnce(
        errorResponse(503, JSON.stringify({ error: "not_ready" }), {
          "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT",
        }),
      );
    const client = createSyncAPIClient("https://sync.example", fetchImpl);

    await expect(client.getBlob("session-1")).resolves.toEqual({
      ok: false,
      errorCode: "rate_limited",
    });
    await expect(client.getBlob("session-1")).resolves.toEqual({
      ok: false,
      errorCode: "server_busy",
    });
  });

  it("never attaches seconds to an answer that is not a wait", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        errorResponse(409, JSON.stringify({ error: "stale_generation" }), { "Retry-After": "9" }),
      );
    const client = createSyncAPIClient("https://sync.example", fetchImpl);

    await expect(client.putBlob("session-1", blobInput)).resolves.toEqual({
      ok: false,
      errorCode: "stale_generation",
    });
  });

  it("maps a registration refusal and a sync-disabled account", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(403, JSON.stringify({ error: "registration_disabled" })))
      .mockResolvedValueOnce(errorResponse(403, JSON.stringify({ error: "sync_disabled" })));
    const client = createSyncAPIClient("https://sync.example", fetchImpl);

    await expect(
      client.register({ login: "alice", password: "correct horse battery" }),
    ).resolves.toEqual({ ok: false, errorCode: "registration_disabled" });
    await expect(client.listDevices("session-1")).resolves.toEqual({
      ok: false,
      errorCode: "sync_disabled",
    });
  });
});
