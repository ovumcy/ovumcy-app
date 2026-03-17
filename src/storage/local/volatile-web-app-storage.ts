import {
  createEmptyDayLogRecord,
  type DayLogRecord,
} from "../../models/day-log";
import type { OnboardingRecord } from "../../models/onboarding";
import {
  createDefaultProfileRecord,
  type ProfileRecord,
} from "../../models/profile";
import {
  applyOnboardingRecordToProfile,
  profileToOnboardingRecord,
} from "../../services/onboarding-policy";
import { sanitizeDayLogRecord } from "../../services/day-log-policy";
import type {
  LocalAppStorage,
  LocalBootstrapState,
} from "./storage-contract";
import { createDefaultBootstrapState } from "./storage-contract";

type VolatileWebStorageState = {
  bootstrapState: LocalBootstrapState;
  profileRecord: ProfileRecord;
  dayLogRecords: Record<string, DayLogRecord>;
};

export function createVolatileWebAppStorage(): LocalAppStorage {
  let state = createDefaultVolatileWebStorageState();

  return {
    async readBootstrapState(): Promise<LocalBootstrapState> {
      return {
        ...state.bootstrapState,
      };
    },

    async writeBootstrapState(nextState: LocalBootstrapState): Promise<void> {
      state = {
        ...state,
        bootstrapState: {
          hasCompletedOnboarding: nextState.hasCompletedOnboarding === true,
          profileVersion:
            Number.isFinite(nextState.profileVersion) &&
            nextState.profileVersion > 0
              ? nextState.profileVersion
              : state.bootstrapState.profileVersion,
        },
      };
    },

    async readProfileRecord(): Promise<ProfileRecord> {
      return mergeProfileRecord(state.profileRecord);
    },

    async writeProfileRecord(record: ProfileRecord): Promise<void> {
      state = {
        ...state,
        profileRecord: mergeProfileRecord(record),
      };
    },

    async readOnboardingRecord(): Promise<OnboardingRecord> {
      return profileToOnboardingRecord(state.profileRecord);
    },

    async writeOnboardingRecord(record: OnboardingRecord): Promise<void> {
      state = {
        ...state,
        profileRecord: applyOnboardingRecordToProfile(state.profileRecord, record),
      };
    },

    async readDayLogRecord(date: DayLogRecord["date"]): Promise<DayLogRecord> {
      return mergeDayLogRecord(state.dayLogRecords[date], date);
    },

    async writeDayLogRecord(record: DayLogRecord): Promise<void> {
      state = {
        ...state,
        dayLogRecords: {
          ...state.dayLogRecords,
          [record.date]: sanitizeDayLogRecord(record),
        },
      };
    },

    async deleteDayLogRecord(date: DayLogRecord["date"]): Promise<void> {
      const nextDayLogRecords = {
        ...state.dayLogRecords,
      };

      delete nextDayLogRecords[date];

      state = {
        ...state,
        dayLogRecords: nextDayLogRecords,
      };
    },

    async listDayLogRecordsInRange(
      from: DayLogRecord["date"],
      to: DayLogRecord["date"],
    ): Promise<DayLogRecord[]> {
      return Object.keys(state.dayLogRecords)
        .filter((date) => date >= from && date <= to)
        .sort()
        .map((date) => mergeDayLogRecord(state.dayLogRecords[date], date));
    },
  };
}

function createDefaultVolatileWebStorageState(): VolatileWebStorageState {
  return {
    bootstrapState: createDefaultBootstrapState(),
    profileRecord: createDefaultProfileRecord(),
    dayLogRecords: {},
  };
}

function mergeProfileRecord(record: Partial<ProfileRecord>): ProfileRecord {
  const defaults = createDefaultProfileRecord();

  return {
    ...defaults,
    ...record,
    lastPeriodStart:
      typeof record.lastPeriodStart === "string" ? record.lastPeriodStart : null,
    temperatureUnit: record.temperatureUnit === "f" ? "f" : defaults.temperatureUnit,
  };
}

function mergeDayLogRecord(
  record: Partial<DayLogRecord> | undefined,
  date: DayLogRecord["date"],
): DayLogRecord {
  return sanitizeDayLogRecord({
    ...createEmptyDayLogRecord(date),
    ...record,
    date,
  });
}
