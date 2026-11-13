import {
  buildLegacySyncPayloadAad,
  buildSyncPayloadAad,
  createRecoveredSyncSecretsRecord,
  createSyncSecretsRecord,
  decryptSyncPayload,
  decryptSyncSnapshotPayload,
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

  it("encrypts and decrypts payloads with the generated master key and matching AAD", () => {
    const { record } = createSyncSecretsRecord(
      "Galaxy",
      new Date("2026-03-19T08:15:00.000Z"),
    );
    const payload = new TextEncoder().encode("sensitive sync payload");
    const aad = buildSyncPayloadAad(3);

    const envelope = encryptSyncPayload(record.masterKeyHex, payload, aad);
    const decrypted = decryptSyncPayload(record.masterKeyHex, envelope, aad);

    expect(new TextDecoder().decode(decrypted)).toBe("sensitive sync payload");
  });

  it("builds the snapshot AAD from the schema version with no device id", () => {
    expect(new TextDecoder().decode(buildSyncPayloadAad(3))).toBe("ovumcy-sync-v2|3");
    expect(new TextDecoder().decode(buildLegacySyncPayloadAad("dev-1"))).toBe(
      "ovumcy-sync-v1|dev-1",
    );
  });

  it("rejects sync payload decryption with a different schema version AAD", () => {
    const { record } = createSyncSecretsRecord(
      "Galaxy",
      new Date("2026-03-19T08:15:00.000Z"),
    );
    const payload = new TextEncoder().encode("sensitive sync payload");
    const envelope = encryptSyncPayload(
      record.masterKeyHex,
      payload,
      buildSyncPayloadAad(3),
    );

    expect(() =>
      decryptSyncSnapshotPayload(record.masterKeyHex, envelope, 2, record.device.deviceID),
    ).toThrow();
  });

  describe("decryptSyncSnapshotPayload", () => {
    const payload = new TextEncoder().encode("sensitive sync payload");

    it("opens a v2 blob on a device with a different device id", () => {
      const uploader = createSyncSecretsRecord(
        "Device A",
        new Date("2026-03-19T08:15:00.000Z"),
      );
      const recovered = createRecoveredSyncSecretsRecord(
        uploader.recoveryPhrase,
        uploader.record.wrappedKey,
        "Device B",
        new Date("2026-03-19T09:00:00.000Z"),
      );
      expect(recovered.device.deviceID).not.toBe(uploader.record.device.deviceID);
      const envelope = encryptSyncPayload(
        uploader.record.masterKeyHex,
        payload,
        buildSyncPayloadAad(3),
      );

      const decrypted = decryptSyncSnapshotPayload(
        recovered.masterKeyHex,
        envelope,
        3,
        recovered.device.deviceID,
      );

      expect(new TextDecoder().decode(decrypted)).toBe("sensitive sync payload");
    });

    it("falls back to the legacy AAD built from the local device id", () => {
      const { record } = createSyncSecretsRecord(
        "Galaxy",
        new Date("2026-03-19T08:15:00.000Z"),
      );
      const envelope = encryptSyncPayload(
        record.masterKeyHex,
        payload,
        buildLegacySyncPayloadAad(record.device.deviceID),
      );

      const decrypted = decryptSyncSnapshotPayload(
        record.masterKeyHex,
        envelope,
        3,
        record.device.deviceID,
      );

      expect(new TextDecoder().decode(decrypted)).toBe("sensitive sync payload");
    });

    it("refuses a legacy blob written by another device", () => {
      const { record } = createSyncSecretsRecord(
        "Galaxy",
        new Date("2026-03-19T08:15:00.000Z"),
      );
      const envelope = encryptSyncPayload(
        record.masterKeyHex,
        payload,
        buildLegacySyncPayloadAad("another-device"),
      );

      expect(() =>
        decryptSyncSnapshotPayload(
          record.masterKeyHex,
          envelope,
          3,
          record.device.deviceID,
        ),
      ).toThrow();
    });

    it("refuses a blob sealed under an unrelated AAD", () => {
      const { record } = createSyncSecretsRecord(
        "Galaxy",
        new Date("2026-03-19T08:15:00.000Z"),
      );
      const envelope = encryptSyncPayload(
        record.masterKeyHex,
        payload,
        new TextEncoder().encode("ovumcy-sync-v2|tampered"),
      );

      expect(() =>
        decryptSyncSnapshotPayload(
          record.masterKeyHex,
          envelope,
          3,
          record.device.deviceID,
        ),
      ).toThrow();
    });
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
