import type { DayLogRecord } from "../models/day-log";
import type { TemperatureUnit } from "../models/profile";
import type { StatsCycleHistorySummary } from "../models/stats";
import { parseLocalDate } from "./profile-settings-policy";

const ADVANCED_FERTILITY_CYCLE_LIMIT = 4;
const MAX_OBSERVED_LUTEAL_DAYS = 18;
const MIN_OBSERVED_LUTEAL_DAYS = 8;
const MIN_SHIFT_SAMPLE_COUNT = 4;
const CONFIRMED_SHIFT_THRESHOLD_CELSIUS = 0.2;
const CONFIRMED_SHIFT_THRESHOLD_FAHRENHEIT = 0.35;

export type StatsThermalShiftSummary = {
  kind: "building" | "confirmed";
  rise: number;
  sampleCount: number;
};

export type StatsObservedLutealConsistencySummary = {
  kind: "stable" | "variable" | "strong_variation";
  maxDays: number;
  minDays: number;
  sampleCount: number;
  spreadDays: number;
};

export type StatsAdvancedFertilitySummary = {
  observedLutealAverageDays: number | null;
  observedLutealConsistency: StatsObservedLutealConsistencySummary | null;
  observedLutealSampleCount: number;
  signalCoverageCount: number;
  signalCoverageSampleCount: number;
  thermalShift: StatsThermalShiftSummary | null;
};

export function buildStatsAdvancedFertility(
  history: StatsCycleHistorySummary,
  records: readonly DayLogRecord[],
  currentCycleAnchorDate: string | null,
  temperatureUnit: TemperatureUnit,
): StatsAdvancedFertilitySummary | null {
  const recentCycles = history.completedCycles.slice(-ADVANCED_FERTILITY_CYCLE_LIMIT);
  const observedLutealValues: number[] = [];
  let signalCoverageCount = 0;

  for (const cycle of recentCycles) {
    const cycleRecords = records
      .filter((record) => record.date >= cycle.startDate && record.date < cycle.nextStartDate)
      .sort((left, right) => left.date.localeCompare(right.date));
    if (cycleRecords.length === 0) {
      continue;
    }

    const lastEggWhiteSignal = [...cycleRecords]
      .reverse()
      .find((record) => record.cervicalMucus === "eggwhite");

    if (lastEggWhiteSignal) {
      const lutealDays = diffLocalDays(lastEggWhiteSignal.date, cycle.nextStartDate);
      if (
        lutealDays >= MIN_OBSERVED_LUTEAL_DAYS &&
        lutealDays <= MAX_OBSERVED_LUTEAL_DAYS
      ) {
        observedLutealValues.push(lutealDays);
      }
    }

    const thermalShift = detectThermalShift(cycleRecords, temperatureUnit);
    if (lastEggWhiteSignal || thermalShift) {
      signalCoverageCount += 1;
    }
  }

  const thermalShift = currentCycleAnchorDate
    ? detectThermalShift(
        records
          .filter((record) => record.date >= currentCycleAnchorDate)
          .sort((left, right) => left.date.localeCompare(right.date)),
        temperatureUnit,
      )
    : null;
  const hasObservedLuteal = observedLutealValues.length > 0;
  const hasSignalCoverage = recentCycles.length > 0;

  if (!hasObservedLuteal && !hasSignalCoverage && !thermalShift) {
    return null;
  }

  return {
    observedLutealAverageDays: hasObservedLuteal
      ? observedLutealValues.reduce((total, value) => total + value, 0) /
        observedLutealValues.length
      : null,
    observedLutealConsistency: buildObservedLutealConsistency(
      observedLutealValues,
    ),
    observedLutealSampleCount: observedLutealValues.length,
    signalCoverageCount,
    signalCoverageSampleCount: recentCycles.length,
    thermalShift,
  };
}

function buildObservedLutealConsistency(
  observedLutealValues: readonly number[],
): StatsObservedLutealConsistencySummary | null {
  if (observedLutealValues.length < 2) {
    return null;
  }

  const minDays = Math.min(...observedLutealValues);
  const maxDays = Math.max(...observedLutealValues);
  const spreadDays = maxDays - minDays;

  return {
    kind:
      spreadDays <= 1
        ? "stable"
        : spreadDays <= 2
          ? "variable"
          : "strong_variation",
    maxDays,
    minDays,
    sampleCount: observedLutealValues.length,
    spreadDays,
  };
}

function detectThermalShift(
  records: readonly DayLogRecord[],
  temperatureUnit: TemperatureUnit,
): StatsThermalShiftSummary | null {
  const bbtValues = records
    .filter((record) => record.bbt > 0)
    .map((record) => record.bbt);
  const windowSize = Math.min(3, Math.floor(bbtValues.length / 2));
  if (windowSize < 2 || bbtValues.length < MIN_SHIFT_SAMPLE_COUNT) {
    return null;
  }

  const baseline = bbtValues.slice(-(windowSize * 2), -windowSize);
  const recent = bbtValues.slice(-windowSize);
  const rise = average(recent) - average(baseline);
  const confirmedThreshold =
    temperatureUnit === "f"
      ? CONFIRMED_SHIFT_THRESHOLD_FAHRENHEIT
      : CONFIRMED_SHIFT_THRESHOLD_CELSIUS;
  const buildingThreshold = confirmedThreshold / 2;

  if (rise >= confirmedThreshold) {
    return {
      kind: "confirmed",
      rise,
      sampleCount: bbtValues.length,
    };
  }
  if (rise >= buildingThreshold) {
    return {
      kind: "building",
      rise,
      sampleCount: bbtValues.length,
    };
  }

  return null;
}

function diffLocalDays(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end) {
    return 0;
  }

  const milliseconds = end.getTime() - start.getTime();
  return Math.round(milliseconds / (1000 * 60 * 60 * 24));
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}
