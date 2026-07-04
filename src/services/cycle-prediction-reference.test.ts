import { predictCycleWindow } from "./cycle-prediction-policy";

// Reference vectors for docs/cycle-prediction.md.
//
// Each case below is a worked example in that document. This test locks the
// documented numbers to the code: if the prediction math changes, both this
// file and docs/cycle-prediction.md must change in the same commit. Mirrors the
// intent of ovumcy-web's cycles_reference_test.go. The next-period column in the
// doc is cycleStartDate + cycleLength (not part of predictCycleWindow's output),
// so it is not asserted here.
describe("cycle-prediction reference vectors (docs/cycle-prediction.md)", () => {
  it("28-day cycle, luteal 14 -> ovulation 2026-03-23, window 03-18..03-23 (exact)", () => {
    expect(predictCycleWindow("2026-03-10", 28, 14)).toEqual({
      calculable: true,
      fertilityStart: "2026-03-18",
      fertilityEnd: "2026-03-23",
      ovulationDate: "2026-03-23",
      isExact: true,
    });
  });

  it("30-day cycle, luteal 0 -> default 14 -> ovulation 2026-06-16, window 06-11..06-16 (exact)", () => {
    expect(predictCycleWindow("2026-06-01", 30, 0)).toEqual({
      calculable: true,
      fertilityStart: "2026-06-11",
      fertilityEnd: "2026-06-16",
      ovulationDate: "2026-06-16",
      isExact: true,
    });
  });

  it("21-day cycle, luteal 14 -> ovulation 2026-01-07, window 01-02..01-07 (exact)", () => {
    expect(predictCycleWindow("2026-01-01", 21, 14)).toEqual({
      calculable: true,
      fertilityStart: "2026-01-02",
      fertilityEnd: "2026-01-07",
      ovulationDate: "2026-01-07",
      isExact: true,
    });
  });

  it("15-day cycle, luteal 14 clamped to 10 -> ovulation 2026-02-05, window clamped to period start (non-exact)", () => {
    expect(predictCycleWindow("2026-02-01", 15, 14)).toEqual({
      calculable: true,
      fertilityStart: "2026-02-01",
      fertilityEnd: "2026-02-05",
      ovulationDate: "2026-02-05",
      isExact: false,
    });
  });

  it("14-day cycle -> too short, no prediction", () => {
    expect(predictCycleWindow("2026-02-01", 14, 14)).toEqual({
      calculable: false,
      fertilityStart: null,
      fertilityEnd: null,
      ovulationDate: null,
      isExact: false,
    });
  });
});
