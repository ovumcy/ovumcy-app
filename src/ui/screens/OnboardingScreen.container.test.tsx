import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { OnboardingRecord } from "../../models/onboarding";
import { createDefaultProfileRecord } from "../../models/profile";
import { buildOnboardingViewData } from "../../services/onboarding-view-service";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { OnboardingScreen } from "./OnboardingScreen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRouter = {
  replace: mockReplace,
  push: mockPush,
};

jest.mock("expo-router", () => {
  return {
    useRouter: () => mockRouter,
  };
});

function createOnboardingRecordFixture(
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

describe("OnboardingScreen", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
  });

  it("opens the privacy notice from step 1, before any cycle date is stored", async () => {
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
      readProfileRecord: jest.fn().mockResolvedValue(createDefaultProfileRecord()),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);
    await screen.findByTestId("onboarding-next-button");

    fireEvent.press(screen.getByTestId("onboarding-privacy-notice-link"));

    expect(mockPush).toHaveBeenCalledWith("/privacy");
    // Reading the notice must not commit anything: the transparency obligation
    // is satisfied before collection, not after it.
    expect(storage.writeOnboardingRecord).not.toHaveBeenCalled();
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

  it("advances from step 1 to step 2 and persists the step explicitly, clearing a prior validation error", async () => {
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
      readOnboardingRecord: jest
        .fn()
        .mockResolvedValue(createOnboardingRecordFixture()),
      readProfileRecord: jest.fn().mockResolvedValue(createDefaultProfileRecord()),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);

    await screen.findByTestId("onboarding-next-button");

    // Pressing Next with no date selected surfaces the step-1 validation error.
    fireEvent.press(screen.getByTestId("onboarding-next-button"));
    await screen.findByTestId("onboarding-step-one-error");

    // Picking a date runs onDateSelected: clears the error and records the date.
    fireEvent.press(screen.getByTestId("onboarding-day-option-2026-03-19"));
    expect(screen.queryByTestId("onboarding-step-one-error")).toBeNull();

    fireEvent.press(screen.getByTestId("onboarding-next-button"));

    await screen.findByTestId("onboarding-finish-button");
    expect(screen.queryByTestId("onboarding-next-button")).toBeNull();

    expect(storage.writeOnboardingRecord).toHaveBeenCalledWith(
      expect.objectContaining({ lastPeriodStart: "2026-03-19" }),
    );
    // The unfinished step is persisted explicitly in bootstrap state — never
    // inferred from the record's lastPeriodStart.
    expect(storage.writeBootstrapState).toHaveBeenCalledWith({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 2,
    });
  });

  it("never infers the step from a persisted last period start — reopens on the explicit step 1", async () => {
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
      readOnboardingRecord: jest
        .fn()
        .mockResolvedValue(
          createOnboardingRecordFixture({ lastPeriodStart: "2026-03-01" }),
        ),
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-01",
      }),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);

    await screen.findByTestId("onboarding-next-button");
    expect(screen.queryByTestId("onboarding-finish-button")).toBeNull();
  });

  it("returns to step 1 from step 2 and persists the regressed step", async () => {
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 2,
      }),
      readOnboardingRecord: jest
        .fn()
        .mockResolvedValue(
          createOnboardingRecordFixture({ lastPeriodStart: "2026-03-18" }),
        ),
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-18",
      }),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);

    await screen.findByTestId("onboarding-finish-button");

    fireEvent.press(screen.getByTestId("onboarding-back-button"));

    await screen.findByTestId("onboarding-next-button");
    expect(screen.queryByTestId("onboarding-finish-button")).toBeNull();
    await waitFor(() =>
      expect(storage.writeBootstrapState).toHaveBeenCalledWith({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
    );
  });

  it("surfaces a generic step-one error when persisting the back-navigation step fails", async () => {
    const onboardingRecord = createOnboardingRecordFixture({
      lastPeriodStart: "2026-03-18",
    });
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 2,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue(onboardingRecord),
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-18",
      }),
      writeBootstrapState: jest.fn().mockRejectedValue(new Error("write failed")),
    });
    const now = new Date(2026, 2, 20);

    render(<OnboardingScreen now={now} storage={storage} />);

    await screen.findByTestId("onboarding-finish-button");

    fireEvent.press(screen.getByTestId("onboarding-back-button"));

    await screen.findByTestId("onboarding-next-button");
    const expectedError = buildOnboardingViewData(onboardingRecord, now, "en").errors
      .generic;
    await screen.findByText(expectedError);
  });

  it("surfaces the invalid-last-period-start error for a malformed persisted date", async () => {
    const onboardingRecord = createOnboardingRecordFixture({
      lastPeriodStart: "not-a-date",
    });
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue(onboardingRecord),
      readProfileRecord: jest.fn().mockResolvedValue(createDefaultProfileRecord()),
    });
    const now = new Date(2026, 2, 20);

    render(<OnboardingScreen now={now} storage={storage} />);

    await screen.findByTestId("onboarding-next-button");
    fireEvent.press(screen.getByTestId("onboarding-next-button"));

    const expectedError = buildOnboardingViewData(onboardingRecord, now, "en").errors
      .invalidLastPeriodStart;
    await screen.findByText(expectedError);
  });

  it("surfaces the last-period-range error for a persisted date beyond today", async () => {
    const onboardingRecord = createOnboardingRecordFixture({
      lastPeriodStart: "2026-04-01",
    });
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue(onboardingRecord),
      readProfileRecord: jest.fn().mockResolvedValue(createDefaultProfileRecord()),
    });
    const now = new Date(2026, 2, 20);

    render(<OnboardingScreen now={now} storage={storage} />);

    await screen.findByTestId("onboarding-next-button");
    fireEvent.press(screen.getByTestId("onboarding-next-button"));

    const expectedError = buildOnboardingViewData(onboardingRecord, now, "en").errors
      .lastPeriodRange;
    await screen.findByText(expectedError);
  });

  it("surfaces a generic step-one error when saving a valid date fails to persist", async () => {
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
      readOnboardingRecord: jest
        .fn()
        .mockResolvedValue(createOnboardingRecordFixture()),
      readProfileRecord: jest.fn().mockResolvedValue(createDefaultProfileRecord()),
      writeOnboardingRecord: jest.fn().mockRejectedValue(new Error("write failed")),
    });
    const now = new Date(2026, 2, 20);

    render(<OnboardingScreen now={now} storage={storage} />);

    await screen.findByTestId("onboarding-next-button");
    fireEvent.press(screen.getByTestId("onboarding-day-option-2026-03-19"));
    fireEvent.press(screen.getByTestId("onboarding-next-button"));

    const expectedError = buildOnboardingViewData(
      createOnboardingRecordFixture(),
      now,
      "en",
    ).errors.generic;
    await screen.findByText(expectedError);
    expect(screen.queryByTestId("onboarding-finish-button")).toBeNull();
  });

  it("dismisses the day-one helper note and persists the dismissal", async () => {
    const defaultProfile = createDefaultProfileRecord();
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
      readOnboardingRecord: jest
        .fn()
        .mockResolvedValue(createOnboardingRecordFixture()),
      readProfileRecord: jest.fn().mockResolvedValue(defaultProfile),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);

    await screen.findByTestId("onboarding-step-one-note");

    fireEvent.press(screen.getByTestId("onboarding-step-one-note-dismiss"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          dismissedOnboardingHelperNoticeKey: "onboarding_day1_tip_notice_v1",
        }),
      ),
    );
  });

  it("dismisses the step-one validation error without resubmitting", async () => {
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 1,
      }),
      readOnboardingRecord: jest
        .fn()
        .mockResolvedValue(createOnboardingRecordFixture()),
      readProfileRecord: jest.fn().mockResolvedValue(createDefaultProfileRecord()),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);

    await screen.findByTestId("onboarding-next-button");
    fireEvent.press(screen.getByTestId("onboarding-next-button"));
    await screen.findByTestId("onboarding-step-one-error");

    fireEvent.press(screen.getByTestId("onboarding-step-one-error-dismiss"));

    expect(screen.queryByTestId("onboarding-step-one-error")).toBeNull();
    expect(storage.writeOnboardingRecord).not.toHaveBeenCalled();
  });

  it("updates every step-two field, finishes onboarding into a single canonical profile write, and redirects to dashboard", async () => {
    const onboardingRecord = createOnboardingRecordFixture({
      lastPeriodStart: "2026-03-18",
    });
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 2,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue(onboardingRecord),
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-18",
      }),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);

    await screen.findByTestId("onboarding-finish-button");

    fireEvent(screen.getByTestId("onboarding-cycle-length-slider"), "valueChange", 40);
    fireEvent(screen.getByTestId("onboarding-period-length-slider"), "valueChange", 6);
    fireEvent.press(screen.getByTestId("onboarding-age-group-age_40_45"));
    fireEvent.press(screen.getByTestId("onboarding-usage-goal-trying_to_conceive"));
    fireEvent.press(screen.getByTestId("onboarding-prediction-mode-irregular"));
    fireEvent.press(screen.getByTestId("onboarding-toggle-auto-period-fill"));

    fireEvent.press(screen.getByTestId("onboarding-finish-button"));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/(tabs)/dashboard"),
    );

    expect(storage.writeProfileRecord).toHaveBeenCalledTimes(1);
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPeriodStart: "2026-03-18",
        cycleLength: 40,
        periodLength: 6,
        autoPeriodFill: false,
        irregularCycle: true,
        unpredictableCycle: false,
        ageGroup: "age_40_45",
        usageGoal: "trying_to_conceive",
      }),
    );
    expect(storage.writeBootstrapState).toHaveBeenCalledWith({
      hasCompletedOnboarding: true,
      profileVersion: 2,
      incompleteOnboardingStep: null,
    });
    // autoPeriodFill was turned off during step 2, so no day-log seeding occurs.
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();
  });

  it("calls the onFinished callback instead of navigating after completing step two", async () => {
    const onboardingRecord = createOnboardingRecordFixture({
      lastPeriodStart: "2026-03-18",
    });
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 2,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue(onboardingRecord),
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-18",
      }),
    });
    const onFinished = jest.fn();

    render(
      <OnboardingScreen
        now={new Date(2026, 2, 20)}
        onFinished={onFinished}
        storage={storage}
      />,
    );

    await screen.findByTestId("onboarding-finish-button");
    fireEvent.press(screen.getByTestId("onboarding-finish-button"));

    await waitFor(() => expect(onFinished).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("surfaces and dismisses a date-required step-two error for a persisted record with no start date", async () => {
    const onboardingRecord = createOnboardingRecordFixture({
      lastPeriodStart: null,
    });
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 2,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue(onboardingRecord),
      readProfileRecord: jest.fn().mockResolvedValue(createDefaultProfileRecord()),
    });
    const now = new Date(2026, 2, 20);

    render(<OnboardingScreen now={now} storage={storage} />);

    await screen.findByTestId("onboarding-finish-button");
    fireEvent.press(screen.getByTestId("onboarding-finish-button"));

    const expectedError = buildOnboardingViewData(onboardingRecord, now, "en").errors
      .dateRequired;
    await screen.findByText(expectedError);
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("onboarding-step-two-error-dismiss"));
    expect(screen.queryByText(expectedError)).toBeNull();
  });

  it("disables finish and surfaces the incompatible-cycle warning while step-two settings conflict", async () => {
    const onboardingRecord = createOnboardingRecordFixture({
      lastPeriodStart: "2026-03-18",
    });
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 2,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue(onboardingRecord),
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-18",
      }),
    });

    render(<OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />);

    await screen.findByTestId("onboarding-finish-button");
    expect(
      screen.getByTestId("onboarding-finish-button").props.accessibilityState
        ?.disabled,
    ).toBe(false);

    // Cycle length 15 with period length 6 leaves no valid luteal reserve
    // (buildCycleGuidanceState.invalid) — the container recomputes guidance
    // from live slider state and disables Finish before any storage write
    // can be attempted, so an incompatible combination can never reach
    // finishOnboarding through the UI.
    fireEvent(screen.getByTestId("onboarding-cycle-length-slider"), "valueChange", 15);
    fireEvent(screen.getByTestId("onboarding-period-length-slider"), "valueChange", 6);

    await screen.findByTestId("onboarding-step-two-error");
    expect(
      screen.getByTestId("onboarding-finish-button").props.accessibilityState
        ?.disabled,
    ).toBe(true);
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
  });

  it("surfaces a generic step-two error when finishing fails to persist", async () => {
    const onboardingRecord = createOnboardingRecordFixture({
      lastPeriodStart: "2026-03-18",
    });
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 2,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue(onboardingRecord),
      readProfileRecord: jest.fn().mockResolvedValue({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-18",
      }),
      writeProfileRecord: jest.fn().mockRejectedValue(new Error("write failed")),
    });
    const now = new Date(2026, 2, 20);

    render(<OnboardingScreen now={now} storage={storage} />);

    await screen.findByTestId("onboarding-finish-button");
    fireEvent.press(screen.getByTestId("onboarding-finish-button"));

    const expectedError = buildOnboardingViewData(onboardingRecord, now, "en").errors
      .generic;
    await screen.findByText(expectedError);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not navigate after unmount even when the pending load later resolves as completed", async () => {
    let resolveBootstrap: (value: {
      hasCompletedOnboarding: boolean;
      profileVersion: number;
      incompleteOnboardingStep: null;
    }) => void = () => {};
    const bootstrapPromise = new Promise<{
      hasCompletedOnboarding: boolean;
      profileVersion: number;
      incompleteOnboardingStep: null;
    }>((resolve) => {
      resolveBootstrap = resolve;
    });
    const storage = createLocalAppStorageMock({
      readBootstrapState: jest.fn().mockReturnValue(bootstrapPromise),
      readOnboardingRecord: jest
        .fn()
        .mockResolvedValue(createOnboardingRecordFixture()),
      readProfileRecord: jest.fn().mockResolvedValue(createDefaultProfileRecord()),
    });

    const view = render(
      <OnboardingScreen now={new Date(2026, 2, 20)} storage={storage} />,
    );
    view.unmount();

    await act(async () => {
      resolveBootstrap({
        hasCompletedOnboarding: true,
        profileVersion: 2,
        incompleteOnboardingStep: null,
      });
      await bootstrapPromise;
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
