import type { DayCycleFactorKey } from "./day-log";
import type { LocalDateISO } from "./profile";
import type { SymptomID } from "./symptom";

export const STATS_MINIMUM_INSIGHTS_CYCLES = 2;
export const STATS_RELIABLE_TREND_CYCLES = 3;
export const STATS_CYCLE_PREDICTION_WINDOW = 6;
export const STATS_FACTOR_CONTEXT_WINDOW_DAYS = 90;
export const STATS_FACTOR_CONTEXT_LIMIT = 3;
export const STATS_FACTOR_PATTERN_ITEM_LIMIT = 2;
export const STATS_FACTOR_RECENT_CYCLE_LIMIT = 3;
export const STATS_CYCLE_COMPARISON_DELTA = 2;
export const IRREGULAR_CYCLE_SPREAD_DAYS = 7;
export const STATS_TREND_POINT_LIMIT = 6;
export const STATS_SYMPTOM_FREQUENCY_LIMIT = 6;
export const STATS_LAST_CYCLE_SYMPTOMS_LIMIT = 5;
export const STATS_SYMPTOM_PATTERN_LIMIT = 4;
export const STATS_PHASE_SYMPTOM_LIMIT = 3;
export const STATS_BBT_POINT_LIMIT = 12;

export type StatsPhase =
  | "unknown"
  | "menstrual"
  | "follicular"
  | "fertile"
  | "ovulation"
  | "luteal";

export type StatsComparisonKind = "shorter" | "longer" | "variable";
export type StatsReliabilityKind = "early" | "building" | "stable" | "variable";

export type CompletedCycleSummary = {
  startDate: LocalDateISO;
  nextStartDate: LocalDateISO;
  cycleLength: number;
  periodLength: number;
  factorKeys: DayCycleFactorKey[];
  comparisonKind: StatsComparisonKind;
};

export type StatsFactorContextItem = {
  key: DayCycleFactorKey;
  count: number;
};

export type StatsFactorPatternSummary = {
  kind: StatsComparisonKind;
  items: StatsFactorContextItem[];
};

export type StatsRecentCycleSummary = {
  startDate: LocalDateISO;
  endDate: LocalDateISO;
  cycleLength: number;
  comparisonKind: StatsComparisonKind;
  factorKeys: DayCycleFactorKey[];
};

export type StatsReliabilityState = {
  sampleCount: number;
  usesRecentWindow: boolean;
  kind: StatsReliabilityKind;
  hintKind: "default" | "variable";
};

export type StatsCycleHistorySummary = {
  completedCycles: CompletedCycleSummary[];
  completedCycleCount: number;
  insightProgress: number;
  hasInsights: boolean;
  hasReliableTrend: boolean;
  recentCycleLengths: number[];
  averageCycleLength: number;
  medianCycleLength: number;
  minCycleLength: number;
  maxCycleLength: number;
  cycleLengthSpread: number;
  lastCycleLength: number;
  lastPeriodLength: number;
};

export type StatsFactorContext = {
  recentFactors: StatsFactorContextItem[];
  patternSummaries: StatsFactorPatternSummary[];
  recentCycles: StatsRecentCycleSummary[];
  hintFactorKeys: DayCycleFactorKey[];
};

export type StatsCycleProjection = {
  cycleAnchorDate: LocalDateISO | null;
  currentCycleDay: number | null;
  currentPhase: StatsPhase;
  nextPeriodDate: LocalDateISO | null;
  ovulationDate: LocalDateISO | null;
  predictionCycleLength: number;
};

export type StatsTrendPoint = {
  key: LocalDateISO;
  label: string;
  value: number;
};

export type StatsSymptomFrequencyItem = {
  id: SymptomID;
  label: string;
  icon: string;
  count: number;
  frequencySummary: string;
};

export type StatsSymptomPattern = {
  id: SymptomID;
  label: string;
  icon: string;
  dayStart: number;
  dayEnd: number;
  occurrenceCount: number;
};

export type StatsPhaseMoodInsight = {
  phase: StatsPhase;
  hasData: boolean;
  averageMood: number;
  percentage: number;
  entryCount: number;
};

export type StatsPhaseSymptomInsightItem = {
  id: SymptomID;
  label: string;
  icon: string;
  percentage: number;
  count: number;
};

export type StatsPhaseSymptomInsight = {
  phase: StatsPhase;
  hasData: boolean;
  totalDays: number;
  items: StatsPhaseSymptomInsightItem[];
};

export type StatsBBTPoint = {
  key: LocalDateISO;
  label: string;
  cycleDay: number;
  value: number;
};
