import { act, renderHook } from "@testing-library/react-native";

import { selectAccountChangeRecoveryCopy } from "../../../i18n/account-change-recovery-copy";
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
const mockCompleteBackupSyncRecoveryTOTPChallenge = jest.mocked(
  backupSyncScreenService.completeBackupSyncRecoveryTOTPChallenge,
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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(core.resetFeedbackMessages).not.toHaveBeenCalled();
      expect(mockConnectBackupSyncAccount).not.toHaveBeenCalled();
    });

    it("sends nothing and stays idle when sync consent is not given", async () => {
      const core = createBackupSyncSessionCoreMock({
        ensureDataSharingConsent: jest.fn().mockResolvedValue(false),
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("register");
      });

      expect(core.ensureDataSharingConsent).toHaveBeenCalledWith("managed_sync");
      expect(core.saveSyncDraftIfNeeded).toHaveBeenCalledTimes(1);
      expect(mockConnectBackupSyncAccount).not.toHaveBeenCalled();
      expect(core.setErrorState).not.toHaveBeenCalled();
      expect(result.current.isAuthenticatingSync).toBe(false);
    });

    it("stops without calling the service when the draft cannot be saved", async () => {
      const core = createBackupSyncSessionCoreMock({
        saveSyncDraftIfNeeded: jest.fn().mockResolvedValue(null),
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(() => {
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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "invalid_credentials",
        scope: "account",
      });
      expect(result.current.isAuthenticatingSync).toBe(false);
    });

    it("carries the server's Retry-After into a rate-limited connect error", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: false,
        errorCode: "rate_limited",
        retryAfterSeconds: 30,
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "rate_limited",
        scope: "account",
        retryAfterSeconds: 30,
      });
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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(() => {
        result.current.setAccountPasswordValue("hunter2-hunter2");
      });

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(result.current.pendingTOTPChallenge).toEqual({
        purpose: "connect",
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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

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

    it("offers the new phrase's reveal, not the plain status, when the sign-in replaced the sync key", async () => {
      const connectedState = createLoadedSettingsStateFixture({ hasSyncSession: true });
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        connected: true,
        state: connectedState,
        accountKeyReset: true,
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(core.setAccountChangeRecoveryPhrase).toHaveBeenCalledWith("reveal");
      expect(core.setGeneratedRecoveryPhrase).not.toHaveBeenCalled();
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        selectAccountChangeRecoveryCopy("en").connectedStatus,
      );
    });

    it("offers no reveal for a sign-in that kept the sync key", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        connected: true,
        state: createLoadedSettingsStateFixture({ hasSyncSession: true }),
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(core.setAccountChangeRecoveryPhrase).not.toHaveBeenCalled();
    });

    it("surfaces the one-time recovery code on a fresh register", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        connected: true,
        state: core.state!,
        recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("register");
      });

      expect(core.setGeneratedRecoveryCode).toHaveBeenCalledWith(
        "abcd1234abcd1234abcd1234abcd1234",
      );
    });

    it("surfaces the generated Account ID together with the recovery code on a managed register", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        connected: true,
        state: core.state!,
        recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
        accountLogin: "a3f9-0c12-77be-4d01",
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("register");
      });

      expect(core.setGeneratedAccountLogin).toHaveBeenCalledWith("a3f9-0c12-77be-4d01");
    });

    it("stores an empty Account ID when the register result carries none", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        connected: true,
        state: core.state!,
        recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("register");
      });

      expect(core.setGeneratedAccountLogin).toHaveBeenCalledWith("");
    });

    it("does not touch the Account ID when a sign-in yields no recovery code", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        connected: true,
        state: core.state!,
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("login");
      });

      expect(core.setGeneratedAccountLogin).not.toHaveBeenCalled();
    });

    it("still surfaces the recovery code when the register's later steps fail", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: false,
        errorCode: "network_failed",
        recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("register");
      });

      expect(core.setGeneratedRecoveryCode).toHaveBeenCalledWith(
        "abcd1234abcd1234abcd1234abcd1234",
      );
      expect(core.setGeneratedAccountLogin).toHaveBeenCalledWith("");
      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "network_failed",
        scope: "account",
      });
    });

    it("surfaces the Account ID with the recovery code when a managed register's later steps fail", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockConnectBackupSyncAccount.mockResolvedValue({
        ok: false,
        errorCode: "sync_not_prepared",
        recoveryCode: "abcd1234abcd1234abcd1234abcd1234",
        accountLogin: "a3f9-0c12-77be-4d01",
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleConnectSync("register");
      });

      expect(core.setGeneratedRecoveryCode).toHaveBeenCalledWith(
        "abcd1234abcd1234abcd1234abcd1234",
      );
      expect(core.setGeneratedAccountLogin).toHaveBeenCalledWith("a3f9-0c12-77be-4d01");
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
      const rendered = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await rendered.result.current.handleConnectSync("login");
      });

      return { core, ...rendered };
    }

    it("does nothing without a pending challenge", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

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

      await act(() => {
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
        core.effectiveNow,
      );
    });

    it("offers the new phrase's reveal after a TOTP sign-in that replaced the sync key", async () => {
      const { core, result } = await renderHookWithPendingChallenge();
      mockCompleteBackupSyncTOTPChallenge.mockResolvedValue({
        ok: true,
        connected: true,
        state: core.state!,
        accountKeyReset: true,
      });

      await act(() => {
        result.current.setTotpChallengeCode("123456");
      });
      await act(async () => {
        await result.current.handleSubmitTOTPChallenge();
      });

      expect(core.setAccountChangeRecoveryPhrase).toHaveBeenCalledWith("reveal");
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

      await act(() => {
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

      await act(() => {
        result.current.setTotpChallengeCode("999999");
      });
      jest.mocked(core.setErrorState).mockClear();

      await act(() => {
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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleRecoverSync();
      });

      expect(mockRecoverBackupSyncAccess).not.toHaveBeenCalled();
    });

    it("attaches nothing when sync consent is not given", async () => {
      const core = createBackupSyncSessionCoreMock({
        ensureDataSharingConsent: jest.fn().mockResolvedValue(false),
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleRecoverSync();
      });

      expect(core.saveSyncDraftIfNeeded).toHaveBeenCalledTimes(1);
      expect(mockRecoverBackupSyncAccess).not.toHaveBeenCalled();
      expect(core.setErrorState).not.toHaveBeenCalled();
      expect(result.current.isRecoveringSync).toBe(false);
    });

    it("stops without calling the service when the draft cannot be saved", async () => {
      const core = createBackupSyncSessionCoreMock({
        saveSyncDraftIfNeeded: jest.fn().mockResolvedValue(null),
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(() => {
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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleRecoverSync();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "invalid_recovery_phrase",
        scope: "account",
      });
      expect(result.current.isRecoveringSync).toBe(false);
    });

    it("carries the server's Retry-After into a rate-limited recovery error", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRecoverBackupSyncAccess.mockResolvedValue({
        ok: false,
        errorCode: "rate_limited",
        retryAfterSeconds: 45,
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleRecoverSync();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "rate_limited",
        scope: "account",
        retryAfterSeconds: 45,
      });
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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

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

    describe("two-factor challenge", () => {
      const PHRASE = "alpha beta gamma delta epsilon zeta";

      async function recoverIntoChallenge() {
        const core = createBackupSyncSessionCoreMock({
          recoveryPhraseInputValue: PHRASE,
        });
        mockRecoverBackupSyncAccess.mockResolvedValue({
          ok: true,
          totpChallengeRequired: true,
          challengeID: "challenge-1",
          challengeExpiresAt: "2026-03-20T08:05:00.000Z",
        });
        const rendered = await renderHook(() => useBackupSyncAccountConnection(core));
        await act(() => {
          rendered.result.current.setAccountPasswordValue("hunter2-hunter2");
        });
        await act(async () => {
          await rendered.result.current.handleRecoverSync();
        });
        return { core, ...rendered };
      }

      it("opens the challenge, drops the password and keeps the phrase", async () => {
        const { core, result } = await recoverIntoChallenge();

        expect(result.current.pendingTOTPChallenge).toEqual({
          purpose: "recover",
          challengeID: "challenge-1",
          challengeExpiresAt: "2026-03-20T08:05:00.000Z",
          preferences: core.state!.savedSyncPreferences,
        });
        expect(result.current.accountPasswordValue).toBe("");
        expect(core.setRecoveryPhraseInputValue).not.toHaveBeenCalled();
        expect(core.setState).not.toHaveBeenCalled();
        expect(result.current.isRecoveringSync).toBe(false);
      });

      it("finishes the recovery with the code and the kept phrase", async () => {
        const recoveredState = createLoadedSettingsStateFixture({
          hasSyncSession: true,
        });
        mockCompleteBackupSyncRecoveryTOTPChallenge.mockResolvedValue({
          ok: true,
          state: recoveredState,
        });
        const { core, result } = await recoverIntoChallenge();

        await act(() => {
          result.current.setTotpChallengeCode("123456");
        });
        await act(async () => {
          await result.current.handleSubmitTOTPChallenge();
        });

        expect(mockCompleteBackupSyncTOTPChallenge).not.toHaveBeenCalled();
        expect(mockCompleteBackupSyncRecoveryTOTPChallenge).toHaveBeenCalledWith(
          core.storage,
          core.syncSecretStore,
          core.state,
          core.state!.savedSyncPreferences,
          { challengeID: "challenge-1", code: "123456", recoveryPhrase: PHRASE },
          core.effectiveNow,
        );
        expect(core.setState).toHaveBeenCalledWith(recoveredState);
        expect(core.setRecoveryPhraseInputValue).toHaveBeenCalledWith("");
        expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
          core.viewData.account.status.recovered,
        );
        expect(result.current.pendingTOTPChallenge).toBeNull();
        expect(result.current.isRecoveringSync).toBe(false);
      });

      it.each([
        ["totp_invalid_code", false, true],
        ["totp_challenge_invalid", false, false],
        ["invalid_recovery_phrase", true, false],
        ["network_failed", true, false],
      ] as const)(
        "on %s (challenge spent: %s) keeps the challenge open: %s",
        async (errorCode, challengeSpent, keepsChallenge) => {
          mockCompleteBackupSyncRecoveryTOTPChallenge.mockResolvedValue(
            challengeSpent
              ? { ok: false, errorCode, challengeSpent: true }
              : { ok: false, errorCode },
          );
          const { core, result } = await recoverIntoChallenge();

          await act(async () => {
            await result.current.handleSubmitTOTPChallenge();
          });

          expect(core.setErrorState).toHaveBeenCalledWith({
            code: errorCode,
            scope: "account",
          });
          expect(result.current.pendingTOTPChallenge !== null).toBe(keepsChallenge);
          expect(core.setRecoveryPhraseInputValue).not.toHaveBeenCalled();
        },
      );
    });
  });

  describe("handleDisconnectSync", () => {
    beforeEach(() => {
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
    });

    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

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
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(core.setErrorState).not.toHaveBeenCalled();
      expect(mockDisconnectBackupSyncAccount).not.toHaveBeenCalled();
    });

    it.each([
      ["managed", "disconnectPromptManaged"],
      ["self_hosted", "disconnectPrompt"],
    ] as const)(
      "requests device auth, then confirms a %s disconnect with its own copy",
      async (mode, promptKey) => {
        const loaded = createLoadedSettingsStateFixture();
        const core = createBackupSyncSessionCoreMock({
          state: { ...loaded, syncPreferences: { ...loaded.syncPreferences, mode } },
        });
        mockDisconnectBackupSyncAccount.mockResolvedValue({
          ok: true,
          state: core.state!,
          remoteSignOut: "confirmed",
        });
        const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

        await act(async () => {
          await result.current.handleDisconnectSync();
        });

        expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledWith(
          core.viewData.account.disconnectDeviceAuthPrompt,
        );
        expect(mockOpenConfirmation).toHaveBeenCalledWith(
          core.viewData.account[promptKey],
          core.viewData.account.disconnectLabel,
          core.viewData.common.cancelAction,
        );
      },
    );

    it("tells a managed disconnect that partner access, guest access included, needs a new invite", () => {
      const { account } = createBackupSyncSessionCoreMock().viewData;

      expect(account.disconnectPromptManaged).not.toBe(account.disconnectPrompt);
      expect(account.disconnectPromptManaged).toContain("guest");
      expect(account.disconnectPromptManaged).toContain("new invite");
    });

    it("does not disconnect when the owner declines the confirm", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

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
        remoteSignOut: "confirmed",
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

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

    it("withdraws the managed sync and partner-share consent on a disconnect and keeps the self-hosted one", async () => {
      const core = createBackupSyncSessionCoreMock();
      const storedPreferences = {
        ...core.state!.savedSyncPreferences,
        dataSharingConsent: {
          managed_sync: { revision: "r1", givenAt: "2026-03-01T08:00:00.000Z" },
          partner_share: { revision: "r1", givenAt: "2026-03-01T08:00:00.000Z" },
          self_hosted_sync: { revision: "r1", givenAt: "2026-03-01T08:00:00.000Z" },
        },
      };
      jest
        .mocked(core.storage.readSyncPreferencesRecord)
        .mockResolvedValue(storedPreferences);
      mockDisconnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        state: createLoadedSettingsStateFixture({ hasSyncSession: false }),
        remoteSignOut: "confirmed",
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(core.storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
        storedPreferences,
        {
          dataSharingConsent: {
            self_hosted_sync: { revision: "r1", givenAt: "2026-03-01T08:00:00.000Z" },
          },
        },
      );
    });

    it("still completes the disconnect when withdrawing the consent fails", async () => {
      const core = createBackupSyncSessionCoreMock();
      jest
        .mocked(core.storage.readSyncPreferencesRecord)
        .mockRejectedValue(new Error("storage unavailable"));
      const disconnectedState = createLoadedSettingsStateFixture({ hasSyncSession: false });
      mockDisconnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        state: disconnectedState,
        remoteSignOut: "confirmed",
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(core.setState).toHaveBeenCalledWith(disconnectedState);
      expect(core.storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
    });

    it("tells the owner the server did not confirm the sign-out when the remote revoke failed", async () => {
      const disconnectedState = createLoadedSettingsStateFixture({
        hasSyncSession: false,
      });
      const core = createBackupSyncSessionCoreMock();
      mockDisconnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        state: disconnectedState,
        remoteSignOut: "unconfirmed",
      });
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(core.setState).toHaveBeenCalledWith(disconnectedState);
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        core.viewData.account.status.disconnectedRemoteUnconfirmed,
      );
      expect(core.setAccountStatusMessage).not.toHaveBeenCalledWith(
        core.viewData.account.status.disconnected,
      );
    });

    it("reports an error, keeps the session and releases the busy flag when the local sign-out fails", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockDisconnectBackupSyncAccount.mockRejectedValue(new Error("keychain locked"));
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({ code: "generic", scope: "sync" });
      expect(core.setState).not.toHaveBeenCalled();
      expect(core.setAccountStatusMessage).not.toHaveBeenCalledWith(
        core.viewData.account.status.disconnected,
      );
      expect(result.current.isDisconnectingSync).toBe(false);
    });

    it("holds the busy flag through the revoke and refuses a second disconnect meanwhile", async () => {
      const disconnectedState = createLoadedSettingsStateFixture({
        hasSyncSession: false,
      });
      const core = createBackupSyncSessionCoreMock();
      let finishRevoke: (value: {
        ok: true;
        state: typeof disconnectedState;
        remoteSignOut: "confirmed";
      }) => void = () => undefined;
      mockDisconnectBackupSyncAccount.mockReturnValue(
        new Promise((resolve) => {
          finishRevoke = resolve;
        }),
      );
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      let firstDisconnect: Promise<void> = Promise.resolve();
      await act(async () => {
        firstDisconnect = result.current.handleDisconnectSync();
      });
      expect(result.current.isDisconnectingSync).toBe(true);

      await act(async () => {
        await result.current.handleDisconnectSync();
      });
      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledTimes(1);
      expect(mockDisconnectBackupSyncAccount).toHaveBeenCalledTimes(1);

      await act(async () => {
        finishRevoke({ ok: true, state: disconnectedState, remoteSignOut: "confirmed" });
        await firstDisconnect;
      });
      expect(result.current.isDisconnectingSync).toBe(false);
      expect(core.setState).toHaveBeenCalledWith(disconnectedState);
    });

    it("never raises the busy flag when the confirm is declined", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });

      expect(result.current.isDisconnectingSync).toBe(false);
    });

    it("clears the busy flag and accepts a new disconnect after the revoke throws", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockDisconnectBackupSyncAccount.mockRejectedValueOnce(new Error("storage"));
      const { result } = await renderHook(() => useBackupSyncAccountConnection(core));

      await act(async () => {
        await result.current.handleDisconnectSync();
      });
      expect(result.current.isDisconnectingSync).toBe(false);

      mockDisconnectBackupSyncAccount.mockResolvedValue({
        ok: true,
        state: core.state!,
        remoteSignOut: "confirmed",
      });
      await act(async () => {
        await result.current.handleDisconnectSync();
      });
      expect(mockDisconnectBackupSyncAccount).toHaveBeenCalledTimes(2);
    });
  });
});
