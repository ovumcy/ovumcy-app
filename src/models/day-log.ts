import type { LocalDateISO } from "./profile";

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

export const DAY_SYMPTOM_DEFINITIONS = [
  { id: "cramps", label: "Cramps", icon: "🩸", color: "#FF4444" },
  { id: "headache", label: "Headache", icon: "🤕", color: "#FFA500" },
  { id: "mood_swings", label: "Mood swings", icon: "😢", color: "#9B59B6" },
  { id: "bloating", label: "Bloating", icon: "🎈", color: "#3498DB" },
  { id: "fatigue", label: "Fatigue", icon: "😴", color: "#95A5A6" },
  {
    id: "breast_tenderness",
    label: "Breast tenderness",
    icon: "💔",
    color: "#E91E63",
  },
  { id: "acne", label: "Acne", icon: "🔴", color: "#E74C3C" },
  { id: "back_pain", label: "Back pain", icon: "🦴", color: "#8E6E53" },
  { id: "nausea", label: "Nausea", icon: "🤢", color: "#7CB342" },
  { id: "spotting", label: "Spotting", icon: "🩹", color: "#C55A7A" },
  {
    id: "irritability",
    label: "Irritability",
    icon: "😤",
    color: "#FF7043",
  },
  { id: "insomnia", label: "Insomnia", icon: "🌙", color: "#5C6BC0" },
  {
    id: "food_cravings",
    label: "Food cravings",
    icon: "🍫",
    color: "#A1887F",
  },
  { id: "diarrhea", label: "Diarrhea", icon: "🚽", color: "#26A69A" },
  { id: "constipation", label: "Constipation", icon: "🪨", color: "#8D6E63" },
  { id: "swelling", label: "Swelling", icon: "💧", color: "#64B5F6" },
] as const;

export type DayFlow = (typeof DAY_FLOW_VALUES)[number];
export type DaySexActivity = (typeof DAY_SEX_ACTIVITY_VALUES)[number];
export type DayCervicalMucus = (typeof DAY_CERVICAL_MUCUS_VALUES)[number];
export type DayCycleFactorKey = (typeof DAY_CYCLE_FACTOR_KEYS)[number];
export type DaySymptomDefinition = (typeof DAY_SYMPTOM_DEFINITIONS)[number];
export type DaySymptomID = DaySymptomDefinition["id"];

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
