import {
  DAY_CYCLE_FACTOR_KEYS,
  type DayCycleFactorKey,
  type DayLogRecord,
} from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import {
  predictCycleWindow,
  resolveLutealPhase,
} from "./cycle-prediction-policy";
import { inferObservedOvulationDate } from "./observed-ovulation-service";
import {
  IRREGULAR_CYCLE_SPREAD_DAYS,
  STATS_CYCLE_COMPARISON_DELTA,
  STATS_CYCLE_PREDICTION_WINDOW,
  STATS_FACTOR_CONTEXT_LIMIT,
  STATS_FACTOR_CONTEXT_WINDOW_DAYS,
  STATS_FACTOR_PATTERN_ITEM_LIMIT,
  STATS_FACTOR_RECENT_CYCLE_LIMIT,
  STATS_MINIMUM_INSIGHTS_CYCLES,
  STATS_RELIABLE_TREND_CYCLES,
  type CompletedCycleSummary,
  type StatsComparisonKind,
  type StatsCycleHistorySummary,
  type StatsCycleProjection,
  type StatsFactorContext,
  type StatsFactorContextItem,
  type StatsFactorPatternSummary,
  type StatsRecentCycleSummary,
  type StatsReliabilityState,
} from "../models/stats";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

export function buildCycleHistorySummary(
  profile: ProfileRecord,
  records: DayLogRecord[],
  now: Date,
): StatsCycleHistorySummary {
  const completedCycles = buildCompletedCycleSummaries(profile, records, now);
  const lengths = completedCycles.map((cycle) => cycle.cycleLength);
  const recentCycleLengths = tailInts(lengths, STATS_CYCLE_PREDICTION_WINDOW);
  const completedCycleCount = completedCycles.length;
  const minCycleLength = lengths.length > 0 ? Math.min(...lengths) : 0;
  const maxCycleLength = lengths.length > 0 ? Math.max(...lengths) : 0;

  return {
    completedCycles,
    completedCycleCount,
    insightProgress: statsInsightProgress(completedCycleCount),
    hasInsights: completedCycleCount >= STATS_MINIMUM_INSIGHTS_CYCLES,
    hasReliableTrend: completedCycleCount >= STATS_RELIABLE_TREND_CYCLES,
    recentCycleLengths,
    averageCycleLength: averageInts(recentCycleLengths),
    medianCycleLength: medianInt(recentCycleLengths),
    minCycleLength,
    maxCycleLength,
    cycleLengthSpread:
      minCycleLength > 0 && maxCycleLength > 0 ? maxCycleLength - minCycleLength : 0,
    lastCycleLength:
      completedCycleCount > 0
        ? completedCycles[completedCycleCount - 1]!.cycleLength
        : 0,
    lastPeriodLength:
      completedCycleCount > 0
        ? completedCycles[completedCycleCount - 1]!.periodLength
        : 0,
  };
}

export function buildStatsReliability(
  profile: ProfileRecord,
  history: StatsCycleHistorySummary,
): StatsReliabilityState | null {
  if (!history.hasInsights || profile.unpredictableCycle) {
    return null;
  }

  let sampleCount = history.completedCycleCount;
  let usesRecentWindow = false;
  if (sampleCount > STATS_CYCLE_PREDICTION_WINDOW) {
    sampleCount = STATS_CYCLE_PREDICTION_WINDOW;
    usesRecentWindow = true;
  }

  const variablePattern = isVariablePattern(profile, history);
  let kind: StatsReliabilityState["kind"] = "early";

  switch (true) {
    case variablePattern && sampleCount >= STATS_RELIABLE_TREND_CYCLES:
      kind = "variable";
      break;
    case sampleCount >= STATS_CYCLE_PREDICTION_WINDOW:
      kind = "stable";
      break;
    case sampleCount >= STATS_RELIABLE_TREND_CYCLES:
      kind = "building";
      break;
    default:
      kind = "early";
      break;
  }

  return {
    sampleCount,
    usesRecentWindow,
    kind,
    hintKind: variablePattern ? "variable" : "default",
  };
}

export function buildStatsFactorContext(
  profile: ProfileRecord,
  history: StatsCycleHistorySummary,
  records: DayLogRecord[],
  now: Date,
): StatsFactorContext | null {
  if (!shouldBuildFactorContext(profile, history)) {
    return null;
  }

  const recentFactors = buildFactorItems(collectRecentFactorCounts(records, now));
  const completedCyclesWithFactors = history.completedCycles.filter(
    (cycle) => cycle.factorKeys.length > 0,
  );
  const patternSummaries = buildPatternSummaries(completedCyclesWithFactors);
  const recentCycles = buildRecentCycleSummaries(completedCyclesWithFactors);
  const hintFactorKeys = recentFactors.slice(0, 2).map((item) => item.key);

  if (
    recentFactors.length === 0 &&
    patternSummaries.length === 0 &&
    recentCycles.length === 0
  ) {
    return null;
  }

  return {
    recentFactors,
    patternSummaries,
    recentCycles,
    hintFactorKeys,
  };
}

export function buildCurrentCycleProjection(
  profile: ProfileRecord,
  history: StatsCycleHistorySummary,
  records: DayLogRecord[],
  now: Date,
): StatsCycleProjection {
  const today = atLocalDay(now);
  const todayValue = formatLocalDate(today);
  const pregnancyPause = resolvePregnancyPause(records);
  const cycleAnchorDate = resolveCurrentCycleAnchorDate(profile, records, todayValue);
  const lutealPhase = resolveLutealPhase(
    inferUserLutealPhase(profile, records, todayValue) ?? 0,
  );

  if (pregnancyPause) {
    return {
      cycleAnchorDate,
      currentCycleDay: null,
      currentPhase: "unknown",
      isPredictionStale: false,
      isPregnancyPaused: true,
      pregnancyTestDate: pregnancyPause,
      lutealPhase,
      nextPeriodDate: null,
      nextPeriodWindowStartDate: null,
      nextPeriodWindowEndDate: null,
      ovulationDate: null,
      predictionCycleLength: profile.cycleLength,
    };
  }

  if (!cycleAnchorDate) {
    return {
      cycleAnchorDate: null,
      currentCycleDay: null,
      currentPhase: "unknown",
      isPredictionStale: false,
      isPregnancyPaused: false,
      pregnancyTestDate: null,
      lutealPhase,
      nextPeriodDate: null,
      nextPeriodWindowStartDate: null,
      nextPeriodWindowEndDate: null,
      ovulationDate: null,
      predictionCycleLength: profile.cycleLength,
    };
  }

  const cycleAnchor = parseLocalDate(cycleAnchorDate);
  if (!cycleAnchor) {
    return {
      cycleAnchorDate: null,
      currentCycleDay: null,
      currentPhase: "unknown",
      isPredictionStale: false,
      isPregnancyPaused: false,
      pregnancyTestDate: null,
      lutealPhase,
      nextPeriodDate: null,
      nextPeriodWindowStartDate: null,
      nextPeriodWindowEndDate: null,
      ovulationDate: null,
      predictionCycleLength: profile.cycleLength,
    };
  }

  const predictionCycleLength = resolvePredictionCycleLength(profile, history);
  const currentCycleDay = diffLocalDays(cycleAnchor, today) + 1;
  const nextPeriodDate = formatLocalDate(addDays(cycleAnchor, predictionCycleLength));
  const nextPeriodWindow = resolveNextPeriodWindow(
    cycleAnchor,
    history,
    profile,
    predictionCycleLength,
  );
  const predictedWindow = predictCycleWindow(
    cycleAnchorDate,
    predictionCycleLength,
    lutealPhase,
  );

  if (profile.unpredictableCycle) {
    return {
      cycleAnchorDate,
      currentCycleDay,
      currentPhase: isPeriodLoggedOnDate(records, todayValue) ? "menstrual" : "unknown",
      isPredictionStale: false,
      isPregnancyPaused: false,
      pregnancyTestDate: null,
      lutealPhase,
      nextPeriodDate,
      nextPeriodWindowStartDate: nextPeriodWindow?.startDate ?? null,
      nextPeriodWindowEndDate: nextPeriodWindow?.endDate ?? null,
      ovulationDate: null,
      predictionCycleLength,
    };
  }

  if (!predictedWindow.calculable || !predictedWindow.ovulationDate) {
    return {
      cycleAnchorDate,
      currentCycleDay,
      currentPhase: isPeriodLoggedOnDate(records, todayValue) ? "menstrual" : "unknown",
      isPredictionStale: false,
      isPregnancyPaused: false,
      pregnancyTestDate: null,
      lutealPhase,
      nextPeriodDate,
      nextPeriodWindowStartDate: nextPeriodWindow?.startDate ?? null,
      nextPeriodWindowEndDate: nextPeriodWindow?.endDate ?? null,
      ovulationDate: null,
      predictionCycleLength,
    };
  }

  const ovulationDate = parseLocalDate(predictedWindow.ovulationDate);
  if (!ovulationDate) {
    return {
      cycleAnchorDate,
      currentCycleDay,
      currentPhase: isPeriodLoggedOnDate(records, todayValue) ? "menstrual" : "unknown",
      isPredictionStale: false,
      isPregnancyPaused: false,
      pregnancyTestDate: null,
      lutealPhase,
      nextPeriodDate,
      nextPeriodWindowStartDate: nextPeriodWindow?.startDate ?? null,
      nextPeriodWindowEndDate: nextPeriodWindow?.endDate ?? null,
      ovulationDate: null,
      predictionCycleLength,
    };
  }

  const predictedNextPeriod = parseLocalDate(nextPeriodDate);
  if (predictedNextPeriod && today > predictedNextPeriod) {
    return {
      cycleAnchorDate,
      currentCycleDay: null,
      currentPhase: isPeriodLoggedOnDate(records, todayValue) ? "menstrual" : "unknown",
      isPredictionStale: true,
      isPregnancyPaused: false,
      pregnancyTestDate: null,
      lutealPhase,
      nextPeriodDate: null,
      nextPeriodWindowStartDate: null,
      nextPeriodWindowEndDate: null,
      ovulationDate: null,
      predictionCycleLength,
    };
  }

  return {
    cycleAnchorDate,
    currentCycleDay,
    currentPhase: detectCurrentPhase(records, todayValue, today, ovulationDate),
    isPredictionStale: false,
    isPregnancyPaused: false,
    pregnancyTestDate: null,
    lutealPhase,
    nextPeriodDate,
    nextPeriodWindowStartDate: nextPeriodWindow?.startDate ?? null,
    nextPeriodWindowEndDate: nextPeriodWindow?.endDate ?? null,
    ovulationDate: predictedWindow.ovulationDate,
    predictionCycleLength,
  };
}

const MIN_OBSERVED_LUTEAL_DAYS = 10;
const MAX_OBSERVED_LUTEAL_DAYS = 20;
const MIN_OBSERVED_LUTEAL_SAMPLES = 2;
const MIN_CYCLES_FOR_LUTEAL_INFERENCE = 3;

export function inferUserLutealPhase(
  profile: ProfileRecord,
  records: DayLogRecord[],
  todayValue: string,
): number | null {
  const starts = collectCycleStartDates(profile, records, todayValue);
  if (starts.length < MIN_CYCLES_FOR_LUTEAL_INFERENCE) {
    return null;
  }

  const lutealLengths: number[] = [];
  for (let index = 0; index + 1 < starts.length; index += 1) {
    const cycleStartDate = starts[index];
    const nextStartDate = starts[index + 1];
    if (!cycleStartDate || !nextStartDate) {
      continue;
    }

    const ovulationDate = inferObservedOvulationDate(
      records,
      cycleStartDate,
      nextStartDate,
      profile.temperatureUnit,
    );
    if (!ovulationDate) {
      continue;
    }

    const ovulation = parseLocalDate(ovulationDate);
    const nextStart = parseLocalDate(nextStartDate);
    if (!ovulation || !nextStart) {
      continue;
    }

    const lutealLength = diffLocalDays(ovulation, nextStart);
    if (
      lutealLength < MIN_OBSERVED_LUTEAL_DAYS ||
      lutealLength > MAX_OBSERVED_LUTEAL_DAYS
    ) {
      continue;
    }
    lutealLengths.push(lutealLength);
  }

  if (lutealLengths.length < MIN_OBSERVED_LUTEAL_SAMPLES) {
    return null;
  }

  const average =
    lutealLengths.reduce((sum, value) => sum + value, 0) / lutealLengths.length;
  return Math.round(average);
}

function resolveNextPeriodWindow(
  cycleAnchor: Date,
  history: StatsCycleHistorySummary,
  profile: ProfileRecord,
  predictionCycleLength: number,
): { endDate: string; startDate: string } | null {
  if (profile.irregularCycle && !history.hasReliableTrend) {
    return null;
  }

  if (
    profile.irregularCycle &&
    history.hasReliableTrend &&
    history.recentCycleLengths.length > 0
  ) {
    const minLen = Math.max(Math.min(...history.recentCycleLengths), 1);
    const maxLen = Math.max(Math.max(...history.recentCycleLengths), minLen);
    return {
      startDate: formatLocalDate(addDays(cycleAnchor, Math.max(minLen, 1))),
      endDate: formatLocalDate(addDays(cycleAnchor, maxLen)),
    };
  }

  const spanDays = resolvePredictionSpanDays(history);
  if (spanDays === null) {
    return null;
  }

  return {
    startDate: formatLocalDate(
      addDays(cycleAnchor, Math.max(predictionCycleLength - spanDays, 1)),
    ),
    endDate: formatLocalDate(
      addDays(cycleAnchor, predictionCycleLength + spanDays),
    ),
  };
}

export const DATA_DRIVEN_PREDICTION_SPAN_MAX_DAYS = 5;

function resolvePredictionSpanDays(
  history: StatsCycleHistorySummary,
): number | null {
  if (history.completedCycleCount < STATS_RELIABLE_TREND_CYCLES) {
    return null;
  }
  const stdDev = computeCycleLengthStdDev(history.recentCycleLengths);
  if (!Number.isFinite(stdDev) || stdDev <= 0) {
    return null;
  }
  return Math.min(
    Math.max(Math.round(stdDev), 1),
    DATA_DRIVEN_PREDICTION_SPAN_MAX_DAYS,
  );
}

export function hasDataDrivenPredictionSpan(
  profile: ProfileRecord,
  history: StatsCycleHistorySummary,
): boolean {
  if (profile.unpredictableCycle || profile.irregularCycle) {
    return false;
  }
  return resolvePredictionSpanDays(history) !== null;
}

function computeCycleLengthStdDev(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function shouldShowIrregularityNotice(
  profile: ProfileRecord,
  history: StatsCycleHistorySummary,
): boolean {
  return (
    !profile.unpredictableCycle &&
    !profile.irregularCycle &&
    history.completedCycleCount >= STATS_RELIABLE_TREND_CYCLES &&
    history.cycleLengthSpread > IRREGULAR_CYCLE_SPREAD_DAYS
  );
}

export function shouldShowIrregularModeRecommendation(
  profile: ProfileRecord,
  history: StatsCycleHistorySummary,
): boolean {
  return shouldShowIrregularityNotice(profile, history);
}

export function shouldShowAgeVariabilityHint(profile: ProfileRecord): boolean {
  return profile.ageGroup === "age_45_plus";
}

function buildCompletedCycleSummaries(
  profile: ProfileRecord,
  records: DayLogRecord[],
  now: Date,
): CompletedCycleSummary[] {
  const todayValue = formatLocalDate(atLocalDay(now));
  const starts = collectCycleStartDates(profile, records, todayValue);
  if (starts.length < 2) {
    return [];
  }

  const recordsByDate = new Map(records.map((record) => [record.date, record]));
  const cycles: CompletedCycleSummary[] = [];

  for (let index = 0; index + 1 < starts.length; index += 1) {
    const startDate = starts[index];
    const nextStartDate = starts[index + 1];
    if (!startDate || !nextStartDate) {
      continue;
    }
    const start = parseLocalDate(startDate);
    const nextStart = parseLocalDate(nextStartDate);

    if (!start || !nextStart || nextStartDate > todayValue) {
      continue;
    }

    const cycleLength = diffLocalDays(start, nextStart);
    if (cycleLength <= 0) {
      continue;
    }

    cycles.push({
      startDate,
      nextStartDate,
      cycleLength,
      periodLength: resolveObservedPeriodLength(
        recordsByDate,
        startDate,
        profile.periodLength,
      ),
      factorKeys: collectFactorKeysForCycle(records, startDate, nextStartDate),
      comparisonKind: "variable",
    });
  }

  const baseline = resolveCycleComparisonBaseline(cycles);

  return cycles.map((cycle) => ({
    ...cycle,
    comparisonKind: classifyCycleComparison(cycle.cycleLength, baseline),
  }));
}

export function collectCycleStartDates(
  profile: ProfileRecord,
  records: DayLogRecord[],
  todayValue: string,
): string[] {
  const clusters = buildObservedPeriodClusters(profile, records, todayValue);
  const starts = clusters.flatMap((cluster) => {
    if (cluster.explicitStart) {
      return [cluster.explicitStart];
    }
    if (cluster.hasUncertainExplicit) {
      return [];
    }
    return [cluster.start];
  });

  return [...new Set(starts)].sort((left, right) => left.localeCompare(right));
}

function resolveObservedPeriodLength(
  recordsByDate: Map<string, DayLogRecord>,
  startDate: string,
  fallback: number,
): number {
  const start = parseLocalDate(startDate);
  if (!start) {
    return fallback;
  }

  let periodLength = 0;
  for (let offset = 0; offset < 10; offset += 1) {
    const currentDate = formatLocalDate(addDays(start, offset));
    if (recordsByDate.get(currentDate)?.isPeriod !== true) {
      break;
    }
    periodLength += 1;
  }

  return periodLength > 0 ? periodLength : fallback;
}

function collectFactorKeysForCycle(
  records: DayLogRecord[],
  startDate: string,
  nextStartDate: string,
): DayCycleFactorKey[] {
  const selected = new Set<DayCycleFactorKey>();

  for (const record of records) {
    if (record.date < startDate || record.date >= nextStartDate) {
      continue;
    }

    for (const key of record.cycleFactorKeys) {
      selected.add(key);
    }
  }

  return DAY_CYCLE_FACTOR_KEYS.filter((key) => selected.has(key));
}

function resolveCycleComparisonBaseline(cycles: CompletedCycleSummary[]): number {
  const lengths = cycles.map((cycle) => cycle.cycleLength);
  const median = medianInt(tailInts(lengths, STATS_CYCLE_PREDICTION_WINDOW));
  if (median > 0) {
    return median;
  }

  const average = averageInts(tailInts(lengths, STATS_CYCLE_PREDICTION_WINDOW));
  return average > 0 ? Math.round(average) : 0;
}

function classifyCycleComparison(
  cycleLength: number,
  baseline: number,
): StatsComparisonKind {
  if (baseline > 0 && cycleLength <= baseline - STATS_CYCLE_COMPARISON_DELTA) {
    return "shorter";
  }
  if (baseline > 0 && cycleLength >= baseline + STATS_CYCLE_COMPARISON_DELTA) {
    return "longer";
  }
  return "variable";
}

function buildFactorItems(
  counts: Map<DayCycleFactorKey, number>,
): StatsFactorContextItem[] {
  const items = DAY_CYCLE_FACTOR_KEYS.filter((key) => (counts.get(key) ?? 0) > 0).map(
    (key) => ({
      key,
      count: counts.get(key) ?? 0,
    }),
  );

  items.sort((left, right) => {
    if (left.count === right.count) {
      return (
        DAY_CYCLE_FACTOR_KEYS.indexOf(left.key) -
        DAY_CYCLE_FACTOR_KEYS.indexOf(right.key)
      );
    }
    return right.count - left.count;
  });

  return items.slice(0, STATS_FACTOR_CONTEXT_LIMIT);
}

function collectRecentFactorCounts(
  records: DayLogRecord[],
  now: Date,
): Map<DayCycleFactorKey, number> {
  const today = atLocalDay(now);
  const windowStart = addDays(today, -(STATS_FACTOR_CONTEXT_WINDOW_DAYS - 1));
  const counts = new Map<DayCycleFactorKey, number>();

  for (const record of records) {
    const localDay = parseLocalDate(record.date);
    if (!localDay || localDay < windowStart || localDay > today) {
      continue;
    }

    for (const key of record.cycleFactorKeys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

function buildPatternSummaries(
  cycles: CompletedCycleSummary[],
): StatsFactorPatternSummary[] {
  const buckets = new Map<StatsComparisonKind, Map<DayCycleFactorKey, number>>();
  const order: StatsComparisonKind[] = ["longer", "shorter", "variable"];

  for (const cycle of cycles) {
    if (cycle.factorKeys.length === 0) {
      continue;
    }

    const counts =
      buckets.get(cycle.comparisonKind) ?? new Map<DayCycleFactorKey, number>();
    for (const key of cycle.factorKeys) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    buckets.set(cycle.comparisonKind, counts);
  }

  const summaries: StatsFactorPatternSummary[] = [];
  for (const kind of order) {
    const counts = buckets.get(kind);
    if (!counts) {
      continue;
    }

    const items = buildFactorItems(counts).slice(0, STATS_FACTOR_PATTERN_ITEM_LIMIT);
    if (items.length === 0) {
      continue;
    }

    summaries.push({
      kind,
      items,
    });
  }

  return summaries;
}

function buildRecentCycleSummaries(
  cycles: CompletedCycleSummary[],
): StatsRecentCycleSummary[] {
  return [...cycles]
    .sort((left, right) => right.startDate.localeCompare(left.startDate))
    .slice(0, STATS_FACTOR_RECENT_CYCLE_LIMIT)
    .map((cycle) => ({
      startDate: cycle.startDate,
      endDate: buildInclusiveCycleEndDate(cycle.nextStartDate),
      cycleLength: cycle.cycleLength,
      comparisonKind: cycle.comparisonKind,
      factorKeys: [...cycle.factorKeys],
    }));
}

function buildInclusiveCycleEndDate(nextStartDate: string): string {
  const nextStart = parseLocalDate(nextStartDate);
  if (!nextStart) {
    return nextStartDate;
  }

  return formatLocalDate(addDays(nextStart, -1));
}

function resolvePredictionCycleLength(
  profile: ProfileRecord,
  history: StatsCycleHistorySummary,
): number {
  if (
    history.completedCycleCount >= STATS_MINIMUM_INSIGHTS_CYCLES &&
    history.averageCycleLength > 0
  ) {
    return Math.round(history.averageCycleLength);
  }
  if (
    history.completedCycleCount >= STATS_MINIMUM_INSIGHTS_CYCLES &&
    history.medianCycleLength > 0
  ) {
    return history.medianCycleLength;
  }
  return profile.cycleLength;
}

function resolveCurrentCycleAnchorDate(
  profile: ProfileRecord,
  records: DayLogRecord[],
  todayValue: string,
): string | null {
  return resolveLatestCycleStartAnchorBeforeOrOn(profile, records, todayValue);
}

export function resolveLatestCycleStartAnchorBeforeOrOn(
  profile: ProfileRecord,
  records: DayLogRecord[],
  dayValue: string,
): string | null {
  const starts = collectCycleStartDates(profile, records, dayValue).filter(
    (value) => value <= dayValue,
  );
  return starts.length > 0 ? (starts[starts.length - 1] ?? null) : null;
}

function detectCurrentPhase(
  records: DayLogRecord[],
  todayValue: string,
  today: Date,
  ovulationDate: Date,
): StatsCycleProjection["currentPhase"] {
  if (isPeriodLoggedOnDate(records, todayValue)) {
    return "menstrual";
  }

  const fertileWindowStart = addDays(ovulationDate, -5);
  if (sameLocalDay(today, ovulationDate)) {
    return "ovulation";
  }
  if (today >= fertileWindowStart && today <= ovulationDate) {
    return "fertile";
  }
  if (today < ovulationDate) {
    return "follicular";
  }
  return "luteal";
}

function isPeriodLoggedOnDate(records: DayLogRecord[], date: string): boolean {
  return records.some((record) => record.date === date && record.isPeriod);
}

function shouldBuildFactorContext(
  profile: ProfileRecord,
  history: StatsCycleHistorySummary,
): boolean {
  return (
    !profile.unpredictableCycle &&
    history.hasInsights &&
    isVariablePattern(profile, history)
  );
}

function isVariablePattern(
  profile: ProfileRecord,
  history: StatsCycleHistorySummary,
): boolean {
  return (
    profile.irregularCycle ||
    (history.completedCycleCount >= STATS_RELIABLE_TREND_CYCLES &&
      history.cycleLengthSpread > IRREGULAR_CYCLE_SPREAD_DAYS)
  );
}

function statsInsightProgress(completedCycleCount: number): number {
  if (completedCycleCount <= 0) {
    return 0;
  }

  return Math.min(
    Math.floor((completedCycleCount * 100) / STATS_MINIMUM_INSIGHTS_CYCLES),
    100,
  );
}

function tailInts(values: number[], limit: number): number[] {
  if (values.length <= limit) {
    return values;
  }
  return values.slice(values.length - limit);
}

function averageInts(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function medianInt(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  const left = sorted[middle - 1];
  const right = sorted[middle];
  if (left === undefined || right === undefined) {
    return 0;
  }

  return Math.round((left + right) / 2);
}

function diffLocalDays(start: Date, end: Date): number {
  return Math.round(
    (atLocalDay(end).getTime() - atLocalDay(start).getTime()) / 86400000,
  );
}

function sameLocalDay(left: Date, right: Date): boolean {
  return formatLocalDate(left) === formatLocalDate(right);
}

function resolvePregnancyPause(records: readonly DayLogRecord[]): string | null {
  let latestPositive: string | null = null;
  let latestPeriodStart: string | null = null;
  for (const record of records) {
    if (record.pregnancyTest === "positive") {
      if (!latestPositive || record.date > latestPositive) {
        latestPositive = record.date;
      }
    }
    if (record.isPeriod && record.cycleStart) {
      if (!latestPeriodStart || record.date > latestPeriodStart) {
        latestPeriodStart = record.date;
      }
    }
  }

  if (!latestPositive) {
    return null;
  }
  if (latestPeriodStart && latestPeriodStart > latestPositive) {
    return null;
  }

  return latestPositive;
}

function atLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

type ObservedPeriodCluster = {
  end: string;
  explicitStart: string | null;
  hasUncertainExplicit: boolean;
  start: string;
};

type PeriodClusterRecord = {
  cycleStart: boolean;
  date: string;
  isUncertain: boolean;
};

function buildObservedPeriodClusters(
  profile: ProfileRecord,
  records: DayLogRecord[],
  todayValue: string,
): ObservedPeriodCluster[] {
  const periodRecords: PeriodClusterRecord[] = records
    .filter((record) => record.isPeriod && record.date <= todayValue)
    .map((record) => ({
      cycleStart: record.cycleStart,
      date: record.date,
      isUncertain: record.isUncertain,
    }));

  if (profile.lastPeriodStart && profile.lastPeriodStart <= todayValue) {
    periodRecords.push({
      cycleStart: true,
      date: profile.lastPeriodStart,
      isUncertain: false,
    });
  }

  const sortedRecords = periodRecords.sort((left, right) => left.date.localeCompare(right.date));
  const clusters: ObservedPeriodCluster[] = [];

  for (const record of sortedRecords) {
    const currentDay = parseLocalDate(record.date);
    if (!currentDay) {
      continue;
    }

    if (clusters.length === 0) {
      clusters.push(createObservedPeriodCluster(record));
      continue;
    }

    const currentCluster = clusters[clusters.length - 1];
    if (!currentCluster) {
      continue;
    }

    const clusterEnd = parseLocalDate(currentCluster.end);
    if (!clusterEnd) {
      continue;
    }

    const gapDays = diffLocalDays(clusterEnd, currentDay) - 1;
    if (gapDays >= 5) {
      clusters.push(createObservedPeriodCluster(record));
      continue;
    }

    currentCluster.end = record.date;
    if (!record.cycleStart) {
      continue;
    }
    if (record.isUncertain) {
      currentCluster.hasUncertainExplicit = true;
      continue;
    }
    if (!currentCluster.explicitStart || record.date < currentCluster.explicitStart) {
      currentCluster.explicitStart = record.date;
    }
  }

  return clusters;
}

function createObservedPeriodCluster(record: PeriodClusterRecord): ObservedPeriodCluster {
  return {
    end: record.date,
    explicitStart: record.cycleStart && !record.isUncertain ? record.date : null,
    hasUncertainExplicit: record.cycleStart && record.isUncertain,
    start: record.date,
  };
}
