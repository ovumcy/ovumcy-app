import type {
  OnboardingRecord,
  OnboardingStep,
  OnboardingStepTwoValues,
} from "../models/onboarding";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { buildInitialBootstrapState } from "./app-bootstrap-service";
import {
  applyOnboardingRecordToProfile,
  createStepTwoDefaults,
  profileToOnboardingRecord,
  resolveOnboardingStep,
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
      state: LoadedOnboardingState;
    };

type SaveStepOneErrorCode =
  | "date_required"
  | "invalid_last_period_start"
  | "last_period_range"
  | "generic";

type FinishOnboardingErrorCode = "date_required" | "generic";

export async function loadOnboardingScreenState(
  storage: LocalAppStorage,
): Promise<LoadOnboardingScreenResult> {
  const [bootstrapState, profile] = await Promise.all([
    storage.readBootstrapState(),
    storage.readProfileRecord(),
  ]);
  const record = profileToOnboardingRecord(profile);

  if (bootstrapState.hasCompletedOnboarding) {
    return { kind: "completed" };
  }

  return {
    kind: "ready",
    state: {
      record,
      step: resolveOnboardingStep(record, false),
      selectedDate: record.lastPeriodStart ?? "",
      stepTwoValues: createStepTwoDefaults(record),
    },
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
    const profile = await storage.readProfileRecord();
    await storage.writeProfileRecord(
      applyOnboardingRecordToProfile(profile, nextRecord),
    );
  } catch {
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
  if (!state.record.lastPeriodStart) {
    return {
      ok: false,
      errorCode: "date_required",
    };
  }

  const sanitizedValues = sanitizeStepTwoValues(state.stepTwoValues);
  const completedRecord: OnboardingRecord = {
    ...state.record,
    cycleLength: sanitizedValues.cycleLength,
    periodLength: sanitizedValues.periodLength,
    autoPeriodFill: sanitizedValues.autoPeriodFill,
    irregularCycle: sanitizedValues.irregularCycle,
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
      }),
    ]);
  } catch {
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
      stepTwoValues: sanitizedValues,
    },
  };
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
