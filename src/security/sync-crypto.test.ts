import {
  createSyncSecretsRecord,
  decryptSyncPayload,
  encryptSyncPayload,
  isValidRecoveryPhrase,
  unwrapMasterKeyWithRecoveryPhrase,
  wrapMasterKeyWithRecoveryPhrase,
} from "./sync-crypto";

describe("sync-crypto", () => {
  it("generates a valid 12-word recovery phrase and wraps the master key", () => {
    const now = new Date("2026-03-19T08:15:00.000Z");
    const result = createSyncSecretsRecord("Pixel 7", now);

    expect(isValidRecoveryPhrase(result.recoveryPhrase)).toBe(true);
    expect(result.recoveryPhrase.split(" ")).toHaveLength(12);
    expect(result.record.device.deviceLabel).toBe("Pixel 7");
    expect(result.record.device.createdAt).toBe(now.toISOString());

    const unwrapped = unwrapMasterKeyWithRecoveryPhrase(
      result.recoveryPhrase,
      result.record.wrappedKey,
    );
    expect(unwrapped).toBe(result.record.masterKeyHex);
  });

  it("encrypts and decrypts payloads with the generated master key", () => {
    const { record } = createSyncSecretsRecord(
      "Galaxy",
      new Date("2026-03-19T08:15:00.000Z"),
    );
    const payload = new TextEncoder().encode("sensitive sync payload");

    const envelope = encryptSyncPayload(record.masterKeyHex, payload);
    const decrypted = decryptSyncPayload(record.masterKeyHex, envelope);

    expect(new TextDecoder().decode(decrypted)).toBe("sensitive sync payload");
  });

  it("rewraps an existing master key with a fresh recovery phrase", () => {
    const { recoveryPhrase, record } = createSyncSecretsRecord(
      "Tablet",
      new Date("2026-03-19T08:15:00.000Z"),
    );
    const rewrapped = wrapMasterKeyWithRecoveryPhrase(
      recoveryPhrase,
      record.masterKeyHex,
    );

    expect(
      unwrapMasterKeyWithRecoveryPhrase(recoveryPhrase, rewrapped),
    ).toBe(record.masterKeyHex);
  });

  it("rejects invalid recovery phrases before wrapping or unwrapping keys", () => {
    const { recoveryPhrase, record } = createSyncSecretsRecord(
      "Phone",
      new Date("2026-03-19T08:15:00.000Z"),
    );
    const invalidPhrase = recoveryPhrase
      .split(" ")
      .slice(0, 11)
      .join(" ");

    expect(() =>
      wrapMasterKeyWithRecoveryPhrase(invalidPhrase, record.masterKeyHex),
    ).toThrow("invalid_recovery_phrase");
    expect(() =>
      unwrapMasterKeyWithRecoveryPhrase(invalidPhrase, record.wrappedKey),
    ).toThrow("invalid_recovery_phrase");
  });

  it("fails to unwrap a master key with the wrong recovery phrase", () => {
    const first = createSyncSecretsRecord(
      "Phone",
      new Date("2026-03-19T08:15:00.000Z"),
    );
    const second = createSyncSecretsRecord(
      "Tablet",
      new Date("2026-03-19T08:20:00.000Z"),
    );

    expect(() =>
      unwrapMasterKeyWithRecoveryPhrase(
        second.recoveryPhrase,
        first.record.wrappedKey,
      ),
    ).toThrow();
  });
});
