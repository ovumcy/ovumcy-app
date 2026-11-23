import { createSyncSecretsRecord } from "../security/sync-crypto";
import type { SyncSecretStore } from "../security/sync-secret-store";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { partnerShareSecretStore as appPartnerShareSecretStore } from "./app-partner-share-service";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";
import { clearLocalSyncSession, disconnectSyncAccount } from "./sync-client-service";

jest.mock("./app-wipe-scope-secret-stores", () => ({
  certPinStore: {},
  entitlementTokenStore: { clearEntitlementToken: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("./app-partner-share-service", () => ({
  partnerShareSecretStore: { clearPartnerShareSecrets: jest.fn().mockResolvedValue(undefined) },
}));

const NOW = new Date("2026-03-20T08:05:00.000Z");

const managedPreferences: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "managed",
  deviceLabel: "Pixel 7",
  setupStatus: "connected",
};

const selfHostedPreferences: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "self_hosted",
  endpointInput: "https://sync.example.test",
  deviceLabel: "Pixel 7",
  setupStatus: "connected",
};

function storedSecretStore(): SyncSecretStore {
  return createSyncSecretStoreMock({
    ...createSyncSecretsRecord("Pixel 7", NOW).record,
    authSessionToken: "sync-session-0",
    managedAuthSessionToken: "managed-session-0",
  });
}

function managedClient(): ManagedCloudAPIClient {
  return { logout: jest.fn().mockResolvedValue({ ok: true }) } as unknown as ManagedCloudAPIClient;
}

function communityClient(): SyncAPIClient {
  return { logout: jest.fn().mockResolvedValue({ ok: true }) } as unknown as SyncAPIClient;
}

describe("partner-share secrets across the end of a sync session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears the partner-share secrets on a managed disconnect, before the session", async () => {
    const secretStore = storedSecretStore();
    const writeSecrets = jest.spyOn(secretStore, "writeSyncSecrets");
    const partnerStore = { clearPartnerShareSecrets: jest.fn().mockResolvedValue(undefined) };

    await disconnectSyncAccount(
      createLocalAppStorageMock(),
      secretStore,
      managedPreferences,
      jest.fn(),
      jest.fn().mockReturnValue(managedClient()),
      0,
      partnerStore,
    );

    expect(partnerStore.clearPartnerShareSecrets).toHaveBeenCalledTimes(1);
    expect(partnerStore.clearPartnerShareSecrets.mock.invocationCallOrder[0]).toBeLessThan(
      writeSecrets.mock.invocationCallOrder[0]!,
    );
  });

  it("clears the app's partner-share store on a managed disconnect", async () => {
    await disconnectSyncAccount(
      createLocalAppStorageMock(),
      storedSecretStore(),
      managedPreferences,
      jest.fn(),
      jest.fn().mockReturnValue(managedClient()),
      0,
    );

    expect(appPartnerShareSecretStore.clearPartnerShareSecrets).toHaveBeenCalledTimes(1);
  });

  it("fails the disconnect and keeps the session when the partner-share secrets cannot be cleared", async () => {
    const secretStore = storedSecretStore();
    const partnerStore = {
      clearPartnerShareSecrets: jest.fn().mockRejectedValue(new Error("keychain locked")),
    };

    await expect(
      disconnectSyncAccount(
        createLocalAppStorageMock(),
        secretStore,
        managedPreferences,
        jest.fn(),
        jest.fn().mockReturnValue(managedClient()),
        0,
        partnerStore,
      ),
    ).rejects.toThrow("keychain locked");
    await expect(secretStore.readSyncSecrets()).resolves.toMatchObject({
      managedAuthSessionToken: "managed-session-0",
    });
  });

  it("keeps the partner-share secrets on a self-hosted disconnect", async () => {
    const partnerStore = { clearPartnerShareSecrets: jest.fn().mockResolvedValue(undefined) };

    await disconnectSyncAccount(
      createLocalAppStorageMock(),
      storedSecretStore(),
      selfHostedPreferences,
      jest.fn().mockReturnValue(communityClient()),
      jest.fn(),
      0,
      partnerStore,
    );

    expect(partnerStore.clearPartnerShareSecrets).not.toHaveBeenCalled();
  });

  it("keeps the partner-share secrets when an unauthorized managed session is cleared", async () => {
    await clearLocalSyncSession(
      createLocalAppStorageMock(),
      storedSecretStore(),
      managedPreferences,
    );

    expect(appPartnerShareSecretStore.clearPartnerShareSecrets).not.toHaveBeenCalled();
  });
});
