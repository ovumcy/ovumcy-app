import type { DayLogRecord } from "../models/day-log";
import type { StatsCycleHistorySummary } from "../models/stats";
import { diffLocalDays } from "./profile-settings-policy";

const ADVANCED_FERTILITY_CYCLE_LIMIT = 4;
const MAX_OBSERVED_LUTEAL_DAYS = 20;
const MIN_OBSERVED_LUTEAL_DAYS = 10;
const MIN_SHIFT_SAMPLE_COUNT = 4;
const MAX_OVULATION_CONFIRMATION_GAP_DAYS = 4;
const CONFIRMED_SHIFT_THRESHOLD_CELSIUS = 0.2;

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
  lhPeakSignal: StatsLHPeakSignalSummary | null;
  observedLutealAverageDays: number | null;
  observedLutealConsistency: StatsObservedLutealConsistencySummary | null;
  observedLutealSampleCount: number;
  ovulationConfirmation: StatsOvulationConfirmationSummary | null;
  signalCoverageCount: number;
  signalCoverageSampleCount: number;
  thermalShift: StatsThermalShiftSummary | null;
};

export type StatsOvulationConfirmationSummary = {
  kind: "building" | "confirmed";
  gapDays: number;
  mucusDate: string;
};

export type StatsLHPeakSignalSummary = {
  kind: "logged" | "aligned";
  date: string;
  gapDays: number | null;
};

export function buildStatsAdvancedFertility(
  history: StatsCycleHistorySummary,
  records: readonly DayLogRecord[],
  currentCycleAnchorDate: string | null,
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
    const lastLHPeakSignal = [...cycleRecords]
      .reverse()
      .find((record) => record.lhTest === "peak");

    if (lastEggWhiteSignal || lastLHPeakSignal) {
      const anchorSignal = lastLHPeakSignal ?? lastEggWhiteSignal;
      const lutealDays = diffLocalDays(
        anchorSignal?.date ?? cycle.startDate,
        cycle.nextStartDate,
      );
      if (
        lutealDays >= MIN_OBSERVED_LUTEAL_DAYS &&
        lutealDays <= MAX_OBSERVED_LUTEAL_DAYS
      ) {
        observedLutealValues.push(lutealDays);
      }
    }

    const thermalShift = detectThermalShift(cycleRecords);
    if (lastEggWhiteSignal || lastLHPeakSignal || thermalShift) {
      signalCoverageCount += 1;
    }
  }

  const currentCycleRecords = currentCycleAnchorDate
    ? records
        .filter((record) => record.date >= currentCycleAnchorDate)
        .sort((left, right) => left.date.localeCompare(right.date))
    : [];
  const thermalShift = currentCycleRecords.length
    ? detectThermalShift(currentCycleRecords)
    : null;
  const lhPeakSignal = buildLHPeakSignal(currentCycleRecords, thermalShift);
  const ovulationConfirmation = buildOvulationConfirmation(
    currentCycleRecords,
    thermalShift,
  );
  const hasObservedLuteal = observedLutealValues.length > 0;
  const hasSignalCoverage = recentCycles.length > 0;

  if (
    !hasObservedLuteal &&
    !hasSignalCoverage &&
    !thermalShift &&
    !lhPeakSignal &&
    !ovulationConfirmation
  ) {
    return null;
  }

  return {
    lhPeakSignal,
    observedLutealAverageDays: hasObservedLuteal
      ? observedLutealValues.reduce((total, value) => total + value, 0) /
        observedLutealValues.length
      : null,
    observedLutealConsistency: buildObservedLutealConsistency(
      observedLutealValues,
    ),
    observedLutealSampleCount: observedLutealValues.length,
    ovulationConfirmation,
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
  const confirmedThreshold = CONFIRMED_SHIFT_THRESHOLD_CELSIUS;
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

function buildOvulationConfirmation(
  records: readonly DayLogRecord[],
  thermalShift: StatsThermalShiftSummary | null,
): StatsOvulationConfirmationSummary | null {
  if (!thermalShift || records.length === 0) {
    return null;
  }

  const lastEggWhiteSignal = [...records]
    .reverse()
    .find((record) => record.cervicalMucus === "eggwhite");
  const lastBBTRecord = [...records].reverse().find((record) => record.bbt > 0);
  if (!lastEggWhiteSignal || !lastBBTRecord) {
    return null;
  }

  const gapDays = diffLocalDays(lastEggWhiteSignal.date, lastBBTRecord.date);
  if (gapDays < 0 || gapDays > MAX_OVULATION_CONFIRMATION_GAP_DAYS) {
    return null;
  }

  return {
    kind: thermalShift.kind,
    gapDays,
    mucusDate: lastEggWhiteSignal.date,
  };
}

function buildLHPeakSignal(
  records: readonly DayLogRecord[],
  thermalShift: StatsThermalShiftSummary | null,
): StatsLHPeakSignalSummary | null {
  const lastLHPeakSignal = [...records]
    .reverse()
    .find((record) => record.lhTest === "peak");
  if (!lastLHPeakSignal) {
    return null;
  }

  const lastBBTRecord = [...records].reverse().find((record) => record.bbt > 0);
  if (!thermalShift || !lastBBTRecord) {
    return {
      kind: "logged",
      date: lastLHPeakSignal.date,
      gapDays: null,
    };
  }

  const gapDays = diffLocalDays(lastLHPeakSignal.date, lastBBTRecord.date);
  if (gapDays < 0 || gapDays > MAX_OVULATION_CONFIRMATION_GAP_DAYS) {
    return {
      kind: "logged",
      date: lastLHPeakSignal.date,
      gapDays: null,
    };
  }

  return {
    kind: "aligned",
    date: lastLHPeakSignal.date,
    gapDays,
  };
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}
