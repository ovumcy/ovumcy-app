import {
  createSyncSecretsRecord,
  unwrapMasterKeyWithRecoveryPhrase,
} from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  clearAccountChangeRecoveryPhrase,
  loadAccountChangeRecoveryPhraseState,
  readPendingAccountChangeRecoveryPhrase,
} from "./account-change-recovery-phrase";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
  type SyncSecretsRecord,
} from "./sync-contract";
import {
  bindSyncPreferencesToAccount,
  connectSyncAccount,
  disconnectSyncAccount,
  finalizeSyncSessionAfterTOTP,
  persistGuestPartnerSession,
} from "./sync-client-service";

const NOW = new Date("2026-03-20T08:05:00.000Z");
const CREDENTIALS = { login: "alice@example.com", password: "correct horse battery staple" };

// A device that uploaded under account A and then disconnected: the floor and
// the account it was raised under both survive the disconnect.
function floorFrom(accountId: string | null, mode: SyncPreferencesRecord["mode"]) {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode,
    endpointInput: mode === "self_hosted" ? "192.168.1.20:8080" : "",
    deviceLabel: "Pixel 7",
    setupStatus: "local_ready" as const,
    lastRemoteGeneration: 1_700_000_000_000,
    lastSyncedAt: "2026-03-19T08:00:00.000Z",
    accountId,
  };
}

function entitlement() {
  return {
    syncAllowed: true,
    source: "manual",
    updatedAt: NOW.toISOString(),
    effectiveAt: NOW.toISOString(),
    explanation: "beta access",
  };
}

function managedClient(accountID: string): ManagedCloudAPIClient {
  return {
    login: jest.fn().mockResolvedValue({
      ok: true,
      auth: {
        accountID,
        email: "alice@example.com",
        sessionToken: "managed-session",
        sessionExpiresAt: "2026-03-20T20:00:00.000Z",
        entitlement: entitlement(),
      },
    }),
    getSession: jest.fn().mockResolvedValue({
      ok: true,
      session: {
        accountID,
        email: "alice@example.com",
        sessionExpiresAt: "2026-03-20T20:00:00.000Z",
        entitlement: entitlement(),
        twoFactorEnabled: true,
      },
    }),
  } as unknown as ManagedCloudAPIClient;
}

function communityClient(accountID: string): SyncAPIClient {
  return {
    login: jest.fn().mockResolvedValue({
      ok: true,
      auth: { accountID, sessionToken: "community-session", sessionExpiresAt: "" },
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
    attachDevice: jest.fn().mockResolvedValue({
      ok: true,
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: NOW.toISOString(),
        lastSeenAt: NOW.toISOString(),
      },
    }),
  } as unknown as SyncAPIClient;
}

function preparedSecretStore() {
  return createSyncSecretStoreMock(createSyncSecretsRecord("Pixel 7", NOW).record);
}

describe("bindSyncPreferencesToAccount", () => {
  it("keeps the floor for a sign-in to the account it was raised under", () => {
    const preferences = floorFrom("account-a", "managed");

    expect(bindSyncPreferencesToAccount(preferences, "account-a")).toBe(preferences);
  });

  it.each([
    ["another account", "account-a", "account-b", "account-b"],
    ["an unbound record", null, "account-b", "account-b"],
    ["an unknown account id", "account-a", null, null],
    ["an empty account id", "account-a", "", null],
  ])("starts the floor over for %s", (_label, stored, signedIn, bound) => {
    expect(bindSyncPreferencesToAccount(floorFrom(stored, "managed"), signedIn)).toEqual({
      ...floorFrom(stored, "managed"),
      accountId: bound,
      lastRemoteGeneration: null,
      lastSyncedAt: null,
    });
  });
});

describe("sign-in binds the rollback floor to the account", () => {
  it.each(["managed", "self_hosted"] as const)(
    "%s login to another account resets the floor, so the first upload probes again",
    async (mode) => {
      const storage = createLocalAppStorageMock();
      const result = await connectSyncAccount(
        storage,
        preparedSecretStore(),
        floorFrom("account-a", mode),
        CREDENTIALS,
        "login",
        NOW,
        jest.fn().mockReturnValue(communityClient("account-b")),
        jest.fn().mockReturnValue(managedClient("account-b")),
      );

      expect(result.ok && "preferences" in result && result.preferences).toMatchObject({
        setupStatus: "connected",
        accountId: "account-b",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      });
      expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: "account-b", lastRemoteGeneration: null }),
      );
    },
  );

  it.each(["managed", "self_hosted"] as const)(
    "%s login to the same account keeps the floor",
    async (mode) => {
      const result = await connectSyncAccount(
        createLocalAppStorageMock(),
        preparedSecretStore(),
        floorFrom("account-a", mode),
        CREDENTIALS,
        "login",
        NOW,
        jest.fn().mockReturnValue(communityClient("account-a")),
        jest.fn().mockReturnValue(managedClient("account-a")),
      );

      expect(result.ok && "preferences" in result && result.preferences).toMatchObject({
        accountId: "account-a",
        lastRemoteGeneration: 1_700_000_000_000,
        lastSyncedAt: "2026-03-19T08:00:00.000Z",
      });
    },
  );

  it("binds a managed TOTP finalize to the account the session read names", async () => {
    const result = await finalizeSyncSessionAfterTOTP(
      createLocalAppStorageMock(),
      preparedSecretStore(),
      floorFrom("account-a", "managed"),
      { sessionToken: "managed-after-totp" },
      jest.fn(),
      jest.fn().mockReturnValue(managedClient("account-b")),
    );

    expect(result.ok && result.preferences).toMatchObject({
      accountId: "account-b",
      lastRemoteGeneration: null,
    });
  });

  it("binds a self-hosted TOTP finalize to the challenge's account, and resets the floor without one", async () => {
    const sameAccount = await finalizeSyncSessionAfterTOTP(
      createLocalAppStorageMock(),
      preparedSecretStore(),
      floorFrom("account-a", "self_hosted"),
      { sessionToken: "community-after-totp", accountID: "account-a" },
      jest.fn().mockReturnValue(communityClient("account-a")),
    );
    const noAccount = await finalizeSyncSessionAfterTOTP(
      createLocalAppStorageMock(),
      preparedSecretStore(),
      floorFrom("account-a", "self_hosted"),
      { sessionToken: "community-after-totp" },
      jest.fn().mockReturnValue(communityClient("account-a")),
    );

    expect(sameAccount.ok && sameAccount.preferences).toMatchObject({
      accountId: "account-a",
      lastRemoteGeneration: 1_700_000_000_000,
    });
    expect(noAccount.ok && noAccount.preferences).toMatchObject({
      accountId: null,
      lastRemoteGeneration: null,
    });
  });

  it("never carries the previous account's floor into a guest session, and keeps the kept key's account", async () => {
    const result = await persistGuestPartnerSession(
      createLocalAppStorageMock(),
      preparedSecretStore(),
      { ...floorFrom("account-a", "managed"), setupStatus: "connected" },
      { sessionToken: "guest-session", sessionExpiresAt: "2026-04-20T08:00:00.000Z" },
      NOW,
    );

    expect(result.preferences).toMatchObject({
      accountId: "account-a",
      lastRemoteGeneration: null,
      lastSyncedAt: null,
    });
  });

  it("binds a key a guest accept mints to no account", async () => {
    const result = await persistGuestPartnerSession(
      createLocalAppStorageMock(),
      createSyncSecretStoreMock(),
      floorFrom("account-a", "managed"),
      { sessionToken: "guest-session", sessionExpiresAt: "2026-04-20T08:00:00.000Z" },
      NOW,
    );

    expect(result.preferences.accountId).toBeNull();
  });

  it("keeps the account a disconnect leaves, so the next sign-in is compared against it", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock({
      ...createSyncSecretsRecord("Pixel 7", NOW).record,
      authSessionToken: "community-session",
    });

    const result = await disconnectSyncAccount(
      storage,
      secretStore,
      { ...floorFrom("account-a", "self_hosted"), setupStatus: "connected" },
      jest.fn().mockReturnValue({
        ...communityClient("account-a"),
        logout: jest.fn().mockResolvedValue({ ok: true }),
      }),
    );

    expect(result.preferences).toMatchObject({
      accountId: "account-a",
      lastRemoteGeneration: 1_700_000_000_000,
    });
  });
});

describe("a sign-in to another account replaces the sync key", () => {
  afterEach(() => {
    clearAccountChangeRecoveryPhrase();
  });

  function storeFor(record: SyncSecretsRecord) {
    return createSyncSecretStoreMock(record);
  }

  async function expectReplacedKey(
    secretStore: ReturnType<typeof createSyncSecretStoreMock>,
    previous: SyncSecretsRecord,
  ) {
    const stored = await secretStore.readSyncSecrets();
    expect(stored).not.toBeNull();
    if (!stored) {
      return;
    }
    expect(stored.masterKeyHex).not.toBe(previous.masterKeyHex);
    expect(stored.deviceSecretHex).not.toBe(previous.deviceSecretHex);
    expect(stored.device.deviceID).not.toBe(previous.device.deviceID);
    expect(stored.device.deviceLabel).toBe(previous.device.deviceLabel);
    expect(stored.recoveryPhraseUnrevealed).toBe(true);
    const phrase = await readPendingAccountChangeRecoveryPhrase(secretStore);
    expect(phrase).not.toBeNull();
    expect(unwrapMasterKeyWithRecoveryPhrase(phrase ?? "", stored.wrappedKey)).toBe(
      stored.masterKeyHex,
    );
    return { stored, phrase: phrase ?? "" };
  }

  it.each(["managed", "self_hosted"] as const)(
    "%s login replaces the key, phrase and device identity, and the result never carries the phrase",
    async (mode) => {
      const previous = createSyncSecretsRecord("Pixel 7", NOW).record;
      const secretStore = storeFor(previous);
      const community = communityClient("account-b");

      const result = await connectSyncAccount(
        createLocalAppStorageMock(),
        secretStore,
        floorFrom("account-a", mode),
        CREDENTIALS,
        "login",
        NOW,
        jest.fn().mockReturnValue(community),
        jest.fn().mockReturnValue(managedClient("account-b")),
      );

      expect(result).toMatchObject({ ok: true, accountKeyReset: true });
      const replaced = await expectReplacedKey(secretStore, previous);
      expect(JSON.stringify(result)).not.toContain(replaced?.phrase);
      if (mode === "self_hosted") {
        expect(community.attachDevice).toHaveBeenCalledWith("community-session", {
          deviceID: replaced?.stored.device.deviceID,
          deviceLabel: "Pixel 7",
        });
      }
    },
  );

  it("sends a self-hosted register to another account the new key's package", async () => {
    const previous = createSyncSecretsRecord("Pixel 7", NOW).record;
    const secretStore = storeFor(previous);
    const community = {
      ...communityClient("account-b"),
      register: jest.fn().mockResolvedValue({
        ok: true,
        auth: { accountID: "account-b", sessionToken: "community-session", sessionExpiresAt: "" },
      }),
      putRecoveryKey: jest.fn().mockResolvedValue({ ok: true }),
    } as unknown as SyncAPIClient;

    await connectSyncAccount(
      createLocalAppStorageMock(),
      secretStore,
      floorFrom("account-a", "self_hosted"),
      CREDENTIALS,
      "register",
      NOW,
      jest.fn().mockReturnValue(community),
    );

    const stored = await secretStore.readSyncSecrets();
    expect(community.putRecoveryKey).toHaveBeenCalledWith(
      "community-session",
      stored?.wrappedKey,
      { currentPassword: CREDENTIALS.password },
    );
    expect(stored?.wrappedKey).not.toEqual(previous.wrappedKey);
  });

  it.each([
    ["the same account", "account-a", "account-a"],
    ["an unbound key", null, "account-b"],
    ["an empty stored account", "", "account-b"],
  ])("keeps the key for a sign-in from %s", async (_label, stored, signedIn) => {
    const previous = createSyncSecretsRecord("Pixel 7", NOW).record;
    const secretStore = storeFor(previous);

    const result = await connectSyncAccount(
      createLocalAppStorageMock(),
      secretStore,
      floorFrom(stored, "managed"),
      CREDENTIALS,
      "login",
      NOW,
      jest.fn(),
      jest.fn().mockReturnValue(managedClient(signedIn)),
    );

    expect(result).not.toHaveProperty("accountKeyReset");
    const after = await secretStore.readSyncSecrets();
    expect(after?.masterKeyHex).toBe(previous.masterKeyHex);
    expect(after?.recoveryPhraseUnrevealed).toBeUndefined();
    await expect(loadAccountChangeRecoveryPhraseState(secretStore)).resolves.toBe("none");
  });

  it("keeps the old key and holds no phrase when the connect fails after the sign-in", async () => {
    const previous = createSyncSecretsRecord("Pixel 7", NOW).record;
    const secretStore = storeFor(previous);
    const community = {
      ...communityClient("account-b"),
      attachDevice: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
    } as unknown as SyncAPIClient;

    const result = await connectSyncAccount(
      createLocalAppStorageMock(),
      secretStore,
      floorFrom("account-a", "self_hosted"),
      CREDENTIALS,
      "login",
      NOW,
      jest.fn().mockReturnValue(community),
    );

    expect(result.ok).toBe(false);
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(previous);
    await expect(loadAccountChangeRecoveryPhraseState(secretStore)).resolves.toBe("none");
  });

  it("replaces the key on a managed TOTP finalize to another account", async () => {
    const previous = createSyncSecretsRecord("Pixel 7", NOW).record;
    const secretStore = storeFor(previous);

    const result = await finalizeSyncSessionAfterTOTP(
      createLocalAppStorageMock(),
      secretStore,
      floorFrom("account-a", "managed"),
      { sessionToken: "managed-after-totp" },
      jest.fn(),
      jest.fn().mockReturnValue(managedClient("account-b")),
      NOW,
    );

    expect(result).toMatchObject({ ok: true, accountKeyReset: true });
    await expectReplacedKey(secretStore, previous);
    await expect(secretStore.readSyncSecrets()).resolves.toMatchObject({
      managedAuthSessionToken: "managed-after-totp",
    });
  });

  it("replaces the key on a self-hosted TOTP finalize to another account, before the device attach", async () => {
    const previous = createSyncSecretsRecord("Pixel 7", NOW).record;
    const secretStore = storeFor(previous);
    const community = communityClient("account-b");

    const result = await finalizeSyncSessionAfterTOTP(
      createLocalAppStorageMock(),
      secretStore,
      floorFrom("account-a", "self_hosted"),
      { sessionToken: "community-after-totp", accountID: "account-b" },
      jest.fn().mockReturnValue(community),
      jest.fn(),
      NOW,
    );

    expect(result).toMatchObject({ ok: true, accountKeyReset: true });
    const replaced = await expectReplacedKey(secretStore, previous);
    expect(community.attachDevice).toHaveBeenCalledWith("community-after-totp", {
      deviceID: replaced?.stored.device.deviceID,
      deviceLabel: "Pixel 7",
    });
  });

  it("never replaces the key on a guest accept", async () => {
    const previous = createSyncSecretsRecord("Pixel 7", NOW).record;
    const secretStore = storeFor(previous);

    await persistGuestPartnerSession(
      createLocalAppStorageMock(),
      secretStore,
      floorFrom("account-a", "managed"),
      { sessionToken: "guest-session", sessionExpiresAt: "2026-04-20T08:00:00.000Z" },
      NOW,
    );

    const after = await secretStore.readSyncSecrets();
    expect(after?.masterKeyHex).toBe(previous.masterKeyHex);
    expect(after?.recoveryPhraseUnrevealed).toBeUndefined();
  });
});
