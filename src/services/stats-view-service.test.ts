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
    expect(viewData.emptyState?.progressLabel).toBe("Cycle 0 of 2 completed");
    expect(viewData.emptyState?.lockedSections).toContain("Cycle length");
    expect(viewData.emptyState?.action).toEqual({
      kind: "open_logging",
      label: "Log today to speed this up",
    });
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

  it("adds a mucus-based fertility insight when egg-white mucus is logged in the current cycle", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        trackCervicalMucus: true,
      }),
      [
        createPeriodRecord("2026-01-17"),
        createPeriodRecord("2026-02-14"),
        createPeriodRecord("2026-03-14"),
        {
          ...createEmptyDayLogRecord("2026-03-16"),
          cervicalMucus: "eggwhite",
        },
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
    );

    expect(viewData.topCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "High fertility",
          value: "Mucus signal",
          description: "Egg-white mucus was logged on Mar 16.",
        }),
      ]),
    );
    expect(viewData.topCards).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "current-phase",
        }),
      ]),
    );
    expect(viewData.topCards.length).toBeLessThanOrEqual(4);
  });

  it("localizes built-in symptom labels in insight sections", () => {
    const viewData = buildStatsViewData(
      createProfileRecord(),
      [
        createPeriodRecord("2026-01-17"),
        {
          ...createEmptyDayLogRecord("2026-01-18"),
          symptomIDs: ["cramps"],
        },
        createPeriodRecord("2026-02-14"),
        {
          ...createEmptyDayLogRecord("2026-02-15"),
          symptomIDs: ["cramps"],
        },
        createPeriodRecord("2026-03-14"),
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
      "ru",
    );

    expect(viewData.symptomFrequency?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps", label: "Спазмы" }),
      ]),
    );
    expect(viewData.lastCycleSymptoms?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps", label: "Спазмы" }),
      ]),
    );
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

  it("adds advanced insights when the managed premium entitlement is active", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        trackBBT: true,
        trackCervicalMucus: true,
      }),
      [
        createPeriodRecord("2025-10-01"),
        {
          ...createEmptyDayLogRecord("2025-10-14"),
          cervicalMucus: "eggwhite",
        },
        {
          ...createEmptyDayLogRecord("2025-10-11"),
          symptomIDs: ["headache"],
        },
        createPeriodRecord("2025-10-29"),
        {
          ...createEmptyDayLogRecord("2025-11-12"),
          cervicalMucus: "eggwhite",
        },
        {
          ...createEmptyDayLogRecord("2025-11-08"),
          symptomIDs: ["headache"],
        },
        createPeriodRecord("2025-11-26"),
        {
          ...createEmptyDayLogRecord("2025-12-10"),
          cervicalMucus: "eggwhite",
        },
        {
          ...createEmptyDayLogRecord("2025-12-06"),
          symptomIDs: ["headache"],
        },
        createPeriodRecord("2025-12-24"),
        {
          ...createEmptyDayLogRecord("2026-01-08"),
          cervicalMucus: "eggwhite",
        },
        createPeriodRecord("2026-01-21"),
        {
          ...createEmptyDayLogRecord("2026-02-04"),
          cervicalMucus: "eggwhite",
        },
        createPeriodRecord("2026-02-18"),
        {
          ...createEmptyDayLogRecord("2026-03-12"),
          cervicalMucus: "eggwhite",
        },
        createPeriodRecord("2026-03-28"),
        {
          ...createEmptyDayLogRecord("2026-03-29"),
          bbt: 36.3,
        },
        {
          ...createEmptyDayLogRecord("2026-03-30"),
          bbt: 36.32,
        },
        {
          ...createEmptyDayLogRecord("2026-03-31"),
          bbt: 36.34,
        },
        {
          ...createEmptyDayLogRecord("2026-04-01"),
          bbt: 36.57,
        },
        {
          ...createEmptyDayLogRecord("2026-04-02"),
          bbt: 36.6,
        },
        {
          ...createEmptyDayLogRecord("2026-04-03"),
          bbt: 36.63,
        },
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 3, 4),
      "en",
      {
        advancedFertility: true,
        advancedInsights: true,
        doctorPDF: false,
        extendedReports: true,
        partnerAccess: false,
      },
    );

    expect(viewData.advancedInsights?.title).toBe("Advanced insights");
    expect(viewData.advancedInsights?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "weighted-average",
          title: "Weighted average",
        }),
        expect.objectContaining({
          key: "pattern-drift",
          title: "Pattern drift",
        }),
        expect.objectContaining({
          key: "anomalous-cycle",
          title: "Anomalous cycle",
        }),
        expect.objectContaining({
          key: "seasonal-pattern",
          title: "Seasonal pattern",
          value: "Winter",
        }),
      ]),
    );
    expect(viewData.advancedFertility?.title).toBe("Advanced fertility");
    expect(viewData.advancedFertility?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "observed-luteal",
          title: "Observed luteal phase",
        }),
        expect.objectContaining({
          key: "signal-coverage",
          title: "Signal coverage",
        }),
        expect.objectContaining({
          key: "luteal-consistency",
          title: "Luteal consistency",
        }),
        expect.objectContaining({
          key: "thermal-shift",
          title: "Thermal shift",
        }),
      ]),
    );
    expect(viewData.personalForecasts?.title).toBe("Personal forecasts");
    expect(viewData.personalForecasts?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Headache",
          value: "In 3 days",
        }),
      ]),
    );
    expect(viewData.extendedReports?.title).toBe("Extended reports");
    expect(viewData.extendedReports?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cycleLengthLabel: expect.stringContaining("Cycle"),
          periodLengthLabel: expect.stringContaining("Period"),
        }),
      ]),
    );
  });
});
