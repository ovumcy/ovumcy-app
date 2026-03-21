import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createDefaultProfileRecord } from "../../models/profile";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { OnboardingScreen } from "./OnboardingScreen";

const mockReplace = jest.fn();
const mockRouter = {
  replace: mockReplace,
};

jest.mock("expo-router", () => {
  return {
    useRouter: () => mockRouter,
  };
});

describe("OnboardingScreen", () => {
  beforeEach(() => {
    mockReplace.mockReset();
  });

  it("shows onboarding immediately while local state hydrates", async () => {
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
      readProfileRecord: jest.fn().mockResolvedValue(createDefaultProfileRecord()),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);

    expect(screen.queryByTestId("onboarding-next-button")).toBeTruthy();
    await screen.findByTestId("onboarding-next-button");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("still redirects to dashboard when onboarding is already completed", async () => {
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: true,
        profileVersion: 2,
        incompleteOnboardingStep: null,
      }),
      readProfileRecord: jest.fn().mockResolvedValue(createDefaultProfileRecord()),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard"),
    );
  });

  it("reloads fresh onboarding state when the reset key changes", async () => {
    const defaultProfile = createDefaultProfileRecord();
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
      readProfileRecord: jest
        .fn()
        .mockResolvedValueOnce({
          ...defaultProfile,
          dismissedOnboardingHelperNoticeKey: "onboarding_day1_tip_notice_v1",
        })
        .mockResolvedValue(defaultProfile),
    });
    const now = new Date(2026, 2, 20);
    const view = render(
      <OnboardingScreen now={now} reloadKey="before-clear" storage={storage} />,
    );

    await screen.findByTestId("onboarding-next-button");
    expect(screen.queryByTestId("onboarding-step-one-note")).toBeNull();

    fireEvent.press(screen.getByTestId("onboarding-next-button"));

    await screen.findByTestId("onboarding-step-one-error");

    act(() => {
      view.rerender(
        <OnboardingScreen now={now} reloadKey="after-clear" storage={storage} />,
      );
    });

    expect(screen.queryByTestId("onboarding-next-button")).toBeTruthy();
    await screen.findByTestId("onboarding-next-button");
    await waitFor(() =>
      expect(screen.queryByTestId("onboarding-step-one-error")).toBeNull(),
    );
    expect(screen.getByTestId("onboarding-step-one-note")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("reopens incomplete onboarding on the persisted step 2 state", async () => {
    const defaultProfile = createDefaultProfileRecord();
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 2,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-03-18",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
      }),
      readProfileRecord: jest.fn().mockResolvedValue({
        ...defaultProfile,
        lastPeriodStart: "2026-03-18",
      }),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);

    await screen.findByTestId("onboarding-finish-button");
    expect(screen.queryByTestId("onboarding-next-button")).toBeNull();
  });
});
