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

describe("useBackupSyncGuestUpgrade", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
  });

  describe("handleTapKeepAccess", () => {
    it("opens the form once the device-auth gate passes", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

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
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

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
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

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
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });

      expect(result.current.isFormOpen).toBe(false);
      expect(result.current.formErrorMessage).toBe("");
    });
  });

  describe("handleCancelForm", () => {
    it("closes the form and clears the typed email and password", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });
      act(() => {
        result.current.setEmailValue("owner@example.com");
        result.current.setPasswordValue("a temporary draft password");
      });

      act(() => {
        result.current.handleCancelForm();
      });

      expect(result.current.isFormOpen).toBe(false);
      expect(result.current.emailValue).toBe("");
      expect(result.current.passwordValue).toBe("");
    });
  });

  describe("handleSubmitUpgrade", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(mockUpgradeBackupSyncGuestAccount).not.toHaveBeenCalled();
      expect(core.setState).not.toHaveBeenCalled();
    });

    it("requires an email before submitting", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(result.current.formErrorMessage).toBe(
        core.partnerCopy.guestUpgrade.errors.emailRequired,
      );
      expect(mockUpgradeBackupSyncGuestAccount).not.toHaveBeenCalled();
    });

    it("requires a password before submitting", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

      act(() => {
        result.current.setEmailValue("owner@example.com");
      });
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
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

      act(() => {
        result.current.setEmailValue("owner@example.com");
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

    it("reveals a one-time recovery code, closes the form, and clears the fields on success", async () => {
      const nextState = createLoadedSettingsStateFixture({ hasSyncSession: true });
      mockUpgradeBackupSyncGuestAccount.mockResolvedValue({
        ok: true,
        state: nextState,
        email: "owner@example.com",
        recoveryCode: "fresh-code-1234",
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

      act(() => {
        result.current.setEmailValue("  owner@example.com  ");
        result.current.setPasswordValue("a very secure password 123");
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(mockUpgradeBackupSyncGuestAccount).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state,
        { email: "owner@example.com", password: "a very secure password 123" },
      );
      expect(core.setState).toHaveBeenCalledWith(nextState);
      expect(result.current.isFormOpen).toBe(false);
      expect(result.current.emailValue).toBe("");
      expect(result.current.passwordValue).toBe("");
      expect(result.current.generatedRecoveryCode).toBe("fresh-code-1234");
      expect(result.current.isSubmitting).toBe(false);
    });

    it("keeps the form open on a recoverable failure so the owner can retry", async () => {
      const failedState = createLoadedSettingsStateFixture();
      mockUpgradeBackupSyncGuestAccount.mockResolvedValue({
        ok: false,
        errorCode: "unauthorized",
        state: failedState,
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });
      act(() => {
        result.current.setEmailValue("owner@example.com");
        result.current.setPasswordValue("a very secure password 123");
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(core.setState).toHaveBeenCalledWith(failedState);
      expect(result.current.formErrorMessage).toBe(
        core.partnerCopy.guestUpgrade.errors.unauthorized,
      );
      expect(result.current.isFormOpen).toBe(true);
      expect(result.current.emailValue).toBe("owner@example.com");
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.generatedRecoveryCode).toBe("");
    });

    it("closes the now-dead form when the account turns out to already be upgraded", async () => {
      const failedState = createLoadedSettingsStateFixture();
      mockUpgradeBackupSyncGuestAccount.mockResolvedValue({
        ok: false,
        errorCode: "account_not_guest",
        state: failedState,
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

      await act(async () => {
        await result.current.handleTapKeepAccess();
      });
      act(() => {
        result.current.setEmailValue("owner@example.com");
        result.current.setPasswordValue("a very secure password 123");
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });

      expect(result.current.formErrorMessage).toBe(
        core.partnerCopy.guestUpgrade.alreadyUpgradedMessage,
      );
      expect(result.current.isFormOpen).toBe(false);
      expect(result.current.emailValue).toBe("");
      expect(result.current.passwordValue).toBe("");
    });
  });

  describe("handleAcknowledgeUpgradeRecoveryCode", () => {
    it("clears the revealed recovery code", async () => {
      mockUpgradeBackupSyncGuestAccount.mockResolvedValue({
        ok: true,
        state: createLoadedSettingsStateFixture(),
        email: "owner@example.com",
        recoveryCode: "fresh-code-1234",
      });
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncGuestUpgrade(core));

      act(() => {
        result.current.setEmailValue("owner@example.com");
        result.current.setPasswordValue("a very secure password 123");
      });
      await act(async () => {
        await result.current.handleSubmitUpgrade();
      });
      expect(result.current.generatedRecoveryCode).toBe("fresh-code-1234");

      act(() => {
        result.current.handleAcknowledgeUpgradeRecoveryCode();
      });

      expect(result.current.generatedRecoveryCode).toBe("");
    });
  });
});
