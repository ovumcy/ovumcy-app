import type { InterfaceSettingsValues } from "../../../models/profile";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import {
  saveCycleSettings,
  saveInterfaceSettings,
  saveTrackingSettings,
} from "../../../services/settings-screen-service";
import type {
  LoadedSettingsState,
  SettingsViewData,
} from "../../../services/settings-view-service";

type SaveSettingsActionContext = {
  effectiveNow: Date;
  setCycleErrorMessage: (value: string) => void;
  setCycleStatusMessage: (value: string) => void;
  setInterfaceErrorMessage: (value: string) => void;
  setInterfaceStatusMessage: (value: string) => void;
  setIsSavingCycle: (value: boolean) => void;
  setIsSavingInterface: (value: boolean) => void;
  setIsSavingTracking: (value: boolean) => void;
  setState: (value: LoadedSettingsState) => void;
  setTrackingStatusMessage: (value: string) => void;
  storage: LocalAppStorage;
  syncProfilePreferences: (profile: InterfaceSettingsValues) => void;
  viewData: SettingsViewData;
};

type SavePendingSettingsActionOptions = {
  isCycleDirty: boolean;
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
    setCycleErrorMessage,
    setCycleStatusMessage,
    setInterfaceErrorMessage,
    setInterfaceStatusMessage,
    setIsSavingCycle,
    setIsSavingInterface,
    setIsSavingTracking,
    setState,
    setTrackingStatusMessage,
    storage,
    syncProfilePreferences,
    viewData,
  } = context;
  const { isCycleDirty, isInterfaceDirty, isTrackingDirty } = options;
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

  setState(nextState);
  return true;
}
