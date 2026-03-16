import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { OnboardingScreen } from "./OnboardingScreen";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
}));

function createStorageMock(
  overrides?: Partial<LocalAppStorage>,
): LocalAppStorage {
  return {
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding: false,
      profileVersion: 1,
    }),
    writeBootstrapState: jest.fn().mockResolvedValue(undefined),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: false,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    writeOnboardingRecord: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("OnboardingScreen", () => {
  it("renders the step 1 onboarding copy and quick picks", async () => {
    const storage = createStorageMock();

    render(<OnboardingScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByText("When did your last period start?");
    expect(screen.getByText("Choose a date from the last 60 days.")).toBeTruthy();
    expect(
      screen.getByText("Day 1 is the first day of full flow, not spotting."),
    ).toBeTruthy();
    expect(screen.getByTestId("onboarding-day-option-2026-03-17")).toBeTruthy();
    expect(screen.getByTestId("onboarding-day-option-2026-03-16")).toBeTruthy();
  });

  it("persists local step 2 values and completes onboarding", async () => {
    const storage = createStorageMock({
      readOnboardingRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-03-17",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: false,
        irregularCycle: false,
        ageGroup: "",
        usageGoal: "health",
      }),
    });
    const onFinished = jest.fn();

    render(
      <OnboardingScreen
        now={new Date(2026, 2, 17)}
        onFinished={onFinished}
        storage={storage}
      />,
    );

    await screen.findByText("Set up cycle parameters");

    fireEvent(
      screen.getByTestId("onboarding-cycle-length-slider"),
      "valueChange",
      35,
    );
    expect(screen.getByText("35 days")).toBeTruthy();

    fireEvent(screen.getByTestId("onboarding-finish-button"), "onPress");

    await waitFor(() =>
      expect(storage.writeBootstrapState).toHaveBeenCalledWith({
        hasCompletedOnboarding: true,
        profileVersion: 1,
      }),
    );
    expect(storage.writeOnboardingRecord).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cycleLength: 35,
        lastPeriodStart: "2026-03-17",
      }),
    );
    expect(onFinished).toHaveBeenCalled();
  });
});
