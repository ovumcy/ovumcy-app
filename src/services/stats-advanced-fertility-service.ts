import type { DayLogRecord } from "../models/day-log";
import type { StatsCycleHistorySummary } from "../models/stats";
import {
  MAX_OBSERVED_LUTEAL_DAYS,
  MIN_OBSERVED_LUTEAL_DAYS,
  calcLutealPhase,
} from "./cycle-prediction-policy";
import {
  detectSustainedThermalShift,
  inferBBTOvulationDate,
  type SustainedThermalShift,
} from "./observed-ovulation-service";
import { diffLocalDays } from "./profile-settings-policy";

const ADVANCED_FERTILITY_CYCLE_LIMIT = 4;
const MAX_OVULATION_CONFIRMATION_GAP_DAYS = 4;

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

    // Luteal anchor policy (review 1.4): prefer the inferred ovulation DAY from
    // the canonical "3-over-6" thermal shift (the day before the first elevated
    // day, matching ovumcy-web's InferUserLutealPhase), else fall back to the LH
    // peak (a true ovulation proxy). The last egg-white day alone is NOT a
    // luteal anchor — post-mucus days overstate luteal length — so this uses the
    // BBT-only inferBBTOvulationDate, not inferObservedOvulationDate whose
    // egg-white fallback would reintroduce mucus-only anchoring.
    const bbtOvulationDate = inferBBTOvulationDate(
      cycleRecords,
      cycle.startDate,
      cycle.nextStartDate,
    );
    const lutealAnchorDate = bbtOvulationDate ?? lastLHPeakSignal?.date ?? null;
    if (lutealAnchorDate) {
      // Derived through the prediction's own inverse, so the number rendered
      // here names the same quantity the personalized prediction is trained on.
      // Measuring the span to nextStartDate instead would read one day longer.
      const lutealDays = calcLutealPhase(
        cycle.cycleLength,
        diffLocalDays(cycle.startDate, lutealAnchorDate) + 1,
      );
      if (
        lutealDays >= MIN_OBSERVED_LUTEAL_DAYS &&
        lutealDays <= MAX_OBSERVED_LUTEAL_DAYS
      ) {
        observedLutealValues.push(lutealDays);
      }
    }

    const thermalShift = detectThermalShift(
      cycleRecords,
      cycle.startDate,
      cycle.nextStartDate,
    );
    if (lastEggWhiteSignal || lastLHPeakSignal || thermalShift) {
      signalCoverageCount += 1;
    }
  }

  const currentCycleRecords = currentCycleAnchorDate
    ? records
        .filter((record) => record.date >= currentCycleAnchorDate)
        .sort((left, right) => left.date.localeCompare(right.date))
    : [];
  // Single source of truth for the current cycle: the canonical sustained
  // thermal shift. shiftDate drives both the confirmation gap and the LH-peak
  // alignment window so the advanced panel agrees with the calendar marker.
  const sustainedShift =
    currentCycleRecords.length && currentCycleAnchorDate
      ? detectSustainedThermalShift(currentCycleRecords, currentCycleAnchorDate)
      : null;
  const thermalShift = sustainedShift
    ? toThermalShiftSummary(sustainedShift)
    : null;
  const shiftDate = sustainedShift?.shiftStartDate ?? null;
  const lhPeakSignal = buildLHPeakSignal(currentCycleRecords, shiftDate);
  const ovulationConfirmation = buildOvulationConfirmation(
    currentCycleRecords,
    thermalShift,
    shiftDate,
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

// Thermal-shift detection reuses the canonical "3-over-6" primitive (review 1.2
// / 1.5): a sliding coverline (MAX of the 6 preceding undisturbed temps) plus a
// 3-day elevated streak clearing the third-day margin, exactly as the calendar
// marker. A confirmed shift requires the full coverline window; below that the
// primitive returns null and no "confirmed"/"building" state is emitted.
// cycleEndDate is exclusive; pass undefined for the open-ended current cycle.
function detectThermalShift(
  records: readonly DayLogRecord[],
  cycleStartDate: string,
  cycleEndDate?: string,
): StatsThermalShiftSummary | null {
  const shift = detectSustainedThermalShift(
    records,
    cycleStartDate,
    cycleEndDate,
  );
  return shift ? toThermalShiftSummary(shift) : null;
}

function toThermalShiftSummary(
  shift: SustainedThermalShift,
): StatsThermalShiftSummary {
  // The detector only emits shifts whose third day clears the coverline by the
  // third-day margin, so every sustained shift is a confirmed shift. The
  // "building" tier in the union type is retained for consumers (e.g.
  // cycle-history-service) but is structurally unreachable here per the
  // no-dead-code rule.
  return {
    kind: "confirmed",
    rise: shift.rise,
    sampleCount: shift.sampleCount,
  };
}

function buildOvulationConfirmation(
  records: readonly DayLogRecord[],
  thermalShift: StatsThermalShiftSummary | null,
  shiftDate: string | null,
): StatsOvulationConfirmationSummary | null {
  if (!thermalShift || !shiftDate || records.length === 0) {
    return null;
  }

  const lastEggWhiteSignal = [...records]
    .reverse()
    .find((record) => record.cervicalMucus === "eggwhite");
  if (!lastEggWhiteSignal) {
    return null;
  }

  // Gap measured mucus -> THERMAL-SHIFT DAY (review 1.1), not mucus -> last BBT
  // record. The > 4d rejection now applies to the real shift gap.
  const gapDays = diffLocalDays(lastEggWhiteSignal.date, shiftDate);
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
  shiftDate: string | null,
): StatsLHPeakSignalSummary | null {
  const lastLHPeakSignal = [...records]
    .reverse()
    .find((record) => record.lhTest === "peak");
  if (!lastLHPeakSignal) {
    return null;
  }

  // Upgrade logged -> aligned only when the THERMAL-SHIFT DAY is within the
  // window of the LH peak (review 1.3), not merely when any later BBT day
  // exists.
  if (!shiftDate) {
    return {
      kind: "logged",
      date: lastLHPeakSignal.date,
      gapDays: null,
    };
  }

  const gapDays = diffLocalDays(lastLHPeakSignal.date, shiftDate);
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
