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
  const [statusMessage, setStatusMessage] = useState("");

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
    setStatusMessage("");

    const result = await saveDayLogEditorRecord(storage, state.selectedRecord);
    if (!result.ok) {
      setStatusMessage(state.editorViewData.actions.saveFailedLabel);
      setIsSaving(false);
      return;
    }

    await refreshForActiveSelection();
    setStatusMessage(state.editorViewData.actions.savedLabel);
    setIsSaving(false);
  }

  async function handleDelete() {
    if (!state) {
      return;
    }
    setIsSaving(true);
    setStatusMessage("");

    const success = await deleteDayLogEditorRecord(storage, state.selectedRecord.date);
    if (!success) {
      setStatusMessage(state.editorViewData.actions.deleteFailedLabel);
      setIsSaving(false);
      return;
    }

    await refreshForActiveSelection();
    setStatusMessage(state.editorViewData.actions.savedLabel);
    setIsSaving(false);
  }

  return (
    <CalendarOverviewScreen
      entryExists={hasDayLogData(state.selectedRecord)}
      editorViewData={state.editorViewData}
      isSaving={isSaving}
      onDelete={handleDelete}
      onNextMonth={() => {
        setStatusMessage("");
        setMonthValue(state.viewData.nextMonthValue);
      }}
      onPatch={(updates) => {
        setStatusMessage("");
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
        setStatusMessage("");
        setMonthValue(state.viewData.prevMonthValue);
      }}
      onSave={handleSave}
      onSelectDay={(date) => {
        setStatusMessage("");
        setSelectedDate(date);
      }}
      onToday={() => {
        const today = formatLocalDate(effectiveNow);
        setStatusMessage("");
        setMonthValue(today.slice(0, 7));
        setSelectedDate(today);
      }}
      record={state.selectedRecord ?? createEmptyDayLogRecord(selectedDate)}
      statusMessage={statusMessage}
      viewData={state.viewData}
    />
  );
}
