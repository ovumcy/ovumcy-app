import { createEmptyDayLogRecord } from "../models/day-log";
import type { StatsCycleHistorySummary } from "../models/stats";
import { buildStatsAdvancedFertility } from "./stats-advanced-fertility-service";

function createHistory(): StatsCycleHistorySummary {
  return {
    completedCycles: [
      {
        startDate: "2026-01-01",
        nextStartDate: "2026-01-29",
        cycleLength: 28,
        periodLength: 5,
        factorKeys: [],
        comparisonKind: "variable",
      },
      {
        startDate: "2026-01-29",
        nextStartDate: "2026-02-26",
        cycleLength: 28,
        periodLength: 5,
        factorKeys: [],
        comparisonKind: "variable",
      },
      {
        startDate: "2026-02-26",
        nextStartDate: "2026-03-29",
        cycleLength: 31,
        periodLength: 5,
        factorKeys: [],
        comparisonKind: "variable",
      },
    ],
    completedCycleCount: 3,
    insightProgress: 1,
    hasInsights: true,
    hasReliableTrend: true,
    recentCycleLengths: [28, 28, 31],
    averageCycleLength: 29,
    medianCycleLength: 28,
    minCycleLength: 28,
    maxCycleLength: 31,
    cycleLengthSpread: 3,
    lastCycleLength: 31,
    lastPeriodLength: 5,
  };
}

describe("buildStatsAdvancedFertility", () => {
  it("derives luteal consistency from repeated mucus signals", () => {
    const records = [
      {
        ...createEmptyDayLogRecord("2026-01-15"),
        cervicalMucus: "eggwhite" as const,
      },
      {
        ...createEmptyDayLogRecord("2026-02-11"),
        cervicalMucus: "eggwhite" as const,
      },
      {
        ...createEmptyDayLogRecord("2026-03-12"),
        cervicalMucus: "eggwhite" as const,
      },
    ];

    expect(
      buildStatsAdvancedFertility(createHistory(), records, "2026-03-29", "c"),
    ).toEqual(
      expect.objectContaining({
        observedLutealConsistency: expect.objectContaining({
          kind: "strong_variation",
          minDays: 14,
          maxDays: 17,
          spreadDays: 3,
        }),
      }),
    );
  });

  it("detects an ovulation confirmation when egg-white mucus and a thermal rise align in the current cycle", () => {
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-29"),
        bbt: 36.3,
      },
      {
        ...createEmptyDayLogRecord("2026-03-30"),
        bbt: 36.32,
        cervicalMucus: "eggwhite" as const,
      },
      {
        ...createEmptyDayLogRecord("2026-03-31"),
        bbt: 36.34,
      },
      {
        ...createEmptyDayLogRecord("2026-04-01"),
        bbt: 36.57,
      },
      {
        ...createEmptyDayLogRecord("2026-04-02"),
        bbt: 36.6,
      },
      {
        ...createEmptyDayLogRecord("2026-04-03"),
        bbt: 36.63,
      },
    ];

    expect(
      buildStatsAdvancedFertility(createHistory(), records, "2026-03-29", "c"),
    ).toEqual(
      expect.objectContaining({
        ovulationConfirmation: {
          kind: "confirmed",
          gapDays: 4,
          mucusDate: "2026-03-30",
        },
      }),
    );
  });

  it("detects an LH peak aligned with a thermal rise in the current cycle", () => {
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-29"),
        bbt: 36.3,
      },
      {
        ...createEmptyDayLogRecord("2026-03-30"),
        bbt: 36.32,
        lhTest: "peak" as const,
        pregnancyTest: "none" as const,
      },
      {
        ...createEmptyDayLogRecord("2026-03-31"),
        bbt: 36.34,
      },
      {
        ...createEmptyDayLogRecord("2026-04-01"),
        bbt: 36.57,
      },
      {
        ...createEmptyDayLogRecord("2026-04-02"),
        bbt: 36.6,
      },
      {
        ...createEmptyDayLogRecord("2026-04-03"),
        bbt: 36.63,
      },
    ];

    expect(
      buildStatsAdvancedFertility(createHistory(), records, "2026-03-29", "c"),
    ).toEqual(
      expect.objectContaining({
        lhPeakSignal: {
          kind: "aligned",
          date: "2026-03-30",
          gapDays: 4,
        },
      }),
    );
  });
});
