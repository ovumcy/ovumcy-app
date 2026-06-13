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
  buildCycleGuidanceState,
  sanitizeStepTwoValues,
  validateStepOneStartDate,
  addDays,
  formatLocalDate,
  parseLocalDate,
} from "./onboarding-policy";
import { sanitizeDayLogRecord } from "./day-log-policy";

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

type FinishOnboardingErrorCode =
  | "date_required"
  | "invalid_cycle_settings"
  | "generic";

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
  now: Date = new Date(),
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
  if (
    buildCycleGuidanceState(
      sanitizedValues.cycleLength,
      sanitizedValues.periodLength,
    ).invalid
  ) {
    return {
      ok: false,
      errorCode: "invalid_cycle_settings",
    };
  }
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

    if (completedRecord.autoPeriodFill && completedRecord.lastPeriodStart) {
      await seedOnboardingPeriodDays(
        storage,
        completedRecord.lastPeriodStart,
        completedRecord.periodLength,
        now,
      );
    }
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
      selectedDate: completedLastPeriodStart,
      stepTwoValues: sanitizedValues,
    },
  };
}

/**
 * Seeds period day-log records for the onboarding window.
 *
 * Mirrors web's CompleteOnboarding upsert semantics: existing records are merged
 * (isPeriod=true, flow preserved as "none") rather than skipped.
 *
 * Deliberate deviation from web: days after today are NOT seeded. Web seeds the
 * full periodLength window unconditionally, but the app invariant ("future period
 * days remain predictions") takes priority.
 *
 * cycleStart is NOT set on any seeded day (including the anchor) — web's
 * CompleteOnboarding never sets CycleStart on the seeded rows.
 */
async function seedOnboardingPeriodDays(
  storage: LocalAppStorage,
  lastPeriodStart: string,
  periodLength: number,
  now: Date,
): Promise<void> {
  const anchor = parseLocalDate(lastPeriodStart);
  if (!anchor) {
    return;
  }

  const today = formatLocalDate(now);

  for (let offset = 0; offset < periodLength; offset += 1) {
    const date = formatLocalDate(addDays(anchor, offset));
    if (date > today) {
      // App invariant: future period days remain predictions, not observations.
      break;
    }

    const existing = await storage.readDayLogRecord(date);
    const merged = sanitizeDayLogRecord({
      ...existing,
      date,
      isPeriod: true,
      // cycleStart intentionally not set — mirrors web's CompleteOnboarding,
      // which never sets CycleStart on seeded rows.
      cycleStart: false,
    });
    await storage.writeDayLogRecord(merged);
  }
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
