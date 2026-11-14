import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import * as cycleHistory from "./cycle-history-service";
import { buildLocalReminderPlans } from "./local-reminder-plan-service";
import { buildStatsViewData } from "./stats-view-service";

// The overdue gate is read from the projection's cycleDayLooksLong flag. The
// wrapper below can force that flag on an otherwise real projection, so each
// surface is shown to obey the flag itself rather than the arithmetic that
// happens to coincide with today's gate length.
let mockForceOverdueGate = false;

jest.mock("./cycle-history-service", () => {
  const actual = jest.requireActual("./cycle-history-service");
  return {
    ...actual,
    buildCurrentCycleProjection: (
      ...args: Parameters<typeof actual.buildCurrentCycleProjection>
    ) => {
      const projection = actual.buildCurrentCycleProjection(...args);
      return mockForceOverdueGate
        ? { ...projection, cycleDayLooksLong: true }
        : projection;
    },
  };
});

afterEach(() => {
  mockForceOverdueGate = false;
});

function predictionKinds(profile: ProfileRecord, records: DayLogRecord[], now: Date) {
  return buildLocalReminderPlans(profile, records, now, "en").map((plan) => plan.kind);
}

describe("overdue gate on reminders", () => {
  const profile: ProfileRecord = {
    ...createDefaultProfileRecord(),
    dailyLogReminderEnabled: true,
    upcomingPeriodReminderEnabled: true,
    fertileWindowReminderEnabled: true,
    cycleLength: 28,
    reminderTime: "20:00",
  };
  const records: DayLogRecord[] = [
    { ...createEmptyDayLogRecord("2026-03-05"), isPeriod: true, cycleStart: true },
  ];

  it("plans period and fertile reminders when the gate flag is clear and none when it holds", () => {
    const now = new Date(2026, 2, 12, 10, 0, 0, 0);
    expect(predictionKinds(profile, records, now)).toEqual([
      "daily_log",
      "upcoming_period",
      "fertile_window",
    ]);

    mockForceOverdueGate = true;
    expect(predictionKinds(profile, records, now)).toEqual(["daily_log"]);
  });

  it.each([
    ["just before the gate (day 34)", new Date(2026, 3, 7, 10), false],
    ["at the gate (day 35)", new Date(2026, 3, 8, 10), false],
    ["past the gate (day 36)", new Date(2026, 3, 9, 10), true],
  ])("reads the real projection %s", (_label, now, gated) => {
    const history = cycleHistory.buildCycleHistorySummary(profile, records, now);
    const projection = cycleHistory.buildCurrentCycleProjection(
      profile,
      history,
      records,
      now,
    );
    expect(projection.cycleDayLooksLong).toBe(gated);
    // Between length and the gate the predicted window already lies behind
    // today, so no prediction reminder is due on either side of the gate; the
    // flag-forced case above is what shows the gate itself silences them.
    expect(predictionKinds(profile, records, now)).toEqual(["daily_log"]);
  });
});

describe("overdue gate on stats", () => {
  const profile: ProfileRecord = {
    ...createDefaultProfileRecord(),
    lastPeriodStart: "2025-12-20",
    cycleLength: 28,
    periodLength: 5,
    trackBBT: true,
    trackCervicalMucus: true,
  };
  const period = (date: string): DayLogRecord => ({
    ...createEmptyDayLogRecord(date),
    isPeriod: true,
    cycleStart: true,
  });
  const records: DayLogRecord[] = [
    period("2025-12-20"),
    { ...createEmptyDayLogRecord("2025-12-29"), symptomIDs: ["headache"] },
    period("2026-01-17"),
    { ...createEmptyDayLogRecord("2026-01-26"), symptomIDs: ["headache"] },
    period("2026-02-14"),
    { ...createEmptyDayLogRecord("2026-02-23"), symptomIDs: ["headache"] },
    period("2026-03-14"),
    { ...createEmptyDayLogRecord("2026-03-15"), bbt: 36.4 },
    {
      ...createEmptyDayLogRecord("2026-03-16"),
      bbt: 36.45,
      cervicalMucus: "eggwhite",
    },
  ];
  const now = new Date(2026, 2, 16);
  const premiumFeatures = {
    advancedFertility: true,
    advancedInsights: true,
    doctorPDF: false,
    extendedReports: false,
    partnerAccess: false,
    reminders: false,
  };
  const build = () =>
    buildStatsViewData(
      profile,
      records,
      createDefaultSymptomRecords(),
      now,
      "en",
      premiumFeatures,
    );

  it("withholds personal forecasts past the gate and keeps recorded history and observations", () => {
    const open = build();
    expect(open.personalForecasts?.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "headache" })]),
    );

    mockForceOverdueGate = true;
    const gated = build();
    expect(gated.personalForecasts).toBeUndefined();
    expect(gated.cycleOverview).toEqual(open.cycleOverview);
    expect(gated.bbtTrend).toEqual(open.bbtTrend);
    expect(gated.topCards.map((card) => card.key)).toEqual(
      open.topCards.map((card) => card.key),
    );
  });
});
