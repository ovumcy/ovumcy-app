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
      todayEntry,
      historyRecords,
      buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 17)),
      new Date(2026, 2, 17),
    );

    expect(viewData.statusItems).toEqual([
      "Next period: unknown",
      "Predictions off",
    ]);
    expect(viewData.predictionExplanation).toBe(
      "Predictions are off in unpredictable cycle mode. Ovumcy shows recorded facts only.",
    );
  });

  it("mirrors web visibility rules for intimacy, BBT, and cervical mucus", () => {
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
      todayEntry,
      historyRecords,
      buildCycleHistorySummary(profile, historyRecords, new Date(2026, 2, 17)),
      new Date(2026, 2, 17),
    );

    expect(viewData.journal.description).toContain("Symptoms");
    expect(viewData.journal.description).toContain("Cervical mucus");
    expect(viewData.journal.description).toContain("BBT");
    expect(viewData.journal.description).not.toContain("Intimacy");
  });
});
