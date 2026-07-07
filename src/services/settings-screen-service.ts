import type { ExportFormat, ExportRangeValues } from "../models/export";
import type {
  CycleSettingsValues,
  InterfaceSettingsValues,
  ProfileRecord,
  ReminderSettingsValues,
  TrackingSettingsValues,
} from "../models/profile";
import type { SymptomID } from "../models/symptom";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  type ExportArtifact,
  type ExportServiceDependencies,
  buildLocalExportArtifact,
  loadLocalExportState,
} from "./export-service";
import {
  createLoadedSettingsState,
  type LoadedSettingsState,
} from "./settings-view-service";
import {
  getSettingsCycleStartDateBounds,
  isCompatibleCycleAndPeriod,
  isValidReminderTime,
  parseLocalDate,
  sanitizeCycleSettingsValues,
  sanitizeInterfaceSettingsValues,
  sanitizeReminderSettingsValues,
  sanitizeTrackingSettingsValues,
} from "./profile-settings-policy";
import { resolvePDFExportAccessState } from "./pdf-export-access-policy";
import {
  archiveCustomSymptomRecord,
  createCustomSymptomRecord,
  restoreCustomSymptomRecord,
  updateCustomSymptomRecord,
  type SymptomDraftValues,
  type SymptomValidationErrorCode,
} from "./symptom-policy";
import { resetDismissedCalendarPredictionNotice } from "./calendar-notice-service";

type SaveSettingsErrorCode =
  | "invalid_cycle_settings"
  | "invalid_last_period_start"
  | "invalid_reminder_time"
  | "generic";
type SaveSymptomErrorCode = SymptomValidationErrorCode | "generic";
type ExportSettingsErrorCode =
  | "invalid_from_date"
  | "invalid_to_date"
  | "invalid_range"
  | "pdf_locked"
  | "generic";

type SaveStateResult<ErrorCode extends string> =
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: ErrorCode;
    };

type RefreshExportStateResult =
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: ExportSettingsErrorCode;
      state: LoadedSettingsState;
    };

export async function saveCycleSettings(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  cycleValues: CycleSettingsValues,
  now: Date,
): Promise<SaveStateResult<SaveSettingsErrorCode>> {
  if (!isValidCycleStartDate(cycleValues.lastPeriodStart, now)) {
    return {
      ok: false,
      errorCode: "invalid_last_period_start",
    };
  }
  if (!isCompatibleCycleAndPeriod(cycleValues.cycleLength, cycleValues.periodLength)) {
    return {
      ok: false,
      errorCode: "invalid_cycle_settings",
    };
  }

  const nextProfile = resetDismissedCalendarPredictionNotice(currentState.profile, {
    ...currentState.profile,
    ...sanitizeCycleSettingsValues(cycleValues),
  });

  try {
    await storage.writeProfileRecord(nextProfile);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      nextProfile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords,
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
      currentState.managedPremiumAccess,
    ),
  };
}

export async function saveReminderSettings(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  reminderValues: ReminderSettingsValues,
): Promise<SaveStateResult<SaveSettingsErrorCode>> {
  if (!isValidReminderTime(reminderValues.reminderTime)) {
    return {
      ok: false,
      errorCode: "invalid_reminder_time",
    };
  }

  const nextProfile: ProfileRecord = {
    ...currentState.profile,
    ...sanitizeReminderSettingsValues(reminderValues),
  };

  try {
    await storage.writeProfileRecord(nextProfile);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      nextProfile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords,
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
      currentState.managedPremiumAccess,
    ),
  };
}

export async function saveTrackingSettings(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  trackingValues: TrackingSettingsValues,
): Promise<SaveStateResult<SaveSettingsErrorCode>> {
  const nextProfile: ProfileRecord = {
    ...currentState.profile,
    ...sanitizeTrackingSettingsValues(trackingValues),
  };

  try {
    await storage.writeProfileRecord(nextProfile);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      nextProfile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords,
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
      currentState.managedPremiumAccess,
    ),
  };
}

export async function saveInterfaceSettings(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  interfaceValues: InterfaceSettingsValues,
): Promise<SaveStateResult<SaveSettingsErrorCode>> {
  const nextProfile: ProfileRecord = {
    ...currentState.profile,
    ...sanitizeInterfaceSettingsValues(interfaceValues),
  };

  try {
    await storage.writeProfileRecord(nextProfile);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      nextProfile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords,
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
      currentState.managedPremiumAccess,
    ),
  };
}

export async function createSettingsSymptom(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  draft: SymptomDraftValues,
): Promise<SaveStateResult<SaveSymptomErrorCode>> {
  const result = createCustomSymptomRecord(currentState.symptomRecords, draft);
  if (!result.ok) {
    return result;
  }

  try {
    await storage.writeSymptomRecord(result.record);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      [...currentState.symptomRecords, result.record],
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
      currentState.managedPremiumAccess,
    ),
  };
}

export async function updateSettingsSymptom(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  symptomID: SymptomID,
  draft: SymptomDraftValues,
): Promise<SaveStateResult<SaveSymptomErrorCode>> {
  const result = updateCustomSymptomRecord(
    currentState.symptomRecords,
    symptomID,
    draft,
  );
  if (!result.ok) {
    return result;
  }

  try {
    await storage.writeSymptomRecord(result.record);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords.map((record) =>
        record.id === symptomID ? result.record : record,
      ),
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
      currentState.managedPremiumAccess,
    ),
  };
}

export async function archiveSettingsSymptom(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  symptomID: SymptomID,
): Promise<SaveStateResult<SaveSymptomErrorCode>> {
  const result = archiveCustomSymptomRecord(currentState.symptomRecords, symptomID);
  if (!result.ok) {
    return result;
  }

  try {
    await storage.writeSymptomRecord(result.record);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords.map((record) =>
        record.id === symptomID ? result.record : record,
      ),
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
      currentState.managedPremiumAccess,
    ),
  };
}

export async function restoreSettingsSymptom(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  symptomID: SymptomID,
): Promise<SaveStateResult<SaveSymptomErrorCode>> {
  const result = restoreCustomSymptomRecord(currentState.symptomRecords, symptomID);
  if (!result.ok) {
    return result;
  }

  try {
    await storage.writeSymptomRecord(result.record);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords.map((record) =>
        record.id === symptomID ? result.record : record,
      ),
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
      currentState.managedPremiumAccess,
    ),
  };
}

export async function refreshSettingsExportState(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  exportValues: ExportRangeValues,
  now: Date,
): Promise<RefreshExportStateResult> {
  const result = await loadLocalExportState(storage, now, exportValues);
  const nextState = createLoadedSettingsState(
    currentState.profile,
    currentState.savedSyncPreferences,
    currentState.hasStoredSyncSecrets,
    currentState.hasSyncSession,
    currentState.symptomRecords,
    result.state,
    currentState.syncPreferences,
    currentState.syncCapabilities,
    currentState.managedPremiumAccess,
  );
  if (result.errorCode) {
    return {
      ok: false,
      errorCode: result.errorCode,
      state: nextState,
    };
  }

  return {
    ok: true,
    state: nextState,
  };
}

// Rebuild the loaded settings state after a JSON import: the import can add
// day logs (export summary/bounds), custom symptoms, and — on a pristine
// device — replace the profile, so all three are re-read from storage. Sync
// and billing facets cannot change through an offline import and are carried
// over untouched. Unless the profile itself was restored, the user's unsaved
// draft values are carried over too, so importing never silently discards an
// in-progress settings edit.
export async function refreshSettingsStateAfterImport(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  now: Date,
  profileRestored: boolean,
): Promise<LoadedSettingsState> {
  const [profile, symptomRecords, exportResult] = await Promise.all([
    storage.readProfileRecord(),
    storage.listSymptomRecords(),
    loadLocalExportState(storage, now),
  ]);

  const nextState = createLoadedSettingsState(
    profile,
    currentState.savedSyncPreferences,
    currentState.hasStoredSyncSecrets,
    currentState.hasSyncSession,
    symptomRecords,
    exportResult.state,
    currentState.syncPreferences,
    currentState.syncCapabilities,
    currentState.managedPremiumAccess,
  );
  if (profileRestored) {
    return nextState;
  }

  return {
    ...nextState,
    cycleValues: currentState.cycleValues,
    interfaceValues: currentState.interfaceValues,
    reminderValues: currentState.reminderValues,
    trackingValues: currentState.trackingValues,
  };
}

export async function prepareSettingsExportArtifact(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  format: ExportFormat,
  now: Date,
  dependencies: ExportServiceDependencies = {},
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
      artifact: ExportArtifact;
    }
  | {
      ok: false;
      errorCode: ExportSettingsErrorCode;
      state: LoadedSettingsState;
    }
> {
  if (format === "pdf") {
    const pdfAccess = resolvePDFExportAccessState({
      hasSyncSession: currentState.hasSyncSession,
      managedDoctorPDFAllowed: currentState.managedPremiumAccess.doctorPDF,
      syncMode: currentState.syncPreferences.mode,
    });
    if (!pdfAccess.enabled) {
      return {
        ok: false,
        errorCode: "pdf_locked",
        state: currentState,
      };
    }
  }

  const result = await buildLocalExportArtifact(
    storage,
    currentState.exportState,
    format,
    now,
    dependencies,
  );
  const nextState = createLoadedSettingsState(
    currentState.profile,
    currentState.savedSyncPreferences,
    currentState.hasStoredSyncSecrets,
    currentState.hasSyncSession,
    currentState.symptomRecords,
    result.state,
    currentState.syncPreferences,
    currentState.syncCapabilities,
    currentState.managedPremiumAccess,
  );

  if (!result.ok) {
    return {
      ok: false,
      errorCode: result.errorCode,
      state: nextState,
    };
  }

  return {
    ok: true,
    artifact: result.artifact,
    state: nextState,
  };
}

function isValidCycleStartDate(
  lastPeriodStart: CycleSettingsValues["lastPeriodStart"],
  now: Date,
): boolean {
  if (lastPeriodStart === null) {
    return true;
  }

  const parsed = parseLocalDate(lastPeriodStart);
  if (!parsed) {
    return false;
  }

  const bounds = getSettingsCycleStartDateBounds(now);
  return lastPeriodStart >= bounds.minDate && lastPeriodStart <= bounds.maxDate;
}
