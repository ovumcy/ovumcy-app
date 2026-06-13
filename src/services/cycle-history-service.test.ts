import { createEmptyDayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
  collectCycleStartDates,
  hasDataDrivenPredictionSpan,
  shouldShowAgeVariabilityHint,
} from "./cycle-history-service";

function createProfileRecord(
  overrides?: Partial<ProfileRecord>,
): ProfileRecord {
  return {
    lastPeriodStart: "2026-03-24",
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

describe("cycle-history-service", () => {
  it("clusters nearby period days into one observed cycle start", () => {
    const profile = createProfileRecord({
      lastPeriodStart: "2026-03-24",
    });
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-02"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-03"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-24"),
        isPeriod: true,
      },
    ];

    expect(collectCycleStartDates(profile, records, "2026-03-24")).toEqual([
      "2026-03-01",
      "2026-03-24",
    ]);
  });

  it("keeps the settings cycle length until there are at least two completed cycles", () => {
    const profile = createProfileRecord();
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-02"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-03"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-24"),
        isPeriod: true,
      },
    ];
    const now = new Date(2026, 2, 24);
    const history = buildCycleHistorySummary(profile, records, now);
    const projection = buildCurrentCycleProjection(profile, history, records, now);

    expect(projection.predictionCycleLength).toBe(28);
    expect(projection.ovulationDate).toBe("2026-04-06");
    expect(projection.isPredictionStale).toBe(false);
  });

  it("uses the median, not the mean, so a single merged-cycle gap does not skew the prediction", () => {
    // Recent cycle lengths [28, 28, 27, 28, 60]: a missed log merged two real
    // cycles into one ~60-day pseudo-cycle. Median = 28, mean = 34.2 (→34).
    // The next period must anchor on the median (anchor + 28), matching the
    // canonical algorithm, never the mean (anchor + 34).
    const profile = createProfileRecord({ lastPeriodStart: "2025-09-01" });
    const cycleStarts = [
      "2025-09-01",
      "2025-09-29",
      "2025-10-27",
      "2025-11-23",
      "2025-12-21",
      "2026-02-19",
    ];
    const records = cycleStarts.map((date) => ({
      ...createEmptyDayLogRecord(date),
      isPeriod: true,
    }));
    const now = new Date(2026, 1, 20);

    const history = buildCycleHistorySummary(profile, records, now);
    const projection = buildCurrentCycleProjection(profile, history, records, now);

    expect(history.completedCycleCount).toBe(5);
    expect(history.recentCycleLengths).toEqual([28, 28, 27, 28, 60]);
    expect(history.medianCycleLength).toBe(28);
    expect(Math.round(history.averageCycleLength)).toBe(34);

    expect(projection.cycleAnchorDate).toBe("2026-02-19");
    expect(projection.predictionCycleLength).toBe(28);
    expect(projection.nextPeriodDate).toBe("2026-03-19");
    expect(projection.nextPeriodDate).not.toBe("2026-03-25");
    expect(projection.isPredictionStale).toBe(false);
  });

  it("rolls the anchor forward instead of blanking once the expected next period has passed", () => {
    // Web ProjectCycleStart parity. Anchor 2026-02-01, len 28, today 2026-03-25.
    // Raw cycle day from the original anchor = 53 (> reference 28) so the
    // prediction is stale AND looks long (53 > 28 + 7 = 35). Instead of blanking,
    // the anchor rolls forward by one whole cycle to 2026-03-01, so the next
    // period (2026-03-29), ovulation (2026-03-14) and current day (25) all come
    // from the rolled anchor. The logged anchor itself is preserved.
    const profile = createProfileRecord({
      lastPeriodStart: "2026-02-01",
    });
    const now = new Date(2026, 2, 25);
    const history = buildCycleHistorySummary(profile, [], now);
    const projection = buildCurrentCycleProjection(profile, history, [], now);

    expect(projection).toEqual(
      expect.objectContaining({
        cycleAnchorDate: "2026-02-01",
        currentCycleDay: 25,
        currentPhase: "luteal",
        isPredictionStale: true,
        cycleDayLooksLong: true,
        nextPeriodDate: "2026-03-29",
        ovulationDate: "2026-03-14",
        predictionCycleLength: 28,
      }),
    );
  });

  it("flags a stale, long-running cycle while still rolling the prediction forward", () => {
    // Anchor 2026-02-01, len 28, today 2026-03-10. Raw cycle day = 38, which is
    // > 28 (stale) and > 35 (looks long). Web computes DashboardCycleDayLooksLong
    // from the RAW day from the original anchor, so looksLong always implies
    // stale. The rolled anchor is still 2026-03-01 (day 10), next period
    // 2026-03-29.
    const profile = createProfileRecord({
      lastPeriodStart: "2026-02-01",
    });
    const now = new Date(2026, 2, 10);
    const history = buildCycleHistorySummary(profile, [], now);
    const projection = buildCurrentCycleProjection(profile, history, [], now);

    expect(projection).toEqual(
      expect.objectContaining({
        cycleAnchorDate: "2026-02-01",
        currentCycleDay: 10,
        currentPhase: "follicular",
        isPredictionStale: true,
        cycleDayLooksLong: true,
        nextPeriodDate: "2026-03-29",
        ovulationDate: "2026-03-14",
        predictionCycleLength: 28,
      }),
    );
  });

  it("rolls multiple whole cycles forward when several periods have been missed", () => {
    // Anchor 2026-01-01, len 28, today 2026-04-15. Raw cycle day = 105. Elapsed
    // = 104 days → 3 whole cycles roll the anchor to 2026-03-26 so that
    // 2026-03-26 <= today < 2026-04-23. Current day 21, next period 2026-04-23,
    // ovulation 2026-04-08.
    const profile = createProfileRecord({
      lastPeriodStart: "2026-01-01",
    });
    const now = new Date(2026, 3, 15);
    const history = buildCycleHistorySummary(profile, [], now);
    const projection = buildCurrentCycleProjection(profile, history, [], now);

    expect(projection).toEqual(
      expect.objectContaining({
        cycleAnchorDate: "2026-01-01",
        currentCycleDay: 21,
        isPredictionStale: true,
        cycleDayLooksLong: true,
        nextPeriodDate: "2026-04-23",
        ovulationDate: "2026-04-08",
        predictionCycleLength: 28,
      }),
    );
  });

  it("never resurrects a next-period date in unpredictable (facts-only) mode", () => {
    // Forward-roll must not run in unpredictable mode: web disables predictions
    // entirely. Only the recorded current cycle day (raw) is surfaced; the
    // next-period date, window and ovulation stay null and nothing is marked
    // stale.
    const profile = createProfileRecord({
      lastPeriodStart: "2026-02-01",
      unpredictableCycle: true,
    });
    const now = new Date(2026, 2, 25);
    const history = buildCycleHistorySummary(profile, [], now);
    const projection = buildCurrentCycleProjection(profile, history, [], now);

    expect(projection).toEqual(
      expect.objectContaining({
        cycleAnchorDate: "2026-02-01",
        currentCycleDay: 53,
        isPredictionStale: false,
        cycleDayLooksLong: false,
        nextPeriodDate: null,
        nextPeriodWindowStartDate: null,
        nextPeriodWindowEndDate: null,
        ovulationDate: null,
      }),
    );
  });

  describe("data-driven prediction span", () => {
    const cycleStarts = [
      "2025-12-01",
      "2025-12-29",
      "2026-01-26",
      "2026-02-23",
    ];

    function buildVaryingCycles(
      lastPeriodStart: string,
      lengths: number[],
    ): { profile: ProfileRecord; records: ReturnType<typeof createEmptyDayLogRecord>[] } {
      const profile = createProfileRecord({ lastPeriodStart });
      const records: ReturnType<typeof createEmptyDayLogRecord>[] = [];
      let cursor = new Date(2025, 11, 1);
      for (const length of lengths) {
        const dateValue = `${cursor.getFullYear()}-${String(
          cursor.getMonth() + 1,
        ).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        records.push({
          ...createEmptyDayLogRecord(dateValue),
          isPeriod: true,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + length);
      }
      return { profile, records };
    }

    it("returns no range window with fewer than 3 completed cycles", () => {
      const profile = createProfileRecord({ lastPeriodStart: "2026-01-01" });
      const records = [
        { ...createEmptyDayLogRecord("2026-01-01"), isPeriod: true },
        { ...createEmptyDayLogRecord("2026-01-29"), isPeriod: true },
      ];
      const now = new Date(2026, 1, 5);

      const history = buildCycleHistorySummary(profile, records, now);
      const projection = buildCurrentCycleProjection(profile, history, records, now);

      expect(history.completedCycleCount).toBe(1);
      expect(projection.nextPeriodDate).not.toBeNull();
      expect(projection.nextPeriodWindowStartDate).toBeNull();
      expect(projection.nextPeriodWindowEndDate).toBeNull();
      expect(hasDataDrivenPredictionSpan(profile, history)).toBe(false);
    });

    it("returns no range window when all cycle lengths are identical (SD = 0)", () => {
      // 4 period markers separated by 28 days each → 3 completed cycles of length 28.
      const { profile, records } = buildVaryingCycles("2025-12-01", [28, 28, 28, 28]);
      const now = new Date(2026, 2, 1);

      const history = buildCycleHistorySummary(profile, records, now);
      const projection = buildCurrentCycleProjection(profile, history, records, now);

      expect(history.completedCycleCount).toBe(3);
      expect(projection.nextPeriodDate).not.toBeNull();
      expect(projection.nextPeriodWindowStartDate).toBeNull();
      expect(projection.nextPeriodWindowEndDate).toBeNull();
      expect(hasDataDrivenPredictionSpan(profile, history)).toBe(false);
    });

    it("uses round(SD) clamped [1,5] when there are >=3 completed cycles with variability", () => {
      // 4 markers with varying gaps → 3 completed cycle lengths [25, 30, 28], SD ≈ 2.05.
      const { profile, records } = buildVaryingCycles("2025-12-01", [25, 30, 28, 27]);
      const now = new Date(2026, 2, 10);

      const history = buildCycleHistorySummary(profile, records, now);
      const projection = buildCurrentCycleProjection(profile, history, records, now);

      expect(history.completedCycleCount).toBe(3);
      expect(hasDataDrivenPredictionSpan(profile, history)).toBe(true);

      expect(projection.nextPeriodDate).not.toBeNull();
      expect(projection.nextPeriodWindowStartDate).not.toBeNull();
      expect(projection.nextPeriodWindowEndDate).not.toBeNull();

      const start = new Date(projection.nextPeriodWindowStartDate!);
      const end = new Date(projection.nextPeriodWindowEndDate!);
      const center = new Date(projection.nextPeriodDate!);
      const startSpan = Math.round(
        (center.getTime() - start.getTime()) / 86400000,
      );
      const endSpan = Math.round(
        (end.getTime() - center.getTime()) / 86400000,
      );
      expect(startSpan).toBeGreaterThanOrEqual(1);
      expect(startSpan).toBeLessThanOrEqual(5);
      expect(endSpan).toBeGreaterThanOrEqual(1);
      expect(endSpan).toBeLessThanOrEqual(5);
      expect(startSpan).toBe(endSpan);

      // Tracks future regression: the 45+ legacy '+1' must NOT widen the span.
      const profile45 = createProfileRecord({
        lastPeriodStart: profile.lastPeriodStart,
        ageGroup: "age_45_plus",
      });
      const projection45 = buildCurrentCycleProjection(profile45, history, records, now);
      expect(projection45.nextPeriodWindowStartDate).toBe(
        projection.nextPeriodWindowStartDate,
      );
      expect(projection45.nextPeriodWindowEndDate).toBe(
        projection.nextPeriodWindowEndDate,
      );
    });

    it("derives 3 completed cycles from a set of 4 period entries spread across months", () => {
      const firstStart = cycleStarts[0] ?? "2025-12-01";
      const profile = createProfileRecord({ lastPeriodStart: firstStart });
      const records = cycleStarts.map((date) => ({
        ...createEmptyDayLogRecord(date),
        isPeriod: true,
      }));
      const now = new Date(2026, 2, 28);
      const starts = collectCycleStartDates(profile, records, "2026-02-23");
      expect(starts.length).toBeGreaterThanOrEqual(3);
      const history = buildCycleHistorySummary(profile, records, now);
      expect(history.completedCycleCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe("shouldShowAgeVariabilityHint", () => {
    it("returns true only for the 45+ bucket", () => {
      expect(shouldShowAgeVariabilityHint(createProfileRecord({ ageGroup: "age_45_plus" }))).toBe(true);
      expect(shouldShowAgeVariabilityHint(createProfileRecord({ ageGroup: "age_40_45" }))).toBe(false);
      expect(shouldShowAgeVariabilityHint(createProfileRecord({ ageGroup: "under_40" }))).toBe(false);
      expect(shouldShowAgeVariabilityHint(createProfileRecord({ ageGroup: "" }))).toBe(false);
    });
  });

  describe("buildCurrentCycleProjection pregnancy auto-stop", () => {
    it("pauses predictions after a positive pregnancy test with no later period", () => {
      const profile = createProfileRecord({ lastPeriodStart: "2026-01-05" });
      const records = [
        {
          ...createEmptyDayLogRecord("2026-01-05"),
          isPeriod: true,
          cycleStart: true,
        },
        {
          ...createEmptyDayLogRecord("2026-02-10"),
          pregnancyTest: "positive" as const,
        },
      ];
      const history = buildCycleHistorySummary(
        profile,
        records,
        new Date(2026, 1, 12),
      );
      const projection = buildCurrentCycleProjection(
        profile,
        history,
        records,
        new Date(2026, 1, 12),
      );

      expect(projection.isPregnancyPaused).toBe(true);
      expect(projection.pregnancyTestDate).toBe("2026-02-10");
      expect(projection.nextPeriodDate).toBeNull();
      expect(projection.ovulationDate).toBeNull();
    });

    it("resumes predictions when a new period is logged after the positive test", () => {
      const profile = createProfileRecord({ lastPeriodStart: "2026-01-05" });
      const records = [
        {
          ...createEmptyDayLogRecord("2026-01-05"),
          isPeriod: true,
          cycleStart: true,
        },
        {
          ...createEmptyDayLogRecord("2026-02-10"),
          pregnancyTest: "positive" as const,
        },
        {
          ...createEmptyDayLogRecord("2026-03-01"),
          isPeriod: true,
          cycleStart: true,
        },
      ];
      const history = buildCycleHistorySummary(
        profile,
        records,
        new Date(2026, 2, 5),
      );
      const projection = buildCurrentCycleProjection(
        profile,
        history,
        records,
        new Date(2026, 2, 5),
      );

      expect(projection.isPregnancyPaused).toBe(false);
      expect(projection.pregnancyTestDate).toBeNull();
    });

    it("ignores a negative pregnancy test", () => {
      const profile = createProfileRecord({ lastPeriodStart: "2026-01-05" });
      const records = [
        {
          ...createEmptyDayLogRecord("2026-01-05"),
          isPeriod: true,
          cycleStart: true,
        },
        {
          ...createEmptyDayLogRecord("2026-02-01"),
          pregnancyTest: "negative" as const,
        },
      ];
      const history = buildCycleHistorySummary(
        profile,
        records,
        new Date(2026, 1, 12),
      );
      const projection = buildCurrentCycleProjection(
        profile,
        history,
        records,
        new Date(2026, 1, 12),
      );

      expect(projection.isPregnancyPaused).toBe(false);
    });
  });
});
