import { useEffect, useState } from "react";

import {
  buildDataSharingConsentWithdrawalViewData,
  loadCurrentDataSharingConsentPurposes,
  withdrawAllDataSharingConsent,
} from "../../../services/data-sharing-consent-service";
import type { DataSharingConsentPurpose } from "../../../sync/sync-contract";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";

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
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
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
    let isMounted = true;
    loadCurrentDataSharingConsentPurposes(storage).then(
      (purposes) => {
        if (!isMounted) {
          return;
        }
        setCurrentPurposes(purposes);
        if (purposes.length > 0) {
          setStatusMessage("");
        }
      },
      () => undefined,
    );
    return () => {
      isMounted = false;
    };
  }, [dataSharingConsentChangeCount, partnerOverview, state, storage]);

  async function handleWithdrawDataSharingConsent() {
    if (isBusy) {
      return;
    }
    setIsBusy(true);
    setStatusMessage("");
    setErrorMessage("");
    try {
      await withdrawAllDataSharingConsent(storage);
      setCurrentPurposes([]);
      setStatusMessage(viewData.withdrawn);
    } catch {
      setErrorMessage(viewData.failed);
    } finally {
      setIsBusy(false);
    }
  }

  return {
    dataSharingConsentWithdrawal: {
      viewData,
      hasConsent: currentPurposes.length > 0,
      statusMessage,
      errorMessage,
      isBusy,
    },
    handleWithdrawDataSharingConsent,
  };
}
