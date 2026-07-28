import type { InterfaceSettingsValues } from "../../../models/profile";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import {
  saveReminderSettings,
  saveCycleSettings,
  saveInterfaceSettings,
  saveTrackingSettings,
} from "../../../services/settings-screen-service";
import {
  syncLocalReminderSchedule,
  type LocalReminderSyncResult,
} from "../../../services/local-reminder-sync-service";
import { syncManagedPartnerSharedProjections } from "../../../services/managed-partner-share-sync-service";
import type { LocalReminderScheduler } from "../../../services/local-reminder-scheduler-contract";
import type {
  LoadedSettingsState,
  SettingsViewData,
} from "../../../services/settings-view-service";
import type { PartnerShareSecretStore } from "../../../security/partner-share-secret-store";
import type { SyncSecretStore } from "../../../security/sync-secret-store";

type SaveSettingsActionContext = {
  effectiveNow: Date;
  setCycleErrorMessage: (value: string) => void;
  setCycleStatusMessage: (value: string) => void;
  setInterfaceErrorMessage: (value: string) => void;
  setInterfaceStatusMessage: (value: string) => void;
  setIsSavingReminders: (value: boolean) => void;
  setIsSavingCycle: (value: boolean) => void;
  setIsSavingInterface: (value: boolean) => void;
  setIsSavingTracking: (value: boolean) => void;
  setReminderStatusMessage: (value: string) => void;
  setReminderStatusTone: (value: "success" | "error" | "info") => void;
  setState: (value: LoadedSettingsState) => void;
  setTrackingStatusMessage: (value: string) => void;
  reminderScheduler: LocalReminderScheduler;
  locale: string;
  partnerShareSecretStore: PartnerShareSecretStore;
  storage: LocalAppStorage;
  syncSecretStore: SyncSecretStore;
  syncProfilePreferences: (profile: InterfaceSettingsValues) => void;
  viewData: SettingsViewData;
};

type SavePendingSettingsActionOptions = {
  isCycleDirty: boolean;
  isReminderDirty: boolean;
  isInterfaceDirty: boolean;
  isTrackingDirty: boolean;
};

export async function runSavePendingSettingsAction(
  context: SaveSettingsActionContext,
  readyState: LoadedSettingsState,
  options: SavePendingSettingsActionOptions,
) {
  const {
    effectiveNow,
    locale,
    reminderScheduler,
    setCycleErrorMessage,
    setCycleStatusMessage,
    setInterfaceErrorMessage,
    setInterfaceStatusMessage,
    setIsSavingReminders,
    setIsSavingCycle,
    setIsSavingInterface,
    setIsSavingTracking,
    setReminderStatusMessage,
    setReminderStatusTone,
    setState,
    setTrackingStatusMessage,
    partnerShareSecretStore,
    storage,
    syncSecretStore,
    syncProfilePreferences,
    viewData,
  } = context;
  const { isCycleDirty, isReminderDirty, isInterfaceDirty, isTrackingDirty } =
    options;
  let nextState = readyState;

  if (isCycleDirty) {
    setIsSavingCycle(true);
    setCycleErrorMessage("");
    setCycleStatusMessage("");
    const cycleResult = await saveCycleSettings(
      storage,
      nextState,
      nextState.cycleValues,
      effectiveNow,
    );
    setIsSavingCycle(false);
    if (!cycleResult.ok) {
      setCycleErrorMessage(
        cycleResult.errorCode === "invalid_last_period_start"
          ? viewData.status.invalidLastPeriodStart
          : cycleResult.errorCode === "invalid_cycle_settings"
            ? viewData.cycle.messages.errorIncompatible
            : viewData.status.saveFailed,
      );
      setState(nextState);
      return false;
    }
    nextState = cycleResult.state;
    setCycleStatusMessage(viewData.status.cycleSaved);
    await syncManagedPartnerSharedProjections(
      storage,
      syncSecretStore,
      partnerShareSecretStore,
      effectiveNow,
    );
  }

  if (isTrackingDirty) {
    setIsSavingTracking(true);
    setTrackingStatusMessage("");
    const trackingResult = await saveTrackingSettings(
      storage,
      nextState,
      nextState.trackingValues,
    );
    setIsSavingTracking(false);
    if (!trackingResult.ok) {
      setTrackingStatusMessage(viewData.status.saveFailed);
      setState(nextState);
      return false;
    }
    nextState = trackingResult.state;
    setTrackingStatusMessage(viewData.status.trackingSaved);
    await syncManagedPartnerSharedProjections(
      storage,
      syncSecretStore,
      partnerShareSecretStore,
      effectiveNow,
    );
  }

  if (isReminderDirty) {
    setIsSavingReminders(true);
    setReminderStatusMessage("");
    setReminderStatusTone("success");
    const reminderResult = await saveReminderSettings(
      storage,
      nextState,
      nextState.reminderValues,
    );
    setIsSavingReminders(false);
    if (!reminderResult.ok) {
      setReminderStatusMessage(
        reminderResult.errorCode === "invalid_reminder_time"
          ? viewData.reminders.errors.invalidTime
          : viewData.reminders.errors.saveFailed,
      );
      setReminderStatusTone("error");
      setState(nextState);
      return false;
    }
    nextState = reminderResult.state;
  }

  if (isInterfaceDirty) {
    setIsSavingInterface(true);
    setInterfaceErrorMessage("");
    setInterfaceStatusMessage("");
    const interfaceResult = await saveInterfaceSettings(
      storage,
      nextState,
      nextState.interfaceValues,
    );
    setIsSavingInterface(false);
    if (!interfaceResult.ok) {
      setInterfaceErrorMessage(viewData.status.saveFailed);
      setState(nextState);
      return false;
    }
    nextState = interfaceResult.state;
    syncProfilePreferences(interfaceResult.state.interfaceValues);
    setInterfaceStatusMessage(viewData.interface.status.saved);
  }

  if (isCycleDirty || isReminderDirty) {
    const reminderSyncResult = await syncLocalReminderSchedule(
      storage,
      reminderScheduler,
      nextState.profile,
      {
        locale,
        now: effectiveNow,
      },
    );
    if (isReminderDirty) {
      setReminderStatusMessage(
        resolveReminderStatusMessage(reminderSyncResult, viewData),
      );
      setReminderStatusTone(resolveReminderStatusTone(reminderSyncResult));
    }
  }

  setState(nextState);
  return true;
}

function resolveReminderStatusMessage(
  result: LocalReminderSyncResult,
  viewData: SettingsViewData,
): string {
  switch (result) {
    case "permission_denied":
      return viewData.reminders.status.permissionDenied;
    case "unavailable":
      return viewData.reminders.status.unavailable;
    default:
      return viewData.reminders.status.saved;
  }
}

function resolveReminderStatusTone(
  result: LocalReminderSyncResult,
): "success" | "error" | "info" {
  switch (result) {
    case "permission_denied":
      return "error";
    case "unavailable":
      return "info";
    default:
      return "success";
  }
}
