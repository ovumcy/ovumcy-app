import { createEmptyDayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { StatsCycleProjection, StatsPhase } from "../models/stats";
import { MIN_CURRENT_CYCLE_BBT_POINTS } from "../models/stats";
import { buildCycleHistorySummary } from "./cycle-history-service";
import {
  buildStatsPhaseMoodInsights,
  buildStatsBBTSeries,
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

    const insights = buildStatsPhaseMoodInsights(history, records);

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

    const insights = buildStatsPhaseMoodInsights(history, records);

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

    const insights = buildStatsPhaseMoodInsights(history, records);

    expect(moodEntryCount(insights, "menstrual")).toBe(0); // day 3 > period length 1
    expect(moodEntryCount(insights, "follicular")).toBe(2); // days 3 and 10
    expect(moodEntryCount(insights, "ovulation")).toBe(1); // day 14
    expect(moodAverage(insights, "ovulation")).toBe(5);
    expect(moodEntryCount(insights, "luteal")).toBe(1); // day 25
  });
});
