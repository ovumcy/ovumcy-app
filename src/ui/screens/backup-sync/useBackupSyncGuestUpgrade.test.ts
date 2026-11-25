import { act, renderHook } from "@testing-library/react-native";

import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import * as backupSyncScreenService from "../../../services/backup-sync-screen-service";
import {
  createBackupSyncSessionCoreMock,
  createLoadedSettingsStateFixture,
} from "../../../test/create-backup-sync-session-core-mock";
import { useBackupSyncGuestUpgrade } from "./useBackupSyncGuestUpgrade";

jest.mock("../../../security/sensitive-action-auth", () => ({
  requestSensitiveActionChallenge: jest.fn(),
}));

jest.mock("../../../services/backup-sync-screen-service");

const mockRequestSensitiveActionChallenge = jest.mocked(
  requestSensitiveActionChallenge,
);
const mockUpgradeBackupSyncGuestAccount = jest.mocked(
  backupSyncScreenService.upgradeBackupSyncGuestAccount,
);

const ACCOUNT_ID = "a3f9-0c12-77be-4d01";
const PASSWORD = "a very secure password 123";

describe("useBackupSyncGuestUpgrade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
  });

  describe("handleTapKeepAccess", () => {
    it("opens the form once the device-auth gate passes", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });

      expect(result.current.isFormOpen).toBe(true);
      expect(result.current.formErrorMessage).toBe("");
    });

    it("shows the unavailable message and keeps the form closed when the device-auth gate is unavailable", async () => {
      mockRequestSensitiveActionChallenge.mockResolvedValueOnce({
        ok: false,
        reason: "unavailable",
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });

      expect(result.current.isFormOpen).toBe(false);
      expect(result.current.formErrorMessage).toBe(
        core.partnerCopy.guestUpgrade.errors.deviceAuthUnavailable,
      );
    });

    it("shows the failed message and keeps the form closed when the device-auth gate fails", async () => {
      mockRequestSensitiveActionChallenge.mockResolvedValueOnce({
        ok: false,
        reason: "failed",
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });

      expect(result.current.isFormOpen).toBe(false);
      expect(result.current.formErrorMessage).toBe(
        core.partnerCopy.guestUpgrade.errors.deviceAuthFailed,
      );
    });

    it("quietly keeps the form closed with no error message when the device-auth prompt is cancelled", async () => {
      mockRequestSensitiveActionChallenge.mockResolvedValueOnce({
        ok: false,
        reason: "cancelled",
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });

      expect(result.current.isFormOpen).toBe(false);
      expect(result.current.formErrorMessage).toBe("");
    });
  });

  describe("handleCancelForm", () => {
    it("closes the form and clears the typed password", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });
      await act(() => {
        result.current.setPasswordValue("a temporary draft password");
      });

      await act(() => {
        result.current.handleCancelForm();
      });

      expect(result.current.isFormOpen).toBe(false);
      expect(result.current.passwordValue).toBe("");
    });

    it("exposes no email field on the form state", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      expect(result.current).not.toHaveProperty("emailValue");
      expect(result.current).not.toHaveProperty("setEmailValue");
    });
  });

  describe("handleSubmitUpgrade", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(mockUpgradeBackupSyncGuestAccount).not.toHaveBeenCalled();
      expect(core.setState).not.toHaveBeenCalled();
    });

    it("requires a password before submitting", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(result.current.formErrorMessage).toBe(
        core.partnerCopy.guestUpgrade.errors.passwordRequired,
      );
      expect(mockUpgradeBackupSyncGuestAccount).not.toHaveBeenCalled();
    });

    it("rejects a password shorter than the minimum length", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(() => {
        result.current.setPasswordValue("short");
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(result.current.formErrorMessage).toBe(
        core.partnerCopy.guestUpgrade.errors.passwordTooShort,
      );
      expect(mockUpgradeBackupSyncGuestAccount).not.toHaveBeenCalled();
    });

    it("rejects a password over 72 bytes", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(() => {
        result.current.setPasswordValue("ж".repeat(37));
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(result.current.formErrorMessage).toBe(
        core.partnerCopy.guestUpgrade.errors.passwordTooLong,
      );
      expect(mockUpgradeBackupSyncGuestAccount).not.toHaveBeenCalled();
    });

    it("submits only the password and reveals the Account ID with the recovery code on success", async () => {
      const nextState = createLoadedSettingsStateFixture({ hasSyncSession: true });
      mockUpgradeBackupSyncGuestAccount.mockResolvedValue({
        ok: true,
        state: nextState,
        login: ACCOUNT_ID,
        recoveryCode: "fresh-code-1234",
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(() => {
        result.current.setPasswordValue(PASSWORD);
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(mockUpgradeBackupSyncGuestAccount).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state,
        { password: PASSWORD },
        core.effectiveNow,
      );
      expect(core.setState).toHaveBeenCalledWith(nextState);
      expect(result.current.isFormOpen).toBe(false);
      expect(result.current.passwordValue).toBe("");
      expect(result.current.generatedRecoveryCode).toBe("fresh-code-1234");
      expect(result.current.generatedAccountLogin).toBe(ACCOUNT_ID);
      expect(result.current.isSubmitting).toBe(false);
      expect(core.setAccountChangeRecoveryPhrase).not.toHaveBeenCalled();
    });

    it("opens the gated account-change reveal when the upgrade replaced the key", async () => {
      mockUpgradeBackupSyncGuestAccount.mockResolvedValue({
        ok: true,
        state: createLoadedSettingsStateFixture({ hasSyncSession: true }),
        login: ACCOUNT_ID,
        recoveryCode: "fresh-code-1234",
        accountKeyReset: true,
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(() => {
        result.current.setPasswordValue(PASSWORD);
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(core.setAccountChangeRecoveryPhrase).toHaveBeenCalledWith("reveal");
    });

    it("keeps the form open on a recoverable failure so the owner can retry", async () => {
      const failedState = createLoadedSettingsStateFixture();
      mockUpgradeBackupSyncGuestAccount.mockResolvedValue({
        ok: false,
        errorCode: "unauthorized",
        state: failedState,
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });
      await act(() => {
        result.current.setPasswordValue(PASSWORD);
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(core.setState).toHaveBeenCalledWith(failedState);
      expect(result.current.formErrorMessage).toBe(
        core.partnerCopy.guestUpgrade.errors.unauthorized,
      );
      expect(result.current.isFormOpen).toBe(true);
      expect(result.current.passwordValue).toBe(PASSWORD);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.generatedRecoveryCode).toBe("");
      expect(result.current.generatedAccountLogin).toBe("");
    });

    it("closes the now-dead form when the account turns out to already be upgraded", async () => {
      const failedState = createLoadedSettingsStateFixture();
      mockUpgradeBackupSyncGuestAccount.mockResolvedValue({
        ok: false,
        errorCode: "account_not_guest",
        state: failedState,
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });
      await act(() => {
        result.current.setPasswordValue(PASSWORD);
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(result.current.formErrorMessage).toBe(
        core.partnerCopy.guestUpgrade.alreadyUpgradedMessage,
      );
      expect(result.current.isFormOpen).toBe(false);
      expect(result.current.passwordValue).toBe("");
    });
  });

  describe("handleAcknowledgeUpgradeRecoveryCode", () => {
    it("clears the revealed recovery code and Account ID", async () => {
      mockUpgradeBackupSyncGuestAccount.mockResolvedValue({
        ok: true,
        state: createLoadedSettingsStateFixture(),
        login: ACCOUNT_ID,
        recoveryCode: "fresh-code-1234",
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(() => {
        result.current.setPasswordValue(PASSWORD);
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });
      expect(result.current.generatedRecoveryCode).toBe("fresh-code-1234");
      expect(result.current.generatedAccountLogin).toBe(ACCOUNT_ID);

      await act(() => {
        result.current.handleAcknowledgeUpgradeRecoveryCode();
      });

      expect(result.current.generatedRecoveryCode).toBe("");
      expect(result.current.generatedAccountLogin).toBe("");
    });
  });
});
