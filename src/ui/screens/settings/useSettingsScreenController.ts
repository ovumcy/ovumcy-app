import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { getShellCopy } from "../../../i18n/shell-copy";
import { appStorage } from "../../../services/app-bootstrap-service";
import {
  createPlatformExportDeliveryClient,
  type ExportDeliveryClient,
} from "../../../services/export-delivery";
import type { ExportServiceDependencies } from "../../../services/export-service";
import { sanitizeExportDateInput } from "../../../services/export-policy";
import { formatLocalDate } from "../../../services/profile-settings-policy";
import { loadSettingsScreenState } from "../../../services/settings-state-service";
import {
  buildSettingsCycleGuidance,
  buildSettingsDirtyState,
  buildSettingsSyncSummary,
  buildSettingsViewData,
  revertLoadedSettingsDraftValues,
  type LoadedSettingsState,
} from "../../../services/settings-view-service";
import {
  createDefaultSymptomDraft,
  type SymptomDraftValues,
} from "../../../services/symptom-policy";
import type { SyncSecretStore } from "../../../security/sync-secret-store";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { syncSecretStore as defaultSyncSecretStore } from "../../../sync/app-sync-service";
import { openConfirmation } from "../../confirm/open-confirmation";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import type { SettingsFlowScreenProps } from "../SettingsFlowScreen";
import { runClearAllDataAction } from "./settings-screen-danger-actions";
import {
  runExportAction,
  runRefreshExportRangeAction,
} from "./settings-screen-export-actions";
import {
  runSaveCycleSettingsAction,
  runSaveInterfaceSettingsAction,
  runSavePendingSettingsAction,
  runSaveTrackingSettingsAction,
} from "./settings-screen-save-actions";
import {
  runArchiveSymptomAction,
  runCreateSymptomAction,
  runRestoreSymptomAction,
  runUpdateSymptomAction,
} from "./settings-screen-symptom-actions";
import {
  buildMergedRowSymptomDraft,
  hasCompleteExportDates,
  patchCycleValues,
  patchPredictionMode,
  patchTrackingValues,
  removeRowMessage,
  replaceExportDraftValues,
  replaceInterfaceValues,
} from "./settings-screen-updaters";

type UseSettingsScreenControllerOptions = {
  exportDeliveryClient?: ExportDeliveryClient;
  exportServiceDependencies?: ExportServiceDependencies | undefined;
  now?: Date | undefined;
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore;
};

type SettingsScreenControllerResult = {
  accentColor: string;
  flowProps: SettingsFlowScreenProps | null;
  loadingDescription: string;
  loadingTitle: string;
};

type ParentTabNavigation = {
  addListener: (
    eventName: "tabPress",
    callback: (event: { preventDefault: () => void; target?: string }) => void,
  ) => () => void;
  getState: () => {
    index: number;
    routes: {
      key: string;
      name: string;
      params?: Record<string, unknown> | undefined;
    }[];
  };
  navigate: (
    name: string,
    params?: Record<string, unknown> | undefined,
  ) => void;
};

export function useSettingsScreenController({
  exportDeliveryClient = createPlatformExportDeliveryClient(),
  exportServiceDependencies,
  now,
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
}: UseSettingsScreenControllerOptions): SettingsScreenControllerResult {
  const {
    clearPreferencePreview,
    colors,
    language,
    previewProfilePreferences,
    syncProfilePreferences,
  } = useAppPreferences();
  const navigation = useNavigation();
  const router = useRouter();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingCycle, setIsSavingCycle] = useState(false);
  const [isSavingInterface, setIsSavingInterface] = useState(false);
  const [isSavingTracking, setIsSavingTracking] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExportDatePicker, setShowExportDatePicker] = useState<"from" | "to" | null>(
    null,
  );
  const [state, setState] = useState<LoadedSettingsState | null>(null);
  const [cycleErrorMessage, setCycleErrorMessage] = useState("");
  const [cycleStatusMessage, setCycleStatusMessage] = useState("");
  const [clearDataConfirmationValue, setClearDataConfirmationValue] = useState("");
  const [clearDataErrorMessage, setClearDataErrorMessage] = useState("");
  const [clearDataStatusMessage, setClearDataStatusMessage] = useState("");
  const [exportErrorMessage, setExportErrorMessage] = useState("");
  const [exportStatusMessage, setExportStatusMessage] = useState("");
  const [interfaceErrorMessage, setInterfaceErrorMessage] = useState("");
  const [interfaceStatusMessage, setInterfaceStatusMessage] = useState("");
  const [trackingStatusMessage, setTrackingStatusMessage] = useState("");
  const [createSymptomDraft, setCreateSymptomDraft] = useState<SymptomDraftValues>(
    () => createDefaultSymptomDraft(),
  );
  const [createSymptomErrorMessage, setCreateSymptomErrorMessage] = useState("");
  const [createSymptomStatusMessage, setCreateSymptomStatusMessage] = useState("");
  const [rowSymptomDrafts, setRowSymptomDrafts] = useState<
    Record<string, SymptomDraftValues>
  >({});
  const [rowSymptomErrorMessages, setRowSymptomErrorMessages] = useState<
    Record<string, string>
  >({});
  const [rowSymptomStatusMessages, setRowSymptomStatusMessages] = useState<
    Record<string, string>
  >({});
  const shellCopy = getShellCopy(language);
  const viewData = buildSettingsViewData(effectiveNow, language);
  const {
    hasUnsavedSettingsChanges,
    isCycleDirty,
    isInterfaceDirty,
    isTrackingDirty,
  } = buildSettingsDirtyState(state);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void loadSettingsScreenState(storage, syncSecretStore, effectiveNow).then((loadedState) => {
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setIsLoading(false);
      });

      return () => {
        isMounted = false;
      };
    }, [effectiveNow, storage, syncSecretStore]),
  );

  const commitState = useCallback((nextState: LoadedSettingsState) => {
    setState(nextState);
  }, []);

  const revertUnsavedSettings = useCallback(() => {
    clearPreferencePreview();
    setInterfaceErrorMessage("");
    setInterfaceStatusMessage("");
    setCycleErrorMessage("");
    setCycleStatusMessage("");
    setTrackingStatusMessage("");
    setShowDatePicker(false);
    setShowExportDatePicker(null);
    setState((current) =>
      current ? revertLoadedSettingsDraftValues(current) : current,
    );
  }, [clearPreferencePreview]);

  function resetSymptomMessages() {
    setCreateSymptomErrorMessage("");
    setCreateSymptomStatusMessage("");
    setRowSymptomErrorMessages({});
    setRowSymptomStatusMessages({});
  }

  function resetExportMessages() {
    setExportErrorMessage("");
    setExportStatusMessage("");
  }

  function resetClearDataMessages() {
    setClearDataErrorMessage("");
    setClearDataStatusMessage("");
  }

  function applyCycleUpdates(
    updates: Partial<LoadedSettingsState["cycleValues"]>,
    options?: { resetExportMessages?: boolean },
  ) {
    setCycleErrorMessage("");
    setCycleStatusMessage("");
    if (options?.resetExportMessages) {
      resetExportMessages();
    }
    setState((current) =>
      current ? patchCycleValues(current, updates) : current,
    );
  }

  function applyTrackingUpdates(
    updates: Partial<LoadedSettingsState["trackingValues"]>,
    options?: { resetExportMessages?: boolean },
  ) {
    setTrackingStatusMessage("");
    if (options?.resetExportMessages) {
      resetExportMessages();
    }
    setState((current) =>
      current ? patchTrackingValues(current, updates) : current,
    );
  }

  function applyInterfaceValues(
    nextValues: LoadedSettingsState["interfaceValues"],
  ) {
    setInterfaceErrorMessage("");
    setInterfaceStatusMessage("");
    previewProfilePreferences(nextValues);
    setState((current) =>
      current ? replaceInterfaceValues(current, nextValues) : current,
    );
  }

  const saveActionContext = useMemo(
    () => ({
      effectiveNow,
      setCycleErrorMessage,
      setCycleStatusMessage,
      setInterfaceErrorMessage,
      setInterfaceStatusMessage,
      setIsSavingCycle,
      setIsSavingInterface,
      setIsSavingTracking,
      setState: commitState,
      setTrackingStatusMessage,
      storage,
      syncProfilePreferences,
      viewData,
    }),
    [effectiveNow, commitState, storage, syncProfilePreferences, viewData],
  );

  const confirmPendingSettingsThen = useCallback(
    async (continueLeave: () => void) => {
      const hasBlockingUnsavedChanges =
        hasUnsavedSettingsChanges &&
        !isSavingCycle &&
        !isSavingTracking &&
        !isSavingInterface &&
        !isClearingData;

      if (!hasBlockingUnsavedChanges || state === null) {
        continueLeave();
        return;
      }

      const shouldSave = await openConfirmation(
        viewData.interface.unsavedPrompt,
        viewData.interface.saveBeforeLeaveLabel,
        viewData.interface.discardChangesLabel,
      );

      if (!shouldSave) {
        revertUnsavedSettings();
        requestAnimationFrame(continueLeave);
        return;
      }

      const didSave = await runSavePendingSettingsAction(saveActionContext, state, {
        isCycleDirty,
        isInterfaceDirty,
        isTrackingDirty,
      });
      if (didSave) {
        requestAnimationFrame(continueLeave);
      }
    },
    [
      hasUnsavedSettingsChanges,
      isClearingData,
      isCycleDirty,
      isInterfaceDirty,
      isSavingCycle,
      isSavingInterface,
      isSavingTracking,
      isTrackingDirty,
      revertUnsavedSettings,
      saveActionContext,
      state,
      viewData.interface.discardChangesLabel,
      viewData.interface.saveBeforeLeaveLabel,
      viewData.interface.unsavedPrompt,
    ],
  );

  usePreventRemove(
    hasUnsavedSettingsChanges &&
      !isSavingCycle &&
      !isSavingTracking &&
      !isSavingInterface &&
      !isClearingData,
    ({ data }) => {
      void confirmPendingSettingsThen(() => {
        navigation.dispatch(data.action);
      });
    },
  );

  useEffect(() => {
    const parentNavigation = navigation.getParent() as ParentTabNavigation | undefined;
    if (!parentNavigation) {
      return;
    }

    return parentNavigation.addListener("tabPress", (event) => {
      const parentState = parentNavigation.getState();
      const currentRoute = parentState.routes[parentState.index];
      const targetRoute = parentState.routes.find((route) => route.key === event.target);

      if (!targetRoute || !currentRoute || targetRoute.key === currentRoute.key) {
        return;
      }

      event.preventDefault();
      void confirmPendingSettingsThen(() => {
        parentNavigation.navigate(targetRoute.name, targetRoute.params);
      });
    });
  }, [confirmPendingSettingsThen, navigation]);

  if (isLoading || state === null) {
    return {
      accentColor: colors.accent,
      flowProps: null,
      loadingDescription: shellCopy.loading.settingsDescription,
      loadingTitle: shellCopy.loading.settingsTitle,
    };
  }

  const readyState = state;
  const cycleGuidance = buildSettingsCycleGuidance(readyState.cycleValues);
  const syncSummary = buildSettingsSyncSummary(
    readyState,
    viewData.account,
    viewData.common.notSet,
    language,
  );

  const symptomActionContext = {
    createSymptomDraft,
    resetSymptomMessages,
    setCreateSymptomDraft,
    setCreateSymptomErrorMessage,
    setCreateSymptomStatusMessage,
    setRowSymptomDrafts,
    setRowSymptomErrorMessages,
    setRowSymptomStatusMessages,
    setState: commitState,
    storage,
    viewData,
  };

  const exportActionContext = {
    effectiveNow,
    exportDeliveryClient,
    exportServiceDependencies,
    resetExportMessages,
    setExportErrorMessage,
    setExportStatusMessage,
    setIsExporting,
    setState: commitState,
    storage,
    viewData,
  };

  const dangerActionContext = {
    clearDataConfirmationValue,
    resetClearDataMessages,
    router,
    setClearDataErrorMessage,
    setIsClearingData,
    storage,
    syncProfilePreferences,
    syncSecretStore,
    viewData,
  };

  return {
    accentColor: colors.accent,
    flowProps: {
      createSymptomDraft,
      createSymptomErrorMessage,
      createSymptomStatusMessage,
      clearDataConfirmationValue,
      clearDataErrorMessage,
      clearDataStatusMessage,
      cycleErrorMessage,
      cycleGuidance,
      cycleStatusMessage,
      exportErrorMessage,
      exportStatusMessage,
      interfaceErrorMessage,
      interfaceStatusMessage,
      isClearingData,
      isExporting,
      isSavingCycle,
      isSavingInterface,
      isSavingTracking,
      locale: language,
      now: effectiveNow,
      onAgeGroupSelect: (value) => {
        applyCycleUpdates({ ageGroup: value });
      },
      onArchiveSymptom: (symptomID) => {
        void runArchiveSymptomAction(symptomActionContext, readyState, symptomID);
      },
      onAutoPeriodFillChange: (value) => {
        applyCycleUpdates({ autoPeriodFill: value });
      },
      onClearAllData: () => {
        void runClearAllDataAction(dangerActionContext);
      },
      onClearDataConfirmationChange: (value) => {
        resetClearDataMessages();
        setClearDataConfirmationValue(value);
      },
      onClearLastPeriodStart: () => {
        applyCycleUpdates({ lastPeriodStart: null });
      },
      onCreateSymptom: () => {
        void runCreateSymptomAction(symptomActionContext, readyState);
      },
      onCreateSymptomDraftChange: (updates) => {
        setCreateSymptomErrorMessage("");
        setCreateSymptomStatusMessage("");
        setCreateSymptomDraft((current) => ({
          ...current,
          ...updates,
        }));
      },
      onCycleLengthChange: (value) => {
        applyCycleUpdates({ cycleLength: value });
      },
      onDatePickerChange: (event: DateTimePickerEvent, value: Date | undefined) => {
        if (event.type === "dismissed") {
          setShowDatePicker(false);
          return;
        }

        if (value) {
          applyCycleUpdates({ lastPeriodStart: formatLocalDate(value) });
        }

        setShowDatePicker(false);
      },
      onDatePickerToggle: () => setShowDatePicker((current) => !current),
      onExportCSV: () => {
        void runExportAction(exportActionContext, readyState, "csv");
      },
      onExportDatePickerChange: (
        event: DateTimePickerEvent,
        value: Date | undefined,
      ) => {
        if (event.type === "dismissed") {
          setShowExportDatePicker(null);
          return;
        }

        if (!value || !showExportDatePicker) {
          setShowExportDatePicker(null);
          return;
        }

        const nextDate = formatLocalDate(value);
        const nextValues: LoadedSettingsState["exportState"]["values"] = {
          ...readyState.exportState.values,
          preset: "custom",
          fromDate:
            showExportDatePicker === "from"
              ? nextDate
              : readyState.exportState.values.fromDate,
          toDate:
            showExportDatePicker === "to"
              ? nextDate
              : readyState.exportState.values.toDate,
        };
        setShowExportDatePicker(null);
        void runRefreshExportRangeAction(exportActionContext, readyState, nextValues);
      },
      onExportFromDateChange: (value) => {
        const sanitizedValue = sanitizeExportDateInput(value);
        const nextValues: LoadedSettingsState["exportState"]["values"] = {
          ...readyState.exportState.values,
          preset: "custom",
          fromDate: sanitizedValue,
        };
        resetExportMessages();
        setState((current) =>
          current ? replaceExportDraftValues(current, nextValues) : current,
        );
        if (hasCompleteExportDates(nextValues)) {
          void runRefreshExportRangeAction(exportActionContext, readyState, nextValues);
        }
      },
      onExportFromDatePress: () => {
        resetExportMessages();
        setShowExportDatePicker("from");
      },
      onExportJSON: () => {
        void runExportAction(exportActionContext, readyState, "json");
      },
      onExportPDF: () => {
        void runExportAction(exportActionContext, readyState, "pdf");
      },
      onExportPresetSelect: (value) => {
        setShowExportDatePicker(null);
        void runRefreshExportRangeAction(exportActionContext, readyState, {
          ...readyState.exportState.values,
          preset: value,
        });
      },
      onExportToDateChange: (value) => {
        const sanitizedValue = sanitizeExportDateInput(value);
        const nextValues: LoadedSettingsState["exportState"]["values"] = {
          ...readyState.exportState.values,
          preset: "custom",
          toDate: sanitizedValue,
        };
        resetExportMessages();
        setState((current) =>
          current ? replaceExportDraftValues(current, nextValues) : current,
        );
        if (hasCompleteExportDates(nextValues)) {
          void runRefreshExportRangeAction(exportActionContext, readyState, nextValues);
        }
      },
      onExportToDatePress: () => {
        resetExportMessages();
        setShowExportDatePicker("to");
      },
      onHideSexChipChange: (value) => {
        applyTrackingUpdates({ hideSexChip: value }, { resetExportMessages: true });
      },
      onInterfaceLanguageSelect: (value) => {
        applyInterfaceValues({
          ...readyState.interfaceValues,
          languageOverride: value,
        });
      },
      onInterfaceThemeSelect: (value) => {
        applyInterfaceValues({
          ...readyState.interfaceValues,
          themeOverride: value,
        });
      },
      onOpenBackupSync: () => {
        void confirmPendingSettingsThen(() => {
          void router.push("/backup-sync");
        });
      },
      onPeriodLengthChange: (value) => {
        applyCycleUpdates({ periodLength: value }, { resetExportMessages: true });
      },
      onPredictionModeSelect: (value) => {
        setCycleStatusMessage("");
        resetExportMessages();
        setState((current) =>
          current ? patchPredictionMode(current, value) : current,
        );
      },
      onRestoreSymptom: (symptomID) => {
        void runRestoreSymptomAction(symptomActionContext, readyState, symptomID);
      },
      onSaveCycleSettings: () => {
        void runSaveCycleSettingsAction(saveActionContext, readyState);
      },
      onSaveInterfaceSettings: () => {
        void runSaveInterfaceSettingsAction(saveActionContext, readyState);
      },
      onSaveTrackingSettings: () => {
        void runSaveTrackingSettingsAction(saveActionContext, readyState);
      },
      onSymptomDraftChange: (symptomID, updates) => {
        setRowSymptomErrorMessages((current) =>
          removeRowMessage(current, symptomID),
        );
        setRowSymptomStatusMessages((current) =>
          removeRowMessage(current, symptomID),
        );
        setRowSymptomDrafts((current) =>
          buildMergedRowSymptomDraft(readyState, current, symptomID, updates),
        );
      },
      onTemperatureUnitSelect: (value) => {
        applyTrackingUpdates(
          { temperatureUnit: value },
          { resetExportMessages: true },
        );
      },
      onTrackBBTChange: (value) => {
        applyTrackingUpdates({ trackBBT: value }, { resetExportMessages: true });
      },
      onTrackCervicalMucusChange: (value) => {
        applyTrackingUpdates(
          { trackCervicalMucus: value },
          { resetExportMessages: true },
        );
      },
      onUpdateSymptom: (symptomID) => {
        void runUpdateSymptomAction(
          symptomActionContext,
          readyState,
          rowSymptomDrafts,
          symptomID,
        );
      },
      onUsageGoalSelect: (value) => {
        applyCycleUpdates({ usageGoal: value });
      },
      rowSymptomDrafts,
      rowSymptomErrorMessages,
      rowSymptomStatusMessages,
      showDatePicker,
      showExportDatePicker,
      state: readyState,
      syncSummary,
      trackingStatusMessage,
      viewData,
    },
    loadingDescription: shellCopy.loading.settingsDescription,
    loadingTitle: shellCopy.loading.settingsTitle,
  };
}
