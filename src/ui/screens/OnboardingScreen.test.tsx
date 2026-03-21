import type { ComponentProps } from "react";
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
    unpredictableCycle: false,
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
      predictionMode: "regular",
      ageGroup: "age_20_35",
      usageGoal: record.usageGoal,
    },
    ...overrides,
  };
}

function renderFlow(
  state: LoadedOnboardingState,
  overrides?: Partial<ComponentProps<typeof OnboardingFlowScreen>>,
) {
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
      onDismissStepOneError={jest.fn()}
      onDismissStepOneNotice={jest.fn()}
      onDismissStepTwoError={jest.fn()}
      onFinish={jest.fn()}
      onPredictionModeSelect={jest.fn()}
      onNext={jest.fn()}
      onPeriodLengthChange={jest.fn()}
      onUsageGoalSelect={jest.fn()}
      state={state}
      stepOneNotice={{
        dismissLabel: "Dismiss note",
        message: "Day 1 is the first day of full flow, not spotting.",
      }}
      stepOneError=""
      stepTwoError=""
      viewData={buildOnboardingViewData(state.record, now, "en")}
      {...overrides}
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
    expect(
      screen.queryByText(
        "All your data stays on this device unless you choose sync later. Core tracking does not require an account.",
      ),
    ).toBeNull();
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
        onDismissStepOneError={jest.fn()}
        onDismissStepOneNotice={jest.fn()}
        onDismissStepTwoError={jest.fn()}
        onFinish={jest.fn()}
        onPredictionModeSelect={jest.fn()}
        onNext={jest.fn()}
        onPeriodLengthChange={jest.fn()}
        onUsageGoalSelect={jest.fn()}
        state={state}
        stepOneNotice={{
          dismissLabel: "Dismiss note",
          message: "Day 1 is the first day of full flow, not spotting.",
        }}
        stepOneError=""
        stepTwoError=""
        viewData={buildOnboardingViewData(state.record, now, "en")}
      />,
    );

    fireEvent.press(screen.getByTestId("onboarding-day-option-2026-03-16"));

    expect(onDateSelected).toHaveBeenCalledWith("2026-03-16");
  });

  it("keeps the step 1 progress label when returning with a saved date", () => {
    renderFlow(
      createState({
        record: createOnboardingRecord({
          lastPeriodStart: "2026-03-01",
        }),
        selectedDate: "2026-03-01",
        step: 1,
      }),
    );

    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.queryByText("Step 2 of 2")).toBeNull();
  });

  it("surfaces step 2 controls and forwards primary callbacks", () => {
    const onCycleLengthChange = jest.fn();
    const onFinish = jest.fn();
    const onPredictionModeSelect = jest.fn();
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
        onDismissStepOneError={jest.fn()}
        onDismissStepOneNotice={jest.fn()}
        onDismissStepTwoError={jest.fn()}
        onFinish={onFinish}
        onPredictionModeSelect={onPredictionModeSelect}
        onNext={jest.fn()}
        onPeriodLengthChange={jest.fn()}
        onUsageGoalSelect={jest.fn()}
        state={state}
        stepOneNotice={null}
        stepOneError=""
        stepTwoError=""
        viewData={buildOnboardingViewData(state.record, now, "en")}
      />,
    );

    expect(screen.getByText("How predictable is your cycle?")).toBeTruthy();
    expect(screen.getByText("Usually irregular")).toBeTruthy();
    expect(screen.getByText("No predictions")).toBeTruthy();

    fireEvent(
      screen.getByTestId("onboarding-cycle-length-slider"),
      "valueChange",
      35,
    );
    fireEvent.press(screen.getByTestId("onboarding-prediction-mode-facts_only"));
    fireEvent(screen.getByTestId("onboarding-finish-button"), "onPress");

    expect(onCycleLengthChange).toHaveBeenCalledWith(35);
    expect(onPredictionModeSelect).toHaveBeenCalledWith("facts_only");
    expect(onFinish).toHaveBeenCalled();
  });

  it("lets the user dismiss the day-one helper note", () => {
    const onDismissStepOneNotice = jest.fn();

    renderFlow(createState(), { onDismissStepOneNotice });

    fireEvent.press(screen.getByTestId("onboarding-step-one-note-dismiss"));

    expect(onDismissStepOneNotice).toHaveBeenCalled();
  });

  it("lets the user dismiss a step-one error banner", () => {
    renderFlow(createState(), {
      stepOneError: "Failed to save onboarding data. Please try again.",
      stepOneNotice: null,
    });

    fireEvent.press(screen.getByTestId("onboarding-step-one-error-dismiss"));

    expect(
      screen.queryByText("Failed to save onboarding data. Please try again."),
    ).toBeNull();
  });
});
