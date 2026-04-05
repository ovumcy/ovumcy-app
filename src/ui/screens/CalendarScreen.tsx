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
} from "../../services/manual-cycle-start-service";
import {
  buildNextDayLogRecordPatch,
  clearDayLogEditorRecord,
  saveDayLogEditorRecord,
} from "../../services/day-log-editor-service";
import { formatLocalDate } from "../../services/profile-settings-policy";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { openConfirmation } from "../confirm/open-confirmation";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import { runManualCycleStartAction } from "./day-log/run-manual-cycle-start-action";
import { useDayLogAutosave } from "./day-log/use-day-log-autosave";
import { CalendarOverviewScreen } from "./CalendarOverviewScreen";

type CalendarScreenProps = {
  autosaveDebounceMs?: number;
  storage?: LocalAppStorage;
  now?: Date;
};

type EditorStatusState = {
  message: string;
  tone: "success" | "error";
} | null;

type CalendarEditorMode = "view" | "edit";

function buildMonthAnchorDate(monthValue: string): string {
  return `${monthValue}-01`;
}

export function CalendarScreen({
  autosaveDebounceMs,
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
  const [draftVersion, setDraftVersion] = useState(0);
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

  const {
    flushPendingDraft,
    hasSaveError,
    isAutosaving,
    resetAutosave,
    saveNow,
    status: autosaveStatus,
  } = useDayLogAutosave({
    draftVersion,
    labels: state
      ? {
          saveFailedLabel: state.editorViewData.actions.saveFailedLabel,
          savedLabel: state.editorViewData.actions.savedLabel,
          savingLabel: state.editorViewData.actions.savingLabel,
        }
      : null,
    onPersist: (record) => saveDayLogEditorRecord(storage, record),
    onSaved: refreshForActiveSelection,
    record: state?.selectedRecord ?? null,
    ...(autosaveDebounceMs !== undefined ? { debounceMs: autosaveDebounceMs } : {}),
  });

  useFocusEffect(
    useCallback(() => {
      return () => {
        void flushPendingDraft();
      };
    }, [flushPendingDraft]),
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
    language,
  );

  async function handleDelete() {
    if (!state) {
      return;
    }

    const hasPersistedEntry = state.records.some(
      (record) => record.date === state.selectedRecord.date && hasDayLogData(record),
    );
    if (hasPersistedEntry) {
      const confirmed = await openConfirmation(
        state.editorViewData.labels.deletePrompt,
        state.editorViewData.actions.deleteLabel,
        dashboardCopy.cancelAction,
      );
      if (!confirmed) {
        return;
      }
    }

    resetAutosave(draftVersion);
    setIsSaving(true);
    setStatus(null);

    const result = await clearDayLogEditorRecord(storage, state.selectedRecord.date);
    if (!result.ok) {
      setStatus({
        message: state.editorViewData.actions.deleteFailedLabel,
        tone: "error",
      });
      setIsSaving(false);
      return;
    }

    setState((current) =>
      current
        ? {
            ...current,
            selectedRecord: result.record,
          }
        : current,
    );
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

    resetAutosave(draftVersion);
    setIsSaving(true);
    setStatus(null);

    const result = await runManualCycleStartAction({
      cancelLabel: dashboardCopy.cancelAction,
      confirmPrompt: openConfirmation,
      locale: language,
      manualCycleStart,
      now: effectiveNow,
      profile: state.profile,
      record: state.selectedRecord,
      records: state.records,
      storage,
    });
    if (result === null) {
      setIsSaving(false);
      return;
    }

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
      isFutureDate={selectedDate > formatLocalDate(effectiveNow)}
      isSaving={isSaving || isAutosaving}
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
      onNextMonth={async () => {
        await flushPendingDraft();
        const nextMonthValue = state.viewData.nextMonthValue;
        setStatus(null);
        setEditorMode("view");
        setMonthValue(nextMonthValue);
        setSelectedDate(buildMonthAnchorDate(nextMonthValue));
      }}
      onPatch={(updates) => {
        setStatus(null);
        setDraftVersion((current) => current + 1);
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
      onPrevMonth={async () => {
        await flushPendingDraft();
        const prevMonthValue = state.viewData.prevMonthValue;
        setStatus(null);
        setEditorMode("view");
        setMonthValue(prevMonthValue);
        setSelectedDate(buildMonthAnchorDate(prevMonthValue));
      }}
      onSave={saveNow}
      onSelectDay={async (day) => {
        await flushPendingDraft();
        setStatus(null);
        setSelectedDate(day.date);
        setEditorMode(day.openEditDirectly ? "edit" : "view");
      }}
      onStartEdit={() => {
        setStatus(null);
        setEditorMode("edit");
      }}
      onToday={async () => {
        await flushPendingDraft();
        const today = formatLocalDate(effectiveNow);
        setStatus(null);
        setMonthValue(today.slice(0, 7));
        setSelectedDate(today);
        setEditorMode("view");
      }}
      record={state.selectedRecord ?? createEmptyDayLogRecord(selectedDate)}
      showsSaveAction={hasSaveError}
      statusMessage={status?.message ?? autosaveStatus?.message ?? ""}
      statusTone={status?.tone ?? autosaveStatus?.tone}
      summaryViewData={state.selectedDaySummary}
      viewData={state.viewData}
    />
  );
}
