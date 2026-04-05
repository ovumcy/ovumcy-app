import type { SymptomID } from "../../../models/symptom";
import type { LoadedSettingsState } from "../../../services/settings-view-service";
import type { SymptomDraftValues } from "../../../services/symptom-policy";
import { resolvePredictionModeFlags } from "../../../models/profile";

export function patchCycleValues(
  state: LoadedSettingsState,
  updates: Partial<LoadedSettingsState["cycleValues"]>,
): LoadedSettingsState {
  return {
    ...state,
    cycleValues: {
      ...state.cycleValues,
      ...updates,
    },
  };
}

export function patchPredictionMode(
  state: LoadedSettingsState,
  value: Parameters<typeof resolvePredictionModeFlags>[0],
): LoadedSettingsState {
  return patchCycleValues(state, resolvePredictionModeFlags(value));
}

export function patchTrackingValues(
  state: LoadedSettingsState,
  updates: Partial<LoadedSettingsState["trackingValues"]>,
): LoadedSettingsState {
  return {
    ...state,
    trackingValues: {
      ...state.trackingValues,
      ...updates,
    },
  };
}

export function patchReminderValues(
  state: LoadedSettingsState,
  updates: Partial<LoadedSettingsState["reminderValues"]>,
): LoadedSettingsState {
  return {
    ...state,
    reminderValues: {
      ...state.reminderValues,
      ...updates,
    },
  };
}

export function replaceInterfaceValues(
  state: LoadedSettingsState,
  interfaceValues: LoadedSettingsState["interfaceValues"],
): LoadedSettingsState {
  return {
    ...state,
    interfaceValues,
  };
}

export function replaceExportDraftValues(
  state: LoadedSettingsState,
  exportValues: LoadedSettingsState["exportState"]["values"],
): LoadedSettingsState {
  return {
    ...state,
    exportState: {
      ...state.exportState,
      values: exportValues,
    },
  };
}

export function buildMergedRowSymptomDraft(
  state: LoadedSettingsState,
  drafts: Record<string, SymptomDraftValues>,
  symptomID: SymptomID,
  updates: Partial<SymptomDraftValues>,
): Record<string, SymptomDraftValues> {
  const existingRecord = state.symptomRecords.find((record) => record.id === symptomID);

  return {
    ...drafts,
    [symptomID]: {
      label: drafts[symptomID]?.label ?? existingRecord?.label ?? "",
      icon: drafts[symptomID]?.icon ?? existingRecord?.icon ?? "✨",
      ...drafts[symptomID],
      ...updates,
    },
  };
}

export function removeRowSymptomDraft(
  drafts: Record<string, SymptomDraftValues>,
  symptomID: SymptomID,
): Record<string, SymptomDraftValues> {
  const next = { ...drafts };
  delete next[symptomID];
  return next;
}

export function removeRowMessage(
  messages: Record<string, string>,
  symptomID: SymptomID,
): Record<string, string> {
  const next = { ...messages };
  delete next[symptomID];
  return next;
}

export function hasCompleteExportDates(
  values: LoadedSettingsState["exportState"]["values"],
) {
  return values.fromDate.trim().length === 10 && values.toDate.trim().length === 10;
}
