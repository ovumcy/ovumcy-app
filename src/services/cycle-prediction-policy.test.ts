import {
  calcLutealPhase,
  calcOvulationDay,
  predictCycleWindow,
} from "./cycle-prediction-policy";

describe("cycle-prediction-policy", () => {
  it("keeps normal-cycle ovulation on cycle day fourteen", () => {
    expect(calcOvulationDay(28, 14)).toEqual({
      day: 14,
      isExact: true,
    });
  });

  it("keeps a short supported cycle calculable", () => {
    expect(calcOvulationDay(15, 10)).toEqual({
      day: 5,
      isExact: true,
    });
  });

  it("treats cycles below the supported floor as non-calculable", () => {
    expect(calcOvulationDay(14, 15)).toEqual({
      day: null,
      isExact: false,
    });
    expect(predictCycleWindow("2026-02-10", 14, 15)).toEqual({
      calculable: false,
      fertilityEnd: null,
      fertilityStart: null,
      isExact: false,
      ovulationDate: null,
    });
  });

  it("keeps ovulation before the next period start", () => {
    expect(predictCycleWindow("2026-02-10", 28, 14)).toEqual({
      calculable: true,
      fertilityEnd: "2026-02-23",
      fertilityStart: "2026-02-18",
      isExact: true,
      ovulationDate: "2026-02-23",
    });
  });
});

// Pins the inverse direction of the same arithmetic: given the cycle day an
// ovulation was OBSERVED on, calcLutealPhase must return the parameter
// calcOvulationDay maps back to that very day. Every row is also a row of the
// "Step 2a" table in docs/cycle-prediction.md.
//
// This documents the pair; it is deliberately NOT the regression for the
// round-trip defect. The two functions are exact inverses by construction, so
// this table can never fail — it stayed green through the whole life of the
// defect, which lived in the step that DERIVES the argument from logged
// signals. That step is pinned by cycle-luteal-round-trip.test.ts.
describe("Step 2a reference vectors (observed ovulation day -> luteal phase)", () => {
  // wantDay is the cycle day the round trip lands on and wantExact says whether
  // it got there without Step 2's reserve clamp. They are separate fields
  // because of the last row: an observation can imply a luteal phase the cycle
  // cannot hold, and there the clamp is the designed answer rather than a
  // broken round trip.
  const vectors: {
    name: string;
    cycleLength: number;
    observedOvulationDay: number;
    wantLutealPhase: number;
    wantDay: number;
    wantExact: boolean;
  }[] = [
    { name: "28-day cycle, ovulation on day 14 is the 14-day model default", cycleLength: 28, observedOvulationDay: 14, wantLutealPhase: 14, wantDay: 14, wantExact: true },
    { name: "28-day cycle, ovulation on day 15", cycleLength: 28, observedOvulationDay: 15, wantLutealPhase: 13, wantDay: 15, wantExact: true },
    { name: "short 21-day cycle, ovulation on day 8", cycleLength: 21, observedOvulationDay: 8, wantLutealPhase: 13, wantDay: 8, wantExact: true },
    { name: "long 35-day cycle, ovulation on day 21", cycleLength: 35, observedOvulationDay: 21, wantLutealPhase: 14, wantDay: 21, wantExact: true },
    { name: "long 40-day cycle, ovulation on day 26", cycleLength: 40, observedOvulationDay: 26, wantLutealPhase: 14, wantDay: 26, wantExact: true },
    { name: "30-day cycle, ovulation on day 20 lands on the 10-day floor", cycleLength: 30, observedOvulationDay: 20, wantLutealPhase: 10, wantDay: 20, wantExact: true },
    // The exception the invariant carries. An ovulation observed on day 4 of a
    // 15-day cycle implies an 11-day luteal phase: physiologically ordinary,
    // admitted by the plausibility window, and still more than the cycle can
    // hold, since the reserve caps the parameter at cycleLength - 5 = 10. The
    // round trip does NOT return day 4 here, and must not pretend to.
    { name: "15-day cycle, an observation the cycle cannot hold", cycleLength: 15, observedOvulationDay: 4, wantLutealPhase: 11, wantDay: 5, wantExact: false },
  ];

  for (const vector of vectors) {
    it(vector.name, () => {
      const luteal = calcLutealPhase(
        vector.cycleLength,
        vector.observedOvulationDay,
      );
      expect(luteal).toBe(vector.wantLutealPhase);
      expect(calcOvulationDay(vector.cycleLength, luteal)).toEqual({
        day: vector.wantDay,
        isExact: vector.wantExact,
      });
      // wantDay is a free field, so on its own it lets a vector state the very
      // drift these rows exist to catch — an exact round trip landing a day off
      // the observation. Bind the two back together wherever the clamp did not
      // intervene; the clamped row is exempt because there the two genuinely
      // differ, and that is the point of it.
      if (vector.wantExact) {
        expect(vector.wantDay).toBe(vector.observedOvulationDay);
      }
    });
  }
});
