import { useEffect, useRef, useState } from "react";

import {
  buildDataSharingConsentWithdrawalViewData,
  loadCurrentDataSharingConsentPurposes,
} from "../../../services/data-sharing-consent-service";
import {
  buildPartnerRevokeConfirmLines,
  loadPartnerGrantsToRevokeOnWithdrawal,
  withdrawDataSharingConsentAndRevokePartnerGrants,
  type DataSharingConsentWithdrawalDeps,
} from "../../../services/data-sharing-consent-withdrawal-service";
import type { DataSharingConsentPurpose } from "../../../sync/sync-contract";
import { openConfirmation } from "../../confirm/open-confirmation";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

type WithdrawalOutcome =
  | "none"
  | "withdrawn"
  | "withdrawnAndRevoked"
  | "revokeFailed"
  | "failed";

type ConsentWithdrawalOptions = {
  /** Called once any grant was revoked: the server dropped its pending invites. */
  onPartnerGrantsRevoked?: () => void;
};

/**
 * Standalone withdrawal of the data-sharing consent. Without live partner
 * grants it is one tap, as easy as the tap that gave it. With a partner-share
 * consent and live grants, one confirm names the partners; on yes every grant
 * is revoked and the consent withdrawn, on dismissal nothing changes. The
 * server backup stays.
 */
export function useBackupSyncConsentWithdrawal(
  core: BackupSyncSessionCore,
  { onPartnerGrantsRevoked }: ConsentWithdrawalOptions = {},
) {
  const {
    dataSharingConsentChangeCount,
    language,
    partnerOverview,
    partnerCopy,
    partnerShareSecretStore,
    reloadPartnerAccess,
    state,
    storage,
    syncSecretStore,
    viewData: settingsViewData,
  } = core;
  const [currentPurposes, setCurrentPurposes] = useState<
    DataSharingConsentPurpose[]
  >([]);
  const [outcome, setOutcome] = useState<WithdrawalOutcome>("none");
  const [keyCleanupFailed, setKeyCleanupFailed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  // A load started before a withdrawal must not repaint the purposes it cleared.
  const loadSequenceRef = useRef(0);
  const viewData = buildDataSharingConsentWithdrawalViewData(
    currentPurposes,
    language,
  );

  // Disconnect, revoke, a mode change and a new acceptance all rewrite the
  // stored consent; each of them also changes one of these inputs.
  useEffect(() => {
    if (!state) {
      return;
    }
    const sequence = ++loadSequenceRef.current;
    loadCurrentDataSharingConsentPurposes(storage).then(
      (purposes) => {
        if (sequence !== loadSequenceRef.current) {
          return;
        }
        setCurrentPurposes(purposes);
        if (purposes.length > 0) {
          setOutcome("none");
          setKeyCleanupFailed(false);
        }
      },
      () => undefined,
    );
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [dataSharingConsentChangeCount, partnerOverview, state, storage]);

  // The button is disabled while busy.
  async function handleWithdrawDataSharingConsent() {
    if (!state) {
      return;
    }
    setIsBusy(true);
    setOutcome("none");
    setKeyCleanupFailed(false);
    const deps: DataSharingConsentWithdrawalDeps = {
      partnerShareSecretStore,
      storage,
      syncMode: state.syncPreferences.mode,
      syncSecretStore,
    };
    try {
      const grants = await loadPartnerGrantsToRevokeOnWithdrawal(
        deps,
        partnerOverview,
      );
      if (grants.length > 0) {
        const lines = buildPartnerRevokeConfirmLines(grants, language);
        const confirmed = await openConfirmation(
          [viewData.confirmRevoke, ...lines.map((line) => `• ${line}`)].join(
            "\n",
          ),
          viewData.confirmRevokeLabel,
          settingsViewData.common.cancelAction,
        );
        if (!confirmed) {
          return;
        }
      }

      loadSequenceRef.current += 1;
      const result = await withdrawDataSharingConsentAndRevokePartnerGrants(
        deps,
        grants.map((grant) => grant.id),
      );
      // A load started while the write was in flight may have read it unwritten.
      loadSequenceRef.current += 1;
      setCurrentPurposes([]);
      setKeyCleanupFailed(result.keyCleanupFailed);
      setOutcome(
        result.failedGrantIDs.length > 0
          ? "revokeFailed"
          : result.revokedGrantIDs.length > 0
            ? "withdrawnAndRevoked"
            : "withdrawn",
      );
      if (result.revokedGrantIDs.length > 0) {
        onPartnerGrantsRevoked?.();
      }
      if (grants.length > 0) {
        await reloadPartnerAccess(state, { askPartnerShareConsent: false }).catch(
          () => undefined,
        );
      }
    } catch {
      setOutcome("failed");
    } finally {
      setIsBusy(false);
    }
  }

  const outcomeError =
    outcome === "failed"
      ? viewData.failed
      : outcome === "revokeFailed"
        ? viewData.revokeFailed
        : "";

  return {
    dataSharingConsentWithdrawal: {
      viewData,
      hasConsent: currentPurposes.length > 0,
      statusMessage:
        outcome === "withdrawn"
          ? viewData.withdrawn
          : outcome === "withdrawnAndRevoked"
            ? viewData.withdrawnAndRevoked
            : "",
      errorMessage: [outcomeError, keyCleanupFailed ? partnerCopy.errors.generic : ""]
        .filter((message) => message.length > 0)
        .join(" "),
      isBusy,
    },
    handleWithdrawDataSharingConsent,
  };
}
