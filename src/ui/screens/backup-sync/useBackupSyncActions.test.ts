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
import { useBackupSyncActions } from "./useBackupSyncActions";

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

jest.mock("../../../security/sensitive-action-auth", () => ({
  requestSensitiveActionChallenge: jest.fn(),
}));

jest.mock("../../../services/backup-sync-screen-service");

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
      const { result } = renderHook(() => useBackupSyncActions(core));

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
