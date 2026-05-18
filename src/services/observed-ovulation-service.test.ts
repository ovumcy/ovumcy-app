import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import {
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
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07", "c"),
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
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07", "c"),
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
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07", "c"),
      ).toBeNull();
    });

    it("uses a fahrenheit threshold of 0.35 when temperatureUnit is f", () => {
      const records = [
        buildBBTRecord("2026-03-10", 97.4),
        buildBBTRecord("2026-03-11", 97.4),
        buildBBTRecord("2026-03-12", 97.5),
        buildBBTRecord("2026-03-13", 97.4),
        buildBBTRecord("2026-03-14", 97.4),
        buildBBTRecord("2026-03-15", 97.8),
        buildBBTRecord("2026-03-16", 97.85),
        buildBBTRecord("2026-03-17", 97.9),
      ];
      expect(
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07", "f"),
      ).toBe("2026-03-15");
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
        inferBBTOvulationDate(records, "2026-03-10", "2026-04-07", "c"),
      ).toBe("2026-03-15");
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
        inferObservedOvulationDate(records, "2026-03-10", "2026-04-07", "c"),
      ).toBe("2026-03-15");
    });

    it("falls back to eggwhite date when BBT signal is insufficient", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildEggWhiteRecord("2026-03-14"),
      ];
      expect(
        inferObservedOvulationDate(records, "2026-03-10", "2026-04-07", "c"),
      ).toBe("2026-03-14");
    });

    it("returns null when neither BBT nor eggwhite signals exist", () => {
      const records = [
        { ...createEmptyDayLogRecord("2026-03-13"), mood: 4 },
      ];
      expect(
        inferObservedOvulationDate(records, "2026-03-10", "2026-04-07", "c"),
      ).toBeNull();
    });
  });
});
