import type {
  CycleSettingsValues,
  ProfileRecord,
  TrackingSettingsValues,
} from "../models/profile";
import type { SymptomID } from "../models/symptom";
import type { LocalAppStorage } from "../storage/local/storage-contract";
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

type SaveStateResult<ErrorCode extends string> =
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: ErrorCode;
    };

export async function loadSettingsScreenState(
  storage: LocalAppStorage,
): Promise<LoadedSettingsState> {
  const [profile, symptomRecords] = await Promise.all([
    storage.readProfileRecord(),
    storage.listSymptomRecords(),
  ]);

  return createLoadedSettingsState(profile, symptomRecords);
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
    state: createLoadedSettingsState(nextProfile, currentState.symptomRecords),
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
    state: createLoadedSettingsState(nextProfile, currentState.symptomRecords),
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
    ]),
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
    ),
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
