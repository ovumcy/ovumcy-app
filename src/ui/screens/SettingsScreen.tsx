import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { appStorage } from "../../services/app-bootstrap-service";
import {
  loadSettingsScreenState,
  saveCycleSettings,
  saveTrackingSettings,
} from "../../services/settings-screen-service";
import {
  buildSettingsCycleGuidance,
  buildSettingsViewData,
  type LoadedSettingsState,
} from "../../services/settings-view-service";
import { formatLocalDate } from "../../services/profile-settings-policy";
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

  async function handleSaveCycleSettings() {
    setIsSavingCycle(true);
    setCycleErrorMessage("");
    setCycleStatusMessage("");

    const result = await saveCycleSettings(
      storage,
      readyState.profile,
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
      readyState.profile,
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

  return (
    <SettingsFlowScreen
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
      onSaveCycleSettings={handleSaveCycleSettings}
      onSaveTrackingSettings={handleSaveTrackingSettings}
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
      showDatePicker={showDatePicker}
      state={readyState}
      trackingStatusMessage={trackingStatusMessage}
      viewData={viewData}
    />
  );
}
