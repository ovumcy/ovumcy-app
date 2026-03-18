import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { createEmptyDayLogRecord, hasDayLogData } from "../../models/day-log";
import { appStorage } from "../../services/app-bootstrap-service";
import {
  loadCalendarScreenState,
  type LoadedCalendarState,
} from "../../services/calendar-view-service";
import {
  buildNextDayLogRecordPatch,
  deleteDayLogEditorRecord,
  saveDayLogEditorRecord,
} from "../../services/day-log-editor-service";
import { formatLocalDate } from "../../services/profile-settings-policy";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
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
    setStatus({
      message: state.editorViewData.actions.deletedLabel,
      tone: "success",
    });
    setIsSaving(false);
  }

  return (
    <CalendarOverviewScreen
      entryExists={hasDayLogData(state.selectedRecord)}
      editorViewData={state.editorViewData}
      isSaving={isSaving}
      onDelete={handleDelete}
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
      onSelectDay={(date) => {
        setStatus(null);
        setSelectedDate(date);
      }}
      onToday={() => {
        const today = formatLocalDate(effectiveNow);
        setStatus(null);
        setMonthValue(today.slice(0, 7));
        setSelectedDate(today);
      }}
      record={state.selectedRecord ?? createEmptyDayLogRecord(selectedDate)}
      statusMessage={status?.message ?? ""}
      statusTone={status?.tone}
      viewData={state.viewData}
    />
  );
}
