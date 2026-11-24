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
import { advanceSyncWipeEpoch } from "./sync-wipe-epoch";

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
        .mockResolvedValue({ ok: true, recoveryCode: "NEW-CODE-1" });
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

      // The server rotated the recovery code; the new one reaches the caller.
      expect(result).toEqual({ ok: true, recoveryCode: "NEW-CODE-1" });
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
          code: "123456",
        },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: true, recoveryCode: null });
      // Ovumcy Cloud takes no code on this route.
      expect(changePassword).toHaveBeenCalledWith("managed-session-1", {
        currentPassword: "old password 12345",
        newPassword: "new password 12345",
      });
    });

    it("sends the trimmed TOTP code to the community server", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const changePassword = jest
        .fn()
        .mockResolvedValue({ ok: true, recoveryCode: "NEW-CODE-1" });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ changePassword }));

      await changeSyncAccountPassword(
        secretStore,
        selfHostedPreferences(),
        {
          currentPassword: "old password 12345",
          newPassword: "new password 12345",
          code: " 123456 ",
        },
        apiFactory,
        jest.fn(),
      );

      expect(changePassword).toHaveBeenCalledWith("community-session-1", {
        currentPassword: "old password 12345",
        newPassword: "new password 12345",
        code: "123456",
      });
    });

    it.each([
      ["  ", "totp_code_required"],
      ["12ab56", "totp_invalid_code"],
    ] as const)(
      "refuses a code of %j as %s before any request",
      async (code, errorCode) => {
        const secretStore = createSyncSecretStoreMock(connectedSecrets());
        const apiFactory = jest.fn();

        const result = await changeSyncAccountPassword(
          secretStore,
          selfHostedPreferences(),
          {
            currentPassword: "old password 12345",
            newPassword: "new password 12345",
            code,
          },
          apiFactory,
          jest.fn(),
        );

        expect(result).toEqual({ ok: false, errorCode });
        expect(apiFactory).not.toHaveBeenCalled();
      },
    );

    it.each(["totp_invalid_code", "totp_replayed", "totp_not_configured"] as const)(
      "maps the community %s answer instead of generic",
      async (errorCode) => {
        const secretStore = createSyncSecretStoreMock(connectedSecrets());
        const apiFactory = jest.fn().mockReturnValue(
          communityClientMock({
            changePassword: jest.fn().mockResolvedValue({ ok: false, errorCode }),
          }),
        );

        const result = await changeSyncAccountPassword(
          secretStore,
          selfHostedPreferences(),
          {
            currentPassword: "old password 12345",
            newPassword: "new password 12345",
            code: "123456",
          },
          apiFactory,
          jest.fn(),
        );

        expect(result).toEqual({ ok: false, errorCode });
      },
    );

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

    it("rejects a new password over 72 bytes before any network call", async () => {
      const apiFactory = jest.fn();
      const managedFactory = jest.fn();

      const result = await changeSyncAccountPassword(
        createSyncSecretStoreMock(connectedSecrets()),
        selfHostedPreferences(),
        { currentPassword: "old password 12345", newPassword: "ж".repeat(37) },
        apiFactory,
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "password_too_long" });
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
    it("clears this device's session and downgrades to local_ready when the reset revoked it", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const resetPassword = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "rotated1234rotated1234rotated123" },
      });
      const getSession = jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "unauthorized" });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ resetPassword, getSession }));

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
        signedOut: true,
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

    it("writes nothing when a local wipe lands during the session probe, and still returns the recovery code", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const writeSecrets = jest.spyOn(secretStore, "writeSyncSecrets");
      const resetPassword = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "rotated1234rotated1234rotated123" },
      });
      const getSession = jest.fn().mockImplementation(async () => {
        advanceSyncWipeEpoch();
        return { ok: false, errorCode: "unauthorized" };
      });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ resetPassword, getSession }));

      const wiped = createDefaultSyncPreferencesRecord();
      jest.mocked(storage.readSyncPreferencesRecord).mockResolvedValue(wiped);

      const result = await resetSyncAccountPassword(
        storage,
        secretStore,
        selfHostedPreferences(),
        { resetToken: "reset-token-1", newPassword: "new password 12345" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({
        ok: true,
        recoveryCode: "rotated1234rotated1234rotated123",
        preferences: wiped,
        signedOut: false,
      });
      expect(writeSecrets).not.toHaveBeenCalled();
      expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
    });

    it.each([
      ["while the secrets are read", "read"],
      ["while the cleared secrets are written", "write"],
    ] as const)(
      "skips the preferences write when a local wipe lands %s",
      async (_label, stage) => {
        const storage = createLocalAppStorageMock();
        // An unreadable record after the wipe falls back to the caller's copy.
        jest
          .mocked(storage.readSyncPreferencesRecord)
          .mockRejectedValue(new Error("storage unavailable"));
        const secretStore = createSyncSecretStoreMock(connectedSecrets());
        const getSession = jest
          .fn()
          .mockResolvedValue({ ok: false, errorCode: "unauthorized" });
        const resetPassword = jest.fn().mockResolvedValue({
          ok: true,
          result: { recoveryCode: "rotated1234rotated1234rotated123" },
        });
        const apiFactory = jest
          .fn()
          .mockReturnValue(communityClientMock({ resetPassword, getSession }));
        const realRead = secretStore.readSyncSecrets.bind(secretStore);
        const realWrite = secretStore.writeSyncSecrets.bind(secretStore);
        const writeSecrets = jest
          .spyOn(secretStore, "writeSyncSecrets")
          .mockImplementation(async (record) => {
            await realWrite(record);
            if (stage === "write") advanceSyncWipeEpoch();
          });
        let reads = 0;
        jest.spyOn(secretStore, "readSyncSecrets").mockImplementation(async () => {
          const record = await realRead();
          reads += 1;
          // The first read is the probe's; the second is the clear's.
          if (stage === "read" && reads === 2) advanceSyncWipeEpoch();
          return record;
        });

        const initial = selfHostedPreferences();
        const result = await resetSyncAccountPassword(
          storage,
          secretStore,
          initial,
          { resetToken: "reset-token-1", newPassword: "new password 12345" },
          apiFactory,
          jest.fn(),
        );

        expect(result).toEqual(
          expect.objectContaining({ ok: true, preferences: initial, signedOut: false }),
        );
        expect(writeSecrets).toHaveBeenCalledTimes(stage === "write" ? 1 : 0);
        expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
      },
    );

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

    it("rejects a new password over 72 bytes before consuming the reset token", async () => {
      const apiFactory = jest.fn();
      const managedFactory = jest.fn();

      const result = await resetSyncAccountPassword(
        createLocalAppStorageMock(),
        createSyncSecretStoreMock(connectedSecrets()),
        selfHostedPreferences(),
        { resetToken: "reset-token-1", newPassword: "a".repeat(73) },
        apiFactory,
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "password_too_long" });
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

    it("dispatches to the managed client and clears session tokens when the reset revoked them", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const resetPassword = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "rotated1234rotated1234rotated123" },
      });
      const getSession = jest
        .fn()
        .mockResolvedValue({ ok: false, errorCode: "unauthorized" });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ resetPassword, getSession }));

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
        signedOut: true,
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

    describe("probing this device's own session after the reset", () => {
      const RESET_INPUT = {
        resetToken: "reset-token-1",
        newPassword: "new password 12345",
      };
      const RESET_OK = {
        ok: true,
        result: { recoveryCode: "rotated1234rotated1234rotated123" },
      };

      function managedSecretsWithRefresh() {
        return {
          ...connectedSecrets(),
          managedAuthSessionExpiresAt: "2099-01-01T00:00:00.000Z",
          managedRefreshToken: "refresh-1",
          managedRefreshTokenExpiresAt: "2099-02-01T00:00:00.000Z",
        };
      }

      it("clears all four managed fields and the sync session when the reset revoked this account", async () => {
        const storage = createLocalAppStorageMock();
        const secretStore = createSyncSecretStoreMock(managedSecretsWithRefresh());
        const client = managedClientMock({
          resetPassword: jest.fn().mockResolvedValue(RESET_OK),
          getSession: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
          refreshSession: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
        });

        const result = await resetSyncAccountPassword(
          storage,
          secretStore,
          managedPreferences(),
          RESET_INPUT,
          jest.fn(),
          () => client,
        );

        expect(result).toEqual(
          expect.objectContaining({
            ok: true,
            preferences: expect.objectContaining({ setupStatus: "local_ready" }),
            signedOut: true,
          }),
        );
        expect(client.refreshSession).toHaveBeenCalledWith("refresh-1");
        await expect(secretStore.readSyncSecrets()).resolves.toEqual(
          expect.objectContaining({
            authSessionToken: null,
            managedAuthSessionToken: null,
            managedAuthSessionExpiresAt: null,
            managedRefreshToken: null,
            managedRefreshTokenExpiresAt: null,
          }),
        );
      });

      it("keeps this device's managed session when the reset named another account", async () => {
        const storage = createLocalAppStorageMock();
        const before = managedSecretsWithRefresh();
        const secretStore = createSyncSecretStoreMock(before);
        const getSession = jest.fn().mockResolvedValue({ ok: true, session: {} });
        const client = managedClientMock({
          resetPassword: jest.fn().mockResolvedValue(RESET_OK),
          getSession,
        });
        const preferences = managedPreferences();

        const result = await resetSyncAccountPassword(
          storage,
          secretStore,
          preferences,
          RESET_INPUT,
          jest.fn(),
          () => client,
        );

        expect(result).toEqual({
          ok: true,
          recoveryCode: "rotated1234rotated1234rotated123",
          preferences,
          signedOut: false,
        });
        expect(getSession).toHaveBeenCalledWith("managed-session-1");
        await expect(secretStore.readSyncSecrets()).resolves.toEqual(before);
        expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
      });

      it("keeps a managed session renewed after a 401 on the probe", async () => {
        const storage = createLocalAppStorageMock();
        const secretStore = createSyncSecretStoreMock(managedSecretsWithRefresh());
        const getSession = jest
          .fn()
          .mockResolvedValueOnce({ ok: false, errorCode: "unauthorized" })
          .mockResolvedValueOnce({ ok: true, session: {} });
        const client = managedClientMock({
          resetPassword: jest.fn().mockResolvedValue(RESET_OK),
          getSession,
          refreshSession: jest.fn().mockResolvedValue({
            ok: true,
            auth: {
              accountID: "acct-1",
              sessionToken: "managed-session-2",
              sessionExpiresAt: "2099-01-02T00:00:00.000Z",
              refreshToken: "refresh-2",
              refreshTokenExpiresAt: "2099-02-02T00:00:00.000Z",
              recoveryCode: null,
              totpChallenge: null,
            },
          }),
        });

        const result = await resetSyncAccountPassword(
          storage,
          secretStore,
          managedPreferences(),
          RESET_INPUT,
          jest.fn(),
          () => client,
        );

        expect(result).toEqual(
          expect.objectContaining({
            preferences: expect.objectContaining({ setupStatus: "connected" }),
          }),
        );
        expect(getSession).toHaveBeenLastCalledWith("managed-session-2");
        await expect(secretStore.readSyncSecrets()).resolves.toEqual(
          expect.objectContaining({
            authSessionToken: "community-session-1",
            managedAuthSessionToken: "managed-session-2",
            managedRefreshToken: "refresh-2",
          }),
        );
      });

      it.each([
        ["a transport failure", { ok: false, errorCode: "network_failed" }],
        ["a server fault", { ok: false, errorCode: "generic" }],
      ])("keeps the managed session when the probe ends in %s", async (_label, answer) => {
        const storage = createLocalAppStorageMock();
        const before = managedSecretsWithRefresh();
        const secretStore = createSyncSecretStoreMock(before);
        const client = managedClientMock({
          resetPassword: jest.fn().mockResolvedValue(RESET_OK),
          getSession: jest.fn().mockResolvedValue(answer),
        });

        await resetSyncAccountPassword(
          storage,
          secretStore,
          managedPreferences(),
          RESET_INPUT,
          jest.fn(),
          () => client,
        );

        await expect(secretStore.readSyncSecrets()).resolves.toEqual(before);
        expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
      });

      it("keeps the managed session when its refresh after a 401 cannot complete", async () => {
        const storage = createLocalAppStorageMock();
        const before = managedSecretsWithRefresh();
        const secretStore = createSyncSecretStoreMock(before);
        const client = managedClientMock({
          resetPassword: jest.fn().mockResolvedValue(RESET_OK),
          getSession: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "unauthorized" }),
          refreshSession: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "network_failed" }),
        });

        await resetSyncAccountPassword(
          storage,
          secretStore,
          managedPreferences(),
          RESET_INPUT,
          jest.fn(),
          () => client,
        );

        await expect(secretStore.readSyncSecrets()).resolves.toEqual(before);
        expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
      });

      it("probes nothing when this device holds no managed session", async () => {
        const storage = createLocalAppStorageMock();
        const before = { ...connectedSecrets(), managedAuthSessionToken: null };
        const secretStore = createSyncSecretStoreMock(before);
        const getSession = jest.fn();
        const client = managedClientMock({
          resetPassword: jest.fn().mockResolvedValue(RESET_OK),
          getSession,
        });

        await resetSyncAccountPassword(
          storage,
          secretStore,
          managedPreferences(),
          RESET_INPUT,
          jest.fn(),
          () => client,
        );

        expect(getSession).not.toHaveBeenCalled();
        await expect(secretStore.readSyncSecrets()).resolves.toEqual(before);
      });

      it.each([
        ["a live session (another account was reset)", { ok: true, session: { twoFactorEnabled: false } }],
        ["a transport failure", { ok: false, errorCode: "network_failed" }],
      ])("keeps the self-hosted session on %s", async (_label, answer) => {
        const storage = createLocalAppStorageMock();
        const before = connectedSecrets();
        const secretStore = createSyncSecretStoreMock(before);
        const getSession = jest.fn().mockResolvedValue(answer);
        const apiFactory = jest.fn().mockReturnValue(
          communityClientMock({
            resetPassword: jest.fn().mockResolvedValue(RESET_OK),
            getSession,
          }),
        );
        const preferences = selfHostedPreferences();

        const result = await resetSyncAccountPassword(
          storage,
          secretStore,
          preferences,
          RESET_INPUT,
          apiFactory,
          jest.fn(),
        );

        expect(result).toEqual(expect.objectContaining({ ok: true, preferences }));
        expect(getSession).toHaveBeenCalledWith("community-session-1");
        await expect(secretStore.readSyncSecrets()).resolves.toEqual(before);
        expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
      });

      it("probes nothing when this device holds no self-hosted session", async () => {
        const before = { ...connectedSecrets(), authSessionToken: null };
        const secretStore = createSyncSecretStoreMock(before);
        const getSession = jest.fn();
        const apiFactory = jest.fn().mockReturnValue(
          communityClientMock({
            resetPassword: jest.fn().mockResolvedValue(RESET_OK),
            getSession,
          }),
        );

        await resetSyncAccountPassword(
          createLocalAppStorageMock(),
          secretStore,
          selfHostedPreferences(),
          RESET_INPUT,
          apiFactory,
          jest.fn(),
        );

        expect(getSession).not.toHaveBeenCalled();
        await expect(secretStore.readSyncSecrets()).resolves.toEqual(before);
      });
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
        createLocalAppStorageMock(),
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "current password 12345" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({
        ok: true,
        recoveryCode: "fresh1234fresh1234fresh1234fresh",
        preferences: selfHostedPreferences(),
        signedOut: false,
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
        createLocalAppStorageMock(),
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
        createLocalAppStorageMock(),
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
        createLocalAppStorageMock(),
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
        createLocalAppStorageMock(),
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
        createLocalAppStorageMock(),
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
        createLocalAppStorageMock(),
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
        createLocalAppStorageMock(),
        secretStore,
        managedPreferences(),
        { currentPassword: "current password 12345" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({
        ok: true,
        recoveryCode: "fresh1234fresh1234fresh1234fresh",
        preferences: expect.objectContaining({ mode: "managed" }),
        signedOut: true,
      });
      expect(regenerateRecoveryCode).toHaveBeenCalledWith("managed-session-1", {
        currentPassword: "current password 12345",
      });
    });

    describe("local session after the server revokes it", () => {
      const NEW_CODE = "fresh1234fresh1234fresh1234fresh";

      function managedRegenerateFactory() {
        return jest.fn().mockReturnValue(
          managedClientMock({
            regenerateRecoveryCode: jest.fn().mockResolvedValue({
              ok: true,
              result: { recoveryCode: NEW_CODE },
            }),
          }),
        );
      }

      it("clears the managed session and reports signedOut after a managed 200", async () => {
        const secretStore = createSyncSecretStoreMock(connectedSecrets());
        const storage = createLocalAppStorageMock();

        const result = await regenerateSyncAccountRecoveryCode(
          storage,
          secretStore,
          managedPreferences(),
          { currentPassword: "current password 12345" },
          jest.fn(),
          managedRegenerateFactory(),
        );

        expect(result).toEqual({
          ok: true,
          recoveryCode: NEW_CODE,
          preferences: expect.objectContaining({ setupStatus: "local_ready" }),
          signedOut: true,
        });
        await expect(secretStore.readSyncSecrets()).resolves.toEqual(
          expect.objectContaining({
            managedAuthSessionToken: null,
            managedRefreshToken: null,
            authSessionToken: null,
          }),
        );
        expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
          expect.objectContaining({ setupStatus: "local_ready" }),
        );
      });

      it("signs out from the stored preferences, not the caller's older copy", async () => {
        const secretStore = createSyncSecretStoreMock(connectedSecrets());
        const storage = createLocalAppStorageMock();
        (storage.readSyncPreferencesRecord as jest.Mock).mockResolvedValue(
          { ...managedPreferences(), lastRemoteGeneration: 42 },
        );

        await regenerateSyncAccountRecoveryCode(
          storage,
          secretStore,
          { ...managedPreferences(), lastRemoteGeneration: 7 },
          { currentPassword: "current password 12345" },
          jest.fn(),
          managedRegenerateFactory(),
        );

        expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
          expect.objectContaining({ lastRemoteGeneration: 42 }),
        );
      });

      it("still returns the code with signedOut false when the local clear throws", async () => {
        const secretStore = createSyncSecretStoreMock(connectedSecrets());
        const storage = createLocalAppStorageMock();
        (storage.writeSyncPreferencesRecord as jest.Mock).mockRejectedValue(
          new Error("disk full"),
        );

        const result = await regenerateSyncAccountRecoveryCode(
          storage,
          secretStore,
          managedPreferences(),
          { currentPassword: "current password 12345" },
          jest.fn(),
          managedRegenerateFactory(),
        );

        expect(result).toEqual({
          ok: true,
          recoveryCode: NEW_CODE,
          preferences: managedPreferences(),
          signedOut: false,
        });
      });

      it("returns the code and writes nothing when a wipe lands during the call", async () => {
        const secretStore = createSyncSecretStoreMock(connectedSecrets());
        const storage = createLocalAppStorageMock();
        const wipedPreferences = createDefaultSyncPreferencesRecord();
        (storage.readSyncPreferencesRecord as jest.Mock).mockResolvedValue(
          wipedPreferences,
        );
        const factory = jest.fn().mockReturnValue(
          managedClientMock({
            regenerateRecoveryCode: jest.fn().mockImplementation(async () => {
              advanceSyncWipeEpoch();
              return { ok: true, result: { recoveryCode: NEW_CODE } };
            }),
          }),
        );

        const result = await regenerateSyncAccountRecoveryCode(
          storage,
          secretStore,
          managedPreferences(),
          { currentPassword: "current password 12345" },
          jest.fn(),
          factory,
        );

        expect(result).toEqual({
          ok: true,
          recoveryCode: NEW_CODE,
          preferences: wipedPreferences,
          signedOut: false,
        });
        expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
      });

      it("leaves the session untouched after a self-hosted 200", async () => {
        const secrets = connectedSecrets();
        const secretStore = createSyncSecretStoreMock(secrets);
        const storage = createLocalAppStorageMock();
        const apiFactory = jest.fn().mockReturnValue(
          communityClientMock({
            regenerateRecoveryCode: jest.fn().mockResolvedValue({
              ok: true,
              result: { recoveryCode: NEW_CODE },
            }),
          }),
        );

        const result = await regenerateSyncAccountRecoveryCode(
          storage,
          secretStore,
          selfHostedPreferences(),
          { currentPassword: "current password 12345" },
          apiFactory,
          jest.fn(),
        );

        expect(result).toMatchObject({ ok: true, signedOut: false });
        await expect(secretStore.readSyncSecrets()).resolves.toEqual(secrets);
        expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
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
        createLocalAppStorageMock(),
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "current password 12345" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "generic" });
    });

    it("sends the trimmed TOTP code to the community client", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const regenerateRecoveryCode = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "fresh1234fresh1234fresh1234fresh" },
      });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ regenerateRecoveryCode }));

      const result = await regenerateSyncAccountRecoveryCode(
        createLocalAppStorageMock(),
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "current password 12345", code: " 123456 " },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({
        ok: true,
        recoveryCode: "fresh1234fresh1234fresh1234fresh",
        preferences: selfHostedPreferences(),
        signedOut: false,
      });
      expect(regenerateRecoveryCode).toHaveBeenCalledWith(
        "community-session-1",
        { currentPassword: "current password 12345", code: "123456" },
      );
    });

    it.each([
      ["", "totp_code_required"],
      ["   ", "totp_code_required"],
      ["12345", "totp_invalid_code"],
      ["1234567", "totp_invalid_code"],
      ["12a456", "totp_invalid_code"],
    ] as const)(
      "refuses a missing or malformed TOTP code %p before any network call",
      async (code, errorCode) => {
        const secretStore = createSyncSecretStoreMock(connectedSecrets());
        const apiFactory = jest.fn();

        const result = await regenerateSyncAccountRecoveryCode(
          createLocalAppStorageMock(),
          secretStore,
          selfHostedPreferences(),
          { currentPassword: "current password 12345", code },
          apiFactory,
          jest.fn(),
        );

        expect(result).toEqual({ ok: false, errorCode });
        expect(apiFactory).not.toHaveBeenCalled();
      },
    );

    it("sends the trimmed TOTP code to the managed client", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const regenerateRecoveryCode = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "fresh1234fresh1234fresh1234fresh" },
      });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ regenerateRecoveryCode }));

      const result = await regenerateSyncAccountRecoveryCode(
        createLocalAppStorageMock(),
        secretStore,
        managedPreferences(),
        { currentPassword: "current password 12345", code: " 123456 " },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({
        ok: true,
        recoveryCode: "fresh1234fresh1234fresh1234fresh",
        preferences: expect.objectContaining({ mode: "managed" }),
        signedOut: true,
      });
      expect(regenerateRecoveryCode).toHaveBeenCalledWith("managed-session-1", {
        currentPassword: "current password 12345",
        code: "123456",
      });
    });

    it("sends no code field to the managed client when none is given", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const regenerateRecoveryCode = jest.fn().mockResolvedValue({
        ok: true,
        result: { recoveryCode: "fresh1234fresh1234fresh1234fresh" },
      });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ regenerateRecoveryCode }));

      await regenerateSyncAccountRecoveryCode(
        createLocalAppStorageMock(),
        secretStore,
        managedPreferences(),
        { currentPassword: "current password 12345" },
        jest.fn(),
        managedFactory,
      );

      expect(regenerateRecoveryCode).toHaveBeenCalledWith("managed-session-1", {
        currentPassword: "current password 12345",
      });
    });

    it.each([
      ["", "totp_code_required"],
      ["12345", "totp_invalid_code"],
    ] as const)(
      "refuses a missing or malformed managed TOTP code %p before any network call",
      async (code, errorCode) => {
        const secretStore = createSyncSecretStoreMock(connectedSecrets());
        const managedFactory = jest.fn();

        const result = await regenerateSyncAccountRecoveryCode(
          createLocalAppStorageMock(),
          secretStore,
          managedPreferences(),
          { currentPassword: "current password 12345", code },
          jest.fn(),
          managedFactory,
        );

        expect(result).toEqual({ ok: false, errorCode });
        expect(managedFactory).not.toHaveBeenCalled();
      },
    );

    it.each([
      "totp_invalid_code",
      "totp_replayed",
      "totp_not_configured",
      "totp_secret_failed",
    ] as const)("passes through managed %s", async (errorCode) => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const managedFactory = jest.fn().mockReturnValue(
        managedClientMock({
          regenerateRecoveryCode: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode }),
        }),
      );

      const result = await regenerateSyncAccountRecoveryCode(
        createLocalAppStorageMock(),
        secretStore,
        managedPreferences(),
        { currentPassword: "current password 12345", code: "123456" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode });
    });

    it.each([
      "totp_invalid_code",
      "totp_replayed",
      "totp_not_configured",
      "totp_secret_failed",
    ] as const)("passes through community %s", async (errorCode) => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn().mockReturnValue(
        communityClientMock({
          regenerateRecoveryCode: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode }),
        }),
      );

      const result = await regenerateSyncAccountRecoveryCode(
        createLocalAppStorageMock(),
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "current password 12345", code: "123456" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode });
    });
  });
});
