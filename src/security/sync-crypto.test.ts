import {
  buildLegacySyncPayloadAad,
  buildLegacyV2SyncPayloadAad,
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

const GENERATION = 1_763_400_000_000;

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
    const aad = buildSyncPayloadAad(3, GENERATION);

    const envelope = encryptSyncPayload(record.masterKeyHex, payload, aad);
    const decrypted = decryptSyncPayload(record.masterKeyHex, envelope, aad);

    expect(new TextDecoder().decode(decrypted)).toBe("sensitive sync payload");
  });

  it("builds the snapshot AAD from the schema version and generation with no device id", () => {
    expect(new TextDecoder().decode(buildSyncPayloadAad(3, GENERATION))).toBe(
      `ovumcy-sync-v3|3|${GENERATION}`,
    );
    expect(new TextDecoder().decode(buildLegacyV2SyncPayloadAad(3))).toBe(
      "ovumcy-sync-v2|3",
    );
    expect(new TextDecoder().decode(buildLegacySyncPayloadAad("dev-1"))).toBe(
      "ovumcy-sync-v1|dev-1",
    );
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
    "refuses to build a snapshot AAD for generation %p",
    (generation) => {
      expect(() => buildSyncPayloadAad(3, generation)).toThrow("invalid_sync_generation");
    },
  );

  it("rejects sync payload decryption with a different schema version AAD", () => {
    const { record } = createSyncSecretsRecord(
      "Galaxy",
      new Date("2026-03-19T08:15:00.000Z"),
    );
    const payload = new TextEncoder().encode("sensitive sync payload");
    const envelope = encryptSyncPayload(
      record.masterKeyHex,
      payload,
      buildSyncPayloadAad(3, GENERATION),
    );

    expect(() =>
      decryptSyncSnapshotPayload(
        record.masterKeyHex,
        envelope,
        2,
        GENERATION,
        record.device.deviceID,
      ),
    ).toThrow();
  });

  it("rejects sync payload decryption with a different generation AAD", () => {
    const { record } = createSyncSecretsRecord(
      "Galaxy",
      new Date("2026-03-19T08:15:00.000Z"),
    );
    const payload = new TextEncoder().encode("sensitive sync payload");
    const envelope = encryptSyncPayload(
      record.masterKeyHex,
      payload,
      buildSyncPayloadAad(3, GENERATION),
    );

    for (const reported of [GENERATION - 1, GENERATION + 1]) {
      expect(() =>
        decryptSyncSnapshotPayload(
          record.masterKeyHex,
          envelope,
          3,
          reported,
          record.device.deviceID,
        ),
      ).toThrow();
    }
  });

  describe("decryptSyncSnapshotPayload", () => {
    const payload = new TextEncoder().encode("sensitive sync payload");

    it("reports the sealed generation of a v3 blob", () => {
      const { record } = createSyncSecretsRecord(
        "Galaxy",
        new Date("2026-03-19T08:15:00.000Z"),
      );
      const envelope = encryptSyncPayload(
        record.masterKeyHex,
        payload,
        buildSyncPayloadAad(3, GENERATION),
      );

      const opened = decryptSyncSnapshotPayload(
        record.masterKeyHex,
        envelope,
        3,
        GENERATION,
        record.device.deviceID,
      );

      expect(new TextDecoder().decode(opened.payload)).toBe("sensitive sync payload");
      expect(opened.sealedGeneration).toBe(GENERATION);
    });

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
        buildLegacyV2SyncPayloadAad(3),
      );

      const opened = decryptSyncSnapshotPayload(
        recovered.masterKeyHex,
        envelope,
        3,
        GENERATION,
        recovered.device.deviceID,
      );

      expect(new TextDecoder().decode(opened.payload)).toBe("sensitive sync payload");
      expect(opened.sealedGeneration).toBeNull();
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

      const opened = decryptSyncSnapshotPayload(
        record.masterKeyHex,
        envelope,
        3,
        GENERATION,
        record.device.deviceID,
      );

      expect(new TextDecoder().decode(opened.payload)).toBe("sensitive sync payload");
      expect(opened.sealedGeneration).toBeNull();
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
          GENERATION,
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
          GENERATION,
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
