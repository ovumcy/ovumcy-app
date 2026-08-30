import type { DayLogRecord } from "../models/day-log";
import type {
  CompletedCycleSummary,
  StatsComparisonKind,
  StatsCycleHistorySummary,
} from "../models/stats";
import { calcLutealPhase } from "./cycle-prediction-policy";
import { inferBBTOvulationDate } from "./observed-ovulation-service";
import { diffLocalDays } from "./profile-settings-policy";

// These tuning constants intentionally diverge from the original Lvl3 spec
// (linear weights instead of exponential 0.5^n; 4-day anomaly delta instead of
// 10; 1.5-day seasonal swing instead of a 12+ month minimum cycle requirement).
// The deployed values were validated for UX sensitivity: exponential weights
// over-react to a single recent outlier, a 10-day anomaly threshold hides
// clinically meaningful 4-day shifts on short cycles, and waiting for 12+
// months of data leaves most users without seasonal insights. Do not change
// these without an A/B comparison.
const RECENT_WEIGHT_LIMIT = 6;
const RECENT_DRIFT_WINDOW = 3;
// Baseline must be a full window of the same size as the recent window so the
// drift comparison is symmetric (review 2.2). Skip the insight when fewer
// baseline cycles are available.
const DRIFT_BASELINE_WINDOW = RECENT_DRIFT_WINDOW;
const DRIFT_STRONG_DELTA_DAYS = 3;
const DRIFT_DRIFTING_DELTA_DAYS = 1.5;
const ANOMALOUS_CYCLE_DELTA_DAYS = 4;
// Minimum cycles required in EACH compared season before a seasonal insight
// can fire (review 2.4).
const MIN_SEASONAL_CYCLES_PER_SEASON = 2;
const MIN_SEASONAL_PATTERN_DELTA_DAYS = 1.5;
const SHORT_LUTEAL_RECENT_LIMIT = 6;
// Bounds the count of days that FOLLOW ovulation, matching the model parameter
// and the clinical definition — not the ovulation-to-next-start calendar span,
// which counts the ovulation day itself and so reads one day longer.
const SHORT_LUTEAL_THRESHOLD_DAYS = 10;
const MIN_SHORT_LUTEAL_OBSERVATIONS = 3;

export type StatsSeasonKey = "winter" | "spring" | "summer" | "autumn";

export type StatsPatternDriftInsight = {
  baselineAverage: number;
  deltaDays: number;
  kind: "stable" | "drifting" | "strong_drift";
  recentAverage: number;
};

export type StatsAnomalousCycleInsight = {
  baselineLength: number;
  cycleLength: number;
  deltaDays: number;
  kind: StatsComparisonKind;
};

export type StatsSeasonalPatternInsight = {
  deltaDays: number;
  longestAverage: number;
  longestSeason: StatsSeasonKey;
  shortestAverage: number;
  shortestSeason: StatsSeasonKey;
};

export type StatsPremiumInsightsSummary = {
  anomalousCycle: StatsAnomalousCycleInsight | null;
  patternDrift: StatsPatternDriftInsight | null;
  seasonalPattern: StatsSeasonalPatternInsight | null;
  weightedAverageCycleLength: number | null;
  weightedAverageSampleCount: number;
};

export function buildStatsPremiumInsights(
  history: StatsCycleHistorySummary,
): StatsPremiumInsightsSummary {
  const lengths = history.completedCycles.map((cycle) => cycle.cycleLength);
  const weightedAverage = calculateWeightedRecentAverage(lengths);

  return {
    anomalousCycle: buildAnomalousCycleInsight(lengths),
    patternDrift: buildPatternDriftInsight(lengths),
    seasonalPattern: buildSeasonalPatternInsight(history.completedCycles),
    weightedAverageCycleLength: weightedAverage.value,
    weightedAverageSampleCount: weightedAverage.sampleCount,
  };
}

function calculateWeightedRecentAverage(lengths: readonly number[]): {
  sampleCount: number;
  value: number | null;
} {
  const recent = lengths.slice(-RECENT_WEIGHT_LIMIT);
  if (recent.length === 0) {
    return {
      sampleCount: 0,
      value: null,
    };
  }

  let weightedTotal = 0;
  let weightSum = 0;
  for (let index = 0; index < recent.length; index += 1) {
    const weight = index + 1;
    const cycleLength = recent[index];
    if (typeof cycleLength !== "number") {
      continue;
    }
    weightedTotal += cycleLength * weight;
    weightSum += weight;
  }

  return {
    sampleCount: recent.length,
    value: weightedTotal / weightSum,
  };
}

function buildPatternDriftInsight(
  lengths: readonly number[],
): StatsPatternDriftInsight | null {
  if (lengths.length < RECENT_DRIFT_WINDOW + DRIFT_BASELINE_WINDOW) {
    return null;
  }

  const recent = lengths.slice(-RECENT_DRIFT_WINDOW);
  const baseline = lengths.slice(
    -RECENT_DRIFT_WINDOW - DRIFT_BASELINE_WINDOW,
    -RECENT_DRIFT_WINDOW,
  );
  // Require a full equal-size baseline window; the length guard above
  // guarantees it, but keep this explicit so the comparison stays symmetric.
  if (baseline.length < DRIFT_BASELINE_WINDOW) {
    return null;
  }

  const recentAverage = average(recent);
  const baselineAverage = average(baseline);
  const deltaDays = recentAverage - baselineAverage;
  const absoluteDelta = Math.abs(deltaDays);

  return {
    baselineAverage,
    deltaDays,
    kind:
      absoluteDelta >= DRIFT_STRONG_DELTA_DAYS
        ? "strong_drift"
        : absoluteDelta >= DRIFT_DRIFTING_DELTA_DAYS
          ? "drifting"
          : "stable",
    recentAverage,
  };
}

function buildAnomalousCycleInsight(
  lengths: readonly number[],
): StatsAnomalousCycleInsight | null {
  if (lengths.length < 3) {
    return null;
  }

  const lastCycleLength = lengths[lengths.length - 1];
  if (typeof lastCycleLength !== "number") {
    return null;
  }
  // Compare against the unweighted MEDIAN of the prior window (review 2.3),
  // consistent with the app's median-first canon. The weighted recent average
  // over-weights one recent prior cycle, distorting the anomaly baseline.
  const baselineLength = median(lengths.slice(0, -1));
  if (baselineLength === null) {
    return null;
  }

  const deltaDays = lastCycleLength - baselineLength;
  if (Math.abs(deltaDays) < ANOMALOUS_CYCLE_DELTA_DAYS) {
    return null;
  }

  return {
    baselineLength,
    cycleLength: lastCycleLength,
    deltaDays,
    kind: deltaDays > 0 ? "longer" : "shorter",
  };
}

// Intentionally separate from cycle-history-service's `medianInt`: this returns
// a fractional (non-rounded) value for accurate ±-delta baseline comparison,
// and returns null on empty input rather than 0, matching the null-guard logic below.
function median(values: readonly number[]): number | null {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) {
    return null;
  }
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const lower = sorted[mid - 1];
    const upper = sorted[mid];
    if (typeof lower !== "number" || typeof upper !== "number") {
      return null;
    }
    return (lower + upper) / 2;
  }
  return sorted[mid] ?? null;
}

function buildSeasonalPatternInsight(
  cycles: readonly CompletedCycleSummary[],
): StatsSeasonalPatternInsight | null {
  if (cycles.length < 3) {
    return null;
  }

  const seasonalBuckets = new Map<StatsSeasonKey, number[]>();
  for (const cycle of cycles) {
    const seasonKey = resolveSeasonKey(cycle.startDate);
    const bucket = seasonalBuckets.get(seasonKey) ?? [];
    bucket.push(cycle.cycleLength);
    seasonalBuckets.set(seasonKey, bucket);
  }

  // Require at least MIN_SEASONAL_CYCLES_PER_SEASON cycles in EACH compared
  // season (review 2.4); a single-cycle season is too noisy to compare.
  const seasonalAverages = [...seasonalBuckets.entries()]
    .filter((entry) => entry[1].length >= MIN_SEASONAL_CYCLES_PER_SEASON)
    .map(([season, values]) => ({
      season,
      average: average(values),
    }))
    .sort((left, right) => left.average - right.average);

  if (seasonalAverages.length < 2) {
    return null;
  }

  const shortest = seasonalAverages[0];
  const longest = seasonalAverages[seasonalAverages.length - 1];
  if (!shortest || !longest || shortest.season === longest.season) {
    return null;
  }

  const deltaDays = longest.average - shortest.average;
  if (deltaDays < MIN_SEASONAL_PATTERN_DELTA_DAYS) {
    return null;
  }

  return {
    deltaDays,
    longestAverage: longest.average,
    longestSeason: longest.season,
    shortestAverage: shortest.average,
    shortestSeason: shortest.season,
  };
}

function resolveSeasonKey(startDate: string): StatsSeasonKey {
  const month = Number.parseInt(startDate.slice(5, 7), 10);

  if (month === 12 || month <= 2) {
    return "winter";
  }
  if (month >= 3 && month <= 5) {
    return "spring";
  }
  if (month >= 6 && month <= 8) {
    return "summer";
  }

  return "autumn";
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export type StatsShortLutealHint = {
  averageDays: number;
  observationCount: number;
};

export function buildShortLutealHint(
  history: StatsCycleHistorySummary,
  records: readonly DayLogRecord[],
): StatsShortLutealHint | null {
  const recentCycles = history.completedCycles.slice(-SHORT_LUTEAL_RECENT_LIMIT);
  const shortValues: number[] = [];
  let totalObservations = 0;

  for (const cycle of recentCycles) {
    const cycleRecords = records
      .filter(
        (record) =>
          record.date >= cycle.startDate && record.date < cycle.nextStartDate,
      )
      .sort((left, right) => left.date.localeCompare(right.date));
    if (cycleRecords.length === 0) {
      continue;
    }

    // Clinical short-luteal anchor (review 2.1): the inferred ovulation DAY from
    // the canonical "3-over-6" thermal shift (the day BEFORE the first elevated
    // day, matching ovumcy-web's luteal inference), else the LH peak (a true
    // ovulation proxy). The mucus-only fallback is dropped for this clinical
    // warning — last egg-white alone overstates luteal length and would mis-fire
    // the highest-stakes alert.
    const bbtOvulationDate = inferBBTOvulationDate(
      cycleRecords,
      cycle.startDate,
      cycle.nextStartDate,
    );
    const lastLHPeak = [...cycleRecords]
      .reverse()
      .find((record) => record.lhTest === "peak");
    const anchorDate = bbtOvulationDate ?? lastLHPeak?.date;
    if (!anchorDate) {
      continue;
    }

    // Derived through the prediction's own inverse, so this warning and the
    // personalized prediction read one luteal phase between them.
    const lutealDays = calcLutealPhase(
      diffLocalDays(cycle.startDate, cycle.nextStartDate),
      diffLocalDays(cycle.startDate, anchorDate) + 1,
    );
    if (lutealDays <= 0) {
      continue;
    }

    totalObservations += 1;
    if (lutealDays < SHORT_LUTEAL_THRESHOLD_DAYS) {
      shortValues.push(lutealDays);
    }
  }

  if (
    totalObservations < MIN_SHORT_LUTEAL_OBSERVATIONS ||
    shortValues.length !== totalObservations
  ) {
    return null;
  }

  return {
    averageDays: average(shortValues),
    observationCount: shortValues.length,
  };
}

