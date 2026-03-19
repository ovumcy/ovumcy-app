import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { createEmptyDayLogRecord, hasDayLogData } from "../../models/day-log";
import { dashboardCopy } from "../../i18n/dashboard-copy";
import { appStorage } from "../../services/app-bootstrap-service";
import {
  loadCalendarScreenState,
  type LoadedCalendarState,
} from "../../services/calendar-view-service";
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
import { colors } from "../theme/tokens";
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

  useEffect(() => {
    let isMounted = true;

    void loadCalendarScreenState(storage, effectiveNow, monthValue, selectedDate).then(
      (loadedState) => {
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setIsLoading(false);
      },
    );

    return () => {
      isMounted = false;
    };
  }, [effectiveNow, monthValue, selectedDate, storage]);

  if (isLoading || !state) {
    return (
      <ScreenScaffold
        eyebrow="History"
        title="Loading calendar"
        description="Preparing your local month view."
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

  async function refreshForActiveSelection() {
    const loadedState = await loadCalendarScreenState(
      storage,
      effectiveNow,
      monthValue,
      selectedDate,
    );
    setState(loadedState);
  }

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
      const confirmed = await openConfirmation(prompt.message, prompt.acceptLabel);
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
      "en",
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
