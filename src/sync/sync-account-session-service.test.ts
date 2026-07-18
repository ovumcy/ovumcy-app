import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";
import { describeSyncAccountTwoFactor } from "./sync-account-session-service";

function communityClientMock(
  overrides: Partial<SyncAPIClient> = {},
): SyncAPIClient {
  return {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    changePassword: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    regenerateRecoveryCode: jest.fn(),
    startTOTPEnrollment: jest.fn(),
    verifyTOTPEnrollment: jest.fn(),
    disableTOTP: jest.fn(),
    completeTOTPChallenge: jest.fn(),
    getCapabilities: jest.fn(),
    attachDevice: jest.fn(),
    getRecoveryKey: jest.fn(),
    putRecoveryKey: jest.fn(),
    getBlob: jest.fn(),
    putBlob: jest.fn(),
    getSession: jest.fn(),
    ...overrides,
  } as SyncAPIClient;
}

function managedClientMock(
  overrides: Partial<ManagedCloudAPIClient> = {},
): ManagedCloudAPIClient {
  return {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    getSession: jest.fn(),
    createSyncSession: jest.fn(),
    changePassword: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    regenerateRecoveryCode: jest.fn(),
    startTOTPEnrollment: jest.fn(),
    verifyTOTPEnrollment: jest.fn(),
    disableTOTP: jest.fn(),
    completeTOTPChallenge: jest.fn(),
    ...overrides,
  } as unknown as ManagedCloudAPIClient;
}

function connectedSecrets() {
  const { record } = createSyncSecretsRecord(
    "Pixel 7",
    new Date("2026-05-17T08:00:00.000Z"),
  );
  return {
    ...record,
    authSessionToken: "community-session-1",
    managedAuthSessionToken: "managed-session-1",
  };
}

function selfHostedPreferences(
  overrides: Partial<SyncPreferencesRecord> = {},
): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted",
    endpointInput: "192.168.1.20:8080",
    deviceLabel: "Pixel 7",
    setupStatus: "connected",
    preparedAt: "2026-05-17T08:00:00.000Z",
    ...overrides,
  };
}

function managedPreferences(): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed",
    deviceLabel: "Pixel 7",
    setupStatus: "connected",
  };
}

describe("sync-account-session-service", () => {
  describe("describeSyncAccountTwoFactor", () => {
    it("returns null when the device has never connected to sync", async () => {
      const secretStore = createSyncSecretStoreMock(null);

      const result = await describeSyncAccountTwoFactor(
        secretStore,
        managedPreferences(),
        jest.fn(),
        jest.fn(),
      );

      expect(result).toBeNull();
    });

    it("returns null for managed mode when no managed session token is stored", async () => {
      const secretStore = createSyncSecretStoreMock({
        ...connectedSecrets(),
        managedAuthSessionToken: null,
      });
      const managedFactory = jest.fn();

      const result = await describeSyncAccountTwoFactor(
        secretStore,
        managedPreferences(),
        jest.fn(),
        managedFactory,
      );

      expect(result).toBeNull();
      expect(managedFactory).not.toHaveBeenCalled();
    });

    it("reports the managed session's two-factor state", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const getSession = jest
        .fn()
        .mockResolvedValue({ ok: true, session: { twoFactorEnabled: true } });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ getSession }));

      const result = await describeSyncAccountTwoFactor(
        secretStore,
        managedPreferences(),
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ twoFactorEnabled: true });
      expect(getSession).toHaveBeenCalledWith("managed-session-1");
    });

    it("returns null when the managed session lookup fails", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const managedFactory = jest.fn().mockReturnValue(
        managedClientMock({
          getSession: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
        }),
      );

      const result = await describeSyncAccountTwoFactor(
        secretStore,
        managedPreferences(),
        jest.fn(),
        managedFactory,
      );

      expect(result).toBeNull();
    });

    it("returns null for self-hosted mode with an unparseable endpoint", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();

      const result = await describeSyncAccountTwoFactor(
        secretStore,
        selfHostedPreferences({ endpointInput: "  " }),
        apiFactory,
        jest.fn(),
      );

      expect(result).toBeNull();
      expect(apiFactory).not.toHaveBeenCalled();
    });

    it("returns null for self-hosted mode when no community session token is stored", async () => {
      const secretStore = createSyncSecretStoreMock({
        ...connectedSecrets(),
        authSessionToken: null,
      });
      const apiFactory = jest.fn();

      const result = await describeSyncAccountTwoFactor(
        secretStore,
        selfHostedPreferences(),
        apiFactory,
        jest.fn(),
      );

      expect(result).toBeNull();
      expect(apiFactory).not.toHaveBeenCalled();
    });

    it("reports the self-hosted session's two-factor state", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const getSession = jest
        .fn()
        .mockResolvedValue({ ok: true, session: { twoFactorEnabled: false } });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ getSession }));

      const result = await describeSyncAccountTwoFactor(
        secretStore,
        selfHostedPreferences(),
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ twoFactorEnabled: false });
      expect(getSession).toHaveBeenCalledWith("community-session-1");
    });

    it("returns null when the self-hosted session lookup fails", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn().mockReturnValue(
        communityClientMock({
          getSession: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
        }),
      );

      const result = await describeSyncAccountTwoFactor(
        secretStore,
        selfHostedPreferences(),
        apiFactory,
        jest.fn(),
      );

      expect(result).toBeNull();
    });
  });
});
