import { useState } from "react";

import {
  buildAccountDeletionViewModel,
  deleteOvumcyAccount,
} from "../../../sync/account-deletion-service";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import { clearManagedPartnerInviteToken } from "../../../security/managed-partner-invite-token-buffer";
import { openConfirmation } from "../../confirm/open-confirmation";
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
 * invariant used everywhere else in this screen. The actual network call +
 * secrets/local-data teardown is delegated to `deleteOvumcyAccount`, which
 * aborts before touching local state if the server delete fails.
 */
export function useBackupSyncAccountDeletion(core: BackupSyncSessionCore) {
  const {
    effectiveNow,
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

  async function handleDeleteAccount() {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
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
      now: effectiveNow,
    });

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

    setIsDeletingAccount(true);
    const result = await deleteOvumcyAccount(
      storage,
      syncSecretStore,
      state.savedSyncPreferences,
    );
    if (!result.ok) {
      setErrorState({
        code: result.errorCode,
        scope: "delete_account",
      });
      setIsDeletingAccount(false);
      return;
    }

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
    isDeletingAccount,
    handleDeleteAccount,
  };
}
