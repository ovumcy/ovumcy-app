import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { createEmptyDayLogRecord, hasDayLogData } from "../../models/day-log";
import { getDashboardCopy } from "../../i18n/dashboard-copy";
import { getShellCopy } from "../../i18n/shell-copy";
import { appStorage } from "../../services/app-bootstrap-service";
import {
  loadCalendarScreenState,
  type LoadedCalendarState,
} from "../../services/calendar-view-service";
import { dismissCalendarPredictionNotice } from "../../services/calendar-notice-service";
import {
  buildManualCycleStartViewData,
  applyManualCycleStart,
} from "../../services/manual-cycle-start-service";
import {
  buildNextDayLogRecordPatch,
  deleteDayLogEditorRecord,
  saveDayLogEditorRecord,
} from "../../services/day-log-editor-service";
import { formatLocalDate } from "../../services/profile-settings-policy";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { openConfirmation } from "../confirm/open-confirmation";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { CalendarOverviewScreen } from "./CalendarOverviewScreen";

type CalendarScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
};

type EditorStatusState = {
  message: string;
  tone: "success" | "error";
} | null;

type CalendarEditorMode = "view" | "edit";

export function CalendarScreen({
  storage = appStorage,
  now,
}: CalendarScreenProps) {
  const { colors, language } = useAppPreferences();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [monthValue, setMonthValue] = useState(() =>
    formatLocalDate(effectiveNow).slice(0, 7),
  );
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(effectiveNow));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [state, setState] = useState<LoadedCalendarState | null>(null);
  const [status, setStatus] = useState<EditorStatusState>(null);
  const [editorMode, setEditorMode] = useState<CalendarEditorMode>("view");
  const shellCopy = getShellCopy(language);
  const dashboardCopy = getDashboardCopy(language);

  const refreshForActiveSelection = useCallback(async () => {
    const loadedState = await loadCalendarScreenState(
      storage,
      effectiveNow,
      monthValue,
      selectedDate,
      language,
    );
    setState(loadedState);
    setIsLoading(false);
  }, [effectiveNow, language, monthValue, selectedDate, storage]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void loadCalendarScreenState(
        storage,
        effectiveNow,
        monthValue,
        selectedDate,
        language,
      ).then((loadedState) => {
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setIsLoading(false);
      });

      return () => {
        isMounted = false;
      };
    }, [effectiveNow, language, monthValue, selectedDate, storage]),
  );

  if (isLoading || !state) {
    return (
      <ScreenScaffold
        eyebrow={shellCopy.tabs.calendar}
        title={shellCopy.loading.calendarTitle}
        description={shellCopy.loading.calendarDescription}
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  const manualCycleStart = buildManualCycleStartViewData(
    state.profile,
    state.records,
    state.selectedRecord,
    effectiveNow,
  );

  async function handleSave() {
    if (!state) {
      return;
    }
    setIsSaving(true);
    setStatus(null);

    const result = await saveDayLogEditorRecord(storage, state.selectedRecord);
    if (!result.ok) {
      setStatus({
        message: state.editorViewData.actions.saveFailedLabel,
        tone: "error",
      });
      setIsSaving(false);
      return;
    }

    await refreshForActiveSelection();
    setEditorMode("view");
    setStatus({
      message: state.editorViewData.actions.savedLabel,
      tone: "success",
    });
    setIsSaving(false);
  }

  async function handleDelete() {
    if (!state) {
      return;
    }
    setIsSaving(true);
    setStatus(null);

    const success = await deleteDayLogEditorRecord(storage, state.selectedRecord.date);
    if (!success) {
      setStatus({
        message: state.editorViewData.actions.deleteFailedLabel,
        tone: "error",
      });
      setIsSaving(false);
      return;
    }

    await refreshForActiveSelection();
    setEditorMode("view");
    setStatus({
      message: state.editorViewData.actions.deletedLabel,
      tone: "success",
    });
    setIsSaving(false);
  }

  async function handleManualCycleStart() {
    if (!state || !manualCycleStart) {
      return;
    }

    let replaceExisting = false;
    let markUncertain = false;

    for (const prompt of manualCycleStart.prompts) {
      const confirmed = await openConfirmation(
        prompt.message,
        prompt.acceptLabel,
        dashboardCopy.cancelAction,
      );
      if (!confirmed) {
        return;
      }

      if (prompt.kind === "replace_existing") {
        replaceExisting = true;
      }
      if (prompt.kind === "short_gap") {
        markUncertain = true;
      }
    }

    setIsSaving(true);
    setStatus(null);

    const result = await applyManualCycleStart(
      storage,
      state.profile,
      state.records,
      state.selectedRecord,
      effectiveNow,
      language,
      {
        markUncertain,
        replaceExisting,
      },
    );

    if (!result.ok) {
      setStatus({
        message: result.errorMessage,
        tone: "error",
      });
      setIsSaving(false);
      return;
    }

    await refreshForActiveSelection();
    setEditorMode("view");
    setStatus({
      message: dashboardCopy.manualCycleStartSaved,
      tone: "success",
    });
    setIsSaving(false);
  }

  async function handleDismissPredictionNotice() {
    if (!state?.viewData.predictionNotice) {
      return;
    }

    await dismissCalendarPredictionNotice(
      storage,
      state.profile,
      state.viewData.predictionNotice.key,
    );
    await refreshForActiveSelection();
  }

  return (
    <CalendarOverviewScreen
      entryExists={hasDayLogData(state.selectedRecord)}
      editorViewData={state.editorViewData}
      isEditing={editorMode === "edit"}
      isSaving={isSaving}
      manualCycleStart={manualCycleStart}
      onAddEntry={() => {
        setStatus(null);
        setEditorMode("edit");
      }}
      onCancelEdit={() => {
        setStatus(null);
        setEditorMode("view");
      }}
      onDelete={handleDelete}
      onDismissPredictionNotice={handleDismissPredictionNotice}
      onManualCycleStart={handleManualCycleStart}
      onNextMonth={() => {
        setStatus(null);
        setMonthValue(state.viewData.nextMonthValue);
      }}
      onPatch={(updates) => {
        setStatus(null);
        setState((current) =>
          current
            ? {
                ...current,
                selectedRecord: buildNextDayLogRecordPatch(
                  current.selectedRecord,
                  updates,
                ),
              }
            : current,
        );
      }}
      onPrevMonth={() => {
        setStatus(null);
        setMonthValue(state.viewData.prevMonthValue);
      }}
      onSave={handleSave}
      onSelectDay={(day) => {
        setStatus(null);
        setSelectedDate(day.date);
        setEditorMode(day.openEditDirectly ? "edit" : "view");
      }}
      onStartEdit={() => {
        setStatus(null);
        setEditorMode("edit");
      }}
      onToday={() => {
        const today = formatLocalDate(effectiveNow);
        setStatus(null);
        setMonthValue(today.slice(0, 7));
        setSelectedDate(today);
        setEditorMode("view");
      }}
      record={state.selectedRecord ?? createEmptyDayLogRecord(selectedDate)}
      statusMessage={status?.message ?? ""}
      statusTone={status?.tone}
      summaryViewData={state.selectedDaySummary}
      viewData={state.viewData}
    />
  );
}
