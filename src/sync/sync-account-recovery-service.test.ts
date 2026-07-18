import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import {
  changeSyncAccountPassword,
  regenerateSyncAccountRecoveryCode,
  requestSyncPasswordReset,
  resetSyncAccountPassword,
} from "./sync-account-recovery-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";

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
    getCapabilities: jest.fn(),
    attachDevice: jest.fn(),
    getRecoveryKey: jest.fn(),
    putRecoveryKey: jest.fn(),
    getBlob: jest.fn(),
    putBlob: jest.fn(),
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
    ...overrides,
  } as ManagedCloudAPIClient;
}

function connectedSecrets() {
  const { record } = createSyncSecretsRecord(
    "Pixel 7",
    new Date("2026-03-20T08:00:00.000Z"),
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
    preparedAt: "2026-03-20T08:00:00.000Z",
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

describe("sync-account-recovery-service", () => {
  describe("changeSyncAccountPassword", () => {
    it("dispatches to the community client using the community session token", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const changePassword = jest
        .fn()
        .mockResolvedValue({ ok: true });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ changePassword }));

      const result = await changeSyncAccountPassword(
        secretStore,
        selfHostedPreferences(),
        {
          currentPassword: "old password 12345",
          newPassword: "new password 12345",
        },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: true });
      expect(changePassword).toHaveBeenCalledWith("community-session-1", {
        currentPassword: "old password 12345",
        newPassword: "new password 12345",
      });
    });

    it("dispatches to the managed client using the managed session token", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const changePassword = jest
        .fn()
        .mockResolvedValue({ ok: true });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ changePassword }));

      const result = await changeSyncAccountPassword(
        secretStore,
        managedPreferences(),
        {
          currentPassword: "old password 12345",
          newPassword: "new password 12345",
        },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: true });
      expect(changePassword).toHaveBeenCalledWith("managed-session-1", {
        currentPassword: "old password 12345",
        newPassword: "new password 12345",
      });
    });

    it("maps invalid_current_password from the community client", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn().mockReturnValue(
        communityClientMock({
          changePassword: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "invalid_current_password" }),
        }),
      );

      const result = await changeSyncAccountPassword(
        secretStore,
        selfHostedPreferences(),
        {
          currentPassword: "wrong",
          newPassword: "new password 12345",
        },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({
        ok: false,
        errorCode: "invalid_current_password",
      });
    });

    it("returns not_connected when there are no secrets", async () => {
      const secretStore = createSyncSecretStoreMock(null);
      const apiFactory = jest.fn();
      const managedFactory = jest.fn();

      // newPassword must clear the client-side length floor so this exercises
      // the no-secrets branch rather than short-circuiting on password_too_short.
      const result = await changeSyncAccountPassword(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "x", newPassword: "new password 12345" },
        apiFactory,
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "not_connected" });
      expect(apiFactory).not.toHaveBeenCalled();
      expect(managedFactory).not.toHaveBeenCalled();
    });

    it("validates required inputs before any network call", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();

      const a = await changeSyncAccountPassword(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "", newPassword: "x" },
        apiFactory,
        jest.fn(),
      );
      const b = await changeSyncAccountPassword(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "x", newPassword: "" },
        apiFactory,
        jest.fn(),
      );

      expect(a).toEqual({ ok: false, errorCode: "current_password_required" });
      expect(b).toEqual({ ok: false, errorCode: "new_password_required" });
      expect(apiFactory).not.toHaveBeenCalled();
    });

    it("rejects a new password below the minimum length before any network call", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();
      const managedFactory = jest.fn();

      const result = await changeSyncAccountPassword(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "old password 12345", newPassword: "short" },
        apiFactory,
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "password_too_short" });
      expect(apiFactory).not.toHaveBeenCalled();
      expect(managedFactory).not.toHaveBeenCalled();
    });

    it("reports an empty new password as required, not too short", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());

      const result = await changeSyncAccountPassword(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "old password 12345", newPassword: "" },
        jest.fn(),
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "new_password_required" });
    });

    it("returns not_connected for managed mode when the managed session token is missing", async () => {
      const secretStore = createSyncSecretStoreMock({
        ...connectedSecrets(),
        managedAuthSessionToken: null,
      });
      const managedFactory = jest.fn();

      const result = await changeSyncAccountPassword(
        secretStore,
        managedPreferences(),
        { currentPassword: "old password 12345", newPassword: "new password 12345" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "not_connected" });
      expect(managedFactory).not.toHaveBeenCalled();
    });

    it("passes through a self-hosted endpoint normalization failure", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();

      const result = await changeSyncAccountPassword(
        secretStore,
        selfHostedPreferences({ endpointInput: "  " }),
        { currentPassword: "old password 12345", newPassword: "new password 12345" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "endpoint_required" });
      expect(apiFactory).not.toHaveBeenCalled();
    });

    it("returns not_connected for self-hosted mode when the community session token is missing", async () => {
      const secretStore = createSyncSecretStoreMock({
        ...connectedSecrets(),
        authSessionToken: null,
      });

      const result = await changeSyncAccountPassword(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "old password 12345", newPassword: "new password 12345" },
        jest.fn(),
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "not_connected" });
    });

    it("maps a managed backend failure to its allowlisted error code", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const managedFactory = jest.fn().mockReturnValue(
        managedClientMock({
          changePassword: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "new_password_must_differ" }),
        }),
      );

      const result = await changeSyncAccountPassword(
        secretStore,
        managedPreferences(),
        { currentPassword: "old password 12345", newPassword: "old password 12345" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "new_password_must_differ" });
    });
  });

  describe("requestSyncPasswordReset", () => {
    it("dispatches to the community client by login", async () => {
      const forgotPassword = jest.fn().mockResolvedValue({
        ok: true,
        result: {
          resetToken: "reset-token-1",
          resetTokenExpiresAt: "2026-03-23T01:00:00.000Z",
        },
      });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ forgotPassword }));

      const result = await requestSyncPasswordReset(
        selfHostedPreferences(),
        {
          loginOrEmail: "owner@example.com",
          recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
        },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({
        ok: true,
        resetToken: "reset-token-1",
        resetTokenExpiresAt: "2026-03-23T01:00:00.000Z",
      });
      expect(forgotPassword).toHaveBeenCalledWith({
        login: "owner@example.com",
        recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
      });
    });

    it("dispatches to the managed client by email", async () => {
      const forgotPassword = jest.fn().mockResolvedValue({
        ok: true,
        result: {
          resetToken: "reset-token-1",
          resetTokenExpiresAt: "2026-03-23T01:00:00.000Z",
        },
      });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ forgotPassword }));

      const result = await requestSyncPasswordReset(
        managedPreferences(),
        {
          loginOrEmail: "owner@example.com",
          recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
        },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({
        ok: true,
        resetToken: "reset-token-1",
        resetTokenExpiresAt: "2026-03-23T01:00:00.000Z",
      });
      expect(forgotPassword).toHaveBeenCalledWith({
        email: "owner@example.com",
        recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
      });
    });

    it("forwards generic invalid_recovery_credentials", async () => {
      const apiFactory = jest.fn().mockReturnValue(
        communityClientMock({
          forgotPassword: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "invalid_recovery_credentials" }),
        }),
      );

      const result = await requestSyncPasswordReset(
        selfHostedPreferences(),
        {
          loginOrEmail: "ghost@example.com",
          recoveryCode: "00000000000000000000000000000000",
        },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({
        ok: false,
        errorCode: "invalid_recovery_credentials",
      });
    });

    it("validates the login and recovery-code inputs before any network call", async () => {
      const apiFactory = jest.fn();

      const withoutLogin = await requestSyncPasswordReset(
        selfHostedPreferences(),
        { loginOrEmail: "   ", recoveryCode: "abcd1234abcd1234abcd1234abcd1234" },
        apiFactory,
        jest.fn(),
      );
      const withoutCode = await requestSyncPasswordReset(
        selfHostedPreferences(),
        { loginOrEmail: "owner@example.com", recoveryCode: "  " },
        apiFactory,
        jest.fn(),
      );

      expect(withoutLogin).toEqual({ ok: false, errorCode: "login_required" });
      expect(withoutCode).toEqual({ ok: false, errorCode: "recovery_code_required" });
      expect(apiFactory).not.toHaveBeenCalled();
    });

    it("passes through a self-hosted endpoint normalization failure", async () => {
      const apiFactory = jest.fn();

      const result = await requestSyncPasswordReset(
        selfHostedPreferences({ endpointInput: "  " }),
        {
          loginOrEmail: "owner@example.com",
          recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
        },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "endpoint_required" });
      expect(apiFactory).not.toHaveBeenCalled();
    });

    it("maps a managed backend failure to its allowlisted error code", async () => {
      const managedFactory = jest.fn().mockReturnValue(
        managedClientMock({
          forgotPassword: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "rate_limited" }),
        }),
      );

      const result = await requestSyncPasswordReset(
        managedPreferences(),
        {
          loginOrEmail: "owner@example.com",
          recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
        },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "rate_limited" });
    });

    it("maps an unrecognized community error code to generic", async () => {
      const apiFactory = jest.fn().mockReturnValue(
        communityClientMock({
          forgotPassword: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "server_on_fire" }),
        }),
      );

      const result = await requestSyncPasswordReset(
        selfHostedPreferences(),
        {
          loginOrEmail: "owner@example.com",
          recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
        },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "generic" });
    });
  });

  describe("resetSyncAccountPassword", () => {
    it("clears session tokens and downgrades preferences to local_ready on success", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const resetPassword = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "rotated1234rotated1234rotated123" },
      });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ resetPassword }));

      const initial = selfHostedPreferences();
      const result = await resetSyncAccountPassword(
        storage,
        secretStore,
        initial,
        {
          resetToken: "reset-token-1",
          newPassword: "new password 12345",
        },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({
        ok: true,
        recoveryCode: "rotated1234rotated1234rotated123",
        preferences: expect.objectContaining({
          setupStatus: "local_ready",
        }),
      });
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(
        expect.objectContaining({
          authSessionToken: null,
          managedAuthSessionToken: null,
        }),
      );
      expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
        expect.objectContaining({ setupStatus: "local_ready" }),
      );
    });

    it("works without prior session secrets (forgot flow on a fresh device)", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(null);
      const resetPassword = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "rotated1234rotated1234rotated123" },
      });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ resetPassword }));

      const initial: SyncPreferencesRecord = {
        ...selfHostedPreferences(),
        setupStatus: "not_configured",
      };
      const result = await resetSyncAccountPassword(
        storage,
        secretStore,
        initial,
        {
          resetToken: "reset-token-1",
          newPassword: "new password 12345",
        },
        apiFactory,
        jest.fn(),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        // setupStatus untouched when it was not "connected"
        expect(result.preferences.setupStatus).toBe("not_configured");
      }
      // No secrets to wipe, no preferences write either.
      await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
    });

    it("maps invalid_reset_token", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn().mockReturnValue(
        communityClientMock({
          resetPassword: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "invalid_reset_token" }),
        }),
      );

      const result = await resetSyncAccountPassword(
        storage,
        secretStore,
        selfHostedPreferences(),
        {
          resetToken: "bad-token",
          newPassword: "new password 12345",
        },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "invalid_reset_token" });
      // Failed reset must NOT wipe local session tokens.
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(
        expect.objectContaining({
          authSessionToken: "community-session-1",
          managedAuthSessionToken: "managed-session-1",
        }),
      );
    });

    it("rejects a short new password before consuming the reset token", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();
      const managedFactory = jest.fn();

      const result = await resetSyncAccountPassword(
        storage,
        secretStore,
        selfHostedPreferences(),
        { resetToken: "reset-token-1", newPassword: "short" },
        apiFactory,
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "password_too_short" });
      // No client constructed → the single-use reset token was never spent.
      expect(apiFactory).not.toHaveBeenCalled();
      expect(managedFactory).not.toHaveBeenCalled();
    });

    it("requires a non-blank reset token before any network call", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();

      const result = await resetSyncAccountPassword(
        storage,
        secretStore,
        selfHostedPreferences(),
        { resetToken: "   ", newPassword: "new password 12345" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "reset_token_required" });
      expect(apiFactory).not.toHaveBeenCalled();
    });

    it("passes through a self-hosted endpoint normalization failure", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();

      const result = await resetSyncAccountPassword(
        storage,
        secretStore,
        selfHostedPreferences({ endpointInput: "  " }),
        { resetToken: "reset-token-1", newPassword: "new password 12345" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "endpoint_required" });
      expect(apiFactory).not.toHaveBeenCalled();
    });

    it("dispatches to the managed client and clears session tokens on success", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const resetPassword = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "rotated1234rotated1234rotated123" },
      });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ resetPassword }));

      const result = await resetSyncAccountPassword(
        storage,
        secretStore,
        managedPreferences(),
        { resetToken: "reset-token-1", newPassword: "new password 12345" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({
        ok: true,
        recoveryCode: "rotated1234rotated1234rotated123",
        preferences: expect.objectContaining({ setupStatus: "local_ready" }),
      });
      expect(resetPassword).toHaveBeenCalledWith({
        resetToken: "reset-token-1",
        newPassword: "new password 12345",
      });
      await expect(secretStore.readSyncSecrets()).resolves.toEqual(
        expect.objectContaining({
          authSessionToken: null,
          managedAuthSessionToken: null,
        }),
      );
    });

    it("maps a managed backend failure to its allowlisted error code", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const managedFactory = jest.fn().mockReturnValue(
        managedClientMock({
          resetPassword: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "invalid_reset_token" }),
        }),
      );

      const result = await resetSyncAccountPassword(
        storage,
        secretStore,
        managedPreferences(),
        { resetToken: "bad-token", newPassword: "new password 12345" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "invalid_reset_token" });
    });

    it("maps an unrecognized community error code to generic", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn().mockReturnValue(
        communityClientMock({
          resetPassword: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "server_on_fire" }),
        }),
      );

      const result = await resetSyncAccountPassword(
        storage,
        secretStore,
        selfHostedPreferences(),
        { resetToken: "reset-token-1", newPassword: "new password 12345" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "generic" });
    });
  });

  describe("regenerateSyncAccountRecoveryCode", () => {
    it("dispatches to the community client using the community session token", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const regenerateRecoveryCode = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "fresh1234fresh1234fresh1234fresh" },
      });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ regenerateRecoveryCode }));

      const result = await regenerateSyncAccountRecoveryCode(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "current password 12345" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({
        ok: true,
        recoveryCode: "fresh1234fresh1234fresh1234fresh",
      });
      expect(regenerateRecoveryCode).toHaveBeenCalledWith(
        "community-session-1",
        { currentPassword: "current password 12345" },
      );
    });

    it("maps invalid_current_password from managed client", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const managedFactory = jest.fn().mockReturnValue(
        managedClientMock({
          regenerateRecoveryCode: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "invalid_current_password" }),
        }),
      );

      const result = await regenerateSyncAccountRecoveryCode(
        secretStore,
        managedPreferences(),
        { currentPassword: "wrong" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({
        ok: false,
        errorCode: "invalid_current_password",
      });
    });

    it("returns not_connected when there are no secrets", async () => {
      const secretStore = createSyncSecretStoreMock(null);
      const apiFactory = jest.fn();
      const managedFactory = jest.fn();

      const result = await regenerateSyncAccountRecoveryCode(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "current password 12345" },
        apiFactory,
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "not_connected" });
      expect(apiFactory).not.toHaveBeenCalled();
      expect(managedFactory).not.toHaveBeenCalled();
    });

    it("requires a non-empty current password before any network call", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();

      const result = await regenerateSyncAccountRecoveryCode(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "current_password_required" });
      expect(apiFactory).not.toHaveBeenCalled();
    });

    it("returns not_connected for managed mode when the managed session token is missing", async () => {
      const secretStore = createSyncSecretStoreMock({
        ...connectedSecrets(),
        managedAuthSessionToken: null,
      });
      const managedFactory = jest.fn();

      const result = await regenerateSyncAccountRecoveryCode(
        secretStore,
        managedPreferences(),
        { currentPassword: "current password 12345" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "not_connected" });
      expect(managedFactory).not.toHaveBeenCalled();
    });

    it("passes through a self-hosted endpoint normalization failure", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();

      const result = await regenerateSyncAccountRecoveryCode(
        secretStore,
        selfHostedPreferences({ endpointInput: "  " }),
        { currentPassword: "current password 12345" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "endpoint_required" });
      expect(apiFactory).not.toHaveBeenCalled();
    });

    it("returns not_connected for self-hosted mode when the community session token is missing", async () => {
      const secretStore = createSyncSecretStoreMock({
        ...connectedSecrets(),
        authSessionToken: null,
      });

      const result = await regenerateSyncAccountRecoveryCode(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "current password 12345" },
        jest.fn(),
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "not_connected" });
    });

    it("dispatches to the managed client using the managed session token", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const regenerateRecoveryCode = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "fresh1234fresh1234fresh1234fresh" },
      });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ regenerateRecoveryCode }));

      const result = await regenerateSyncAccountRecoveryCode(
        secretStore,
        managedPreferences(),
        { currentPassword: "current password 12345" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({
        ok: true,
        recoveryCode: "fresh1234fresh1234fresh1234fresh",
      });
      expect(regenerateRecoveryCode).toHaveBeenCalledWith("managed-session-1", {
        currentPassword: "current password 12345",
      });
    });

    it("maps an unrecognized community error code to generic", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn().mockReturnValue(
        communityClientMock({
          regenerateRecoveryCode: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "server_on_fire" }),
        }),
      );

      const result = await regenerateSyncAccountRecoveryCode(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "current password 12345" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "generic" });
    });
  });
});
