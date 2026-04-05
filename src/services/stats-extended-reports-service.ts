import type {
  StatsComparisonKind,
  StatsCycleHistorySummary,
} from "../models/stats";

export type StatsExtendedReportRow = {
  comparisonKind: StatsComparisonKind;
  cycleLength: number;
  key: string;
  periodLength: number;
  startDate: string;
};

export type StatsExtendedReportsSummary = {
  maxCycleLength: number;
  minCycleLength: number;
  rowCount: number;
  rows: StatsExtendedReportRow[];
};

const EXTENDED_REPORT_ROW_LIMIT = 6;

export function buildStatsExtendedReports(
  history: StatsCycleHistorySummary,
): StatsExtendedReportsSummary | null {
  if (history.completedCycles.length < 2) {
    return null;
  }

  const rows = history.completedCycles
    .slice(-EXTENDED_REPORT_ROW_LIMIT)
    .map((cycle) => ({
      comparisonKind: cycle.comparisonKind,
      cycleLength: cycle.cycleLength,
      key: cycle.startDate,
      periodLength: cycle.periodLength,
      startDate: cycle.startDate,
    }))
    .reverse();

  return {
    maxCycleLength: Math.max(...rows.map((row) => row.cycleLength)),
    minCycleLength: Math.min(...rows.map((row) => row.cycleLength)),
    rowCount: rows.length,
    rows,
  };
}
