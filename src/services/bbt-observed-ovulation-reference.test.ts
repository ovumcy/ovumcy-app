import {
  createEmptyDayLogRecord,
  type DayCervicalMucus,
  type DayCycleFactorKey,
  type DayLogRecord,
} from "../models/day-log";
import bbtVectors from "./__fixtures__/bbt-observed-ovulation-vectors.json";
import { inferObservedOvulationDate } from "./observed-ovulation-service";

// Cross-repo parity test for the observed-ovulation ("3-over-6" BBT shift +
// egg-white fallback) detector.
//
// The vectors live in a shared fixture
// (./__fixtures__/bbt-observed-ovulation-vectors.json) whose
// expectedObservedOvulationDate values are AUTHORED FROM ovumcy-web's documented
// detector rule (internal/services/cycle_signals.go). This suite asserts the app
// detector (inferObservedOvulationDate) reproduces those web-authoritative
// dates; scripts/check-cross-repo-contracts.mjs separately asserts the governing
// rule CONSTANTS (coverline window, streak length, third-day margin, disturbance
// factors) are still byte-identical between the two repos, so neither the rule
// nor its output can drift on one side without failing CI. A detector-rule
// change updates the fixture, both detectors, and this test in the same commit.
// See docs/cross-repo-contracts.md (contract 5).

type FixtureDay = {
  date: string;
  bbt?: number;
  cervicalMucus?: string;
  cycleFactorKeys?: string[];
};

type FixtureCase = {
  name: string;
  cycleStartDate: string;
  cycleEndDate: string;
  days: FixtureDay[];
  expectedObservedOvulationDate: string | null;
};

function buildRecord(day: FixtureDay): DayLogRecord {
  const record = createEmptyDayLogRecord(day.date);
  if (typeof day.bbt === "number") {
    record.bbt = day.bbt;
  }
  if (typeof day.cervicalMucus === "string") {
    record.cervicalMucus = day.cervicalMucus as DayCervicalMucus;
  }
  if (Array.isArray(day.cycleFactorKeys)) {
    record.cycleFactorKeys = day.cycleFactorKeys as DayCycleFactorKey[];
  }
  return record;
}

describe("observed-ovulation golden vectors (shared with ovumcy-web)", () => {
  const cases = bbtVectors.cases as FixtureCase[];

  it("covers the documented detector behaviours", () => {
    // Guard against an accidentally-emptied fixture silently passing.
    expect(cases.length).toBeGreaterThanOrEqual(7);
  });

  for (const testCase of cases) {
    it(testCase.name, () => {
      const records = testCase.days.map(buildRecord);
      const observed = inferObservedOvulationDate(
        records,
        testCase.cycleStartDate,
        testCase.cycleEndDate,
      );
      expect(observed).toBe(testCase.expectedObservedOvulationDate);
    });
  }
});
