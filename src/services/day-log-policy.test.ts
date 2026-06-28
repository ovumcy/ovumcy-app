import { createDefaultProfileRecord } from "../models/profile";
import {
  buildDayLogVisibility,
  normalizeDayBBT,
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
        lhTest: "surge" as unknown as "none",
        pregnancyTest: "definite" as unknown as "none",
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
      lhTest: "none",
      pregnancyTest: "none",
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
        hideNotes: true,
        languageOverride: null,
        themeOverride: null,
      }),
    ).toEqual({
      showSexActivity: false,
      showBBT: true,
      showCervicalMucus: false,
      showLHTest: false,
      showNotes: false,
      showCycleFactors: true,
    });
  });

  it("hides cycle factors only when the owner disables them", () => {
    expect(
      buildDayLogVisibility(createDefaultProfileRecord()).showCycleFactors,
    ).toBe(true);
    expect(
      buildDayLogVisibility({
        ...createDefaultProfileRecord(),
        hideCycleFactors: true,
      }).showCycleFactors,
    ).toBe(false);
  });
});

describe("normalizeDayBBT", () => {
  it("accepts canonical Celsius temperatures", () => {
    expect(normalizeDayBBT(36.5)).toBe(36.5);
    expect(normalizeDayBBT(34)).toBe(34);
    expect(normalizeDayBBT(43)).toBe(43);
  });

  it("rejects values outside the Celsius range (BBT is stored canonically in °C)", () => {
    expect(normalizeDayBBT(33.99)).toBe(0);
    expect(normalizeDayBBT(43.01)).toBe(0);
    expect(normalizeDayBBT(97.7)).toBe(0);
    expect(normalizeDayBBT(0)).toBe(0);
    expect(normalizeDayBBT(Number.NaN)).toBe(0);
  });
});
