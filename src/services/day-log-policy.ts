import {
  createEmptyDayLogRecord,
  DAY_CERVICAL_MUCUS_VALUES,
  DAY_CYCLE_FACTOR_KEYS,
  DAY_FLOW_VALUES,
  DAY_LH_TEST_VALUES,
  DAY_PREGNANCY_TEST_VALUES,
  DAY_SEX_ACTIVITY_VALUES,
  MAX_DAY_NOTES_LENGTH,
  type DayCervicalMucus,
  type DayCycleFactorKey,
  type DayFlow,
  type DayLHTest,
  type DayLogRecord,
  type DayPregnancyTest,
  type DaySexActivity,
} from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import { normalizeDayLogSymptomIDs } from "./symptom-policy";

const MIN_DAY_BBT_CELSIUS = 34;
const MAX_DAY_BBT_CELSIUS = 43;

const MIN_DAY_WEIGHT_KG = 30;
const MAX_DAY_WEIGHT_KG = 250;
const MIN_DAY_BP_SYSTOLIC = 60;
const MAX_DAY_BP_SYSTOLIC = 250;
const MIN_DAY_BP_DIASTOLIC = 40;
const MAX_DAY_BP_DIASTOLIC = 150;

export type DayLogVisibility = {
  showSexActivity: boolean;
  showBBT: boolean;
  showCervicalMucus: boolean;
  showLHTest: boolean;
  showNotes: boolean;
  showCycleFactors: boolean;
  // Pregnancy metrics (weightKg/bpSystolic/bpDiastolic). Not a profile
  // field like trackBBT -- pregnancy-active status lives in a separate
  // repository, so it is threaded in as an option exactly like showLHTests
  // (a premium flag that also isn't part of ProfileRecord).
  showPregnancyMetrics: boolean;
};

export type DayLogVisibilityOptions = {
  showLHTests?: boolean;
  showPregnancyMetrics?: boolean;
};

export function buildDayLogVisibility(
  profile: ProfileRecord,
  options: DayLogVisibilityOptions = {},
): DayLogVisibility {
  return {
    showSexActivity: !profile.hideSexChip,
    showBBT: profile.trackBBT,
    showCervicalMucus: profile.trackCervicalMucus,
    showLHTest: options.showLHTests === true,
    showNotes: profile.hideNotes !== true,
    showCycleFactors: profile.hideCycleFactors !== true,
    showPregnancyMetrics: options.showPregnancyMetrics === true,
  };
}

export function sanitizeDayLogRecord(record: DayLogRecord): DayLogRecord {
  const normalizedFlow = normalizeDayFlow(record.flow);
  const normalizedNotes = trimDayLogNotes(record.notes);
  // exactOptionalPropertyTypes forbids assigning a `number | undefined`
  // normalizer result straight into an optional `number` property, and a
  // later "no override" can't erase a key the `...record` spread below
  // already added — so the raw pregnancy-metric values are pulled out of
  // the spread source here and spliced back in conditionally at the end.
  const {
    weightKg: rawWeightKg,
    bpSystolic: rawBpSystolic,
    bpDiastolic: rawBpDiastolic,
    ...restRecord
  } = record;
  const weightKg = normalizeDayWeightKg(rawWeightKg);
  const bpSystolic = normalizeDayBpSystolic(rawBpSystolic);
  const bpDiastolic = normalizeDayBpDiastolic(rawBpDiastolic);

  return {
    ...createEmptyDayLogRecord(record.date),
    ...restRecord,
    isPeriod: record.isPeriod,
    cycleStart: record.cycleStart && record.isPeriod,
    isUncertain: record.isUncertain && record.cycleStart && record.isPeriod,
    flow: record.isPeriod ? normalizedFlow : "none",
    mood: clampDayMood(record.mood),
    sexActivity: normalizeDaySexActivity(record.sexActivity),
    bbt: normalizeDayBBT(record.bbt),
    cervicalMucus: normalizeDayCervicalMucus(record.cervicalMucus),
    lhTest: normalizeDayLHTest(record.lhTest),
    pregnancyTest: normalizeDayPregnancyTest(record.pregnancyTest),
    cycleFactorKeys: normalizeDayCycleFactorKeys(record.cycleFactorKeys),
    symptomIDs: normalizeDayLogSymptomIDs(record.symptomIDs),
    notes: normalizedNotes,
    // BP systolic/diastolic apply independently — a lone reading (e.g.
    // diastolic without systolic) is stored as given; neither value invents
    // nor drops its counterpart.
    ...(weightKg !== undefined ? { weightKg } : {}),
    ...(bpSystolic !== undefined ? { bpSystolic } : {}),
    ...(bpDiastolic !== undefined ? { bpDiastolic } : {}),
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

export function normalizeDayLHTest(value: string): DayLHTest {
  return DAY_LH_TEST_VALUES.includes(value as DayLHTest)
    ? (value as DayLHTest)
    : "none";
}

export function normalizeDayPregnancyTest(value: string): DayPregnancyTest {
  return DAY_PREGNANCY_TEST_VALUES.includes(value as DayPregnancyTest)
    ? (value as DayPregnancyTest)
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
  // BBT is stored canonically in Celsius; the UI converts to/from the user's unit.
  if (rounded < MIN_DAY_BBT_CELSIUS || rounded > MAX_DAY_BBT_CELSIUS) {
    return 0;
  }

  return rounded;
}

export function normalizeDayWeightKg(
  value: number | undefined,
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  const rounded = Math.round(value * 100) / 100;
  if (rounded < MIN_DAY_WEIGHT_KG || rounded > MAX_DAY_WEIGHT_KG) {
    return undefined;
  }

  return rounded;
}

export function normalizeDayBpSystolic(
  value: number | undefined,
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  const rounded = Math.round(value);
  if (rounded < MIN_DAY_BP_SYSTOLIC || rounded > MAX_DAY_BP_SYSTOLIC) {
    return undefined;
  }

  return rounded;
}

export function normalizeDayBpDiastolic(
  value: number | undefined,
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  const rounded = Math.round(value);
  if (rounded < MIN_DAY_BP_DIASTOLIC || rounded > MAX_DAY_BP_DIASTOLIC) {
    return undefined;
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
