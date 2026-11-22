import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
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

  it("never carries the previous account's floor into a guest session", async () => {
    const result = await persistGuestPartnerSession(
      createLocalAppStorageMock(),
      preparedSecretStore(),
      { ...floorFrom("account-a", "managed"), setupStatus: "connected" },
      { sessionToken: "guest-session", sessionExpiresAt: "2026-04-20T08:00:00.000Z" },
      NOW,
    );

    expect(result.preferences).toMatchObject({
      accountId: null,
      lastRemoteGeneration: null,
      lastSyncedAt: null,
    });
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
