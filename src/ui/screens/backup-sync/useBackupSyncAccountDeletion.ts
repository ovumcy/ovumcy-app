import { useState } from "react";

import {
  buildAccountDeletionViewModel,
  deleteOvumcyAccount,
} from "../../../sync/account-deletion-service";
import { isGuestPartnerAccount } from "../../../services/backup-sync-view-service";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import { clearManagedPartnerInviteToken } from "../../../security/managed-partner-invite-token-buffer";
import { describeSyncAccountTwoFactor } from "../../../sync/sync-account-session-service";
import type { SyncRecoveryKeyStepUp } from "../../../sync/sync-api-client";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { RecoveryKeyStepUpPrompt } from "./useBackupSyncActions";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

/**
 * handleDeleteAccount drives the irreversible "Delete account" flow:
 * device-auth challenge -> standard destructive confirm -> (only when the
 * subscription is store/paid-backed, i.e. active or canceling — a pure
 * trial never triggers this, see `buildAccountDeletionViewModel`) a SECOND,
 * distinctly-worded confirm that must be read and accepted separately,
 * warning that deleting the account does not cancel an active Ovumcy Cloud
 * subscription. The copy stays store-neutral until Google Play Billing (the
 * first planned IAP channel) lands. A dismissal at any step is the safe
 * answer and aborts with nothing changed, matching the confirm-dialog
 * invariant used everywhere else in this screen. A managed password account
 * then gets the step-up card: Ovumcy Cloud re-confirms the password (+ TOTP
 * code with two-factor on) before it erases anything. The actual network call +
 * secrets/local-data teardown is delegated to `deleteOvumcyAccount`, which
 * aborts before touching local state if the server delete fails.
 */
export function useBackupSyncAccountDeletion(core: BackupSyncSessionCore) {
  const {
    certPinStore,
    effectiveNow,
    entitlementTokenStore,
    partnerShareSecretStore,
    resetFeedbackMessages,
    router,
    setErrorState,
    setPendingPartnerInviteToken,
    state,
    storage,
    syncProfilePreferences,
    syncSecretStore,
    viewData,
  } = core;

  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [pendingStepUp, setPendingStepUp] = useState<{
    prompt: RecoveryKeyStepUpPrompt;
    // A reload, disconnect or another account replaces `state` and so
    // retires the prompt together with the confirms it continues.
    forState: NonNullable<typeof state>;
  } | null>(null);
  const accountDeletionStepUpPrompt =
    pendingStepUp && pendingStepUp.forState === state ? pendingStepUp.prompt : null;

  async function handleDeleteAccount() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
    setPendingStepUp(null);
    const challengeResult = await requestSensitiveActionChallenge(
      viewData.account.deleteAccountDeviceAuthPrompt,
    );
    if (!challengeResult.ok) {
      if (challengeResult.reason === "unavailable") {
        setErrorState({
          code: "deviceAuthUnavailable",
          scope: "delete_account",
        });
      } else if (challengeResult.reason === "failed") {
        setErrorState({
          code: "deviceAuthFailed",
          scope: "delete_account",
        });
      }
      return;
    }

    const confirmed = await openConfirmation(
      viewData.account.deleteAccountPrompt,
      viewData.account.deleteAccountAccept,
    );
    if (!confirmed) {
      return;
    }

    const deletionViewModel = buildAccountDeletionViewModel({
      hasConnectedSession: state.hasSyncSession,
      preferences: state.savedSyncPreferences,
      activeSubscription: state.managedPremiumAccess.activeSubscription,
      planStatus: state.managedPremiumAccess.planStatus,
      now: effectiveNow,
    });

    if (
      !deletionViewModel.requiresSubscriptionWarning &&
      deletionViewModel.billingStatusUnknown
    ) {
      // Billing could not be confirmed: never treated as "no subscription".
      const acknowledgedUnknownBilling = await openConfirmation(
        `${viewData.account.deleteAccountBillingUnknownWarningTitle}\n\n${viewData.account.deleteAccountBillingUnknownWarningMessage}`,
        viewData.account.deleteAccountSubscriptionWarningAccept,
      );
      if (!acknowledgedUnknownBilling) {
        return;
      }
    }

    if (deletionViewModel.requiresSubscriptionWarning) {
      // Distinct dialog, distinct wording, distinct accept label: a dismissal
      // or the shared cancel label both resolve to false here exactly like
      // every other destructive confirm, so there is no accidental one-tap
      // path into deleting an account with a live subscription.
      const acknowledgedSubscriptionWarning = await openConfirmation(
        `${viewData.account.deleteAccountSubscriptionWarningTitle}\n\n${viewData.account.deleteAccountSubscriptionWarningMessage}`,
        viewData.account.deleteAccountSubscriptionWarningAccept,
      );
      if (!acknowledgedSubscriptionWarning) {
        return;
      }
    }

    const preferences = state.savedSyncPreferences;
    if (
      preferences.mode === "managed" &&
      state.hasSyncSession &&
      !isGuestPartnerAccount(preferences)
    ) {
      // Asked up front: a bodiless try would spend the shared step-up budget.
      setPendingStepUp({
        prompt: { codeRequired: await isCodeFieldNeeded(state), errorCode: null },
        forState: state,
      });
      return;
    }

    await runDeletion(state, undefined);
  }

  // The password and code live only in the card's own field state and this
  // call's arguments; they are never stored, logged or put in route params.
  async function handleSubmitAccountDeletionStepUp(stepUp: SyncRecoveryKeyStepUp) {
    if (!state || !accountDeletionStepUpPrompt) {
      return;
    }
    resetFeedbackMessages();
    const code = stepUp.code?.trim();
    await runDeletion(
      state,
      code
        ? { currentPassword: stepUp.currentPassword, code }
        : { currentPassword: stepUp.currentPassword },
    );
  }

  function handleCancelAccountDeletionStepUp() {
    setPendingStepUp(null);
  }

  // Unknown two-factor status shows the field; an empty code is not sent.
  async function isCodeFieldNeeded(forState: NonNullable<typeof state>) {
    const twoFactor = await describeSyncAccountTwoFactor(
      syncSecretStore,
      forState.savedSyncPreferences,
    );
    return twoFactor?.twoFactorEnabled ?? true;
  }

  async function resolveStepUpPrompt(
    errorCode: string,
    stepUp: SyncRecoveryKeyStepUp | undefined,
    forState: NonNullable<typeof state>,
  ): Promise<RecoveryKeyStepUpPrompt | null> {
    const codeFieldShown = accountDeletionStepUpPrompt?.codeRequired ?? false;
    switch (errorCode) {
      case "invalid_current_password":
        // A session taken for a guest that the server knows has a password.
        return stepUp === undefined
          ? { codeRequired: await isCodeFieldNeeded(forState), errorCode: null }
          : { codeRequired: codeFieldShown, errorCode };
      case "totp_invalid_code":
      case "totp_replayed":
        return { codeRequired: true, errorCode };
      case "rate_limited":
        return stepUp === undefined
          ? null
          : { codeRequired: codeFieldShown, errorCode };
      default:
        return null;
    }
  }

  async function runDeletion(
    forState: NonNullable<typeof state>,
    stepUp: SyncRecoveryKeyStepUp | undefined,
  ) {
    setIsDeletingAccount(true);
    const result = await deleteOvumcyAccount(
      storage,
      syncSecretStore,
      { certPinStore, entitlementTokenStore, partnerShareSecretStore },
      forState.savedSyncPreferences,
      stepUp,
    );
    if (!result.ok) {
      const prompt = await resolveStepUpPrompt(result.errorCode, stepUp, forState);
      setPendingStepUp(prompt ? { prompt, forState } : null);
      if (!prompt) {
        setErrorState({
          code: result.errorCode,
          scope: "delete_account",
        });
      }
      setIsDeletingAccount(false);
      return;
    }

    setPendingStepUp(null);

    // Same buffers this screen already clears on disconnect; deletion just
    // wiped local data through the same danger-zone path, so also reset the
    // in-memory interface preferences the danger-zone action resets.
    clearManagedPartnerInviteToken();
    setPendingPartnerInviteToken("");
    syncProfilePreferences({
      languageOverride: null,
      themeOverride: null,
      screenCaptureProtectionEnabled: true,
    });
    router.replace(`/onboarding?reset=${Date.now().toString()}`);
  }

  return {
    accountDeletionStepUpPrompt,
    isDeletingAccount,
    handleDeleteAccount,
    handleSubmitAccountDeletionStepUp,
    handleCancelAccountDeletionStepUp,
  };
}
