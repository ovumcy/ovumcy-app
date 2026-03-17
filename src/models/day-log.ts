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
  cycleFactorKeys: DayCycleFactorKey[];
  symptomIDs: DaySymptomID[];
  notes: string;
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
    cycleFactorKeys: [],
    symptomIDs: [],
    notes: "",
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
    record.cycleFactorKeys.length > 0 ||
    record.symptomIDs.length > 0 ||
    record.notes.trim().length > 0
  );
}

export function hasDayLogSex(record: DayLogRecord): boolean {
  return record.sexActivity !== "none";
}
