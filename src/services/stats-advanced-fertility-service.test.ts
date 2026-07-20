import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import type { StatsCycleHistorySummary } from "../models/stats";
import { inferObservedOvulationDate } from "./observed-ovulation-service";
import { buildStatsAdvancedFertility } from "./stats-advanced-fertility-service";

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

function bbt(date: string, value: number): DayLogRecord {
  return { ...createEmptyDayLogRecord(date), bbt: value };
}

function lhPeak(date: string): DayLogRecord {
  return { ...createEmptyDayLogRecord(date), lhTest: "peak" };
}

// A canonical "3-over-6" sustained thermal shift in the current cycle (start
// 2026-03-29): six coverline days at 36.30 then a 3-day elevated streak
// 04-04..04-06 clearing the coverline + 0.2 margin, so the shift (first
// elevated) day is 2026-04-04. The extra elevated reading after the streak
// (04-07) must NOT move the confirmation gap, which is measured to the shift day.
function currentCycleShiftRecords(): DayLogRecord[] {
  return [
    bbt("2026-03-29", 36.3),
    bbt("2026-03-30", 36.3),
    bbt("2026-03-31", 36.3),
    bbt("2026-04-01", 36.3),
    bbt("2026-04-02", 36.3),
    bbt("2026-04-03", 36.3),
    bbt("2026-04-04", 36.55),
    bbt("2026-04-05", 36.56),
    bbt("2026-04-06", 36.57),
    bbt("2026-04-07", 36.58),
  ];
}

describe("buildStatsAdvancedFertility", () => {
  it("derives luteal consistency from a true ovulation anchor (LH peak) per cycle", () => {
    // Mucus-only cycles are skipped for luteal (review 1.4). Anchor on LH peaks:
    // C1 2026-01-15 -> 2026-01-29 = 14d; C2 2026-02-11 -> 2026-02-26 = 15d;
    // C3 2026-03-12 -> 2026-03-29 = 17d. min 14, max 17, spread 3.
    const records = [lhPeak("2026-01-15"), lhPeak("2026-02-11"), lhPeak("2026-03-12")];

    expect(
      buildStatsAdvancedFertility(createHistory(), records, "2026-03-29"),
    ).toEqual(
      expect.objectContaining({
        observedLutealConsistency: expect.objectContaining({
          kind: "strong_variation",
          minDays: 14,
          maxDays: 17,
          spreadDays: 3,
        }),
        observedLutealSampleCount: 3,
      }),
    );
  });

  it("skips a mucus-only cycle for luteal computation (no BBT shift, no LH peak)", () => {
    // Egg-white alone is not a luteal anchor; the cycle contributes signal
    // coverage but no observed luteal value.
    const records = [
      { ...createEmptyDayLogRecord("2026-01-15"), cervicalMucus: "eggwhite" as const },
      { ...createEmptyDayLogRecord("2026-02-11"), cervicalMucus: "eggwhite" as const },
      { ...createEmptyDayLogRecord("2026-03-12"), cervicalMucus: "eggwhite" as const },
    ];

    expect(
      buildStatsAdvancedFertility(createHistory(), records, "2026-03-29"),
    ).toEqual(
      expect.objectContaining({
        observedLutealSampleCount: 0,
        observedLutealAverageDays: null,
        observedLutealConsistency: null,
        signalCoverageCount: 3,
      }),
    );
  });

  it("includes a cycle whose observed luteal phase is exactly the 10-day floor", () => {
    // LH peak 2026-01-19 -> next start 2026-01-29 = 10d (inclusive lower bound).
    const records = [lhPeak("2026-01-19")];

    expect(
      buildStatsAdvancedFertility(createHistory(), records, "2026-03-29"),
    ).toEqual(
      expect.objectContaining({
        observedLutealSampleCount: 1,
        observedLutealAverageDays: 10,
      }),
    );
  });

  it("measures the ovulation-confirmation gap to the thermal-shift day, not the last BBT record", () => {
    // Egg-white on 2026-04-02, shift day 2026-04-04 => gap 2. The extra elevated
    // BBT day (04-07) after the shift does not change the gap.
    const records = [
      ...currentCycleShiftRecords(),
      { ...createEmptyDayLogRecord("2026-04-02"), cervicalMucus: "eggwhite" as const },
    ];

    expect(
      buildStatsAdvancedFertility(createHistory(), records, "2026-03-29"),
    ).toEqual(
      expect.objectContaining({
        ovulationConfirmation: {
          kind: "confirmed",
          gapDays: 2,
          mucusDate: "2026-04-02",
        },
      }),
    );
  });

  it("aligns an LH peak only when the thermal-shift day is within the LH-peak window", () => {
    // LH peak 2026-04-02, shift day 2026-04-04 => gap 2 -> aligned.
    const records = [
      ...currentCycleShiftRecords(),
      lhPeak("2026-04-02"),
    ];

    expect(
      buildStatsAdvancedFertility(createHistory(), records, "2026-03-29"),
    ).toEqual(
      expect.objectContaining({
        lhPeakSignal: {
          kind: "aligned",
          date: "2026-04-02",
          gapDays: 2,
        },
      }),
    );
  });

  it("keeps the LH peak logged (not aligned) when the shift day is more than 4 days after it", () => {
    // LH peak on the cycle-start day 2026-03-29 is 6 days before the shift day
    // 2026-04-04 (> 4) -> logged, gap null.
    const records = [
      ...currentCycleShiftRecords(),
      lhPeak("2026-03-29"),
    ];

    expect(
      buildStatsAdvancedFertility(createHistory(), records, "2026-03-29"),
    ).toEqual(
      expect.objectContaining({
        lhPeakSignal: {
          kind: "logged",
          date: "2026-03-29",
          gapDays: null,
        },
      }),
    );
  });

  it("agrees with inferObservedOvulationDate on the same current-cycle data", () => {
    // Both the calendar marker and the advanced panel derive from the same
    // detected shift: inferObservedOvulationDate returns the ovulation day (the
    // day BEFORE the first elevated day, 2026-04-03), while the confirmation gap
    // is measured to the shift day itself (2026-04-04).
    const records = currentCycleShiftRecords();
    const calendarOvulation = inferObservedOvulationDate(
      records,
      "2026-03-29",
      "2026-04-26",
    );
    expect(calendarOvulation).toBe("2026-04-03");

    const withMucus = [
      ...records,
      { ...createEmptyDayLogRecord("2026-04-02"), cervicalMucus: "eggwhite" as const },
    ];
    const summary = buildStatsAdvancedFertility(createHistory(), withMucus, "2026-03-29");
    // gap = mucus 2026-04-02 -> thermal-shift day 2026-04-04 = 2.
    expect(summary?.ovulationConfirmation?.gapDays).toBe(2);
    expect(summary?.thermalShift?.kind).toBe("confirmed");
  });

  it("does not emit a confirmed shift with only 4 BBT readings (below the canonical 5-reading baseline)", () => {
    const records = [
      bbt("2026-03-29", 36.3),
      bbt("2026-03-30", 36.3),
      bbt("2026-03-31", 36.7),
      bbt("2026-04-01", 36.7),
    ];

    const summary = buildStatsAdvancedFertility(createHistory(), records, "2026-03-29");
    expect(summary?.thermalShift ?? null).toBeNull();
    expect(summary?.ovulationConfirmation ?? null).toBeNull();
  });
});
