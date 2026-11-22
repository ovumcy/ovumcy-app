import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createDefaultSyncPreferencesRecord } from "./sync-contract";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  loadSyncSetupState,
  prepareSyncSetup,
  saveSyncPreferencesDraft,
} from "./sync-setup-service";

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
      managedAuthSessionToken: null,
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });

    const result = await loadSyncSetupState(storage, secretStore);

    expect(result.preferences.setupStatus).toBe("not_configured");
    expect(result.hasStoredSecrets).toBe(true);
    expect(result.hasAuthSession).toBe(false);
  });

  it("does not report an auth session when no sync secrets exist yet", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    const result = await loadSyncSetupState(storage, secretStore);

    expect(result.hasStoredSecrets).toBe(false);
    expect(result.hasAuthSession).toBe(false);
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
        lastRemoteGeneration: null,
      }),
      { restoreInProgress: false },
    );
    expect(await secretStore.readSyncSecrets()).toEqual(result.secrets);
  });

  it("preserves an existing managed cloud session when recreating local sync keys", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    await secretStore.writeSyncSecrets({
      device: {
        deviceID: "device-1",
        deviceLabel: "Old phone",
        createdAt: "2026-03-18T08:15:00.000Z",
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
      managedAuthSessionToken: "managed-session-1",
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });

    const result = await prepareSyncSetup(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
      },
      new Date("2026-03-19T08:15:00.000Z"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.secrets.managedAuthSessionToken).toBe("managed-session-1");
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        managedAuthSessionToken: "managed-session-1",
      }),
    );
  });

  // Defense-in-depth for docs/sync-trust-model.md "Guest Partner Access":
  // "Guests never see a recovery phrase." The UI hides the prepare/regenerate
  // affordance for a guest session (buildBackupSyncSetupPresentation's
  // shouldShowPrepareAction), but prepareSyncSetup is the function that
  // actually mints and returns the phrase, so it refuses independently of
  // the caller/UI state.
  it("refuses to prepare or regenerate sync secrets for a guest session, leaving existing guest secrets untouched", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const existingGuestSecrets = {
      device: {
        deviceID: "guest-device-1",
        deviceLabel: "",
        createdAt: "2026-03-18T08:15:00.000Z",
      },
      masterKeyHex: "aa",
      deviceSecretHex: "bb",
      wrappedKey: {
        algorithm: "xchacha20poly1305" as const,
        kdf: "bip39_seed_hkdf_sha256" as const,
        mnemonicWordCount: 12 as const,
        wrapNonceHex: "cc",
        wrappedMasterKeyHex: "dd",
        phraseFingerprintHex: "ee",
      },
      authSessionToken: null,
      managedAuthSessionToken: "guest-session-1",
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    };
    await secretStore.writeSyncSecrets(existingGuestSecrets);

    const result = await prepareSyncSetup(
      storage,
      secretStore,
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "managed",
        deviceLabel: "Pixel 7",
        guestSessionExpiresAt: "2026-05-05T08:00:00.000Z",
      },
      new Date("2026-03-19T08:15:00.000Z"),
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "guest_recovery_phrase_blocked",
    });
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
    // No key rotation happened out from under the guest session either.
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      existingGuestSecrets,
    );
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

  it.each(["a", "a".repeat(65), "ж".repeat(33)])(
    "rejects device label %p outside 2-64 bytes before generating any secrets",
    async (deviceLabel) => {
      const secretStore = createSyncSecretStoreMock();

      const result = await prepareSyncSetup(
        createLocalAppStorageMock(),
        secretStore,
        { ...createDefaultSyncPreferencesRecord(), mode: "managed", deviceLabel },
        new Date("2026-03-19T08:15:00.000Z"),
      );

      expect(result).toEqual({ ok: false, errorCode: "device_label_invalid_length" });
      expect(await secretStore.readSyncSecrets()).toBeNull();
    },
  );

  it("refuses to save a draft whose device label is outside 2-64 bytes", async () => {
    const storage = createLocalAppStorageMock();

    const result = await saveSyncPreferencesDraft(
      storage,
      createSyncSecretStoreMock(),
      createDefaultSyncPreferencesRecord(),
      { ...createDefaultSyncPreferencesRecord(), mode: "managed", deviceLabel: "a".repeat(65) },
      false,
    );

    expect(result).toEqual({ ok: false, errorCode: "device_label_invalid_length" });
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("saves incomplete self-hosted sync drafts without generating secrets", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    const result = await saveSyncPreferencesDraft(
      storage,
      secretStore,
      createDefaultSyncPreferencesRecord(),
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "   ",
        deviceLabel: " Phone ",
      },
      false,
    );

    expect(result).toEqual({
      ok: true,
      preferences: expect.objectContaining({
        mode: "self_hosted",
        endpointInput: "",
        normalizedEndpoint: "",
        deviceLabel: "Phone",
        setupStatus: "not_configured",
      }),
      hasStoredSecrets: false,
    });
    expect(await secretStore.readSyncSecrets()).toBeNull();
  });

  it("clears prepared sync secrets when saved sync preferences change materially", async () => {
    const savedPreferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      deviceLabel: "Pixel 7",
      setupStatus: "local_ready" as const,
      preparedAt: "2026-03-19T08:15:00.000Z",
    };
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue(savedPreferences),
    });
    const secretStore = createSyncSecretStoreMock({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
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
      managedAuthSessionToken: null,
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });

    const result = await saveSyncPreferencesDraft(
      storage,
      secretStore,
      savedPreferences,
      {
        ...savedPreferences,
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
      },
      true,
    );

    expect(result).toEqual({
      ok: true,
      preferences: expect.objectContaining({
        mode: "self_hosted",
        setupStatus: "not_configured",
        preparedAt: null,
      }),
      hasStoredSecrets: false,
    });
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
    // The cleared secrets end the backup relationship, unfinished-restore mark included.
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({ lastRemoteGeneration: null }),
      { restoreInProgress: false },
    );
  });

  it("keeps the unfinished-restore mark on a local-only draft save", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    await saveSyncPreferencesDraft(
      storage,
      secretStore,
      createDefaultSyncPreferencesRecord(),
      {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "   ",
        deviceLabel: " Phone ",
      },
      false,
    );

    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({ deviceLabel: "Phone" }),
      undefined,
    );
  });

  describe("device label and session continuity", () => {
    const storedSecrets = (overrides = {}) => ({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-03-19T08:15:00.000Z",
      },
      masterKeyHex: "aa",
      deviceSecretHex: "bb",
      wrappedKey: {
        algorithm: "xchacha20poly1305" as const,
        kdf: "bip39_seed_hkdf_sha256" as const,
        mnemonicWordCount: 12 as const,
        wrapNonceHex: "cc",
        wrappedMasterKeyHex: "dd",
        phraseFingerprintHex: "ee",
      },
      authSessionToken: null,
      managedAuthSessionToken: null,
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
      ...overrides,
    });
    const connectedSelfHosted = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      normalizedEndpoint: "http://192.168.1.20:8080",
      deviceLabel: "Pixel 7",
      setupStatus: "connected" as const,
      preparedAt: "2026-03-19T08:15:00.000Z",
      lastRemoteGeneration: 42,
      lastSyncedAt: "2026-03-20T08:15:00.000Z",
    };

    it("relabels a connected device in place, keeping its keys, session and rollback floor", async () => {
      const storage = createLocalAppStorageMock();
      const secrets = storedSecrets({ authSessionToken: "session-1" });
      const secretStore = createSyncSecretStoreMock(secrets);

      const result = await saveSyncPreferencesDraft(
        storage,
        secretStore,
        connectedSelfHosted,
        { ...connectedSelfHosted, deviceLabel: " Tablet " },
        true,
      );

      expect(result).toEqual({
        ok: true,
        preferences: expect.objectContaining({
          deviceLabel: "Tablet",
          setupStatus: "connected",
          preparedAt: connectedSelfHosted.preparedAt,
          lastRemoteGeneration: 42,
          lastSyncedAt: connectedSelfHosted.lastSyncedAt,
        }),
        hasStoredSecrets: true,
      });
      await expect(secretStore.readSyncSecrets()).resolves.toEqual({
        ...secrets,
        device: { ...secrets.device, deviceLabel: "Tablet" },
      });
      expect(storage.writeManagedBillingCacheRecord).not.toHaveBeenCalled();
      expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
      );
    });

    it("keeps the stored device label when the draft label is cleared", async () => {
      const secrets = storedSecrets();
      const secretStore = createSyncSecretStoreMock(secrets);

      const result = await saveSyncPreferencesDraft(
        createLocalAppStorageMock(),
        secretStore,
        connectedSelfHosted,
        { ...connectedSelfHosted, deviceLabel: "  " },
        true,
      );

      expect(result).toMatchObject({ ok: true, hasStoredSecrets: true });
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(secrets);
    });

    it("skips the relabel when the secret record is already gone", async () => {
      const secretStore = createSyncSecretStoreMock();

      const result = await saveSyncPreferencesDraft(
        createLocalAppStorageMock(),
        secretStore,
        connectedSelfHosted,
        { ...connectedSelfHosted, deviceLabel: "Tablet" },
        true,
      );

      expect(result).toMatchObject({ ok: true });
      await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
    });

    it("keeps the self-hosted session and managed refresh fields when regenerating keys for the same server", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(connectedSelfHosted),
      });
      const secretStore = createSyncSecretStoreMock(
        storedSecrets({
          authSessionToken: "session-1",
          managedAuthSessionToken: "managed-1",
          managedAuthSessionExpiresAt: "2026-03-21T08:15:00.000Z",
          managedRefreshToken: "refresh-1",
          managedRefreshTokenExpiresAt: "2026-04-19T08:15:00.000Z",
        }),
      );

      const result = await prepareSyncSetup(
        storage,
        secretStore,
        connectedSelfHosted,
        new Date("2026-03-22T08:15:00.000Z"),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.secrets).toMatchObject({
        authSessionToken: "session-1",
        managedAuthSessionToken: "managed-1",
        managedAuthSessionExpiresAt: "2026-03-21T08:15:00.000Z",
        managedRefreshToken: "refresh-1",
        managedRefreshTokenExpiresAt: "2026-04-19T08:15:00.000Z",
      });
      expect(result.secrets.masterKeyHex).not.toBe("aa");
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(result.secrets);
    });

    it("starts without a session when preparing a saved self-hosted setup for the first time", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(connectedSelfHosted),
      });
      const secretStore = createSyncSecretStoreMock();

      const result = await prepareSyncSetup(
        storage,
        secretStore,
        connectedSelfHosted,
        new Date("2026-03-22T08:15:00.000Z"),
      );

      expect(result.ok).toBe(true);
      await expect(secretStore.readSyncSecrets()).resolves.toMatchObject({
        authSessionToken: null,
        managedAuthSessionToken: null,
      });
    });

    it.each([
      [
        "another self-hosted server",
        { ...connectedSelfHosted, endpointInput: "192.168.1.30:8080" },
        connectedSelfHosted,
      ],
      [
        "a switch from managed",
        connectedSelfHosted,
        { ...createDefaultSyncPreferencesRecord(), mode: "managed" as const },
      ],
    ])(
      "drops a self-hosted session token when regenerating keys for %s",
      async (_case, draft, saved) => {
        const storage = createLocalAppStorageMock({
          readSyncPreferencesRecord: jest.fn().mockResolvedValue(saved),
        });
        const secretStore = createSyncSecretStoreMock(
          storedSecrets({ authSessionToken: "session-1" }),
        );

        const result = await prepareSyncSetup(
          storage,
          secretStore,
          draft,
          new Date("2026-03-22T08:15:00.000Z"),
        );

        expect(result.ok).toBe(true);
        await expect(secretStore.readSyncSecrets()).resolves.toMatchObject({
          authSessionToken: null,
        });
      },
    );
  });
});

describe("sync key and account binding", () => {
  const NOW = new Date("2026-03-22T08:15:00.000Z");
  const boundManaged = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed" as const,
    deviceLabel: "Pixel 7",
    setupStatus: "local_ready" as const,
    accountId: "account-a",
  };

  it("binds a key set up while signed out to no account, so the next sign-in keeps it", async () => {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue(boundManaged),
    });

    const result = await prepareSyncSetup(storage, createSyncSecretStoreMock(), boundManaged, NOW);

    expect(result.ok && result.preferences.accountId).toBeNull();
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: null }),
      { restoreInProgress: false },
    );
  });

  it("keeps the account bound when new keys keep the signed-in session", async () => {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue(boundManaged),
    });
    const secretStore = createSyncSecretStoreMock({
      ...createSyncSecretsRecord("Pixel 7", NOW).record,
      managedAuthSessionToken: "managed-1",
    });

    const result = await prepareSyncSetup(storage, secretStore, boundManaged, NOW);

    expect(result.ok && result.preferences.accountId).toBe("account-a");
  });

  it("ignores a leftover token of the other mode when deciding the new key's account", async () => {
    const boundSelfHosted = {
      ...boundManaged,
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
    };
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue(boundSelfHosted),
    });
    const secretStore = createSyncSecretStoreMock({
      ...createSyncSecretsRecord("Pixel 7", NOW).record,
      managedAuthSessionToken: "stale-managed",
    });

    const result = await prepareSyncSetup(storage, secretStore, boundSelfHosted, NOW);

    expect(result.ok && result.preferences.accountId).toBeNull();
  });

  it("unbinds the account when a material draft change clears the keys, and keeps it on a relabel", async () => {
    const secrets = createSyncSecretsRecord("Pixel 7", NOW).record;

    const material = await saveSyncPreferencesDraft(
      createLocalAppStorageMock(),
      createSyncSecretStoreMock(secrets),
      boundManaged,
      { ...boundManaged, mode: "self_hosted", endpointInput: "192.168.1.20:8080" },
      true,
    );
    const relabel = await saveSyncPreferencesDraft(
      createLocalAppStorageMock(),
      createSyncSecretStoreMock(secrets),
      boundManaged,
      { ...boundManaged, deviceLabel: "Pixel 8" },
      true,
    );

    expect(material.ok && material.preferences.accountId).toBeNull();
    expect(relabel.ok && relabel.preferences.accountId).toBe("account-a");
  });
});
