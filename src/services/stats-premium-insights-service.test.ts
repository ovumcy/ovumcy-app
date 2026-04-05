import type { StatsCycleHistorySummary } from "../models/stats";
import { buildStatsPremiumInsights } from "./stats-premium-insights-service";

function createHistory(
  cycleLengths: readonly number[],
  startDates: readonly string[],
): StatsCycleHistorySummary {
  return {
    completedCycles: cycleLengths.map((cycleLength, index) => ({
      startDate: startDates[index] ?? `2026-01-${String(index + 1).padStart(2, "0")}`,
      nextStartDate:
        startDates[index + 1] ?? `2026-02-${String(index + 1).padStart(2, "0")}`,
      cycleLength,
      periodLength: 5,
      factorKeys: [],
      comparisonKind: "variable",
    })),
    completedCycleCount: cycleLengths.length,
    insightProgress: 1,
    hasInsights: cycleLengths.length >= 2,
    hasReliableTrend: cycleLengths.length >= 3,
    recentCycleLengths: [...cycleLengths],
    averageCycleLength:
      cycleLengths.reduce((total, value) => total + value, 0) /
      Math.max(cycleLengths.length, 1),
    medianCycleLength: cycleLengths[Math.floor(cycleLengths.length / 2)] ?? 0,
    minCycleLength: Math.min(...cycleLengths),
    maxCycleLength: Math.max(...cycleLengths),
    cycleLengthSpread:
      Math.max(...cycleLengths) - Math.min(...cycleLengths),
    lastCycleLength: cycleLengths[cycleLengths.length - 1] ?? 0,
    lastPeriodLength: 5,
  };
}

describe("buildStatsPremiumInsights", () => {
  it("detects a seasonal pattern from completed cycle history", () => {
    const history = createHistory(
      [28, 28, 28, 28, 28, 38],
      [
        "2025-10-01",
        "2025-10-29",
        "2025-11-26",
        "2025-12-24",
        "2026-01-21",
        "2026-02-18",
      ],
    );

    expect(buildStatsPremiumInsights(history).seasonalPattern).toEqual(
      expect.objectContaining({
        longestSeason: "winter",
        shortestSeason: "autumn",
      }),
    );
  });
});
