import { createSyncAPIClient } from "./sync-api-client";

describe("sync-api-client", () => {
  it('sets redirect: "error" on every request so a 3xx cannot leak the bearer session token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;

    const client = createSyncAPIClient(
      "https://sync.ovumcy.cloud",
      typedFetchMock,
    );
    await client.login({ login: "alice@example.com", password: "pw" });
    await client.logout("session-1");
    await client.getCapabilities("session-1");

    expect(fetchMock).toHaveBeenCalled();
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as RequestInit).redirect).toBe("error");
    }
  });

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

  it("maps recovery key transport payloads through the snake_case contract", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            algorithm: "xchacha20poly1305",
            kdf: "bip39_seed_hkdf_sha256",
            mnemonic_word_count: 12,
            wrap_nonce_hex: "a".repeat(48),
            wrapped_master_key_hex: "b".repeat(96),
            phrase_fingerprint_hex: "c".repeat(16),
            updated_at: "2026-03-21T10:00:00.000Z",
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
            algorithm: "xchacha20poly1305",
            kdf: "bip39_seed_hkdf_sha256",
            mnemonic_word_count: 12,
            wrap_nonce_hex: "d".repeat(48),
            wrapped_master_key_hex: "e".repeat(96),
            phrase_fingerprint_hex: "f".repeat(16),
            updated_at: "2026-03-21T10:05:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080", typedFetchMock);

    await expect(client.getRecoveryKey("session-1")).resolves.toEqual({
      ok: true,
      recoveryKey: {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "a".repeat(48),
        wrappedMasterKeyHex: "b".repeat(96),
        phraseFingerprintHex: "c".repeat(16),
      },
    });

    await expect(
      client.putRecoveryKey("session-1", {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "d".repeat(48),
        wrappedMasterKeyHex: "e".repeat(96),
        phraseFingerprintHex: "f".repeat(16),
      }),
    ).resolves.toEqual({
      ok: true,
      recoveryKey: {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "d".repeat(48),
        wrappedMasterKeyHex: "e".repeat(96),
        phraseFingerprintHex: "f".repeat(16),
      },
    });

    expect(typedFetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8080/sync/recovery-key",
      expect.objectContaining({ method: "GET" }),
    );
    expect(typedFetchMock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonic_word_count: 12,
        wrap_nonce_hex: "d".repeat(48),
        wrapped_master_key_hex: "e".repeat(96),
        phrase_fingerprint_hex: "f".repeat(16),
      }),
    );
  });

  it("surfaces the recovery code that comes back on register", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          session_token: "session-1",
          session_expires_at: "2026-03-21T10:00:00.000Z",
          recovery_code: "abcd1234abcd1234abcd1234abcd1234",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.register({
      login: "owner@example.com",
      password: "correct horse battery staple",
    });

    expect(result).toEqual({
      ok: true,
      auth: {
        accountID: "account-1",
        sessionToken: "session-1",
        sessionExpiresAt: "2026-03-21T10:00:00.000Z",
        recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
      },
    });
  });

  it("omits recoveryCode from login auth result", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          session_token: "session-1",
          session_expires_at: "2026-03-21T10:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.login({
      login: "owner@example.com",
      password: "correct horse battery staple",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.auth).not.toHaveProperty("recoveryCode");
    }
  });

  it("changes password and forwards bearer token", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "password_changed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.changePassword("session-1", {
      currentPassword: "old password 12345",
      newPassword: "new password 12345",
    });

    expect(result).toEqual({ ok: true });
    const call = typedFetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:8080/auth/change-password");
    const headers = call?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer session-1");
    expect(call?.[1]?.body).toBe(
      JSON.stringify({
        current_password: "old password 12345",
        new_password: "new password 12345",
      }),
    );
  });

  it("maps change-password error keys", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_current_password" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "weak_new_password" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "new_password_must_differ" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const a = await client.changePassword("session-1", {
      currentPassword: "wrong",
      newPassword: "new password 12345",
    });
    const b = await client.changePassword("session-1", {
      currentPassword: "old password 12345",
      newPassword: "short",
    });
    const c = await client.changePassword("session-1", {
      currentPassword: "same password",
      newPassword: "same password",
    });

    expect(a).toEqual({ ok: false, errorCode: "invalid_current_password" });
    expect(b).toEqual({ ok: false, errorCode: "weak_new_password" });
    expect(c).toEqual({ ok: false, errorCode: "new_password_must_differ" });
  });

  it("forgot-password returns reset token on success", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          reset_token: "reset-token-1",
          reset_token_expires_at: "2026-03-21T11:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.forgotPassword({
      login: "owner@example.com",
      recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
    });

    expect(result).toEqual({
      ok: true,
      result: {
        resetToken: "reset-token-1",
        resetTokenExpiresAt: "2026-03-21T11:00:00.000Z",
      },
    });
    expect(typedFetchMock.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({
        login: "owner@example.com",
        recovery_code: "abcd1234abcd1234abcd1234abcd1234",
      }),
    );
  });

  it("forgot-password maps generic invalid recovery credentials", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_recovery_credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.forgotPassword({
      login: "ghost@example.com",
      recoveryCode: "00000000000000000000000000000000",
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "invalid_recovery_credentials",
    });
  });

  it("reset-password returns the rotated recovery code", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ recovery_code: "rotated1234rotated1234rotated123" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.resetPassword({
      resetToken: "reset-token-1",
      newPassword: "new password 12345",
    });

    expect(result).toEqual({
      ok: true,
      result: { recoveryCode: "rotated1234rotated1234rotated123" },
    });
  });

  it("reset-password maps invalid_reset_token and weak_new_password", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "invalid_reset_token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "weak_new_password" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const a = await client.resetPassword({
      resetToken: "bad-token",
      newPassword: "new password 12345",
    });
    const b = await client.resetPassword({
      resetToken: "reset-token-1",
      newPassword: "short",
    });

    expect(a).toEqual({ ok: false, errorCode: "invalid_reset_token" });
    expect(b).toEqual({ ok: false, errorCode: "weak_new_password" });
  });

  it("regenerate-recovery-code returns the new code", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ recovery_code: "fresh1234fresh1234fresh1234fresh" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.regenerateRecoveryCode("session-1", {
      currentPassword: "correct password 12345",
    });

    expect(result).toEqual({
      ok: true,
      result: { recoveryCode: "fresh1234fresh1234fresh1234fresh" },
    });
    const call = typedFetchMock.mock.calls[0];
    expect(call?.[0]).toBe(
      "http://127.0.0.1:8080/auth/recovery-code/regenerate",
    );
    const headers = call?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer session-1");
  });

  it("regenerate-recovery-code maps invalid_current_password", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_current_password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.regenerateRecoveryCode("session-1", {
      currentPassword: "wrong",
    });

    expect(result).toEqual({
      ok: false,
      errorCode: "invalid_current_password",
    });
  });

  it("maps a login response that defers to the TOTP challenge", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          session_token: "",
          session_expires_at: "0001-01-01T00:00:00Z",
          totp_challenge: {
            challenge_id: "challenge-1",
            challenge_expires_at: "2026-05-17T10:05:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.login({
      login: "alice@example.com",
      password: "correct horse battery staple",
    });

    expect(result).toEqual({
      ok: true,
      auth: {
        accountID: "account-1",
        sessionToken: "",
        sessionExpiresAt: "0001-01-01T00:00:00Z",
        totpChallenge: {
          challengeID: "challenge-1",
          challengeExpiresAt: "2026-05-17T10:05:00.000Z",
        },
      },
    });
  });

  it("starts a TOTP enrollment and surfaces the secret + provisioning URI", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          secret_base32: "JBSWY3DPEHPK3PXP",
          provisioning_uri:
            "otpauth://totp/ovumcy-sync-community:owner@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ovumcy-sync-community",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.startTOTPEnrollment("session-1", {
      currentPassword: "correct horse battery staple",
    });

    expect(result).toEqual({
      ok: true,
      enrollment: {
        secretBase32: "JBSWY3DPEHPK3PXP",
        provisioningURI:
          "otpauth://totp/ovumcy-sync-community:owner@example.com?secret=JBSWY3DPEHPK3PXP&issuer=ovumcy-sync-community",
      },
    });
    expect(typedFetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/auth/totp/enroll",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("maps totp verify status responses", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "totp_enabled" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.verifyTOTPEnrollment("session-1", {
      code: "123456",
    });

    expect(result).toEqual({ ok: true });
  });

  it("propagates totp_invalid_code on verify failures", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "totp_invalid_code" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.verifyTOTPEnrollment("session-1", {
      code: "000000",
    });

    expect(result).toEqual({ ok: false, errorCode: "totp_invalid_code" });
  });

  it("completes a TOTP challenge and returns a real session", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "account-1",
          session_token: "session-after-totp",
          session_expires_at: "2026-05-18T10:00:00.000Z",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    const result = await client.completeTOTPChallenge({
      challengeID: "challenge-1",
      code: "123456",
    });

    expect(result).toEqual({
      ok: true,
      auth: {
        accountID: "account-1",
        sessionToken: "session-after-totp",
        sessionExpiresAt: "2026-05-18T10:00:00.000Z",
      },
    });
    expect(typedFetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/auth/totp/challenge",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("getSession reports the current two-factor state", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ account_id: "a1", login: "u", totp_enabled: true }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        // Legacy server that omits the field: defaults to disabled.
        new Response(JSON.stringify({ account_id: "a1", login: "u" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    await expect(client.getSession("session-1")).resolves.toEqual({
      ok: true,
      session: { twoFactorEnabled: true },
    });
    await expect(client.getSession("session-1")).resolves.toEqual({
      ok: true,
      session: { twoFactorEnabled: false },
    });
    expect(typedFetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8080/auth/session",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("deletes the self-hosted account with a DELETE /account bearer request and tolerates an empty body", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    await expect(client.deleteAccount("session-1")).resolves.toEqual({
      ok: true,
    });
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("http://127.0.0.1:8080/account");
    expect(call?.[1]?.method).toBe("DELETE");
    expect((call?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer session-1",
    );
    expect((call?.[1] as RequestInit).redirect).toBe("error");
  });

  it("maps deleteAccount error keys, including unauthorized and network failure", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockRejectedValueOnce(new Error("offline"));
    const typedFetchMock = fetchMock as jest.MockedFunction<typeof fetch>;
    const client = createSyncAPIClient("http://127.0.0.1:8080/", typedFetchMock);

    await expect(client.deleteAccount("session-1")).resolves.toEqual({
      ok: false,
      errorCode: "unauthorized",
    });
    await expect(client.deleteAccount("session-1")).resolves.toEqual({
      ok: false,
      errorCode: "network_failed",
    });
  });
});
