import type { OnboardingRecord } from "../models/onboarding";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  finishOnboarding,
  loadOnboardingScreenState,
  patchOnboardingStepTwoValues,
  saveOnboardingStepOne,
  type LoadedOnboardingState,
} from "./onboarding-screen-service";

function createStorageMock(
  overrides?: Partial<LocalAppStorage>,
): LocalAppStorage {
  return {
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding: false,
      profileVersion: 2,
    }),
    writeBootstrapState: jest.fn().mockResolvedValue(undefined),
    readProfileRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: null,
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
    }),
    writeProfileRecord: jest.fn().mockResolvedValue(undefined),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    writeOnboardingRecord: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createLoadedState(
  overrides?: Partial<LoadedOnboardingState>,
): LoadedOnboardingState {
  const record: OnboardingRecord = {
    lastPeriodStart: "2026-03-17",
    cycleLength: 28,
    periodLength: 5,
    autoPeriodFill: true,
    irregularCycle: false,
    ageGroup: "",
    usageGoal: "health",
  };

  return {
    record,
    selectedDate: record.lastPeriodStart ?? "",
    step: 2,
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

describe("onboarding-screen-service", () => {
  it("returns a completed result when bootstrap state is already finished", async () => {
    const storage = createStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: true,
        profileVersion: 2,
      }),
    });

    await expect(loadOnboardingScreenState(storage)).resolves.toEqual({
      kind: "completed",
    });
  });

  it("loads onboarding state with the next unresolved step", async () => {
    const storage = createStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-03-17",
        cycleLength: 30,
        periodLength: 4,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: false,
        temperatureUnit: "c",
        trackCervicalMucus: false,
        hideSexChip: false,
      }),
    });

    await expect(loadOnboardingScreenState(storage)).resolves.toEqual({
      kind: "ready",
      state: expect.objectContaining({
        selectedDate: "2026-03-17",
        step: 2,
        stepTwoValues: expect.objectContaining({
          autoPeriodFill: true,
          cycleLength: 30,
          periodLength: 4,
        }),
      }),
    });
  });

  it("persists step 1 date selection before moving to step 2", async () => {
    const storage = createStorageMock();
    const state = createLoadedState({
      record: {
        lastPeriodStart: null,
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        ageGroup: "",
        usageGoal: "health",
      },
      selectedDate: "2026-03-16",
      step: 1,
    });

    await expect(
      saveOnboardingStepOne(storage, state, new Date(2026, 2, 17)),
    ).resolves.toEqual({
      ok: true,
      state: expect.objectContaining({
        record: expect.objectContaining({
          lastPeriodStart: "2026-03-16",
        }),
        selectedDate: "2026-03-16",
        step: 2,
      }),
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPeriodStart: "2026-03-16",
      }),
    );
  });

  it("sanitizes step 2 values before persisting onboarding completion", async () => {
    const storage = createStorageMock();
    const state = patchOnboardingStepTwoValues(
      createLoadedState(),
      { cycleLength: 21, periodLength: 30 },
    );

    const result = await finishOnboarding(storage, state);

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        stepTwoValues: expect.objectContaining({
          cycleLength: 21,
          periodLength: 11,
        }),
      }),
    });
    expect(storage.writeBootstrapState).toHaveBeenCalledWith({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleLength: 21,
        periodLength: 11,
      }),
    );
  });
});
