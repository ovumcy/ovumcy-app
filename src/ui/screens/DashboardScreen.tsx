import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getDashboardCopy } from "../../i18n/dashboard-copy";
import { getShellCopy } from "../../i18n/shell-copy";
import { appStorage } from "../../services/app-bootstrap-service";
import { loadManagedPremiumFeaturesForCurrentSession } from "../../services/managed-premium-features-service";
import { syncManagedPartnerSharedProjections } from "../../services/managed-partner-share-sync-service";
import {
  clearDayLogEditorRecord,
  buildNextDayLogRecordPatch,
  resolveBleedingSafetyHint,
  saveDayLogEditorRecord,
} from "../../services/day-log-editor-service";
import {
  loadDashboardScreenState,
  type LoadedDashboardState,
} from "../../services/dashboard-view-service";
import type { LocalReminderScheduler } from "../../services/local-reminder-scheduler-contract";
import { syncManagedLocalReminderSchedule } from "../../services/local-reminder-sync-service";
import {
  buildManualCycleStartViewData,
} from "../../services/manual-cycle-start-service";
import { createPlatformLocalReminderScheduler } from "../../services/platform-local-reminder-scheduler";
import { hasDayLogData } from "../../models/day-log";
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
import { DashboardOverviewScreen } from "./DashboardOverviewScreen";

type DashboardScreenProps = {
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

export function DashboardScreen({
  autosaveDebounceMs,
  storage = appStorage,
  now,
  partnerShareSecretStore = defaultPartnerShareSecretStore,
  reminderScheduler = createPlatformLocalReminderScheduler(),
  syncSecretStore = defaultSyncSecretStore,
}: DashboardScreenProps) {
  const { colors, language } = useAppPreferences();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [state, setState] = useState<LoadedDashboardState | null>(null);
  const [status, setStatus] = useState<EditorStatusState>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const shellCopy = getShellCopy(language);
  const dashboardCopy = getDashboardCopy(language);

  const refresh = useCallback(async (options?: { syncReminders?: boolean }) => {
    const premiumFeatures = await loadManagedPremiumFeaturesForCurrentSession(
      storage,
      syncSecretStore,
    );
    const loadedState = await loadDashboardScreenState(
      storage,
      effectiveNow,
      language,
      {
        showLHTests: premiumFeatures.advancedFertility,
      },
    );
    setState(loadedState);
    setIsLoading(false);
    if (options?.syncReminders) {
      await syncManagedLocalReminderSchedule(
        storage,
        syncSecretStore,
        reminderScheduler,
        loadedState.profile,
        {
          locale: language,
          now: effectiveNow,
        },
      );
    }
    return loadedState;
  }, [effectiveNow, language, reminderScheduler, storage, syncSecretStore]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      void (async () => {
        const premiumFeatures = await loadManagedPremiumFeaturesForCurrentSession(
          storage,
          syncSecretStore,
        );
        const loadedState = await loadDashboardScreenState(
          storage,
          effectiveNow,
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
    }, [effectiveNow, language, storage, syncSecretStore]),
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
          // Contextual day-save feedback (ovumcy-web day-feedback policy): the
          // generic "Saved" is replaced by the phase-aware message, including
          // the pregnancy-pause red-flag when predictions are paused.
          savedLabel: state.viewData.daySaveMessage,
          savingLabel: state.editorViewData.actions.savingLabel,
        }
      : null,
    onPersist: (record) => saveDayLogEditorRecord(storage, record),
    onSaved: async () => {
      await refresh({ syncReminders: true });
      await syncManagedPartnerSharedProjections(
        storage,
        syncSecretStore,
        partnerShareSecretStore,
        effectiveNow,
      );
    },
    record: state?.todayEntry ?? null,
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
    language,
  );

  async function handleDelete() {
    if (!state) {
      return;
    }

    const hasPersistedEntry = state.historyRecords.some(
      (record) => record.date === state.todayEntry.date && hasDayLogData(record),
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

    const result = await clearDayLogEditorRecord(storage, state.todayEntry.date);
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
            todayEntry: result.record,
          }
        : current,
    );
    await refresh({ syncReminders: true });
    await syncManagedPartnerSharedProjections(
      storage,
      syncSecretStore,
      partnerShareSecretStore,
      effectiveNow,
    );
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
      record: state.todayEntry,
      records: state.historyRecords,
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

    await refresh({ syncReminders: true });
    await syncManagedPartnerSharedProjections(
      storage,
      syncSecretStore,
      partnerShareSecretStore,
      effectiveNow,
    );
    setStatus({
      message: dashboardCopy.manualCycleStartSaved,
      tone: "success",
    });
    setIsSaving(false);
  }

  return (
    <DashboardOverviewScreen
      bleedingSafetyHint={resolveBleedingSafetyHint(
        state.todayEntry,
        state.historyRecords,
        language,
      )}
      entryExists={hasDayLogData(state.todayEntry)}
      isSaving={isSaving || isAutosaving}
      onDelete={handleDelete}
      onManualCycleStart={handleManualCycleStart}
      onPatch={(updates) => {
        setStatus(null);
        setDraftVersion((current) => current + 1);
        setState((current) =>
          current
            ? {
                ...current,
                todayEntry: buildNextDayLogRecordPatch(current.todayEntry, updates),
              }
            : current,
        );
      }}
      onSave={saveNow}
      record={state.todayEntry}
      showsSaveAction={hasSaveError}
      statusMessage={status?.message ?? autosaveStatus?.message ?? ""}
      statusTone={status?.tone ?? autosaveStatus?.tone}
      manualCycleStart={manualCycleStart}
      viewData={state.viewData}
      editorViewData={state.editorViewData}
    />
  );
}
