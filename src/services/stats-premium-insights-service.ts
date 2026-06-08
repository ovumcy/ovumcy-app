import type { DayLogRecord } from "../models/day-log";
import type {
  CompletedCycleSummary,
  StatsComparisonKind,
  StatsCycleHistorySummary,
} from "../models/stats";
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
const MIN_DRIFT_BASELINE_WINDOW = 2;
const ANOMALOUS_CYCLE_DELTA_DAYS = 4;
const MIN_SEASONAL_PATTERN_DELTA_DAYS = 1.5;
const SHORT_LUTEAL_RECENT_LIMIT = 6;
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
  if (lengths.length < RECENT_DRIFT_WINDOW + MIN_DRIFT_BASELINE_WINDOW) {
    return null;
  }

  const recent = lengths.slice(-RECENT_DRIFT_WINDOW);
  const baseline = lengths.slice(
    Math.max(0, lengths.length - RECENT_DRIFT_WINDOW - 3),
    -RECENT_DRIFT_WINDOW,
  );
  if (baseline.length < MIN_DRIFT_BASELINE_WINDOW) {
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
      absoluteDelta >= 3
        ? "strong_drift"
        : absoluteDelta >= 1.5
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
  const baseline = calculateWeightedRecentAverage(lengths.slice(0, -1));
  if (baseline.value === null) {
    return null;
  }

  const deltaDays = lastCycleLength - baseline.value;
  if (Math.abs(deltaDays) < ANOMALOUS_CYCLE_DELTA_DAYS) {
    return null;
  }

  return {
    baselineLength: baseline.value,
    cycleLength: lastCycleLength,
    deltaDays,
    kind: deltaDays > 0 ? "longer" : "shorter",
  };
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

  const seasonalAverages = [...seasonalBuckets.entries()]
    .filter((entry) => entry[1].length > 0)
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

    const lastLHPeak = [...cycleRecords]
      .reverse()
      .find((record) => record.lhTest === "peak");
    const lastEggWhite = [...cycleRecords]
      .reverse()
      .find((record) => record.cervicalMucus === "eggwhite");
    const anchor = lastLHPeak ?? lastEggWhite;
    if (!anchor) {
      continue;
    }

    const lutealDays = diffLocalDays(anchor.date, cycle.nextStartDate);
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

