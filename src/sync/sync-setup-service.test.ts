import { createDefaultSyncPreferencesRecord } from "./sync-contract";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { loadSyncSetupState, prepareSyncSetup } from "./sync-setup-service";

describe("sync-setup-service", () => {
  it("loads sync preferences together with secret presence", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    await secretStore.writeSyncSecrets({
      device: {
        deviceID: "device-1",
        deviceLabel: "Phone",
        createdAt: "2026-03-19T08:15:00.000Z",
      },
      masterKeyHex: "aa",
      deviceSecretHex: "bb",
      wrappedKey: {
        algorithm: "xchacha20poly1305",
        kdf: "bip39_seed_hkdf_sha256",
        mnemonicWordCount: 12,
        wrapNonceHex: "cc",
        wrappedMasterKeyHex: "dd",
        phraseFingerprintHex: "ee",
      },
      authSessionToken: null,
    });

    const result = await loadSyncSetupState(storage, secretStore);

    expect(result.preferences.setupStatus).toBe("not_configured");
    expect(result.hasStoredSecrets).toBe(true);
  });

  it("prepares encrypted sync secrets and persists normalized preferences", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const currentPreferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      deviceLabel: "Pixel 7",
    };

    const result = await prepareSyncSetup(
      storage,
      secretStore,
      currentPreferences,
      new Date("2026-03-19T08:15:00.000Z"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.recoveryPhrase.split(" ")).toHaveLength(12);
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedEndpoint: "http://192.168.1.20:8080",
        setupStatus: "local_ready",
      }),
    );
    expect(await secretStore.readSyncSecrets()).toEqual(result.secrets);
  });

  it("rejects missing device labels before generating any secrets", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    const result = await prepareSyncSetup(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "   ",
      },
      new Date("2026-03-19T08:15:00.000Z"),
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "device_label_required",
    });
    expect(await secretStore.readSyncSecrets()).toBeNull();
  });

  it("rejects invalid self-hosted endpoints before persisting any sync state", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    const result = await prepareSyncSetup(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "https://",
        deviceLabel: "Pixel 7",
      },
      new Date("2026-03-19T08:15:00.000Z"),
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "invalid_endpoint",
    });
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
    expect(await secretStore.readSyncSecrets()).toBeNull();
  });
});
