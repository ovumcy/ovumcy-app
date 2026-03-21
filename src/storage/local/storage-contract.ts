import type { DayLogRecord } from "../../models/day-log";
import type { OnboardingRecord, OnboardingStep } from "../../models/onboarding";
import type { ProfileRecord } from "../../models/profile";
import type { SyncPreferencesRecord } from "../../sync/sync-contract";
import type { SymptomRecord } from "../../models/symptom";

export type LocalBootstrapState = {
  hasCompletedOnboarding: boolean;
  profileVersion: number;
  incompleteOnboardingStep: OnboardingStep | null;
};

export function createDefaultBootstrapState(): LocalBootstrapState {
  return {
    hasCompletedOnboarding: false,
    profileVersion: 2,
    incompleteOnboardingStep: 1,
  };
}

export function normalizeIncompleteOnboardingStep(
  value: unknown,
): OnboardingStep | null {
  return value === 1 || value === 2 ? value : null;
}

export function resolveBootstrapIncompleteOnboardingStep(
  value: unknown,
  hasCompletedOnboarding: boolean,
): OnboardingStep | null {
  if (hasCompletedOnboarding) {
    return null;
  }

  const normalized = normalizeIncompleteOnboardingStep(value);
  if (normalized !== null) {
    return normalized;
  }

  return createDefaultBootstrapState().incompleteOnboardingStep;
}

export function persistBootstrapIncompleteOnboardingStep(
  value: unknown,
  hasCompletedOnboarding: boolean,
): OnboardingStep {
  const defaultStep = createDefaultBootstrapState().incompleteOnboardingStep ?? 1;

  if (hasCompletedOnboarding) {
    return defaultStep;
  }

  return resolveBootstrapIncompleteOnboardingStep(value, false) ?? defaultStep;
}

export type LocalDayLogSummary = {
  totalEntries: number;
  hasData: boolean;
  dateFrom: DayLogRecord["date"] | null;
  dateTo: DayLogRecord["date"] | null;
};

export interface LocalAppStorage {
  readBootstrapState(): Promise<LocalBootstrapState>;
  writeBootstrapState(state: LocalBootstrapState): Promise<void>;
  clearAllLocalData(): Promise<void>;
  readProfileRecord(): Promise<ProfileRecord>;
  writeProfileRecord(record: ProfileRecord): Promise<void>;
  readSyncPreferencesRecord(): Promise<SyncPreferencesRecord>;
  writeSyncPreferencesRecord(record: SyncPreferencesRecord): Promise<void>;
  readOnboardingRecord(): Promise<OnboardingRecord>;
  writeOnboardingRecord(record: OnboardingRecord): Promise<void>;
  readDayLogRecord(date: DayLogRecord["date"]): Promise<DayLogRecord>;
  writeDayLogRecord(record: DayLogRecord): Promise<void>;
  deleteDayLogRecord(date: DayLogRecord["date"]): Promise<void>;
  listDayLogRecordsInRange(
    from: DayLogRecord["date"],
    to: DayLogRecord["date"],
  ): Promise<DayLogRecord[]>;
  readDayLogSummary(
    from?: DayLogRecord["date"],
    to?: DayLogRecord["date"],
  ): Promise<LocalDayLogSummary>;
  listSymptomRecords(): Promise<SymptomRecord[]>;
  writeSymptomRecord(record: SymptomRecord): Promise<void>;
}
