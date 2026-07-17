import { useState } from "react";

import {
  acceptManagedPartnerInvite,
  issueManagedPartnerInvite,
  revokeManagedPartnerGrant,
  revokeManagedPartnerInvite,
} from "../../../services/managed-partner-access-service";
import { acceptBackupSyncPartnerInviteAsGuest } from "../../../services/backup-sync-screen-service";
import {
  clearManagedPartnerGrantKey,
  storeAcceptedManagedPartnerGrantKey,
  storeIssuedManagedPartnerInviteKey,
} from "../../../services/managed-partner-share-service";
import { clearManagedPartnerInviteToken } from "../../../security/managed-partner-invite-token-buffer";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";
import type { ManagedCloudPartnerAccessLevel } from "../../../sync/managed-cloud-api-client";
import { resolvePartnerErrorMessage } from "./backup-sync-partner-errors";

/**
 * Partner-access concern (managed-only): issuing/accepting/revoking invites and
 * grants and opening the read-only shared surface. The pending-invite buffer
 * and partner-access snapshot live on the shared core (they cross session
 * boundaries handled elsewhere); this hook owns the owner-side UI state and the
 * per-action share-key lifecycle.
 */
export function useBackupSyncPartnerAccess(core: BackupSyncSessionCore) {
  const {
    effectiveNow,
    partnerCopy,
    partnerShareSecretStore,
    pendingPartnerInviteToken,
    reloadPartnerAccess,
    resetPartnerFeedback,
    router,
    setPartnerErrorMessage,
    setPartnerStatusMessage,
    setPendingPartnerInviteToken,
    setState,
    state,
    storage,
    syncSecretStore,
    viewData,
  } = core;

  const [partnerInviteAccessLevel, setPartnerInviteAccessLevel] =
    useState<ManagedCloudPartnerAccessLevel>("summary");
  const [partnerInviteLink, setPartnerInviteLink] = useState("");
  const [isPartnerBusy, setIsPartnerBusy] = useState(false);

  async function handleIssuePartnerInvite() {
    if (!state) {
      return;
    }

    resetPartnerFeedback();
    setIsPartnerBusy(true);

    const result = await issueManagedPartnerInvite(
      syncSecretStore,
      state.syncPreferences.mode,
      {
        accessLevel: partnerInviteAccessLevel,
      },
    );

    if (!result.ok) {
      setPartnerErrorMessage(resolvePartnerErrorMessage(result.errorCode, partnerCopy));
      setIsPartnerBusy(false);
      return;
    }

    try {
      await storeIssuedManagedPartnerInviteKey(
        partnerShareSecretStore,
        result.value,
      );
    } catch {
      setPartnerErrorMessage(partnerCopy.errors.generic);
      setIsPartnerBusy(false);
      return;
    }

    setPartnerInviteLink(result.value.inviteURL);
    setPartnerStatusMessage(partnerCopy.statusInviteIssued);
    await reloadPartnerAccess(state);
    setIsPartnerBusy(false);
  }

  async function handleAcceptPartnerInvite() {
    if (!state || pendingPartnerInviteToken.length === 0) {
      return;
    }

    resetPartnerFeedback();
    setIsPartnerBusy(true);

    const result = await acceptManagedPartnerInvite(
      syncSecretStore,
      state.syncPreferences.mode,
      pendingPartnerInviteToken,
    );
    if (!result.ok) {
      setPartnerErrorMessage(resolvePartnerErrorMessage(result.errorCode, partnerCopy));
      setIsPartnerBusy(false);
      return;
    }

    try {
      await storeAcceptedManagedPartnerGrantKey(
        partnerShareSecretStore,
        result.value.grant,
        pendingPartnerInviteToken,
        effectiveNow,
      );
    } catch {
      setPartnerErrorMessage(partnerCopy.errors.generic);
      setIsPartnerBusy(false);
      return;
    }

    setPartnerStatusMessage(partnerCopy.statusInviteAccepted);
    clearManagedPartnerInviteToken();
    setPendingPartnerInviteToken("");
    router.replace("/backup-sync");
    await reloadPartnerAccess(state);
    setIsPartnerBusy(false);
  }

  /**
   * Guest-accept path: reachable only when a pending invite token is buffered
   * and there is no managed session yet (the choice card in
   * SettingsPartnerAccessSection never renders this action otherwise). One
   * explicit tap redeems the invite through the unauthenticated guest
   * endpoint, persists the freshly minted session, and then continues through
   * the exact same post-accept path as `handleAcceptPartnerInvite` above
   * (partner-share key rotation, buffer clearing, reload) so the two entry
   * points can never drift.
   */
  async function handleAcceptPartnerInviteAsGuest() {
    if (!state || pendingPartnerInviteToken.length === 0) {
      return;
    }

    resetPartnerFeedback();
    setIsPartnerBusy(true);

    const result = await acceptBackupSyncPartnerInviteAsGuest(
      storage,
      syncSecretStore,
      state,
      pendingPartnerInviteToken,
      effectiveNow,
    );
    if (!result.ok) {
      setPartnerErrorMessage(resolvePartnerErrorMessage(result.errorCode, partnerCopy));
      setIsPartnerBusy(false);
      return;
    }

    try {
      await storeAcceptedManagedPartnerGrantKey(
        partnerShareSecretStore,
        result.grant,
        pendingPartnerInviteToken,
        effectiveNow,
      );
    } catch {
      setPartnerErrorMessage(partnerCopy.errors.generic);
      setIsPartnerBusy(false);
      return;
    }

    setState(result.state);
    setPartnerStatusMessage(partnerCopy.statusInviteAccepted);
    clearManagedPartnerInviteToken();
    setPendingPartnerInviteToken("");
    router.replace("/backup-sync");
    await reloadPartnerAccess(result.state);
    setIsPartnerBusy(false);
  }

  /**
   * The explicit "sign in instead" side of the no-session choice. It is
   * intentionally inert with respect to the invite: it never touches
   * `pendingPartnerInviteToken` or calls any accept endpoint, since the
   * token is single-use and must survive this choice untouched (whoever is
   * accepting can still tap "Accept as guest" afterward, or sign in using
   * the account fields already on this screen and then use the
   * ready-to-accept path). It only clears stale partner feedback so a
   * previous guest-accept error does not linger once they choose to sign in
   * instead.
   */
  function handleChoosePartnerSignIn() {
    resetPartnerFeedback();
  }

  async function handleRevokePartnerInvite(inviteID: string) {
    if (!state) {
      return;
    }

    resetPartnerFeedback();
    const confirmed = await openConfirmation(
      partnerCopy.revokeInviteLabel,
      viewData.common.confirmAction,
      viewData.common.cancelAction,
    );
    if (!confirmed) {
      return;
    }

    setIsPartnerBusy(true);
    const result = await revokeManagedPartnerInvite(
      syncSecretStore,
      state.syncPreferences.mode,
      inviteID,
    );
    if (!result.ok) {
      setPartnerErrorMessage(resolvePartnerErrorMessage(result.errorCode, partnerCopy));
      setIsPartnerBusy(false);
      return;
    }

    setPartnerStatusMessage(partnerCopy.statusInviteRevoked);
    await reloadPartnerAccess(state);
    setIsPartnerBusy(false);
  }

  async function handleRevokePartnerGrant(grantID: string) {
    if (!state) {
      return;
    }

    resetPartnerFeedback();
    const confirmed = await openConfirmation(
      partnerCopy.revokeGrantLabel,
      viewData.common.confirmAction,
      viewData.common.cancelAction,
    );
    if (!confirmed) {
      return;
    }

    setIsPartnerBusy(true);
    const result = await revokeManagedPartnerGrant(
      syncSecretStore,
      state.syncPreferences.mode,
      grantID,
    );
    if (!result.ok) {
      setPartnerErrorMessage(resolvePartnerErrorMessage(result.errorCode, partnerCopy));
      setIsPartnerBusy(false);
      return;
    }

    // Server confirmed revoke — drop the local K_grant and per-grant
    // generation counter so subsequent uploads cannot re-encrypt under a
    // stale key. The anti-replay marker in `consumedInviteIDs[sourceInviteID]`
    // is intentionally preserved (re-issuing the same invite would otherwise
    // become possible). A failure here is non-fatal for the user (server
    // already accepted the revoke), but we surface the generic copy so the
    // local-state divergence doesn't go silent.
    try {
      await clearManagedPartnerGrantKey(partnerShareSecretStore, grantID);
    } catch {
      setPartnerErrorMessage(partnerCopy.errors.generic);
    }

    setPartnerStatusMessage(partnerCopy.statusGrantRevoked);
    await reloadPartnerAccess(state);
    setIsPartnerBusy(false);
  }

  function handleOpenPartnerGrant(grantID: string) {
    router.push({
      pathname: "/partner-shared",
      params: {
        grant_id: grantID,
      },
    });
  }

  return {
    partnerInviteAccessLevel,
    setPartnerInviteAccessLevel,
    partnerInviteLink,
    setPartnerInviteLink,
    isPartnerBusy,
    handleIssuePartnerInvite,
    handleAcceptPartnerInvite,
    handleAcceptPartnerInviteAsGuest,
    handleChoosePartnerSignIn,
    handleRevokePartnerInvite,
    handleRevokePartnerGrant,
    handleOpenPartnerGrant,
  };
}
