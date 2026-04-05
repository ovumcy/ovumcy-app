import type { InterfaceSettingsValues } from "../../../models/profile";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import {
  saveReminderSettings,
  saveCycleSettings,
  saveInterfaceSettings,
  saveTrackingSettings,
} from "../../../services/settings-screen-service";
import {
  syncReminderDeliveryState,
  type ReminderDeliverySyncResult,
} from "../../../services/local-reminder-sync-service";
import type { LocalReminderScheduler } from "../../../services/local-reminder-scheduler-contract";
import type {
  LoadedSettingsState,
  SettingsViewData,
} from "../../../services/settings-view-service";
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

export async function runSaveCycleSettingsAction(
  context: SaveSettingsActionContext,
  readyState: LoadedSettingsState,
) {
  const {
    effectiveNow,
    setCycleErrorMessage,
    setCycleStatusMessage,
    setIsSavingCycle,
    setState,
    storage,
    viewData,
  } = context;

  setIsSavingCycle(true);
  setCycleErrorMessage("");
  setCycleStatusMessage("");

  const result = await saveCycleSettings(
    storage,
    readyState,
    readyState.cycleValues,
    effectiveNow,
  );
  if (!result.ok) {
    setCycleErrorMessage(
      result.errorCode === "invalid_last_period_start"
        ? viewData.status.invalidLastPeriodStart
        : result.errorCode === "invalid_cycle_settings"
          ? viewData.cycle.messages.errorIncompatible
          : viewData.status.saveFailed,
    );
    setIsSavingCycle(false);
    return;
  }

  setState(result.state);
  setCycleStatusMessage(viewData.status.cycleSaved);
  setIsSavingCycle(false);
}

export async function runSaveTrackingSettingsAction(
  context: SaveSettingsActionContext,
  readyState: LoadedSettingsState,
) {
  const {
    setIsSavingTracking,
    setState,
    setTrackingStatusMessage,
    storage,
    viewData,
  } = context;

  setIsSavingTracking(true);
  setTrackingStatusMessage("");

  const result = await saveTrackingSettings(
    storage,
    readyState,
    readyState.trackingValues,
  );
  if (!result.ok) {
    setTrackingStatusMessage(viewData.status.saveFailed);
    setIsSavingTracking(false);
    return;
  }

  setState(result.state);
  setTrackingStatusMessage(viewData.status.trackingSaved);
  setIsSavingTracking(false);
}

export async function runSaveReminderSettingsAction(
  context: SaveSettingsActionContext,
  readyState: LoadedSettingsState,
) {
  const {
    effectiveNow,
    locale,
    reminderScheduler,
    setIsSavingReminders,
    setReminderStatusMessage,
    setReminderStatusTone,
    setState,
    storage,
    syncSecretStore,
    viewData,
  } = context;

  setIsSavingReminders(true);
  setReminderStatusMessage("");
  setReminderStatusTone("success");

  const result = await saveReminderSettings(
    storage,
    readyState,
    readyState.reminderValues,
  );
  if (!result.ok) {
    setReminderStatusMessage(
      result.errorCode === "invalid_reminder_time"
        ? viewData.reminders.errors.invalidTime
        : viewData.reminders.errors.saveFailed,
    );
    setReminderStatusTone("error");
    setIsSavingReminders(false);
    return;
  }

  const syncResult = await syncReminderDeliveryState(
    storage,
    syncSecretStore,
    reminderScheduler,
    result.state.profile,
    {
      locale,
      now: effectiveNow,
    },
  );

  setState(result.state);
  setReminderStatusMessage(resolveReminderStatusMessage(syncResult, viewData));
  setReminderStatusTone(resolveReminderStatusTone(syncResult));
  setIsSavingReminders(false);
}

export async function runSaveInterfaceSettingsAction(
  context: SaveSettingsActionContext,
  readyState: LoadedSettingsState,
) {
  const {
    setInterfaceErrorMessage,
    setInterfaceStatusMessage,
    setIsSavingInterface,
    setState,
    storage,
    syncProfilePreferences,
    viewData,
  } = context;

  setIsSavingInterface(true);
  setInterfaceErrorMessage("");
  setInterfaceStatusMessage("");

  const result = await saveInterfaceSettings(
    storage,
    readyState,
    readyState.interfaceValues,
  );
  if (!result.ok) {
    setInterfaceErrorMessage(viewData.status.saveFailed);
    setIsSavingInterface(false);
    return false;
  }

  setState(result.state);
  syncProfilePreferences(result.state.interfaceValues);
  setInterfaceStatusMessage(viewData.interface.status.saved);
  setIsSavingInterface(false);
  return true;
}

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
    const reminderSyncResult = await syncReminderDeliveryState(
      storage,
      syncSecretStore,
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
  result:
    | ReminderDeliverySyncResult
    | { local: "disabled"; email: "disabled" },
  viewData: SettingsViewData,
): string {
  switch (result.local) {
    case "permission_denied":
      return viewData.reminders.status.permissionDenied;
    case "unavailable":
      return viewData.reminders.status.unavailable;
    default:
      break;
  }

  switch (result.email) {
    case "synced":
      return viewData.reminders.status.savedWithEmail;
    case "unavailable":
      return viewData.reminders.status.emailUnavailable;
    case "failed":
    case "unauthorized":
      return viewData.reminders.status.emailSyncFailed;
    default:
      return viewData.reminders.status.saved;
  }
}

function resolveReminderStatusTone(
  result:
    | ReminderDeliverySyncResult
    | { local: "disabled"; email: "disabled" },
): "success" | "error" | "info" {
  switch (result.local) {
    case "permission_denied":
      return "error";
    case "unavailable":
      return "info";
    default:
      break;
  }

  switch (result.email) {
    case "unavailable":
      return "info";
    case "failed":
    case "unauthorized":
      return "error";
    default:
      return "success";
  }
}
