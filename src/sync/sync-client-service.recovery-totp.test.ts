import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type {
  ManagedCloudAPIClient,
  ManagedCloudSessionView,
} from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";
import {
  finalizeSyncRecoveryAfterTOTP,
  recoverSyncAccess,
} from "./sync-client-service";

const NOW = new Date("2026-03-20T08:05:00.000Z");

const preferences: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "self_hosted",
  endpointInput: "192.168.1.20:8080",
  deviceLabel: "Replacement phone",
};

function serverAccount() {
  return createSyncSecretsRecord("Original device", new Date("2026-03-20T08:00:00.000Z"));
}

function apiClient(overrides: Partial<SyncAPIClient> = {}): SyncAPIClient {
  const account = serverAccount();
  return {
    login: jest.fn().mockResolvedValue({
      ok: true,
      auth: {
        accountID: "account-1",
        sessionToken: "",
        sessionExpiresAt: "",
        totpChallenge: {
          challengeID: "challenge-1",
          challengeExpiresAt: "2026-03-20T08:10:00.000Z",
        },
      },
    }),
    getCapabilities: jest.fn().mockResolvedValue({
      ok: true,
      capabilities: {
        mode: "self_hosted",
        syncEnabled: true,
        recoverySupported: true,
        pushSupported: false,
        portalSupported: false,
        advancedCloudInsights: false,
        maxDevices: 5,
        maxBlobBytes: 16 << 20,
      },
    }),
    getRecoveryKey: jest
      .fn()
      .mockResolvedValue({ ok: true, recoveryKey: account.record.wrappedKey }),
    attachDevice: jest.fn().mockResolvedValue({
      ok: true,
      device: {
        deviceID: "device-2",
        deviceLabel: "Replacement phone",
        createdAt: NOW.toISOString(),
        lastSeenAt: NOW.toISOString(),
      },
    }),
    ...overrides,
  } as unknown as SyncAPIClient;
}

describe("self-hosted phrase recovery with two-factor on", () => {
  it("hands back the TOTP challenge and runs nothing on the empty session token", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const client = apiClient();

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      preferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      serverAccount().recoveryPhrase,
      NOW,
      jest.fn().mockReturnValue(client),
    );

    expect(result).toEqual({
      ok: true,
      totpChallengeRequired: true,
      challengeID: "challenge-1",
      challengeExpiresAt: "2026-03-20T08:10:00.000Z",
    });
    expect(client.getCapabilities).not.toHaveBeenCalled();
    expect(client.getRecoveryKey).not.toHaveBeenCalled();
    expect(client.attachDevice).not.toHaveBeenCalled();
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("resumes the recovery with the challenge's session token: key, attach, then store", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const account = serverAccount();
    const client = apiClient({
      getRecoveryKey: jest
        .fn()
        .mockResolvedValue({ ok: true, recoveryKey: account.record.wrappedKey }),
    });

    const result = await finalizeSyncRecoveryAfterTOTP(
      storage,
      secretStore,
      preferences,
      { sessionToken: "session-after-totp", recoveryPhrase: ` ${account.recoveryPhrase} ` },
      NOW,
      jest.fn().mockReturnValue(client),
    );

    expect(result.ok).toBe(true);
    expect(client.getRecoveryKey).toHaveBeenCalledWith("session-after-totp");
    expect(client.attachDevice).toHaveBeenCalledWith(
      "session-after-totp",
      expect.objectContaining({ deviceLabel: "Replacement phone" }),
    );
    const stored = await secretStore.readSyncSecrets();
    expect(stored?.authSessionToken).toBe("session-after-totp");
    expect(stored?.masterKeyHex).toBe(account.record.masterKeyHex);
    expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        setupStatus: "connected",
        normalizedEndpoint: "http://192.168.1.20:8080",
      }),
    );
  });

  it.each([
    ["an empty session token", preferences, "", undefined, "unauthorized"],
    ["a blank device label", { ...preferences, deviceLabel: "  " }, "token", undefined, "device_label_required"],
    ["a blank phrase", preferences, "token", "   ", "recovery_phrase_required"],
    ["an invalid endpoint", { ...preferences, endpointInput: "" }, "token", undefined, "endpoint_required"],
  ])("refuses %s before any request", async (_label, prefs, sessionToken, phrase, errorCode) => {
    const apiClientFactory = jest.fn();

    const result = await finalizeSyncRecoveryAfterTOTP(
      createLocalAppStorageMock(),
      createSyncSecretStoreMock(),
      prefs,
      { sessionToken, recoveryPhrase: phrase ?? serverAccount().recoveryPhrase },
      NOW,
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });

  it("refuses an invalid phrase on resume before any request", async () => {
    const apiClientFactory = jest.fn();

    const result = await finalizeSyncRecoveryAfterTOTP(
      createLocalAppStorageMock(),
      createSyncSecretStoreMock(),
      preferences,
      { sessionToken: "session-after-totp", recoveryPhrase: "not a phrase" },
      NOW,
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "invalid_recovery_phrase" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });
});

const managedPreferences: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "managed",
  deviceLabel: "Replacement phone",
};

function entitlement(syncAllowed: boolean) {
  return {
    syncAllowed,
    source: "manual",
    updatedAt: NOW.toISOString(),
    effectiveAt: NOW.toISOString(),
    explanation: "beta access",
  };
}

function sessionView(syncAllowed: boolean): ManagedCloudSessionView {
  return {
    accountID: "managed-account-1",
    email: "alice@example.com",
    sessionExpiresAt: "2026-03-20T20:00:00.000Z",
    entitlement: entitlement(syncAllowed),
    twoFactorEnabled: true,
  };
}

function managedClient(
  overrides: Partial<ManagedCloudAPIClient> = {},
): ManagedCloudAPIClient {
  return {
    register: jest.fn(),
    login: jest.fn().mockResolvedValue({
      ok: true,
      auth: {
        accountID: "managed-account-1",
        email: "alice@example.com",
        sessionToken: "",
        sessionExpiresAt: "",
        entitlement: entitlement(false),
        totpChallenge: {
          challengeID: "challenge-1",
          challengeExpiresAt: "2026-03-20T08:10:00.000Z",
        },
      },
    }),
    getSession: jest.fn().mockResolvedValue({ ok: true, session: sessionView(true) }),
    createSyncSession: jest.fn().mockResolvedValue({
      ok: true,
      auth: {
        accountID: "managed-account-1",
        sessionToken: "sync-session-1",
        sessionExpiresAt: "2026-03-21T08:00:00.000Z",
      },
    }),
    logout: jest.fn(),
    ...overrides,
  } as unknown as ManagedCloudAPIClient;
}

function recoveryKeyClient(account: ReturnType<typeof serverAccount>): SyncAPIClient {
  return apiClient({
    getRecoveryKey: jest
      .fn()
      .mockResolvedValue({ ok: true, recoveryKey: account.record.wrappedKey }),
    putRecoveryKey: jest.fn().mockResolvedValue({ ok: true }),
  });
}

describe("managed phrase recovery with two-factor on", () => {
  it("hands back the TOTP challenge before the entitlement check and runs nothing on the empty session token", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const managed = managedClient();
    const apiClientFactory = jest.fn();

    const result = await recoverSyncAccess(
      storage,
      secretStore,
      managedPreferences,
      { login: "alice@example.com", password: "correct horse battery staple" },
      serverAccount().recoveryPhrase,
      NOW,
      apiClientFactory,
      jest.fn().mockReturnValue(managed),
    );

    expect(result).toEqual({
      ok: true,
      totpChallengeRequired: true,
      challengeID: "challenge-1",
      challengeExpiresAt: "2026-03-20T08:10:00.000Z",
    });
    expect(managed.createSyncSession).not.toHaveBeenCalled();
    expect(apiClientFactory).not.toHaveBeenCalled();
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
    expect(storage.writeManagedBillingCacheRecord).not.toHaveBeenCalled();
  });

  it("resumes with the challenge's session token: session read, sync session, key, attach, then store", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const account = serverAccount();
    const managed = managedClient();
    const client = recoveryKeyClient(account);

    const result = await finalizeSyncRecoveryAfterTOTP(
      storage,
      secretStore,
      managedPreferences,
      {
        sessionToken: "managed-after-totp",
        recoveryPhrase: account.recoveryPhrase,
        sessionExpiresAt: "2026-03-20T09:05:00.000Z",
        refreshToken: "refresh-1",
        refreshTokenExpiresAt: "2026-04-19T08:05:00.000Z",
      },
      NOW,
      jest.fn().mockReturnValue(client),
      jest.fn().mockReturnValue(managed),
    );

    expect(result).toEqual({
      ok: true,
      capabilities: expect.objectContaining({ mode: "managed" }),
      preferences: expect.objectContaining({
        setupStatus: "connected",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
      }),
    });
    expect(managed.getSession).toHaveBeenCalledWith("managed-after-totp");
    expect(managed.createSyncSession).toHaveBeenCalledWith("managed-after-totp");
    expect(client.getRecoveryKey).toHaveBeenCalledWith("sync-session-1");
    expect(client.attachDevice).toHaveBeenCalledWith(
      "sync-session-1",
      expect.objectContaining({ deviceLabel: "Replacement phone" }),
    );
    const order = [
      managed.getSession,
      managed.createSyncSession,
      client.getRecoveryKey,
      client.attachDevice,
      storage.writeSyncPreferencesRecord,
    ].map((fn) => (fn as jest.Mock).mock.invocationCallOrder[0] ?? -1);
    expect(order).not.toContain(-1);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: "sync-session-1",
        managedAuthSessionToken: "managed-after-totp",
        managedAuthSessionExpiresAt: "2026-03-20T09:05:00.000Z",
        managedRefreshToken: "refresh-1",
        managedRefreshTokenExpiresAt: "2026-04-19T08:05:00.000Z",
        masterKeyHex: account.record.masterKeyHex,
      }),
    );
    expect(storage.writeManagedBillingCacheRecord).toHaveBeenCalledTimes(2);
  });

  it("falls back to the session's expiry and stores no refresh pair when the challenge carried none", async () => {
    const secretStore = createSyncSecretStoreMock();
    const account = serverAccount();

    const result = await finalizeSyncRecoveryAfterTOTP(
      createLocalAppStorageMock(),
      secretStore,
      managedPreferences,
      {
        sessionToken: "managed-after-totp",
        recoveryPhrase: account.recoveryPhrase,
        sessionExpiresAt: "",
      },
      NOW,
      jest.fn().mockReturnValue(recoveryKeyClient(account)),
      jest.fn().mockReturnValue(managedClient()),
    );

    expect(result.ok).toBe(true);
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        managedAuthSessionToken: "managed-after-totp",
        managedAuthSessionExpiresAt: "2026-03-20T20:00:00.000Z",
        managedRefreshToken: null,
        managedRefreshTokenExpiresAt: null,
      }),
    );
  });

  it("refuses sync_not_allowed on resume when the session's entitlement forbids sync", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const managed = managedClient({
      getSession: jest.fn().mockResolvedValue({ ok: true, session: sessionView(false) }),
    });
    const apiClientFactory = jest.fn();

    const result = await finalizeSyncRecoveryAfterTOTP(
      storage,
      secretStore,
      managedPreferences,
      { sessionToken: "managed-after-totp", recoveryPhrase: serverAccount().recoveryPhrase },
      NOW,
      apiClientFactory,
      jest.fn().mockReturnValue(managed),
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_allowed" });
    expect(managed.createSyncSession).not.toHaveBeenCalled();
    expect(apiClientFactory).not.toHaveBeenCalled();
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it.each([
    ["unauthorized", "unauthorized"],
    ["sync_bridge_unavailable", "network_failed"],
  ])(
    "maps a failed session read (%s) on resume without minting a sync session",
    async (serverCode, errorCode) => {
      const managed = managedClient({
        getSession: jest.fn().mockResolvedValue({ ok: false, errorCode: serverCode }),
      });
      const apiClientFactory = jest.fn();

      const result = await finalizeSyncRecoveryAfterTOTP(
        createLocalAppStorageMock(),
        createSyncSecretStoreMock(),
        managedPreferences,
        { sessionToken: "managed-after-totp", recoveryPhrase: serverAccount().recoveryPhrase },
        NOW,
        apiClientFactory,
        jest.fn().mockReturnValue(managed),
      );

      expect(result).toEqual({ ok: false, errorCode });
      expect(managed.createSyncSession).not.toHaveBeenCalled();
      expect(apiClientFactory).not.toHaveBeenCalled();
    },
  );

  it("refuses an empty session token on resume before any request", async () => {
    const managedClientFactory = jest.fn();

    const result = await finalizeSyncRecoveryAfterTOTP(
      createLocalAppStorageMock(),
      createSyncSecretStoreMock(),
      managedPreferences,
      { sessionToken: "", recoveryPhrase: serverAccount().recoveryPhrase },
      NOW,
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
    expect(managedClientFactory).not.toHaveBeenCalled();
  });
});
