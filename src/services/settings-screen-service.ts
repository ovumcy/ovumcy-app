import type {
  CycleSettingsValues,
  ProfileRecord,
  TrackingSettingsValues,
} from "../models/profile";
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

type SaveSettingsErrorCode = "invalid_last_period_start" | "generic";

export async function loadSettingsScreenState(
  storage: LocalAppStorage,
): Promise<LoadedSettingsState> {
  const profile = await storage.readProfileRecord();
  return createLoadedSettingsState(profile);
}

export async function saveCycleSettings(
  storage: LocalAppStorage,
  currentProfile: ProfileRecord,
  cycleValues: CycleSettingsValues,
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: SaveSettingsErrorCode;
    }
> {
  if (!isValidCycleStartDate(cycleValues.lastPeriodStart, now)) {
    return {
      ok: false,
      errorCode: "invalid_last_period_start",
    };
  }

  const nextProfile: ProfileRecord = {
    ...currentProfile,
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
    state: createLoadedSettingsState(nextProfile),
  };
}

export async function saveTrackingSettings(
  storage: LocalAppStorage,
  currentProfile: ProfileRecord,
  trackingValues: TrackingSettingsValues,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: SaveSettingsErrorCode;
    }
> {
  const nextProfile: ProfileRecord = {
    ...currentProfile,
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
    state: createLoadedSettingsState(nextProfile),
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
