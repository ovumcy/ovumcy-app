import { createEmptyDayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import { buildStatsViewData } from "./stats-view-service";

function createProfileRecord(
  overrides?: Partial<ProfileRecord>,
): ProfileRecord {
  return {
    lastPeriodStart: "2026-01-17",
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
    ...overrides,
  };
}

function createPeriodRecord(
  date: string,
  overrides?: Partial<ReturnType<typeof createEmptyDayLogRecord>>,
) {
  return {
    ...createEmptyDayLogRecord(date),
    isPeriod: true,
    ...overrides,
  };
}

describe("buildStatsViewData", () => {
  it("keeps stats in the empty state until two completed cycles exist", () => {
    const viewData = buildStatsViewData(
      createProfileRecord(),
      [],
      new Date(2026, 2, 17),
    );

    expect(viewData.hasInsights).toBe(false);
    expect(viewData.emptyState?.title).toBe("Keep logging to unlock insights");
    expect(viewData.emptyState?.progressLabel).toBe("Completed cycles: 0 / 2");
  });

  it("shows reliability and cycle overview after two completed cycles", () => {
    const viewData = buildStatsViewData(
      createProfileRecord(),
      [
        createPeriodRecord("2026-02-14"),
        createPeriodRecord("2026-02-15"),
        createPeriodRecord("2026-03-14"),
        createPeriodRecord("2026-03-15"),
      ],
      new Date(2026, 2, 17),
    );

    expect(viewData.hasInsights).toBe(true);
    expect(viewData.topCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Prediction reliability",
          value: "Early estimate",
        }),
      ]),
    );
    expect(viewData.cycleOverview?.rangeValue).toBe("Your cycles: 28 to 28 days");
  });

  it("switches to facts-only copy when unpredictable mode is enabled", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        unpredictableCycle: true,
      }),
      [
        createPeriodRecord("2026-02-14"),
        createPeriodRecord("2026-03-14"),
      ],
      new Date(2026, 2, 17),
    );

    expect(viewData.topCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Facts only",
          value: "Predictions off",
        }),
      ]),
    );
    expect(
      viewData.topCards.find((card) => card.title === "Prediction reliability"),
    ).toBeUndefined();
  });

  it("shows factor context when irregular mode and factor logs are present", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        irregularCycle: true,
        ageGroup: "age_35_plus",
      }),
      [
        createPeriodRecord("2026-02-08", {
          cycleFactorKeys: ["stress"],
        }),
        createPeriodRecord("2026-03-15", {
          cycleFactorKeys: ["stress", "travel"],
        }),
        {
          ...createEmptyDayLogRecord("2026-03-16"),
          cycleFactorKeys: ["travel"],
        },
      ],
      new Date(2026, 2, 17),
    );

    expect(viewData.factorContext?.recentFactors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "stress" }),
        expect.objectContaining({ key: "travel" }),
      ]),
    );
    expect(viewData.notices).toContain("After 35, cycle variability naturally increases.");
  });
});
