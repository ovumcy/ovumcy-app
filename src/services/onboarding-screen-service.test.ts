import { createEmptyDayLogRecord } from "../models/day-log";
import type { OnboardingRecord } from "../models/onboarding";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  finishOnboarding,
  loadOnboardingScreenState,
  patchOnboardingStepTwoValues,
  persistIncompleteOnboardingStep,
  saveOnboardingStepOne,
  type LoadedOnboardingState,
} from "./onboarding-screen-service";

function createLoadedState(
  overrides?: Partial<LoadedOnboardingState>,
): LoadedOnboardingState {
  const record: OnboardingRecord = {
    lastPeriodStart: "2026-03-17",
    cycleLength: 28,
    periodLength: 5,
    autoPeriodFill: true,
    irregularCycle: false,
    unpredictableCycle: false,
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
      predictionMode: "regular",
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
        incompleteOnboardingStep: null,
      }),
    });

    await expect(loadOnboardingScreenState(storage)).resolves.toEqual({
      kind: "completed",
    });
  });

  it("loads onboarding state from the persisted incomplete step", async () => {
    const storage = createStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 2,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-03-17",
        cycleLength: 30,
        periodLength: 4,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
      }),
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
      profile: expect.objectContaining({
        lastPeriodStart: "2026-03-17",
      }),
      state: expect.objectContaining({
        selectedDate: "2026-03-17",
        step: 2,
        stepTwoValues: expect.objectContaining({
          autoPeriodFill: true,
          cycleLength: 30,
          periodLength: 4,
          predictionMode: "regular",
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
        unpredictableCycle: false,
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
    expect(storage.writeOnboardingRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPeriodStart: "2026-03-16",
      }),
    );
    expect(storage.writeBootstrapState).toHaveBeenCalledWith({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 2,
    });
  });

  it("logs the labeled save-step-one error in development when step 1 persistence fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const writeError = new Error(
      "sqlite/writeOnboardingRecord/profile: sqlite/writeProfileRecord/upsert: boom",
    );
    const storage = createStorageMock({
      writeOnboardingRecord: jest.fn().mockRejectedValue(writeError),
    });
    const state = createLoadedState({
      step: 1,
      selectedDate: "2026-03-16",
    });

    const result = await saveOnboardingStepOne(
      storage,
      state,
      new Date(2026, 2, 17),
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "generic",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "onboarding/saveOnboardingStepOne",
      writeError,
    );

    consoleErrorSpy.mockRestore();
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
      incompleteOnboardingStep: null,
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleLength: 21,
        periodLength: 11,
      }),
    );
  });

  it("persists facts-only onboarding mode as an unpredictable cycle", async () => {
    const storage = createStorageMock();
    const state = patchOnboardingStepTwoValues(createLoadedState(), {
      predictionMode: "facts_only",
    });

    const result = await finishOnboarding(storage, state);

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        stepTwoValues: expect.objectContaining({
          predictionMode: "facts_only",
        }),
      }),
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        irregularCycle: false,
        unpredictableCycle: true,
      }),
    );
  });

  it("finishes resumed step 2 onboarding from the selected date even if the record is stale", async () => {
    const storage = createStorageMock();
    const state = createLoadedState({
      record: {
        lastPeriodStart: null,
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
      },
      selectedDate: "2026-03-17",
      step: 2,
    });

    const result = await finishOnboarding(storage, state);

    expect(result).toEqual({
      ok: true,
      state: expect.objectContaining({
        selectedDate: "2026-03-17",
        record: expect.objectContaining({
          lastPeriodStart: "2026-03-17",
        }),
      }),
    });
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPeriodStart: "2026-03-17",
      }),
    );
  });

  it("logs the labeled finish error in development when onboarding completion fails", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const writeError = new Error("sqlite/writeProfileRecord/upsert: boom");
    const storage = createStorageMock({
      writeProfileRecord: jest.fn().mockRejectedValue(writeError),
    });

    const result = await finishOnboarding(storage, createLoadedState());

    expect(result).toEqual({
      ok: false,
      errorCode: "generic",
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "onboarding/finishOnboarding",
      writeError,
    );

    consoleErrorSpy.mockRestore();
  });

  it("defaults incomplete relaunches to step 1 when legacy bootstrap state has no persisted step", async () => {
    const storage = createStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: null,
      }),
      readOnboardingRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-03-17",
        cycleLength: 30,
        periodLength: 4,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
      }),
    });

    await expect(loadOnboardingScreenState(storage)).resolves.toEqual(
      expect.objectContaining({
        kind: "ready",
        state: expect.objectContaining({
          selectedDate: "2026-03-17",
          step: 1,
        }),
      }),
    );
  });

  it("persists a return to step 1 after backing out of step 2", async () => {
    const storage = createStorageMock({
      readBootstrapState: jest.fn().mockResolvedValue({
        hasCompletedOnboarding: false,
        profileVersion: 2,
        incompleteOnboardingStep: 2,
      }),
    });

    await expect(persistIncompleteOnboardingStep(storage, 1)).resolves.toEqual({
      ok: true,
    });
    expect(storage.writeBootstrapState).toHaveBeenCalledWith({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 1,
    });
  });
});

function createStorageMock(overrides = {}) {
  return createLocalAppStorageMock({
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 1,
    }),
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
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    readDayLogRecord: jest
      .fn()
      .mockImplementation(async (date: string) => createEmptyDayLogRecord(date)),
    ...overrides,
  });
}
