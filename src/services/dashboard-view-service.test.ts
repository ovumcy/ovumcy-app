import { buildDashboardViewData } from "./dashboard-view-service";

describe("dashboard-view-service", () => {
  it("switches to facts-only mode for unpredictable cycles", () => {
    const viewData = buildDashboardViewData(
      {
        lastPeriodStart: "2026-03-10",
        cycleLength: 29,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: true,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: false,
        temperatureUnit: "c",
        trackCervicalMucus: false,
        hideSexChip: false,
      },
      new Date(2026, 2, 17),
    );

    expect(viewData.statusItems).toEqual([
      "Next period: unknown",
      "Predictions off",
    ]);
    expect(viewData.predictionExplanation).toBe(
      "Predictions are off in unpredictable cycle mode. Ovumcy shows recorded facts only.",
    );
  });

  it("mirrors web visibility rules for intimacy, BBT, and cervical mucus", () => {
    const viewData = buildDashboardViewData(
      {
        lastPeriodStart: "2026-03-10",
        cycleLength: 29,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: true,
        temperatureUnit: "f",
        trackCervicalMucus: true,
        hideSexChip: true,
      },
      new Date(2026, 2, 17),
    );

    expect(viewData.editor.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Intimacy",
          detail: "This section is hidden in settings.",
          hidden: true,
        }),
        expect.objectContaining({
          label: "Cervical mucus",
        }),
        expect.objectContaining({
          label: "BBT",
          detail: "Visible in °F.",
        }),
      ]),
    );
  });
});
