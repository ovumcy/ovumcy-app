import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { SyncAPIClient } from "./sync-api-client";
import {
  connectSyncAccount,
  finalizeSyncRecoveryAfterTOTP,
  listSyncDevices,
  recoverSyncAccess,
  runSyncRestore,
} from "./sync-client-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";

const NOW = new Date("2026-03-20T08:05:00.000Z");
const RECOVERY_PHRASE =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const PASSWORD = "correct horse battery staple";

function selfHosted(overrides: Partial<SyncPreferencesRecord> = {}): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted",
    endpointInput: "192.168.1.20:8080",
    normalizedEndpoint: "http://192.168.1.20:8080",
    deviceLabel: "Pixel 7",
    ...overrides,
  };
}

function managed(overrides: Partial<SyncPreferencesRecord> = {}): SyncPreferencesRecord {
  return { ...createDefaultSyncPreferencesRecord(), mode: "managed", deviceLabel: "Pixel 7", ...overrides };
}

function apiClient(overrides: Partial<SyncAPIClient>): SyncAPIClient {
  return {
    register: jest.fn(),
    login: jest.fn(),
    getCapabilities: jest.fn(),
    attachDevice: jest.fn(),
    listDevices: jest.fn(),
    getBlob: jest.fn(),
    getRecoveryKey: jest.fn(),
    putRecoveryKey: jest.fn(),
    putBlob: jest.fn(),
    ...overrides,
  } as unknown as SyncAPIClient;
}

function preparedSecretStore(authSessionToken: string | null = null) {
  const prepared = createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"));
  return createSyncSecretStoreMock({ ...prepared.record, authSessionToken });
}

describe("connectSyncAccount register input limits", () => {
  it.each([
    ["ab", PASSWORD, "login_invalid_length"],
    ["a".repeat(255), PASSWORD, "login_invalid_length"],
    ["alice", "a".repeat(73), "password_too_long"],
    ["alice", `${"ж".repeat(36)}a`, "password_too_long"],
  ])("refuses login %p / password %p before any request", async (login, password, expected) => {
    const apiClientFactory = jest.fn();

    const result = await connectSyncAccount(
      createLocalAppStorageMock(),
      preparedSecretStore(),
      selfHosted(),
      { login, password },
      "register",
      NOW,
      apiClientFactory,
      jest.fn(),
    );

    expect(result).toEqual({ ok: false, errorCode: expected });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });

  it("refuses a managed register password over 72 bytes but leaves the email to the cloud", async () => {
    const managedClientFactory = jest.fn();

    await expect(
      connectSyncAccount(
        createLocalAppStorageMock(),
        preparedSecretStore(),
        managed(),
        { login: "a@b", password: "a".repeat(73) },
        "register",
        NOW,
        jest.fn(),
        managedClientFactory,
      ),
    ).resolves.toEqual({ ok: false, errorCode: "password_too_long" });
    expect(managedClientFactory).not.toHaveBeenCalled();
  });

  it("does not apply the register limits to a login", async () => {
    const login = jest.fn().mockResolvedValue({ ok: false, errorCode: "invalid_credentials" });

    await expect(
      connectSyncAccount(
        createLocalAppStorageMock(),
        preparedSecretStore(),
        selfHosted(),
        { login: "ab", password: "a".repeat(80) },
        "login",
        NOW,
        jest.fn().mockReturnValue(apiClient({ login })),
        jest.fn(),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "invalid_credentials" });
    expect(login).toHaveBeenCalledTimes(1);
  });
});

describe("connectSyncAccount keeps the issued recovery code", () => {
  const registered = {
    ok: true,
    auth: {
      accountID: "account-1",
      sessionToken: "session-1",
      sessionExpiresAt: "2026-03-21T08:00:00.000Z",
      recoveryCode: "self1234self1234self1234self1234",
    },
  };

  it("returns the code with the error when the device cannot be attached", async () => {
    const secretStore = preparedSecretStore();
    const client = apiClient({
      register: jest.fn().mockResolvedValue(registered),
      getCapabilities: jest.fn().mockResolvedValue({
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
      }),
      attachDevice: jest.fn().mockResolvedValue({ ok: false, errorCode: "network_failed" }),
    });

    const result = await connectSyncAccount(
      createLocalAppStorageMock(),
      secretStore,
      selfHosted(),
      { login: "alice", password: PASSWORD },
      "register",
      NOW,
      jest.fn().mockReturnValue(client),
      jest.fn(),
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "network_failed",
      recoveryCode: "self1234self1234self1234self1234",
    });
    expect((await secretStore.readSyncSecrets())?.authSessionToken).toBeNull();
  });

  it("returns the code with the error when capabilities fail", async () => {
    const client = apiClient({
      register: jest.fn().mockResolvedValue(registered),
      getCapabilities: jest.fn().mockResolvedValue({ ok: false, errorCode: "server_busy" }),
    });

    await expect(
      connectSyncAccount(
        createLocalAppStorageMock(),
        preparedSecretStore(),
        selfHosted(),
        { login: "alice", password: PASSWORD },
        "register",
        NOW,
        jest.fn().mockReturnValue(client),
        jest.fn(),
      ),
    ).resolves.toEqual({
      ok: false,
      errorCode: "network_failed",
      recoveryCode: "self1234self1234self1234self1234",
    });
  });
});

describe("recoverSyncAccess device label length", () => {
  it.each(["a", "a".repeat(65), "ж".repeat(33)])(
    "refuses label %p before any request",
    async (deviceLabel) => {
      const apiClientFactory = jest.fn();

      const result = await recoverSyncAccess(
        createLocalAppStorageMock(),
        preparedSecretStore(),
        selfHosted({ deviceLabel }),
        { login: "alice", password: PASSWORD },
        RECOVERY_PHRASE,
        NOW,
        apiClientFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "device_label_invalid_length" });
      expect(apiClientFactory).not.toHaveBeenCalled();
    },
  );
});

describe("recoverSyncAccess server refusals", () => {
  it.each([
    ["sync_disabled", "sync_not_allowed"],
    ["invalid_device", "device_label_invalid_length"],
    ["server_busy", "network_failed"],
    ["invalid_blob", "generic"],
  ])("maps a self-hosted %s to %s", async (apiErrorCode, expected) => {
    const client = apiClient({
      login: jest.fn().mockResolvedValue({ ok: false, errorCode: apiErrorCode }),
    });

    await expect(
      recoverSyncAccess(
        createLocalAppStorageMock(),
        preparedSecretStore(),
        selfHosted(),
        { login: "alice", password: PASSWORD },
        RECOVERY_PHRASE,
        NOW,
        jest.fn().mockReturnValue(client),
        jest.fn(),
      ),
    ).resolves.toEqual({ ok: false, errorCode: expected });
  });

  it("refuses an out-of-range label when a recovery resumes after two-factor", async () => {
    const apiClientFactory = jest.fn();

    await expect(
      finalizeSyncRecoveryAfterTOTP(
        createLocalAppStorageMock(),
        preparedSecretStore(),
        selfHosted({ deviceLabel: "a".repeat(65) }),
        { sessionToken: "session-after-totp", recoveryPhrase: RECOVERY_PHRASE },
        NOW,
        apiClientFactory,
      ),
    ).resolves.toEqual({ ok: false, errorCode: "device_label_invalid_length" });
    expect(apiClientFactory).not.toHaveBeenCalled();
  });
});

describe("sync run and device errors", () => {
  it("answers an invalid device id in device management as generic", async () => {
    const client = apiClient({
      listDevices: jest.fn().mockResolvedValue({ ok: false, errorCode: "invalid_device" }),
    });

    await expect(
      listSyncDevices(
        preparedSecretStore("session-1"),
        selfHosted({ setupStatus: "connected" }),
        jest.fn().mockReturnValue(client),
        jest.fn(),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "generic" });
  });

  it("answers a busy server in device management as network_failed", async () => {
    const client = apiClient({
      listDevices: jest.fn().mockResolvedValue({ ok: false, errorCode: "server_busy" }),
    });

    await expect(
      listSyncDevices(
        preparedSecretStore("session-1"),
        selfHosted({ setupStatus: "connected" }),
        jest.fn().mockReturnValue(client),
        jest.fn(),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "network_failed" });
  });

  it("passes the server's wait through a busy restore", async () => {
    const preferences = selfHosted({ setupStatus: "connected" });
    const client = apiClient({
      getBlob: jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "server_busy", retryAfterSeconds: 30 }),
    });

    await expect(
      runSyncRestore(
        createLocalAppStorageMock(),
        preparedSecretStore("session-1"),
        preferences,
        jest.fn().mockReturnValue(client),
        jest.fn(),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "server_busy", retryAfterSeconds: 30 });
  });

  it("answers a sync-disabled account as sync_not_allowed", async () => {
    const preferences = selfHosted({ setupStatus: "connected" });
    const client = apiClient({
      getBlob: jest.fn().mockResolvedValue({ ok: false, errorCode: "sync_disabled" }),
      listDevices: jest.fn().mockResolvedValue({ ok: false, errorCode: "sync_disabled" }),
    });
    const apiClientFactory = jest.fn().mockReturnValue(client);
    const secretStore = preparedSecretStore("session-1");

    await expect(
      runSyncRestore(createLocalAppStorageMock(), secretStore, preferences, apiClientFactory, jest.fn()),
    ).resolves.toEqual({ ok: false, errorCode: "sync_not_allowed" });
    await expect(
      listSyncDevices(secretStore, preferences, apiClientFactory, jest.fn()),
    ).resolves.toEqual({ ok: false, errorCode: "sync_not_allowed" });
  });
});
