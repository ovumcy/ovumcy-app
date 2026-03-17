import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { appStorage } from "../../services/app-bootstrap-service";
import {
  archiveSettingsSymptom,
  createSettingsSymptom,
  loadSettingsScreenState,
  restoreSettingsSymptom,
  saveCycleSettings,
  saveTrackingSettings,
  updateSettingsSymptom,
} from "../../services/settings-screen-service";
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
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { colors } from "../theme/tokens";
import { SettingsFlowScreen } from "./SettingsFlowScreen";

type SettingsScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
};

export function SettingsScreen({
  storage = appStorage,
  now,
}: SettingsScreenProps) {
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCycle, setIsSavingCycle] = useState(false);
  const [isSavingTracking, setIsSavingTracking] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [state, setState] = useState<LoadedSettingsState | null>(null);
  const [cycleErrorMessage, setCycleErrorMessage] = useState("");
  const [cycleStatusMessage, setCycleStatusMessage] = useState("");
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

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void loadSettingsScreenState(storage).then((loadedState) => {
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setIsLoading(false);
      });

      return () => {
        isMounted = false;
      };
    }, [storage]),
  );

  if (isLoading || !state) {
    return (
      <ScreenScaffold
        eyebrow="Preferences"
        title="Loading settings"
        description="Preparing your local cycle settings."
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  const readyState = state;
  const viewData = buildSettingsViewData(effectiveNow);
  const cycleGuidance = buildSettingsCycleGuidance(readyState.cycleValues);

  function resetSymptomMessages() {
    setCreateSymptomErrorMessage("");
    setCreateSymptomStatusMessage("");
    setRowSymptomErrorMessages({});
    setRowSymptomStatusMessages({});
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

  return (
    <SettingsFlowScreen
      createSymptomDraft={createSymptomDraft}
      createSymptomErrorMessage={createSymptomErrorMessage}
      createSymptomStatusMessage={createSymptomStatusMessage}
      cycleErrorMessage={cycleErrorMessage}
      cycleGuidance={cycleGuidance}
      cycleStatusMessage={cycleStatusMessage}
      isSavingCycle={isSavingCycle}
      isSavingTracking={isSavingTracking}
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
      onHideSexChipChange={(value) => {
        setTrackingStatusMessage("");
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
      onSaveTrackingSettings={handleSaveTrackingSettings}
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
