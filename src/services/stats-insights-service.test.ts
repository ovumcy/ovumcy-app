import { createEmptyDayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { StatsCycleHistorySummary, StatsCycleProjection, StatsPhase } from "../models/stats";
import { MIN_CURRENT_CYCLE_BBT_POINTS } from "../models/stats";
import { createDefaultSymptomRecords } from "../models/symptom";
import { buildCycleHistorySummary } from "./cycle-history-service";
import {
  buildLastCycleSymptomFrequency,
  buildStatsPhaseMoodInsights,
  buildStatsPhaseSymptomInsights,
  buildStatsBBTSeries,
  buildStatsSymptomFrequency,
  buildStatsSymptomPatterns,
  buildStatsTrendPoints,
  detectGapBasedCycleStarts,
} from "./stats-insights-service";

function createPhaseProfile(
  overrides?: Partial<ProfileRecord>,
): ProfileRecord {
  return {
    lastPeriodStart: "2026-01-01",
    cycleLength: 28,
    periodLength: 5,
    autoPeriodFill: true,
    irregularCycle: false,
    unpredictableCycle: false,
    ageGroup: "",
    usageGoal: "health",
    trackBBT: false,
    temperatureUnit: "c",
    trackCervicalMucus: false,
    hideSexChip: false,
    languageOverride: null,
    themeOverride: null,
    dismissedCalendarPredictionNoticeKey: null,
    dismissedOnboardingHelperNoticeKey: null,
    ...overrides,
  };
}

function periodMarker(date: string) {
  return { ...createEmptyDayLogRecord(date), isPeriod: true, cycleStart: true };
}

function moodOn(date: string, mood: number) {
  return { ...createEmptyDayLogRecord(date), mood };
}

function moodEntryCount(
  insights: ReturnType<typeof buildStatsPhaseMoodInsights>,
  phase: StatsPhase,
): number {
  return insights.find((item) => item.phase === phase)?.entryCount ?? 0;
}

function moodAverage(
  insights: ReturnType<typeof buildStatsPhaseMoodInsights>,
  phase: StatsPhase,
): number {
  return insights.find((item) => item.phase === phase)?.averageMood ?? 0;
}

function createProjection(
  cycleAnchorDate: string | null = "2026-03-14",
): StatsCycleProjection {
  return {
    cycleAnchorDate,
    currentCycleDay: null,
    currentPhase: "follicular",
    isPredictionStale: false,
    isPregnancyPaused: false,
    pregnancyTestDate: null,
    lutealPhase: 14,
    nextPeriodDate: null,
    nextPeriodWindowStartDate: null,
    nextPeriodWindowEndDate: null,
    ovulationDate: null,
    predictionCycleLength: 28,
  };
}

function makeBBTRecord(date: string, bbt: number) {
  return { ...createEmptyDayLogRecord(date), bbt };
}

describe("buildStatsBBTSeries", () => {
  describe("MIN_CURRENT_CYCLE_BBT_POINTS constant", () => {
    it("is 5", () => {
      expect(MIN_CURRENT_CYCLE_BBT_POINTS).toBe(5);
    });
  });

  it("returns empty series when there are fewer than 5 current-cycle BBT values (4 values → no chart)", () => {
    const records = [
      makeBBTRecord("2026-03-14", 36.5),
      makeBBTRecord("2026-03-15", 36.52),
      makeBBTRecord("2026-03-16", 36.48),
      makeBBTRecord("2026-03-17", 36.55),
    ];

    const result = buildStatsBBTSeries(
      createProjection("2026-03-14"),
      records,
      new Date(2026, 2, 17),
    );

    expect(result).toHaveLength(0);
  });

  it("returns a series with 5 points when there are exactly 5 current-cycle BBT values", () => {
    const records = [
      makeBBTRecord("2026-03-14", 36.5),
      makeBBTRecord("2026-03-15", 36.52),
      makeBBTRecord("2026-03-16", 36.48),
      makeBBTRecord("2026-03-17", 36.55),
      makeBBTRecord("2026-03-18", 36.7),
    ];

    const result = buildStatsBBTSeries(
      createProjection("2026-03-14"),
      records,
      new Date(2026, 2, 18),
    );

    expect(result).toHaveLength(5);
    expect(result[0]?.key).toBe("2026-03-14");
    expect(result[4]?.key).toBe("2026-03-18");
    result.forEach((point) => {
      expect(point.value).toBeGreaterThan(0);
      expect(typeof point.label).toBe("string");
      expect(typeof point.cycleDay).toBe("number");
    });
  });

  it("excludes records outside the current cycle (before anchor date)", () => {
    const records = [
      // Previous cycle — should be excluded
      makeBBTRecord("2026-02-28", 36.4),
      makeBBTRecord("2026-03-01", 36.41),
      makeBBTRecord("2026-03-02", 36.42),
      // Current cycle
      makeBBTRecord("2026-03-14", 36.5),
      makeBBTRecord("2026-03-15", 36.52),
      makeBBTRecord("2026-03-16", 36.48),
      makeBBTRecord("2026-03-17", 36.55),
      makeBBTRecord("2026-03-18", 36.7),
    ];

    const result = buildStatsBBTSeries(
      createProjection("2026-03-14"),
      records,
      new Date(2026, 2, 18),
    );

    expect(result).toHaveLength(5);
    expect(result.every((p) => p.key >= "2026-03-14")).toBe(true);
  });

  it("returns empty series when cycleAnchorDate is null", () => {
    const records = [
      makeBBTRecord("2026-03-14", 36.5),
      makeBBTRecord("2026-03-15", 36.52),
      makeBBTRecord("2026-03-16", 36.48),
      makeBBTRecord("2026-03-17", 36.55),
      makeBBTRecord("2026-03-18", 36.7),
    ];

    const result = buildStatsBBTSeries(
      createProjection(null),
      records,
      new Date(2026, 2, 18),
    );

    expect(result).toHaveLength(0);
  });
});

describe("phase classifier parity (resolveRecordPhase via mood insights)", () => {
  // Mirrors web phaseForCompletedCycleDay (stats_phase_insights.go:90-107) +
  // the CalcOvulationDay skip gate (line 73-76). The phase classifier must use
  // the full clamped CalcOvulationDay(cycleLength, 14), not a raw
  // cycleLength-14 offset.

  it("classifies a short (16-day) cycle by CalcOvulationDay, so ovulation is day 5 not day 2", () => {
    // Cycle: start 2026-01-01, next start 2026-01-17 => length 16, period
    // length 1 (only 01-01 logged as period). CalcOvulationDay(16, 14) = day 5
    // (luteal clamped to 11). The OLD code used max(16 - 14, 1) = day 2, which
    // would mark day 2 as ovulation and day 5 as luteal — both wrong.
    const profile = createPhaseProfile({ lastPeriodStart: "2026-01-01" });
    const records = [
      periodMarker("2026-01-01"),
      periodMarker("2026-01-17"),
      // mood on cycle day 2 (2026-01-02): now follicular, was ovulation
      moodOn("2026-01-02", 3),
      // mood on cycle day 5 (2026-01-05): now ovulation, was luteal
      moodOn("2026-01-05", 5),
    ];
    const now = new Date(2026, 0, 25);
    const history = buildCycleHistorySummary(profile, records, now);
    expect(history.completedCycles[0]).toEqual(
      expect.objectContaining({
        startDate: "2026-01-01",
        nextStartDate: "2026-01-17",
        cycleLength: 16,
        periodLength: 1,
      }),
    );

    const insights = buildStatsPhaseMoodInsights(records);

    // Day 5 lands in ovulation with mood 5; day 2 must NOT be there.
    expect(moodEntryCount(insights, "ovulation")).toBe(1);
    expect(moodAverage(insights, "ovulation")).toBe(5);
    // Day 2 lands in follicular with mood 3 (it is past the 1-day period and
    // before ovulation day 5).
    expect(moodEntryCount(insights, "follicular")).toBe(1);
    expect(moodAverage(insights, "follicular")).toBe(3);
    // Nothing landed in luteal (day 5 is no longer misclassified as luteal).
    expect(moodEntryCount(insights, "luteal")).toBe(0);
  });

  it("excludes every day of a cycle whose ovulation CalcOvulationDay cannot place (14-day cycle)", () => {
    // Cycle: start 2026-01-01, next start 2026-01-15 => length 14. The shortest
    // length CalcOvulationDay can place is 15 (minLutealPhaseDays +
    // minOvulationCycleDay). CalcOvulationDay(14, 14) returns null, so web does
    // `continue` and drops the whole cycle context. Every mood day inside it
    // must be excluded from aggregation — no phase gets a phantom entry.
    const profile = createPhaseProfile({ lastPeriodStart: "2026-01-01" });
    const records = [
      periodMarker("2026-01-01"),
      periodMarker("2026-01-15"),
      moodOn("2026-01-02", 4),
      moodOn("2026-01-08", 2),
      moodOn("2026-01-13", 5),
    ];
    const now = new Date(2026, 0, 25);
    const history = buildCycleHistorySummary(profile, records, now);
    expect(history.completedCycles[0]).toEqual(
      expect.objectContaining({ cycleLength: 14 }),
    );

    const insights = buildStatsPhaseMoodInsights(records);

    for (const phase of [
      "menstrual",
      "follicular",
      "ovulation",
      "luteal",
    ] as const) {
      expect(moodEntryCount(insights, phase)).toBe(0);
    }
    expect(insights.every((item) => item.hasData === false)).toBe(true);
  });

  it("classifies a normal 28-day cycle unchanged (ovulation on day 14)", () => {
    // CalcOvulationDay(28, 14) = day 14, identical to the legacy 28 - 14 = 14.
    const profile = createPhaseProfile({ lastPeriodStart: "2026-01-01" });
    const records = [
      periodMarker("2026-01-01"),
      periodMarker("2026-01-29"),
      moodOn("2026-01-03", 2), // day 3: follicular (period length 1 -> day 1 only)
      moodOn("2026-01-10", 4), // day 10: follicular
      moodOn("2026-01-14", 5), // day 14: ovulation
      moodOn("2026-01-25", 3), // day 25: luteal
    ];
    const now = new Date(2026, 1, 10);
    const history = buildCycleHistorySummary(profile, records, now);
    expect(history.completedCycles[0]).toEqual(
      expect.objectContaining({ cycleLength: 28, periodLength: 1 }),
    );

    const insights = buildStatsPhaseMoodInsights(records);

    expect(moodEntryCount(insights, "menstrual")).toBe(0); // day 3 > period length 1
    expect(moodEntryCount(insights, "follicular")).toBe(2); // days 3 and 10
    expect(moodEntryCount(insights, "ovulation")).toBe(1); // day 14
    expect(moodAverage(insights, "ovulation")).toBe(5);
    expect(moodEntryCount(insights, "luteal")).toBe(1); // day 25
  });
});

describe("phase insights use gap-based cycle detection (web DetectCycleStarts)", () => {
  function periodDayNoFlag(date: string) {
    // A logged period day with NO explicit cycleStart flag.
    return { ...createEmptyDayLogRecord(date), isPeriod: true };
  }

  it("detects cycles from period-day gaps even when no cycleStart flags are set", () => {
    // Two period days 28 days apart, neither flagged as a cycle start. Gap-based
    // detection (>= 5-day gap) still builds the [01-01, 01-29) cycle, so the
    // day-14 mood lands in ovulation. The explicit-flag path would not see a
    // start here.
    const records = [
      periodDayNoFlag("2026-01-01"),
      periodDayNoFlag("2026-01-29"),
      moodOn("2026-01-14", 5), // day 14 of a 28-day cycle -> ovulation
    ];

    const insights = buildStatsPhaseMoodInsights(records);

    expect(moodEntryCount(insights, "ovulation")).toBe(1);
    expect(moodAverage(insights, "ovulation")).toBe(5);
  });

  it("ignores a cycleStart flag that is not preceded by a 5+ day gap", () => {
    // 01-03 is flagged as a cycle start but is only 2 days after 01-01, so
    // gap-based detection does NOT split there: the single cycle is
    // [01-01, 01-29), and the day-14 mood is its ovulation. If the mid-run flag
    // were honored the day numbering would shift and this would not be day 14.
    const records = [
      periodMarker("2026-01-01"),
      { ...createEmptyDayLogRecord("2026-01-03"), isPeriod: true, cycleStart: true },
      periodMarker("2026-01-29"),
      moodOn("2026-01-14", 5),
    ];

    const insights = buildStatsPhaseMoodInsights(records);

    expect(moodEntryCount(insights, "ovulation")).toBe(1);
    expect(moodAverage(insights, "ovulation")).toBe(5);
  });

  it("yields no phase insights with fewer than two detected starts", () => {
    const records = [periodMarker("2026-01-01"), moodOn("2026-01-10", 4)];

    const insights = buildStatsPhaseMoodInsights(records);

    expect(insights.every((item) => item.hasData === false)).toBe(true);
  });

  it("starts a new cycle at a 5-day gap but not a 4-day gap (web >= 5)", () => {
    // 01-01 -> 01-07: 5 non-period days between (gapDays 5) -> new start.
    expect(
      detectGapBasedCycleStarts([
        periodMarker("2026-01-01"),
        periodMarker("2026-01-07"),
      ]),
    ).toEqual(["2026-01-01", "2026-01-07"]);
    // 01-01 -> 01-06: only 4 between (gapDays 4) -> no new start.
    expect(
      detectGapBasedCycleStarts([
        periodMarker("2026-01-01"),
        periodMarker("2026-01-06"),
      ]),
    ).toEqual(["2026-01-01"]);
  });

  it("treats an unparseable period-day date as a zero-day gap instead of throwing", () => {
    // "1000-99-99" matches the YYYY-MM-DD shape but is not a real calendar date
    // (month 99), so it fails parseLocalDate. It sorts first lexicographically
    // and is unconditionally pushed as the first start; the gap check against
    // the next (valid) day then fails to parse it and treats the gap as 0,
    // so the valid day is NOT registered as a second start.
    const records = [
      { ...createEmptyDayLogRecord("1000-99-99"), isPeriod: true },
      { ...createEmptyDayLogRecord("2026-01-01"), isPeriod: true },
    ];

    expect(() => detectGapBasedCycleStarts(records)).not.toThrow();
    expect(detectGapBasedCycleStarts(records)).toEqual(["1000-99-99"]);
  });
});

describe("buildLastCycleSymptomFrequency", () => {
  it("returns an empty list when there are no completed cycles yet", () => {
    const profile = createPhaseProfile();
    const history = buildCycleHistorySummary(profile, [], new Date(2026, 0, 10));

    expect(history.completedCycleCount).toBe(0);
    expect(
      buildLastCycleSymptomFrequency(history, [], createDefaultSymptomRecords()),
    ).toEqual([]);
  });
});

describe("buildStatsSymptomFrequency", () => {
  it("excludes unknown symptom IDs and sorts by descending count, then alphabetically on a tie", () => {
    const symptomRecords = createDefaultSymptomRecords();
    const records = [
      { ...createEmptyDayLogRecord("2026-01-01"), symptomIDs: ["cramps"] },
      { ...createEmptyDayLogRecord("2026-01-02"), symptomIDs: ["cramps"] },
      { ...createEmptyDayLogRecord("2026-01-03"), symptomIDs: ["headache"] },
      // "bloating" ties headache's count (1) -- alphabetical tie-break puts it first.
      { ...createEmptyDayLogRecord("2026-01-05"), symptomIDs: ["bloating"] },
      { ...createEmptyDayLogRecord("2026-01-04"), symptomIDs: ["ghost_symptom"] },
    ];

    const result = buildStatsSymptomFrequency(records, symptomRecords);

    expect(result.map((item) => item.id)).toEqual(["cramps", "bloating", "headache"]);
    expect(result[0]).toEqual(expect.objectContaining({ id: "cramps", count: 2 }));
  });
});

describe("buildStatsTrendPoints", () => {
  it("maps completed cycles to trend points in order", () => {
    const profile = createPhaseProfile({ lastPeriodStart: "2026-01-01" });
    const history = buildCycleHistorySummary(
      profile,
      [periodMarker("2026-01-01"), periodMarker("2026-01-29")],
      new Date(2026, 1, 2),
    );

    const points = buildStatsTrendPoints(history);

    expect(points).toEqual([
      { key: "2026-01-01", label: expect.any(String), value: 28 },
    ]);
  });

  it("falls back to the raw start date string when it is not a valid calendar date", () => {
    const history: StatsCycleHistorySummary = {
      completedCycles: [
        {
          startDate: "not-a-date",
          nextStartDate: "2026-02-01",
          cycleLength: 10,
          periodLength: 5,
          observedPeriodLength: null,
          factorKeys: [],
          comparisonKind: "variable",
        },
      ],
      completedCycleCount: 1,
      insightProgress: 50,
      hasInsights: false,
      hasReliableTrend: false,
      recentCycleLengths: [10],
      averageCycleLength: 10,
      medianCycleLength: 10,
      minCycleLength: 10,
      maxCycleLength: 10,
      cycleLengthSpread: 0,
      lastCycleLength: 10,
      lastPeriodLength: 5,
    };

    expect(buildStatsTrendPoints(history)).toEqual([
      { key: "not-a-date", label: "not-a-date", value: 10 },
    ]);
  });
});

describe("buildStatsSymptomPatterns (previously untested)", () => {
  it("excludes an unknown symptom ID and sorts recurring patterns by count, then alphabetically on a tie", () => {
    const profile = createPhaseProfile({ lastPeriodStart: "2026-03-26" });
    const symptomRecords = createDefaultSymptomRecords();
    const records = [
      ...["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-26"].map((date) =>
        periodMarker(date),
      ),
      // cramps: 2 days in cycle 0, 1 day in cycle 1 -> occurrenceCount 3.
      { ...createEmptyDayLogRecord("2026-01-05"), symptomIDs: ["cramps"] },
      { ...createEmptyDayLogRecord("2026-01-10"), symptomIDs: ["cramps"] },
      { ...createEmptyDayLogRecord("2026-02-01"), symptomIDs: ["cramps"] },
      // headache: 1 day each in cycles 0, 1, 2 -> occurrenceCount 3 (tied with cramps).
      { ...createEmptyDayLogRecord("2026-01-15"), symptomIDs: ["headache"] },
      { ...createEmptyDayLogRecord("2026-02-10"), symptomIDs: ["headache"] },
      { ...createEmptyDayLogRecord("2026-03-01"), symptomIDs: ["headache"] },
      // nausea: 1 day each in cycles 0, 1 -> occurrenceCount 2 (fewer, sorts last).
      { ...createEmptyDayLogRecord("2026-01-20"), symptomIDs: ["nausea"] },
      { ...createEmptyDayLogRecord("2026-02-15"), symptomIDs: ["nausea"] },
      // Unknown symptom ID inside a bucket -- must be silently skipped.
      { ...createEmptyDayLogRecord("2026-01-25"), symptomIDs: ["ghost_symptom"] },
    ];
    const now = new Date(2026, 2, 30);

    const history = buildCycleHistorySummary(profile, records, now);
    expect(history.completedCycleCount).toBe(3);

    const patterns = buildStatsSymptomPatterns(history, records, symptomRecords);

    // STATS_SYMPTOM_PATTERN_LIMIT caps the result at 2: cramps and headache are
    // tied at occurrenceCount 3 and sort alphabetically ahead of nausea (2).
    expect(patterns).toEqual([
      expect.objectContaining({ id: "cramps", occurrenceCount: 3 }),
      expect.objectContaining({ id: "headache", occurrenceCount: 3 }),
    ]);
  });
});

describe("buildStatsPhaseSymptomInsights (previously untested)", () => {
  it("excludes an unknown symptom ID and sorts same-phase items by percentage, then alphabetically on a tie", () => {
    const records = [
      periodMarker("2026-01-01"),
      periodMarker("2026-01-29"),
      // Follicular-phase days (period length 1, ovulation day 14): 3-11.
      { ...createEmptyDayLogRecord("2026-01-03"), symptomIDs: ["headache"] },
      { ...createEmptyDayLogRecord("2026-01-05"), symptomIDs: ["cramps"] },
      { ...createEmptyDayLogRecord("2026-01-07"), symptomIDs: ["cramps"] },
      { ...createEmptyDayLogRecord("2026-01-09"), symptomIDs: ["nausea"] },
      { ...createEmptyDayLogRecord("2026-01-11"), symptomIDs: ["ghost_symptom"] },
    ];

    const insights = buildStatsPhaseSymptomInsights(records, createDefaultSymptomRecords());
    const follicular = insights.find((item) => item.phase === "follicular");

    expect(follicular?.totalDays).toBe(5);
    expect(follicular?.items).toEqual([
      expect.objectContaining({ id: "cramps", count: 2, percentage: 40 }),
      expect.objectContaining({ id: "headache", count: 1, percentage: 20 }),
      expect.objectContaining({ id: "nausea", count: 1, percentage: 20 }),
    ]);
  });
});
