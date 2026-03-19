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

    expect(viewData.phaseStatus).toEqual({
      icon: "◌",
      label: "Unknown",
    });
    expect(viewData.statusItems).toEqual([
      "Next period: unknown",
      "Predictions off",
    ]);
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

    expect(viewData.phaseStatus).toEqual({
      icon: "🌱",
      label: "Follicular",
    });
    expect(viewData.journal).toEqual({
      title: "Today journal",
      dateLabel: "March 17, 2026",
    });
  });

  it("does not duplicate irregular-cycle reliability hints", () => {
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

    expect(viewData.statusItems).toContain("3 cycles are needed for a reliable range");
    expect(viewData.predictionExplanation).toBe("");
  });
});
