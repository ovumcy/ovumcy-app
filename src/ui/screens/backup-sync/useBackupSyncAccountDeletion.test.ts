import { act, renderHook } from "@testing-library/react-native";

import {
  clearManagedPartnerInviteToken,
  readManagedPartnerInviteToken,
  stashManagedPartnerInviteToken,
} from "../../../security/managed-partner-invite-token-buffer";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import * as accountDeletionService from "../../../sync/account-deletion-service";
import { createBackupSyncSessionCoreMock } from "../../../test/create-backup-sync-session-core-mock";
import { openConfirmation } from "../../confirm/open-confirmation";
import { useBackupSyncAccountDeletion } from "./useBackupSyncAccountDeletion";

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

jest.mock("../../../security/sensitive-action-auth", () => ({
  requestSensitiveActionChallenge: jest.fn(),
}));

// The subscription-countdown decision (buildAccountDeletionViewModel) has its
// own exhaustive unit suite in sync/account-deletion-service.test.ts -- mock
// the whole module here so this hook suite only asserts the hook's own
// flow-control (which confirms fire, in what order, and what happens on
// dismissal), not the countdown math.
jest.mock("../../../sync/account-deletion-service");

const mockOpenConfirmation = jest.mocked(openConfirmation);
const mockRequestSensitiveActionChallenge = jest.mocked(
  requestSensitiveActionChallenge,
);
const mockBuildAccountDeletionViewModel = jest.mocked(
  accountDeletionService.buildAccountDeletionViewModel,
);
const mockDeleteOvumcyAccount = jest.mocked(
  accountDeletionService.deleteOvumcyAccount,
);

describe("useBackupSyncAccountDeletion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearManagedPartnerInviteToken();
    mockBuildAccountDeletionViewModel.mockReturnValue({
      mode: "managed",
      hasConnectedSession: true,
      requiresSubscriptionWarning: false,
    });
  });

  describe("handleDeleteAccount", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(core.resetFeedbackMessages).not.toHaveBeenCalled();
      expect(mockRequestSensitiveActionChallenge).not.toHaveBeenCalled();
      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
      expect(result.current.isDeletingAccount).toBe(false);
    });

    it("surfaces deviceAuthUnavailable with delete_account scope when the challenge is unavailable", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "unavailable",
      });
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "deviceAuthUnavailable",
        scope: "delete_account",
      });
      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
    });

    it("surfaces deviceAuthFailed with delete_account scope when the challenge fails", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "failed",
      });
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "deviceAuthFailed",
        scope: "delete_account",
      });
      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
    });

    it("stays silent when the device-auth challenge is cancelled by the owner", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "cancelled",
      });
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(core.setErrorState).not.toHaveBeenCalled();
      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
      expect(result.current.isDeletingAccount).toBe(false);
    });

    it("requests device auth with the expected prompt before the standard confirm", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledWith(
        core.viewData.account.deleteAccountDeviceAuthPrompt,
      );
      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        core.viewData.account.deleteAccountPrompt,
        core.viewData.account.deleteAccountAccept,
      );
    });

    // Security constitution: "a dialog dismissal resolves to keep-editing and
    // is never the destructive answer." Dismissing the FIRST (standard)
    // confirm must abort before the deletion view-model is even built --
    // nothing about the account or local data changes.
    it("dismissal of the standard confirm is keep: aborts without deleting anything", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockBuildAccountDeletionViewModel).not.toHaveBeenCalled();
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
      expect(core.router.replace).not.toHaveBeenCalled();
      expect(core.syncProfilePreferences).not.toHaveBeenCalled();
      expect(core.setPendingPartnerInviteToken).not.toHaveBeenCalled();
      expect(result.current.isDeletingAccount).toBe(false);
    });

    it("shows a distinct subscription-warning confirm and proceeds only once both are accepted", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockBuildAccountDeletionViewModel.mockReturnValue({
        mode: "managed",
        hasConnectedSession: true,
        requiresSubscriptionWarning: true,
      });
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockOpenConfirmation).toHaveBeenCalledTimes(2);
      expect(mockOpenConfirmation).toHaveBeenNthCalledWith(
        2,
        `${core.viewData.account.deleteAccountSubscriptionWarningTitle}\n\n${core.viewData.account.deleteAccountSubscriptionWarningMessage}`,
        core.viewData.account.deleteAccountSubscriptionWarningAccept,
      );
      expect(mockDeleteOvumcyAccount).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state!.savedSyncPreferences,
      );
    });

    // Security constitution: dismissal-is-keep applies to the SECOND
    // (subscription-warning) confirm too -- a dismissal there must not fall
    // through to deleting the account.
    it("dismissal of the subscription-warning confirm is keep: aborts without deleting anything", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation
        .mockResolvedValueOnce(true) // standard confirm accepted
        .mockResolvedValueOnce(false); // subscription warning dismissed
      mockBuildAccountDeletionViewModel.mockReturnValue({
        mode: "managed",
        hasConnectedSession: true,
        requiresSubscriptionWarning: true,
      });
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockOpenConfirmation).toHaveBeenCalledTimes(2);
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
      expect(core.router.replace).not.toHaveBeenCalled();
      expect(core.syncProfilePreferences).not.toHaveBeenCalled();
      expect(result.current.isDeletingAccount).toBe(false);
    });

    it("skips the subscription-warning confirm entirely when not required (pure trial) and deletes after the single confirm", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockBuildAccountDeletionViewModel.mockReturnValue({
        mode: "managed",
        hasConnectedSession: true,
        requiresSubscriptionWarning: false,
      });
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockOpenConfirmation).toHaveBeenCalledTimes(1);
      expect(mockDeleteOvumcyAccount).toHaveBeenCalledTimes(1);
    });

    it("surfaces a delete failure with delete_account scope and resets the busy flag without navigating", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockDeleteOvumcyAccount.mockResolvedValue({
        ok: false,
        errorCode: "generic",
      });
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "generic",
        scope: "delete_account",
      });
      expect(result.current.isDeletingAccount).toBe(false);
      expect(core.router.replace).not.toHaveBeenCalled();
      expect(core.syncProfilePreferences).not.toHaveBeenCalled();
      expect(core.setPendingPartnerInviteToken).not.toHaveBeenCalled();
    });

    it("on success clears the pending partner invite, resets interface preferences, and routes to the onboarding reset", async () => {
      stashManagedPartnerInviteToken("pending-invite-token");
      const core = createBackupSyncSessionCoreMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
      const { result } = renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(readManagedPartnerInviteToken()).toBe("");
      expect(core.setPendingPartnerInviteToken).toHaveBeenCalledWith("");
      expect(core.syncProfilePreferences).toHaveBeenCalledWith({
        languageOverride: null,
        themeOverride: null,
        screenCaptureProtectionEnabled: true,
      });
      expect(core.router.replace).toHaveBeenCalledWith(
        "/onboarding?reset=1800000000000",
      );

      jest.spyOn(Date, "now").mockRestore();
    });
  });
});
