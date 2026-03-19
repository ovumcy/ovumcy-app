import { buildCalendarViewData } from "./calendar-view-service";

describe("calendar-view-service", () => {
  it("builds month cells with recorded period and sex markers", () => {
    const viewData = buildCalendarViewData(
      {
        lastPeriodStart: "2026-03-10",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: false,
        temperatureUnit: "c",
        trackCervicalMucus: false,
        hideSexChip: false,
      },
      [
        {
          date: "2026-03-17",
          isPeriod: true,
          cycleStart: false,
          isUncertain: false,
          flow: "medium",
          mood: 4,
          sexActivity: "protected",
          bbt: 0,
          cervicalMucus: "none",
          cycleFactorKeys: [],
          symptomIDs: [],
          notes: "",
        },
      ],
      new Date(2026, 2, 17),
      new Date(2026, 2, 1),
      "2026-03-17",
    );

    expect(viewData.monthValue).toBe("2026-03");
    expect(viewData.selectedDate).toBe("2026-03-17");
    expect(viewData.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-03-17",
          isToday: true,
          isSelected: true,
          isPeriod: true,
          hasData: true,
          hasSex: true,
          openEditDirectly: false,
        }),
      ]),
    );
  });
});
