import {
  buildCycleGuidanceState,
  buildDayOptions,
  createStepTwoDefaults,
  getOnboardingDateBounds,
  normalizeAgeGroup,
  normalizeUsageGoal,
  resolveOnboardingStep,
  sanitizeOnboardingCycleAndPeriod,
  sanitizeStepTwoValues,
  validateStepOneStartDate,
} from "./onboarding-policy";

describe("onboarding-policy", () => {
  it("uses the later of year start and 60-day lookback for onboarding bounds", () => {
    const bounds = getOnboardingDateBounds(new Date(2026, 2, 17));

    expect(bounds.minDate).toBe("2026-01-16");
    expect(bounds.maxDate).toBe("2026-03-17");
  });

  it("validates step 1 dates against required, format, and range rules", () => {
    const now = new Date(2026, 2, 17);

    expect(validateStepOneStartDate("", now)).toBe("date_required");
    expect(validateStepOneStartDate("2026-02-30", now)).toBe(
      "invalid_last_period_start",
    );
    expect(validateStepOneStartDate("2025-12-31", now)).toBe(
      "last_period_range",
    );
    expect(validateStepOneStartDate("2026-03-10", now)).toBeNull();
  });

  it("sanitizes incompatible cycle and period lengths", () => {
    expect(sanitizeOnboardingCycleAndPeriod(14, 20)).toEqual({
      cycleLength: 15,
      periodLength: 5,
    });
    expect(sanitizeOnboardingCycleAndPeriod(21, 14)).toEqual({
      cycleLength: 21,
      periodLength: 11,
    });
  });

  it("mirrors the web guidance state for step 2 messaging", () => {
    expect(buildCycleGuidanceState(21, 14)).toEqual({
      adjusted: true,
      cycleShort: true,
      invalid: false,
      periodLength: 11,
      periodLong: true,
      warning: false,
    });
  });

  it("builds descending day options with relative labels for recent days", () => {
    const options = buildDayOptions("2026-03-15", "2026-03-17", "en", {
      today: "Today",
      yesterday: "Yesterday",
      twoDaysAgo: "2 days ago",
    });

    expect(options.map((option) => option.label)).toEqual([
      "Today",
      "Yesterday",
      "2 days ago",
    ]);
    expect(options[0]?.secondaryLabel).toContain("Mar");
  });

  it("normalizes preference inputs and onboarding step selection", () => {
    expect(normalizeAgeGroup("  AGE_35_PLUS  ")).toBe("age_35_plus");
    expect(normalizeAgeGroup("oops")).toBe("");
    expect(normalizeUsageGoal(" TRYING_TO_CONCEIVE ")).toBe(
      "trying_to_conceive",
    );
    expect(normalizeUsageGoal("oops")).toBe("health");

    expect(
      resolveOnboardingStep(
        {
          lastPeriodStart: null,
          cycleLength: 28,
          periodLength: 5,
          autoPeriodFill: true,
          irregularCycle: false,
          unpredictableCycle: false,
          ageGroup: "",
          usageGoal: "health",
        },
        false,
      ),
    ).toBe(1);

    expect(
      resolveOnboardingStep(
        {
          lastPeriodStart: "2026-03-14",
          cycleLength: 28,
          periodLength: 5,
          autoPeriodFill: true,
          irregularCycle: false,
          unpredictableCycle: false,
          ageGroup: "",
          usageGoal: "health",
        },
        false,
      ),
    ).toBe(2);
  });

  it("maps onboarding prediction mode cleanly to and from profile flags", () => {
    expect(
      createStepTwoDefaults({
        lastPeriodStart: "2026-03-14",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: true,
        ageGroup: "",
        usageGoal: "health",
      }),
    ).toEqual(
      expect.objectContaining({
        predictionMode: "facts_only",
      }),
    );

    expect(
      sanitizeStepTwoValues({
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        predictionMode: "irregular",
        ageGroup: "age_20_35",
        usageGoal: "health",
      }),
    ).toEqual(
      expect.objectContaining({
        predictionMode: "irregular",
      }),
    );
  });
});
