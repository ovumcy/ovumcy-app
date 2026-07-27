import { getDashboardCopy } from "../i18n/dashboard-copy";
import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { createPregnancyRecord } from "../models/pregnancy";
import { createPostpartumRecord } from "../models/postpartum";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
} from "./cycle-history-service";
import { predictCycleWindow } from "./cycle-prediction-policy";
import {
  buildDashboardViewData,
  loadDashboardScreenState,
  resolveDaySaveMessage,
  resolveDaySaveMessageKey,
} from "./dashboard-view-service";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

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

    it("lets an active pregnancy record win over the fertile window and the day-log pause", () => {
      const profile = regularProfile();
      const projection = makeProjection(profile, cycleStartRecords);
      const window = predictCycleWindow(
        cycleStart,
        projection.predictionCycleLength,
        projection.lutealPhase,
      );
      expect(window.fertilityStart).not.toBeNull();
      // A fertile day with no day-log pause: the record alone must suppress —
      // an LMP/ultrasound-dated pregnancy never logs a positive test, so
      // without this leg the save toast claimed a fertile window.
      expect(
        resolveDaySaveMessageKey(
          window.fertilityStart ?? "",
          profile,
          projection,
          true,
        ),
      ).toBe("pregnancy_active");

      // With the pause also present the record still wins the copy split: its
      // message names the tracked pregnancy, not the positive test.
      const paused = makeProjection(profile, [
        ...cycleStartRecords,
        {
          ...createEmptyDayLogRecord("2026-03-15"),
          pregnancyTest: "positive",
        },
      ]);
      expect(paused.isPregnancyPaused).toBe(true);
      expect(resolveDaySaveMessageKey(cycleStart, profile, paused, true)).toBe(
        "pregnancy_active",
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

const PREGNANCY_EDD = "2026-10-08";

// `now` (Date) that makes calcGestationalAge(PREGNANCY_EDD, formatLocalDate(now))
// report `gaDays`, mirroring the pregnancy-timeline suites.
function pregnancyNowForGaDays(gaDays: number): Date {
  return addDays(parseLocalDate(PREGNANCY_EDD)!, gaDays - 280);
}

function pregnancyActiveRecord() {
  return createPregnancyRecord({
    edd: PREGNANCY_EDD,
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    startedAt: "2026-03-01",
  });
}

function positivePregnancyTestRecords(date: string): DayLogRecord[] {
  return [{ ...createEmptyDayLogRecord(date), pregnancyTest: "positive" }];
}

function endedPregnancyRecord(endedAt: string, reason: "birth" | "loss" | "other") {
  return {
    ...pregnancyActiveRecord(),
    status: "ended" as const,
    endedAt,
    endReason: reason,
    modeOfDelivery: null,
  };
}

describe("dashboard-view-service pregnancy mode", () => {
  const pausedProfile: ProfileRecord = {
    ...createDefaultProfileRecord(),
    lastPeriodStart: "2026-05-01",
    languageOverride: "en",
  };
  const pausedNow = new Date(2026, 5, 1);
  const pausedRecords = positivePregnancyTestRecords("2026-06-01");

  it("stays in plain cycle mode with no entry card when nothing is pregnant", () => {
    const profile: ProfileRecord = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-10",
    };
    const now = new Date(2026, 2, 17);
    const viewData = buildDashboardViewData(
      profile,
      [],
      buildCycleHistorySummary(profile, [], now),
      now,
    );

    expect(viewData.mode).toBe("cycle");
    expect(viewData.pregnancyEntryCard).toBeUndefined();
    expect(viewData.pregnancyDashboard).toBeUndefined();
  });

  it("renders a premium-locked entry card while the pause is active and locked", () => {
    const viewData = buildDashboardViewData(
      pausedProfile,
      pausedRecords,
      buildCycleHistorySummary(pausedProfile, pausedRecords, pausedNow),
      pausedNow,
      "en",
      { activePregnancy: null, pregnancyModeUnlocked: false },
    );

    expect(viewData.mode).toBe("cycle");
    expect(viewData.pregnancyEntryCard).toEqual(
      expect.objectContaining({ variant: "premium_locked" }),
    );
    expect(viewData.pregnancyDashboard).toBeUndefined();
  });

  it("renders a start entry card while the pause is active and unlocked", () => {
    const viewData = buildDashboardViewData(
      pausedProfile,
      pausedRecords,
      buildCycleHistorySummary(pausedProfile, pausedRecords, pausedNow),
      pausedNow,
      "en",
      { activePregnancy: null, pregnancyModeUnlocked: true },
    );

    expect(viewData.pregnancyEntryCard).toEqual(
      expect.objectContaining({ variant: "start_pregnancy" }),
    );
  });

  it("switches to pregnancy dashboard view-data for an active record", () => {
    const now = pregnancyNowForGaDays(171);
    const profile = createDefaultProfileRecord();
    const viewData = buildDashboardViewData(
      profile,
      [],
      buildCycleHistorySummary(profile, [], now),
      now,
      "en",
      { activePregnancy: pregnancyActiveRecord() },
    );

    expect(viewData.mode).toBe("pregnancy");
    expect(viewData.pregnancyEntryCard).toBeUndefined();
    expect(viewData.pregnancyDashboard?.hero.weekValueLabel).toBe("24+3");
    expect(viewData.pregnancyDashboard?.kickTeaser.visible).toBe(false);
  });

  it("shows plain cycle mode with no entry card after a birth end (positive still paused)", () => {
    const viewData = buildDashboardViewData(
      pausedProfile,
      pausedRecords,
      buildCycleHistorySummary(pausedProfile, pausedRecords, pausedNow),
      pausedNow,
      "en",
      {
        activePregnancy: null,
        pregnancyModeUnlocked: true,
        endedPregnancyRecords: [endedPregnancyRecord("2026-06-05", "birth")],
      },
    );

    expect(viewData.mode).toBe("cycle");
    expect(viewData.pregnancyEntryCard).toBeUndefined();
    expect(viewData.pregnancyDashboard).toBeUndefined();
  });

  it("shows plain cycle mode with no entry card after a loss end (no re-engagement)", () => {
    // Boundary: the loss is recorded on the same day as the paused positive
    // test, so endedAt === pregnancyTestDate must still count as "on/after".
    const viewData = buildDashboardViewData(
      pausedProfile,
      pausedRecords,
      buildCycleHistorySummary(pausedProfile, pausedRecords, pausedNow),
      pausedNow,
      "en",
      {
        activePregnancy: null,
        pregnancyModeUnlocked: true,
        endedPregnancyRecords: [endedPregnancyRecord("2026-06-01", "loss")],
      },
    );

    expect(viewData.mode).toBe("cycle");
    expect(viewData.pregnancyEntryCard).toBeUndefined();
    expect(viewData.pregnancyDashboard).toBeUndefined();
  });

  it("re-shows the entry card for a new positive test dated after the latest end", () => {
    const newPositive = positivePregnancyTestRecords("2026-07-01");
    const now = new Date(2026, 6, 2);
    const viewData = buildDashboardViewData(
      pausedProfile,
      newPositive,
      buildCycleHistorySummary(pausedProfile, newPositive, now),
      now,
      "en",
      {
        activePregnancy: null,
        pregnancyModeUnlocked: true,
        endedPregnancyRecords: [endedPregnancyRecord("2026-06-05", "birth")],
      },
    );

    expect(viewData.pregnancyEntryCard).toEqual(
      expect.objectContaining({ variant: "start_pregnancy" }),
    );
  });

  it("shows the kick teaser from week 28 in the pregnancy dashboard", () => {
    const now = pregnancyNowForGaDays(28 * 7);
    const profile = createDefaultProfileRecord();
    const viewData = buildDashboardViewData(
      profile,
      [],
      buildCycleHistorySummary(profile, [], now),
      now,
      "en",
      { activePregnancy: pregnancyActiveRecord() },
    );

    expect(viewData.pregnancyDashboard?.kickTeaser.visible).toBe(true);
  });

  it("surfaces today's logged metrics into the pregnancy dashboard view-data", () => {
    const now = pregnancyNowForGaDays(196);
    const todayValue = formatLocalDate(now);
    const profile = createDefaultProfileRecord();
    const todayLog: DayLogRecord = {
      ...createEmptyDayLogRecord(todayValue),
      weightKg: 70,
    };
    const viewData = buildDashboardViewData(
      profile,
      [todayLog],
      buildCycleHistorySummary(profile, [todayLog], now),
      now,
      "en",
      { activePregnancy: pregnancyActiveRecord() },
    );

    expect(viewData.pregnancyDashboard?.todayMetrics.weight?.value).toBe("70 kg");
  });

  it("emits a stale card instead of the pregnancy dashboard for an active record whose EDD passed well beyond the trackable window", () => {
    const now = pregnancyNowForGaDays(630); // ~50 weeks past the due date
    const profile = createDefaultProfileRecord();
    const viewData = buildDashboardViewData(
      profile,
      [],
      buildCycleHistorySummary(profile, [], now),
      now,
      "en",
      { activePregnancy: pregnancyActiveRecord() },
    );

    expect(viewData.mode).toBe("cycle");
    expect(viewData.pregnancyDashboard).toBeUndefined();
    expect(viewData.pregnancyEntryCard).toBeUndefined();
    expect(viewData.staleCard).toEqual(
      expect.objectContaining({
        ctaLabel: "Manage pregnancy tracking",
      }),
    );
    expect(viewData.staleCard?.body).toContain("estimated due date has passed");
  });

  it("keeps the silent cycle fallback (no stale card, no entry card) for a malformed/future EDD", () => {
    const now = pregnancyNowForGaDays(-1); // before conception -- malformed/future relative to "today"
    const profile = createDefaultProfileRecord();
    const viewData = buildDashboardViewData(
      profile,
      [],
      buildCycleHistorySummary(profile, [], now),
      now,
      "en",
      { activePregnancy: pregnancyActiveRecord() },
    );

    expect(viewData.mode).toBe("cycle");
    expect(viewData.pregnancyDashboard).toBeUndefined();
    expect(viewData.pregnancyEntryCard).toBeUndefined();
    expect(viewData.staleCard).toBeUndefined();
  });

  it("does not emit a stale card for a normal in-window active pregnancy", () => {
    const now = pregnancyNowForGaDays(171);
    const profile = createDefaultProfileRecord();
    const viewData = buildDashboardViewData(
      profile,
      [],
      buildCycleHistorySummary(profile, [], now),
      now,
      "en",
      { activePregnancy: pregnancyActiveRecord() },
    );

    expect(viewData.mode).toBe("pregnancy");
    expect(viewData.staleCard).toBeUndefined();
  });

  // Regression guard. The hole: resolvePregnancyPause (cycle-history-
  // service, untouched) lifts its pause once a period is logged after the
  // latest positive test -- correct when the pregnancy actually ended and a
  // real new cycle starts, wrong while the pregnancy is still active (e.g.
  // bleeding logged as a period day). Pins that the dashboard was never
  // exposed to this hole in the first place: buildPregnancySection checks
  // `activePregnancy` FIRST, before ever consulting projection.isPregnancyPaused,
  // so cycle predictions can never leak into pregnancy mode regardless of the
  // day-log records' own pause state.
  it("stays in pregnancy dashboard mode even after a period logged post-positive-test lifts cycle-history's own pause", () => {
    const now = pregnancyNowForGaDays(171);
    const profile = createDefaultProfileRecord();
    const records: DayLogRecord[] = [
      { ...createEmptyDayLogRecord("2026-05-01"), pregnancyTest: "positive" },
      {
        ...createEmptyDayLogRecord("2026-05-20"),
        isPeriod: true,
        cycleStart: true,
      },
    ];
    const history = buildCycleHistorySummary(profile, records, now);

    // Sanity check on the fixture itself: cycle-history-service's own pause
    // IS lifted here (this is the exact hole FIX B closes downstream).
    const projection = buildCurrentCycleProjection(profile, history, records, now);
    expect(projection.isPregnancyPaused).toBe(false);

    const viewData = buildDashboardViewData(
      profile,
      records,
      history,
      now,
      "en",
      { activePregnancy: pregnancyActiveRecord() },
    );

    expect(viewData.mode).toBe("pregnancy");
    expect(viewData.pregnancyDashboard).toBeDefined();
    expect(viewData.pregnancyEntryCard).toBeUndefined();
  });

  // Regression guard (medical safety). An active record whose GA left the
  // trackable window renders in CYCLE mode beside the stale card, so the cycle
  // hero, the current-cycle fertility summary and the prediction hint are all
  // still on screen. The day-log pause cannot carry suppression there: a
  // pregnancy started from an LMP/ultrasound date logs no positive test, so
  // resolvePregnancyPause never pauses and the hero rolled its predictions
  // forward as if the owner were cycling.
  it("suppresses hero, fertility summary and prediction hint for a stale active pregnancy that never logged a positive test", () => {
    const now = pregnancyNowForGaDays(630); // ~50 weeks past the due date
    const profile: ProfileRecord = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-01-01", // the pregnancy's own LMP
    };
    const records: DayLogRecord[] = [
      { ...createEmptyDayLogRecord("2026-01-14"), lhTest: "peak" },
    ];
    const history = buildCycleHistorySummary(profile, records, now);

    // Fixture sanity: no positive test anywhere, so cycle-history-service's own
    // pause never engages and it keeps projecting a next period.
    const projection = buildCurrentCycleProjection(profile, history, records, now);
    expect(projection.isPregnancyPaused).toBe(false);
    expect(projection.nextPeriodDate).not.toBeNull();

    // Baseline: the same data without the pregnancy record populates every one
    // of these surfaces, so the suppression below is meaningful.
    const cycling = buildDashboardViewData(profile, records, history, now, "en", {
      showAdvancedFertilitySummary: true,
    });
    expect(cycling.cycleHero.state).toBe("stale");
    expect(cycling.cycleHero.caption).toContain(
      getDashboardCopy("en").approximateDatePrefix,
    );
    expect(cycling.advancedFertilitySummary).toBeDefined();

    const viewData = buildDashboardViewData(profile, records, history, now, "en", {
      activePregnancy: pregnancyActiveRecord(),
      showAdvancedFertilitySummary: true,
    });

    expect(viewData.mode).toBe("cycle");
    expect(viewData.staleCard).toBeDefined();
    expect(viewData.cycleHero).toEqual(
      expect.objectContaining({
        state: "unknown",
        caption: getDashboardCopy("en").nextPeriodPrompt,
        upcomingOvulationLabel: null,
        progressPercent: null,
        phaseSegments: [],
        phaseCards: [],
      }),
    );
    expect(viewData.advancedFertilitySummary).toBeUndefined();
    expect(viewData.predictionExplanation).toBe("");
  });

  it("suppresses the cycle hero for a stale active pregnancy after a period logged post-positive-test lifts the day-log pause", () => {
    const now = pregnancyNowForGaDays(630);
    const profile: ProfileRecord = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-01-01",
    };
    const records: DayLogRecord[] = [
      { ...createEmptyDayLogRecord("2027-05-01"), pregnancyTest: "positive" },
      {
        ...createEmptyDayLogRecord("2027-05-20"),
        isPeriod: true,
        cycleStart: true,
      },
    ];
    const history = buildCycleHistorySummary(profile, records, now);

    // Fixture sanity: the period lifted cycle-history-service's own pause.
    const projection = buildCurrentCycleProjection(profile, history, records, now);
    expect(projection.isPregnancyPaused).toBe(false);

    const viewData = buildDashboardViewData(profile, records, history, now, "en", {
      activePregnancy: pregnancyActiveRecord(),
    });

    expect(viewData.mode).toBe("cycle");
    expect(viewData.cycleHero.state).toBe("unknown");
    expect(viewData.cycleHero.caption).toBe(
      getDashboardCopy("en").nextPeriodPrompt,
    );
    expect(viewData.cycleHero.upcomingOvulationLabel).toBeNull();
  });

  it("never claims a fertile window in the day-save message while a pregnancy record is active", () => {
    const now = new Date(2026, 2, 24);
    const profile: ProfileRecord = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-10",
    };
    const records: DayLogRecord[] = [
      {
        ...createEmptyDayLogRecord("2026-03-10"),
        isPeriod: true,
        cycleStart: true,
      },
    ];
    const history = buildCycleHistorySummary(profile, records, now);
    const projection = buildCurrentCycleProjection(profile, history, records, now);
    const fertileDay = predictCycleWindow(
      "2026-03-10",
      projection.predictionCycleLength,
      projection.lutealPhase,
    ).fertilityStart;
    expect(fertileDay).not.toBeNull();
    const fertileNow = parseLocalDate(fertileDay ?? "");
    expect(fertileNow).not.toBeNull();

    // Baseline guard: without the record this exact day announces the fertile
    // window, so the record-driven rewrite below is meaningful.
    const cycling = buildDashboardViewData(
      profile,
      records,
      history,
      fertileNow!,
      "en",
    );
    expect(cycling.daySaveMessage).toBe(
      getDashboardCopy("en").saveMessageFertile,
    );

    const viewData = buildDashboardViewData(
      profile,
      records,
      history,
      fertileNow!,
      "en",
      { activePregnancy: pregnancyActiveRecord() },
    );
    expect(viewData.daySaveMessage).toBe(
      getDashboardCopy("en").saveMessagePregnancyActive,
    );
  });

  it("keeps the pregnancy-paused hint (not a blank one) while only the day-log pause suppresses predictions", () => {
    const viewData = buildDashboardViewData(
      pausedProfile,
      pausedRecords,
      buildCycleHistorySummary(pausedProfile, pausedRecords, pausedNow),
      pausedNow,
      "en",
      { activePregnancy: null },
    );

    expect(viewData.cycleHero.state).toBe("unknown");
    expect(viewData.predictionExplanation).toBe(
      getDashboardCopy("en").pregnancyPausedHint,
    );
  });
});

describe("loadDashboardScreenState pregnancy mode", () => {

  it("reads the active pregnancy and renders pregnancy dashboard view-data", async () => {
    const now = pregnancyNowForGaDays(171);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(pregnancyActiveRecord()),
    });
    const loadPregnancyModuleOwned = jest.fn().mockResolvedValue(false);

    const state = await loadDashboardScreenState(storage, now, "en", {}, {
      loadPregnancyModuleOwned,
    });

    expect(storage.readActivePregnancy).toHaveBeenCalled();
    expect(state.viewData.mode).toBe("pregnancy");
    // An existing record renders from local data — the managed unlock gate is
    // never consulted.
    expect(loadPregnancyModuleOwned).not.toHaveBeenCalled();
  });

  it("reuses the already-loaded active pregnancy to show pregnancy metrics in the day-log editor", async () => {
    const now = pregnancyNowForGaDays(171);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(pregnancyActiveRecord()),
    });

    const state = await loadDashboardScreenState(storage, now, "en", {}, {
      loadPregnancyModuleOwned: jest.fn().mockResolvedValue(false),
    });

    expect(state.editorViewData.visibility.showPregnancyMetrics).toBe(true);
    // No second pregnancy read for the editor's own visibility gate.
    expect(storage.readActivePregnancy).toHaveBeenCalledTimes(1);
  });

  it("hides pregnancy metrics in the day-log editor with no active pregnancy", async () => {
    const now = new Date(2026, 2, 17);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([]),
    });

    const state = await loadDashboardScreenState(storage, now, "en", {}, {
      loadPregnancyModuleOwned: jest.fn().mockResolvedValue(false),
    });

    expect(state.editorViewData.visibility.showPregnancyMetrics).toBe(false);
  });

  it("consults the unlock gate exactly once when paused with no record (locked)", async () => {
    const now = new Date(2026, 5, 1);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listDayLogRecordsInRange: jest
        .fn()
        .mockResolvedValue(positivePregnancyTestRecords("2026-06-01")),
    });
    const loadPregnancyModuleOwned = jest.fn().mockResolvedValue(false);

    const state = await loadDashboardScreenState(storage, now, "en", {}, {
      loadPregnancyModuleOwned,
    });

    expect(loadPregnancyModuleOwned).toHaveBeenCalledTimes(1);
    expect(state.viewData.pregnancyEntryCard).toEqual(
      expect.objectContaining({ variant: "premium_locked" }),
    );
  });

  it("produces the start entry card when paused, no record, and unlocked", async () => {
    const now = new Date(2026, 5, 1);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listDayLogRecordsInRange: jest
        .fn()
        .mockResolvedValue(positivePregnancyTestRecords("2026-06-01")),
    });
    const loadPregnancyModuleOwned = jest.fn().mockResolvedValue(true);

    const state = await loadDashboardScreenState(storage, now, "en", {}, {
      loadPregnancyModuleOwned,
    });

    expect(state.viewData.pregnancyEntryCard).toEqual(
      expect.objectContaining({ variant: "start_pregnancy" }),
    );
  });

  it("never consults the unlock gate on a plain cycle-mode load", async () => {
    const now = new Date(2026, 2, 17);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([]),
    });
    const loadPregnancyModuleOwned = jest.fn().mockResolvedValue(false);

    const state = await loadDashboardScreenState(storage, now, "en", {}, {
      loadPregnancyModuleOwned,
    });

    expect(loadPregnancyModuleOwned).not.toHaveBeenCalled();
    expect(state.viewData.mode).toBe("cycle");
    expect(state.viewData.pregnancyEntryCard).toBeUndefined();
    // The pregnancy-record list is an extra read reserved for the paused state.
    expect(storage.listPregnancyRecords).not.toHaveBeenCalled();
  });

  it("suppresses the entry card when an ended record covers the paused positive test", async () => {
    const now = new Date(2026, 5, 1);
    const storage = createLocalAppStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(null),
      listDayLogRecordsInRange: jest
        .fn()
        .mockResolvedValue(positivePregnancyTestRecords("2026-06-01")),
      listPregnancyRecords: jest
        .fn()
        .mockResolvedValue([endedPregnancyRecord("2026-06-05", "loss")]),
    });
    const loadPregnancyModuleOwned = jest.fn().mockResolvedValue(true);

    const state = await loadDashboardScreenState(storage, now, "en", {}, {
      loadPregnancyModuleOwned,
    });

    expect(storage.listPregnancyRecords).toHaveBeenCalledTimes(1);
    expect(state.viewData.mode).toBe("cycle");
    expect(state.viewData.pregnancyEntryCard).toBeUndefined();
  });
});

// Cycle-return offer detection: buildDashboardViewData's
// postpartum branch computes `hasNewCycleStart` from the SAME
// profile/historyRecords it already has (no new storage read) via
// cycle-history-service.collectCycleStartDates, and threads it into
// buildPostpartumDashboardViewData.
describe("dashboard-view-service postpartum cycle-return offer", () => {
  function periodStartRecord(date: string): DayLogRecord {
    return {
      ...createEmptyDayLogRecord(date),
      isPeriod: true,
      cycleStart: true,
    };
  }

  it("shows the offer and hides the LAM card: active postpartum + a cycle start logged AFTER the birth", () => {
    const profile = createDefaultProfileRecord();
    const now = new Date(2026, 5, 20); // 2026-06-20
    const activePostpartum = createPostpartumRecord({
      startedAt: "2026-06-01",
      modeOfDelivery: "vaginal",
    });
    const records = [periodStartRecord("2026-06-15")];
    const history = buildCycleHistorySummary(profile, records, now);

    const viewData = buildDashboardViewData(profile, records, history, now, "en", {
      activePostpartum,
    });

    expect(viewData.mode).toBe("postpartum");
    expect(viewData.postpartumDashboard?.cycleReturnOffer.visible).toBe(true);
    expect(viewData.postpartumDashboard?.lamCard).toBeNull();
  });

  it("hides the offer and keeps the LAM card: the only logged cycle start is BEFORE the birth", () => {
    const profile = createDefaultProfileRecord();
    const now = new Date(2026, 5, 20);
    const activePostpartum = createPostpartumRecord({
      startedAt: "2026-06-01",
      modeOfDelivery: "vaginal",
    });
    // A pre-pregnancy period, well before the birth -- must not read as a
    // "new" (returning) cycle start.
    const records = [periodStartRecord("2026-01-10")];
    const history = buildCycleHistorySummary(profile, records, now);

    const viewData = buildDashboardViewData(profile, records, history, now, "en", {
      activePostpartum,
    });

    expect(viewData.mode).toBe("postpartum");
    expect(viewData.postpartumDashboard?.cycleReturnOffer.visible).toBe(false);
    expect(viewData.postpartumDashboard?.lamCard).not.toBeNull();
  });

  it("never builds a postpartum section (offer or LAM card) with no active postpartum record", () => {
    const profile = createDefaultProfileRecord();
    const now = new Date(2026, 5, 20);
    const records = [periodStartRecord("2026-06-15")];
    const history = buildCycleHistorySummary(profile, records, now);

    const viewData = buildDashboardViewData(profile, records, history, now, "en", {
      activePostpartum: null,
    });

    expect(viewData.mode).toBe("cycle");
    expect(viewData.postpartumDashboard).toBeUndefined();
  });
});

describe("loadDashboardScreenState postpartum cycle-return offer", () => {

  it("threads a day-log cycle start after the birth, read via listDayLogRecordsInRange, into the offer's visibility", async () => {
    const now = new Date(2026, 5, 20);
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest
        .fn()
        .mockResolvedValue(createPostpartumRecord({ startedAt: "2026-06-01" })),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        {
          ...createEmptyDayLogRecord("2026-06-15"),
          isPeriod: true,
          cycleStart: true,
        },
      ]),
    });

    const state = await loadDashboardScreenState(storage, now, "en", {}, {
    });

    expect(state.viewData.mode).toBe("postpartum");
    expect(state.viewData.postpartumDashboard?.cycleReturnOffer.visible).toBe(
      true,
    );
  });

  it("keeps the offer hidden when no day-log cycle start exists after the birth", async () => {
    const now = new Date(2026, 5, 20);
    const storage = createLocalAppStorageMock({
      readActivePostpartum: jest
        .fn()
        .mockResolvedValue(createPostpartumRecord({ startedAt: "2026-06-01" })),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([]),
    });

    const state = await loadDashboardScreenState(storage, now, "en", {}, {
    });

    expect(state.viewData.postpartumDashboard?.cycleReturnOffer.visible).toBe(
      false,
    );
    expect(state.viewData.postpartumDashboard?.lamCard).not.toBeNull();
  });
});

describe("loadDashboardScreenState postpartum stale window", () => {
  const locale = "en";

  function storageWithPostpartum(startedAt: string) {
    return createLocalAppStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue(
        createPostpartumRecord({ startedAt }),
      ),
    });
  }

  it("falls back to cycle mode with a stale card once postpartum leaves the 26-week window", async () => {
    // Started ~30 weeks before "today": outside POSTPARTUM_TRACKABLE_WEEKS_MAX.
    const state = await loadDashboardScreenState(
      storageWithPostpartum("2026-01-01"),
      parseLocalDate("2026-08-01")!,
      locale,
    );

    expect(state.viewData.mode).toBe("cycle");
    expect(state.viewData.postpartumStaleCard).toBeDefined();
    expect(state.viewData.postpartumDashboard).toBeUndefined();
  });

  it("falls back to plain cycle mode for a degenerate future-dated postpartum record", async () => {
    // startedAt after "today" resolves no weeks-since-birth at all: neither
    // the postpartum dashboard nor the stale card renders, never a crash.
    const state = await loadDashboardScreenState(
      storageWithPostpartum("2026-12-01"),
      parseLocalDate("2026-08-01")!,
      locale,
    );

    expect(state.viewData.mode).toBe("cycle");
    expect(state.viewData.postpartumStaleCard).toBeUndefined();
    expect(state.viewData.postpartumDashboard).toBeUndefined();
  });

  it("renders the postpartum dashboard while inside the window", async () => {
    const state = await loadDashboardScreenState(
      storageWithPostpartum("2026-07-01"),
      parseLocalDate("2026-08-01")!,
      locale,
    );

    expect(state.viewData.mode).toBe("postpartum");
    expect(state.viewData.postpartumDashboard).toBeDefined();
  });
});
