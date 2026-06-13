import { createEmptyDayLogRecord } from "../models/day-log";
import type { StatsCycleHistorySummary } from "../models/stats";
import { buildCurrentCycleAdvancedFertilitySummary } from "./current-cycle-advanced-fertility-summary-service";

function createHistory(): StatsCycleHistorySummary {
  return {
    completedCycles: [
      {
        startDate: "2026-01-01",
        nextStartDate: "2026-01-29",
        cycleLength: 28,
        periodLength: 5,
        observedPeriodLength: 5,
        factorKeys: [],
        comparisonKind: "variable",
      },
      {
        startDate: "2026-01-29",
        nextStartDate: "2026-02-26",
        cycleLength: 28,
        periodLength: 5,
        observedPeriodLength: 5,
        factorKeys: [],
        comparisonKind: "variable",
      },
      {
        startDate: "2026-02-26",
        nextStartDate: "2026-03-29",
        cycleLength: 31,
        periodLength: 5,
        observedPeriodLength: 5,
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

describe("buildCurrentCycleAdvancedFertilitySummary", () => {
  it("prefers ovulation confirmation over lower-priority fertility signals", () => {
    // Baseline window 03-29..04-02 stays flat; the sustained streak starts on
    // 04-03, so the canonical detector anchors the shift after the baseline.
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-29"),
        bbt: 36.3,
      },
      {
        ...createEmptyDayLogRecord("2026-03-30"),
        bbt: 36.31,
      },
      {
        ...createEmptyDayLogRecord("2026-03-31"),
        bbt: 36.29,
      },
      {
        ...createEmptyDayLogRecord("2026-04-01"),
        bbt: 36.3,
        cervicalMucus: "eggwhite" as const,
        lhTest: "peak" as const,
        pregnancyTest: "none" as const,
      },
      {
        ...createEmptyDayLogRecord("2026-04-02"),
        bbt: 36.3,
      },
      {
        ...createEmptyDayLogRecord("2026-04-03"),
        bbt: 36.55,
      },
      {
        ...createEmptyDayLogRecord("2026-04-04"),
        bbt: 36.56,
      },
      {
        ...createEmptyDayLogRecord("2026-04-05"),
        bbt: 36.57,
      },
    ];

    expect(
      buildCurrentCycleAdvancedFertilitySummary(
        createHistory(),
        records,
        "2026-03-29",
        "c",
      ),
    ).toEqual(
      expect.objectContaining({
        key: "ovulation-confirmation",
        value: "Signals aligned",
        hint:
          "This usually means ovulation likely happened recently and the fertile window may be closing.",
        tone: "success",
      }),
    );
  });

  it("falls back to a thermal-shift summary when no LH or mucus signal exists", () => {
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-29"),
        bbt: 36.3,
      },
      {
        ...createEmptyDayLogRecord("2026-03-30"),
        bbt: 36.31,
      },
      {
        ...createEmptyDayLogRecord("2026-03-31"),
        bbt: 36.29,
      },
      {
        ...createEmptyDayLogRecord("2026-04-01"),
        bbt: 36.3,
      },
      {
        ...createEmptyDayLogRecord("2026-04-02"),
        bbt: 36.3,
      },
      {
        ...createEmptyDayLogRecord("2026-04-03"),
        bbt: 36.55,
      },
      {
        ...createEmptyDayLogRecord("2026-04-04"),
        bbt: 36.56,
      },
      {
        ...createEmptyDayLogRecord("2026-04-05"),
        bbt: 36.57,
      },
    ];

    expect(
      buildCurrentCycleAdvancedFertilitySummary(
        createHistory(),
        records,
        "2026-03-29",
        "c",
      ),
    ).toEqual(
      expect.objectContaining({
        key: "thermal-shift",
        value: "Confirmed",
        hint:
          "A sustained rise usually means ovulation may have happened recently. Keep logging to confirm it stays elevated.",
        tone: "success",
      }),
    );
  });

  it("hides the summary when the selected day is outside the current cycle", () => {
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-30"),
        bbt: 36.32,
        cervicalMucus: "eggwhite" as const,
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
      buildCurrentCycleAdvancedFertilitySummary(
        createHistory(),
        records,
        "2026-03-29",
        "c",
        "en",
        {
          visibleDate: "2026-03-20",
        },
      ),
    ).toBeNull();
  });
});
