import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import {
  detectSustainedThermalShift,
  inferBBTOvulationDate,
  inferEggWhiteOvulationDate,
  inferObservedOvulationDate,
} from "./observed-ovulation-service";

function buildBBTRecord(date: string, bbt: number): DayLogRecord {
  return { ...createEmptyDayLogRecord(date), bbt };
}

function buildEggWhiteRecord(date: string): DayLogRecord {
  return { ...createEmptyDayLogRecord(date), cervicalMucus: "eggwhite" };
}

describe("observed-ovulation-service", () => {
  describe("inferBBTOvulationDate", () => {
    it("returns null when fewer than 5 BBT points are recorded in the cycle", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildBBTRecord("2026-03-12", 36.4),
        buildBBTRecord("2026-03-13", 36.5),
      ];
      expect(
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBeNull();
    });

    it("returns the first day of a 3-day sustained shift above baseline + 0.2 celsius", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildBBTRecord("2026-03-12", 36.5),
        buildBBTRecord("2026-03-13", 36.4),
        buildBBTRecord("2026-03-14", 36.4),
        buildBBTRecord("2026-03-15", 36.7),
        buildBBTRecord("2026-03-16", 36.7),
        buildBBTRecord("2026-03-17", 36.8),
      ];
      expect(
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBe("2026-03-15");
    });

    it("returns null when no sustained shift is observed (anovulatory pattern)", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildBBTRecord("2026-03-12", 36.4),
        buildBBTRecord("2026-03-13", 36.4),
        buildBBTRecord("2026-03-14", 36.4),
        buildBBTRecord("2026-03-15", 36.5),
        buildBBTRecord("2026-03-16", 36.4),
        buildBBTRecord("2026-03-17", 36.5),
      ];
      expect(
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBeNull();
    });

    it("ignores BBT records outside the cycle range", () => {
      const records = [
        buildBBTRecord("2026-02-28", 36.4),
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildBBTRecord("2026-03-12", 36.4),
        buildBBTRecord("2026-03-13", 36.4),
        buildBBTRecord("2026-03-14", 36.4),
        buildBBTRecord("2026-03-15", 36.7),
        buildBBTRecord("2026-03-16", 36.7),
        buildBBTRecord("2026-03-17", 36.8),
        buildBBTRecord("2026-04-10", 36.4),
      ];
      expect(
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBe("2026-03-15");
    });

    it("returns null when BBT is already elevated within the first 5 days (non-rolling baseline limitation)", () => {
      // The shift happened on or before the first logged day, so the elevated
      // plateau is absorbed into the fixed first-5-day baseline. The baseline
      // (36.70) + 0.2 threshold (36.90) is never exceeded by the same plateau,
      // so no shift is detected. This documents the known non-rolling-baseline
      // limitation of the canonical detector.
      const records = [
        buildBBTRecord("2026-03-10", 36.7),
        buildBBTRecord("2026-03-11", 36.7),
        buildBBTRecord("2026-03-12", 36.7),
        buildBBTRecord("2026-03-13", 36.7),
        buildBBTRecord("2026-03-14", 36.7),
        buildBBTRecord("2026-03-15", 36.7),
        buildBBTRecord("2026-03-16", 36.7),
        buildBBTRecord("2026-03-17", 36.7),
      ];
      expect(
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBeNull();
    });
  });

  describe("detectSustainedThermalShift", () => {
    it("returns the shift start day, rise over the first-5-day baseline, and sample count", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildBBTRecord("2026-03-12", 36.5),
        buildBBTRecord("2026-03-13", 36.4),
        buildBBTRecord("2026-03-14", 36.4),
        buildBBTRecord("2026-03-15", 36.7),
        buildBBTRecord("2026-03-16", 36.7),
        buildBBTRecord("2026-03-17", 36.8),
      ];
      const shift = detectSustainedThermalShift(
        records,
        "2026-03-10",
        "2026-04-07",
      );
      // baseline = mean(36.4,36.4,36.5,36.4,36.4) = 36.42; threshold 36.62.
      // streak 03-15..03-17 (36.7,36.7,36.8) -> shift start 03-15.
      // rise = mean(36.7,36.7,36.8) - 36.42 = 36.733... - 36.42 = 0.313...
      expect(shift?.shiftStartDate).toBe("2026-03-15");
      expect(shift?.sampleCount).toBe(8);
      expect(shift?.rise).toBeCloseTo(0.3133, 3);
    });

    it("agrees with inferBBTOvulationDate on the shift day", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildBBTRecord("2026-03-12", 36.4),
        buildBBTRecord("2026-03-13", 36.4),
        buildBBTRecord("2026-03-14", 36.4),
        buildBBTRecord("2026-03-15", 36.7),
        buildBBTRecord("2026-03-16", 36.7),
        buildBBTRecord("2026-03-17", 36.8),
      ];
      const shift = detectSustainedThermalShift(
        records,
        "2026-03-10",
        "2026-04-07",
      );
      expect(shift?.shiftStartDate).toBe(
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07"),
      );
    });

    it("supports an open-ended (current, in-progress) cycle when no end date is given", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildBBTRecord("2026-03-12", 36.4),
        buildBBTRecord("2026-03-13", 36.4),
        buildBBTRecord("2026-03-14", 36.4),
        buildBBTRecord("2026-03-15", 36.7),
        buildBBTRecord("2026-03-16", 36.7),
        buildBBTRecord("2026-03-17", 36.8),
      ];
      expect(
        detectSustainedThermalShift(records, "2026-03-10")?.shiftStartDate,
      ).toBe("2026-03-15");
    });

    it("returns null below the canonical 5-reading minimum", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildBBTRecord("2026-03-12", 36.7),
        buildBBTRecord("2026-03-13", 36.7),
      ];
      expect(
        detectSustainedThermalShift(records, "2026-03-10", "2026-04-07"),
      ).toBeNull();
    });
  });

  describe("inferEggWhiteOvulationDate", () => {
    it("returns null when no eggwhite mucus is recorded in the cycle", () => {
      const records = [
        { ...createEmptyDayLogRecord("2026-03-13"), cervicalMucus: "creamy" as const },
      ];
      expect(
        inferEggWhiteOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBeNull();
    });

    it("returns the last eggwhite mucus date in the cycle range", () => {
      const records = [
        buildEggWhiteRecord("2026-03-12"),
        buildEggWhiteRecord("2026-03-14"),
        buildEggWhiteRecord("2026-03-15"),
      ];
      expect(
        inferEggWhiteOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBe("2026-03-15");
    });

    it("ignores eggwhite records outside the cycle range", () => {
      const records = [
        buildEggWhiteRecord("2026-02-28"),
        buildEggWhiteRecord("2026-03-15"),
        buildEggWhiteRecord("2026-04-10"),
      ];
      expect(
        inferEggWhiteOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBe("2026-03-15");
    });
  });

  describe("inferObservedOvulationDate", () => {
    it("prefers BBT-derived date over eggwhite date when both are present", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildBBTRecord("2026-03-12", 36.4),
        buildBBTRecord("2026-03-13", 36.4),
        buildBBTRecord("2026-03-14", 36.4),
        buildBBTRecord("2026-03-15", 36.7),
        buildBBTRecord("2026-03-16", 36.7),
        buildBBTRecord("2026-03-17", 36.8),
        buildEggWhiteRecord("2026-03-13"),
      ];
      expect(
        inferObservedOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBe("2026-03-15");
    });

    it("falls back to eggwhite date when BBT signal is insufficient", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildEggWhiteRecord("2026-03-14"),
      ];
      expect(
        inferObservedOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBe("2026-03-14");
    });

    it("returns null when neither BBT nor eggwhite signals exist", () => {
      const records = [
        { ...createEmptyDayLogRecord("2026-03-13"), mood: 4 },
      ];
      expect(
        inferObservedOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBeNull();
    });
  });
});
