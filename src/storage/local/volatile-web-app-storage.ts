import {
  createEmptyDayLogRecord,
  type DayLogRecord,
} from "../../models/day-log";
import type { OnboardingRecord } from "../../models/onboarding";
import {
  createDefaultProfileRecord,
  normalizeInterfaceLanguage,
  normalizeThemePreference,
  type ProfileRecord,
} from "../../models/profile";
import {
  createDefaultSymptomRecords,
  type SymptomRecord,
} from "../../models/symptom";
import {
  applyOnboardingRecordToProfile,
  profileToOnboardingRecord,
} from "../../services/onboarding-policy";
import { sanitizeDayLogRecord } from "../../services/day-log-policy";
import type {
  LocalAppStorage,
  LocalBootstrapState,
  LocalDayLogSummary,
} from "./storage-contract";
import { createDefaultBootstrapState } from "./storage-contract";

type VolatileWebStorageState = {
  bootstrapState: LocalBootstrapState;
  profileRecord: ProfileRecord;
  dayLogRecords: Record<string, DayLogRecord>;
  symptomRecords: SymptomRecord[];
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

    async clearAllLocalData(): Promise<void> {
      state = createDefaultVolatileWebStorageState();
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
      return filterSortedDayLogRecords(state.dayLogRecords, from, to)
        .map((record) => mergeDayLogRecord(record, record.date));
    },

    async readDayLogSummary(
      from?: DayLogRecord["date"],
      to?: DayLogRecord["date"],
    ): Promise<LocalDayLogSummary> {
      const records = filterSortedDayLogRecords(
        state.dayLogRecords,
        from ?? "0001-01-01",
        to ?? "9999-12-31",
      );
      if (records.length === 0) {
        return {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        };
      }

      const firstRecord = records[0];
      const lastRecord = records[records.length - 1];
      if (!firstRecord || !lastRecord) {
        return {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        };
      }

      return {
        totalEntries: records.length,
        hasData: true,
        dateFrom: firstRecord.date,
        dateTo: lastRecord.date,
      };
    },

    async listSymptomRecords(): Promise<SymptomRecord[]> {
      return state.symptomRecords.map((record) => mergeSymptomRecord(record));
    },

    async writeSymptomRecord(record: SymptomRecord): Promise<void> {
      state = {
        ...state,
        symptomRecords: [
          ...state.symptomRecords.filter((current) => current.id !== record.id),
          mergeSymptomRecord(record),
        ],
      };
    },
  };
}

function filterSortedDayLogRecords(
  dayLogRecords: Record<string, DayLogRecord>,
  from: DayLogRecord["date"],
  to: DayLogRecord["date"],
): DayLogRecord[] {
  return Object.keys(dayLogRecords)
        .filter((date) => date >= from && date <= to)
        .sort()
        .map((date) => mergeDayLogRecord(dayLogRecords[date], date));
}

function createDefaultVolatileWebStorageState(): VolatileWebStorageState {
  return {
    bootstrapState: createDefaultBootstrapState(),
    profileRecord: createDefaultProfileRecord(),
    dayLogRecords: {},
    symptomRecords: createDefaultSymptomRecords(),
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
    languageOverride: normalizeInterfaceLanguage(record.languageOverride),
    themeOverride: normalizeThemePreference(record.themeOverride),
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

function mergeSymptomRecord(record: Partial<SymptomRecord>): SymptomRecord {
  const defaults = createSymptomRecordFallback();

  return {
    ...defaults,
    ...record,
    id: typeof record.id === "string" ? record.id : defaults.id,
    slug: typeof record.slug === "string" ? record.slug : defaults.slug,
    label: typeof record.label === "string" ? record.label : defaults.label,
    icon: typeof record.icon === "string" ? record.icon : defaults.icon,
    color: typeof record.color === "string" ? record.color : defaults.color,
    isArchived: record.isArchived === true,
    sortOrder:
      typeof record.sortOrder === "number" && Number.isFinite(record.sortOrder)
        ? record.sortOrder
        : defaults.sortOrder,
    isDefault: record.isDefault === true,
  };
}

function createSymptomRecordFallback(): SymptomRecord {
  return {
    id: "custom_unknown",
    slug: "custom-unknown",
    label: "Custom symptom",
    icon: "✨",
    color: "#E8799F",
    isArchived: false,
    sortOrder: createDefaultSymptomRecords().length,
    isDefault: false,
  };
}
