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
  const vectors: {
    name: string;
    cycleLength: number;
    observedOvulationDay: number;
    wantLutealPhase: number;
  }[] = [
    { name: "28-day cycle, ovulation on day 14 is the 14-day model default", cycleLength: 28, observedOvulationDay: 14, wantLutealPhase: 14 },
    { name: "28-day cycle, ovulation on day 15", cycleLength: 28, observedOvulationDay: 15, wantLutealPhase: 13 },
    { name: "short 21-day cycle, ovulation on day 8", cycleLength: 21, observedOvulationDay: 8, wantLutealPhase: 13 },
    { name: "long 35-day cycle, ovulation on day 21", cycleLength: 35, observedOvulationDay: 21, wantLutealPhase: 14 },
    { name: "long 40-day cycle, ovulation on day 26", cycleLength: 40, observedOvulationDay: 26, wantLutealPhase: 14 },
    { name: "30-day cycle, ovulation on day 20 lands on the 10-day floor", cycleLength: 30, observedOvulationDay: 20, wantLutealPhase: 10 },
  ];

  for (const vector of vectors) {
    it(vector.name, () => {
      const luteal = calcLutealPhase(
        vector.cycleLength,
        vector.observedOvulationDay,
      );
      expect(luteal).toBe(vector.wantLutealPhase);
      // isExact must hold: a luteal phase derived from a real observation that
      // needed the reserve clamp would pin the clamp, not the model.
      expect(calcOvulationDay(vector.cycleLength, luteal)).toEqual({
        day: vector.observedOvulationDay,
        isExact: true,
      });
    });
  }
});
