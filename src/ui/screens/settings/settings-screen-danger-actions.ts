import {
  DEFAULT_WEEK_START_DAY,
  type InterfaceSettingsValues,
} from "../../../models/profile";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import type { SyncSecretStore } from "../../../security/sync-secret-store";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import {
  clearAllLocalSettingsData,
  isClearLocalDataConfirmationValid,
} from "../../../services/settings-danger-zone-service";
import type { SettingsViewData } from "../../../services/settings-view-service";

type DangerActionContext = {
  clearDataConfirmationValue: string;
  resetClearDataMessages: () => void;
  router: {
    replace: (value: "/onboarding" | `/onboarding?reset=${string}`) => void;
  };
  setClearDataErrorMessage: (value: string) => void;
  setIsClearingData: (value: boolean) => void;
  storage: LocalAppStorage;
  syncProfilePreferences: (profile: InterfaceSettingsValues) => void;
  syncSecretStore: SyncSecretStore;
  viewData: SettingsViewData;
};

export async function runClearAllDataAction(context: DangerActionContext) {
  const {
    clearDataConfirmationValue,
    resetClearDataMessages,
    router,
    setClearDataErrorMessage,
    setIsClearingData,
    storage,
    syncProfilePreferences,
    syncSecretStore,
    viewData,
  } = context;

  resetClearDataMessages();

  if (!isClearLocalDataConfirmationValid(clearDataConfirmationValue)) {
    setClearDataErrorMessage(viewData.danger.status.invalidConfirmation);
    return;
  }

  const challengeResult = await requestSensitiveActionChallenge(
    viewData.danger.deviceAuthPrompt,
    {
      allowWebBypass: true,
    },
  );
  if (!challengeResult.ok) {
    if (challengeResult.reason === "unavailable") {
      setClearDataErrorMessage(viewData.danger.status.deviceAuthUnavailable);
    } else if (challengeResult.reason === "failed") {
      setClearDataErrorMessage(viewData.danger.status.deviceAuthFailed);
    }
    return;
  }

  setIsClearingData(true);

  const result = await clearAllLocalSettingsData(storage, syncSecretStore);
  if (!result.ok) {
    setClearDataErrorMessage(viewData.danger.status.failed);
    setIsClearingData(false);
    return;
  }

  syncProfilePreferences({
    languageOverride: null,
    themeOverride: null,
    firstDayOfWeek: DEFAULT_WEEK_START_DAY,
    screenCaptureProtectionEnabled: true,
  });
  router.replace(`/onboarding?reset=${Date.now().toString()}`);
}
