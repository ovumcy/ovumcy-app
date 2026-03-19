import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getDashboardCopy } from "../../i18n/dashboard-copy";
import { getShellCopy } from "../../i18n/shell-copy";
import { appStorage } from "../../services/app-bootstrap-service";
import {
  deleteDayLogEditorRecord,
  buildNextDayLogRecordPatch,
  saveDayLogEditorRecord,
} from "../../services/day-log-editor-service";
import {
  loadDashboardScreenState,
  type LoadedDashboardState,
} from "../../services/dashboard-view-service";
import {
  applyManualCycleStart,
  buildManualCycleStartViewData,
} from "../../services/manual-cycle-start-service";
import { hasDayLogData } from "../../models/day-log";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { openConfirmation } from "../confirm/open-confirmation";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
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
  const { colors, language } = useAppPreferences();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [state, setState] = useState<LoadedDashboardState | null>(null);
  const [status, setStatus] = useState<EditorStatusState>(null);
  const shellCopy = getShellCopy(language);
  const dashboardCopy = getDashboardCopy(language);

  const refresh = useCallback(async () => {
    const loadedState = await loadDashboardScreenState(
      storage,
      effectiveNow,
      language,
    );
    setState(loadedState);
    setIsLoading(false);
  }, [effectiveNow, language, storage]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void loadDashboardScreenState(storage, effectiveNow, language).then(
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
    }, [effectiveNow, language, storage]),
  );

  if (isLoading || !state) {
    return (
      <ScreenScaffold
        eyebrow={shellCopy.tabs.dashboard}
        title={shellCopy.loading.dashboardTitle}
        description={shellCopy.loading.dashboardDescription}
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  const manualCycleStart = buildManualCycleStartViewData(
    state.profile,
    state.historyRecords,
    state.todayEntry,
    effectiveNow,
  );

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
      state.historyRecords,
      state.todayEntry,
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

    await refresh();
    setStatus({
      message: dashboardCopy.manualCycleStartSaved,
      tone: "success",
    });
    setIsSaving(false);
  }

  return (
    <DashboardOverviewScreen
      entryExists={hasDayLogData(state.todayEntry)}
      isSaving={isSaving}
      onDelete={handleDelete}
      onManualCycleStart={handleManualCycleStart}
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
      manualCycleStart={manualCycleStart}
      viewData={state.viewData}
      editorViewData={state.editorViewData}
    />
  );
}
