import { act, renderHook } from "@testing-library/react-native";

import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import * as backupSyncScreenService from "../../../services/backup-sync-screen-service";
import { resolveBackupSyncConnectedStatusMessage } from "../../../services/backup-sync-view-service";
import { clearManagedPartnerInviteToken } from "../../../security/managed-partner-invite-token-buffer";
import {
  createBackupSyncSessionCoreMock,
  createLoadedSettingsStateFixture,
} from "../../../test/create-backup-sync-session-core-mock";
import { openConfirmation } from "../../confirm/open-confirmation";
import { useBackupSyncAccountConnection } from "./useBackupSyncAccountConnection";

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
const mockConnectBackupSyncAccount = jest.mocked(
  backupSyncScreenService.connectBackupSyncAccount,
);
const mockCompleteBackupSyncTOTPChallenge = jest.mocked(
  backupSyncScreenService.completeBackupSyncTOTPChallenge,
);
const mockRecoverBackupSyncAccess = jest.mocked(
  backupSyncScreenService.recoverBackupSyncAccess,
);
const mockDisconnectBackupSyncAccount = jest.mocked(
  backupSyncScreenService.disconnectBackupSyncAccount,
);

describe("useBackupSyncAccountConnection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearManagedPartnerInviteToken();
  });

  describe("handleConnectSync", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(core.resetFeedbackMessages).not.toHaveBeenCalled();
      expect(mockConnectBackupSyncAccount).not.toHaveBeenCalled();
    });

    it("stops without calling the service when the draft cannot be saved", async () => {
      const core = createBackupSyncSessionCoreMock({
        saveSyncDraftIfNeeded: jest.fn().mockResolvedValue(null),
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(core.saveSyncDraftIfNeeded).toHaveBeenCalledWith("account");
      expect(mockConnectBackupSyncAccount).not.toHaveBeenCalled();
      expect(result.current.isAuthenticatingSync).toBe(false);
    });

    it("forwards the typed credentials and mode to the service", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        connected: true,
        state: core.state!,
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      act(() => {
        result.current.setAccountLoginValue("owner@example.com");
        result.current.setAccountPasswordValue("hunter2-hunter2");
      });

      await act(async () => {
        await result.current.handleConnectSync("register");
      });

      expect(mockConnectBackupSyncAccount).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state,
        { login: "owner@example.com", password: "hunter2-hunter2" },
        "register",
        core.effectiveNow,
      );
    });

    it("surfaces a connect error with account scope", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: false,
        errorCode: "invalid_credentials",
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "invalid_credentials",
        scope: "account",
      });
      expect(result.current.isAuthenticatingSync).toBe(false);
    });

    it("captures the pending TOTP challenge without persisting the password", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        totpChallengeRequired: true,
        challengeID: "challenge-1",
        challengeExpiresAt: "2026-03-20T08:05:00.000Z",
        preferences: core.state!.syncPreferences,
        accountID: "account-1",
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      act(() => {
        result.current.setAccountPasswordValue("hunter2-hunter2");
      });

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(result.current.pendingTOTPChallenge).toEqual({
        challengeID: "challenge-1",
        challengeExpiresAt: "2026-03-20T08:05:00.000Z",
        preferences: core.state!.syncPreferences,
      });
      expect(result.current.accountPasswordValue).toBe("");
      expect(core.setErrorState).toHaveBeenCalledWith(null);
      expect(core.setState).not.toHaveBeenCalled();
      expect(result.current.isAuthenticatingSync).toBe(false);
    });

    it("connects successfully, stores the state, and reports the connected status", async () => {
      const connectedState = createLoadedSettingsStateFixture({
        hasSyncSession: true,
      });
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        connected: true,
        state: connectedState,
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(core.setErrorState).toHaveBeenCalledWith(null);
      expect(core.setState).toHaveBeenCalledWith(connectedState);
      expect(core.setGeneratedRecoveryCode).not.toHaveBeenCalled();
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(connectedState);
      expect(result.current.accountPasswordValue).toBe("");
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        resolveBackupSyncConnectedStatusMessage(connectedState, core.viewData.account),
      );
      expect(result.current.isAuthenticatingSync).toBe(false);
    });

    it("surfaces the one-time recovery code on a fresh register", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        connected: true,
        state: core.state!,
        recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("register");
      });

      expect(core.setGeneratedRecoveryCode).toHaveBeenCalledWith(
        "abcd1234abcd1234abcd1234abcd1234",
      );
    });
  });

  describe("handleSubmitTOTPChallenge / handleCancelTOTPChallenge", () => {
    async function renderHookWithPendingChallenge() {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        totpChallengeRequired: true,
        challengeID: "challenge-1",
        challengeExpiresAt: "2026-03-20T08:05:00.000Z",
        preferences: core.state!.syncPreferences,
        accountID: "account-1",
      });
      const rendered = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await rendered.result.current.handleConnectSync("login");
      });

      return { core, ...rendered };
    }

    it("does nothing without a pending challenge", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleSubmitTOTPChallenge();
      });

      expect(mockCompleteBackupSyncTOTPChallenge).not.toHaveBeenCalled();
    });

    it("submits the typed code against the captured challenge id", async () => {
      const { core, result } = await renderHookWithPendingChallenge();
      mockCompleteBackupSyncTOTPChallenge.mockResolvedValue({
        ok: true,
        connected: true,
        state: core.state!,
      });

      act(() => {
        result.current.setTotpChallengeCode("123456");
      });

      await act(async () => {
        await result.current.handleSubmitTOTPChallenge();
      });

      expect(mockCompleteBackupSyncTOTPChallenge).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state,
        core.state!.syncPreferences,
        { challengeID: "challenge-1", code: "123456" },
      );
    });

    it("drops the pending challenge on an invalid/expired challenge error", async () => {
      const { result } = await renderHookWithPendingChallenge();
      mockCompleteBackupSyncTOTPChallenge.mockResolvedValue({
        ok: false,
        errorCode: "totp_challenge_invalid",
      });

      await act(async () => {
        await result.current.handleSubmitTOTPChallenge();
      });

      expect(result.current.pendingTOTPChallenge).toBeNull();
      expect(result.current.totpChallengeCode).toBe("");
    });

    it("keeps the pending challenge alive on a retryable error (wrong code)", async () => {
      const { result } = await renderHookWithPendingChallenge();
      mockCompleteBackupSyncTOTPChallenge.mockResolvedValue({
        ok: false,
        errorCode: "totp_invalid_code",
      });

      act(() => {
        result.current.setTotpChallengeCode("000000");
      });

      await act(async () => {
        await result.current.handleSubmitTOTPChallenge();
      });

      expect(result.current.pendingTOTPChallenge).not.toBeNull();
      expect(result.current.totpChallengeCode).toBe("000000");
    });

    it("finalizes the connection and reports the connected status on success", async () => {
      const { core, result } = await renderHookWithPendingChallenge();
      const connectedState = createLoadedSettingsStateFixture({
        hasSyncSession: true,
      });
      mockCompleteBackupSyncTOTPChallenge.mockResolvedValue({
        ok: true,
        connected: true,
        state: connectedState,
      });

      await act(async () => {
        await result.current.handleSubmitTOTPChallenge();
      });

      expect(core.setState).toHaveBeenCalledWith(connectedState);
      expect(result.current.pendingTOTPChallenge).toBeNull();
      expect(result.current.totpChallengeCode).toBe("");
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(connectedState);
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        resolveBackupSyncConnectedStatusMessage(connectedState, core.viewData.account),
      );
    });

    it("cancels the pending challenge and clears feedback", async () => {
      const { core, result } = await renderHookWithPendingChallenge();

      act(() => {
        result.current.setTotpChallengeCode("999999");
      });
      jest.mocked(core.setErrorState).mockClear();

      act(() => {
        result.current.handleCancelTOTPChallenge();
      });

      expect(result.current.pendingTOTPChallenge).toBeNull();
      expect(result.current.totpChallengeCode).toBe("");
      expect(core.setErrorState).toHaveBeenCalledWith(null);
    });
  });

  describe("handleRecoverSync", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleRecoverSync();
      });

      expect(mockRecoverBackupSyncAccess).not.toHaveBeenCalled();
    });

    it("stops without calling the service when the draft cannot be saved", async () => {
      const core = createBackupSyncSessionCoreMock({
        saveSyncDraftIfNeeded: jest.fn().mockResolvedValue(null),
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleRecoverSync();
      });

      expect(mockRecoverBackupSyncAccess).not.toHaveBeenCalled();
      expect(result.current.isRecoveringSync).toBe(false);
    });

    it("forwards credentials and the typed recovery phrase to the service", async () => {
      const core = createBackupSyncSessionCoreMock({
        recoveryPhraseInputValue: "alpha beta gamma delta epsilon zeta",
      });
      mockRecoverBackupSyncAccess.mockResolvedValue({
        ok: true,
        state: core.state!,
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      act(() => {
        result.current.setAccountLoginValue("owner@example.com");
        result.current.setAccountPasswordValue("hunter2-hunter2");
      });

      await act(async () => {
        await result.current.handleRecoverSync();
      });

      expect(mockRecoverBackupSyncAccess).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state,
        { login: "owner@example.com", password: "hunter2-hunter2" },
        "alpha beta gamma delta epsilon zeta",
        core.effectiveNow,
      );
    });

    it("surfaces a recovery error with account scope", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRecoverBackupSyncAccess.mockResolvedValue({
        ok: false,
        errorCode: "invalid_recovery_phrase",
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleRecoverSync();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "invalid_recovery_phrase",
        scope: "account",
      });
      expect(result.current.isRecoveringSync).toBe(false);
    });

    it("recovers successfully and clears the sensitive input fields", async () => {
      const recoveredState = createLoadedSettingsStateFixture({
        hasSyncSession: true,
      });
      const core = createBackupSyncSessionCoreMock();
      mockRecoverBackupSyncAccess.mockResolvedValue({
        ok: true,
        state: recoveredState,
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleRecoverSync();
      });

      expect(core.setErrorState).toHaveBeenCalledWith(null);
      expect(core.setState).toHaveBeenCalledWith(recoveredState);
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(recoveredState);
      expect(result.current.accountPasswordValue).toBe("");
      expect(core.setRecoveryPhraseInputValue).toHaveBeenCalledWith("");
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        core.viewData.account.status.recovered,
      );
      expect(result.current.isRecoveringSync).toBe(false);
    });
  });

  describe("handleDisconnectSync", () => {
    beforeEach(() => {
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
    });

    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(mockRequestSensitiveActionChallenge).not.toHaveBeenCalled();
      expect(mockDisconnectBackupSyncAccount).not.toHaveBeenCalled();
    });

    it("surfaces deviceAuthUnavailable with sync scope when the challenge is unavailable", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "unavailable",
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "deviceAuthUnavailable",
        scope: "sync",
      });
      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockDisconnectBackupSyncAccount).not.toHaveBeenCalled();
    });

    it("surfaces deviceAuthFailed with sync scope when the challenge fails", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "failed",
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "deviceAuthFailed",
        scope: "sync",
      });
      expect(mockDisconnectBackupSyncAccount).not.toHaveBeenCalled();
    });

    it("stays silent when the device-auth challenge is cancelled", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "cancelled",
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(core.setErrorState).not.toHaveBeenCalled();
      expect(mockDisconnectBackupSyncAccount).not.toHaveBeenCalled();
    });

    it("requests device auth and confirmation with the expected copy", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockDisconnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        state: core.state!,
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledWith(
        core.viewData.account.disconnectDeviceAuthPrompt,
      );
      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        core.viewData.account.disconnectPrompt,
        core.viewData.account.disconnectLabel,
      );
    });

    it("does not disconnect when the owner declines the confirm", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(mockDisconnectBackupSyncAccount).not.toHaveBeenCalled();
    });

    it("disconnects, clears the pending partner invite, and reports disconnected on confirmed success", async () => {
      const disconnectedState = createLoadedSettingsStateFixture({
        hasSyncSession: false,
      });
      const core = createBackupSyncSessionCoreMock({
        pendingPartnerInviteToken: "pending-token",
      });
      mockDisconnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        state: disconnectedState,
      });
      const { result } = renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(mockDisconnectBackupSyncAccount).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state,
      );
      expect(core.setPendingPartnerInviteToken).toHaveBeenCalledWith("");
      expect(core.setErrorState).toHaveBeenCalledWith(null);
      expect(core.setState).toHaveBeenCalledWith(disconnectedState);
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(disconnectedState);
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        core.viewData.account.status.disconnected,
      );
    });
  });
});
