import { fireEvent, render, screen } from "@testing-library/react-native";

import type { OnboardingRecord } from "../../models/onboarding";
import { buildCycleGuidanceState } from "../../services/onboarding-policy";
import type { LoadedOnboardingState } from "../../services/onboarding-screen-service";
import { buildOnboardingViewData } from "../../services/onboarding-view-service";
import { OnboardingFlowScreen } from "./OnboardingFlowScreen";

function createOnboardingRecord(
  overrides?: Partial<OnboardingRecord>,
): OnboardingRecord {
  return {
    lastPeriodStart: null,
    cycleLength: 28,
    periodLength: 5,
    autoPeriodFill: true,
    irregularCycle: false,
    ageGroup: "",
    usageGoal: "health",
    ...overrides,
  };
}

function createState(
  overrides?: Partial<LoadedOnboardingState>,
): LoadedOnboardingState {
  const record = createOnboardingRecord();

  return {
    record,
    selectedDate: record.lastPeriodStart ?? "",
    step: 1,
    stepTwoValues: {
      cycleLength: record.cycleLength,
      periodLength: record.periodLength,
      autoPeriodFill: record.autoPeriodFill,
      irregularCycle: record.irregularCycle,
      ageGroup: "age_20_35",
      usageGoal: record.usageGoal,
    },
    ...overrides,
  };
}

function renderFlow(state: LoadedOnboardingState) {
  const now = new Date(2026, 2, 17);

  return render(
    <OnboardingFlowScreen
      guidance={buildCycleGuidanceState(
        state.stepTwoValues.cycleLength,
        state.stepTwoValues.periodLength,
      )}
      isSaving={false}
      locale="en"
      onAutoPeriodFillChange={jest.fn()}
      onAgeGroupSelect={jest.fn()}
      onBack={jest.fn()}
      onCycleLengthChange={jest.fn()}
      onDateSelected={jest.fn()}
      onFinish={jest.fn()}
      onIrregularCycleChange={jest.fn()}
      onNext={jest.fn()}
      onPeriodLengthChange={jest.fn()}
      onUsageGoalSelect={jest.fn()}
      state={state}
      stepOneError=""
      stepTwoError=""
      viewData={buildOnboardingViewData(state.record, now, "en")}
    />,
  );
}

describe("OnboardingFlowScreen", () => {
  it("renders the step 1 onboarding copy and quick picks", () => {
    renderFlow(createState());

    expect(screen.getByText("When did your last period start?")).toBeTruthy();
    expect(screen.getByText("Choose a date from the last 60 days.")).toBeTruthy();
    expect(
      screen.getByText("Day 1 is the first day of full flow, not spotting."),
    ).toBeTruthy();
    expect(screen.getByTestId("onboarding-day-option-2026-03-17")).toBeTruthy();
    expect(screen.getByTestId("onboarding-day-option-2026-03-16")).toBeTruthy();
    expect(screen.queryByTestId("onboarding-date-field-button")).toBeNull();
  });

  it("uses quick day options as the only step 1 date selection path", () => {
    const onDateSelected = jest.fn();
    const state = createState();
    const now = new Date(2026, 2, 17);

    render(
      <OnboardingFlowScreen
        guidance={buildCycleGuidanceState(
          state.stepTwoValues.cycleLength,
          state.stepTwoValues.periodLength,
        )}
        isSaving={false}
        locale="en"
        onAutoPeriodFillChange={jest.fn()}
        onAgeGroupSelect={jest.fn()}
        onBack={jest.fn()}
        onCycleLengthChange={jest.fn()}
        onDateSelected={onDateSelected}
        onFinish={jest.fn()}
        onIrregularCycleChange={jest.fn()}
        onNext={jest.fn()}
        onPeriodLengthChange={jest.fn()}
        onUsageGoalSelect={jest.fn()}
        state={state}
        stepOneError=""
        stepTwoError=""
        viewData={buildOnboardingViewData(state.record, now, "en")}
      />,
    );

    fireEvent.press(screen.getByTestId("onboarding-day-option-2026-03-16"));

    expect(onDateSelected).toHaveBeenCalledWith("2026-03-16");
  });

  it("surfaces step 2 controls and forwards primary callbacks", () => {
    const onCycleLengthChange = jest.fn();
    const onFinish = jest.fn();
    const state = createState({
      record: createOnboardingRecord({
        lastPeriodStart: "2026-03-17",
      }),
      selectedDate: "2026-03-17",
      step: 2,
    });
    const now = new Date(2026, 2, 17);

    render(
      <OnboardingFlowScreen
        guidance={buildCycleGuidanceState(
          state.stepTwoValues.cycleLength,
          state.stepTwoValues.periodLength,
        )}
        isSaving={false}
        locale="en"
        onAutoPeriodFillChange={jest.fn()}
        onAgeGroupSelect={jest.fn()}
        onBack={jest.fn()}
        onCycleLengthChange={onCycleLengthChange}
        onDateSelected={jest.fn()}
        onFinish={onFinish}
        onIrregularCycleChange={jest.fn()}
        onNext={jest.fn()}
        onPeriodLengthChange={jest.fn()}
        onUsageGoalSelect={jest.fn()}
        state={state}
        stepOneError=""
        stepTwoError=""
        viewData={buildOnboardingViewData(state.record, now, "en")}
      />,
    );

    fireEvent(
      screen.getByTestId("onboarding-cycle-length-slider"),
      "valueChange",
      35,
    );
    fireEvent(screen.getByTestId("onboarding-finish-button"), "onPress");

    expect(onCycleLengthChange).toHaveBeenCalledWith(35);
    expect(onFinish).toHaveBeenCalled();
  });
});
