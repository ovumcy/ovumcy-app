import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
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
    ["a managed setup", { ...preferences, mode: "managed" as const }, "token", undefined, "generic"],
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
