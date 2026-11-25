import { act, renderHook } from "@testing-library/react-native";

import {
  clearManagedPartnerInviteToken,
  readManagedPartnerInviteToken,
  stashManagedPartnerInviteToken,
} from "../../../security/managed-partner-invite-token-buffer";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import * as accountDeletionService from "../../../sync/account-deletion-service";
import { describeSyncAccountTwoFactor } from "../../../sync/sync-account-session-service";
import type { SyncRecoveryKeyStepUp } from "../../../sync/sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncSecretsRecord,
} from "../../../sync/sync-contract";
import {
  createBackupSyncSessionCoreMock,
  createLoadedSettingsStateFixture,
} from "../../../test/create-backup-sync-session-core-mock";
import { openConfirmation } from "../../confirm/open-confirmation";
import { useBackupSyncAccountDeletion } from "./useBackupSyncAccountDeletion";

jest.mock("../../../sync/sync-account-session-service", () => ({
  describeSyncAccountTwoFactor: jest.fn(),
}));

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
const mockDescribeTwoFactor = jest.mocked(describeSyncAccountTwoFactor);

const PASSWORD = "very secure password 12345";

type SessionTokens = Pick<
  SyncSecretsRecord,
  "authSessionToken" | "managedAuthSessionToken"
>;
const BOTH_TOKENS: SessionTokens = {
  authSessionToken: "community-token",
  managedAuthSessionToken: "managed-token",
};

function createCore(
  overrides?: Parameters<typeof createBackupSyncSessionCoreMock>[0],
  tokens: SessionTokens = BOTH_TOKENS,
) {
  const core = createBackupSyncSessionCoreMock(overrides);
  jest
    .spyOn(core.syncSecretStore, "readSyncSecrets")
    .mockResolvedValue(tokens as SyncSecretsRecord);
  return core;
}

async function submitStepUp(
  result: { current: ReturnType<typeof useBackupSyncAccountDeletion> },
  stepUp: SyncRecoveryKeyStepUp = { currentPassword: PASSWORD },
) {
  await act(async () => {
    await result.current.handleSubmitAccountDeletionStepUp(stepUp);
  });
}

function createGuestPartnerCore() {
  return createCore({
    state: createLoadedSettingsStateFixture({
      savedSyncPreferences: {
        ...createDefaultSyncPreferencesRecord(),
        guestSessionExpiresAt: "2026-12-01T00:00:00.000Z",
      },
    }),
  });
}

describe("useBackupSyncAccountDeletion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearManagedPartnerInviteToken();
    mockDescribeTwoFactor.mockResolvedValue({
      twoFactorEnabled: false,
      accountLogin: null,
    });
    mockBuildAccountDeletionViewModel.mockReturnValue({
      mode: "managed",
      hasConnectedSession: true,
      requiresSubscriptionWarning: false,
      billingStatusUnknown: false,
    });
  });

  describe("handleDeleteAccount", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createCore({ state: null });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

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
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "unavailable",
      });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

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
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "failed",
      });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

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
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "cancelled",
      });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(core.setErrorState).not.toHaveBeenCalled();
      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
      expect(result.current.isDeletingAccount).toBe(false);
    });

    it("requests device auth with the expected prompt before the standard confirm", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledWith(
        core.viewData.account.deleteAccountDeviceAuthPrompt,
      );
      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        core.viewData.account.deleteAccountPrompt,
        core.viewData.account.deleteAccountAccept,
        core.viewData.common.cancelAction,
      );
    });

    // Security constitution: "a dialog dismissal resolves to keep-editing and
    // is never the destructive answer." Dismissing the FIRST (standard)
    // confirm must abort before the deletion view-model is even built --
    // nothing about the account or local data changes.
    it("dismissal of the standard confirm is keep: aborts without deleting anything", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

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
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockBuildAccountDeletionViewModel.mockReturnValue({
        mode: "managed",
        hasConnectedSession: true,
        requiresSubscriptionWarning: true,
        billingStatusUnknown: false,
      });
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result);

      expect(mockOpenConfirmation).toHaveBeenCalledTimes(2);
      expect(mockOpenConfirmation).toHaveBeenNthCalledWith(
        2,
        `${core.viewData.account.deleteAccountSubscriptionWarningTitle}\n\n${core.viewData.account.deleteAccountSubscriptionWarningMessage}`,
        core.viewData.account.deleteAccountSubscriptionWarningAccept,
        core.viewData.common.cancelAction,
      );
      expect(mockDeleteOvumcyAccount).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        {
          certPinStore: core.certPinStore,
          entitlementTokenStore: core.entitlementTokenStore,
          partnerShareSecretStore: core.partnerShareSecretStore,
        },
        core.state!.savedSyncPreferences,
        { currentPassword: PASSWORD },
        undefined,
        undefined,
        undefined,
        { expectsServerSession: true },
      );
    });

    // Security constitution: dismissal-is-keep applies to the SECOND
    // (subscription-warning) confirm too -- a dismissal there must not fall
    // through to deleting the account.
    it("dismissal of the subscription-warning confirm is keep: aborts without deleting anything", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation
        .mockResolvedValueOnce(true) // standard confirm accepted
        .mockResolvedValueOnce(false); // subscription warning dismissed
      mockBuildAccountDeletionViewModel.mockReturnValue({
        mode: "managed",
        hasConnectedSession: true,
        requiresSubscriptionWarning: true,
        billingStatusUnknown: false,
      });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockOpenConfirmation).toHaveBeenCalledTimes(2);
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
      expect(core.router.replace).not.toHaveBeenCalled();
      expect(core.syncProfilePreferences).not.toHaveBeenCalled();
      expect(result.current.isDeletingAccount).toBe(false);
    });

    it("shows the could-not-confirm warning when billing is unknown and proceeds once it is accepted", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockBuildAccountDeletionViewModel.mockReturnValue({
        mode: "managed",
        hasConnectedSession: true,
        requiresSubscriptionWarning: false,
        billingStatusUnknown: true,
      });
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result);

      expect(mockBuildAccountDeletionViewModel).toHaveBeenCalledWith(
        expect.objectContaining({
          planStatus: core.state!.managedPremiumAccess.planStatus,
        }),
      );
      expect(mockOpenConfirmation).toHaveBeenCalledTimes(2);
      expect(mockOpenConfirmation).toHaveBeenNthCalledWith(
        2,
        `${core.viewData.account.deleteAccountBillingUnknownWarningTitle}\n\n${core.viewData.account.deleteAccountBillingUnknownWarningMessage}`,
        core.viewData.account.deleteAccountSubscriptionWarningAccept,
        core.viewData.common.cancelAction,
      );
      expect(mockDeleteOvumcyAccount).toHaveBeenCalledTimes(1);
    });

    it("dismissal of the could-not-confirm warning is keep: aborts without deleting anything", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mockBuildAccountDeletionViewModel.mockReturnValue({
        mode: "managed",
        hasConnectedSession: true,
        requiresSubscriptionWarning: false,
        billingStatusUnknown: true,
      });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockOpenConfirmation).toHaveBeenCalledTimes(2);
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
      expect(core.router.replace).not.toHaveBeenCalled();
    });

    it("skips the subscription-warning confirm entirely when not required (pure trial) and deletes after the single confirm", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockBuildAccountDeletionViewModel.mockReturnValue({
        mode: "managed",
        hasConnectedSession: true,
        requiresSubscriptionWarning: false,
        billingStatusUnknown: false,
      });
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result);

      expect(mockOpenConfirmation).toHaveBeenCalledTimes(1);
      expect(mockDeleteOvumcyAccount).toHaveBeenCalledTimes(1);
    });

    it("surfaces a delete failure with delete_account scope and resets the busy flag without navigating", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockDeleteOvumcyAccount.mockResolvedValue({
        ok: false,
        errorCode: "generic",
      });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result);

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "generic",
        scope: "delete_account",
      });
      expect(result.current.accountDeletionStepUpPrompt).toBeNull();
      expect(result.current.isDeletingAccount).toBe(false);
      expect(core.router.replace).not.toHaveBeenCalled();
      expect(core.syncProfilePreferences).not.toHaveBeenCalled();
      expect(core.setPendingPartnerInviteToken).not.toHaveBeenCalled();
    });

    // The managed server answers 503 sync_purge_unavailable when it refuses
    // the deletion because the sync-plane erasure cannot be confirmed: the
    // account and all data stay intact for a later retry. The hook must
    // surface that exact code (so the banner shows the deletion-deferred
    // copy, not the generic failure) and must leave everything untouched —
    // still signed in, no local teardown side effects, no navigation.
    it("surfaces sync_purge_unavailable with delete_account scope and leaves the signed-in state untouched", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockDeleteOvumcyAccount.mockResolvedValue({
        ok: false,
        errorCode: "sync_purge_unavailable",
      });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result);

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "sync_purge_unavailable",
        scope: "delete_account",
      });
      expect(result.current.isDeletingAccount).toBe(false);
      expect(core.router.replace).not.toHaveBeenCalled();
      expect(core.syncProfilePreferences).not.toHaveBeenCalled();
      expect(core.setPendingPartnerInviteToken).not.toHaveBeenCalled();
    });

    it("on success clears the pending partner invite, resets interface preferences, and routes to the onboarding reset", async () => {
      stashManagedPartnerInviteToken("pending-invite-token");
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      jest.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result);

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

  describe("managed step-up", () => {
    beforeEach(() => {
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
    });

    it.each([
      [{ twoFactorEnabled: false, accountLogin: null }, false],
      [{ twoFactorEnabled: true, accountLogin: null }, true],
      // Unknown status shows the field; an empty code is not sent.
      [null, true],
    ] as const)(
      "asks for the password after the confirms (2FA %j -> code field %s) and deletes nothing yet",
      async (twoFactor, codeRequired) => {
        mockDescribeTwoFactor.mockResolvedValue(twoFactor);
        const core = createCore();
        const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

        await act(async () => {
          await result.current.handleDeleteAccount();
        });

        expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledTimes(1);
        expect(mockOpenConfirmation).toHaveBeenCalledTimes(1);
        expect(result.current.accountDeletionStepUpPrompt).toEqual({
          codeRequired,
          errorCode: null,
        });
        expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
      },
    );

    it("a stray community token alone never opens the managed card", async () => {
      mockDeleteOvumcyAccount.mockResolvedValue({
        ok: false,
        errorCode: "unauthorized",
      });
      const core = createCore(undefined, {
        authSessionToken: "community-token",
        managedAuthSessionToken: null,
      });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(result.current.accountDeletionStepUpPrompt).toBeNull();
      expect(mockDeleteOvumcyAccount).toHaveBeenCalledTimes(1);
      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "unauthorized",
        scope: "delete_account",
      });
    });

    it("shows the code field when the two-factor status lookup throws", async () => {
      mockDescribeTwoFactor.mockRejectedValue(new Error("keychain locked"));
      const core = createCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(result.current.accountDeletionStepUpPrompt).toEqual({
        codeRequired: true,
        errorCode: null,
      });
      expect(result.current.isDeletingAccount).toBe(false);
    });

    it("a rate-limited guest deletion shows the delete failure, not the card", async () => {
      mockDeleteOvumcyAccount.mockResolvedValue({
        ok: false,
        errorCode: "rate_limited",
      });
      const core = createGuestPartnerCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(result.current.accountDeletionStepUpPrompt).toBeNull();
      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "rate_limited",
        scope: "delete_account",
      });
    });

    it("dismissing the device-auth gate never opens the password card", async () => {
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "cancelled",
      });
      const core = createCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(result.current.accountDeletionStepUpPrompt).toBeNull();
      expect(mockDescribeTwoFactor).not.toHaveBeenCalled();
    });

    it("sends the trimmed code with the password, and drops an empty code", async () => {
      mockDescribeTwoFactor.mockResolvedValue(null);
      mockDeleteOvumcyAccount.mockResolvedValue({
        ok: false,
        errorCode: "totp_invalid_code",
      });
      const core = createCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result, { currentPassword: PASSWORD, code: " 123456 " });
      await submitStepUp(result, { currentPassword: PASSWORD, code: "  " });

      expect(mockDeleteOvumcyAccount.mock.calls[0]?.[4]).toEqual({
        currentPassword: PASSWORD,
        code: "123456",
      });
      expect(mockDeleteOvumcyAccount.mock.calls[1]?.[4]).toEqual({
        currentPassword: PASSWORD,
      });
    });

    it.each([
      ["invalid_current_password", false, "invalid_current_password"],
      ["totp_invalid_code", true, "totp_invalid_code"],
      ["totp_replayed", true, "totp_replayed"],
      ["rate_limited", false, "rate_limited"],
    ] as const)(
      "keeps the card open on %s with its own message and touches nothing else",
      async (errorCode, codeRequired, shown) => {
        mockDeleteOvumcyAccount.mockResolvedValue({ ok: false, errorCode });
        const core = createCore();
        const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

        await act(async () => {
          await result.current.handleDeleteAccount();
        });
        await submitStepUp(result);

        expect(result.current.accountDeletionStepUpPrompt).toEqual({
          codeRequired,
          errorCode: shown,
        });
        expect(core.setErrorState).not.toHaveBeenCalledWith(
          expect.objectContaining({ scope: "delete_account" }),
        );
        expect(result.current.isDeletingAccount).toBe(false);
        expect(core.router.replace).not.toHaveBeenCalled();
      },
    );

    it.each(["totp_not_configured", "totp_secret_failed"] as const)(
      "closes the card and shows the delete failure on %s",
      async (errorCode) => {
        mockDeleteOvumcyAccount.mockResolvedValue({ ok: false, errorCode });
        const core = createCore();
        const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

        await act(async () => {
          await result.current.handleDeleteAccount();
        });
        await submitStepUp(result);

        expect(result.current.accountDeletionStepUpPrompt).toBeNull();
        expect(core.setErrorState).toHaveBeenCalledWith({
          code: errorCode,
          scope: "delete_account",
        });
      },
    );

    it("sends one deletion for two submits in the same frame", async () => {
      let settle: (value: { ok: true }) => void = () => {};
      mockDeleteOvumcyAccount.mockReturnValue(
        new Promise((resolve) => {
          settle = resolve;
        }),
      );
      const core = createCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await act(async () => {
        const submit = result.current.handleSubmitAccountDeletionStepUp;
        const first = submit({ currentPassword: PASSWORD });
        const second = submit({ currentPassword: PASSWORD });
        settle({ ok: true });
        await Promise.all([first, second]);
      });

      expect(mockDeleteOvumcyAccount).toHaveBeenCalledTimes(1);
    });

    it("clears the busy flag and reports a failure when the deletion throws", async () => {
      mockDeleteOvumcyAccount.mockRejectedValue(new Error("keychain locked"));
      const core = createCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result);

      expect(result.current.isDeletingAccount).toBe(false);
      expect(result.current.accountDeletionStepUpPrompt).toBeNull();
      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "generic",
        scope: "delete_account",
      });
    });

    it("cancel closes the card without deleting", async () => {
      const core = createCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await act(() => {
        result.current.handleCancelAccountDeletionStepUp();
      });
      await submitStepUp(result);

      expect(result.current.accountDeletionStepUpPrompt).toBeNull();
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
    });

    it("a guest-partner session deletes with no step-up and no card", async () => {
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      const core = createGuestPartnerCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockDescribeTwoFactor).not.toHaveBeenCalled();
      expect(mockDeleteOvumcyAccount).toHaveBeenCalledTimes(1);
      expect(mockDeleteOvumcyAccount.mock.calls[0]?.[4]).toBeUndefined();
      expect(result.current.accountDeletionStepUpPrompt).toBeNull();
    });

    it("opens the card when the server says a guest session's account has a password", async () => {
      mockDescribeTwoFactor.mockResolvedValue({
        twoFactorEnabled: true,
        accountLogin: null,
      });
      mockDeleteOvumcyAccount.mockResolvedValueOnce({
        ok: false,
        errorCode: "invalid_current_password",
      });
      const core = createGuestPartnerCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(result.current.accountDeletionStepUpPrompt).toEqual({
        codeRequired: true,
        errorCode: null,
      });
      expect(core.setErrorState).not.toHaveBeenCalledWith(
        expect.objectContaining({ scope: "delete_account" }),
      );
    });

    it("never logs or persists the password or code sent with a deletion", async () => {
      mockDescribeTwoFactor.mockResolvedValue({
        twoFactorEnabled: true,
        accountLogin: null,
      });
      mockDeleteOvumcyAccount.mockResolvedValue({
        ok: false,
        errorCode: "totp_replayed",
      });
      const consoleSpies = (
        ["log", "warn", "error", "info", "debug"] as const
      ).map((method) => jest.spyOn(console, method).mockImplementation(() => {}));
      const core = createCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result, {
        currentPassword: "hunter2-hunter2",
        code: "482913",
      });

      const sinks = [
        ...consoleSpies,
        ...Object.values(core).filter(jest.isMockFunction),
        ...Object.values(core.storage).filter(jest.isMockFunction),
        ...Object.values(core.syncSecretStore).filter(jest.isMockFunction),
        ...Object.values(core.router).filter(jest.isMockFunction),
      ];
      for (const sink of sinks) {
        const calls = JSON.stringify(sink.mock.calls);
        expect(calls).not.toContain("482913");
        expect(calls).not.toContain("hunter2-hunter2");
      }
      for (const spy of consoleSpies) {
        spy.mockRestore();
      }
    });
  });

  describe("retry after the server already erased the account", () => {
    const mockFinishLocalAccountDeletion = jest.mocked(
      accountDeletionService.finishLocalAccountDeletion,
    );

    async function failAfterServerDelete(
      result: { current: ReturnType<typeof useBackupSyncAccountDeletion> },
    ) {
      mockDeleteOvumcyAccount.mockResolvedValueOnce({
        ok: false,
        errorCode: "generic",
        serverDeleted: true,
      });
      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result);
    }

    it("re-runs the gates, then only the local part: no DELETE, no password card", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockFinishLocalAccountDeletion.mockResolvedValue({ ok: true });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await failAfterServerDelete(result);
      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "server_erased_local_incomplete",
        scope: "delete_account",
      });
      expect(core.router.replace).not.toHaveBeenCalled();
      mockRequestSensitiveActionChallenge.mockClear();
      mockOpenConfirmation.mockClear();

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledTimes(1);
      expect(mockOpenConfirmation).toHaveBeenCalled();
      expect(result.current.accountDeletionStepUpPrompt).toBeNull();
      expect(mockDeleteOvumcyAccount).toHaveBeenCalledTimes(1);
      expect(mockFinishLocalAccountDeletion).toHaveBeenCalledTimes(1);
      expect(core.router.replace).toHaveBeenCalledTimes(1);
    });

    it("a dismissed device-auth gate still blocks the local-only retry", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await failAfterServerDelete(result);
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "cancelled",
      });
      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockFinishLocalAccountDeletion).not.toHaveBeenCalled();
    });

    it("a dismissed confirm still blocks the local-only retry", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await failAfterServerDelete(result);
      mockOpenConfirmation.mockResolvedValue(false);
      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockFinishLocalAccountDeletion).not.toHaveBeenCalled();
    });

    it("keeps the full server flow when a failure did not erase the server account", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      mockDeleteOvumcyAccount.mockResolvedValueOnce({
        ok: false,
        errorCode: "network_failed",
      });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result);
      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(result.current.accountDeletionStepUpPrompt).not.toBeNull();
      expect(mockFinishLocalAccountDeletion).not.toHaveBeenCalled();
    });

    it("a reloaded or switched state takes the full server flow again", async () => {
      const core = createCore();
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
      const { result, rerender } = await renderHook(
        (props: { core: typeof core }) => useBackupSyncAccountDeletion(props.core),
        { initialProps: { core } },
      );

      await failAfterServerDelete(result);
      await rerender({ core: createCore() });
      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(result.current.accountDeletionStepUpPrompt).not.toBeNull();
      expect(mockFinishLocalAccountDeletion).not.toHaveBeenCalled();
    });
  });

  describe("self-hosted step-up", () => {
    function createSelfHostedCore(
      hasSyncSession = true,
      tokens: SessionTokens = BOTH_TOKENS,
    ) {
      return createCore(
        {
          state: createLoadedSettingsStateFixture({
            hasSyncSession,
            savedSyncPreferences: {
              ...createDefaultSyncPreferencesRecord(),
              mode: "self_hosted",
              endpointInput: "192.168.1.20:8080",
              normalizedEndpoint: "http://192.168.1.20:8080",
              setupStatus: "connected",
            },
          }),
        },
        tokens,
      );
    }

    it("a stray managed token alone never opens the self-hosted card", async () => {
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      const core = createSelfHostedCore(true, {
        authSessionToken: null,
        managedAuthSessionToken: "managed-token",
      });
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockDescribeTwoFactor).not.toHaveBeenCalled();
      expect(result.current.accountDeletionStepUpPrompt).toBeNull();
      expect(mockDeleteOvumcyAccount).toHaveBeenCalledTimes(1);
      expect(mockDeleteOvumcyAccount.mock.calls[0]?.[4]).toBeUndefined();
    });

    it("shows the card when the secret store cannot be read", async () => {
      const core = createSelfHostedCore();
      jest
        .spyOn(core.syncSecretStore, "readSyncSecrets")
        .mockRejectedValue(new Error("keychain locked"));
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(result.current.accountDeletionStepUpPrompt).not.toBeNull();
      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
    });

    beforeEach(() => {
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockOpenConfirmation.mockResolvedValue(true);
    });

    it("asks a connected self-hosted account for the password before any delete", async () => {
      mockDescribeTwoFactor.mockResolvedValue({
        twoFactorEnabled: true,
        accountLogin: null,
      });
      const core = createSelfHostedCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockDeleteOvumcyAccount).not.toHaveBeenCalled();
      expect(result.current.accountDeletionStepUpPrompt).toEqual({
        codeRequired: true,
        errorCode: null,
      });
      expect(result.current.accountDeletionStepUpMode).toBe("self_hosted");
    });

    it("sends the password and code the card collected to the self-hosted delete", async () => {
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      const core = createSelfHostedCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result, { currentPassword: PASSWORD, code: "123456" });

      expect(mockDeleteOvumcyAccount).toHaveBeenCalledTimes(1);
      expect(mockDeleteOvumcyAccount.mock.calls[0]?.[4]).toEqual({
        currentPassword: PASSWORD,
        code: "123456",
      });
      expect(core.router.replace).toHaveBeenCalledTimes(1);
    });

    it("keeps the card with the server's answer after a wrong password", async () => {
      mockDeleteOvumcyAccount.mockResolvedValue({
        ok: false,
        errorCode: "invalid_current_password",
      });
      const core = createSelfHostedCore();
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });
      await submitStepUp(result);

      expect(result.current.accountDeletionStepUpPrompt).toEqual({
        codeRequired: false,
        errorCode: "invalid_current_password",
      });
      expect(core.router.replace).not.toHaveBeenCalled();
    });

    it("a self-hosted device with no session deletes locally with no card", async () => {
      mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
      const core = createSelfHostedCore(false);
      const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

      await act(async () => {
        await result.current.handleDeleteAccount();
      });

      expect(mockDescribeTwoFactor).not.toHaveBeenCalled();
      expect(mockDeleteOvumcyAccount).toHaveBeenCalledTimes(1);
      expect(mockDeleteOvumcyAccount.mock.calls[0]?.[4]).toBeUndefined();
      expect(result.current.accountDeletionStepUpPrompt).toBeNull();
      expect(result.current.accountDeletionStepUpMode).toBeNull();
    });
  });

  it("tells the deletion a connected session was loaded, so a vanished one aborts", async () => {
    const core = createCore();
    mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
    mockOpenConfirmation.mockResolvedValue(true);
    mockDeleteOvumcyAccount.mockResolvedValue({ ok: true });
    const { result } = await renderHook(() => useBackupSyncAccountDeletion(core));

    await act(async () => {
      await result.current.handleDeleteAccount();
    });
    await submitStepUp(result);

    expect(mockDeleteOvumcyAccount.mock.calls[0]?.[8]).toEqual({
      expectsServerSession: core.state?.hasSyncSession,
    });
    expect(core.state?.hasSyncSession).toBe(true);
  });
});
