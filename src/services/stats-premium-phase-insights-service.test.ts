import { buildStatsPremiumPhaseInsights } from "./stats-premium-phase-insights-service";

describe("stats-premium-phase-insights-service", () => {
  it("builds a mood contrast and phase symptom peak when the phase data is strong enough", () => {
    const summary = buildStatsPremiumPhaseInsights(
      [
        {
          phase: "follicular",
          hasData: true,
          averageMood: 4.4,
          percentage: 88,
          entryCount: 4,
        },
        {
          phase: "luteal",
          hasData: true,
          averageMood: 2.9,
          percentage: 58,
          entryCount: 5,
        },
      ],
      [
        {
          phase: "luteal",
          hasData: true,
          totalDays: 5,
          items: [
            {
              id: "cramps",
              label: "Cramps",
              icon: "⚡",
              percentage: 60,
              count: 3,
            },
          ],
        },
      ],
    );

    expect(summary.moodContrast).toEqual(
      expect.objectContaining({
        bestPhase: "follicular",
        worstPhase: "luteal",
      }),
    );
    expect(summary.symptomPeak).toEqual(
      expect.objectContaining({
        phase: "luteal",
        symptom: expect.objectContaining({
          label: "Cramps",
        }),
      }),
    );
  });

  it("returns null summaries when phase deltas are too weak", () => {
    const summary = buildStatsPremiumPhaseInsights(
      [
        {
          phase: "follicular",
          hasData: true,
          averageMood: 3.7,
          percentage: 74,
          entryCount: 4,
        },
        {
          phase: "luteal",
          hasData: true,
          averageMood: 3.4,
          percentage: 68,
          entryCount: 4,
        },
      ],
      [
        {
          phase: "luteal",
          hasData: true,
          totalDays: 5,
          items: [
            {
              id: "cramps",
              label: "Cramps",
              icon: "⚡",
              percentage: 20,
              count: 1,
            },
          ],
        },
      ],
    );

    expect(summary.moodContrast).toBeNull();
    expect(summary.symptomPeak).toBeNull();
  });
});
