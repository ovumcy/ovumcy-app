import type {
  OnboardingRecord,
  OnboardingStep,
  OnboardingStepTwoValues,
} from "../models/onboarding";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { resolvePredictionModeFlags } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { buildInitialBootstrapState } from "./app-bootstrap-service";
import {
  applyOnboardingRecordToProfile,
  createStepTwoDefaults,
  sanitizeStepTwoValues,
  validateStepOneStartDate,
} from "./onboarding-policy";

export type LoadedOnboardingState = {
  record: OnboardingRecord;
  step: OnboardingStep;
  selectedDate: string;
  stepTwoValues: OnboardingStepTwoValues;
};

export type LoadOnboardingScreenResult =
  | {
      kind: "completed";
    }
  | {
      kind: "ready";
      profile: ProfileRecord;
      state: LoadedOnboardingState;
    };

function buildLoadedOnboardingState(
  record: OnboardingRecord,
  step: OnboardingStep,
): LoadedOnboardingState {

  return {
    record,
    step,
    selectedDate: record.lastPeriodStart ?? "",
    stepTwoValues: createStepTwoDefaults(record),
  };
}

export function createFreshOnboardingScreenState(): {
  profile: ProfileRecord;
  state: LoadedOnboardingState;
} {
  const profile = createDefaultProfileRecord();

  return {
    profile,
    state: buildLoadedOnboardingState({
      lastPeriodStart: profile.lastPeriodStart,
      cycleLength: profile.cycleLength,
      periodLength: profile.periodLength,
      autoPeriodFill: profile.autoPeriodFill,
      irregularCycle: profile.irregularCycle,
      unpredictableCycle: profile.unpredictableCycle,
      ageGroup: profile.ageGroup,
      usageGoal: profile.usageGoal,
    }, buildInitialBootstrapState().incompleteOnboardingStep ?? 1),
  };
}

type SaveStepOneErrorCode =
  | "date_required"
  | "invalid_last_period_start"
  | "last_period_range"
  | "generic";

type FinishOnboardingErrorCode = "date_required" | "generic";

export async function loadOnboardingScreenState(
  storage: LocalAppStorage,
): Promise<LoadOnboardingScreenResult> {
  const [bootstrapState, onboardingRecord, profile] = await Promise.all([
    storage.readBootstrapState(),
    storage.readOnboardingRecord(),
    storage.readProfileRecord(),
  ]);

  if (bootstrapState.hasCompletedOnboarding) {
    return { kind: "completed" };
  }

  return {
    kind: "ready",
    profile,
    state: buildLoadedOnboardingState(
      onboardingRecord,
      bootstrapState.incompleteOnboardingStep ?? 1,
    ),
  };
}

export async function saveOnboardingStepOne(
  storage: LocalAppStorage,
  state: LoadedOnboardingState,
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedOnboardingState;
    }
  | {
      ok: false;
      errorCode: SaveStepOneErrorCode;
    }
> {
  const errorCode = validateStepOneStartDate(state.selectedDate, now);
  if (errorCode) {
    return {
      ok: false,
      errorCode,
    };
  }

  const nextRecord: OnboardingRecord = {
    ...state.record,
    lastPeriodStart: state.selectedDate,
  };

  try {
    const bootstrapState = await storage.readBootstrapState();
    await Promise.all([
      storage.writeOnboardingRecord(nextRecord),
      storage.writeBootstrapState({
        ...bootstrapState,
        hasCompletedOnboarding: false,
        incompleteOnboardingStep: 2,
      }),
    ]);
  } catch (error) {
    if (__DEV__) {
      console.error("onboarding/saveOnboardingStepOne", error);
    }
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      record: nextRecord,
      step: 2,
    },
  };
}

export async function finishOnboarding(
  storage: LocalAppStorage,
  state: LoadedOnboardingState,
): Promise<
  | {
      ok: true;
      state: LoadedOnboardingState;
    }
  | {
      ok: false;
      errorCode: FinishOnboardingErrorCode;
    }
> {
  const completedLastPeriodStart =
    state.selectedDate.trim().length > 0
      ? state.selectedDate.trim()
      : state.record.lastPeriodStart;

  if (!completedLastPeriodStart) {
    return {
      ok: false,
      errorCode: "date_required",
    };
  }

  const sanitizedValues = sanitizeStepTwoValues(state.stepTwoValues);
  const predictionModeFlags = resolvePredictionModeFlags(
    sanitizedValues.predictionMode,
  );
  const completedRecord: OnboardingRecord = {
    ...state.record,
    lastPeriodStart: completedLastPeriodStart,
    cycleLength: sanitizedValues.cycleLength,
    periodLength: sanitizedValues.periodLength,
    autoPeriodFill: sanitizedValues.autoPeriodFill,
    ...predictionModeFlags,
    ageGroup: sanitizedValues.ageGroup,
    usageGoal: sanitizedValues.usageGoal,
  };

  try {
    const currentProfile = await storage.readProfileRecord();
    await Promise.all([
      storage.writeProfileRecord(
        applyOnboardingRecordToProfile(currentProfile, completedRecord),
      ),
      storage.writeBootstrapState({
        ...buildInitialBootstrapState(),
        hasCompletedOnboarding: true,
        incompleteOnboardingStep: null,
      }),
    ]);
  } catch (error) {
    if (__DEV__) {
      console.error("onboarding/finishOnboarding", error);
    }
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      record: completedRecord,
      selectedDate: completedLastPeriodStart,
      stepTwoValues: sanitizedValues,
    },
  };
}

export async function persistIncompleteOnboardingStep(
  storage: LocalAppStorage,
  step: OnboardingStep,
): Promise<
  | {
      ok: true;
    }
  | {
      ok: false;
    }
> {
  try {
    const bootstrapState = await storage.readBootstrapState();
    await storage.writeBootstrapState({
      ...bootstrapState,
      hasCompletedOnboarding: false,
      incompleteOnboardingStep: step,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function patchOnboardingStepTwoValues(
  state: LoadedOnboardingState,
  patch: Partial<OnboardingStepTwoValues>,
): LoadedOnboardingState {
  return {
    ...state,
    stepTwoValues: sanitizeStepTwoValues({
      ...state.stepTwoValues,
      ...patch,
    }),
  };
}
