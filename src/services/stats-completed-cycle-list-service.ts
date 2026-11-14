import type { StatsCycleHistorySummary } from "../models/stats";

export type StatsCompletedCycleListRow = {
  cycleLength: number;
  key: string;
  periodLength: number;
  startDate: string;
};

// Mirrors the web Insights cycle stack: the latest four completed cycles, shown
// once at least two exist.
export const STATS_COMPLETED_CYCLE_LIST_LIMIT = 4;
export const STATS_COMPLETED_CYCLE_LIST_MIN_CYCLES = 2;

// Free-tier list of recorded cycles, newest first. Only observed facts are
// carried (start, length, period length); the typical/variable comparison
// classification stays with the extended reports.
export function buildStatsCompletedCycleList(
  history: StatsCycleHistorySummary,
): StatsCompletedCycleListRow[] {
  if (history.completedCycles.length < STATS_COMPLETED_CYCLE_LIST_MIN_CYCLES) {
    return [];
  }

  return history.completedCycles
    .slice(-STATS_COMPLETED_CYCLE_LIST_LIMIT)
    .map((cycle) => ({
      cycleLength: cycle.cycleLength,
      key: cycle.startDate,
      periodLength: cycle.periodLength,
      startDate: cycle.startDate,
    }))
    .reverse();
}
