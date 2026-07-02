import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { getShellCopy } from "../../../i18n/shell-copy";
import { appStorage } from "../../../services/app-bootstrap-service";
import {
  createPlatformExportDeliveryClient,
  type ExportDeliveryClient,
} from "../../../services/export-delivery";
import type { ExportServiceDependencies } from "../../../services/export-service";
import type { LocalReminderScheduler } from "../../../services/local-reminder-scheduler-contract";
import { createPlatformLocalReminderScheduler } from "../../../services/platform-local-reminder-scheduler";
import { sanitizeExportDateInput } from "../../../services/export-policy";
import {
  formatLocalDate,
  parseLocalDate,
  sanitizeLocalDateInput,
} from "../../../services/profile-settings-policy";
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
import type { PartnerShareSecretStore } from "../../../security/partner-share-secret-store";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { partnerShareSecretStore as defaultPartnerShareSecretStore } from "../../../sync/app-partner-share-service";
import { syncSecretStore as defaultSyncSecretStore } from "../../../sync/app-sync-service";
import { openLeaveConfirmation } from "../../confirm/open-confirmation";
import { useRegisterTabLeaveGuard } from "../../navigation/TabLeaveGuardContext";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import type { SettingsFlowScreenProps } from "../SettingsFlowScreen";
import { runClearAllDataAction } from "./settings-screen-danger-actions";
import {
  runExportAction,
  runRefreshExportRangeAction,
} from "./settings-screen-export-actions";
import {
  runSavePendingSettingsAction,
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
  patchReminderValues,
  patchTrackingValues,
  removeRowMessage,
  replaceExportDraftValues,
  replaceInterfaceValues,
} from "./settings-screen-updaters";
import { useSettingsExitGuards } from "./useSettingsExitGuards";

type UseSettingsScreenControllerOptions = {
  exportDeliveryClient?: ExportDeliveryClient;
  exportServiceDependencies?: ExportServiceDependencies | undefined;
  now?: Date | undefined;
  partnerShareSecretStore?: PartnerShareSecretStore;
  reminderScheduler?: LocalReminderScheduler;
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore;
};

type SettingsScreenControllerResult = {
  accentColor: string;
  flowProps: SettingsFlowScreenProps | null;
  loadingDescription: string;
  loadingTitle: string;
};

export function useSettingsScreenController({
  exportDeliveryClient = createPlatformExportDeliveryClient(),
  exportServiceDependencies,
  now,
  partnerShareSecretStore = defaultPartnerShareSecretStore,
  reminderScheduler = createPlatformLocalReminderScheduler(),
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
  const router = useRouter();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingReminders, setIsSavingReminders] = useState(false);
  const [isSavingCycle, setIsSavingCycle] = useState(false);
  const [isSavingInterface, setIsSavingInterface] = useState(false);
  const [isSavingTracking, setIsSavingTracking] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [cycleDateDraftValue, setCycleDateDraftValue] = useState("");
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
  const [reminderStatusMessage, setReminderStatusMessage] = useState("");
  const [reminderStatusTone, setReminderStatusTone] = useState<
    "success" | "error" | "info"
  >("success");
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
  const shellCopy = useMemo(() => getShellCopy(language), [language]);
  const viewData = useMemo(
    () => buildSettingsViewData(effectiveNow, language),
    [effectiveNow, language],
  );
  const {
    hasUnsavedSettingsChanges,
    isCycleDirty,
    isInterfaceDirty,
    isReminderDirty,
    isTrackingDirty,
  } = buildSettingsDirtyState(state);
  const isSavingSettings =
    isSavingCycle || isSavingTracking || isSavingReminders || isSavingInterface;
  const hasBlockingUnsavedSettingsChanges =
    hasUnsavedSettingsChanges &&
    !isSavingCycle &&
    !isSavingTracking &&
    !isSavingReminders &&
    !isSavingInterface &&
    !isClearingData;

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
    setReminderStatusMessage("");
    setReminderStatusTone("success");
    setCycleErrorMessage("");
    setCycleStatusMessage("");
    setTrackingStatusMessage("");
    setCycleDateDraftValue("");
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

  function applyReminderUpdates(
    updates: Partial<LoadedSettingsState["reminderValues"]>,
  ) {
    setReminderStatusMessage("");
    setReminderStatusTone("success");
    setState((current) =>
      current ? patchReminderValues(current, updates) : current,
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
      setIsSavingReminders,
      setIsSavingCycle,
      setIsSavingInterface,
      setIsSavingTracking,
      setReminderStatusMessage,
      setReminderStatusTone,
      setState: commitState,
      setTrackingStatusMessage,
      reminderScheduler,
      partnerShareSecretStore,
      locale: language,
      storage,
      syncSecretStore,
      syncProfilePreferences,
      viewData,
    }),
    [
      effectiveNow,
      commitState,
      language,
      reminderScheduler,
      partnerShareSecretStore,
      storage,
      syncSecretStore,
      syncProfilePreferences,
      viewData,
    ],
  );

  const confirmPendingSettingsLeave = useCallback(async () => {
    if (!hasBlockingUnsavedSettingsChanges || state === null) {
      return true;
    }

    const outcome = await openLeaveConfirmation(
      viewData.interface.unsavedPrompt,
      viewData.interface.saveBeforeLeaveLabel,
      viewData.interface.discardChangesLabel,
      viewData.interface.keepEditingLabel,
    );

    if (outcome === "dismiss") {
      return false;
    }

    if (outcome === "reject") {
      revertUnsavedSettings();
      return true;
    }

    return runSavePendingSettingsAction(saveActionContext, state, {
      isCycleDirty,
      isInterfaceDirty,
      isReminderDirty,
      isTrackingDirty,
    });
  }, [
    hasBlockingUnsavedSettingsChanges,
    isCycleDirty,
    isInterfaceDirty,
    isReminderDirty,
    isTrackingDirty,
    revertUnsavedSettings,
    saveActionContext,
    state,
    viewData.interface.discardChangesLabel,
    viewData.interface.keepEditingLabel,
    viewData.interface.saveBeforeLeaveLabel,
    viewData.interface.unsavedPrompt,
  ]);

  const confirmPendingSettingsThen = useCallback(
    async (continueLeave: () => void) => {
      if (!hasBlockingUnsavedSettingsChanges || state === null) {
        continueLeave();
        return;
      }

      const canLeave = await confirmPendingSettingsLeave();
      if (canLeave) {
        requestAnimationFrame(continueLeave);
      }
    },
    [confirmPendingSettingsLeave, hasBlockingUnsavedSettingsChanges, state],
  );

  useRegisterTabLeaveGuard(
    "settings",
    hasBlockingUnsavedSettingsChanges ? confirmPendingSettingsLeave : null,
  );

  useSettingsExitGuards({
    enabled: hasBlockingUnsavedSettingsChanges,
    onConfirmLeave: confirmPendingSettingsThen,
  });

  if (isLoading || state === null) {
    return {
      accentColor: colors.accent,
      flowProps: null,
      loadingDescription: shellCopy.loading.settingsDescription,
      loadingTitle: shellCopy.loading.settingsTitle,
    };
  }

  const readyState = state;
  const cycleDateInputValue = showDatePicker
    ? cycleDateDraftValue
    : readyState.cycleValues.lastPeriodStart ?? "";
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
      cycleDateInputValue,
      cycleErrorMessage,
      cycleGuidance,
      cycleStatusMessage,
      exportErrorMessage,
      exportStatusMessage,
      hasUnsavedSettingsChanges,
      interfaceErrorMessage,
      interfaceStatusMessage,
      isClearingData,
      isExporting,
      isSavingSettings,
      locale: language,
      now: effectiveNow,
      reminderStatusMessage,
      reminderStatusTone,
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
        setShowDatePicker(false);
        setCycleDateDraftValue("");
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
      onCycleDateInputChange: (value) => {
        setCycleErrorMessage("");
        setCycleDateDraftValue(sanitizeLocalDateInput(value));
      },
      onDatePickerCancel: () => {
        setCycleErrorMessage("");
        setCycleDateDraftValue(readyState.cycleValues.lastPeriodStart ?? "");
        setShowDatePicker(false);
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
      onDatePickerConfirm: () => {
        const nextValue = cycleDateDraftValue.trim();
        const parsed = parseLocalDate(nextValue);
        const bounds = viewData.cycle.dateBounds;

        if (!parsed || nextValue < bounds.minDate || nextValue > bounds.maxDate) {
          setCycleErrorMessage(viewData.status.invalidLastPeriodStart);
          return;
        }

        applyCycleUpdates({ lastPeriodStart: nextValue });
        setShowDatePicker(false);
      },
      onDatePickerToggle: () => {
        setCycleErrorMessage("");
        setCycleDateDraftValue(readyState.cycleValues.lastPeriodStart ?? "");
        setShowDatePicker((current) => !current);
      },
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
      onDailyLogReminderChange: (value) => {
        applyReminderUpdates({ dailyLogReminderEnabled: value });
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
      onFertileWindowReminderChange: (value) => {
        applyReminderUpdates({ fertileWindowReminderEnabled: value });
      },
      onManagedReminderEmailsChange: (value) => {
        applyReminderUpdates({ managedReminderEmailsEnabled: value });
      },
      onHideNotesChange: (value) => {
        applyTrackingUpdates({ hideNotes: value }, { resetExportMessages: true });
      },
      onShowHistoricalPhasesChange: (value) => {
        applyTrackingUpdates(
          { showHistoricalPhases: value },
          { resetExportMessages: true },
        );
      },
      onHideCycleFactorsChange: (value) => {
        applyTrackingUpdates(
          { hideCycleFactors: value },
          { resetExportMessages: true },
        );
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
      onScreenCaptureProtectionChange: (value) => {
        applyInterfaceValues({
          ...readyState.interfaceValues,
          screenCaptureProtectionEnabled: value,
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
      onReminderTimeChange: (value) => {
        applyReminderUpdates({ reminderTime: value });
      },
      onSavePendingSettings: () => {
        void runSavePendingSettingsAction(saveActionContext, readyState, {
          isCycleDirty,
          isInterfaceDirty,
          isReminderDirty,
          isTrackingDirty,
        });
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
      onUpcomingPeriodReminderChange: (value) => {
        applyReminderUpdates({ upcomingPeriodReminderEnabled: value });
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
