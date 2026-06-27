import { act, renderHook } from "@testing-library/react-native";

import { createSyncSecretsRecord } from "../../../security/sync-crypto";
import { createLocalAppStorageMock } from "../../../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../../../test/create-sync-secret-store-mock";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "../../../sync/sync-contract";
import * as syncTOTPService from "../../../sync/sync-totp-service";
import * as syncAccountSessionService from "../../../sync/sync-account-session-service";
import * as syncAccountRecoveryService from "../../../sync/sync-account-recovery-service";
import { useSyncAccountSecurityController } from "./useSyncAccountSecurityController";

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

function managedPreferences(): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed",
    deviceLabel: "Pixel 7",
    setupStatus: "connected",
  };
}

describe("useSyncAccountSecurityController", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe("handleVerifyTOTPEnrollment", () => {
    it("re-derives twoFactorEnabled from the server after successful verify", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());

      // Initial describe on mount returns unknown (null)
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValueOnce(null)
        // After verify succeeds, describe returns the real server state
        .mockResolvedValueOnce({ twoFactorEnabled: true });

      jest
        .spyOn(syncTOTPService, "verifyTOTPEnrollment")
        .mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );

      // Wait for initial mount effect
      await act(async () => {});

      expect(result.current.twoFactorEnabled).toBeNull();

      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      expect(syncAccountSessionService.describeSyncAccountTwoFactor).toHaveBeenCalledTimes(2);
      expect(result.current.twoFactorEnabled).toBe(true);
    });

    it("keeps previous twoFactorEnabled when describe fails after verify", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());

      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        // Mount: returns false (was already disabled)
        .mockResolvedValueOnce({ twoFactorEnabled: false })
        // After verify: describe fails
        .mockResolvedValueOnce(null);

      jest
        .spyOn(syncTOTPService, "verifyTOTPEnrollment")
        .mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );

      await act(async () => {});

      expect(result.current.twoFactorEnabled).toBe(false);

      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      // State is preserved from before the mutation
      expect(result.current.twoFactorEnabled).toBe(false);
    });
  });

  describe("handleDisableTOTP", () => {
    it("re-derives twoFactorEnabled from the server after successful disable", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());

      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        // Mount: 2FA is on
        .mockResolvedValueOnce({ twoFactorEnabled: true })
        // After disable: server confirms it's off
        .mockResolvedValueOnce({ twoFactorEnabled: false });

      jest
        .spyOn(syncTOTPService, "disableTOTP")
        .mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );

      await act(async () => {});

      expect(result.current.twoFactorEnabled).toBe(true);

      await act(async () => {
        await result.current.handleDisableTOTP();
      });

      expect(syncAccountSessionService.describeSyncAccountTwoFactor).toHaveBeenCalledTimes(2);
      expect(result.current.twoFactorEnabled).toBe(false);
    });

    it("keeps previous twoFactorEnabled when describe fails after disable", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());

      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        // Mount: 2FA is on
        .mockResolvedValueOnce({ twoFactorEnabled: true })
        // After disable: describe fails
        .mockResolvedValueOnce(null);

      jest
        .spyOn(syncTOTPService, "disableTOTP")
        .mockResolvedValue({ ok: true });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );

      await act(async () => {});

      expect(result.current.twoFactorEnabled).toBe(true);

      await act(async () => {
        await result.current.handleDisableTOTP();
      });

      // Preserved from before the mutation
      expect(result.current.twoFactorEnabled).toBe(true);
    });
  });

  // FIX 7.1: a successful reset wipes local session tokens and drops setup back
  // to local_ready, so this device is signed out. The controller must surface an
  // explicit signed-out flag; otherwise the next security action silently fails
  // with not_connected.
  describe("handleSubmitResetPassword (FIX 7.1 signed-out state)", () => {
    function localReadyPreferences(): SyncPreferencesRecord {
      return { ...managedPreferences(), setupStatus: "local_ready" };
    }

    it("exposes forgotSignedOut after a successful reset", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "resetSyncAccountPassword")
        .mockResolvedValue({
          ok: true,
          recoveryCode: "newcode0000newcode0000newcode00",
          preferences: localReadyPreferences(),
        });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      expect(result.current.forgotSignedOut).toBe(false);

      await act(async () => {
        await result.current.handleSubmitResetPassword();
      });

      expect(result.current.forgotSignedOut).toBe(true);
      expect(result.current.forgotStage).toBe("completed");
    });

    it("clears forgotSignedOut when the forgot flow is cancelled", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "resetSyncAccountPassword")
        .mockResolvedValue({
          ok: true,
          recoveryCode: "newcode0000newcode0000newcode00",
          preferences: localReadyPreferences(),
        });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleSubmitResetPassword();
      });
      expect(result.current.forgotSignedOut).toBe(true);

      act(() => {
        result.current.handleCancelForgot();
      });
      expect(result.current.forgotSignedOut).toBe(false);
    });

    it("does not flag signed-out when the reset fails", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "resetSyncAccountPassword")
        .mockResolvedValue({ ok: false, errorCode: "invalid_reset_token" });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(async () => {
        await result.current.handleSubmitResetPassword();
      });

      expect(result.current.forgotSignedOut).toBe(false);
      expect(result.current.forgotErrorCode).toBe("invalid_reset_token");
    });
  });

  // FIX 7.2: a rate_limited result surfaces the distinct error code (the screen
  // maps it to the wait message and disables submit). Confirm the controller
  // exposes the code rather than swallowing it into a generic error.
  describe("rate_limited results (FIX 7.2)", () => {
    it("surfaces rate_limited from a change-password attempt", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "changeSyncAccountPassword")
        .mockResolvedValue({ ok: false, errorCode: "rate_limited" });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(async () => {
        await result.current.handleChangePassword();
      });

      expect(result.current.changeErrorCode).toBe("rate_limited");
      expect(result.current.changeStatus).toBe("idle");
    });

    it("surfaces rate_limited from a reset request attempt", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "requestSyncPasswordReset")
        .mockResolvedValue({ ok: false, errorCode: "rate_limited" });

      const { result } = renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(async () => {
        await result.current.handleRequestReset();
      });

      expect(result.current.forgotErrorCode).toBe("rate_limited");
    });
  });
});
