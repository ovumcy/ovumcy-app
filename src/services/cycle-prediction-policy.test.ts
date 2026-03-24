import { calcOvulationDay, predictCycleWindow } from "./cycle-prediction-policy";

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
