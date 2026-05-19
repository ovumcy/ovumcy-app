import type { DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import { buildCycleHistorySummary } from "./cycle-history-service";
import { buildDashboardViewData } from "./dashboard-view-service";

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

  it("falls back to unknown dates when the prior prediction window is stale", () => {
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
        value: "Unknown",
        detail: "Waiting for next cycle",
        phaseCards: [],
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
        currentTone: "period",
        phaseCards: [
          expect.objectContaining({ key: "period", rangeLabel: "Days 1-5", active: true }),
          expect.objectContaining({ key: "follicular", rangeLabel: "Days 6-13", active: false }),
          expect.objectContaining({ key: "ovulation", rangeLabel: "Day 14", active: false }),
          expect.objectContaining({ key: "luteal", rangeLabel: "Days 15-28", active: false }),
        ],
      }),
    );
  });
});
