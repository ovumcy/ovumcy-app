import { createSyncSecretsRecord } from "../security/sync-crypto";
import type { SyncSecretStore } from "../security/sync-secret-store";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type {
  ManagedCloudAPIClient,
  ManagedCloudAPIErrorCode,
} from "./managed-cloud-api-client";
import { resetManagedSessionRefreshStateForTests } from "./managed-session-refresh-service";
import type { SyncAPIClient } from "./sync-api-client";
import {
  listSyncDevices,
  loadConnectedSyncCapabilities,
  upgradeGuestPartnerAccount,
} from "./sync-client-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncSecretsRecord,
} from "./sync-contract";

const managedPreferences = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "managed" as const,
  deviceLabel: "Pixel 7",
  setupStatus: "connected" as const,
};

const UNAUTHORIZED = { ok: false as const, errorCode: "unauthorized" as const };

const ENTITLEMENT = {
  syncAllowed: true,
  source: "manual",
  updatedAt: "2026-03-20T08:05:00.000Z",
  effectiveAt: "2026-03-20T08:05:00.000Z",
  explanation: "",
};

type Site = "getSession" | "createSyncSession" | "upgradeGuestAccount";

type RefreshAnswer =
  | { ok: true }
  | { ok: false; errorCode: ManagedCloudAPIErrorCode };

// A managed cloud that refuses "access-1" on the rejecting sites, accepts any
// other token, and answers a refresh of "refresh-1" with the "access-2" pair.
function createManagedCloud(rejecting: Site[], refreshAnswer: RefreshAnswer = { ok: true }) {
  const answer = <T>(site: Site, token: string, ok: T) =>
    Promise.resolve(rejecting.includes(site) && token === "access-1" ? UNAUTHORIZED : ok);
  const client = {
    getSession: jest.fn((token: string) =>
      answer("getSession", token, {
        ok: true as const,
        session: {
          accountID: "managed-account-1",
          login: "a3f9-0c12-77be-4d01",
          sessionExpiresAt: "2099-03-21T08:00:00.000Z",
          entitlement: ENTITLEMENT,
        },
      }),
    ),
    createSyncSession: jest.fn((token: string) =>
      answer("createSyncSession", token, {
        ok: true as const,
        auth: {
          accountID: "sync-account-1",
          sessionToken: `bridged-for-${token}`,
          sessionExpiresAt: "2026-03-20T09:00:00.000Z",
        },
      }),
    ),
    upgradeGuestAccount: jest.fn((token: string) =>
      answer("upgradeGuestAccount", token, {
        ok: true as const,
        result: {
          accountID: "managed-account-1",
          login: "a3f9-0c12-77be-4d01",
          recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
        },
      }),
    ),
    refreshSession: jest.fn((refreshToken: string) =>
      Promise.resolve(
        refreshAnswer.ok && refreshToken === "refresh-1"
          ? {
              ok: true as const,
              auth: {
                accountID: "managed-account-1",
                login: "a3f9-0c12-77be-4d01",
                sessionToken: "access-2",
                sessionExpiresAt: "2099-03-21T08:00:00.000Z",
                entitlement: ENTITLEMENT,
                refreshToken: "refresh-2",
                refreshTokenExpiresAt: "2099-06-18T08:00:00.000Z",
              },
            }
          : refreshAnswer.ok
            ? UNAUTHORIZED
            : refreshAnswer,
      ),
    ),
  };
  const managedClientFactory = jest.fn(
    () => client as unknown as ManagedCloudAPIClient,
  );
  return { client, managedClientFactory };
}

function createStore(overrides: Partial<SyncSecretsRecord> = {}): SyncSecretStore {
  const prepared = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
  return createSyncSecretStoreMock({
    ...prepared.record,
    authSessionToken: "bridged-stale",
    managedAuthSessionToken: "access-1",
    managedRefreshToken: "refresh-1",
    managedRefreshTokenExpiresAt: "2099-06-18T08:00:00.000Z",
    ...overrides,
  });
}

function createSyncAPIFactory() {
  const listDevices = jest.fn().mockResolvedValue({ ok: true, devices: [] });
  const apiClientFactory = jest.fn(() => ({ listDevices }) as unknown as SyncAPIClient);
  return { listDevices, apiClientFactory };
}

type Cloud = ReturnType<typeof createManagedCloud>;

type CallSite = {
  name: string;
  site: Site;
  invoke: (
    secretStore: SyncSecretStore,
    cloud: Cloud,
  ) => Promise<{ ok: boolean; errorCode?: string }>;
};

const callSites: CallSite[] = [
  {
    name: "sync context getSession",
    site: "getSession",
    invoke: (secretStore, cloud) =>
      listSyncDevices(
        secretStore,
        managedPreferences,
        createSyncAPIFactory().apiClientFactory,
        cloud.managedClientFactory,
      ),
  },
  {
    name: "sync context createSyncSession",
    site: "createSyncSession",
    invoke: (secretStore, cloud) =>
      listSyncDevices(
        secretStore,
        managedPreferences,
        createSyncAPIFactory().apiClientFactory,
        cloud.managedClientFactory,
      ),
  },
  {
    name: "capabilities getSession",
    site: "getSession",
    invoke: (secretStore, cloud) =>
      loadConnectedSyncCapabilities(
        secretStore,
        managedPreferences,
        jest.fn(),
        cloud.managedClientFactory,
      ),
  },
  {
    name: "guest upgrade",
    site: "upgradeGuestAccount",
    invoke: (secretStore, cloud) =>
      upgradeGuestPartnerAccount(
        createLocalAppStorageMock(),
        secretStore,
        managedPreferences,
        { password: "correct horse battery staple" },
        cloud.managedClientFactory,
      ),
  },
];

describe("sync-client-service managed session renewal", () => {
  beforeEach(() => {
    resetManagedSessionRefreshStateForTests();
  });

  it.each(callSites)(
    "renews a 401 on the $name call and retries it once with the renewed token",
    async ({ site, invoke }) => {
      const secretStore = createStore();
      const cloud = createManagedCloud([site]);

      const result = await invoke(secretStore, cloud);

      expect(result.ok).toBe(true);
      expect(cloud.client.refreshSession).toHaveBeenCalledTimes(1);
      expect(cloud.client[site].mock.calls.map(([token]) => token)).toEqual([
        "access-1",
        "access-2",
      ]);
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(
        expect.objectContaining({
          managedAuthSessionToken: "access-2",
          managedRefreshToken: "refresh-2",
        }),
      );
    },
  );

  it.each(callSites)(
    "keeps the session and reports generic, not unauthorized, when the refresh after a 401 on the $name call fails",
    async ({ site, invoke }) => {
      const secretStore = createStore();
      const cloud = createManagedCloud([site], { ok: false, errorCode: "network_failed" });

      const result = await invoke(secretStore, cloud);

      expect(result).toEqual(expect.objectContaining({ ok: false, errorCode: "generic" }));
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(
        expect.objectContaining({
          managedAuthSessionToken: "access-1",
          managedRefreshToken: "refresh-1",
        }),
      );
    },
  );

  it.each(callSites)(
    "clears the session and reports unauthorized when the refresh token itself is refused after a 401 on the $name call",
    async ({ site, invoke }) => {
      const secretStore = createStore();
      const cloud = createManagedCloud([site], { ok: false, errorCode: "unauthorized" });

      const result = await invoke(secretStore, cloud);

      expect(result).toEqual(
        expect.objectContaining({ ok: false, errorCode: "unauthorized" }),
      );
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(
        expect.objectContaining({
          managedAuthSessionToken: null,
          managedRefreshToken: null,
        }),
      );
    },
  );

  it("drops the bridged sync session along with an ended managed session", async () => {
    const secretStore = createStore();
    const cloud = createManagedCloud(["getSession"], { ok: false, errorCode: "unauthorized" });

    await listSyncDevices(
      secretStore,
      managedPreferences,
      createSyncAPIFactory().apiClientFactory,
      cloud.managedClientFactory,
    );

    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ authSessionToken: null }),
    );
  });

  it("mints the sync session with the renewed token and stores it beside the renewed pair", async () => {
    const secretStore = createStore();
    const cloud = createManagedCloud(["getSession"]);
    const { listDevices, apiClientFactory } = createSyncAPIFactory();

    await listSyncDevices(
      secretStore,
      managedPreferences,
      apiClientFactory,
      cloud.managedClientFactory,
    );

    expect(cloud.client.createSyncSession).toHaveBeenCalledWith("access-2");
    expect(listDevices).toHaveBeenCalledWith("bridged-for-access-2");
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: "bridged-for-access-2",
        managedAuthSessionToken: "access-2",
        managedRefreshToken: "refresh-2",
      }),
    );
  });

  it("stores no minted sync session once the record has moved to another managed session", async () => {
    const secretStore = createStore();
    const cloud = createManagedCloud([]);
    cloud.client.createSyncSession.mockImplementation(async (token: string) => {
      const record = await secretStore.readSyncSecrets();
      await secretStore.writeSyncSecrets({
        ...(record as SyncSecretsRecord),
        authSessionToken: null,
        managedAuthSessionToken: "other-account-access",
        managedRefreshToken: "other-account-refresh",
      });
      return {
        ok: true as const,
        auth: {
          accountID: "sync-account-1",
          sessionToken: `bridged-for-${token}`,
          sessionExpiresAt: "2026-03-20T09:00:00.000Z",
        },
      };
    });

    const result = await listSyncDevices(
      secretStore,
      managedPreferences,
      createSyncAPIFactory().apiClientFactory,
      cloud.managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "not_connected" });
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: null,
        managedAuthSessionToken: "other-account-access",
      }),
    );
  });

  it("reports not_connected without minting a sync session when the managed session is signed out between the two calls", async () => {
    const secretStore = createStore();
    const cloud = createManagedCloud([]);
    const signedIn = cloud.client.getSession.getMockImplementation()!;
    cloud.client.getSession.mockImplementation(async (token: string) => {
      const record = await secretStore.readSyncSecrets();
      await secretStore.writeSyncSecrets({
        ...(record as SyncSecretsRecord),
        authSessionToken: null,
        managedAuthSessionToken: null,
        managedRefreshToken: null,
      });
      return signedIn(token);
    });

    const result = await listSyncDevices(
      secretStore,
      managedPreferences,
      createSyncAPIFactory().apiClientFactory,
      cloud.managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "not_connected" });
    expect(cloud.client.createSyncSession).not.toHaveBeenCalled();
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ authSessionToken: null, managedAuthSessionToken: null }),
    );
  });

  it("keeps the renewed pair when the capabilities read drops a sync session the plan no longer allows", async () => {
    const secretStore = createStore();
    const cloud = createManagedCloud(["getSession"]);
    cloud.client.getSession.mockImplementation((token: string) =>
      Promise.resolve(
        token === "access-1"
          ? UNAUTHORIZED
          : {
              ok: true as const,
              session: {
                accountID: "managed-account-1",
                login: "a3f9-0c12-77be-4d01",
                sessionExpiresAt: "2099-03-21T08:00:00.000Z",
                entitlement: { ...ENTITLEMENT, syncAllowed: false },
              },
            },
      ),
    );

    const result = await loadConnectedSyncCapabilities(
      secretStore,
      managedPreferences,
      jest.fn(),
      cloud.managedClientFactory,
    );

    expect(result.ok).toBe(true);
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: null,
        managedAuthSessionToken: "access-2",
        managedRefreshToken: "refresh-2",
      }),
    );
  });
});
