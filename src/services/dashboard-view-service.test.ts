import { getDashboardCopy } from "../i18n/dashboard-copy";
import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
} from "./cycle-history-service";
import { predictCycleWindow } from "./cycle-prediction-policy";
import {
  buildDashboardViewData,
  resolveDaySaveMessage,
  resolveDaySaveMessageKey,
} from "./dashboard-view-service";

describe("dashboard-view-service", () => {
  it("switches to facts-only mode for unpredictable cycles", () => {
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-03-10",
      cycleLength: 29,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: true,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
    };
    const todayEntry: DayLogRecord = {
      date: "2026-03-17",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none",
      mood: 0,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    };
    const historyRecords = [todayEntry];

    const viewData = buildDashboardViewData(
      profile,
      historyRecords,
      buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 17)),
      new Date(2026, 2, 17),
    );

    expect(viewData.cycleHero).toEqual(
      expect.objectContaining({
        state: "facts_only",
        title: "Day",
        value: "8",
        detail: "Predictions off",
        phaseCards: [],
        phaseSegments: [],
        currentTone: "neutral",
      }),
    );
    // Unpredictable-cycle mode keeps the day-save message neutral.
    expect(viewData.daySaveMessage).toBe("Saved.");
    expect(viewData.predictionExplanation).toBe(
      "Predictions are off in unpredictable cycle mode. Ovumcy shows recorded facts only.",
    );
  });

  it("uses a date-only journal header and exposes the projected current phase", () => {
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-03-10",
      cycleLength: 29,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
      languageOverride: null,
      themeOverride: null,
    };
    const todayEntry: DayLogRecord = {
      date: "2026-03-17",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none",
      mood: 0,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    };
    const historyRecords = [todayEntry];

    const viewData = buildDashboardViewData(
      profile,
      historyRecords,
      buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 17)),
      new Date(2026, 2, 17),
    );

    expect(viewData.cycleHero).toEqual(
      expect.objectContaining({
        state: "regular",
        title: "Day",
        value: "8",
        detail: "Cycle 29 days",
        currentTone: "follicular",
      }),
    );
    expect(viewData.cycleHero.progressPercent).toBeCloseTo(7 / 29, 3);
    expect(viewData.cycleHero.phaseCards).toEqual([
      expect.objectContaining({ key: "period", label: "Period", rangeLabel: "Days 1-5" }),
      expect.objectContaining({
        key: "follicular",
        label: "Follicular",
        rangeLabel: "Days 6-14",
        active: true,
      }),
      expect.objectContaining({ key: "ovulation", label: "Ovulation", rangeLabel: "Day 15" }),
      expect.objectContaining({ key: "luteal", label: "Luteal", rangeLabel: "Days 16-29" }),
    ]);
    expect(viewData.journal).toEqual({
      title: "Today journal",
      dateLabel: "March 17, 2026",
    });
  });

  it("uses compact hero-only phase labels for narrow localized dashboard chrome", () => {
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-03-10",
      cycleLength: 29,
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
      languageOverride: "ru",
      themeOverride: null,
    };
    const historyRecords: DayLogRecord[] = [
      {
        date: "2026-03-17",
        isPeriod: false,
        cycleStart: false,
        isUncertain: false,
        flow: "none",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
    ];

    const viewData = buildDashboardViewData(
      profile,
      historyRecords,
      buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 17)),
      new Date(2026, 2, 17),
      "ru",
    );

    expect(viewData.cycleHero.title).toBe("День");
    expect(viewData.cycleHero.phaseCards).toEqual([
      expect.objectContaining({ key: "period", label: "Месячные", rangeLabel: "д. 1-5" }),
      expect.objectContaining({
        key: "follicular",
        label: "Фолликулярная",
        rangeLabel: "д. 6-14",
      }),
      expect.objectContaining({ key: "ovulation", label: "Овуляция", rangeLabel: "д. 15" }),
      expect.objectContaining({ key: "luteal", label: "Лютеиновая", rangeLabel: "д. 16-29" }),
    ]);
  });

  it("shows approximate guidance when irregular cycle mode is enabled", () => {
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-03-10",
      cycleLength: 29,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: true,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
    };
    const historyRecords: DayLogRecord[] = [
      {
        date: "2026-03-10",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
    ];

    const history = buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 17));
    const viewData = buildDashboardViewData(
      profile,
      historyRecords,
      history,
      new Date(2026, 2, 17),
    );

    expect(viewData.cycleHero).toEqual(
      expect.objectContaining({
        state: "approximate",
        title: "Day",
        value: "8",
        detail: "Approximate cycle",
        caption:
          "Next period: around Apr 8 · 3 cycles are needed for a reliable range",
      }),
    );
    expect(viewData.predictionExplanation).toBe(
      "Irregular cycle mode keeps predictions visible, but they should be read as approximate guidance rather than exact dates.",
    );
  });

  it("shows a next-period window when recent cycle history varies", () => {
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-03-16",
      cycleLength: 29,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: true,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
    };
    const historyRecords: DayLogRecord[] = [
      {
        date: "2025-12-20",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-01-17",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-02-14",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-03-16",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
    ];

    const history = buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 26));
    const viewData = buildDashboardViewData(
      profile,
      historyRecords,
      history,
      new Date(2026, 2, 26),
    );

    expect(viewData.cycleHero).toEqual(
      expect.objectContaining({
        state: "approximate",
        caption: "Next period: Apr 13 - Apr 15",
      }),
    );
  });

  it("does not widen the next-period window for the 45+ age group (medical correctness)", () => {
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-03-16",
      cycleLength: 29,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: true,
      unpredictableCycle: false,
      ageGroup: "age_45_plus",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
    };
    const historyRecords: DayLogRecord[] = [
      {
        date: "2025-12-20",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-01-17",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-02-14",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-03-16",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
    ];

    const history = buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 26));
    const viewData = buildDashboardViewData(
      profile,
      historyRecords,
      history,
      new Date(2026, 2, 26),
    );

    expect(viewData.cycleHero).toEqual(
      expect.objectContaining({
        state: "approximate",
        caption: "Next period: Apr 13 - Apr 15",
      }),
    );
  });

  it("keeps a conservative rolled-forward hero when the prior prediction window is stale", () => {
    // Web parity: the segmented hero is suppressed (text-first) when the data is
    // stale, but predictions are NOT blanked. Anchor 2026-02-01, len 28, today
    // 2026-03-25 rolls forward to day 25 with next period 2026-03-29 shown in
    // conservative ("around") wording plus a "log your period" hint.
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-02-01",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: false,
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
    };

    const history = buildCycleHistorySummary(profile, [], new Date(2026, 2, 25));
    const viewData = buildDashboardViewData(
      profile,
      [],
      history,
      new Date(2026, 2, 25),
    );

    expect(viewData.cycleHero).toEqual(
      expect.objectContaining({
        state: "stale",
        title: "Day",
        value: "25",
        detail: "Cycle data may be outdated. Log your period when it starts.",
        caption: "Next period: around Mar 29",
        progressPercent: null,
        phaseCards: [],
        phaseSegments: [],
      }),
    );
  });

  it("suppresses the segmented hero for sparse irregular cycles (under 3 completed)", () => {
    // Web parity: DisplayNextPeriodNeedsData (irregular && <3 completed cycles)
    // forces the segmented ring off in favour of a text-first surface with the
    // needs-more-cycles note. A single logged cycle start is not enough history.
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: false,
      irregularCycle: true,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
    };
    const historyRecords: DayLogRecord[] = [
      {
        date: "2026-03-10",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
    ];

    const history = buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 17));
    const viewData = buildDashboardViewData(
      profile,
      historyRecords,
      history,
      new Date(2026, 2, 17),
    );

    expect(history.hasReliableTrend).toBe(false);
    expect(viewData.cycleHero).toEqual(
      expect.objectContaining({
        state: "approximate",
        title: "Day",
        value: "8",
        detail: "Approximate cycle",
        progressPercent: null,
        phaseCards: [],
        phaseSegments: [],
      }),
    );
  });

  it("keeps using the settings cycle length until at least two completed cycles exist", () => {
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-03-25",
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
    };
    const historyRecords: DayLogRecord[] = [
      {
        date: "2026-02-05",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-03-25",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
    ];

    const history = buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 26));
    const viewData = buildDashboardViewData(
      profile,
      historyRecords,
      history,
      new Date(2026, 2, 26),
    );

    expect(history.completedCycleCount).toBe(1);
    expect(viewData.cycleHero).toEqual(
      expect.objectContaining({
        state: "regular",
        title: "Day",
        value: "2",
        detail: "Cycle 28 days",
        // With <3 completed cycles the data-driven range is no longer emitted —
        // dashboard falls back to a single date.
        caption: "Next period: Apr 22",
        // Period phase now spans the rolling AveragePeriodLength, not the
        // configured 5 (web parity, dashboard_cycle_hero.go:54): both logged
        // cycles are single-day period markers (2026-02-05, 2026-03-25), so the
        // last-6 observed average — including the current cycle — is 1 day.
        // Day 2 therefore reads follicular, not period.
        currentTone: "follicular",
        phaseCards: [
          expect.objectContaining({ key: "period", rangeLabel: "Day 1", active: false }),
          expect.objectContaining({ key: "follicular", rangeLabel: "Days 2-13", active: true }),
          expect.objectContaining({ key: "ovulation", rangeLabel: "Day 14", active: false }),
          expect.objectContaining({ key: "luteal", rangeLabel: "Days 15-28", active: false }),
        ],
      }),
    );
  });

  it("shows the upcoming ovulation date next to the next-period line", () => {
    // Same fixture as "uses a date-only journal header...": anchor 2026-03-10,
    // cycle 29, ovulation day 15 (2026-03-24) is still ahead of today
    // (2026-03-17, cycle day 8), so no forward-roll is needed.
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-03-10",
      cycleLength: 29,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
      languageOverride: null,
      themeOverride: null,
    };
    const todayEntry: DayLogRecord = {
      date: "2026-03-17",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none",
      mood: 0,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      lhTest: "none",
      pregnancyTest: "none",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    };
    const historyRecords = [todayEntry];

    const viewData = buildDashboardViewData(
      profile,
      historyRecords,
      buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 17)),
      new Date(2026, 2, 17),
    );

    expect(viewData.cycleHero.upcomingOvulationLabel).toBe("Ovulation: Mar 24");
  });

  it("hides the upcoming ovulation date once predictions pause after a positive pregnancy test", () => {
    // Medical-safety invariant (mirrors cycle-history-service.test.ts's "surfaces
    // no upcoming ovulation while predictions are paused..."): the pause blanks
    // every dashboard prediction surface, this new line included.
    const profile: ProfileRecord = {
      lastPeriodStart: "2026-01-05",
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
    };
    const historyRecords: DayLogRecord[] = [
      {
        date: "2026-01-05",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
      {
        date: "2026-02-10",
        isPeriod: false,
        cycleStart: false,
        isUncertain: false,
        flow: "none",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        pregnancyTest: "positive",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "",
      },
    ];
    const now = new Date(2026, 1, 12);

    const history = buildCycleHistorySummary(profile, historyRecords, now);
    const viewData = buildDashboardViewData(profile, historyRecords, history, now);

    expect(viewData.cycleHero.state).toBe("unknown");
    expect(viewData.cycleHero.upcomingOvulationLabel).toBeNull();
  });

  describe("resolveDaySaveMessageKey (day-feedback policy port)", () => {
    const cycleStart = "2026-03-10";
    const now = new Date(2026, 2, 24);

    function makeProjection(
      profile: ProfileRecord,
      records: DayLogRecord[],
    ): ReturnType<typeof buildCurrentCycleProjection> {
      const history = buildCycleHistorySummary(profile, records, now);
      return buildCurrentCycleProjection(profile, history, records, now);
    }

    function regularProfile(
      overrides: Partial<ProfileRecord> = {},
    ): ProfileRecord {
      return {
        ...createDefaultProfileRecord(),
        lastPeriodStart: cycleStart,
        cycleLength: 28,
        periodLength: 5,
        ...overrides,
      };
    }

    const cycleStartRecords: DayLogRecord[] = [
      { ...createEmptyDayLogRecord(cycleStart), isPeriod: true, cycleStart: true },
    ];

    it("offers a self-care message on cycle days 1 to 3", () => {
      const profile = regularProfile();
      const projection = makeProjection(profile, cycleStartRecords);
      expect(resolveDaySaveMessageKey("2026-03-10", profile, projection)).toBe(
        "self_care",
      );
      expect(resolveDaySaveMessageKey("2026-03-12", profile, projection)).toBe(
        "self_care",
      );
      // Cycle day 4 is past the self-care window.
      expect(resolveDaySaveMessageKey("2026-03-13", profile, projection)).toBe(
        "neutral",
      );
    });

    it("offers a fertile message inside the predicted fertile window", () => {
      const profile = regularProfile();
      const projection = makeProjection(profile, cycleStartRecords);
      const window = predictCycleWindow(
        cycleStart,
        projection.predictionCycleLength,
        projection.lutealPhase,
      );
      expect(window.fertilityStart).not.toBeNull();
      expect(
        resolveDaySaveMessageKey(window.fertilityStart ?? "", profile, projection),
      ).toBe("fertile");
    });

    it("stays neutral in unpredictable-cycle mode even on cycle day 1", () => {
      const profile = regularProfile({ unpredictableCycle: true });
      const projection = makeProjection(profile, cycleStartRecords);
      expect(resolveDaySaveMessageKey(cycleStart, profile, projection)).toBe(
        "neutral",
      );
    });

    it("lets a positive-pregnancy pause win over every other message", () => {
      const profile = regularProfile();
      const records: DayLogRecord[] = [
        ...cycleStartRecords,
        {
          ...createEmptyDayLogRecord("2026-03-15"),
          pregnancyTest: "positive",
        },
      ];
      const projection = makeProjection(profile, records);
      expect(projection.isPregnancyPaused).toBe(true);
      // Even on cycle day 1 (which would otherwise be self-care), the pause wins.
      expect(resolveDaySaveMessageKey(cycleStart, profile, projection)).toBe(
        "pregnancy_paused",
      );
    });

    it("falls back to neutral when the projection has no cycle anchor", () => {
      const profile = regularProfile({ lastPeriodStart: null });
      const projection = makeProjection(profile, []);

      // No anchor date (and not paused / not unpredictable) exercises the
      // anchor-absent path, which yields the neutral default.
      expect(projection.cycleAnchorDate).toBeNull();
      expect(resolveDaySaveMessageKey("2026-03-10", profile, projection)).toBe(
        "neutral",
      );
    });

    it("resolves the save message with the default English locale when none is passed", () => {
      const profile = regularProfile();
      const projection = makeProjection(profile, cycleStartRecords);

      // Omitting the locale argument exercises the default-parameter path; the
      // resolved copy must match an explicit "en" request.
      expect(resolveDaySaveMessage("2026-03-10", profile, projection)).toBe(
        resolveDaySaveMessage("2026-03-10", profile, projection, "en"),
      );
    });
  });
});

describe("dashboard upcoming-ovulation low-reliability softening", () => {
  function cycleStart(date: string): DayLogRecord {
    return { ...createEmptyDayLogRecord(date), isPeriod: true, cycleStart: true };
  }

  function heroFor(profileOverrides: Partial<ProfileRecord>, records: DayLogRecord[], now: Date) {
    const profile: ProfileRecord = {
      ...createDefaultProfileRecord(),
      ...profileOverrides,
    };
    const history = buildCycleHistorySummary(profile, records, now);
    return buildDashboardViewData(profile, records, history, now).cycleHero;
  }

  it("shows a needs-more-cycles ovulation note for a sparse irregular cycle", () => {
    const hero = heroFor(
      { irregularCycle: true, lastPeriodStart: "2026-03-10" },
      [cycleStart("2026-03-10")],
      new Date(2026, 2, 17),
    );

    expect(hero.upcomingOvulationLabel).toBe(
      "Ovulation: 3 completed cycles are needed before an ovulation range can be shown",
    );
  });

  it("shows an ovulation range once an irregular cycle has a reliable trend", () => {
    const hero = heroFor(
      { irregularCycle: true, lastPeriodStart: "2026-03-16" },
      [
        cycleStart("2025-12-20"),
        cycleStart("2026-01-17"),
        cycleStart("2026-02-14"),
        cycleStart("2026-03-16"),
      ],
      new Date(2026, 2, 26),
    );

    expect(hero.upcomingOvulationLabel).toBe("Ovulation: Mar 30 — Apr 1");
  });

  it("renders the ovulation range through each interface language's copy", () => {
    const profile: ProfileRecord = {
      ...createDefaultProfileRecord(),
      irregularCycle: true,
      lastPeriodStart: "2026-03-16",
    };
    const records = [
      cycleStart("2025-12-20"),
      cycleStart("2026-01-17"),
      cycleStart("2026-02-14"),
      cycleStart("2026-03-16"),
    ];
    const now = new Date(2026, 2, 26);
    const history = buildCycleHistorySummary(profile, records, now);

    // The active language is passed to the view builder as the locale; every
    // catalog must format the ovulation as an explicit start—end range (never a
    // single false-precision day) behind its own localized "ovulation" prefix.
    for (const locale of ["en", "ru", "de", "fr", "es", "it"] as const) {
      const hero = buildDashboardViewData(
        profile,
        records,
        history,
        now,
        locale,
      ).cycleHero;
      const copy = getDashboardCopy(locale);
      expect(hero.upcomingOvulationLabel).toContain(`${copy.ovulation}: `);
      expect(hero.upcomingOvulationLabel).toContain(" — ");
    }
  });

  it("keeps a single concrete ovulation date for a regular cycle", () => {
    const hero = heroFor(
      { lastPeriodStart: "2026-03-01" },
      [],
      new Date(2026, 2, 5),
    );

    expect(hero.upcomingOvulationLabel).toBe("Ovulation: Mar 14");
  });

  it("appends the approximate qualifier when a short cycle clamps the ovulation date", () => {
    // cycleLength 17 with the default 14-day luteal phase exceeds the supported
    // luteal span, so predictCycleWindow clamps and marks the date inexact; the
    // concrete ovulation label must then carry the "(approximate)" qualifier.
    const hero = heroFor(
      { lastPeriodStart: "2026-03-10", cycleLength: 17 },
      [cycleStart("2026-03-10")],
      new Date(2026, 2, 12),
    );

    expect(hero.upcomingOvulationLabel).toContain(
      getDashboardCopy("en").ovulationApproximate,
    );
  });
});
