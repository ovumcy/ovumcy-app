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
      ageGroup: "under_40",
      usageGoal: record.usageGoal,
    },
    ...overrides,
  };
}

describe("seedOnboardingPeriodDays (via finishOnboarding)", () => {
  it("seeds exactly periodLength day records when autoPeriodFill=true and all days are in the past", async () => {
    // lastPeriodStart 10 days ago, periodLength 5 → days at offsets 0..4
    const now = new Date(2026, 5, 13); // 2026-06-13
    const lastPeriodStart = "2026-06-03"; // 10 days ago

    const writeDayLogRecord = jest.fn().mockResolvedValue(undefined);
    const storage = createStorageMock({
      readDayLogRecord: jest
        .fn()
        .mockImplementation(async (date: string) => createEmptyDayLogRecord(date)),
      writeDayLogRecord,
    });

    const state = createLoadedState({
      selectedDate: lastPeriodStart,
      record: {
        lastPeriodStart,
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
      },
      stepTwoValues: {
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        predictionMode: "regular",
        ageGroup: "under_40",
        usageGoal: "health",
      },
    });

    const result = await finishOnboarding(storage, state, now);

    expect(result.ok).toBe(true);

    // Exactly 5 day records written
    expect(writeDayLogRecord).toHaveBeenCalledTimes(5);

    const writtenDates = writeDayLogRecord.mock.calls.map(
      ([record]: [{ date: string; isPeriod: boolean; cycleStart: boolean }]) => record.date,
    );
    expect(writtenDates).toEqual([
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ]);

    // All have isPeriod=true
    for (const [record] of writeDayLogRecord.mock.calls as [{ isPeriod: boolean; cycleStart: boolean }][]) {
      expect(record.isPeriod).toBe(true);
    }

    // cycleStart is false on all seeded days (mirrors web: CompleteOnboarding never sets CycleStart)
    for (const [record] of writeDayLogRecord.mock.calls as [{ cycleStart: boolean }][]) {
      expect(record.cycleStart).toBe(false);
    }
  });

  it("writes no day records when autoPeriodFill=false", async () => {
    const now = new Date(2026, 5, 13);
    const writeDayLogRecord = jest.fn().mockResolvedValue(undefined);
    const storage = createStorageMock({ writeDayLogRecord });

    const state = createLoadedState({
      selectedDate: "2026-06-03",
      record: {
        lastPeriodStart: "2026-06-03",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: false,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
      },
      stepTwoValues: {
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: false,
        predictionMode: "regular",
        ageGroup: "under_40",
        usageGoal: "health",
      },
    });

    const result = await finishOnboarding(storage, state, now);

    expect(result.ok).toBe(true);
    expect(writeDayLogRecord).not.toHaveBeenCalled();
  });

  it("clamps future days: yesterday start + periodLength 5 seeds only days up to today", async () => {
    // lastPeriodStart = yesterday (2026-06-12), periodLength 5
    // Days 0..1 are today/yesterday (observable); days 2..4 are future → clamped
    const now = new Date(2026, 5, 13); // 2026-06-13
    const lastPeriodStart = "2026-06-12"; // yesterday

    const writeDayLogRecord = jest.fn().mockResolvedValue(undefined);
    const storage = createStorageMock({
      readDayLogRecord: jest
        .fn()
        .mockImplementation(async (date: string) => createEmptyDayLogRecord(date)),
      writeDayLogRecord,
    });

    const state = createLoadedState({
      selectedDate: lastPeriodStart,
      record: {
        lastPeriodStart,
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
      },
      stepTwoValues: {
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        predictionMode: "regular",
        ageGroup: "under_40",
        usageGoal: "health",
      },
    });

    const result = await finishOnboarding(storage, state, now);

    expect(result.ok).toBe(true);

    // Only 2 days seeded: 2026-06-12 (yesterday) and 2026-06-13 (today)
    expect(writeDayLogRecord).toHaveBeenCalledTimes(2);
    const writtenDates = writeDayLogRecord.mock.calls.map(
      ([record]: [{ date: string }]) => record.date,
    );
    expect(writtenDates).toEqual(["2026-06-12", "2026-06-13"]);
  });

  it("does not clobber an existing day record that already has data (upsert merges)", async () => {
    // Day 2026-06-03 already has notes and a mood score; seeding should preserve them
    const now = new Date(2026, 5, 13);
    const lastPeriodStart = "2026-06-03";

    const existingRecord = {
      ...createEmptyDayLogRecord("2026-06-03"),
      notes: "existing note",
      mood: 3,
      isPeriod: false,
    };

    const writeDayLogRecord = jest.fn().mockResolvedValue(undefined);
    const storage = createStorageMock({
      readDayLogRecord: jest.fn().mockImplementation(async (date: string) => {
        if (date === "2026-06-03") {
          return existingRecord;
        }
        return createEmptyDayLogRecord(date);
      }),
      writeDayLogRecord,
    });

    const state = createLoadedState({
      selectedDate: lastPeriodStart,
      record: {
        lastPeriodStart,
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
      },
      stepTwoValues: {
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        predictionMode: "regular",
        ageGroup: "under_40",
        usageGoal: "health",
      },
    });

    await finishOnboarding(storage, state, now);

    // Find the write call for the existing record date
    const callForExistingDate = writeDayLogRecord.mock.calls.find(
      ([record]: [{ date: string }]) => record.date === "2026-06-03",
    );
    expect(callForExistingDate).toBeDefined();
    const [writtenRecord] = callForExistingDate as [
      { date: string; isPeriod: boolean; notes: string; mood: number },
    ];

    // isPeriod upgraded to true
    expect(writtenRecord.isPeriod).toBe(true);
    // Original user data preserved
    expect(writtenRecord.notes).toBe("existing note");
    expect(writtenRecord.mood).toBe(3);
  });
});

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

  it("returns a generic save-step-one error when step 1 persistence fails", async () => {
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
  });

  it("rejects incompatible step 2 values before persisting onboarding completion", async () => {
    const storage = createStorageMock();
    const state = patchOnboardingStepTwoValues(
      createLoadedState(),
      { cycleLength: 21, periodLength: 30 },
    );

    const result = await finishOnboarding(storage, state);

    expect(result).toEqual({
      ok: false,
      errorCode: "invalid_cycle_settings",
    });
    expect(storage.writeBootstrapState).not.toHaveBeenCalled();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
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

  it("returns a generic finish error when onboarding completion fails", async () => {
    const writeError = new Error("sqlite/writeProfileRecord/upsert: boom");
    const storage = createStorageMock({
      writeProfileRecord: jest.fn().mockRejectedValue(writeError),
    });

    const result = await finishOnboarding(storage, createLoadedState());

    expect(result).toEqual({
      ok: false,
      errorCode: "generic",
    });
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
