import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncCapabilityDocument,
  type SyncPreferencesRecord,
} from "./sync-contract";
import {
  connectSyncAccount,
  finalizeSyncSessionAfterTOTP,
  persistGuestPartnerSession,
  runSyncRestore,
  runSyncUpload,
  upgradeGuestPartnerAccount,
} from "./sync-client-service";
import { advanceSyncWipeEpoch, readSyncWipeEpoch } from "./sync-wipe-epoch";

const NOW = new Date("2026-03-20T08:10:00.000Z");

const CAPABILITIES: SyncCapabilityDocument = {
  mode: "self_hosted",
  syncEnabled: true,
  recoverySupported: true,
  pushSupported: false,
  portalSupported: false,
  advancedCloudInsights: false,
  maxDevices: 5,
  maxBlobBytes: 16 << 20,
};

function selfHosted(overrides: Partial<SyncPreferencesRecord> = {}): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted",
    endpointInput: "192.168.1.20:8080",
    normalizedEndpoint: "http://192.168.1.20:8080",
    deviceLabel: "Pixel 7",
    setupStatus: "connected",
    ...overrides,
  };
}

function preparedSecrets(overrides: Record<string, unknown> = {}) {
  const prepared = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
  return { ...prepared.record, authSessionToken: "session-1", ...overrides };
}

function storageFor(preferences: SyncPreferencesRecord) {
  return createLocalAppStorageMock({
    readSyncPreferencesRecord: jest.fn().mockResolvedValue(preferences),
  });
}

describe("sync flows superseded by a local wipe", () => {
  it("writes no preferences when a wipe lands during the blob upload", async () => {
    const preferences = selfHosted({ lastRemoteGeneration: 100 });
    const storage = storageFor(preferences);
    const secretStore = createSyncSecretStoreMock(preparedSecrets());
    const secrets = await secretStore.readSyncSecrets();
    const api = {
      getCapabilities: jest.fn().mockResolvedValue({ ok: true, capabilities: CAPABILITIES }),
      getRecoveryKey: jest.fn().mockResolvedValue({ ok: true, recoveryKey: secrets!.wrappedKey }),
      getBlob: jest.fn(),
      putRecoveryKey: jest.fn(),
      putBlob: jest.fn().mockImplementation(async () => {
        advanceSyncWipeEpoch();
        return {
          ok: true,
          blob: {
            schemaVersion: 1,
            generation: NOW.getTime(),
            checksumSHA256: "00",
            ciphertextBase64: "",
            ciphertextSize: 0,
            updatedAt: NOW.toISOString(),
          },
        };
      }),
    } as unknown as SyncAPIClient;

    const result = await runSyncUpload(storage, secretStore, preferences, NOW, () => api, jest.fn());

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("keeps the restore mark untouched when a wipe lands during the blob read", async () => {
    const preferences = selfHosted({ lastRemoteGeneration: 100, restoreInProgress: true });
    const storage = storageFor(preferences);
    const api = {
      getBlob: jest.fn().mockImplementation(async () => {
        advanceSyncWipeEpoch();
        return { ok: false, errorCode: "blob_not_found" };
      }),
    } as unknown as SyncAPIClient;

    const result = await runSyncRestore(
      storage,
      createSyncSecretStoreMock(preparedSecrets()),
      preferences,
      () => api,
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("writes no secrets or preferences when a wipe lands during a self-hosted sign-in", async () => {
    const preferences = selfHosted({ setupStatus: "local_ready" });
    const storage = storageFor(preferences);
    const secretStore = createSyncSecretStoreMock(preparedSecrets({ authSessionToken: null }));
    const writeSyncSecrets = jest.spyOn(secretStore, "writeSyncSecrets");
    const api = {
      login: jest.fn().mockResolvedValue({
        ok: true,
        auth: { accountID: "acct-1", sessionToken: "session-2" },
      }),
      getCapabilities: jest.fn().mockImplementation(async () => {
        advanceSyncWipeEpoch();
        return { ok: true, capabilities: CAPABILITIES };
      }),
      attachDevice: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as SyncAPIClient;

    const result = await connectSyncAccount(
      storage,
      secretStore,
      preferences,
      { login: "owner", password: "correct horse battery" },
      "login",
      NOW,
      () => api,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(writeSyncSecrets).not.toHaveBeenCalled();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("persists no guest session accepted before a wipe", async () => {
    const storage = storageFor(createDefaultSyncPreferencesRecord());
    const secretStore = createSyncSecretStoreMock(null);
    const writeSyncSecrets = jest.spyOn(secretStore, "writeSyncSecrets");
    const acceptedAt = readSyncWipeEpoch();
    advanceSyncWipeEpoch();

    const result = await persistGuestPartnerSession(
      storage,
      secretStore,
      createDefaultSyncPreferencesRecord(),
      { sessionToken: "guest-session", sessionExpiresAt: "2026-04-20T08:00:00.000Z" },
      NOW,
      acceptedAt,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(writeSyncSecrets).not.toHaveBeenCalled();
    expect(storage.writeManagedBillingCacheRecord).not.toHaveBeenCalled();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });
});

describe("unfinished-restore mark across an account change", () => {
  function finalizeWith(storedAccountId: string | null, signedInAccountId: string | undefined) {
    const preferences = selfHosted({ accountId: storedAccountId, setupStatus: "local_ready" });
    const storage = storageFor(preferences);
    const api = {
      getCapabilities: jest.fn().mockResolvedValue({ ok: true, capabilities: CAPABILITIES }),
      attachDevice: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as SyncAPIClient;
    return {
      storage,
      run: () =>
        finalizeSyncSessionAfterTOTP(
          storage,
          createSyncSecretStoreMock(preparedSecrets({ authSessionToken: null })),
          preferences,
          signedInAccountId === undefined
            ? { sessionToken: "session-2" }
            : { sessionToken: "session-2", accountID: signedInAccountId },
          () => api,
          jest.fn(),
          NOW,
        ),
    };
  }

  it("clears the mark when the sign-in reaches a known, different account", async () => {
    const harness = finalizeWith("acct-a", "acct-b");
    await harness.run();
    expect(harness.storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acct-b" }),
      { restoreInProgress: false },
    );
  });

  it.each([
    ["the same account", "acct-a", "acct-a"],
    ["an unknown signed-in account", "acct-a", undefined],
    ["an unbound key", null, "acct-b"],
  ])("keeps the mark on %s", async (_label, stored, signedIn) => {
    const harness = finalizeWith(stored, signedIn);
    await harness.run();
    const write = harness.storage.writeSyncPreferencesRecord as jest.Mock;
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]).toHaveLength(1);
  });

  it("decides from the stored account, not the caller's stale copy", async () => {
    const callerCopy = selfHosted({ accountId: "acct-a", setupStatus: "local_ready" });
    const storage = storageFor(selfHosted({ accountId: "acct-b", setupStatus: "local_ready" }));
    const api = {
      getCapabilities: jest.fn().mockResolvedValue({ ok: true, capabilities: CAPABILITIES }),
      attachDevice: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as SyncAPIClient;

    await finalizeSyncSessionAfterTOTP(
      storage,
      createSyncSecretStoreMock(preparedSecrets({ authSessionToken: null })),
      callerCopy,
      { sessionToken: "session-2", accountID: "acct-b" },
      () => api,
      jest.fn(),
      NOW,
    );

    const write = storage.writeSyncPreferencesRecord as jest.Mock;
    expect(write.mock.calls[0]).toHaveLength(1);
  });
});

describe("guest upgrade binds the key to the upgraded account", () => {
  function upgradeWith(storedAccountId: string | null) {
    const preferences: SyncPreferencesRecord = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed",
      setupStatus: "connected",
      accountId: storedAccountId,
      guestSessionExpiresAt: "2026-04-20T08:00:00.000Z",
    };
    const storage = storageFor(preferences);
    const secrets = preparedSecrets({ authSessionToken: null, managedAuthSessionToken: "guest" });
    const secretStore = createSyncSecretStoreMock(secrets);
    const managed = {
      upgradeGuestAccount: jest.fn().mockResolvedValue({
        ok: true,
        result: { accountID: "acct-upgraded", email: "owner@example.com", recoveryCode: "RC" },
      }),
    } as unknown as ManagedCloudAPIClient;
    return {
      storage,
      secretStore,
      secrets,
      run: () =>
        upgradeGuestPartnerAccount(
          storage,
          secretStore,
          preferences,
          { email: "owner@example.com", password: "correct horse battery" },
          () => managed,
          NOW,
        ),
    };
  }

  it("replaces a key last used with another account and reports the reset", async () => {
    const harness = upgradeWith("acct-previous-owner");

    const result = await harness.run();

    expect(result).toMatchObject({ ok: true, accountKeyReset: true });
    const stored = await harness.secretStore.readSyncSecrets();
    expect(stored?.masterKeyHex).not.toBe(harness.secrets.masterKeyHex);
    expect(stored?.managedAuthSessionToken).toBe("guest");
    expect(stored?.recoveryPhraseUnrevealed).toBe(true);
    expect(result.preferences.accountId).toBe("acct-upgraded");
  });

  it("keeps a key minted at the guest accept and binds it to the upgraded account", async () => {
    const harness = upgradeWith(null);

    const result = await harness.run();

    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty("accountKeyReset");
    const stored = await harness.secretStore.readSyncSecrets();
    expect(stored?.masterKeyHex).toBe(harness.secrets.masterKeyHex);
    expect(result.preferences.accountId).toBe("acct-upgraded");
  });

  it("writes no secrets or preferences when a wipe lands during the upgrade request", async () => {
    const harness = upgradeWith("acct-previous-owner");
    const writeSecrets = jest.spyOn(harness.secretStore, "writeSyncSecrets");
    const managed = {
      upgradeGuestAccount: jest.fn().mockImplementation(async () => {
        advanceSyncWipeEpoch();
        return {
          ok: true,
          result: { accountID: "acct-upgraded", email: "owner@example.com", recoveryCode: "RC" },
        };
      }),
    } as unknown as ManagedCloudAPIClient;

    const result = await upgradeGuestPartnerAccount(
      harness.storage,
      harness.secretStore,
      { ...createDefaultSyncPreferencesRecord(), mode: "managed", accountId: "acct-previous-owner" },
      { email: "owner@example.com", password: "correct horse battery" },
      () => managed,
      NOW,
    );

    expect(result).toMatchObject({ ok: false, errorCode: "unauthorized" });
    expect(writeSecrets).not.toHaveBeenCalled();
    expect(harness.storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });
});

describe("sign-in flows superseded by a local wipe", () => {
  const managedPreferences = (): SyncPreferencesRecord => ({
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed",
    setupStatus: "local_ready",
  });

  it("writes nothing when a wipe lands during a managed sign-in", async () => {
    const storage = storageFor(managedPreferences());
    const secretStore = createSyncSecretStoreMock(preparedSecrets({ authSessionToken: null }));
    const writeSyncSecrets = jest.spyOn(secretStore, "writeSyncSecrets");
    const managed = {
      login: jest.fn().mockImplementation(async () => {
        advanceSyncWipeEpoch();
        return {
          ok: true,
          auth: { accountID: "acct-1", sessionToken: "managed-1", sessionExpiresAt: "" },
        };
      }),
    } as unknown as ManagedCloudAPIClient;

    const result = await connectSyncAccount(
      storage,
      secretStore,
      managedPreferences(),
      { login: "owner@example.com", password: "correct horse battery" },
      "login",
      NOW,
      jest.fn(),
      () => managed,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(writeSyncSecrets).not.toHaveBeenCalled();
    expect(storage.writeManagedBillingCacheRecord).not.toHaveBeenCalled();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("writes nothing when a wipe lands during the managed TOTP session read", async () => {
    const storage = storageFor(managedPreferences());
    const secretStore = createSyncSecretStoreMock(preparedSecrets({ authSessionToken: null }));
    const writeSyncSecrets = jest.spyOn(secretStore, "writeSyncSecrets");
    const managed = {
      getSession: jest.fn().mockImplementation(async () => {
        advanceSyncWipeEpoch();
        return { ok: true, session: { accountID: "acct-1" } };
      }),
    } as unknown as ManagedCloudAPIClient;

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      managedPreferences(),
      { sessionToken: "managed-after-totp" },
      jest.fn(),
      () => managed,
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(writeSyncSecrets).not.toHaveBeenCalled();
    expect(storage.writeManagedBillingCacheRecord).not.toHaveBeenCalled();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("writes nothing when a wipe lands during the self-hosted TOTP device attach", async () => {
    const preferences = selfHosted({ setupStatus: "local_ready" });
    const storage = storageFor(preferences);
    const secretStore = createSyncSecretStoreMock(preparedSecrets({ authSessionToken: null }));
    const writeSyncSecrets = jest.spyOn(secretStore, "writeSyncSecrets");
    const api = {
      getCapabilities: jest.fn().mockResolvedValue({ ok: true, capabilities: CAPABILITIES }),
      attachDevice: jest.fn().mockImplementation(async () => {
        advanceSyncWipeEpoch();
        return { ok: true };
      }),
    } as unknown as SyncAPIClient;

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      preferences,
      { sessionToken: "session-2", accountID: "acct-1" },
      () => api,
      jest.fn(),
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(writeSyncSecrets).not.toHaveBeenCalled();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("falls back to the caller's copy for the restore mark when the stored record is unreadable", async () => {
    const preferences = selfHosted({ accountId: "acct-a", setupStatus: "local_ready" });
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockRejectedValue(new Error("unreadable")),
    });
    const api = {
      getCapabilities: jest.fn().mockResolvedValue({ ok: true, capabilities: CAPABILITIES }),
      attachDevice: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as SyncAPIClient;

    await finalizeSyncSessionAfterTOTP(
      storage,
      createSyncSecretStoreMock(preparedSecrets({ authSessionToken: null })),
      preferences,
      { sessionToken: "session-2", accountID: "acct-b" },
      () => api,
      jest.fn(),
      NOW,
    );

    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acct-b" }),
      { restoreInProgress: false },
    );
  });
});

describe("guest upgrade superseded by a local wipe after the request", () => {
  function guestHarness() {
    const preferences: SyncPreferencesRecord = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed",
      setupStatus: "connected",
      accountId: "acct-previous-owner",
      guestSessionExpiresAt: "2026-04-20T08:00:00.000Z",
    };
    const storage = storageFor(preferences);
    const secretStore = createSyncSecretStoreMock(
      preparedSecrets({ authSessionToken: null, managedAuthSessionToken: "guest" }),
    );
    const managed = {
      upgradeGuestAccount: jest.fn().mockResolvedValue({
        ok: true,
        result: { accountID: "acct-upgraded", email: "owner@example.com", recoveryCode: "RC" },
      }),
    } as unknown as ManagedCloudAPIClient;
    const run = () =>
      upgradeGuestPartnerAccount(
        storage,
        secretStore,
        preferences,
        { email: "owner@example.com", password: "correct horse battery" },
        () => managed,
        NOW,
      );
    return { storage, secretStore, managed, run };
  }

  it("writes nothing when a wipe lands while the upgraded session is re-read", async () => {
    const harness = guestHarness();
    const read = harness.secretStore.readSyncSecrets.bind(harness.secretStore);
    jest.spyOn(harness.secretStore, "readSyncSecrets").mockImplementation(async () => {
      if ((harness.managed.upgradeGuestAccount as jest.Mock).mock.calls.length > 0) {
        advanceSyncWipeEpoch();
      }
      return read();
    });
    const writeSecrets = jest.spyOn(harness.secretStore, "writeSyncSecrets");

    const result = await harness.run();

    expect(result).toMatchObject({ ok: false, errorCode: "unauthorized" });
    expect(writeSecrets).not.toHaveBeenCalled();
    expect(harness.storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("binds the preferences and writes no key when the secrets are gone after the upgrade", async () => {
    const harness = guestHarness();
    const read = harness.secretStore.readSyncSecrets.bind(harness.secretStore);
    jest.spyOn(harness.secretStore, "readSyncSecrets").mockImplementation(async () =>
      (harness.managed.upgradeGuestAccount as jest.Mock).mock.calls.length > 0 ? null : read(),
    );
    const writeSecrets = jest.spyOn(harness.secretStore, "writeSyncSecrets");

    const result = await harness.run();

    expect(result.ok).toBe(true);
    expect(result).not.toHaveProperty("accountKeyReset");
    expect(writeSecrets).not.toHaveBeenCalled();
    expect(result.preferences.accountId).toBe("acct-upgraded");
  });

  it("writes no preferences when a wipe lands while the new key is stored", async () => {
    const harness = guestHarness();
    const write = harness.secretStore.writeSyncSecrets.bind(harness.secretStore);
    jest.spyOn(harness.secretStore, "writeSyncSecrets").mockImplementation(async (record) => {
      await write(record);
      advanceSyncWipeEpoch();
    });

    const result = await harness.run();

    expect(result).toMatchObject({ ok: false, errorCode: "unauthorized" });
    expect(harness.storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });
});
