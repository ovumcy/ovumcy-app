import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { appStorage } from "../../services/app-bootstrap-service";
import {
  saveDayLogEditorRecord,
  deleteDayLogEditorRecord,
  buildNextDayLogRecordPatch,
} from "../../services/day-log-editor-service";
import {
  loadDashboardScreenState,
  type LoadedDashboardState,
} from "../../services/dashboard-view-service";
import { hasDayLogData } from "../../models/day-log";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { colors } from "../theme/tokens";
import { DashboardOverviewScreen } from "./DashboardOverviewScreen";

type DashboardScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
};

type EditorStatusState = {
  message: string;
  tone: "success" | "error";
} | null;

export function DashboardScreen({
  storage = appStorage,
  now,
}: DashboardScreenProps) {
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [state, setState] = useState<LoadedDashboardState | null>(null);
  const [status, setStatus] = useState<EditorStatusState>(null);

  const refresh = useCallback(async () => {
    const loadedState = await loadDashboardScreenState(storage, effectiveNow);
    setState(loadedState);
    setIsLoading(false);
  }, [effectiveNow, storage]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void loadDashboardScreenState(storage, effectiveNow).then((loadedState) => {
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setIsLoading(false);
      });

      return () => {
        isMounted = false;
      };
    }, [effectiveNow, storage]),
  );

  if (isLoading || !state) {
    return (
      <ScreenScaffold
        eyebrow="Today"
        title="Loading dashboard"
        description="Preparing your local cycle context."
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  async function handleSave() {
    if (!state) {
      return;
    }
    setIsSaving(true);
    setStatus(null);

    const result = await saveDayLogEditorRecord(storage, state.todayEntry);

    if (!result.ok) {
      setStatus({
        message: state.editorViewData.actions.saveFailedLabel,
        tone: "error",
      });
      setIsSaving(false);
      return;
    }

    await refresh();
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

    const success = await deleteDayLogEditorRecord(storage, state.todayEntry.date);
    if (!success) {
      setStatus({
        message: state.editorViewData.actions.deleteFailedLabel,
        tone: "error",
      });
      setIsSaving(false);
      return;
    }

    await refresh();
    setStatus({
      message: state.editorViewData.actions.deletedLabel,
      tone: "success",
    });
    setIsSaving(false);
  }

  return (
    <DashboardOverviewScreen
      entryExists={hasDayLogData(state.todayEntry)}
      isSaving={isSaving}
      onDelete={handleDelete}
      onPatch={(updates) => {
        setStatus(null);
        setState((current) =>
          current
            ? {
                ...current,
                todayEntry: buildNextDayLogRecordPatch(current.todayEntry, updates),
              }
            : current,
        );
      }}
      onSave={handleSave}
      record={state.todayEntry}
      statusMessage={status?.message ?? ""}
      statusTone={status?.tone}
      viewData={state.viewData}
      editorViewData={state.editorViewData}
    />
  );
}
