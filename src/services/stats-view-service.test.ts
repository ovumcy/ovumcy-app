import { createEmptyDayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
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
    languageOverride: null,
    themeOverride: null,
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
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
    );

    expect(viewData.hasInsights).toBe(false);
    expect(viewData.emptyState?.title).toBe("Keep logging to unlock insights");
    expect(viewData.emptyState?.progressLabel).toBe("Completed cycles: 0 / 2");
  });

  it("builds trend, symptom, phase, and bbt insight sections after local history unlocks stats", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        trackBBT: true,
      }),
      [
        createPeriodRecord("2026-01-17"),
        {
          ...createEmptyDayLogRecord("2026-01-18"),
          flow: "medium",
          mood: 2,
          symptomIDs: ["cramps"],
        },
        createPeriodRecord("2026-02-14"),
        {
          ...createEmptyDayLogRecord("2026-02-15"),
          flow: "light",
          mood: 4,
          symptomIDs: ["cramps"],
        },
        createPeriodRecord("2026-03-14"),
        {
          ...createEmptyDayLogRecord("2026-03-15"),
          bbt: 36.45,
        },
        {
          ...createEmptyDayLogRecord("2026-03-16"),
          bbt: 36.62,
          symptomIDs: ["headache"],
        },
      ],
      createDefaultSymptomRecords(),
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
    expect(viewData.trendChart?.title).toBe("Cycle trend");
    expect(viewData.trendChart?.points).toHaveLength(2);
    expect(viewData.symptomFrequency?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps" }),
      ]),
    );
    expect(viewData.lastCycleSymptoms?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps" }),
      ]),
    );
    expect(viewData.symptomPatterns?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps" }),
      ]),
    );
    expect(viewData.phaseMoodInsights?.items.some((item) => item.hasData)).toBe(true);
    expect(viewData.phaseSymptomInsights?.items.some((item) => item.hasData)).toBe(
      true,
    );
    expect(viewData.bbtTrend?.points).toHaveLength(2);
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
      createDefaultSymptomRecords(),
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
    expect(viewData.predictionExplanation).toBe(
      "Predictions are off in unpredictable cycle mode. Ovumcy shows recorded facts only.",
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
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
    );

    expect(viewData.factorContext?.recentFactors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "stress" }),
        expect.objectContaining({ key: "travel" }),
      ]),
    );
    expect(viewData.notices).toContain(
      "After 35, cycle variability naturally increases.",
    );
  });
});
