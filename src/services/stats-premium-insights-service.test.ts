import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import type { StatsCycleHistorySummary } from "../models/stats";
import {
  buildShortLutealHint,
  buildStatsPremiumInsights,
} from "./stats-premium-insights-service";

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
      observedPeriodLength: 5,
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

function eggWhiteRecord(date: string): DayLogRecord {
  return {
    ...createEmptyDayLogRecord(date),
    cervicalMucus: "eggwhite",
  };
}

describe("buildShortLutealHint", () => {
  it("returns null when fewer than 3 cycles have an observed luteal anchor", () => {
    const history = createHistory(
      [25, 25],
      ["2025-12-01", "2025-12-26", "2026-01-20"],
    );
    const records: DayLogRecord[] = [
      eggWhiteRecord("2025-12-20"),
      eggWhiteRecord("2026-01-15"),
    ];

    expect(buildShortLutealHint(history, records)).toBeNull();
  });

  it("returns null when at least one observed luteal phase is 10 days or longer", () => {
    const history = createHistory(
      [25, 25, 30],
      ["2025-12-01", "2025-12-26", "2026-01-20", "2026-02-19"],
    );
    const records: DayLogRecord[] = [
      eggWhiteRecord("2025-12-20"),
      eggWhiteRecord("2026-01-15"),
      eggWhiteRecord("2026-02-05"),
    ];

    expect(buildShortLutealHint(history, records)).toBeNull();
  });

  it("returns the average and observation count when 3+ observed luteal phases are all under 10 days", () => {
    const history = createHistory(
      [25, 25, 25],
      ["2025-12-01", "2025-12-26", "2026-01-20", "2026-02-14"],
    );
    const records: DayLogRecord[] = [
      eggWhiteRecord("2025-12-20"),
      eggWhiteRecord("2026-01-15"),
      eggWhiteRecord("2026-02-09"),
    ];

    const result = buildShortLutealHint(history, records);
    expect(result?.observationCount).toBe(3);
    expect(result?.averageDays).toBeCloseTo(16 / 3, 5);
  });

  it("uses LH peak as an anchor when present, ignoring egg-white when the LH peak is later", () => {
    const history = createHistory(
      [25, 25, 25],
      ["2025-12-01", "2025-12-26", "2026-01-20", "2026-02-14"],
    );
    const records: DayLogRecord[] = [
      eggWhiteRecord("2025-12-15"),
      { ...createEmptyDayLogRecord("2025-12-21"), lhTest: "peak" },
      eggWhiteRecord("2026-01-10"),
      { ...createEmptyDayLogRecord("2026-01-16"), lhTest: "peak" },
      eggWhiteRecord("2026-02-04"),
      { ...createEmptyDayLogRecord("2026-02-10"), lhTest: "peak" },
    ];

    const result = buildShortLutealHint(history, records);
    expect(result?.observationCount).toBe(3);
    expect(result?.averageDays).toBeCloseTo(13 / 3, 5);
  });
});
