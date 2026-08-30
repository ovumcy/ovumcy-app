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
  describe("seasonalPattern", () => {
    it("detects a seasonal pattern when each compared season has at least two cycles", () => {
      // autumn: 3 cycles avg 28; winter: 3 cycles avg (28+28+38)/3.
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

    it("returns null with only one cycle per season", () => {
      // autumn(1), winter(1), spring(1) -> no season clears the 2-cycle floor.
      const history = createHistory(
        [28, 30, 34],
        ["2025-10-01", "2025-12-01", "2026-03-01"],
      );

      expect(buildStatsPremiumInsights(history).seasonalPattern).toBeNull();
    });

    it("fires with two cycles in each of two seasons (2 + 2)", () => {
      // autumn: [28,28] avg 28; winter: [34,34] avg 34; delta 6 >= 1.5.
      const history = createHistory(
        [28, 28, 34, 34],
        ["2025-10-01", "2025-10-29", "2025-12-01", "2025-12-29"],
      );

      expect(buildStatsPremiumInsights(history).seasonalPattern).toEqual(
        expect.objectContaining({
          shortestSeason: "autumn",
          shortestAverage: 28,
          longestSeason: "winter",
          longestAverage: 34,
          deltaDays: 6,
        }),
      );
    });
  });

  describe("anomalousCycle", () => {
    it("fires at exactly the +4 day delta against the prior-window median", () => {
      // prior [28,28,28] median 28; last 32 -> delta exactly 4 -> fires.
      const history = createHistory(
        [28, 28, 28, 32],
        ["2025-11-01", "2025-11-29", "2025-12-27", "2026-01-24"],
      );

      expect(buildStatsPremiumInsights(history).anomalousCycle).toEqual({
        baselineLength: 28,
        cycleLength: 32,
        deltaDays: 4,
        kind: "longer",
      });
    });

    it("does not fire just below the 4 day delta (delta 3)", () => {
      // prior [28,28,28] median 28; last 31 -> delta 3 < 4 -> null.
      const history = createHistory(
        [28, 28, 28, 31],
        ["2025-11-01", "2025-11-29", "2025-12-27", "2026-01-24"],
      );

      expect(buildStatsPremiumInsights(history).anomalousCycle).toBeNull();
    });

    it("uses the unweighted median (not a weighted average) as the baseline", () => {
      // prior [26,26,26,40]; weighted avg would be pulled up toward 40 and the
      // last value 30 would not look anomalous, but the median is 26 so the
      // last cycle 30 is +4 -> fires against the median.
      const history = createHistory(
        [26, 26, 26, 40, 30],
        [
          "2025-09-01",
          "2025-09-27",
          "2025-10-23",
          "2025-11-18",
          "2025-12-28",
        ],
      );

      const anomaly = buildStatsPremiumInsights(history).anomalousCycle;
      expect(anomaly?.baselineLength).toBe(26);
      expect(anomaly?.deltaDays).toBe(4);
      expect(anomaly?.kind).toBe("longer");
    });
  });

  describe("patternDrift", () => {
    it("is skipped with exactly five cycles (incomplete baseline window)", () => {
      // Needs RECENT(3) + BASELINE(3) = 6 cycles; 5 -> null.
      const history = createHistory(
        [28, 28, 28, 30, 30],
        [
          "2025-09-01",
          "2025-09-29",
          "2025-10-27",
          "2025-11-24",
          "2025-12-22",
        ],
      );

      expect(buildStatsPremiumInsights(history).patternDrift).toBeNull();
    });

    it("computes drift once a full equal-size baseline window exists (six cycles)", () => {
      // baseline [28,28,28] avg 28; recent [32,32,32] avg 32; delta 4 -> strong.
      const history = createHistory(
        [28, 28, 28, 32, 32, 32],
        [
          "2025-08-01",
          "2025-08-29",
          "2025-09-26",
          "2025-10-24",
          "2025-11-21",
          "2025-12-19",
        ],
      );

      expect(buildStatsPremiumInsights(history).patternDrift).toEqual({
        baselineAverage: 28,
        recentAverage: 32,
        deltaDays: 4,
        kind: "strong_drift",
      });
    });
  });
});

function eggWhiteRecord(date: string): DayLogRecord {
  return {
    ...createEmptyDayLogRecord(date),
    cervicalMucus: "eggwhite",
  };
}

function lhPeakRecord(date: string): DayLogRecord {
  return {
    ...createEmptyDayLogRecord(date),
    lhTest: "peak",
  };
}

describe("buildShortLutealHint", () => {
  it("returns null when fewer than 3 cycles have a true ovulation anchor", () => {
    const history = createHistory(
      [25, 25],
      ["2025-12-01", "2025-12-26", "2026-01-20"],
    );
    const records: DayLogRecord[] = [
      lhPeakRecord("2025-12-20"),
      lhPeakRecord("2026-01-15"),
    ];

    expect(buildShortLutealHint(history, records)).toBeNull();
  });

  it("returns null when at least one observed luteal phase is 10 days or longer", () => {
    // C1 LH 2025-12-20 -> 2025-12-26 = 6; C2 LH 2026-01-15 -> 2026-01-20 = 5;
    // C3 LH 2026-02-05 -> 2026-02-19 = 14 (>= 10). Not all short -> null.
    const history = createHistory(
      [25, 25, 30],
      ["2025-12-01", "2025-12-26", "2026-01-20", "2026-02-19"],
    );
    const records: DayLogRecord[] = [
      lhPeakRecord("2025-12-20"),
      lhPeakRecord("2026-01-15"),
      lhPeakRecord("2026-02-05"),
    ];

    expect(buildShortLutealHint(history, records)).toBeNull();
  });

  it("treats a luteal phase of exactly 10 days as not short", () => {
    // All three luteal phases are exactly 10 days -> none short -> null. The
    // threshold bounds the days that FOLLOW ovulation, so each peak sits on
    // cycle day 15 of a 25-day cycle; the calendar span to the next start is 11.
    const history = createHistory(
      [25, 25, 25],
      ["2025-12-01", "2025-12-26", "2026-01-20", "2026-02-14"],
    );
    const records: DayLogRecord[] = [
      lhPeakRecord("2025-12-15"), // cycle day 15 of 25 -> 10
      lhPeakRecord("2026-01-09"), // cycle day 15 of 25 -> 10
      lhPeakRecord("2026-02-03"), // cycle day 15 of 25 -> 10
    ];

    expect(buildShortLutealHint(history, records)).toBeNull();
  });

  it("fires when all observed luteal phases are 9 days (just under the threshold)", () => {
    // All three luteal phases are 9 days -> short -> fires.
    const history = createHistory(
      [25, 25, 25],
      ["2025-12-01", "2025-12-26", "2026-01-20", "2026-02-14"],
    );
    const records: DayLogRecord[] = [
      lhPeakRecord("2025-12-16"), // cycle day 16 of 25 -> 9
      lhPeakRecord("2026-01-10"), // cycle day 16 of 25 -> 9
      lhPeakRecord("2026-02-04"), // cycle day 16 of 25 -> 9
    ];

    const result = buildShortLutealHint(history, records);
    expect(result?.observationCount).toBe(3);
    expect(result?.averageDays).toBe(9);
  });

  it("returns the average and count when 3+ observed luteal phases are all under 10 days", () => {
    // C1 LH on cycle day 20 of 25 -> 5; C2 cycle day 21 of 25 -> 4;
    // C3 cycle day 21 of 25 -> 4.
    const history = createHistory(
      [25, 25, 25],
      ["2025-12-01", "2025-12-26", "2026-01-20", "2026-02-14"],
    );
    const records: DayLogRecord[] = [
      lhPeakRecord("2025-12-20"),
      lhPeakRecord("2026-01-15"),
      lhPeakRecord("2026-02-09"),
    ];

    const result = buildShortLutealHint(history, records);
    expect(result?.observationCount).toBe(3);
    expect(result?.averageDays).toBeCloseTo(13 / 3, 5);
  });

  it("fires on 3-of-6 short cycles, excluding mucus-only cycles from the observation set", () => {
    // 3 short LH-anchored cycles + 3 mucus-only cycles. Mucus-only cycles are
    // not observed luteal anchors, so the observation set is the 3 short cycles
    // and "every observed cycle is short" holds.
    const history = createHistory(
      [25, 25, 25, 25, 25, 25],
      [
        "2025-09-01",
        "2025-09-26",
        "2025-10-21",
        "2025-11-15",
        "2025-12-10",
        "2026-01-04",
        "2026-01-29",
      ],
    );
    const records: DayLogRecord[] = [
      lhPeakRecord("2025-09-20"), // cycle day 20 of 25 -> 5
      lhPeakRecord("2025-10-15"), // cycle day 20 of 25 -> 5
      lhPeakRecord("2025-11-09"), // cycle day 20 of 25 -> 5
      eggWhiteRecord("2025-12-05"), // mucus-only cycle 4 -> skipped
      eggWhiteRecord("2025-12-30"), // mucus-only cycle 5 -> skipped
      eggWhiteRecord("2026-01-24"), // mucus-only cycle 6 -> skipped
    ];

    const result = buildShortLutealHint(history, records);
    expect(result?.observationCount).toBe(3);
    expect(result?.averageDays).toBe(5);
  });

  it("uses LH peak as an anchor when present, ignoring egg-white when the LH peak is later", () => {
    const history = createHistory(
      [25, 25, 25],
      ["2025-12-01", "2025-12-26", "2026-01-20", "2026-02-14"],
    );
    const records: DayLogRecord[] = [
      eggWhiteRecord("2025-12-15"),
      lhPeakRecord("2025-12-21"),
      eggWhiteRecord("2026-01-10"),
      lhPeakRecord("2026-01-16"),
      eggWhiteRecord("2026-02-04"),
      lhPeakRecord("2026-02-10"),
    ];

    const result = buildShortLutealHint(history, records);
    expect(result?.observationCount).toBe(3);
    expect(result?.averageDays).toBeCloseTo(10 / 3, 5);
  });

  it("prefers the BBT thermal-shift ovulation day over the LH peak as the luteal anchor", () => {
    // Each cycle has a clean "3-over-6" shift (six coverline days then a 3-day
    // elevated streak). The luteal anchor is the ovulation DAY (the day before
    // the first elevated day), which gives a short luteal, plus an early LH peak
    // that would give a LONGER (>= 10) luteal if it were used. The warning fires
    // only because the BBT ovulation day takes precedence over the LH peak.
    // The declared lengths must agree with the start dates: production derives
    // a cycle's length from exactly this pair, so a summary where they differ
    // cannot occur and would only test the fixture.
    const history = createHistory(
      [21, 21, 21],
      ["2026-01-01", "2026-01-22", "2026-02-12", "2026-03-05"],
    );
    const shiftCycle = (
      base: readonly string[],
      lhDate: string,
    ): DayLogRecord[] => [
      { ...createEmptyDayLogRecord(base[0] ?? ""), bbt: 36.3 },
      { ...createEmptyDayLogRecord(base[1] ?? ""), bbt: 36.3 },
      { ...createEmptyDayLogRecord(base[2] ?? ""), bbt: 36.3 },
      { ...createEmptyDayLogRecord(base[3] ?? ""), bbt: 36.3 },
      { ...createEmptyDayLogRecord(base[4] ?? ""), bbt: 36.3 },
      { ...createEmptyDayLogRecord(base[5] ?? ""), bbt: 36.3 },
      { ...createEmptyDayLogRecord(base[6] ?? ""), bbt: 36.55 },
      { ...createEmptyDayLogRecord(base[7] ?? ""), bbt: 36.56 },
      { ...createEmptyDayLogRecord(base[8] ?? ""), bbt: 36.57 },
      lhPeakRecord(lhDate),
    ];
    const records: DayLogRecord[] = [
      // C1: shift day 2026-01-14, ovulation 2026-01-13 = cycle day 13 of 21
      // -> 8 (short). Early LH peak 2026-01-01 -> 20 if it were the anchor.
      ...shiftCycle(
        [
          "2026-01-08",
          "2026-01-09",
          "2026-01-10",
          "2026-01-11",
          "2026-01-12",
          "2026-01-13",
          "2026-01-14",
          "2026-01-15",
          "2026-01-16",
        ],
        "2026-01-01",
      ),
      // C2: shift day 2026-02-04, ovulation 2026-02-03 = cycle day 13 of 21 -> 8.
      ...shiftCycle(
        [
          "2026-01-29",
          "2026-01-30",
          "2026-01-31",
          "2026-02-01",
          "2026-02-02",
          "2026-02-03",
          "2026-02-04",
          "2026-02-05",
          "2026-02-06",
        ],
        "2026-01-22",
      ),
      // C3: shift day 2026-02-25, ovulation 2026-02-24 = cycle day 13 of 21 -> 8.
      ...shiftCycle(
        [
          "2026-02-19",
          "2026-02-20",
          "2026-02-21",
          "2026-02-22",
          "2026-02-23",
          "2026-02-24",
          "2026-02-25",
          "2026-02-26",
          "2026-02-27",
        ],
        "2026-02-12",
      ),
    ];

    const result = buildShortLutealHint(history, records);
    // BBT ovulation day -> 8-day luteal in every cycle -> fires; the early LH
    // peaks (>= 10-day luteal) are ignored because the BBT shift takes precedence.
    expect(result?.observationCount).toBe(3);
    expect(result?.averageDays).toBe(8);
  });
});
