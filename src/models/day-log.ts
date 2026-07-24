import type { LocalDateISO } from "./profile";
import type { SymptomID } from "./symptom";

export const MAX_DAY_NOTES_LENGTH = 2000;

export const DAY_FLOW_VALUES = [
  "none",
  "spotting",
  "light",
  "medium",
  "heavy",
] as const;

export const DAY_SEX_ACTIVITY_VALUES = [
  "none",
  "protected",
  "unprotected",
] as const;

export const DAY_CERVICAL_MUCUS_VALUES = [
  "none",
  "dry",
  "moist",
  "creamy",
  "eggwhite",
] as const;

export const DAY_LH_TEST_VALUES = [
  "none",
  "negative",
  "high",
  "peak",
] as const;

export const DAY_PREGNANCY_TEST_VALUES = [
  "none",
  "negative",
  "positive",
] as const;

export const DAY_CYCLE_FACTOR_KEYS = [
  "stress",
  "illness",
  "travel",
  "sleep_disruption",
  "medication_change",
] as const;

export type DayFlow = (typeof DAY_FLOW_VALUES)[number];
export type DaySexActivity = (typeof DAY_SEX_ACTIVITY_VALUES)[number];
export type DayCervicalMucus = (typeof DAY_CERVICAL_MUCUS_VALUES)[number];
export type DayLHTest = (typeof DAY_LH_TEST_VALUES)[number];
export type DayPregnancyTest = (typeof DAY_PREGNANCY_TEST_VALUES)[number];
export type DayCycleFactorKey = (typeof DAY_CYCLE_FACTOR_KEYS)[number];
export type DaySymptomID = SymptomID;

export type DayLogRecord = {
  date: LocalDateISO;
  isPeriod: boolean;
  cycleStart: boolean;
  isUncertain: boolean;
  flow: DayFlow;
  mood: number;
  sexActivity: DaySexActivity;
  bbt: number;
  cervicalMucus: DayCervicalMucus;
  lhTest: DayLHTest;
  pregnancyTest: DayPregnancyTest;
  cycleFactorKeys: DayCycleFactorKey[];
  symptomIDs: DaySymptomID[];
  notes: string;
  // Pregnancy-mode metrics (premium, additive). Genuinely optional — absent
  // means "not logged today", never a 0-sentinel like bbt/mood below. Legacy
  // rows and sync snapshots captured before these fields existed decode with
  // them absent; see sanitizeDayLogRecord in day-log-policy.ts.
  weightKg?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
};

export function createEmptyDayLogRecord(date: LocalDateISO): DayLogRecord {
  return {
    date,
    isPeriod: false,
    cycleStart: false,
    isUncertain: false,
    flow: "none",
    mood: 0,
    sexActivity: "none",
    bbt: 0,
    cervicalMucus: "none",
    lhTest: "none",
    pregnancyTest: "none",
    cycleFactorKeys: [],
    symptomIDs: [],
    notes: "",
    // weightKg / bpSystolic / bpDiastolic intentionally omitted — absent,
    // not a sentinel value (see the DayLogRecord comment above).
  };
}

export function hasDayLogData(record: DayLogRecord): boolean {
  return (
    record.isPeriod ||
    record.cycleStart ||
    record.flow !== "none" ||
    record.mood > 0 ||
    record.sexActivity !== "none" ||
    record.bbt > 0 ||
    record.cervicalMucus !== "none" ||
    record.lhTest !== "none" ||
    record.pregnancyTest !== "none" ||
    record.cycleFactorKeys.length > 0 ||
    record.symptomIDs.length > 0 ||
    record.notes.trim().length > 0 ||
    (record.weightKg !== undefined && record.weightKg > 0) ||
    (record.bpSystolic !== undefined && record.bpSystolic > 0) ||
    (record.bpDiastolic !== undefined && record.bpDiastolic > 0)
  );
}

export function hasDayLogSex(record: DayLogRecord): boolean {
  return record.sexActivity !== "none";
}
