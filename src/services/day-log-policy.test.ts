import {
  buildDayLogVisibility,
  sanitizeDayLogRecord,
} from "./day-log-policy";

describe("day-log-policy", () => {
  it("normalizes day log values to the canonical web-compatible enums", () => {
    expect(
      sanitizeDayLogRecord({
        date: "2026-03-17",
        isPeriod: false,
        cycleStart: true,
        isUncertain: true,
        flow: "heavy",
        mood: 9,
        sexActivity: "invalid" as unknown as "none",
        bbt: 47,
        cervicalMucus: "wet" as unknown as "none",
        cycleFactorKeys: [
          "travel",
          "travel",
          "unknown" as unknown as "stress",
        ],
        symptomIDs: [
          "cramps",
          "unknown" as unknown as "cramps",
          "bloating",
        ],
        notes: `  ${"a".repeat(2105)}  `,
      }),
    ).toEqual({
      date: "2026-03-17",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none",
      mood: 5,
      sexActivity: "none",
      bbt: 0,
      cervicalMucus: "none",
      cycleFactorKeys: ["travel"],
      symptomIDs: ["cramps", "unknown", "bloating"],
      notes: "a".repeat(2000),
    });
  });

  it("keeps settings-driven visibility aligned with the canonical profile contract", () => {
    expect(
      buildDayLogVisibility({
        lastPeriodStart: "2026-03-10",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: true,
        temperatureUnit: "f",
        trackCervicalMucus: false,
        hideSexChip: true,
      }),
    ).toEqual({
      showSexActivity: false,
      showBBT: true,
      showCervicalMucus: false,
    });
  });
});
