import { act, renderHook } from "@testing-library/react-native";

import {
  clearManagedPartnerInviteToken,
  readManagedPartnerInviteToken,
} from "../../../security/managed-partner-invite-token-buffer";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import * as backupSyncScreenService from "../../../services/backup-sync-screen-service";
import {
  createBackupSyncSessionCoreMock,
  createLoadedSettingsStateFixture,
} from "../../../test/create-backup-sync-session-core-mock";
import { openConfirmation } from "../../confirm/open-confirmation";
import { describeSyncAccountTwoFactor } from "../../../sync/sync-account-session-service";
import { useBackupSyncActions } from "./useBackupSyncActions";

const mockDescribeTwoFactor = jest.mocked(describeSyncAccountTwoFactor);

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

jest.mock("../../../security/sensitive-action-auth", () => ({
  requestSensitiveActionChallenge: jest.fn(),
}));

jest.mock("../../../services/backup-sync-screen-service");

jest.mock("../../../sync/sync-account-session-service", () => ({
  describeSyncAccountTwoFactor: jest.fn(),
}));

const mockOpenConfirmation = jest.mocked(openConfirmation);
const mockRequestSensitiveActionChallenge = jest.mocked(
  requestSensitiveActionChallenge,
);
const mockUploadBackupSyncSnapshot = jest.mocked(
  backupSyncScreenService.uploadBackupSyncSnapshot,
);
const mockRestoreBackupSyncSnapshot = jest.mocked(
  backupSyncScreenService.restoreBackupSyncSnapshot,
);
const mockClearUnauthorizedBackupSyncSession = jest.mocked(
  backupSyncScreenService.clearUnauthorizedBackupSyncSession,
);

describe("useBackupSyncActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearManagedPartnerInviteToken();
  });

  describe("handleSyncNow", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleSyncNow();
      });

      expect(core.resetFeedbackMessages).not.toHaveBeenCalled();
      expect(core.saveSyncDraftIfNeeded).not.toHaveBeenCalled();
      expect(mockUploadBackupSyncSnapshot).not.toHaveBeenCalled();
      expect(result.current.isSyncingNow).toBe(false);
    });

    it("stops quietly without calling the service when the draft cannot be saved", async () => {
      const core = createBackupSyncSessionCoreMock({
        saveSyncDraftIfNeeded: jest.fn().mockResolvedValue(null),
      });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleSyncNow();
      });

      expect(core.resetFeedbackMessages).toHaveBeenCalledTimes(1);
      expect(core.saveSyncDraftIfNeeded).toHaveBeenCalledWith("sync");
      expect(mockUploadBackupSyncSnapshot).not.toHaveBeenCalled();
      expect(result.current.isSyncingNow).toBe(false);
    });

    it("wires the destructive overwrite guard to the shared confirm dialog with the expected copy", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockUploadBackupSyncSnapshot.mockImplementation(
        async (_storage, _secretStore, _state, _now, guard) => {
          await guard?.confirmUploadOverExistingBackup?.();
          return { ok: true, state: core.state! };
        },
      );
      mockOpenConfirmation.mockResolvedValue(true);
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleSyncNow();
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        core.viewData.account.uploadOverBackupPrompt,
        core.viewData.account.uploadOverBackupAccept,
        core.viewData.common.cancelAction,
      );
    });

    it("quietly stops when the owner declines the overwrite confirm", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockUploadBackupSyncSnapshot.mockResolvedValue({
        ok: false,
        errorCode: "upload_over_backup_declined",
      });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleSyncNow();
      });

      expect(core.setErrorState).not.toHaveBeenCalled();
      expect(core.setState).not.toHaveBeenCalled();
      expect(result.current.isSyncingNow).toBe(false);
    });

    it("tears down the session and clears the pending partner invite on an unauthorized upload", async () => {
      const clearedState = createLoadedSettingsStateFixture({
        hasSyncSession: false,
      });
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "pending-token",
      });
      mockUploadBackupSyncSnapshot.mockResolvedValue({
        ok: false,
        errorCode: "unauthorized",
      });
      mockClearUnauthorizedBackupSyncSession.mockResolvedValue(clearedState);
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleSyncNow();
      });

      expect(mockClearUnauthorizedBackupSyncSession).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state,
      );
      expect(readManagedPartnerInviteToken()).toBe("");
      expect(core.setPendingPartnerInviteToken).toHaveBeenCalledWith("");
      expect(core.setState).toHaveBeenCalledWith(clearedState);
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(clearedState);
      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "unauthorized",
        scope: "sync",
      });
      expect(result.current.isSyncingNow).toBe(false);
    });

    it("surfaces a non-unauthorized upload error without touching the session", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockUploadBackupSyncSnapshot.mockResolvedValue({
        ok: false,
        errorCode: "network_failed",
      });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleSyncNow();
      });

      expect(mockClearUnauthorizedBackupSyncSession).not.toHaveBeenCalled();
      expect(core.setState).not.toHaveBeenCalled();
      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "network_failed",
        scope: "sync",
      });
      expect(result.current.isSyncingNow).toBe(false);
    });

    it("marks the upload successful and refreshes partner access", async () => {
      const uploadedState = createLoadedSettingsStateFixture({
        savedSyncPreferences: {
          ...createLoadedSettingsStateFixture().savedSyncPreferences,
          lastSyncedAt: "2026-03-20T08:00:00.000Z",
        },
      });
      const core = createBackupSyncSessionCoreMock();
      mockUploadBackupSyncSnapshot.mockResolvedValue({
        ok: true,
        state: uploadedState,
      });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleSyncNow();
      });

      expect(core.setErrorState).toHaveBeenCalledWith(null);
      expect(core.setState).toHaveBeenCalledWith(uploadedState);
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(uploadedState);
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        core.viewData.account.status.uploaded,
      );
      expect(result.current.isSyncingNow).toBe(false);
    });
  });

  describe("handleRestoreSync", () => {
    beforeEach(() => {
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
    });

    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleRestoreSync();
      });

      expect(core.resetFeedbackMessages).not.toHaveBeenCalled();
      expect(mockRequestSensitiveActionChallenge).not.toHaveBeenCalled();
      expect(result.current.isRestoringSync).toBe(false);
    });

    it("surfaces deviceAuthUnavailable when the device-auth challenge is unavailable", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "unavailable",
      });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleRestoreSync();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "deviceAuthUnavailable",
        scope: "sync",
      });
      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockRestoreBackupSyncSnapshot).not.toHaveBeenCalled();
    });

    it("surfaces deviceAuthFailed when the device-auth challenge fails", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "failed",
      });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleRestoreSync();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "deviceAuthFailed",
        scope: "sync",
      });
      expect(mockRestoreBackupSyncSnapshot).not.toHaveBeenCalled();
    });

    it("stays silent when the device-auth challenge is cancelled by the owner", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "cancelled",
      });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleRestoreSync();
      });

      expect(core.setErrorState).not.toHaveBeenCalled();
      expect(mockRestoreBackupSyncSnapshot).not.toHaveBeenCalled();
      expect(result.current.isRestoringSync).toBe(false);
    });

    it("requests device auth with the expected prompt before confirming", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRestoreBackupSyncSnapshot.mockResolvedValue({
        ok: true,
        state: core.state!,
      });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleRestoreSync();
      });

      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledWith(
        core.viewData.account.restoreDeviceAuthPrompt,
      );
      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        core.viewData.account.restorePrompt,
        core.viewData.account.restoreAccept,
      );
    });

    it("does not call the restore service when the owner declines the confirm", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleRestoreSync();
      });

      expect(mockRestoreBackupSyncSnapshot).not.toHaveBeenCalled();
      expect(result.current.isRestoringSync).toBe(false);
    });

    it("tears down the session and clears the pending partner invite on an unauthorized restore", async () => {
      const clearedState = createLoadedSettingsStateFixture({
        hasSyncSession: false,
      });
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "pending-token",
      });
      mockRestoreBackupSyncSnapshot.mockResolvedValue({
        ok: false,
        errorCode: "unauthorized",
      });
      mockClearUnauthorizedBackupSyncSession.mockResolvedValue(clearedState);
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleRestoreSync();
      });

      expect(mockClearUnauthorizedBackupSyncSession).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state,
      );
      expect(readManagedPartnerInviteToken()).toBe("");
      expect(core.setPendingPartnerInviteToken).toHaveBeenCalledWith("");
      expect(core.setState).toHaveBeenCalledWith(clearedState);
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(clearedState);
      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "unauthorized",
        scope: "sync",
      });
      expect(result.current.isRestoringSync).toBe(false);
    });

    it("surfaces a non-unauthorized restore error without touching the session", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRestoreBackupSyncSnapshot.mockResolvedValue({
        ok: false,
        errorCode: "network_failed",
      });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleRestoreSync();
      });

      expect(mockClearUnauthorizedBackupSyncSession).not.toHaveBeenCalled();
      expect(core.setState).not.toHaveBeenCalled();
      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "network_failed",
        scope: "sync",
      });
      expect(result.current.isRestoringSync).toBe(false);
    });

    it("marks the restore successful and refreshes partner access", async () => {
      const restoredState = createLoadedSettingsStateFixture({
        savedSyncPreferences: {
          ...createLoadedSettingsStateFixture().savedSyncPreferences,
          lastSyncedAt: "2026-03-20T08:00:00.000Z",
        },
      });
      const core = createBackupSyncSessionCoreMock();
      mockRestoreBackupSyncSnapshot.mockResolvedValue({
        ok: true,
        state: restoredState,
      });
      const { result } = await renderHook(() => useBackupSyncActions(core));

      await act(async () => {
        await result.current.handleRestoreSync();
      });

      expect(core.setErrorState).toHaveBeenCalledWith(null);
      expect(core.setState).toHaveBeenCalledWith(restoredState);
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(restoredState);
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        core.viewData.account.status.restored,
      );
      expect(result.current.isRestoringSync).toBe(false);
    });
  });
});

describe("useBackupSyncActions recovery-key step-up", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearManagedPartnerInviteToken();
  });

  async function openPrompt(errorCode: string, twoFactorEnabled?: boolean) {
    const core = createBackupSyncSessionCoreMock();
    if (twoFactorEnabled !== undefined) {
      mockDescribeTwoFactor.mockResolvedValue({ twoFactorEnabled });
    }
    mockUploadBackupSyncSnapshot.mockResolvedValueOnce({
      ok: false,
      errorCode,
    } as never);
    const { result } = await renderHook(() => useBackupSyncActions(core));
    await act(async () => {
      await result.current.handleSyncNow();
    });
    return { core, result };
  }

  it.each([
    [true, true],
    [false, false],
  ])(
    "step_up_required opens the prompt (2FA %s -> codeRequired %s)",
    async (twoFactorEnabled, codeRequired) => {
      const { result, core } = await openPrompt(
        "recovery_key_step_up_required",
        twoFactorEnabled,
      );

      expect(result.current.recoveryKeyStepUpPrompt).toEqual({
        codeRequired,
        errorCode: null,
      });
      expect(result.current.isSyncingNow).toBe(false);
      expect(core.setErrorState).not.toHaveBeenCalled();
    },
  );

  it("shows the code field when the 2FA status cannot be read", async () => {
    mockDescribeTwoFactor.mockResolvedValue(null);
    const { result } = await openPrompt("recovery_key_step_up_required");

    expect(result.current.recoveryKeyStepUpPrompt?.codeRequired).toBe(true);
  });

  it("keeps the prompt open with a wait message when the step-up is rate limited", async () => {
    const { result } = await openPrompt("recovery_key_step_up_required", false);
    mockUploadBackupSyncSnapshot.mockResolvedValueOnce({
      ok: false,
      errorCode: "recovery_key_step_up_rate_limited",
    } as never);

    await act(async () => {
      await result.current.handleSubmitRecoveryKeyStepUp({ currentPassword: "pw" });
    });

    expect(result.current.recoveryKeyStepUpPrompt).toEqual({
      codeRequired: false,
      errorCode: "rate_limited",
    });
  });

  it("a step-up retry does not ask the overwrite confirm the same attempt passed", async () => {
    mockDescribeTwoFactor.mockResolvedValue({ twoFactorEnabled: false });
    mockOpenConfirmation.mockResolvedValue(true);
    mockUploadBackupSyncSnapshot.mockImplementationOnce(
      async (_storage, _secrets, _state, _now, guard) => {
        await guard?.confirmUploadOverExistingBackup();
        return { ok: false, errorCode: "recovery_key_step_up_required" } as never;
      },
    );
    const core = createBackupSyncSessionCoreMock();
    const { result } = await renderHook(() => useBackupSyncActions(core));
    await act(async () => {
      await result.current.handleSyncNow();
    });
    expect(mockOpenConfirmation).toHaveBeenCalledTimes(1);
    mockUploadBackupSyncSnapshot.mockResolvedValueOnce({
      ok: false,
      errorCode: "network_failed",
    } as never);

    await act(async () => {
      await result.current.handleSubmitRecoveryKeyStepUp({ currentPassword: "pw" });
    });

    const guard = mockUploadBackupSyncSnapshot.mock.calls[1]?.[4];
    await expect(guard?.confirmUploadOverExistingBackup()).resolves.toBe(true);
    expect(mockOpenConfirmation).toHaveBeenCalledTimes(1);
  });

  it("a step-up retry still asks the overwrite confirm the opening attempt never passed", async () => {
    const { result } = await openPrompt("recovery_key_step_up_required", false);
    mockOpenConfirmation.mockResolvedValue(false);
    mockUploadBackupSyncSnapshot.mockResolvedValueOnce({
      ok: false,
      errorCode: "network_failed",
    } as never);

    await act(async () => {
      await result.current.handleSubmitRecoveryKeyStepUp({ currentPassword: "pw" });
    });

    const guard = mockUploadBackupSyncSnapshot.mock.calls[1]?.[4];
    await expect(guard?.confirmUploadOverExistingBackup()).resolves.toBe(false);
    expect(mockOpenConfirmation).toHaveBeenCalledTimes(1);
  });

  it("retires the prompt once the loaded session changes, and its submit uploads nothing", async () => {
    mockDescribeTwoFactor.mockResolvedValue({ twoFactorEnabled: false });
    mockUploadBackupSyncSnapshot.mockResolvedValueOnce({
      ok: false,
      errorCode: "recovery_key_step_up_required",
    } as never);
    const firstCore = createBackupSyncSessionCoreMock();
    const { result, rerender } = await renderHook(
      (core: ReturnType<typeof createBackupSyncSessionCoreMock>) =>
        useBackupSyncActions(core),
      { initialProps: firstCore },
    );
    await act(async () => {
      await result.current.handleSyncNow();
    });
    expect(result.current.recoveryKeyStepUpPrompt).not.toBeNull();

    const nextState = createLoadedSettingsStateFixture();
    await rerender(
      createBackupSyncSessionCoreMock({
        state: nextState,
        saveSyncDraftIfNeeded: jest.fn().mockResolvedValue(nextState),
      }),
    );
    expect(result.current.recoveryKeyStepUpPrompt).toBeNull();

    await act(async () => {
      await result.current.handleSubmitRecoveryKeyStepUp({ currentPassword: "pw" });
    });
    expect(mockUploadBackupSyncSnapshot).toHaveBeenCalledTimes(1);
  });

  it("code_required forces the code field", async () => {
    const { result } = await openPrompt("recovery_key_code_required");

    expect(result.current.recoveryKeyStepUpPrompt).toEqual({
      codeRequired: true,
      errorCode: null,
    });
  });

  it("invalid_current_password keeps the code field as it was", async () => {
    const { result, core } = await openPrompt(
      "recovery_key_step_up_required",
      true,
    );

    mockUploadBackupSyncSnapshot.mockResolvedValueOnce({
      ok: false,
      errorCode: "invalid_current_password",
    } as never);
    await act(async () => {
      await result.current.handleSubmitRecoveryKeyStepUp({
        currentPassword: "wrong",
        code: "123456",
      });
    });
    expect(result.current.recoveryKeyStepUpPrompt).toEqual({
      codeRequired: true,
      errorCode: "invalid_current_password",
    });

    mockUploadBackupSyncSnapshot.mockResolvedValueOnce({
      ok: false,
      errorCode: "invalid_current_password",
    } as never);
    await act(async () => {
      await result.current.handleSubmitRecoveryKeyStepUp({
        currentPassword: "wrong",
      });
    });
    expect(result.current.recoveryKeyStepUpPrompt).toEqual({
      codeRequired: false,
      errorCode: "invalid_current_password",
    });
    expect(core.setErrorState).not.toHaveBeenCalled();
  });

  it.each(["totp_invalid_code", "totp_replayed"])(
    "%s forces the code field and keeps the prompt open",
    async (errorCode) => {
      const { result, core } = await openPrompt(
        "recovery_key_step_up_required",
        false,
      );
      mockUploadBackupSyncSnapshot.mockResolvedValueOnce({
        ok: false,
        errorCode,
      } as never);

      await act(async () => {
        await result.current.handleSubmitRecoveryKeyStepUp({
          currentPassword: "pw",
        });
      });

      expect(result.current.recoveryKeyStepUpPrompt).toEqual({
        codeRequired: true,
        errorCode,
      });
      expect(core.setErrorState).not.toHaveBeenCalled();
    },
  );

  it("submit passes the step-up as the sixth upload argument and success clears the prompt", async () => {
    const { result, core } = await openPrompt(
      "recovery_key_step_up_required",
      true,
    );
    const uploadedState = createLoadedSettingsStateFixture();
    mockUploadBackupSyncSnapshot.mockResolvedValueOnce({
      ok: true,
      state: uploadedState,
    } as never);

    await act(async () => {
      await result.current.handleSubmitRecoveryKeyStepUp({
        currentPassword: "pw",
        code: "123456",
      });
    });

    expect(mockUploadBackupSyncSnapshot.mock.calls[1]?.[5]).toEqual({
      currentPassword: "pw",
      code: "123456",
    });
    expect(result.current.recoveryKeyStepUpPrompt).toBeNull();
    expect(core.setState).toHaveBeenCalledWith(uploadedState);
  });

  it("cancel clears the prompt", async () => {
    const { result } = await openPrompt("recovery_key_code_required");

    await act(() => {
      result.current.handleCancelRecoveryKeyStepUp();
    });

    expect(result.current.recoveryKeyStepUpPrompt).toBeNull();
  });

  it("a declined overwrite does not open the prompt", async () => {
    const declined = await openPrompt("upload_over_backup_declined");
    expect(declined.result.current.recoveryKeyStepUpPrompt).toBeNull();
  });

  it("other errors do not open the prompt", async () => {
    const other = await openPrompt("network_failed");
    expect(other.result.current.recoveryKeyStepUpPrompt).toBeNull();
    expect(other.core.setErrorState).toHaveBeenCalledWith({
      code: "network_failed",
      scope: "sync",
    });
  });
});
