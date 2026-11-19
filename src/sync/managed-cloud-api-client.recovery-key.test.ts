import { createManagedCloudAPIClient } from "./managed-cloud-api-client";
import type { WrappedSyncKeyMetadata } from "./sync-contract";

const PACKAGE: WrappedSyncKeyMetadata = {
  algorithm: "xchacha20poly1305",
  kdf: "bip39_seed_hkdf_sha256",
  mnemonicWordCount: 12,
  wrapNonceHex: "aa".repeat(24),
  wrappedMasterKeyHex: "bb".repeat(48),
  phraseFingerprintHex: "cc".repeat(32),
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createClient(fetch: jest.Mock) {
  return createManagedCloudAPIClient(
    "https://managed.example/",
    fetch as unknown as typeof globalThis.fetch,
  );
}

describe("managed-cloud-api-client replaceRecoveryKey", () => {
  it("PUTs the step-up and the snake_case package, with the code only when given", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { status: "recovery_key_replaced" }))
      .mockResolvedValueOnce(jsonResponse(200, { status: "recovery_key_replaced" }));
    const client = createClient(fetch);

    await expect(
      client.replaceRecoveryKey("managed-session-1", {
        currentPassword: "very secure password 12345",
        recoveryKeyPackage: PACKAGE,
      }),
    ).resolves.toEqual({ ok: true });
    await expect(
      client.replaceRecoveryKey("managed-session-1", {
        currentPassword: "very secure password 12345",
        code: "123456",
        recoveryKeyPackage: PACKAGE,
      }),
    ).resolves.toEqual({ ok: true });

    const [passwordOnly, withCode] = fetch.mock.calls;
    expect(passwordOnly?.[0]).toBe("https://managed.example/account/recovery-key");
    expect(passwordOnly?.[1]?.method).toBe("PUT");
    expect((passwordOnly?.[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer managed-session-1",
    );
    expect((passwordOnly?.[1] as RequestInit).redirect).toBe("error");
    const expectedPackage = {
      algorithm: "xchacha20poly1305",
      kdf: "bip39_seed_hkdf_sha256",
      mnemonic_word_count: 12,
      wrap_nonce_hex: PACKAGE.wrapNonceHex,
      wrapped_master_key_hex: PACKAGE.wrappedMasterKeyHex,
      phrase_fingerprint_hex: PACKAGE.phraseFingerprintHex,
    };
    // additionalProperties: false at both levels — no extra key may appear.
    expect(JSON.parse(String(passwordOnly?.[1]?.body))).toStrictEqual({
      current_password: "very secure password 12345",
      recovery_key_package: expectedPackage,
    });
    expect(JSON.parse(String(withCode?.[1]?.body))).toStrictEqual({
      current_password: "very secure password 12345",
      code: "123456",
      recovery_key_package: expectedPackage,
    });
  });

  it("treats a 200 with another status as an unreadable answer", async () => {
    const fetch = jest.fn().mockResolvedValueOnce(jsonResponse(200, { status: "ok" }));

    await expect(
      createClient(fetch).replaceRecoveryKey("s", {
        currentPassword: "pw",
        recoveryKeyPackage: PACKAGE,
      }),
    ).resolves.toEqual({ ok: false, errorCode: "invalid_response" });
  });

  it.each([
    [400, "invalid_json", "generic"],
    [400, "invalid_recovery_package", "invalid_recovery_package"],
    [401, "invalid_current_password", "invalid_current_password"],
    [401, "totp_invalid_code", "totp_invalid_code"],
    [401, "totp_replayed", "totp_replayed"],
    [401, "unauthorized", "unauthorized"],
    [404, "sync_account_not_found", "sync_account_not_found"],
    [429, "rate_limited", "rate_limited"],
    [502, "sync_bridge_unavailable", "sync_bridge_unavailable"],
    [503, "totp_not_configured", "totp_not_configured"],
  ] as const)("maps %i %s to %s", async (status, error, expected) => {
    const fetch = jest.fn().mockResolvedValueOnce(jsonResponse(status, { error }));

    await expect(
      createClient(fetch).replaceRecoveryKey("s", {
        currentPassword: "pw",
        recoveryKeyPackage: PACKAGE,
      }),
    ).resolves.toEqual({ ok: false, errorCode: expected });
  });

  it("reports a thrown fetch as network_failed", async () => {
    const fetch = jest.fn().mockRejectedValueOnce(new Error("offline"));

    await expect(
      createClient(fetch).replaceRecoveryKey("s", {
        currentPassword: "pw",
        recoveryKeyPackage: PACKAGE,
      }),
    ).resolves.toEqual({ ok: false, errorCode: "network_failed" });
  });
});
