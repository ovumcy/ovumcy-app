import { getDashboardCopy } from "../i18n/dashboard-copy";
import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import {
  SUPPORTED_INTERFACE_LANGUAGES,
  createDefaultProfileRecord,
  resolveCycleViews,
  type ProfileRecord,
} from "../models/profile";
import { completedCycleHistory } from "./__fixtures__/completed-cycles";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
} from "./cycle-history-service";
import {
  CYCLE_RIBBON_MAX_AXIS_DAYS,
  buildDashboardCycleRibbon,
  type BuildDashboardCycleRibbonInput,
  type CycleRibbonDayViewData,
} from "./dashboard-cycle-ribbon-service";
import { buildDashboardViewData } from "./dashboard-view-service";

// Web dashboard_cycle_hero.go ribbon. Cycle length 28, running cycle opened
// 2026-03-05 with a five-day period.
const CURRENT_START = "2026-03-05";
const MARCH_12 = new Date(2026, 2, 12, 10, 0, 0, 0);
const MARCH_6 = new Date(2026, 2, 6, 10, 0, 0, 0);

function profileOf(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    ...createDefaultProfileRecord(),
    cycleLength: 28,
    periodLength: 5,
    ...overrides,
  };
}

function periodRun(start: string, days: number): DayLogRecord[] {
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(`${start}T00:00:00`);
    date.setDate(date.getDate() + offset);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return {
      ...createEmptyDayLogRecord(value),
      isPeriod: true,
      cycleStart: offset === 0,
      flow: "medium" as const,
    };
  });
}

function recordsWith(completed: number): DayLogRecord[] {
  return [
    ...completedCycleHistory({ currentStart: CURRENT_START, completed }),
    ...periodRun(CURRENT_START, 5),
  ];
}

function inputFor(
  profile: ProfileRecord,
  records: DayLogRecord[],
  now: Date,
  overrides: Partial<BuildDashboardCycleRibbonInput> = {},
): BuildDashboardCycleRibbonInput {
  const history = buildCycleHistorySummary(profile, records, now);
  return {
    profile,
    projection: buildCurrentCycleProjection(profile, history, records, now),
    history,
    records,
    today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    locale: "en",
    suppressPredictions: false,
    postpartumAwaitingCycle: false,
    ...overrides,
  };
}

function daysWhere(
  days: readonly CycleRibbonDayViewData[],
  predicate: (day: CycleRibbonDayViewData) => boolean,
): number[] {
  return days.filter(predicate).map((day) => day.day);
}

describe("dashboard cycle ribbon", () => {
  it("draws every day of the running cycle with phases, the fertile window and logged days", () => {
    const ribbon = buildDashboardCycleRibbon(inputFor(profileOf(), recordsWith(3), MARCH_12));

    expect(ribbon).not.toBeNull();
    const days = ribbon!.days;
    expect(days).toHaveLength(28);
    expect(daysWhere(days, (day) => day.phase === "menstrual")).toEqual([1, 2, 3, 4, 5]);
    expect(daysWhere(days, (day) => day.phase === "ovulation")).toEqual([14]);
    expect(daysWhere(days, (day) => day.phase === "follicular")).toEqual([
      6, 7, 8, 9, 10, 11, 12, 13,
    ]);
    expect(days.filter((day) => day.phase === "luteal")).toHaveLength(14);
    expect(daysWhere(days, (day) => day.isFertile)).toEqual([9, 10, 11, 12, 13, 14]);
    expect(daysWhere(days, (day) => day.isFertilePeak)).toEqual([14]);
    expect(daysWhere(days, (day) => day.isToday)).toEqual([8]);
    // Logged facts stop at today; the period is behind it, so nothing is predicted.
    expect(daysWhere(days, (day) => day.isLogged)).toEqual([1, 2, 3, 4, 5]);
    expect(daysWhere(days, (day) => day.isPredictedFlow)).toEqual([]);
    expect(daysWhere(days, (day) => day.showScaleLabel)).toEqual([1, 8, 28]);
    expect(ribbon!.todayMarkerAlign).toBe("center");
    expect(ribbon!.truncatedNote).toBeNull();
    expect(ribbon!.accessibilityLabel).toBe(
      "Cycle map: today is cycle day 8 of about 28. Phase: Follicular. Fertile window (estimate): cycle days 9–14.",
    );
    expect(ribbon!.legend.map((item) => item.key)).toEqual([
      "phase-menstrual",
      "phase-follicular",
      "phase-ovulation",
      "phase-luteal",
      "fertile",
      "logged",
    ]);
  });

  it("withholds every phase past the period below the completed-cycle floor", () => {
    for (const completed of [0, 1, 2]) {
      const ribbon = buildDashboardCycleRibbon(
        inputFor(profileOf(), recordsWith(completed), MARCH_12),
      );

      expect(ribbon).not.toBeNull();
      const days = ribbon!.days;
      expect(daysWhere(days, (day) => day.phase === "menstrual")).toEqual([1, 2, 3, 4, 5]);
      expect(days.slice(5).every((day) => day.phase === "withheld")).toBe(true);
      expect(days.some((day) => day.isFertile || day.isFertilePeak)).toBe(false);
      expect(ribbon!.legend.map((item) => item.key)).not.toContain("phase-ovulation");
      expect(ribbon!.legend.map((item) => item.key)).not.toContain("fertile");
      expect(ribbon!.accessibilityLabel).toContain("Phase: Fertile details held back.");
      expect(ribbon!.accessibilityLabel).not.toMatch(/ovulation/i);
    }
  });

  it("marks the period days still ahead of today as predicted", () => {
    const ribbon = buildDashboardCycleRibbon(inputFor(profileOf(), recordsWith(3), MARCH_6));

    expect(daysWhere(ribbon!.days, (day) => day.isPredictedFlow)).toEqual([3, 4, 5]);
    expect(daysWhere(ribbon!.days, (day) => day.isLogged)).toEqual([1, 2]);
    expect(ribbon!.todayMarkerAlign).toBe("start");
    // Day 1 sits too close to today for its own number.
    expect(daysWhere(ribbon!.days, (day) => day.showScaleLabel)).toEqual([2, 28]);
    expect(ribbon!.accessibilityLabel).toContain("Predicted period days: cycle days 3–5.");
    expect(ribbon!.legend.map((item) => item.key)).toContain("predicted-flow");
  });

  it("names a one-day span and the truncated axis in every interface language", () => {
    // Day 4 of a five-day period leaves day 5 alone as predicted.
    const base = inputFor(profileOf(), recordsWith(3), new Date(2026, 2, 8, 10, 0, 0, 0));
    for (const locale of SUPPORTED_INTERFACE_LANGUAGES) {
      const copy = getDashboardCopy(locale).cycleRibbon;
      const ribbon = buildDashboardCycleRibbon({
        ...base,
        locale,
        projection: {
          ...base.projection,
          nextPeriodWindowStartDate: "2026-03-30",
          nextPeriodWindowEndDate: "2026-05-30",
        },
      });

      expect(daysWhere(ribbon!.days, (day) => day.isPredictedFlow)).toEqual([5]);
      expect(ribbon!.accessibilityLabel).toContain(
        `${copy.predictedPeriod}${copy.colon} ${copy.daySingle(5)}`,
      );
      expect(ribbon!.truncatedNote).toBe(copy.truncated(CYCLE_RIBBON_MAX_AXIS_DAYS));
      expect(ribbon!.truncatedNote).toContain(String(CYCLE_RIBBON_MAX_AXIS_DAYS));
    }
  });

  it("pins today's marker to the end near the last day", () => {
    const ribbon = buildDashboardCycleRibbon(
      inputFor(profileOf(), recordsWith(3), new Date(2026, 2, 31, 10, 0, 0, 0)),
    );

    expect(ribbon!.todayDay).toBe(27);
    expect(ribbon!.todayMarkerAlign).toBe("end");
  });

  it("paints no start window that ends before the running cycle opened", () => {
    const base = inputFor(profileOf(), recordsWith(3), MARCH_12);
    const ribbon = buildDashboardCycleRibbon({
      ...base,
      projection: {
        ...base.projection,
        nextPeriodWindowStartDate: "2026-02-20",
        nextPeriodWindowEndDate: "2026-02-25",
      },
    });

    expect(ribbon!.days.some((day) => day.isStartWindow)).toBe(false);
    expect(ribbon!.legend.map((item) => item.key)).not.toContain("start-window");
  });

  it("is not drawn when the period length leaves no cycle to place", () => {
    const base = inputFor(profileOf(), recordsWith(3), MARCH_12);

    expect(
      buildDashboardCycleRibbon({
        ...base,
        projection: { ...base.projection, projectedPeriodLength: 0 },
      }),
    ).toBeNull();
    expect(
      buildDashboardCycleRibbon({
        ...base,
        projection: { ...base.projection, projectedPeriodLength: 28 },
      }),
    ).toBeNull();
    // A projection without its own period length falls back to the profile's.
    const { projectedPeriodLength: _projected, ...withoutPeriodLength } = base.projection;
    expect(
      buildDashboardCycleRibbon({
        ...base,
        profile: profileOf({ periodLength: 28 }),
        projection: withoutPeriodLength,
      }),
    ).toBeNull();
  });

  it("extends the axis over a start window that runs past the cycle and caps it", () => {
    const base = inputFor(profileOf(), recordsWith(3), MARCH_12);
    const withWindow = buildDashboardCycleRibbon({
      ...base,
      projection: {
        ...base.projection,
        nextPeriodWindowStartDate: "2026-03-30",
        nextPeriodWindowEndDate: "2026-04-04",
      },
    });

    // Cycle days 26–31: the last three fall beyond the 28-day cycle.
    expect(withWindow!.days).toHaveLength(31);
    expect(daysWhere(withWindow!.days, (day) => day.isStartWindow)).toEqual([
      26, 27, 28, 29, 30, 31,
    ]);
    expect(daysWhere(withWindow!.days, (day) => day.phase === "beyond")).toEqual([29, 30, 31]);
    expect(withWindow!.legend.map((item) => item.key)).not.toContain("phase-beyond");
    expect(
      withWindow!.legend
        .find((item) => item.key === "start-window")!
        .swatches.map((swatch) => swatch.phase),
    ).toEqual(["luteal", "beyond"]);
    expect(withWindow!.accessibilityLabel).toContain(
      "Predicted start window: cycle days 26–31.",
    );

    const farWindow = buildDashboardCycleRibbon({
      ...base,
      projection: {
        ...base.projection,
        nextPeriodWindowStartDate: "2026-03-30",
        nextPeriodWindowEndDate: "2026-05-30",
      },
    });
    expect(farWindow!.days).toHaveLength(CYCLE_RIBBON_MAX_AXIS_DAYS);
    expect(farWindow!.truncatedNote).toBe(
      "The ribbon shows the first 60 days of this cycle; days beyond that are not drawn.",
    );
  });

  it("is not drawn under the day-log pause alone", () => {
    const records = [
      ...recordsWith(3),
      { ...createEmptyDayLogRecord("2026-03-10"), pregnancyTest: "positive" as const },
    ];
    const input = inputFor(profileOf(), records, MARCH_12);

    expect(input.projection.isPregnancyPaused).toBe(true);
    expect(buildDashboardCycleRibbon(input)).toBeNull();
  });

  it("is not drawn where the hero has no running cycle to place", () => {
    const records = recordsWith(3);
    const profile = profileOf();

    expect(
      buildDashboardCycleRibbon(inputFor(profile, records, MARCH_12, { suppressPredictions: true })),
    ).toBeNull();
    expect(
      buildDashboardCycleRibbon(
        inputFor(profile, records, MARCH_12, { postpartumAwaitingCycle: true }),
      ),
    ).toBeNull();
    expect(
      buildDashboardCycleRibbon(inputFor(profileOf({ unpredictableCycle: true }), records, MARCH_12)),
    ).toBeNull();
    // Irregular mode awaiting history names no date at all.
    expect(
      buildDashboardCycleRibbon(
        inputFor(profileOf({ irregularCycle: true }), recordsWith(2), MARCH_12),
      ),
    ).toBeNull();
    // No cycle start logged.
    expect(
      buildDashboardCycleRibbon(inputFor(profileOf({ lastPeriodStart: null }), [], MARCH_12)),
    ).toBeNull();
    // Past the reference length the running cycle no longer fits the axis.
    expect(
      buildDashboardCycleRibbon(inputFor(profile, records, new Date(2026, 3, 8, 10, 0, 0, 0))),
    ).toBeNull();
  });
});

describe("cycle view preference", () => {
  it("keeps one view when both are turned off", () => {
    expect(resolveCycleViews(undefined, undefined)).toEqual({
      showCycleRing: true,
      showCycleRibbon: true,
    });
    expect(resolveCycleViews(false, true)).toEqual({ showCycleRing: false, showCycleRibbon: true });
    expect(resolveCycleViews(true, false)).toEqual({ showCycleRing: true, showCycleRibbon: false });
    expect(resolveCycleViews(false, false)).toEqual({ showCycleRing: false, showCycleRibbon: true });
  });

  it("reaches the dashboard hero", () => {
    const records = recordsWith(3);
    const build = (profile: ProfileRecord) =>
      buildDashboardViewData(
        profile,
        records,
        buildCycleHistorySummary(profile, records, MARCH_12),
        MARCH_12,
      ).cycleHero;

    const both = build(profileOf());
    expect(both.showRing).toBe(true);
    expect(both.ribbon).not.toBeNull();

    const ringOnly = build(profileOf({ showCycleRibbon: false }));
    expect(ringOnly.showRing).toBe(true);
    expect(ringOnly.ribbon).toBeNull();

    const ribbonOnly = build(profileOf({ showCycleRing: false }));
    expect(ribbonOnly.showRing).toBe(false);
    expect(ribbonOnly.ribbon).not.toBeNull();
  });
});
