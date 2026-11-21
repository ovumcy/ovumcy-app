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

function selfHostedPreferences(): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    mode: "self_hosted",
    endpointInput: "192.168.1.20:8080",
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
        .mockResolvedValue({ ok: true, recoveryCode: null });

      const { result } = await renderHook(() =>
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
        .mockResolvedValue({ ok: true, recoveryCode: null });

      const { result } = await renderHook(() =>
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

      const { result } = await renderHook(() =>
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

      const { result } = await renderHook(() =>
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

      const { result } = await renderHook(() =>
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

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleSubmitResetPassword();
      });
      expect(result.current.forgotSignedOut).toBe(true);

      await act(() => {
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

      const { result } = await renderHook(() =>
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

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(async () => {
        await result.current.handleChangePassword();
      });

      expect(result.current.changeErrorCode).toBe("rate_limited");
      expect(result.current.changeStatus).toBe("idle");

      await act(async () => {
        result.current.setChangeNewPassword("another-password");
      });
      expect(result.current.changeErrorCode).toBeNull();
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

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(async () => {
        await result.current.handleRequestReset();
      });

      expect(result.current.forgotErrorCode).toBe("rate_limited");

      await act(async () => {
        result.current.setForgotLogin("someone@example.com");
      });
      expect(result.current.forgotErrorCode).toBeNull();
    });

    it("lifts rate_limited on the next edit of the regenerate form only", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      const regenerate = jest
        .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
        .mockResolvedValue({ ok: false, errorCode: "rate_limited" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleRegenerate();
      });
      expect(result.current.regenerateErrorCode).toBe("rate_limited");

      await act(async () => {
        result.current.setRegeneratePassword("new-password");
      });
      expect(result.current.regeneratePassword).toBe("new-password");
      expect(result.current.regenerateErrorCode).toBeNull();

      regenerate.mockResolvedValue({ ok: false, errorCode: "invalid_current_password" });
      await act(async () => {
        await result.current.handleRegenerate();
      });
      expect(result.current.regenerateErrorCode).toBe("invalid_current_password");
      await act(async () => {
        result.current.setRegeneratePassword("other-password");
      });
      expect(result.current.regenerateErrorCode).toBe("invalid_current_password");
    });

    it("lifts rate_limited on the next edit of the TOTP disable form", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncTOTPService, "disableTOTP")
        .mockResolvedValue({ ok: false, errorCode: "rate_limited" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleDisableTOTP();
      });
      expect(result.current.totpErrorCode).toBe("rate_limited");

      await act(async () => {
        result.current.setTotpDisableCode("123456");
      });
      expect(result.current.totpDisableCode).toBe("123456");
      expect(result.current.totpErrorCode).toBeNull();
    });
  });

  describe("regenerate with no readable answer", () => {
    it.each(["network_failed", "generic"] as const)(
      "warns that the previous code may be replaced after %s",
      async (errorCode) => {
        const storage = createLocalAppStorageMock({
          readSyncPreferencesRecord: jest.fn().mockResolvedValue(selfHostedPreferences()),
        });
        const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
        jest
          .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
          .mockResolvedValue(null);
        jest
          .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
          .mockResolvedValue({ ok: false, errorCode });

        const { result } = await renderHook(() =>
          useSyncAccountSecurityController({ storage, syncSecretStore }),
        );
        await act(async () => {});
        await act(async () => {
          await result.current.handleRegenerate();
        });

        expect(result.current.regenerateErrorCode).toBe("regenerate_response_lost");
        expect(result.current.regenerateStatus).toBe("idle");
        expect(result.current.revealedRecoveryCode).toBe("");
      },
    );

    it("keeps a refusal the server answered as its own error", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
        .mockResolvedValue({ ok: false, errorCode: "invalid_current_password" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleRegenerate();
      });

      expect(result.current.regenerateErrorCode).toBe("invalid_current_password");
    });
  });

  // Sensitive-surface invariant: none of the mutating flows may reach a
  // service call before the account record is loaded. `preferences` starts
  // `null` and only becomes non-null in the same synchronous block that
  // flips `isLoading` false, so calling a handler before the mount effect's
  // storage read resolves must fail closed (no-op) rather than dispatch
  // against an undefined account.
  describe("fail-closed before the account has loaded", () => {
    it("no-ops every mutating handler while preferences is still null", async () => {
      let resolveRead!: (value: SyncPreferencesRecord) => void;
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockReturnValue(
          new Promise<SyncPreferencesRecord>((resolve) => {
            resolveRead = resolve;
          }),
        ),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      const changePasswordSpy = jest.spyOn(
        syncAccountRecoveryService,
        "changeSyncAccountPassword",
      );
      const requestResetSpy = jest.spyOn(
        syncAccountRecoveryService,
        "requestSyncPasswordReset",
      );
      const submitResetSpy = jest.spyOn(
        syncAccountRecoveryService,
        "resetSyncAccountPassword",
      );
      const regenerateSpy = jest.spyOn(
        syncAccountRecoveryService,
        "regenerateSyncAccountRecoveryCode",
      );
      const startEnrollSpy = jest.spyOn(syncTOTPService, "startTOTPEnrollment");
      const verifySpy = jest.spyOn(syncTOTPService, "verifyTOTPEnrollment");
      const disableSpy = jest.spyOn(syncTOTPService, "disableTOTP");

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );

      // Fired synchronously, back-to-back, with no `await` between them so
      // the mount effect's pending storage read has no chance to resolve
      // and populate `preferences` before every guard has been exercised.
      void result.current.handleChangePassword();
      void result.current.handleRequestReset();
      void result.current.handleSubmitResetPassword();
      void result.current.handleRegenerate();
      void result.current.handleStartTOTPEnrollment();
      void result.current.handleVerifyTOTPEnrollment();
      void result.current.handleDisableTOTP();

      expect(changePasswordSpy).not.toHaveBeenCalled();
      expect(requestResetSpy).not.toHaveBeenCalled();
      expect(submitResetSpy).not.toHaveBeenCalled();
      expect(regenerateSpy).not.toHaveBeenCalled();
      expect(startEnrollSpy).not.toHaveBeenCalled();
      expect(verifySpy).not.toHaveBeenCalled();
      expect(disableSpy).not.toHaveBeenCalled();

      // Let the mount effect settle so it doesn't leak an unawaited update
      // into the next test.
      resolveRead(managedPreferences());
      await act(async () => {});
    });
  });

  describe("unmount while the account is still loading", () => {
    it("does not act on the storage read once the component has unmounted", async () => {
      let resolveRead: (value: SyncPreferencesRecord) => void = () => {};
      const readPromise = new Promise<SyncPreferencesRecord>((resolve) => {
        resolveRead = resolve;
      });
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockReturnValue(readPromise),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      const describeSpy = jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);

      const { result, unmount } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      expect(result.current.isLoading).toBe(true);

      await unmount();

      await act(async () => {
        resolveRead(managedPreferences());
        await readPromise;
        // flush the microtask the effect's continuation resumes on
        await Promise.resolve();
      });

      // The mount effect's cleanup flag must stop it from continuing past
      // the cancelled-guard: it never reaches the `describeSyncAccountTwoFactor`
      // re-derive call that only fires once `loaded` is handled.
      expect(describeSpy).not.toHaveBeenCalled();
    });
  });

  describe("handleChangePassword (success)", () => {
    it("clears the password fields and marks success after a successful change", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "changeSyncAccountPassword")
        .mockResolvedValue({ ok: true, recoveryCode: null });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(() => {
        result.current.setChangeCurrentPassword("old-password-123");
        result.current.setChangeNewPassword("new-password-456");
      });

      await act(async () => {
        await result.current.handleChangePassword();
      });

      expect(result.current.changeStatus).toBe("success");
      expect(result.current.changeCurrentPassword).toBe("");
      expect(result.current.changeNewPassword).toBe("");
      expect(result.current.changeErrorCode).toBeNull();
      expect(result.current.revealedRecoveryCode).toBe("");
    });

    it("reveals once the recovery code a self-hosted password change rotated", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(selfHostedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: false });
      jest
        .spyOn(syncAccountRecoveryService, "changeSyncAccountPassword")
        .mockResolvedValue({ ok: true, recoveryCode: "NEW-CODE-1" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(() => {
        result.current.setChangeCurrentPassword("old-password-123");
        result.current.setChangeNewPassword("new-password-456");
      });
      await act(async () => {
        await result.current.handleChangePassword();
      });

      expect(result.current.revealedRecoveryCode).toBe("NEW-CODE-1");
      expect(result.current.revealedRecoveryCodeFromPasswordChange).toBe(true);
      expect(result.current.revealedRecoveryCodeFromTOTP).toBe(false);

      await act(() => {
        result.current.handleAcknowledgeRecoveryCode();
      });
      expect(result.current.revealedRecoveryCode).toBe("");
      expect(result.current.revealedRecoveryCodeFromPasswordChange).toBe(false);
    });
  });

  describe("handleChangePassword (two-factor code)", () => {
    async function renderSelfHosted(twoFactorEnabled: boolean | null) {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(selfHostedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(
          twoFactorEnabled === null ? null : { twoFactorEnabled },
        );
      const rendered = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(() => {
        rendered.result.current.setChangeCurrentPassword("old-password-123");
        rendered.result.current.setChangeNewPassword("new-password-456");
      });
      return rendered;
    }

    it("shows the code field for an enrolled self-hosted account and sends the code", async () => {
      const changeSpy = jest
        .spyOn(syncAccountRecoveryService, "changeSyncAccountPassword")
        .mockResolvedValue({ ok: true, recoveryCode: "NEW-CODE-1" });
      const { result } = await renderSelfHosted(true);

      expect(result.current.changeCodeVisible).toBe(true);
      await act(() => {
        result.current.setChangeCode("123456");
      });
      await act(async () => {
        await result.current.handleChangePassword();
      });

      expect(changeSpy.mock.calls[0]?.[2]).toEqual({
        currentPassword: "old-password-123",
        newPassword: "new-password-456",
        code: "123456",
      });
      expect(result.current.changeCode).toBe("");
    });

    it("never shows the code field on a managed account", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: true });
      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      expect(result.current.changeCodeVisible).toBe(false);
    });

    it("asks for a code, not a wrong one, when the server demands it unasked", async () => {
      jest
        .spyOn(syncAccountRecoveryService, "changeSyncAccountPassword")
        .mockResolvedValue({ ok: false, errorCode: "totp_invalid_code" });
      const { result } = await renderSelfHosted(null);

      expect(result.current.changeCodeVisible).toBe(false);
      await act(async () => {
        await result.current.handleChangePassword();
      });

      expect(result.current.changeErrorCode).toBe("totp_code_required");
      expect(result.current.changeCodeVisible).toBe(true);
    });

    it("keeps a replayed-code answer as is once the code was sent, and clears the spent code", async () => {
      jest
        .spyOn(syncAccountRecoveryService, "changeSyncAccountPassword")
        .mockResolvedValue({ ok: false, errorCode: "totp_replayed" });
      const { result } = await renderSelfHosted(true);

      await act(() => {
        result.current.setChangeCode("123456");
      });
      await act(async () => {
        await result.current.handleChangePassword();
      });

      expect(result.current.changeErrorCode).toBe("totp_replayed");
      expect(result.current.changeCode).toBe("");
    });

    it.each(["network_failed", "generic"] as const)(
      "reports a self-hosted %s answer as a possibly applied change",
      async (errorCode) => {
        jest
          .spyOn(syncAccountRecoveryService, "changeSyncAccountPassword")
          .mockResolvedValue({ ok: false, errorCode });
        const { result } = await renderSelfHosted(false);

        await act(async () => {
          await result.current.handleChangePassword();
        });

        expect(result.current.changeErrorCode).toBe("change_password_response_lost");
      },
    );
  });

  describe("handleRequestReset (success)", () => {
    it("stages the new-password stage and carries the returned token into handleSubmitResetPassword", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "requestSyncPasswordReset")
        .mockResolvedValue({
          ok: true,
          resetToken: "reset-tok-1",
          resetTokenExpiresAt: "2026-07-20T00:00:00.000Z",
        });
      const submitResetSpy = jest
        .spyOn(syncAccountRecoveryService, "resetSyncAccountPassword")
        .mockResolvedValue({
          ok: true,
          recoveryCode: "newcode0000newcode0000newcode00",
          preferences: managedPreferences(),
        });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(() => {
        result.current.setForgotLogin("owner@example.com");
        result.current.setForgotRecoveryCode("recoverycode0000000000000000000");
      });

      await act(async () => {
        await result.current.handleRequestReset();
      });

      expect(result.current.forgotStage).toBe("new_password");
      expect(result.current.forgotStatus).toBe("idle");
      expect(result.current.forgotResetTokenExpiresAt).toBe(
        "2026-07-20T00:00:00.000Z",
      );
      expect(result.current.forgotRecoveryCode).toBe("");
      expect(result.current.forgotErrorCode).toBeNull();

      // The raw reset token never leaves the hook's internal state (it is
      // not part of the returned API); prove it was still captured by
      // checking it reaches the subsequent submit call.
      await act(() => {
        result.current.setForgotNewPassword("brand-new-password-123");
      });
      await act(async () => {
        await result.current.handleSubmitResetPassword();
      });

      expect(submitResetSpy).toHaveBeenCalledWith(
        storage,
        syncSecretStore,
        managedPreferences(),
        { resetToken: "reset-tok-1", newPassword: "brand-new-password-123" },
      );
    });
  });

  describe("handleRegenerate", () => {
    it("reveals the new recovery code and clears the password on success", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
        .mockResolvedValue({
          ok: true,
          recoveryCode: "freshcode000freshcode000freshcod",
        });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(() => {
        result.current.setRegeneratePassword("hunter2-hunter2");
      });

      await act(async () => {
        await result.current.handleRegenerate();
      });

      expect(result.current.revealedRecoveryCode).toBe(
        "freshcode000freshcode000freshcod",
      );
      expect(result.current.regenerateStatus).toBe("success");
      expect(result.current.regeneratePassword).toBe("");
      expect(result.current.regenerateErrorCode).toBeNull();
    });

    it("surfaces the error code and stays idle on failure", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
        .mockResolvedValue({ ok: false, errorCode: "invalid_current_password" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(async () => {
        await result.current.handleRegenerate();
      });

      expect(result.current.regenerateErrorCode).toBe("invalid_current_password");
      expect(result.current.regenerateStatus).toBe("idle");
      expect(result.current.revealedRecoveryCode).toBe("");
    });

    async function renderRegenerate(
      preferences: SyncPreferencesRecord,
      twoFactorEnabled: boolean | null,
    ) {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(preferences),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(
          twoFactorEnabled === null ? null : { twoFactorEnabled },
        );
      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(() => {
        result.current.setRegeneratePassword("hunter2-hunter2");
        result.current.setRegenerateCode("123456");
      });
      return result;
    }

    it.each([
      ["community", selfHostedPreferences()],
      ["managed", managedPreferences()],
    ] as const)("sends the TOTP code and clears it on success when %s 2FA is on", async (_label, preferences) => {
      const regenerate = jest
        .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
        .mockResolvedValue({
          ok: true,
          recoveryCode: "freshcode000freshcode000freshcod",
        });
      const result = await renderRegenerate(preferences, true);

      expect(result.current.regenerateCodeVisible).toBe(true);
      await act(async () => {
        await result.current.handleRegenerate();
      });

      expect(regenerate).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { currentPassword: "hunter2-hunter2", code: "123456" },
      );
      expect(result.current.regenerateCode).toBe("");
    });

    it.each([
      ["community 2FA is off", selfHostedPreferences(), false],
      ["community 2FA status is unknown", selfHostedPreferences(), null],
      ["managed 2FA is off", managedPreferences(), false],
      ["managed 2FA status is unknown", managedPreferences(), null],
    ] as const)(
      "sends no TOTP code when %s",
      async (_label, preferences, twoFactorEnabled) => {
        const regenerate = jest
          .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
          .mockResolvedValue({ ok: false, errorCode: "network_failed" });
        const result = await renderRegenerate(preferences, twoFactorEnabled);

        expect(result.current.regenerateCodeVisible).toBe(false);
        await act(async () => {
          await result.current.handleRegenerate();
        });

        expect(regenerate).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          { currentPassword: "hunter2-hunter2" },
        );
        expect(result.current.regenerateCodeVisible).toBe(false);
      },
    );

    it.each([
      ["totp_invalid_code", "totp_code_required"],
      ["totp_replayed", "totp_replayed"],
    ] as const)(
      "reveals the code field after the server answers %s",
      async (errorCode, shownErrorCode) => {
        const regenerate = jest
          .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
          .mockResolvedValueOnce({ ok: false, errorCode })
          .mockResolvedValueOnce({ ok: false, errorCode: "network_failed" });
        const result = await renderRegenerate(selfHostedPreferences(), null);

        await act(async () => {
          await result.current.handleRegenerate();
        });
        expect(result.current.regenerateErrorCode).toBe(shownErrorCode);
        expect(result.current.regenerateCodeVisible).toBe(true);

        await act(async () => {
          await result.current.handleRegenerate();
        });
        expect(regenerate).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.anything(),
          { currentPassword: "hunter2-hunter2", code: "123456" },
        );
      },
    );

    it("keeps the server's verdict on a code that was actually sent", async () => {
      jest
        .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
        .mockResolvedValue({ ok: false, errorCode: "totp_invalid_code" });
      const result = await renderRegenerate(selfHostedPreferences(), true);

      await act(async () => {
        await result.current.handleRegenerate();
      });
      expect(result.current.regenerateErrorCode).toBe("totp_invalid_code");
    });

    it("hides the demanded code field again once two-factor is disabled", async () => {
      jest
        .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
        .mockResolvedValue({ ok: false, errorCode: "totp_invalid_code" });
      jest.spyOn(syncTOTPService, "disableTOTP").mockResolvedValue({ ok: true });
      const result = await renderRegenerate(selfHostedPreferences(), null);

      await act(async () => {
        await result.current.handleRegenerate();
      });
      expect(result.current.regenerateCodeVisible).toBe(true);

      await act(async () => {
        await result.current.handleDisableTOTP();
      });
      expect(result.current.regenerateCodeVisible).toBe(false);
    });

    it.each([
      ["community", selfHostedPreferences()],
      ["managed", managedPreferences()],
    ] as const)("never logs or persists the TOTP code sent with a %s regeneration", async (_label, preferences) => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(preferences),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: true });
      jest
        .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
        .mockResolvedValue({ ok: false, errorCode: "totp_replayed" });
      const consoleSpies = (
        ["log", "warn", "error", "info", "debug"] as const
      ).map((method) =>
        jest.spyOn(console, method).mockImplementation(() => {}),
      );

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(() => {
        result.current.setRegeneratePassword("hunter2-hunter2");
        result.current.setRegenerateCode("482913");
      });
      await act(async () => {
        await result.current.handleRegenerate();
      });

      const sinks = [
        ...consoleSpies,
        ...Object.values(storage).filter(jest.isMockFunction),
        ...Object.values(syncSecretStore).filter(jest.isMockFunction),
      ];
      for (const sink of sinks) {
        expect(JSON.stringify(sink.mock.calls)).not.toContain("482913");
      }
    });
  });

  describe("handleTOTPModeChange", () => {
    it("resets in-flight TOTP enrollment and disable-form state when switching modes", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest.spyOn(syncTOTPService, "startTOTPEnrollment").mockResolvedValue({
        ok: true,
        enrollment: {
          secretBase32: "JBSWY3DPEHPK3PXP",
          provisioningURI:
            "otpauth://totp/Ovumcy:owner@example.com?secret=JBSWY3DPEHPK3PXP",
        },
      });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(() => {
        result.current.setTotpEnrollPassword("hunter2-hunter2");
      });
      await act(async () => {
        await result.current.handleStartTOTPEnrollment();
      });
      expect(result.current.totpStage).toBe("enrolling");
      expect(result.current.totpEnrollment).not.toBeNull();

      await act(() => {
        result.current.setTotpVerifyCode("000000");
        result.current.setTotpDisablePassword("hunter2-hunter2");
        result.current.setTotpDisableCode("111111");
      });

      await act(() => {
        result.current.handleTOTPModeChange("disable");
      });

      expect(result.current.totpMode).toBe("disable");
      expect(result.current.totpStage).toBe("idle");
      expect(result.current.totpEnrollment).toBeNull();
      expect(result.current.totpEnrollPassword).toBe("");
      expect(result.current.totpVerifyCode).toBe("");
      expect(result.current.totpDisablePassword).toBe("");
      expect(result.current.totpDisableCode).toBe("");
      expect(result.current.totpErrorCode).toBeNull();
      expect(result.current.totpStatus).toBe("idle");
    });
  });

  describe("handleStartTOTPEnrollment", () => {
    it("stores the enrollment payload and moves to the enrolling stage on success", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest.spyOn(syncTOTPService, "startTOTPEnrollment").mockResolvedValue({
        ok: true,
        enrollment: {
          secretBase32: "JBSWY3DPEHPK3PXP",
          provisioningURI:
            "otpauth://totp/Ovumcy:owner@example.com?secret=JBSWY3DPEHPK3PXP",
        },
      });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(() => {
        result.current.setTotpEnrollPassword("hunter2-hunter2");
      });

      await act(async () => {
        await result.current.handleStartTOTPEnrollment();
      });

      expect(result.current.totpStage).toBe("enrolling");
      expect(result.current.totpEnrollment).toEqual({
        secretBase32: "JBSWY3DPEHPK3PXP",
        provisioningURI:
          "otpauth://totp/Ovumcy:owner@example.com?secret=JBSWY3DPEHPK3PXP",
      });
      expect(result.current.totpEnrollPassword).toBe("");
      expect(result.current.totpStatus).toBe("idle");
      expect(result.current.totpErrorCode).toBeNull();
    });

    it("surfaces the error and stays on the idle stage on failure", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncTOTPService, "startTOTPEnrollment")
        .mockResolvedValue({ ok: false, errorCode: "invalid_current_password" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(async () => {
        await result.current.handleStartTOTPEnrollment();
      });

      expect(result.current.totpErrorCode).toBe("invalid_current_password");
      expect(result.current.totpStatus).toBe("idle");
      expect(result.current.totpStage).toBe("idle");
      expect(result.current.totpEnrollment).toBeNull();
    });
  });

  describe("handleVerifyTOTPEnrollment (failure)", () => {
    it("surfaces the error code and leaves the live 2FA status untouched", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: false });
      jest
        .spyOn(syncTOTPService, "verifyTOTPEnrollment")
        .mockResolvedValue({ ok: false, errorCode: "totp_invalid_code" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      expect(result.current.twoFactorEnabled).toBe(false);

      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      expect(result.current.totpErrorCode).toBe("totp_invalid_code");
      expect(result.current.totpStatus).toBe("idle");
      expect(result.current.totpStage).not.toBe("completed");
      // A failed verify must not re-derive (or otherwise disturb) the live
      // 2FA status -- only the mount-time describe call should have fired.
      expect(
        syncAccountSessionService.describeSyncAccountTwoFactor,
      ).toHaveBeenCalledTimes(1);
      expect(result.current.twoFactorEnabled).toBe(false);
    });

    it("drops the pending enrollment and returns to the password step when a restart is required", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: false });
      jest.spyOn(syncTOTPService, "startTOTPEnrollment").mockResolvedValue({
        ok: true,
        enrollment: {
          secretBase32: "JBSWY3DPEHPK3PXP",
          provisioningURI: "otpauth://totp/Ovumcy:owner?secret=JBSWY3DPEHPK3PXP",
        },
      });
      jest.spyOn(syncTOTPService, "verifyTOTPEnrollment").mockResolvedValue({
        ok: false,
        errorCode: "totp_enrollment_restart_required",
      });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(() => {
        result.current.setTotpEnrollPassword("hunter2-hunter2");
      });
      await act(async () => {
        await result.current.handleStartTOTPEnrollment();
      });
      await act(() => {
        result.current.setTotpVerifyCode("123456");
      });
      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      expect(result.current.totpErrorCode).toBe(
        "totp_enrollment_restart_required",
      );
      expect(result.current.totpStage).toBe("idle");
      expect(result.current.totpEnrollment).toBeNull();
      expect(result.current.totpVerifyCode).toBe("");
      expect(result.current.totpStatus).toBe("idle");
    });
  });

  describe("handleVerifyTOTPEnrollment (recovery code rotation)", () => {
    it("reveals the rotated recovery code once and clears it on acknowledge", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: true });
      jest.spyOn(syncTOTPService, "verifyTOTPEnrollment").mockResolvedValue({
        ok: true,
        recoveryCode: "3f9c2a7e1b6d48c0a5e9f3b27d1c6e84",
      });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      expect(result.current.revealedRecoveryCodeFromTOTP).toBe(false);

      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      expect(result.current.totpStage).toBe("completed");
      expect(result.current.revealedRecoveryCode).toBe(
        "3f9c2a7e1b6d48c0a5e9f3b27d1c6e84",
      );
      expect(result.current.revealedRecoveryCodeFromTOTP).toBe(true);

      await act(() => {
        result.current.handleAcknowledgeRecoveryCode();
      });

      expect(result.current.revealedRecoveryCode).toBe("");
      expect(result.current.revealedRecoveryCodeFromTOTP).toBe(false);
    });

    it("opens no reveal when the backend issued no recovery code", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: true });
      jest
        .spyOn(syncTOTPService, "verifyTOTPEnrollment")
        .mockResolvedValue({ ok: true, recoveryCode: null });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      expect(result.current.totpStage).toBe("completed");
      expect(result.current.revealedRecoveryCode).toBe("");
      expect(result.current.revealedRecoveryCodeFromTOTP).toBe(false);
    });

    it("never logs or persists the recovery code issued by TOTP enrollment", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest
          .fn()
          .mockResolvedValue(selfHostedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: true });
      jest.spyOn(syncTOTPService, "verifyTOTPEnrollment").mockResolvedValue({
        ok: true,
        recoveryCode: "supersecretrecoverycode111111111",
      });
      const consoleSpies = [
        jest.spyOn(console, "log").mockImplementation(() => {}),
        jest.spyOn(console, "warn").mockImplementation(() => {}),
        jest.spyOn(console, "error").mockImplementation(() => {}),
        jest.spyOn(console, "info").mockImplementation(() => {}),
        jest.spyOn(console, "debug").mockImplementation(() => {}),
      ];

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });
      expect(result.current.revealedRecoveryCode).toBe(
        "supersecretrecoverycode111111111",
      );
      await act(() => {
        result.current.handleAcknowledgeRecoveryCode();
      });

      for (const spy of consoleSpies) {
        expect(spy).not.toHaveBeenCalled();
      }
      for (const fn of [
        ...Object.values(storage),
        ...Object.values(syncSecretStore),
      ]) {
        if (jest.isMockFunction(fn)) {
          expect(JSON.stringify(fn.mock.calls)).not.toContain(
            "supersecretrecoverycode111111111",
          );
        }
      }
    });
  });

  describe("handleVerifyTOTPEnrollment (lost response)", () => {
    it("tells a community user the rotated code was lost when 2FA turned out to be on", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest
          .fn()
          .mockResolvedValue(selfHostedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValueOnce({ twoFactorEnabled: false })
        .mockResolvedValueOnce({ twoFactorEnabled: true });
      jest
        .spyOn(syncTOTPService, "verifyTOTPEnrollment")
        .mockResolvedValue({ ok: false, errorCode: "network_failed" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      expect(result.current.totpErrorCode).toBe("totp_recovery_code_lost");
      expect(result.current.twoFactorEnabled).toBe(true);
      expect(result.current.totpStage).toBe("idle");
      expect(result.current.totpEnrollment).toBeNull();
      expect(result.current.revealedRecoveryCode).toBe("");
    });

    it("keeps the original error when 2FA is still off after a lost response", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest
          .fn()
          .mockResolvedValue(selfHostedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: false });
      jest
        .spyOn(syncTOTPService, "verifyTOTPEnrollment")
        .mockResolvedValue({ ok: false, errorCode: "totp_already_enabled" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      expect(result.current.totpErrorCode).toBe("totp_already_enabled");
      expect(result.current.twoFactorEnabled).toBe(false);
      expect(
        syncAccountSessionService.describeSyncAccountTwoFactor,
      ).toHaveBeenCalledTimes(2);
    });

    it("does not re-check 2FA for a community code rejection", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest
          .fn()
          .mockResolvedValue(selfHostedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: false });
      jest
        .spyOn(syncTOTPService, "verifyTOTPEnrollment")
        .mockResolvedValue({ ok: false, errorCode: "totp_invalid_code" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleVerifyTOTPEnrollment();
      });

      expect(result.current.totpErrorCode).toBe("totp_invalid_code");
      expect(
        syncAccountSessionService.describeSyncAccountTwoFactor,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleDisableTOTP (failure)", () => {
    it("surfaces the error code and leaves the live 2FA status untouched", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue({ twoFactorEnabled: true });
      jest
        .spyOn(syncTOTPService, "disableTOTP")
        .mockResolvedValue({ ok: false, errorCode: "totp_invalid_code" });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      expect(result.current.twoFactorEnabled).toBe(true);

      await act(async () => {
        await result.current.handleDisableTOTP();
      });

      expect(result.current.totpErrorCode).toBe("totp_invalid_code");
      expect(result.current.totpStatus).toBe("idle");
      expect(result.current.totpStage).not.toBe("completed");
      expect(
        syncAccountSessionService.describeSyncAccountTwoFactor,
      ).toHaveBeenCalledTimes(1);
      expect(result.current.twoFactorEnabled).toBe(true);
    });

    it.each([
      ["reads off", { twoFactorEnabled: false }],
      ["cannot be read", null],
    ] as const)(
      "shows 2FA off when the server says it is already off and the refreshed status %s",
      async (_label, refreshedStatus) => {
        const storage = createLocalAppStorageMock({
          readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
        });
        const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
        jest
          .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
          .mockResolvedValueOnce({ twoFactorEnabled: true })
          .mockResolvedValueOnce(refreshedStatus);
        jest
          .spyOn(syncTOTPService, "disableTOTP")
          .mockResolvedValue({ ok: false, errorCode: "totp_already_disabled" });

        const { result } = await renderHook(() =>
          useSyncAccountSecurityController({ storage, syncSecretStore }),
        );
        await act(async () => {});
        await act(() => {
          result.current.handleTOTPModeChange("disable");
          result.current.setTotpDisablePassword("hunter2-hunter2");
          result.current.setTotpDisableCode("123456");
        });

        await act(async () => {
          await result.current.handleDisableTOTP();
        });

        expect(result.current.totpErrorCode).toBe("totp_already_disabled");
        expect(result.current.twoFactorEnabled).toBe(false);
        expect(result.current.totpMode).toBe("enable");
        expect(result.current.totpDisablePassword).toBe("");
        expect(result.current.totpDisableCode).toBe("");
        expect(result.current.totpStatus).toBe("idle");
      },
    );
  });

  describe("handleCancelTOTPEnrollment", () => {
    it("clears the in-progress enrollment and returns to the idle stage", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest.spyOn(syncTOTPService, "startTOTPEnrollment").mockResolvedValue({
        ok: true,
        enrollment: {
          secretBase32: "JBSWY3DPEHPK3PXP",
          provisioningURI:
            "otpauth://totp/Ovumcy:owner@example.com?secret=JBSWY3DPEHPK3PXP",
        },
      });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(async () => {
        await result.current.handleStartTOTPEnrollment();
      });
      await act(() => {
        result.current.setTotpVerifyCode("123456");
      });
      expect(result.current.totpStage).toBe("enrolling");

      await act(() => {
        result.current.handleCancelTOTPEnrollment();
      });

      expect(result.current.totpStage).toBe("idle");
      expect(result.current.totpEnrollment).toBeNull();
      expect(result.current.totpVerifyCode).toBe("");
      expect(result.current.totpErrorCode).toBeNull();
      expect(result.current.totpStatus).toBe("idle");
    });
  });

  describe("handleAcknowledgeRecoveryCode", () => {
    it("clears the revealed code and resets a completed regenerate status back to idle", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest
        .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
        .mockResolvedValue({
          ok: true,
          recoveryCode: "freshcode000freshcode000freshcod",
        });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleRegenerate();
      });
      expect(result.current.revealedRecoveryCode).not.toBe("");
      expect(result.current.regenerateStatus).toBe("success");

      await act(() => {
        result.current.handleAcknowledgeRecoveryCode();
      });

      expect(result.current.revealedRecoveryCode).toBe("");
      expect(result.current.regenerateStatus).toBe("idle");
    });

    // The reveal modal is shared between the reset-password and regenerate
    // flows (see the doc comment above `revealedRecoveryCode`). Acknowledging
    // a reset-issued code must not reach into the unrelated regenerate
    // flow's status.
    it("clears the revealed code without touching an unrelated regenerate status", async () => {
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
          recoveryCode: "resetcode000resetcode000resetcod",
          preferences: managedPreferences(),
        });

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});
      await act(async () => {
        await result.current.handleSubmitResetPassword();
      });
      expect(result.current.revealedRecoveryCode).toBe(
        "resetcode000resetcode000resetcod",
      );
      expect(result.current.regenerateStatus).toBe("idle");

      await act(() => {
        result.current.handleAcknowledgeRecoveryCode();
      });

      expect(result.current.revealedRecoveryCode).toBe("");
      expect(result.current.regenerateStatus).toBe("idle");
    });
  });

  // Security constitution: TOTP secrets and recovery codes must never reach
  // a debug log, and must only ever be surfaced through the intended
  // one-time reveal (the hook's returned `totpEnrollment` /
  // `revealedRecoveryCode` state) -- never printed as a side effect.
  describe("sensitive-surface invariants", () => {
    it("never logs the TOTP secret or the recovery code while enrolling or regenerating", async () => {
      const storage = createLocalAppStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(managedPreferences()),
      });
      const syncSecretStore = createSyncSecretStoreMock(connectedSecrets());
      jest
        .spyOn(syncAccountSessionService, "describeSyncAccountTwoFactor")
        .mockResolvedValue(null);
      jest.spyOn(syncTOTPService, "startTOTPEnrollment").mockResolvedValue({
        ok: true,
        enrollment: {
          secretBase32: "JBSWY3DPEHPK3PXP",
          provisioningURI:
            "otpauth://totp/Ovumcy:owner@example.com?secret=JBSWY3DPEHPK3PXP",
        },
      });
      jest
        .spyOn(syncAccountRecoveryService, "regenerateSyncAccountRecoveryCode")
        .mockResolvedValue({
          ok: true,
          recoveryCode: "supersecretrecoverycode000000000",
        });

      const consoleSpies = [
        jest.spyOn(console, "log").mockImplementation(() => {}),
        jest.spyOn(console, "warn").mockImplementation(() => {}),
        jest.spyOn(console, "error").mockImplementation(() => {}),
        jest.spyOn(console, "info").mockImplementation(() => {}),
        jest.spyOn(console, "debug").mockImplementation(() => {}),
      ];

      const { result } = await renderHook(() =>
        useSyncAccountSecurityController({ storage, syncSecretStore }),
      );
      await act(async () => {});

      await act(() => {
        result.current.setTotpEnrollPassword("hunter2-hunter2");
      });
      await act(async () => {
        await result.current.handleStartTOTPEnrollment();
      });
      expect(result.current.totpEnrollment?.secretBase32).toBe(
        "JBSWY3DPEHPK3PXP",
      );

      await act(() => {
        result.current.setRegeneratePassword("hunter2-hunter2");
      });
      await act(async () => {
        await result.current.handleRegenerate();
      });
      expect(result.current.revealedRecoveryCode).toBe(
        "supersecretrecoverycode000000000",
      );

      for (const spy of consoleSpies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });
  });
});
