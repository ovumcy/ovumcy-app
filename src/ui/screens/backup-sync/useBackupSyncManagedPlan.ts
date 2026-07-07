import { useState } from "react";

import { loadSettingsScreenState } from "../../../services/settings-state-service";
import {
  updateBackupSyncRenewal,
  type BackupSyncRenewalAction,
} from "../../../services/backup-sync-screen-service";
import {
  dismissBillingOffer,
  type ResolvedBillingOffer,
} from "../../../services/offers-service";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

/**
 * Managed-plan concern: subscription renewal (cancel-at-period-end / resume),
 * the on-demand plan re-check that recovers from a transient "could not confirm
 * plan" state, and billing-offer dismissal/CTA. Reads the managed billing
 * snapshot through the shared core; never a cached second copy.
 */
export function useBackupSyncManagedPlan(core: BackupSyncSessionCore) {
  const {
    effectiveNow,
    reloadPartnerAccess,
    resetFeedbackMessages,
    setAccountStatusMessage,
    setDismissedOfferIDs,
    setErrorState,
    setState,
    state,
    storage,
    syncSecretStore,
    viewData,
  } = core;

  const [isUpdatingRenewal, setIsUpdatingRenewal] = useState(false);

  // Re-fetches the managed billing snapshot on demand so the owner can recover
  // from a transient "could not confirm plan" state without leaving the screen.
  async function handleRetryPlanCheck() {
    resetFeedbackMessages();
    const refreshed = await loadSettingsScreenState(
      storage,
      syncSecretStore,
      effectiveNow,
    );
    setState(refreshed);
    await reloadPartnerAccess(refreshed);
  }

  async function handleUpdateRenewal(action: BackupSyncRenewalAction) {
    if (!state) {
      return;
    }

    resetFeedbackMessages();
    if (action === "cancel_at_period_end") {
      const confirmed = await openConfirmation(
        viewData.account.renewalCancelPrompt,
        viewData.account.renewalCancelAccept,
        viewData.common.cancelAction,
      );
      // A dismissal resolves to false = keep the subscription untouched.
      if (!confirmed) {
        return;
      }
    }

    setIsUpdatingRenewal(true);
    const result = await updateBackupSyncRenewal(
      storage,
      syncSecretStore,
      state,
      action,
      effectiveNow,
    );
    if (!result.ok) {
      setErrorState({
        code: result.errorCode,
        scope: "account",
      });
      setIsUpdatingRenewal(false);
      return;
    }

    setErrorState(null);
    setState(result.state);
    setAccountStatusMessage(
      action === "cancel_at_period_end"
        ? viewData.account.status.renewalCancelled
        : viewData.account.status.renewalResumed,
    );
    setIsUpdatingRenewal(false);
  }

  async function handleDismissOffer(offerID: string) {
    const nextDismissedOfferIDs = await dismissBillingOffer(storage, offerID);
    setDismissedOfferIDs(nextDismissedOfferIDs);
  }

  function handleOfferCTAPress(offer: ResolvedBillingOffer) {
    if (offer.action.type === "screen") {
      // v1 renders offers only on the backup-sync screen and the single
      // known screen target IS /backup-sync — navigating again would remount
      // the flow, so this is a deliberate no-op while already here. Other
      // surfaces (stats/settings) get real routing when they adopt OfferCard.
      return;
    }
    // "play_checkout" CTAs are inert until Play Billing lands in a later
    // phase; the card renders them disabled so this branch is unreachable
    // from the UI today.
  }

  return {
    isUpdatingRenewal,
    handleRetryPlanCheck,
    handleUpdateRenewal,
    handleDismissOffer,
    handleOfferCTAPress,
  };
}
