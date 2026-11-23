import { createSyncSecretsRecord } from "../security/sync-crypto";
import type { SyncSecretStore } from "../security/sync-secret-store";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
  type SyncSecretsRecord,
} from "./sync-contract";
import { connectSyncAccount, finalizeSyncSessionAfterTOTP } from "./sync-client-service";

const NOW = new Date("2026-03-20T08:10:00.000Z");

const selfHosted: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "self_hosted",
  endpointInput: "192.168.1.20:8080",
  deviceLabel: "Pixel 7",
  setupStatus: "local_ready",
};

function storeWithManagedSession(): {
  secretStore: SyncSecretStore;
  record: SyncSecretsRecord;
} {
  const record: SyncSecretsRecord = {
    ...createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z")).record,
    managedAuthSessionToken: "managed-old",
    managedAuthSessionExpiresAt: "2026-03-20T09:00:00.000Z",
    managedRefreshToken: "refresh-old",
    managedRefreshTokenExpiresAt: "2026-04-20T08:00:00.000Z",
  };
  return { secretStore: createSyncSecretStoreMock(record), record };
}

async function rotateManagedSession(secretStore: SyncSecretStore): Promise<void> {
  const current = await secretStore.readSyncSecrets();
  await secretStore.writeSyncSecrets({
    ...current!,
    managedAuthSessionToken: "managed-new",
    managedAuthSessionExpiresAt: "2026-03-20T10:00:00.000Z",
    managedRefreshToken: "refresh-new",
    managedRefreshTokenExpiresAt: "2026-04-20T09:00:00.000Z",
  });
}

function communityClient(
  record: SyncSecretsRecord,
  duringHandshake: () => Promise<void>,
): SyncAPIClient {
  return {
    login: jest.fn().mockResolvedValue({
      ok: true,
      auth: { accountID: "community-account-1", sessionToken: "community-session" },
    }),
    getCapabilities: jest.fn(async () => {
      await duringHandshake();
      return {
        ok: true,
        capabilities: {
          mode: "self_hosted",
          syncEnabled: true,
          recoverySupported: false,
          pushSupported: false,
          portalSupported: false,
          advancedCloudInsights: false,
          maxDevices: 5,
          maxBlobBytes: 16 << 20,
        },
      };
    }),
    attachDevice: jest.fn().mockResolvedValue({
      ok: true,
      device: {
        deviceID: record.device.deviceID,
        deviceLabel: "Pixel 7",
        createdAt: "2026-03-20T08:00:00.000Z",
        lastSeenAt: "2026-03-20T08:00:00.000Z",
      },
    }),
  } as unknown as SyncAPIClient;
}

function expectRotatedManagedSessionKept(stored: SyncSecretsRecord | null) {
  expect(stored).toEqual(
    expect.objectContaining({
      authSessionToken: "community-session",
      managedAuthSessionToken: "managed-new",
      managedAuthSessionExpiresAt: "2026-03-20T10:00:00.000Z",
      managedRefreshToken: "refresh-new",
      managedRefreshTokenExpiresAt: "2026-04-20T09:00:00.000Z",
    }),
  );
}

describe("self-hosted session writes keep a managed renewal that landed meanwhile", () => {
  it("keeps the managed refresh pair a renewal rotated during a self-hosted connect", async () => {
    const { secretStore, record } = storeWithManagedSession();
    const client = communityClient(record, () => rotateManagedSession(secretStore));

    const result = await connectSyncAccount(
      createLocalAppStorageMock(),
      secretStore,
      selfHosted,
      { login: "alice", password: "correct horse battery staple" },
      "login",
      NOW,
      jest.fn().mockReturnValue(client),
      jest.fn(),
    );

    expect(result.ok).toBe(true);
    expectRotatedManagedSessionKept(await secretStore.readSyncSecrets());
  });

  it("keeps the managed refresh pair a renewal rotated during a self-hosted TOTP finalize", async () => {
    const { secretStore, record } = storeWithManagedSession();
    const client = communityClient(record, () => rotateManagedSession(secretStore));

    const result = await finalizeSyncSessionAfterTOTP(
      createLocalAppStorageMock(),
      secretStore,
      selfHosted,
      { sessionToken: "community-session", accountID: "community-account-1" },
      jest.fn().mockReturnValue(client),
      jest.fn(),
      NOW,
    );

    expect(result.ok).toBe(true);
    expectRotatedManagedSessionKept(await secretStore.readSyncSecrets());
  });

  it("writes nothing when the secrets were cleared during a self-hosted connect", async () => {
    const { secretStore, record } = storeWithManagedSession();
    const client = communityClient(record, () => secretStore.clearSyncSecrets());

    const result = await connectSyncAccount(
      createLocalAppStorageMock(),
      secretStore,
      selfHosted,
      { login: "alice", password: "correct horse battery staple" },
      "login",
      NOW,
      jest.fn().mockReturnValue(client),
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
  });

  it("writes nothing when the secrets were cleared during a self-hosted TOTP finalize", async () => {
    const { secretStore, record } = storeWithManagedSession();
    const client = communityClient(record, () => secretStore.clearSyncSecrets());

    const result = await finalizeSyncSessionAfterTOTP(
      createLocalAppStorageMock(),
      secretStore,
      selfHosted,
      { sessionToken: "community-session", accountID: "community-account-1" },
      jest.fn().mockReturnValue(client),
      jest.fn(),
      NOW,
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
  });
});
