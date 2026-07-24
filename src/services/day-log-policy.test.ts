import {
  createEmptyDayLogRecord,
  hasDayLogData,
  type DayLogRecord,
} from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import {
  buildDayLogVisibility,
  normalizeDayBBT,
  normalizeDayBpDiastolic,
  normalizeDayBpSystolic,
  normalizeDayWeightKg,
  sanitizeDayLogRecord,
} from "./day-log-policy";

describe("day-log-policy", () => {
  it("normalizes day log values to the canonical web-compatible enums", () => {
    const sanitized = sanitizeDayLogRecord({
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
      weightKg: 9999,
      bpSystolic: 5,
      bpDiastolic: 999,
    });

    expect(sanitized).toEqual({
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
    // toEqual alone can't distinguish "key absent" from "key present with an
    // undefined value" — pregnancy metrics must be truly absent, not a
    // 0-sentinel and not an undefined-valued key, so a legacy/pre-feature
    // row round-trips identically to a fresh one.
    expect(sanitized).not.toHaveProperty("weightKg");
    expect(sanitized).not.toHaveProperty("bpSystolic");
    expect(sanitized).not.toHaveProperty("bpDiastolic");
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
      showPregnancyMetrics: false,
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

  it("shows pregnancy metrics only when explicitly opted in via options", () => {
    expect(
      buildDayLogVisibility(createDefaultProfileRecord()).showPregnancyMetrics,
    ).toBe(false);
    expect(
      buildDayLogVisibility(createDefaultProfileRecord(), {
        showPregnancyMetrics: true,
      }).showPregnancyMetrics,
    ).toBe(true);
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

describe("normalizeDayWeightKg", () => {
  it("accepts weights within the 30–250 kg range, rounded to 2 decimals", () => {
    expect(normalizeDayWeightKg(30)).toBe(30);
    expect(normalizeDayWeightKg(250)).toBe(250);
    expect(normalizeDayWeightKg(65.436)).toBe(65.44);
  });

  it("drops out-of-range, non-finite, or absent values to undefined", () => {
    expect(normalizeDayWeightKg(29.99)).toBeUndefined();
    expect(normalizeDayWeightKg(250.01)).toBeUndefined();
    expect(normalizeDayWeightKg(0)).toBeUndefined();
    expect(normalizeDayWeightKg(Number.NaN)).toBeUndefined();
    expect(normalizeDayWeightKg(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(normalizeDayWeightKg(undefined)).toBeUndefined();
  });
});

describe("normalizeDayBpSystolic", () => {
  it("accepts systolic readings within the 60–250 mmHg range, rounded to a whole number", () => {
    expect(normalizeDayBpSystolic(60)).toBe(60);
    expect(normalizeDayBpSystolic(250)).toBe(250);
    expect(normalizeDayBpSystolic(120.4)).toBe(120);
  });

  it("drops out-of-range, non-finite, or absent values to undefined", () => {
    expect(normalizeDayBpSystolic(59.49)).toBeUndefined();
    expect(normalizeDayBpSystolic(250.5)).toBeUndefined();
    expect(normalizeDayBpSystolic(0)).toBeUndefined();
    expect(normalizeDayBpSystolic(Number.NaN)).toBeUndefined();
    expect(normalizeDayBpSystolic(undefined)).toBeUndefined();
  });
});

describe("normalizeDayBpDiastolic", () => {
  it("accepts diastolic readings within the 40–150 mmHg range, rounded to a whole number", () => {
    expect(normalizeDayBpDiastolic(40)).toBe(40);
    expect(normalizeDayBpDiastolic(150)).toBe(150);
    expect(normalizeDayBpDiastolic(80.6)).toBe(81);
  });

  it("drops out-of-range, non-finite, or absent values to undefined", () => {
    expect(normalizeDayBpDiastolic(39.49)).toBeUndefined();
    expect(normalizeDayBpDiastolic(150.5)).toBeUndefined();
    expect(normalizeDayBpDiastolic(0)).toBeUndefined();
    expect(normalizeDayBpDiastolic(Number.NaN)).toBeUndefined();
    expect(normalizeDayBpDiastolic(undefined)).toBeUndefined();
  });
});

describe("sanitizeDayLogRecord pregnancy metrics", () => {
  function buildRecord(overrides: Partial<DayLogRecord> = {}): DayLogRecord {
    return {
      ...createEmptyDayLogRecord("2026-03-17"),
      ...overrides,
    };
  }

  it("keeps valid weight and blood pressure readings at their canonical precision", () => {
    const sanitized = sanitizeDayLogRecord(
      buildRecord({ weightKg: 65.436, bpSystolic: 118.6, bpDiastolic: 76.2 }),
    );

    expect(sanitized.weightKg).toBe(65.44);
    expect(sanitized.bpSystolic).toBe(119);
    expect(sanitized.bpDiastolic).toBe(76);
  });

  it("stores a lone blood pressure reading without inventing or dropping its pair", () => {
    const diastolicOnly = sanitizeDayLogRecord(
      buildRecord({ bpDiastolic: 82 }),
    );
    expect(diastolicOnly.bpDiastolic).toBe(82);
    expect(diastolicOnly).not.toHaveProperty("bpSystolic");

    const systolicOnly = sanitizeDayLogRecord(
      buildRecord({ bpSystolic: 130 }),
    );
    expect(systolicOnly.bpSystolic).toBe(130);
    expect(systolicOnly).not.toHaveProperty("bpDiastolic");
  });

  it("leaves pregnancy metrics absent when the input never set them", () => {
    const sanitized = sanitizeDayLogRecord(buildRecord());

    expect(sanitized).not.toHaveProperty("weightKg");
    expect(sanitized).not.toHaveProperty("bpSystolic");
    expect(sanitized).not.toHaveProperty("bpDiastolic");
  });

  it("drops an out-of-range reading instead of leaking the raw value through", () => {
    const sanitized = sanitizeDayLogRecord(
      buildRecord({ weightKg: 1000, bpSystolic: 400, bpDiastolic: 5 }),
    );

    expect(sanitized).not.toHaveProperty("weightKg");
    expect(sanitized).not.toHaveProperty("bpSystolic");
    expect(sanitized).not.toHaveProperty("bpDiastolic");
  });
});

describe("day-log model pregnancy metrics", () => {
  it("createEmptyDayLogRecord leaves pregnancy metrics absent, not a 0-sentinel", () => {
    const record = createEmptyDayLogRecord("2026-03-17");

    expect(record).not.toHaveProperty("weightKg");
    expect(record).not.toHaveProperty("bpSystolic");
    expect(record).not.toHaveProperty("bpDiastolic");
    expect(hasDayLogData(record)).toBe(false);
  });

  it("hasDayLogData counts a defined, positive pregnancy metric as data", () => {
    const empty = createEmptyDayLogRecord("2026-03-17");

    expect(hasDayLogData({ ...empty, weightKg: 65 })).toBe(true);
    expect(hasDayLogData({ ...empty, bpSystolic: 120 })).toBe(true);
    expect(hasDayLogData({ ...empty, bpDiastolic: 80 })).toBe(true);
  });

  it("hasDayLogData ignores a zero-valued pregnancy metric", () => {
    const empty = createEmptyDayLogRecord("2026-03-17");

    expect(hasDayLogData({ ...empty, weightKg: 0 })).toBe(false);
    expect(hasDayLogData({ ...empty, bpSystolic: 0 })).toBe(false);
    expect(hasDayLogData({ ...empty, bpDiastolic: 0 })).toBe(false);
  });
});
