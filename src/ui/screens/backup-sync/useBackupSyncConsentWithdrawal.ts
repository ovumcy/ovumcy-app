import { useEffect, useRef, useState } from "react";

import {
  buildDataSharingConsentWithdrawalViewData,
  loadCurrentDataSharingConsentPurposes,
  withdrawAllDataSharingConsent,
} from "../../../services/data-sharing-consent-service";
import type { DataSharingConsentPurpose } from "../../../sync/sync-contract";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

type WithdrawalOutcome = "none" | "withdrawn" | "failed";

/**
 * Standalone withdrawal of the data-sharing consent: one tap, no confirm, as
 * easy as the single tap that gave it. Withdrawing is local only; the send
 * gates refuse until the user agrees again.
 */
export function useBackupSyncConsentWithdrawal(core: BackupSyncSessionCore) {
  const {
    dataSharingConsentChangeCount,
    language,
    partnerOverview,
    state,
    storage,
  } = core;
  const [currentPurposes, setCurrentPurposes] = useState<
    DataSharingConsentPurpose[]
  >([]);
  const [outcome, setOutcome] = useState<WithdrawalOutcome>("none");
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
        }
      },
      () => undefined,
    );
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [dataSharingConsentChangeCount, partnerOverview, state, storage]);

  async function handleWithdrawDataSharingConsent() {
    if (isBusy) {
      return;
    }
    loadSequenceRef.current += 1;
    setIsBusy(true);
    setOutcome("none");
    try {
      await withdrawAllDataSharingConsent(storage);
      // A load started while the write was in flight may have read it unwritten.
      loadSequenceRef.current += 1;
      setCurrentPurposes([]);
      setOutcome("withdrawn");
    } catch {
      setOutcome("failed");
    } finally {
      setIsBusy(false);
    }
  }

  return {
    dataSharingConsentWithdrawal: {
      viewData,
      hasConsent: currentPurposes.length > 0,
      statusMessage: outcome === "withdrawn" ? viewData.withdrawn : "",
      errorMessage: outcome === "failed" ? viewData.failed : "",
      isBusy,
    },
    handleWithdrawDataSharingConsent,
  };
}
