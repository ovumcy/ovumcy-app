import type { ExportFormat, ExportRangeValues } from "../models/export";
import type {
  CycleSettingsValues,
  ProfileRecord,
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
  parseLocalDate,
  sanitizeCycleSettingsValues,
  sanitizeTrackingSettingsValues,
} from "./profile-settings-policy";
import {
  archiveCustomSymptomRecord,
  createCustomSymptomRecord,
  restoreCustomSymptomRecord,
  updateCustomSymptomRecord,
  type SymptomDraftValues,
  type SymptomValidationErrorCode,
} from "./symptom-policy";

type SaveSettingsErrorCode = "invalid_last_period_start" | "generic";
type SaveSymptomErrorCode = SymptomValidationErrorCode | "generic";
type ExportSettingsErrorCode =
  | "invalid_from_date"
  | "invalid_to_date"
  | "invalid_range"
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

export async function loadSettingsScreenState(
  storage: LocalAppStorage,
  now: Date,
): Promise<LoadedSettingsState> {
  const [profile, symptomRecords, exportResult] = await Promise.all([
    storage.readProfileRecord(),
    storage.listSymptomRecords(),
    loadLocalExportState(storage, now),
  ]);

  return createLoadedSettingsState(profile, symptomRecords, exportResult.state);
}

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

  const nextProfile: ProfileRecord = {
    ...currentState.profile,
    ...sanitizeCycleSettingsValues(cycleValues),
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
      currentState.symptomRecords,
      currentState.exportState,
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
      currentState.symptomRecords,
      currentState.exportState,
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
    state: createLoadedSettingsState(currentState.profile, [
      ...currentState.symptomRecords,
      result.record,
    ], currentState.exportState),
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
      currentState.symptomRecords.map((record) =>
        record.id === symptomID ? result.record : record,
      ),
      currentState.exportState,
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
      currentState.symptomRecords.map((record) =>
        record.id === symptomID ? result.record : record,
      ),
      currentState.exportState,
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
      currentState.symptomRecords.map((record) =>
        record.id === symptomID ? result.record : record,
      ),
      currentState.exportState,
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
    currentState.symptomRecords,
    result.state,
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
  const result = await buildLocalExportArtifact(
    storage,
    currentState.exportState,
    format,
    now,
    dependencies,
  );
  const nextState = createLoadedSettingsState(
    currentState.profile,
    currentState.symptomRecords,
    result.state,
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
