import { createSyncAPIClient } from "./sync-api-client";

describe("sync-api-client", () => {
  it("maps auth and capability responses from the community sync server contract", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account_id: "account-1",
            session_token: "session-1",
            session_expires_at: "2026-03-21T10:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mode: "self_hosted",
            sync_enabled: true,
            premium_active: false,
            recovery_supported: false,
            push_supported: false,
            portal_supported: false,
            advanced_cloud_insights: false,
            max_devices: 5,
            max_blob_bytes: 1024,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;

    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);
    const loginResult = await client.login({
      login: "alice@example.com",
      password: "correct horse battery staple",
    });
    const capabilitiesResult = await client.getCapabilities("session-1");

    expect(loginResult).toEqual({
      ok: true,
      auth: {
        accountID: "account-1",
        sessionToken: "session-1",
        sessionExpiresAt: "2026-03-21T10:00:00.000Z",
      },
    });
    expect(capabilitiesResult).toEqual({
      ok: true,
      capabilities: {
        mode: "self_hosted",
        syncEnabled: true,
        premiumActive: false,
        recoverySupported: false,
        pushSupported: false,
        portalSupported: false,
        advancedCloudInsights: false,
        maxDevices: 5,
        maxBlobBytes: 1024,
      },
    });
    expect(typedFetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/auth/login",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(typedFetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8080/sync/capabilities",
      expect.objectContaining({
        method: "GET",
        headers: expect.any(Headers),
      }),
    );
    const headers = typedFetchMock.mock.calls[1]?.[1]?.headers;
    if (!(headers instanceof Headers)) {
      throw new Error("Expected request headers to be a Headers instance");
    }
    expect(headers.get("Authorization")).toBe("Bearer session-1");
  });

  it("sends device and blob payloads using the server snake_case contract", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_id: "device-1",
            device_label: "Pixel 7",
            created_at: "2026-03-20T08:00:00.000Z",
            last_seen_at: "2026-03-20T08:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            schema_version: 1,
            generation: 123,
            checksum_sha256: "aa",
            ciphertext_base64: "YmFzZTY0",
            ciphertext_size: 6,
            updated_at: "2026-03-20T08:01:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;

    const client = createSyncAPIClient("http://127.0.0.1:8080", typedFetchMock);
    const deviceResult = await client.attachDevice("session-1", {
      deviceID: "device-1",
      deviceLabel: "Pixel 7",
    });
    const blobResult = await client.putBlob("session-1", {
      schemaVersion: 1,
      generation: 123,
      checksumSHA256: "aa",
      ciphertextBase64: "YmFzZTY0",
    });

    expect(deviceResult).toEqual({
      ok: true,
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-03-20T08:00:00.000Z",
        lastSeenAt: "2026-03-20T08:00:00.000Z",
      },
    });
    expect(blobResult).toEqual({
      ok: true,
      blob: {
        schemaVersion: 1,
        generation: 123,
        checksumSHA256: "aa",
        ciphertextBase64: "YmFzZTY0",
        ciphertextSize: 6,
        updatedAt: "2026-03-20T08:01:00.000Z",
      },
    });

    expect(typedFetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        device_id: "device-1",
        device_label: "Pixel 7",
      }),
    );
    expect(typedFetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({
        schema_version: 1,
        generation: 123,
        checksum_sha256: "aa",
        ciphertext_base64: "YmFzZTY0",
      }),
    );
  });

  it("maps transport failures into stable app error codes", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new Error("socket hang up"));
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;

    const client = createSyncAPIClient("http://127.0.0.1:8080", typedFetchMock);

    await expect(
      client.login({ login: "alice@example.com", password: "secret" }),
    ).resolves.toEqual({
      ok: false,
      errorCode: "network_failed",
    });
  });
});
