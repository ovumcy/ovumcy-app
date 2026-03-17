import {
  createEmptyDayLogRecord,
  DAY_CERVICAL_MUCUS_VALUES,
  DAY_CYCLE_FACTOR_KEYS,
  DAY_FLOW_VALUES,
  DAY_SEX_ACTIVITY_VALUES,
  DAY_SYMPTOM_DEFINITIONS,
  MAX_DAY_NOTES_LENGTH,
  type DayCervicalMucus,
  type DayCycleFactorKey,
  type DayFlow,
  type DayLogRecord,
  type DaySexActivity,
  type DaySymptomID,
} from "../models/day-log";
import type { ProfileRecord } from "../models/profile";

const MIN_DAY_BBT_CELSIUS = 34;
const MAX_DAY_BBT_CELSIUS = 43;

export type DayLogVisibility = {
  showSexActivity: boolean;
  showBBT: boolean;
  showCervicalMucus: boolean;
};

const supportedSymptomIDs = new Set<DaySymptomID>(
  DAY_SYMPTOM_DEFINITIONS.map((definition) => definition.id),
);

export function buildDayLogVisibility(profile: ProfileRecord): DayLogVisibility {
  return {
    showSexActivity: !profile.hideSexChip,
    showBBT: profile.trackBBT,
    showCervicalMucus: profile.trackCervicalMucus,
  };
}

export function sanitizeDayLogRecord(record: DayLogRecord): DayLogRecord {
  const normalizedFlow = normalizeDayFlow(record.flow);
  const normalizedNotes = trimDayLogNotes(record.notes);

  return {
    ...createEmptyDayLogRecord(record.date),
    ...record,
    isPeriod: record.isPeriod,
    cycleStart: record.cycleStart && record.isPeriod,
    isUncertain: record.isUncertain && record.cycleStart && record.isPeriod,
    flow: record.isPeriod ? normalizedFlow : "none",
    mood: clampDayMood(record.mood),
    sexActivity: normalizeDaySexActivity(record.sexActivity),
    bbt: normalizeDayBBT(record.bbt),
    cervicalMucus: normalizeDayCervicalMucus(record.cervicalMucus),
    cycleFactorKeys: normalizeDayCycleFactorKeys(record.cycleFactorKeys),
    symptomIDs: normalizeDaySymptomIDs(record.symptomIDs),
    notes: normalizedNotes,
  };
}

export function normalizeDayFlow(value: string): DayFlow {
  return DAY_FLOW_VALUES.includes(value as DayFlow) ? (value as DayFlow) : "none";
}

export function normalizeDaySexActivity(value: string): DaySexActivity {
  return DAY_SEX_ACTIVITY_VALUES.includes(value as DaySexActivity)
    ? (value as DaySexActivity)
    : "none";
}

export function normalizeDayCervicalMucus(value: string): DayCervicalMucus {
  return DAY_CERVICAL_MUCUS_VALUES.includes(value as DayCervicalMucus)
    ? (value as DayCervicalMucus)
    : "none";
}

export function clampDayMood(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 5) {
    return 5;
  }

  return rounded;
}

export function normalizeDayBBT(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  const rounded = Math.round(value * 100) / 100;
  if (rounded < MIN_DAY_BBT_CELSIUS || rounded > MAX_DAY_BBT_CELSIUS) {
    return 0;
  }

  return rounded;
}

export function trimDayLogNotes(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= MAX_DAY_NOTES_LENGTH) {
    return normalized;
  }

  return normalized.slice(0, MAX_DAY_NOTES_LENGTH);
}

export function normalizeDayCycleFactorKeys(
  values: readonly string[],
): DayCycleFactorKey[] {
  const selected = new Set<DayCycleFactorKey>();

  for (const value of values) {
    if (DAY_CYCLE_FACTOR_KEYS.includes(value as DayCycleFactorKey)) {
      selected.add(value as DayCycleFactorKey);
    }
  }

  return DAY_CYCLE_FACTOR_KEYS.filter((value) => selected.has(value));
}

export function normalizeDaySymptomIDs(values: readonly string[]): DaySymptomID[] {
  const selected = new Set<DaySymptomID>();

  for (const value of values) {
    if (supportedSymptomIDs.has(value as DaySymptomID)) {
      selected.add(value as DaySymptomID);
    }
  }

  return DAY_SYMPTOM_DEFINITIONS.map((definition) => definition.id).filter((id) =>
    selected.has(id),
  );
}
