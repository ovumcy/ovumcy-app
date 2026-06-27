import { createSyncSecretsRecord } from "../security/sync-crypto";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";
import {
  completeTOTPChallenge,
  disableTOTP,
  startTOTPEnrollment,
  verifyTOTPEnrollment,
} from "./sync-totp-service";

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

function selfHostedPreferences(): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted",
    endpointInput: "192.168.1.20:8080",
    deviceLabel: "Pixel 7",
    setupStatus: "connected",
    preparedAt: "2026-05-17T08:00:00.000Z",
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

describe("sync-totp-service", () => {
  describe("startTOTPEnrollment", () => {
    it("dispatches the managed client with the managed session token", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const startEnrollment = jest.fn().mockResolvedValue({
        ok: true,
        enrollment: {
          secretBase32: "JBSWY3DPEHPK3PXP",
          provisioningURI:
            "otpauth://totp/ovumcy-managed:owner@example.com?secret=JBSWY3DPEHPK3PXP",
        },
      });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ startTOTPEnrollment: startEnrollment }));

      const result = await startTOTPEnrollment(
        secretStore,
        managedPreferences(),
        { currentPassword: "very secure password" },
        jest.fn(),
        managedFactory,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.enrollment.secretBase32).toBe("JBSWY3DPEHPK3PXP");
      }
      expect(startEnrollment).toHaveBeenCalledWith("managed-session-1", {
        currentPassword: "very secure password",
      });
    });

    it("dispatches the community client with the community session token", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const startEnrollment = jest.fn().mockResolvedValue({
        ok: true,
        enrollment: {
          secretBase32: "JBSWY3DPEHPK3PXP",
          provisioningURI:
            "otpauth://totp/ovumcy-sync-community:owner@example.com?secret=JBSWY3DPEHPK3PXP",
        },
      });
      const apiFactory = jest
        .fn()
        .mockReturnValue(communityClientMock({ startTOTPEnrollment: startEnrollment }));

      const result = await startTOTPEnrollment(
        secretStore,
        selfHostedPreferences(),
        { currentPassword: "very secure password" },
        apiFactory,
        jest.fn(),
      );

      expect(result.ok).toBe(true);
      expect(startEnrollment).toHaveBeenCalledWith("community-session-1", {
        currentPassword: "very secure password",
      });
    });

    it("returns current_password_required when the password is empty", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());

      const result = await startTOTPEnrollment(
        secretStore,
        managedPreferences(),
        { currentPassword: "" },
      );

      expect(result).toEqual({
        ok: false,
        errorCode: "current_password_required",
      });
    });

    it("returns not_connected when no session token is stored", async () => {
      const { record } = createSyncSecretsRecord(
        "Pixel 7",
        new Date("2026-05-17T08:00:00.000Z"),
      );
      const secretStore = createSyncSecretStoreMock({
        ...record,
        authSessionToken: null,
        managedAuthSessionToken: null,
      });

      const result = await startTOTPEnrollment(
        secretStore,
        managedPreferences(),
        { currentPassword: "very secure password" },
        jest.fn(),
        jest.fn().mockReturnValue(managedClientMock()),
      );

      expect(result).toEqual({ ok: false, errorCode: "not_connected" });
    });

    it("maps totp_not_configured from the managed backend", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const managedFactory = jest.fn().mockReturnValue(
        managedClientMock({
          startTOTPEnrollment: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "totp_not_configured" }),
        }),
      );

      const result = await startTOTPEnrollment(
        secretStore,
        managedPreferences(),
        { currentPassword: "very secure password" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: false, errorCode: "totp_not_configured" });
    });
  });

  describe("verifyTOTPEnrollment", () => {
    it("rejects non-6-digit codes locally without calling fetch", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();
      const managedFactory = jest.fn();

      const cases: [string, string][] = [
        ["abc", "letters"],
        ["12345", "5 digits"],
        ["1234567", "7 digits"],
        ["   ", "whitespace only"],
      ];

      for (const [code] of cases) {
        const result = await verifyTOTPEnrollment(
          secretStore,
          managedPreferences(),
          { code },
          apiFactory,
          managedFactory,
        );
        expect(result).toEqual({ ok: false, errorCode: "totp_invalid_code" });
      }

      expect(apiFactory).not.toHaveBeenCalled();
      expect(managedFactory).not.toHaveBeenCalled();
    });

    it("passes a trimmed 6-digit code through to the network", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const verifyFn = jest.fn().mockResolvedValue({ ok: true });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ verifyTOTPEnrollment: verifyFn }));

      const result = await verifyTOTPEnrollment(
        secretStore,
        managedPreferences(),
        { code: " 123456 " },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: true });
      expect(verifyFn).toHaveBeenCalledWith("managed-session-1", {
        code: " 123456 ",
      });
    });

    it("maps totp_invalid_code from the community backend", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn().mockReturnValue(
        communityClientMock({
          verifyTOTPEnrollment: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "totp_invalid_code" }),
        }),
      );

      const result = await verifyTOTPEnrollment(
        secretStore,
        selfHostedPreferences(),
        { code: "000000" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({ ok: false, errorCode: "totp_invalid_code" });
    });
  });

  describe("disableTOTP", () => {
    it("requires a non-empty password", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());

      expect(
        await disableTOTP(secretStore, managedPreferences(), {
          currentPassword: "",
          code: "123456",
        }),
      ).toEqual({ ok: false, errorCode: "current_password_required" });
    });

    it("rejects non-6-digit codes locally without calling fetch", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const apiFactory = jest.fn();
      const managedFactory = jest.fn();

      const badCodes = ["  ", "abc", "12345", "1234567"];

      for (const code of badCodes) {
        const result = await disableTOTP(
          secretStore,
          managedPreferences(),
          { currentPassword: "very secure password", code },
          apiFactory,
          managedFactory,
        );
        expect(result).toEqual({ ok: false, errorCode: "totp_invalid_code" });
      }

      expect(apiFactory).not.toHaveBeenCalled();
      expect(managedFactory).not.toHaveBeenCalled();
    });

    it("dispatches the managed client when in managed mode", async () => {
      const secretStore = createSyncSecretStoreMock(connectedSecrets());
      const disable = jest.fn().mockResolvedValue({ ok: true });
      const managedFactory = jest
        .fn()
        .mockReturnValue(managedClientMock({ disableTOTP: disable }));

      const result = await disableTOTP(
        secretStore,
        managedPreferences(),
        { currentPassword: "very secure password", code: "123456" },
        jest.fn(),
        managedFactory,
      );

      expect(result).toEqual({ ok: true });
      expect(disable).toHaveBeenCalledWith("managed-session-1", {
        currentPassword: "very secure password",
        code: "123456",
      });
    });
  });

  describe("completeTOTPChallenge", () => {
    it("requires a non-empty challenge id", async () => {
      expect(
        await completeTOTPChallenge(managedPreferences(), {
          challengeID: "",
          code: "123456",
        }),
      ).toEqual({ ok: false, errorCode: "challenge_id_required" });
    });

    it("rejects non-6-digit codes locally without calling fetch", async () => {
      const apiFactory = jest.fn();
      const managedFactory = jest.fn();

      const badCodes = ["", "abc", "12345", "1234567"];

      for (const code of badCodes) {
        const result = await completeTOTPChallenge(
          managedPreferences(),
          { challengeID: "challenge-1", code },
          apiFactory,
          managedFactory,
        );
        expect(result).toEqual({ ok: false, errorCode: "totp_invalid_code" });
      }

      expect(apiFactory).not.toHaveBeenCalled();
      expect(managedFactory).not.toHaveBeenCalled();
    });

    it("returns a SyncAuthResult shape for both backends", async () => {
      const managedFactory = jest.fn().mockReturnValue(
        managedClientMock({
          completeTOTPChallenge: jest.fn().mockResolvedValue({
            ok: true,
            auth: {
              accountID: "account-1",
              email: "owner@example.com",
              sessionToken: "managed-session-after-totp",
              sessionExpiresAt: "2026-05-18T10:00:00.000Z",
              entitlement: {
                syncAllowed: true,
                source: "default_register",
                updatedAt: "2026-05-17T10:00:00.000Z",
                effectiveAt: "2026-05-17T10:00:00.000Z",
                explanation: "Trial active.",
              },
            },
          }),
        }),
      );

      const result = await completeTOTPChallenge(
        managedPreferences(),
        { challengeID: "challenge-1", code: "123456" },
        jest.fn(),
        managedFactory,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.auth.sessionToken).toBe("managed-session-after-totp");
        expect(result.auth.accountID).toBe("account-1");
      }
    });

    it("maps totp_challenge_invalid for the community backend", async () => {
      const apiFactory = jest.fn().mockReturnValue(
        communityClientMock({
          completeTOTPChallenge: jest
            .fn()
            .mockResolvedValue({ ok: false, errorCode: "totp_challenge_invalid" }),
        }),
      );

      const result = await completeTOTPChallenge(
        selfHostedPreferences(),
        { challengeID: "challenge-1", code: "123456" },
        apiFactory,
        jest.fn(),
      );

      expect(result).toEqual({
        ok: false,
        errorCode: "totp_challenge_invalid",
      });
    });
  });
});
