import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getShellCopy } from "../../i18n/shell-copy";
import { appStorage } from "../../services/app-bootstrap-service";
import { syncSecretStore as defaultSyncSecretStore } from "../../services/app-sync-service";
import {
  createPlatformExportDeliveryClient,
  type ExportDeliveryClient,
} from "../../services/export-delivery";
import type { ExportServiceDependencies } from "../../services/export-service";
import {
  archiveSettingsSymptom,
  createSettingsSymptom,
  loadSettingsScreenState,
  prepareSettingsExportArtifact,
  prepareSettingsSyncSetup,
  refreshSettingsExportState,
  restoreSettingsSymptom,
  saveCycleSettings,
  saveInterfaceSettings,
  saveTrackingSettings,
  updateSettingsSymptom,
} from "../../services/settings-screen-service";
import {
  clearAllLocalSettingsData,
  isClearLocalDataConfirmationValid,
} from "../../services/settings-danger-zone-service";
import {
  buildSettingsCycleGuidance,
  buildSettingsViewData,
  type LoadedSettingsState,
} from "../../services/settings-view-service";
import { formatLocalDate } from "../../services/profile-settings-policy";
import {
  createDefaultSymptomDraft,
  type SymptomDraftValues,
} from "../../services/symptom-policy";
import type { SymptomID } from "../../models/symptom";
import type { SyncSecretStore } from "../../security/sync-secret-store";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { SettingsFlowScreen } from "./SettingsFlowScreen";

type SettingsScreenProps = {
  exportDeliveryClient?: ExportDeliveryClient;
  exportServiceDependencies?: ExportServiceDependencies;
  storage?: LocalAppStorage;
  syncSecretStore?: SyncSecretStore;
  now?: Date;
};

export function SettingsScreen({
  exportDeliveryClient = createPlatformExportDeliveryClient(),
  exportServiceDependencies,
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
  now,
}: SettingsScreenProps) {
  const {
    colors,
    language,
    refreshPreferences,
    syncProfilePreferences,
  } = useAppPreferences();
  const router = useRouter();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingCycle, setIsSavingCycle] = useState(false);
  const [isSavingInterface, setIsSavingInterface] = useState(false);
  const [isSavingTracking, setIsSavingTracking] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [state, setState] = useState<LoadedSettingsState | null>(null);
  const [cycleErrorMessage, setCycleErrorMessage] = useState("");
  const [cycleStatusMessage, setCycleStatusMessage] = useState("");
  const [clearDataConfirmationValue, setClearDataConfirmationValue] = useState("");
  const [clearDataErrorMessage, setClearDataErrorMessage] = useState("");
  const [clearDataStatusMessage, setClearDataStatusMessage] = useState("");
  const [accountErrorMessage, setAccountErrorMessage] = useState("");
  const [accountStatusMessage, setAccountStatusMessage] = useState("");
  const [exportErrorMessage, setExportErrorMessage] = useState("");
  const [exportStatusMessage, setExportStatusMessage] = useState("");
  const [generatedRecoveryPhrase, setGeneratedRecoveryPhrase] = useState("");
  const [interfaceErrorMessage, setInterfaceErrorMessage] = useState("");
  const [interfaceStatusMessage, setInterfaceStatusMessage] = useState("");
  const [isPreparingSync, setIsPreparingSync] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void loadSettingsScreenState(storage, syncSecretStore, effectiveNow).then((loadedState) => {
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setGeneratedRecoveryPhrase("");
        setIsLoading(false);
      });

      return () => {
        isMounted = false;
      };
    }, [effectiveNow, storage, syncSecretStore]),
  );

  if (isLoading || !state) {
    return (
      <ScreenScaffold
        title={shellCopy.loading.settingsTitle}
        description={shellCopy.loading.settingsDescription}
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  const readyState = state;
  const viewData = buildSettingsViewData(effectiveNow, language);
  const cycleGuidance = buildSettingsCycleGuidance(readyState.cycleValues);

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

  function resetAccountMessages() {
    setAccountErrorMessage("");
    setAccountStatusMessage("");
    setGeneratedRecoveryPhrase("");
  }

  function resetClearDataMessages() {
    setClearDataErrorMessage("");
    setClearDataStatusMessage("");
  }

  function symptomErrorMessage(errorCode: string) {
    switch (errorCode) {
      case "label_required":
        return viewData.symptoms.errors.labelRequired;
      case "label_too_long":
        return viewData.symptoms.errors.labelTooLong;
      case "label_invalid_characters":
        return viewData.symptoms.errors.labelInvalidCharacters;
      case "duplicate_label":
        return viewData.symptoms.errors.duplicateLabel;
      case "not_found":
      case "builtin_edit_forbidden":
        return viewData.symptoms.errors.notFound;
      default:
        return viewData.symptoms.errors.saveFailed;
    }
  }

  function exportErrorLabel(errorCode: string) {
    switch (errorCode) {
      case "invalid_from_date":
        return viewData.export.errors.invalidFromDate;
      case "invalid_to_date":
        return viewData.export.errors.invalidToDate;
      case "invalid_range":
        return viewData.export.errors.invalidRange;
      case "delivery_unavailable":
        return viewData.export.errors.deliveryUnavailable;
      case "delivery_failed":
        return viewData.export.errors.deliveryFailed;
      default:
        return viewData.export.errors.exportFailed;
    }
  }

  function syncErrorLabel(errorCode: string) {
    switch (errorCode) {
      case "device_label_required":
        return viewData.account.errors.deviceLabelRequired;
      case "endpoint_required":
        return viewData.account.errors.endpointRequired;
      case "invalid_endpoint":
        return viewData.account.errors.invalidEndpoint;
      case "unsupported_scheme":
        return viewData.account.errors.unsupportedScheme;
      case "insecure_public_http":
        return viewData.account.errors.insecurePublicHttp;
      default:
        return viewData.account.errors.saveFailed;
    }
  }

  async function handleSaveCycleSettings() {
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

  async function handleSaveTrackingSettings() {
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

  async function handleSaveInterfaceSettings() {
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
      return;
    }

    setState(result.state);
    syncProfilePreferences(result.state.profile);
    setInterfaceStatusMessage(viewData.interface.status.saved);
    setIsSavingInterface(false);
  }

  async function handlePrepareSyncSetup() {
    resetAccountMessages();
    setIsPreparingSync(true);

    const result = await prepareSettingsSyncSetup(
      storage,
      syncSecretStore,
      readyState,
      effectiveNow,
    );
    if (!result.ok) {
      setAccountErrorMessage(syncErrorLabel(result.errorCode));
      setIsPreparingSync(false);
      return;
    }

    setState(result.state);
    setGeneratedRecoveryPhrase(result.recoveryPhrase);
    setAccountStatusMessage(
      result.regenerated
        ? viewData.account.status.regenerated
        : viewData.account.status.prepared,
    );
    setIsPreparingSync(false);
  }

  async function handleCreateSymptom() {
    resetSymptomMessages();

    const result = await createSettingsSymptom(storage, readyState, createSymptomDraft);
    if (!result.ok) {
      setCreateSymptomErrorMessage(symptomErrorMessage(result.errorCode));
      return;
    }

    setState(result.state);
    setCreateSymptomDraft(createDefaultSymptomDraft());
    setCreateSymptomStatusMessage(viewData.symptoms.status.created);
  }

  async function handleUpdateSymptom(symptomID: SymptomID) {
    resetSymptomMessages();
    const currentRecord = readyState.symptomRecords.find(
      (record) => record.id === symptomID,
    );
    if (!currentRecord) {
      setRowSymptomErrorMessages({
        [symptomID]: viewData.symptoms.errors.notFound,
      });
      return;
    }

    const payload: SymptomDraftValues = rowSymptomDrafts[symptomID] ?? {
      label: currentRecord.label,
      icon: currentRecord.icon,
    };

    const result = await updateSettingsSymptom(storage, readyState, symptomID, payload);
    if (!result.ok) {
      setRowSymptomErrorMessages({
        [symptomID]: symptomErrorMessage(result.errorCode),
      });
      return;
    }

    setState(result.state);
    setRowSymptomDrafts((current) => {
      const next = { ...current };
      delete next[symptomID];
      return next;
    });
    setRowSymptomStatusMessages({
      [symptomID]: viewData.symptoms.status.updated,
    });
  }

  async function handleArchiveSymptom(symptomID: SymptomID) {
    resetSymptomMessages();
    const result = await archiveSettingsSymptom(storage, readyState, symptomID);
    if (!result.ok) {
      setRowSymptomErrorMessages({
        [symptomID]: symptomErrorMessage(result.errorCode),
      });
      return;
    }

    setState(result.state);
    setRowSymptomStatusMessages({
      [symptomID]: viewData.symptoms.status.archived,
    });
  }

  async function handleRestoreSymptom(symptomID: SymptomID) {
    resetSymptomMessages();
    const result = await restoreSettingsSymptom(storage, readyState, symptomID);
    if (!result.ok) {
      setRowSymptomErrorMessages({
        [symptomID]: symptomErrorMessage(result.errorCode),
      });
      return;
    }

    setState(result.state);
    setRowSymptomStatusMessages({
      [symptomID]: viewData.symptoms.status.restored,
    });
  }

  async function handleExportRangeChange(
    nextValues: LoadedSettingsState["exportState"]["values"],
  ) {
    resetExportMessages();
    const result = await refreshSettingsExportState(
      storage,
      readyState,
      nextValues,
      effectiveNow,
    );
    setState(result.state);
    if (!result.ok) {
      setExportErrorMessage(exportErrorLabel(result.errorCode));
    }
  }

  async function handleExport(format: "csv" | "json" | "pdf") {
    resetExportMessages();
    setIsExporting(true);

    const result = await prepareSettingsExportArtifact(
      storage,
      readyState,
      format,
      effectiveNow,
      exportServiceDependencies,
    );
    setState(result.state);
    if (!result.ok) {
      setExportErrorMessage(exportErrorLabel(result.errorCode));
      setIsExporting(false);
      return;
    }

    const deliveryResult = await exportDeliveryClient.deliver(result.artifact);
    if (!deliveryResult.ok) {
      setExportErrorMessage(exportErrorLabel(deliveryResult.errorCode));
      setIsExporting(false);
      return;
    }

    setExportStatusMessage(
      format === "json"
        ? viewData.export.status.jsonReady
        : format === "pdf"
          ? viewData.export.status.pdfReady
          : viewData.export.status.csvReady,
    );
    setIsExporting(false);
  }

  async function handleClearAllData() {
    resetClearDataMessages();

    if (!isClearLocalDataConfirmationValid(clearDataConfirmationValue)) {
      setClearDataErrorMessage(viewData.danger.status.invalidConfirmation);
      return;
    }

    setIsClearingData(true);

    const result = await clearAllLocalSettingsData(storage, syncSecretStore);
    if (!result.ok) {
      setClearDataErrorMessage(viewData.danger.status.failed);
      setIsClearingData(false);
      return;
    }

    setClearDataStatusMessage(viewData.danger.status.success);
    setState(null);
    setCreateSymptomDraft(createDefaultSymptomDraft());
    setCreateSymptomErrorMessage("");
    setCreateSymptomStatusMessage("");
    setRowSymptomDrafts({});
    setRowSymptomErrorMessages({});
    setRowSymptomStatusMessages({});
    setCycleErrorMessage("");
    setCycleStatusMessage("");
    resetAccountMessages();
    setInterfaceErrorMessage("");
    setInterfaceStatusMessage("");
    setTrackingStatusMessage("");
    resetExportMessages();
    setShowDatePicker(false);
    setClearDataConfirmationValue("");
    await refreshPreferences();
    setIsClearingData(false);
    router.replace("/onboarding");
  }

  function setExportDraftValues(
    nextValues: LoadedSettingsState["exportState"]["values"],
  ) {
    setState((current) =>
      current
        ? {
            ...current,
            exportState: {
              ...current.exportState,
              values: nextValues,
            },
          }
        : current,
    );
  }

  function hasCompleteExportDates(
    values: LoadedSettingsState["exportState"]["values"],
  ) {
    return values.fromDate.trim().length === 10 && values.toDate.trim().length === 10;
  }

  return (
    <SettingsFlowScreen
      createSymptomDraft={createSymptomDraft}
      createSymptomErrorMessage={createSymptomErrorMessage}
      createSymptomStatusMessage={createSymptomStatusMessage}
      clearDataConfirmationValue={clearDataConfirmationValue}
      clearDataErrorMessage={clearDataErrorMessage}
      clearDataStatusMessage={clearDataStatusMessage}
      accountErrorMessage={accountErrorMessage}
      accountStatusMessage={accountStatusMessage}
      cycleErrorMessage={cycleErrorMessage}
      cycleGuidance={cycleGuidance}
      cycleStatusMessage={cycleStatusMessage}
      exportErrorMessage={exportErrorMessage}
      exportStatusMessage={exportStatusMessage}
      generatedRecoveryPhrase={generatedRecoveryPhrase}
      interfaceErrorMessage={interfaceErrorMessage}
      interfaceStatusMessage={interfaceStatusMessage}
      isClearingData={isClearingData}
      isExporting={isExporting}
      isPreparingSync={isPreparingSync}
      isSavingCycle={isSavingCycle}
      isSavingInterface={isSavingInterface}
      isSavingTracking={isSavingTracking}
      locale={language}
      now={effectiveNow}
      onAgeGroupSelect={(value) => {
        setCycleErrorMessage("");
        setCycleStatusMessage("");
        setState((current) =>
          current
            ? {
                ...current,
                cycleValues: {
                  ...current.cycleValues,
                  ageGroup: value,
                },
              }
            : current,
        );
      }}
      onArchiveSymptom={handleArchiveSymptom}
      onAutoPeriodFillChange={(value) => {
        setCycleStatusMessage("");
        setState((current) =>
          current
            ? {
                ...current,
                cycleValues: {
                  ...current.cycleValues,
                  autoPeriodFill: value,
                },
              }
            : current,
        );
      }}
      onClearDataConfirmationChange={(value) => {
        resetClearDataMessages();
        setClearDataConfirmationValue(value);
      }}
      onClearAllData={handleClearAllData}
      onClearLastPeriodStart={() => {
        setCycleErrorMessage("");
        setCycleStatusMessage("");
        setState((current) =>
          current
            ? {
                ...current,
                cycleValues: {
                  ...current.cycleValues,
                  lastPeriodStart: null,
                },
              }
            : current,
        );
      }}
      onCreateSymptom={handleCreateSymptom}
      onCreateSymptomDraftChange={(updates) => {
        setCreateSymptomErrorMessage("");
        setCreateSymptomStatusMessage("");
        setCreateSymptomDraft((current) => ({
          ...current,
          ...updates,
        }));
      }}
      onCycleLengthChange={(value) => {
        setCycleStatusMessage("");
        setState((current) =>
          current
            ? {
                ...current,
                cycleValues: {
                  ...current.cycleValues,
                  cycleLength: value,
                },
              }
            : current,
        );
      }}
      onDatePickerChange={(event, value) => {
        if (event.type === "dismissed") {
          setShowDatePicker(false);
          return;
        }

        if (value) {
          setCycleErrorMessage("");
          setCycleStatusMessage("");
          setState((current) =>
            current
              ? {
                  ...current,
                  cycleValues: {
                    ...current.cycleValues,
                    lastPeriodStart: formatLocalDate(value),
                  },
                }
              : current,
          );
        }

        setShowDatePicker(false);
      }}
      onDatePickerToggle={() => setShowDatePicker((current) => !current)}
      onExportCSV={() => handleExport("csv")}
      onExportFromDateChange={(value) => {
        const nextValues: LoadedSettingsState["exportState"]["values"] = {
          ...readyState.exportState.values,
          preset: "custom",
          fromDate: value,
        };
        resetExportMessages();
        setExportDraftValues(nextValues);
        if (hasCompleteExportDates(nextValues)) {
          void handleExportRangeChange(nextValues);
        }
      }}
      onExportJSON={() => handleExport("json")}
      onExportPDF={() => handleExport("pdf")}
      onExportPresetSelect={(value) => {
        void handleExportRangeChange({
          ...readyState.exportState.values,
          preset: value,
        });
      }}
      onExportToDateChange={(value) => {
        const nextValues: LoadedSettingsState["exportState"]["values"] = {
          ...readyState.exportState.values,
          preset: "custom",
          toDate: value,
        };
        resetExportMessages();
        setExportDraftValues(nextValues);
        if (hasCompleteExportDates(nextValues)) {
          void handleExportRangeChange(nextValues);
        }
      }}
      onPrepareSyncSetup={handlePrepareSyncSetup}
      onInterfaceLanguageSelect={(value) => {
        setInterfaceErrorMessage("");
        setInterfaceStatusMessage("");
        setState((current) =>
          current
            ? {
                ...current,
                interfaceValues: {
                  ...current.interfaceValues,
                  languageOverride: value,
                },
              }
            : current,
        );
      }}
      onInterfaceThemeSelect={(value) => {
        setInterfaceErrorMessage("");
        setInterfaceStatusMessage("");
        setState((current) =>
          current
            ? {
                ...current,
                interfaceValues: {
                  ...current.interfaceValues,
                  themeOverride: value,
                },
              }
            : current,
        );
      }}
      onHideSexChipChange={(value) => {
        setTrackingStatusMessage("");
        resetExportMessages();
        setState((current) =>
          current
            ? {
                ...current,
                trackingValues: {
                  ...current.trackingValues,
                  hideSexChip: value,
                },
              }
            : current,
        );
      }}
      onIrregularCycleChange={(value) => {
        setCycleStatusMessage("");
        resetExportMessages();
        setState((current) =>
          current
            ? {
                ...current,
                cycleValues: {
                  ...current.cycleValues,
                  irregularCycle: value,
                },
              }
            : current,
        );
      }}
      onPeriodLengthChange={(value) => {
        setCycleStatusMessage("");
        resetExportMessages();
        setState((current) =>
          current
            ? {
                ...current,
                cycleValues: {
                  ...current.cycleValues,
                  periodLength: value,
                },
              }
            : current,
        );
      }}
      onRestoreSymptom={handleRestoreSymptom}
      onSaveCycleSettings={handleSaveCycleSettings}
      onSaveInterfaceSettings={handleSaveInterfaceSettings}
      onSaveTrackingSettings={handleSaveTrackingSettings}
      onSyncDeviceLabelChange={(value) => {
        resetAccountMessages();
        setState((current) =>
          current
            ? {
                ...current,
                syncPreferences: {
                  ...current.syncPreferences,
                  deviceLabel: value,
                },
              }
            : current,
        );
      }}
      onSyncEndpointChange={(value) => {
        resetAccountMessages();
        setState((current) =>
          current
            ? {
                ...current,
                syncPreferences: {
                  ...current.syncPreferences,
                  endpointInput: value,
                },
              }
            : current,
        );
      }}
      onSyncModeSelect={(value) => {
        resetAccountMessages();
        setState((current) =>
          current
            ? {
                ...current,
                syncPreferences: {
                  ...current.syncPreferences,
                  mode: value,
                  endpointInput:
                    value === "managed" ? "" : current.syncPreferences.endpointInput,
                },
              }
            : current,
        );
      }}
      onSymptomDraftChange={(symptomID, updates) => {
        setRowSymptomErrorMessages((current) => {
          const next = { ...current };
          delete next[symptomID];
          return next;
        });
        setRowSymptomStatusMessages((current) => {
          const next = { ...current };
          delete next[symptomID];
          return next;
        });
        setRowSymptomDrafts((current) => {
          const existingRecord = readyState.symptomRecords.find(
            (record) => record.id === symptomID,
          );
          return {
            ...current,
            [symptomID]: {
              label: current[symptomID]?.label ?? existingRecord?.label ?? "",
              icon: current[symptomID]?.icon ?? existingRecord?.icon ?? "✨",
              ...current[symptomID],
              ...updates,
            },
          };
        });
      }}
      onTemperatureUnitSelect={(value) => {
        setTrackingStatusMessage("");
        resetExportMessages();
        setState((current) =>
          current
            ? {
                ...current,
                trackingValues: {
                  ...current.trackingValues,
                  temperatureUnit: value,
                },
              }
            : current,
        );
      }}
      onTrackBBTChange={(value) => {
        setTrackingStatusMessage("");
        resetExportMessages();
        setState((current) =>
          current
            ? {
                ...current,
                trackingValues: {
                  ...current.trackingValues,
                  trackBBT: value,
                },
              }
            : current,
        );
      }}
      onTrackCervicalMucusChange={(value) => {
        setTrackingStatusMessage("");
        resetExportMessages();
        setState((current) =>
          current
            ? {
                ...current,
                trackingValues: {
                  ...current.trackingValues,
                  trackCervicalMucus: value,
                },
              }
            : current,
        );
      }}
      onUnpredictableCycleChange={(value) => {
        setCycleStatusMessage("");
        resetExportMessages();
        setState((current) =>
          current
            ? {
                ...current,
                cycleValues: {
                  ...current.cycleValues,
                  unpredictableCycle: value,
                },
              }
            : current,
        );
      }}
      onUpdateSymptom={handleUpdateSymptom}
      onUsageGoalSelect={(value) => {
        setCycleStatusMessage("");
        setState((current) =>
          current
            ? {
                ...current,
                cycleValues: {
                  ...current.cycleValues,
                  usageGoal: value,
                },
              }
            : current,
        );
      }}
      rowSymptomDrafts={rowSymptomDrafts}
      rowSymptomErrorMessages={rowSymptomErrorMessages}
      rowSymptomStatusMessages={rowSymptomStatusMessages}
      showDatePicker={showDatePicker}
      state={readyState}
      trackingStatusMessage={trackingStatusMessage}
      viewData={viewData}
    />
  );
}
