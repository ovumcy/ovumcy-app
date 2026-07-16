import { createEmptyDayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
  collectCycleStartDates,
  hasDataDrivenPredictionSpan,
  shouldShowAgeVariabilityHint,
  shouldShowIrregularityNotice,
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

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Builds period-start markers beginning at `firstStart`, each separated from
// the previous by the next value in `gaps` (in days). N gaps produce N+1
// starts and therefore N completed cycles (given `now` is past the last start).
function periodMarkersFromGaps(firstStart: Date, gaps: number[]) {
  const records = [
    { ...createEmptyDayLogRecord(isoDate(firstStart)), isPeriod: true, cycleStart: true },
  ];
  let cursor = firstStart;
  for (const gap of gaps) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + gap);
    records.push({
      ...createEmptyDayLogRecord(isoDate(cursor)),
      isPeriod: true,
      cycleStart: true,
    });
  }
  return { records, lastStart: cursor };
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
    // 2026-03-29. Ovulation day 14 (2026-03-14) puts the fertility window on
    // days 9-13, so rolled day 10 is inside it -> "fertile" (this test predates
    // the fertile phase; day 10 was never actually "follicular", the pre-fix
    // detectCurrentPhase just had no fertile branch to return instead).
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
        currentPhase: "fertile",
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

  describe("upcoming ovulation forward-roll (web DashboardUpcomingPredictions parity)", () => {
    it("rolls the upcoming ovulation into the next cycle once the current cycle's ovulation has passed", () => {
      // Anchor 2026-02-01, len 28, today 2026-03-25. The rolled current cycle is
      // 2026-03-01..2026-03-29 with ovulation 2026-03-14 — already in the past
      // (today is cycle day 25, luteal). ovulationDate stays the current-cycle
      // date (2026-03-14) for the phase ring and the calendar/PDF markers, while
      // upcomingOvulationDate rolls one whole cycle forward to 2026-04-11
      // (2026-03-29 + 13), never surfacing a past date. Web parity:
      // stats.OvulationDate vs DashboardUpcomingPredictions().OvulationDate.
      const profile = createProfileRecord({ lastPeriodStart: "2026-02-01" });
      const now = new Date(2026, 2, 25);
      const history = buildCycleHistorySummary(profile, [], now);
      const projection = buildCurrentCycleProjection(profile, history, [], now);

      expect(projection.currentPhase).toBe("luteal");
      expect(projection.ovulationDate).toBe("2026-03-14");
      expect(projection.upcomingOvulationDate).toBe("2026-04-11");
    });

    it("leaves the upcoming ovulation equal to the current cycle's ovulation while it is still in the future", () => {
      // Anchor 2026-03-01, len 28, today 2026-03-05 (cycle day 5). Ovulation
      // 2026-03-14 is still ahead of today, so no roll happens and the two
      // ovulation values agree.
      const profile = createProfileRecord({ lastPeriodStart: "2026-03-01" });
      const now = new Date(2026, 2, 5);
      const history = buildCycleHistorySummary(profile, [], now);
      const projection = buildCurrentCycleProjection(profile, history, [], now);

      expect(projection.currentCycleDay).toBe(5);
      expect(projection.ovulationDate).toBe("2026-03-14");
      expect(projection.upcomingOvulationDate).toBe("2026-03-14");
    });

    it("surfaces no upcoming ovulation while predictions are paused by a positive pregnancy test", () => {
      // Medical-safety invariant: the pregnancy pause blanks every prediction
      // surface, upcomingOvulationDate included.
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
      const now = new Date(2026, 1, 12);
      const history = buildCycleHistorySummary(profile, records, now);
      const projection = buildCurrentCycleProjection(profile, history, records, now);

      expect(projection.isPregnancyPaused).toBe(true);
      expect(projection.ovulationDate).toBeNull();
      expect(projection.upcomingOvulationDate).toBeNull();
    });
  });

  describe("detectCurrentPhase precedence (web resolveCyclePhase parity, cycles.go:419-446)", () => {
    // Shared cycle: anchor 2026-03-01, default 28-day cycle / 5-day period,
    // no completed cycles yet -> predictionCycleLength falls back to
    // profile.cycleLength (28), ovulation day 14 (2026-03-14 = anchor + 13),
    // fertility window starts day 9 (ovulation - 5 = 2026-03-09).
    const anchor = "2026-03-01";

    function projectForCycleDay(cycleDay: number) {
      const profile = createProfileRecord({ lastPeriodStart: anchor });
      const now = new Date(2026, 2, cycleDay);
      const history = buildCycleHistorySummary(profile, [], now);
      return buildCurrentCycleProjection(profile, history, [], now);
    }

    it("returns menstrual for a projected-but-unlogged period day (day 3, no log yet)", () => {
      // No isPeriod record exists for today, but cycle day 3 <= periodLength
      // (5), so web's includeProjectedPeriod branch (LastPeriodStart +
      // AveragePeriodLength) still reads menstrual instead of following
      // through to follicular the way the pre-fix app did.
      const projection = projectForCycleDay(3);
      expect(projection.currentCycleDay).toBe(3);
      expect(projection.currentPhase).toBe("menstrual");
    });

    it("returns follicular after the period window and before the fertility window", () => {
      // Cycle day 7: past the 5-day projected period window, before the
      // fertility window opens on day 9.
      const projection = projectForCycleDay(7);
      expect(projection.currentCycleDay).toBe(7);
      expect(projection.currentPhase).toBe("follicular");
    });

    it("returns fertile inside the fertility window, excluding the ovulation day", () => {
      // Cycle day 11 sits inside [fertilityStart=day9, ovulation=day14) but
      // is not the ovulation day itself.
      const projection = projectForCycleDay(11);
      expect(projection.currentCycleDay).toBe(11);
      expect(projection.currentPhase).toBe("fertile");
    });

    it("returns ovulation exactly on the ovulation day, taking precedence over fertile", () => {
      // Cycle day 14 is both inside the fertility window and the ovulation
      // date itself; web's tie-break picks "ovulation" over "fertile".
      const projection = projectForCycleDay(14);
      expect(projection.currentCycleDay).toBe(14);
      expect(projection.currentPhase).toBe("ovulation");
    });

    it("returns luteal after ovulation", () => {
      // Cycle day 20: past ovulation (day 14) and past the fertility window.
      const projection = projectForCycleDay(20);
      expect(projection.currentCycleDay).toBe(20);
      expect(projection.currentPhase).toBe("luteal");
    });
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

  describe("min/max cycle length use the recent-6 window (web minMaxInts(recentLengths))", () => {
    // Web populateObservedCycleStats restricts range/spread to the recent
    // prediction window (cycles.go:290) so an outlier that has aged out of the
    // window stops widening the spread, the irregularity notice, and the
    // irregular prediction range (docs/cycle-prediction.md:113-117).

    it("does NOT let an aged-out outlier widen spread once it leaves the recent-6 window", () => {
      // 8 starts: first gap is a 40-day outlier, then six 28s. 7 completed
      // cycles; the recent-6 window is the last six lengths = [28,28,28,28,28,28].
      // The 40 has aged out -> min=max=28, spread=0.
      const profile = createProfileRecord({ lastPeriodStart: "2025-01-01" });
      const { records, lastStart } = periodMarkersFromGaps(new Date(2025, 0, 1), [
        40, 28, 28, 28, 28, 28, 28,
      ]);
      const now = new Date(lastStart.getFullYear(), lastStart.getMonth(), lastStart.getDate() + 5);

      const history = buildCycleHistorySummary(profile, records, now);

      expect(history.completedCycleCount).toBe(7);
      expect(history.recentCycleLengths).toEqual([28, 28, 28, 28, 28, 28]);
      expect(history.minCycleLength).toBe(28);
      expect(history.maxCycleLength).toBe(28);
      expect(history.cycleLengthSpread).toBe(0);
      expect(shouldShowIrregularityNotice(profile, history)).toBe(false);
    });

    it("DOES widen spread when the same outlier is still inside the recent-6 window", () => {
      // 7 starts -> 6 completed cycles, all within the recent-6 window:
      // lengths [28,28,40,28,28,28]. The 40 is in the window -> min=28, max=40,
      // spread=12 (> IRREGULAR_CYCLE_SPREAD_DAYS=7) so the notice fires.
      const profile = createProfileRecord({ lastPeriodStart: "2025-06-01" });
      const { records, lastStart } = periodMarkersFromGaps(new Date(2025, 5, 1), [
        28, 28, 40, 28, 28, 28,
      ]);
      const now = new Date(lastStart.getFullYear(), lastStart.getMonth(), lastStart.getDate() + 5);

      const history = buildCycleHistorySummary(profile, records, now);

      expect(history.completedCycleCount).toBe(6);
      expect(history.recentCycleLengths).toEqual([28, 28, 40, 28, 28, 28]);
      expect(history.minCycleLength).toBe(28);
      expect(history.maxCycleLength).toBe(40);
      expect(history.cycleLengthSpread).toBe(12);
      expect(shouldShowIrregularityNotice(profile, history)).toBe(true);
    });
  });

  describe("prediction span uses sample standard deviation (n-1, web stddevInts)", () => {
    it("rounds the n-1 SD of [25,30,28] to a +/-3 day window (population n would give +/-2)", () => {
      // 4 markers, gaps 25/30/28 -> 3 completed cycle lengths [25,30,28].
      //   mean = 27.6667
      //   sum of squared deviations = 12.6667
      //   sample (n-1) variance = 12.6667 / 2 = 6.3333 -> SD = 2.5166 -> round 3
      //   population (n) variance = 12.6667 / 3 = 4.2222 -> SD = 2.0548 -> round 2
      // So the data-driven span is round(SD) clamped [1,5] = 3, and the window
      // is anchor-derived next period (2026-03-22) +/- 3 = [03-19, 03-25].
      const profile = createProfileRecord({ lastPeriodStart: "2025-12-01" });
      const { records } = periodMarkersFromGaps(new Date(2025, 11, 1), [25, 30, 28, 27]);
      const now = new Date(2026, 2, 10);

      const history = buildCycleHistorySummary(profile, records, now);
      const projection = buildCurrentCycleProjection(profile, history, records, now);

      expect(history.completedCycleCount).toBe(3);
      expect(history.recentCycleLengths).toEqual([25, 30, 28]);
      expect(hasDataDrivenPredictionSpan(profile, history)).toBe(true);

      expect(projection.cycleAnchorDate).toBe("2026-02-22");
      expect(projection.nextPeriodDate).toBe("2026-03-22");
      // +/-3 (sample SD), NOT +/-2 (population SD).
      expect(projection.nextPeriodWindowStartDate).toBe("2026-03-19");
      expect(projection.nextPeriodWindowEndDate).toBe("2026-03-25");
    });
  });

  describe("completed cycle requires next start strictly before today (web !currentStart.Before(today))", () => {
    it("does NOT count a cycle whose next start lands exactly on today", () => {
      // Starts 2026-02-01 and 2026-03-01; today is exactly the second start.
      // Web breaks on !currentStart.Before(today) (dashboard_cycle.go:336), so
      // the 2026-02-01 cycle is not yet completed: count 0.
      const profile = createProfileRecord({ lastPeriodStart: "2026-02-01" });
      const records = [
        { ...createEmptyDayLogRecord("2026-02-01"), isPeriod: true, cycleStart: true },
        { ...createEmptyDayLogRecord("2026-03-01"), isPeriod: true, cycleStart: true },
      ];
      const now = new Date(2026, 2, 1); // 2026-03-01

      const history = buildCycleHistorySummary(profile, records, now);

      expect(history.completedCycleCount).toBe(0);
      expect(history.completedCycles).toEqual([]);
    });

    it("DOES count the same cycle once its next start is strictly before today", () => {
      const profile = createProfileRecord({ lastPeriodStart: "2026-02-01" });
      const records = [
        { ...createEmptyDayLogRecord("2026-02-01"), isPeriod: true, cycleStart: true },
        { ...createEmptyDayLogRecord("2026-03-01"), isPeriod: true, cycleStart: true },
      ];
      const now = new Date(2026, 2, 2); // 2026-03-02, one day later

      const history = buildCycleHistorySummary(profile, records, now);

      expect(history.completedCycleCount).toBe(1);
      expect(history.completedCycles[0]).toEqual(
        expect.objectContaining({
          startDate: "2026-02-01",
          nextStartDate: "2026-03-01",
          cycleLength: 28,
        }),
      );
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

    it("keeps the phase unknown while paused even on a date that would otherwise be fertile", () => {
      // Anchor 2026-01-05, default 28-day cycle -> ovulation day 14
      // (2026-01-18), fertility window 2026-01-13..2026-01-17. 2026-01-16
      // sits inside that window, so absent the pause this date would resolve
      // to "fertile". Security constitution: every prediction surface honors
      // the pregnancy pause, so currentPhase must stay "unknown", never leak
      // "fertile" (or a projected-period "menstrual").
      const profile = createProfileRecord({ lastPeriodStart: "2026-01-05" });
      const records = [
        {
          ...createEmptyDayLogRecord("2026-01-05"),
          isPeriod: true,
          cycleStart: true,
        },
        {
          ...createEmptyDayLogRecord("2026-01-15"),
          pregnancyTest: "positive" as const,
        },
      ];
      const now = new Date(2026, 0, 16);
      const history = buildCycleHistorySummary(profile, records, now);
      const projection = buildCurrentCycleProjection(profile, history, records, now);

      expect(projection.isPregnancyPaused).toBe(true);
      expect(projection.currentPhase).toBe("unknown");
    });
  });
});
