import {
  createEmptyDayLogRecord,
  type DayCycleFactorKey,
  type DayLogRecord,
} from "../models/day-log";
import {
  detectSustainedThermalShift,
  inferBBTOvulationDate,
  inferEggWhiteOvulationDate,
  inferObservedOvulationDate,
} from "./observed-ovulation-service";

function buildBBTRecord(
  date: string,
  bbt: number,
  cycleFactorKeys: DayCycleFactorKey[] = [],
): DayLogRecord {
  return { ...createEmptyDayLogRecord(date), bbt, cycleFactorKeys };
}

function buildEggWhiteRecord(date: string): DayLogRecord {
  return { ...createEmptyDayLogRecord(date), cervicalMucus: "eggwhite" };
}

// Canonical "3-over-6" series ported from ovumcy-web cycle_signals.go: six
// undisturbed coverline days (max 36.40) then a 3-day elevated streak
// 03-07..03-09 clearing the coverline and the +0.2 third-day margin. First
// elevated day 03-07; ovulation is the day before (03-06).
function buildGoldenShiftRecords(): DayLogRecord[] {
  return [
    buildBBTRecord("2026-03-01", 36.3),
    buildBBTRecord("2026-03-02", 36.35),
    buildBBTRecord("2026-03-03", 36.3),
    buildBBTRecord("2026-03-04", 36.4),
    buildBBTRecord("2026-03-05", 36.3),
    buildBBTRecord("2026-03-06", 36.35),
    buildBBTRecord("2026-03-07", 36.6),
    buildBBTRecord("2026-03-08", 36.65),
    buildBBTRecord("2026-03-09", 36.7),
  ];
}

describe("observed-ovulation-service", () => {
  describe("detectSustainedThermalShift (3-over-6)", () => {
    it("returns the first elevated day, the MAX coverline, rise over it, and sample count", () => {
      const shift = detectSustainedThermalShift(
        buildGoldenShiftRecords(),
        "2026-03-01",
        "2026-03-29",
      );
      expect(shift?.shiftStartDate).toBe("2026-03-07");
      expect(shift?.coverline).toBeCloseTo(36.4, 5);
      // rise = mean(36.6, 36.65, 36.7) - coverline 36.4 = 36.65 - 36.4 = 0.25.
      expect(shift?.rise).toBeCloseTo(0.25, 5);
      expect(shift?.sampleCount).toBe(9);
    });

    it("uses the MAX of the 6 preceding temps as the coverline, so an early spike suppresses the shift", () => {
      // 03-03 carries a follicular-noise spike (36.70). The sliding coverline is
      // the MAX (not the mean) of the six preceding readings, so the later
      // elevated run never clears it. A mean-of-5 baseline would have fired here.
      const records = [
        buildBBTRecord("2026-03-01", 36.3),
        buildBBTRecord("2026-03-02", 36.3),
        buildBBTRecord("2026-03-03", 36.7),
        buildBBTRecord("2026-03-04", 36.3),
        buildBBTRecord("2026-03-05", 36.3),
        buildBBTRecord("2026-03-06", 36.3),
        buildBBTRecord("2026-03-07", 36.55),
        buildBBTRecord("2026-03-08", 36.6),
        buildBBTRecord("2026-03-09", 36.65),
      ];
      expect(
        detectSustainedThermalShift(records, "2026-03-01", "2026-03-29"),
      ).toBeNull();
    });

    it("requires the third elevated day to clear the coverline by the 0.2 celsius margin", () => {
      const records = [
        buildBBTRecord("2026-03-01", 36.3),
        buildBBTRecord("2026-03-02", 36.3),
        buildBBTRecord("2026-03-03", 36.3),
        buildBBTRecord("2026-03-04", 36.3),
        buildBBTRecord("2026-03-05", 36.3),
        buildBBTRecord("2026-03-06", 36.3),
        buildBBTRecord("2026-03-07", 36.45),
        buildBBTRecord("2026-03-08", 36.45),
        // Third day only 0.15 above coverline 36.30 (< 0.20 margin).
        buildBBTRecord("2026-03-09", 36.45),
      ];
      expect(
        detectSustainedThermalShift(records, "2026-03-01", "2026-03-29"),
      ).toBeNull();
    });

    it("returns null below the 9-recorded-day minimum (6 coverline + 3 streak)", () => {
      const records = [
        buildBBTRecord("2026-03-01", 36.3),
        buildBBTRecord("2026-03-02", 36.3),
        buildBBTRecord("2026-03-03", 36.3),
        buildBBTRecord("2026-03-04", 36.3),
        buildBBTRecord("2026-03-05", 36.3),
        buildBBTRecord("2026-03-06", 36.7),
        buildBBTRecord("2026-03-07", 36.7),
        buildBBTRecord("2026-03-08", 36.8),
      ];
      expect(
        detectSustainedThermalShift(records, "2026-03-01", "2026-03-29"),
      ).toBeNull();
    });

    it("requires the elevated streak on strictly consecutive calendar days", () => {
      const records = [
        buildBBTRecord("2026-03-01", 36.3),
        buildBBTRecord("2026-03-02", 36.3),
        buildBBTRecord("2026-03-03", 36.3),
        buildBBTRecord("2026-03-04", 36.3),
        buildBBTRecord("2026-03-05", 36.3),
        buildBBTRecord("2026-03-06", 36.3),
        buildBBTRecord("2026-03-07", 36.6),
        buildBBTRecord("2026-03-08", 36.65),
        // Gap on 03-09: the third elevated reading is on 03-10, not adjacent.
        buildBBTRecord("2026-03-10", 36.7),
      ];
      expect(
        detectSustainedThermalShift(records, "2026-03-01", "2026-03-29"),
      ).toBeNull();
    });

    it("supports an open-ended (current, in-progress) cycle when no end date is given", () => {
      expect(
        detectSustainedThermalShift(buildGoldenShiftRecords(), "2026-03-01")
          ?.shiftStartDate,
      ).toBe("2026-03-07");
    });

    it("keeps the latest undisturbed reading when a calendar day has duplicates", () => {
      const records = [
        ...buildGoldenShiftRecords(),
        // A second same-day reading for 03-07 must not add a duplicate point.
        buildBBTRecord("2026-03-07", 36.62),
      ];
      const shift = detectSustainedThermalShift(
        records,
        "2026-03-01",
        "2026-03-29",
      );
      expect(shift?.sampleCount).toBe(9);
      expect(shift?.shiftStartDate).toBe("2026-03-07");
    });
  });

  describe("illness / sleep_disruption exclusion", () => {
    // A fever on 03-04 (36.90) would otherwise become the coverline MAX and mask
    // the real 03-08..03-10 shift. Tagging it illness / sleep_disruption removes
    // the day from the series entirely, so the shift is detected.
    function buildMaskedShiftRecords(
      disturbanceFactor: DayCycleFactorKey | null,
    ): DayLogRecord[] {
      return [
        buildBBTRecord("2026-03-01", 36.3),
        buildBBTRecord("2026-03-02", 36.3),
        buildBBTRecord("2026-03-03", 36.3),
        buildBBTRecord(
          "2026-03-04",
          36.9,
          disturbanceFactor ? [disturbanceFactor] : [],
        ),
        buildBBTRecord("2026-03-05", 36.3),
        buildBBTRecord("2026-03-06", 36.3),
        buildBBTRecord("2026-03-07", 36.3),
        buildBBTRecord("2026-03-08", 36.55),
        buildBBTRecord("2026-03-09", 36.6),
        buildBBTRecord("2026-03-10", 36.65),
      ];
    }

    it("without exclusion the fever spike masks the shift", () => {
      expect(
        detectSustainedThermalShift(
          buildMaskedShiftRecords(null),
          "2026-03-01",
          "2026-03-29",
        ),
      ).toBeNull();
    });

    it("excludes an illness-tagged day from the coverline, revealing the shift", () => {
      const shift = detectSustainedThermalShift(
        buildMaskedShiftRecords("illness"),
        "2026-03-01",
        "2026-03-29",
      );
      expect(shift?.shiftStartDate).toBe("2026-03-08");
      expect(shift?.coverline).toBeCloseTo(36.3, 5);
      expect(shift?.sampleCount).toBe(9);
    });

    it("excludes a sleep_disruption-tagged day the same way", () => {
      expect(
        detectSustainedThermalShift(
          buildMaskedShiftRecords("sleep_disruption"),
          "2026-03-01",
          "2026-03-29",
        )?.shiftStartDate,
      ).toBe("2026-03-08");
    });
  });

  describe("inferBBTOvulationDate", () => {
    it("estimates ovulation as the day BEFORE the first elevated day", () => {
      expect(
        inferBBTOvulationDate(
          buildGoldenShiftRecords(),
          "2026-03-01",
          "2026-03-29",
        ),
      ).toBe("2026-03-06");
    });

    it("agrees with the detector: ovulation is one day before the shift start", () => {
      const shift = detectSustainedThermalShift(
        buildGoldenShiftRecords(),
        "2026-03-01",
        "2026-03-29",
      );
      // shift start 03-07 -> ovulation 03-06.
      expect(shift?.shiftStartDate).toBe("2026-03-07");
      expect(
        inferBBTOvulationDate(
          buildGoldenShiftRecords(),
          "2026-03-01",
          "2026-03-29",
        ),
      ).toBe("2026-03-06");
    });

    it("ignores BBT records outside the cycle range", () => {
      const records = [
        buildBBTRecord("2026-02-20", 36.9),
        ...buildGoldenShiftRecords(),
        buildBBTRecord("2026-04-10", 36.4),
      ];
      expect(
        inferBBTOvulationDate(records, "2026-03-01", "2026-03-29"),
      ).toBe("2026-03-06");
    });

    it("returns null when no sustained shift is observed (anovulatory pattern)", () => {
      const records = [
        buildBBTRecord("2026-03-01", 36.3),
        buildBBTRecord("2026-03-02", 36.4),
        buildBBTRecord("2026-03-03", 36.3),
        buildBBTRecord("2026-03-04", 36.4),
        buildBBTRecord("2026-03-05", 36.3),
        buildBBTRecord("2026-03-06", 36.4),
        buildBBTRecord("2026-03-07", 36.3),
        buildBBTRecord("2026-03-08", 36.4),
        buildBBTRecord("2026-03-09", 36.3),
      ];
      expect(
        inferBBTOvulationDate(records, "2026-03-01", "2026-03-29"),
      ).toBeNull();
    });
  });

  describe("inferEggWhiteOvulationDate", () => {
    it("returns null when no eggwhite mucus is recorded in the cycle", () => {
      const records = [
        {
          ...createEmptyDayLogRecord("2026-03-13"),
          cervicalMucus: "creamy" as const,
        },
      ];
      expect(
        inferEggWhiteOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBeNull();
    });

    it("estimates ovulation as the day AFTER the last eggwhite day (web peak-day rule)", () => {
      const records = [
        buildEggWhiteRecord("2026-03-12"),
        buildEggWhiteRecord("2026-03-14"),
        buildEggWhiteRecord("2026-03-15"),
      ];
      expect(
        inferEggWhiteOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBe("2026-03-16");
    });

    it("clamps to the peak day itself when the day after would reach the next cycle start", () => {
      const records = [buildEggWhiteRecord("2026-04-06")];
      expect(
        inferEggWhiteOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBe("2026-04-06");
    });

    it("ignores eggwhite records outside the cycle range", () => {
      const records = [
        buildEggWhiteRecord("2026-02-28"),
        buildEggWhiteRecord("2026-03-15"),
        buildEggWhiteRecord("2026-04-10"),
      ];
      expect(
        inferEggWhiteOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBe("2026-03-16");
    });
  });

  describe("inferObservedOvulationDate", () => {
    it("prefers the BBT-derived date over the eggwhite date when both are present", () => {
      const records = [
        ...buildGoldenShiftRecords(),
        buildEggWhiteRecord("2026-03-04"),
      ];
      expect(
        inferObservedOvulationDate(records, "2026-03-01", "2026-03-29"),
      ).toBe("2026-03-06");
    });

    it("falls back to the eggwhite estimate when the BBT signal is insufficient", () => {
      const records = [
        buildBBTRecord("2026-03-10", 36.4),
        buildBBTRecord("2026-03-11", 36.4),
        buildEggWhiteRecord("2026-03-14"),
      ];
      expect(
        inferObservedOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBe("2026-03-15");
    });

    it("returns null when neither BBT nor eggwhite signals exist", () => {
      const records = [{ ...createEmptyDayLogRecord("2026-03-13"), mood: 4 }];
      expect(
        inferObservedOvulationDate(records, "2026-03-10", "2026-04-07"),
      ).toBeNull();
    });
  });
});
