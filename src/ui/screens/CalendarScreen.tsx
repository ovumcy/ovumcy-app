import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { createEmptyDayLogRecord, hasDayLogData } from "../../models/day-log";
import type { CalendarPredictionNoticeKey } from "../../models/profile";
import { getDashboardCopy } from "../../i18n/dashboard-copy";
import { getShellCopy } from "../../i18n/shell-copy";
import { appStorage } from "../../services/app-bootstrap-service";
import {
  loadCalendarScreenState,
  type LoadedCalendarState,
} from "../../services/calendar-view-service";
import { dismissCalendarPredictionNotice } from "../../services/calendar-notice-service";
import { loadManagedPremiumFeaturesForCurrentSession } from "../../services/managed-premium-features-service";
import { syncManagedPartnerSharedProjections } from "../../services/managed-partner-share-sync-service";
import type { LocalReminderScheduler } from "../../services/local-reminder-scheduler-contract";
import { syncLocalReminderSchedule } from "../../services/local-reminder-sync-service";
import {
  buildManualCycleStartViewData,
} from "../../services/manual-cycle-start-service";
import {
  buildNextDayLogRecordPatch,
  clearDayLogEditorRecord,
  resolveBleedingSafetyHint,
  saveDayLogEditorRecord,
} from "../../services/day-log-editor-service";
import { createPlatformLocalReminderScheduler } from "../../services/platform-local-reminder-scheduler";
import { formatLocalDate } from "../../services/profile-settings-policy";
import type { SyncSecretStore } from "../../security/sync-secret-store";
import type { PartnerShareSecretStore } from "../../security/partner-share-secret-store";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { partnerShareSecretStore as defaultPartnerShareSecretStore } from "../../sync/app-partner-share-service";
import { syncSecretStore as defaultSyncSecretStore } from "../../sync/app-sync-service";
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
  partnerShareSecretStore?: PartnerShareSecretStore;
  reminderScheduler?: LocalReminderScheduler;
  syncSecretStore?: SyncSecretStore;
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
  partnerShareSecretStore = defaultPartnerShareSecretStore,
  reminderScheduler = createPlatformLocalReminderScheduler(),
  syncSecretStore = defaultSyncSecretStore,
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
  // Session-scoped notice dismissals (dismissalScope: "session") live here and
  // are never persisted, so the notice returns on the next screen mount.
  const [sessionDismissedNoticeKey, setSessionDismissedNoticeKey] =
    useState<CalendarPredictionNoticeKey | null>(null);
  const shellCopy = getShellCopy(language);
  const dashboardCopy = getDashboardCopy(language);

  const refreshForActiveSelection = useCallback(async (options?: { syncReminders?: boolean }) => {
    const premiumFeatures = await loadManagedPremiumFeaturesForCurrentSession(
      storage,
      syncSecretStore,
    );
    const loadedState = await loadCalendarScreenState(
      storage,
      effectiveNow,
      monthValue,
      selectedDate,
      language,
      {
        showLHTests: premiumFeatures.advancedFertility,
      },
    );
    setState(loadedState);
    setIsLoading(false);
    if (options?.syncReminders) {
      await syncLocalReminderSchedule(
        storage,
        reminderScheduler,
        loadedState.profile,
        {
          locale: language,
          now: effectiveNow,
        },
      );
    }
    return loadedState;
  }, [
    effectiveNow,
    language,
    monthValue,
    reminderScheduler,
    selectedDate,
    storage,
    syncSecretStore,
  ]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void (async () => {
        const premiumFeatures = await loadManagedPremiumFeaturesForCurrentSession(
          storage,
          syncSecretStore,
        );
        const loadedState = await loadCalendarScreenState(
          storage,
          effectiveNow,
          monthValue,
          selectedDate,
          language,
          {
            showLHTests: premiumFeatures.advancedFertility,
          },
        );
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setIsLoading(false);
      })();

      return () => {
        isMounted = false;
      };
    }, [effectiveNow, language, monthValue, selectedDate, storage, syncSecretStore]),
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
    onSaved: async () => {
      await refreshForActiveSelection({ syncReminders: true });
      await syncManagedPartnerSharedProjections(
        storage,
        syncSecretStore,
        partnerShareSecretStore,
        effectiveNow,
      );
    },
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
          <ActivityIndicator
            accessibilityLabel={shellCopy.loading.calendarTitle}
            accessibilityRole="progressbar"
            color={colors.accent}
            size="large"
          />
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
    await refreshForActiveSelection({ syncReminders: true });
    await syncManagedPartnerSharedProjections(
      storage,
      syncSecretStore,
      partnerShareSecretStore,
      effectiveNow,
    );
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

    await refreshForActiveSelection({ syncReminders: true });
    await syncManagedPartnerSharedProjections(
      storage,
      syncSecretStore,
      partnerShareSecretStore,
      effectiveNow,
    );
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

    const notice = state.viewData.predictionNotice;
    if (notice.dismissalScope === "session") {
      setSessionDismissedNoticeKey(notice.key);
      return;
    }

    await dismissCalendarPredictionNotice(storage, state.profile, notice.key);
    await refreshForActiveSelection();
  }

  const visibleViewData =
    state.viewData.predictionNotice &&
    state.viewData.predictionNotice.key === sessionDismissedNoticeKey
      ? { ...state.viewData, predictionNotice: null }
      : state.viewData;

  return (
    <CalendarOverviewScreen
      bleedingSafetyHint={resolveBleedingSafetyHint(
        state.selectedRecord,
        state.records,
        language,
      )}
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
      viewData={visibleViewData}
    />
  );
}
