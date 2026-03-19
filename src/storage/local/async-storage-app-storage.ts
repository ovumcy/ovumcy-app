import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createEmptyDayLogRecord,
  type DayLogRecord,
} from "../../models/day-log";
import type { OnboardingRecord } from "../../models/onboarding";
import {
  createDefaultSymptomRecords,
  type SymptomRecord,
} from "../../models/symptom";
import {
  createDefaultProfileRecord,
  normalizeInterfaceLanguage,
  normalizeThemePreference,
  type ProfileRecord,
} from "../../models/profile";
import {
  createDefaultSyncPreferencesRecord,
  normalizeSyncMode,
  normalizeSyncSetupStatus,
  type SyncPreferencesRecord,
} from "../../sync/sync-contract";
import {
  applyOnboardingRecordToProfile,
  createDefaultOnboardingRecord,
  profileToOnboardingRecord,
} from "../../services/onboarding-policy";
import { sanitizeDayLogRecord } from "../../services/day-log-policy";
import type {
  LocalAppStorage,
  LocalBootstrapState,
  LocalDayLogSummary,
} from "./storage-contract";
import { createDefaultBootstrapState } from "./storage-contract";

export const BOOTSTRAP_STATE_KEY = "ovumcy/bootstrap-state";
export const PROFILE_RECORD_KEY = "ovumcy/profile-record";
export const ONBOARDING_RECORD_KEY = "ovumcy/onboarding-record";
export const DAY_LOG_RECORDS_KEY = "ovumcy/day-log-records";
export const SYMPTOM_RECORDS_KEY = "ovumcy/symptom-records";
export const SYNC_PREFERENCES_RECORD_KEY = "ovumcy/sync-preferences";

export function createAsyncStorageAppStorage(): LocalAppStorage {
  return {
    async readBootstrapState(): Promise<LocalBootstrapState> {
      return readAsyncStorageBootstrapState();
    },

    async writeBootstrapState(state: LocalBootstrapState): Promise<void> {
      await AsyncStorage.setItem(
        BOOTSTRAP_STATE_KEY,
        JSON.stringify({
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          profileVersion: state.profileVersion,
        }),
      );
    },

    async clearAllLocalData(): Promise<void> {
      await clearAsyncStorageLocalAppData();
    },

    async readProfileRecord(): Promise<ProfileRecord> {
      return readAsyncStorageProfileRecord();
    },

    async writeProfileRecord(record: ProfileRecord): Promise<void> {
      await AsyncStorage.setItem(PROFILE_RECORD_KEY, JSON.stringify(record));
    },

    async readSyncPreferencesRecord(): Promise<SyncPreferencesRecord> {
      return readAsyncStorageSyncPreferencesRecord();
    },

    async writeSyncPreferencesRecord(record: SyncPreferencesRecord): Promise<void> {
      await AsyncStorage.setItem(
        SYNC_PREFERENCES_RECORD_KEY,
        JSON.stringify(record),
      );
    },

    async readOnboardingRecord(): Promise<OnboardingRecord> {
      const profile = await readAsyncStorageProfileRecord();
      return profileToOnboardingRecord(profile);
    },

    async writeOnboardingRecord(record: OnboardingRecord): Promise<void> {
      const currentProfile = await readAsyncStorageProfileRecord();
      const nextProfile = applyOnboardingRecordToProfile(currentProfile, record);

      await AsyncStorage.setItem(PROFILE_RECORD_KEY, JSON.stringify(nextProfile));
    },

    async readDayLogRecord(date: DayLogRecord["date"]): Promise<DayLogRecord> {
      const records = await readAsyncStorageDayLogRecords();
      return mergeDayLogRecord(records[date], date);
    },

    async writeDayLogRecord(record: DayLogRecord): Promise<void> {
      const records = await readAsyncStorageDayLogRecords();
      records[record.date] = record;
      await AsyncStorage.setItem(DAY_LOG_RECORDS_KEY, JSON.stringify(records));
    },

    async deleteDayLogRecord(date: DayLogRecord["date"]): Promise<void> {
      const records = await readAsyncStorageDayLogRecords();
      delete records[date];
      await AsyncStorage.setItem(DAY_LOG_RECORDS_KEY, JSON.stringify(records));
    },

    async listDayLogRecordsInRange(
      from: DayLogRecord["date"],
      to: DayLogRecord["date"],
    ): Promise<DayLogRecord[]> {
      const records = await readAsyncStorageDayLogRecords();

      return filterSortedDayLogRecords(records, from, to);
    },

    async readDayLogSummary(
      from?: DayLogRecord["date"],
      to?: DayLogRecord["date"],
    ): Promise<LocalDayLogSummary> {
      const records = await readAsyncStorageDayLogRecords();
      const filtered = filterSortedDayLogRecords(
        records,
        from ?? "0001-01-01",
        to ?? "9999-12-31",
      );
      if (filtered.length === 0) {
        return {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        };
      }

      const firstRecord = filtered[0];
      const lastRecord = filtered[filtered.length - 1];
      if (!firstRecord || !lastRecord) {
        return {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        };
      }

      return {
        totalEntries: filtered.length,
        hasData: true,
        dateFrom: firstRecord.date,
        dateTo: lastRecord.date,
      };
    },

    async listSymptomRecords(): Promise<SymptomRecord[]> {
      return readAsyncStorageSymptomRecords();
    },

    async writeSymptomRecord(record: SymptomRecord): Promise<void> {
      const records = await readAsyncStorageSymptomRecords();
      const nextRecords = records.filter((current) => current.id !== record.id);
      nextRecords.push(mergeSymptomRecord(record));
      await AsyncStorage.setItem(SYMPTOM_RECORDS_KEY, JSON.stringify(nextRecords));
    },
  };
}

export async function readAsyncStorageBootstrapState(): Promise<LocalBootstrapState> {
  const rawValue = await AsyncStorage.getItem(BOOTSTRAP_STATE_KEY);
  if (!rawValue) {
    return createDefaultBootstrapState();
  }

  const parsed = safeParse<Partial<LocalBootstrapState>>(rawValue);
  return {
    hasCompletedOnboarding: parsed?.hasCompletedOnboarding === true,
    profileVersion:
      typeof parsed?.profileVersion === "number" && Number.isFinite(parsed.profileVersion)
        ? parsed.profileVersion
        : 2,
  };
}

export async function readAsyncStorageProfileRecord(): Promise<ProfileRecord> {
  const rawProfile = await AsyncStorage.getItem(PROFILE_RECORD_KEY);
  if (rawProfile) {
    return mergeProfileRecord(safeParse<Partial<ProfileRecord>>(rawProfile));
  }

  const rawOnboardingRecord = await AsyncStorage.getItem(ONBOARDING_RECORD_KEY);
  if (!rawOnboardingRecord) {
    return createDefaultProfileRecord();
  }

  const parsedLegacyRecord = safeParse<Partial<OnboardingRecord>>(rawOnboardingRecord);
  return applyOnboardingRecordToProfile(
    createDefaultProfileRecord(),
    {
      ...createDefaultOnboardingRecord(),
      ...parsedLegacyRecord,
      lastPeriodStart:
        typeof parsedLegacyRecord?.lastPeriodStart === "string"
          ? parsedLegacyRecord.lastPeriodStart
          : null,
    },
  );
}

export async function readAsyncStorageOnboardingRecord(): Promise<OnboardingRecord> {
  const profile = await readAsyncStorageProfileRecord();
  return profileToOnboardingRecord(profile);
}

export async function hasAsyncStorageLocalAppData(): Promise<boolean> {
  const entries = await AsyncStorage.multiGet([
    BOOTSTRAP_STATE_KEY,
    PROFILE_RECORD_KEY,
    ONBOARDING_RECORD_KEY,
    DAY_LOG_RECORDS_KEY,
    SYMPTOM_RECORDS_KEY,
    SYNC_PREFERENCES_RECORD_KEY,
  ]);
  const bootstrapState = entries[0];
  const profileRecord = entries[1];
  const onboardingRecord = entries[2];
  const dayLogRecords = entries[3];

  return (
    bootstrapState?.[1] !== null ||
    profileRecord?.[1] !== null ||
    onboardingRecord?.[1] !== null ||
    dayLogRecords?.[1] !== null ||
    entries[4]?.[1] !== null ||
    entries[5]?.[1] !== null
  );
}

export async function clearAsyncStorageLocalAppData(): Promise<void> {
  await AsyncStorage.multiRemove([
    BOOTSTRAP_STATE_KEY,
    PROFILE_RECORD_KEY,
    ONBOARDING_RECORD_KEY,
    DAY_LOG_RECORDS_KEY,
    SYMPTOM_RECORDS_KEY,
    SYNC_PREFERENCES_RECORD_KEY,
  ]);
}

export async function readAsyncStorageSyncPreferencesRecord(): Promise<SyncPreferencesRecord> {
  const rawValue = await AsyncStorage.getItem(SYNC_PREFERENCES_RECORD_KEY);
  if (!rawValue) {
    return createDefaultSyncPreferencesRecord();
  }

  return mergeSyncPreferencesRecord(
    safeParse<Partial<SyncPreferencesRecord>>(rawValue),
  );
}

async function readAsyncStorageDayLogRecords(): Promise<
  Record<string, DayLogRecord>
> {
  const rawValue = await AsyncStorage.getItem(DAY_LOG_RECORDS_KEY);
  if (!rawValue) {
    return {};
  }

  return safeParse<Record<string, DayLogRecord>>(rawValue) ?? {};
}

async function readAsyncStorageSymptomRecords(): Promise<SymptomRecord[]> {
  const rawValue = await AsyncStorage.getItem(SYMPTOM_RECORDS_KEY);
  if (!rawValue) {
    return createDefaultSymptomRecords();
  }

  const parsed = safeParse<Partial<SymptomRecord>[]>(rawValue);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return createDefaultSymptomRecords();
  }

  return parsed.map((record) => mergeSymptomRecord(record));
}

function safeParse<T>(rawValue: string): T | null {
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function mergeProfileRecord(
  parsed: Partial<ProfileRecord> | null,
): ProfileRecord {
  const defaults = createDefaultProfileRecord();

  return {
    ...defaults,
    ...parsed,
    lastPeriodStart:
      typeof parsed?.lastPeriodStart === "string" ? parsed.lastPeriodStart : null,
    temperatureUnit: parsed?.temperatureUnit === "f" ? "f" : defaults.temperatureUnit,
    languageOverride: normalizeInterfaceLanguage(parsed?.languageOverride),
    themeOverride: normalizeThemePreference(parsed?.themeOverride),
  };
}

function mergeSyncPreferencesRecord(
  parsed: Partial<SyncPreferencesRecord> | null,
): SyncPreferencesRecord {
  const defaults = createDefaultSyncPreferencesRecord();

  return {
    ...defaults,
    ...parsed,
    mode: normalizeSyncMode(parsed?.mode),
    endpointInput:
      typeof parsed?.endpointInput === "string"
        ? parsed.endpointInput
        : defaults.endpointInput,
    normalizedEndpoint:
      typeof parsed?.normalizedEndpoint === "string" &&
      parsed.normalizedEndpoint.trim().length > 0
        ? parsed.normalizedEndpoint
        : defaults.normalizedEndpoint,
    deviceLabel:
      typeof parsed?.deviceLabel === "string"
        ? parsed.deviceLabel
        : defaults.deviceLabel,
    setupStatus: normalizeSyncSetupStatus(parsed?.setupStatus),
    preparedAt:
      typeof parsed?.preparedAt === "string" ? parsed.preparedAt : null,
  };
}

function mergeDayLogRecord(
  parsed: Partial<DayLogRecord> | undefined,
  date: DayLogRecord["date"],
): DayLogRecord {
  return sanitizeDayLogRecord({
    ...createEmptyDayLogRecord(date),
    ...parsed,
    date,
  });
}

function filterSortedDayLogRecords(
  records: Record<string, DayLogRecord>,
  from: DayLogRecord["date"],
  to: DayLogRecord["date"],
): DayLogRecord[] {
  return Object.keys(records)
    .filter((date) => date >= from && date <= to)
    .sort()
    .map((date) => mergeDayLogRecord(records[date], date));
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
