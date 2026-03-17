import type { DayLogRecord } from "../../models/day-log";
import type { OnboardingRecord } from "../../models/onboarding";
import type { ProfileRecord } from "../../models/profile";
import type { SymptomRecord } from "../../models/symptom";

export type LocalBootstrapState = {
  hasCompletedOnboarding: boolean;
  profileVersion: number;
};

export function createDefaultBootstrapState(): LocalBootstrapState {
  return {
    hasCompletedOnboarding: false,
    profileVersion: 2,
  };
}

export interface LocalAppStorage {
  readBootstrapState(): Promise<LocalBootstrapState>;
  writeBootstrapState(state: LocalBootstrapState): Promise<void>;
  readProfileRecord(): Promise<ProfileRecord>;
  writeProfileRecord(record: ProfileRecord): Promise<void>;
  readOnboardingRecord(): Promise<OnboardingRecord>;
  writeOnboardingRecord(record: OnboardingRecord): Promise<void>;
  readDayLogRecord(date: DayLogRecord["date"]): Promise<DayLogRecord>;
  writeDayLogRecord(record: DayLogRecord): Promise<void>;
  deleteDayLogRecord(date: DayLogRecord["date"]): Promise<void>;
  listDayLogRecordsInRange(
    from: DayLogRecord["date"],
    to: DayLogRecord["date"],
  ): Promise<DayLogRecord[]>;
  listSymptomRecords(): Promise<SymptomRecord[]>;
  writeSymptomRecord(record: SymptomRecord): Promise<void>;
}
