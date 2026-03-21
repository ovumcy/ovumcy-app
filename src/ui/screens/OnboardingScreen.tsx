import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PredictionMode, ProfileRecord } from "../../models/profile";
import {
  buildOnboardingDayOneNotice,
  dismissOnboardingDayOneNotice,
} from "../../services/onboarding-notice-service";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { buildCycleGuidanceState } from "../../services/onboarding-policy";
import {
  createFreshOnboardingScreenState,
  finishOnboarding,
  loadOnboardingScreenState,
  patchOnboardingStepTwoValues,
  persistIncompleteOnboardingStep,
  saveOnboardingStepOne,
  type LoadedOnboardingState,
} from "../../services/onboarding-screen-service";
import { buildOnboardingViewData } from "../../services/onboarding-view-service";
import { appStorage } from "../../services/app-bootstrap-service";
import { OnboardingFlowScreen } from "./OnboardingFlowScreen";
import { useAppPreferences } from "../providers/AppPreferencesProvider";

type OnboardingScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
  onFinished?: () => void;
  reloadKey?: string | string[] | undefined;
};

export function OnboardingScreen({
  storage = appStorage,
  now = new Date(),
  onFinished,
  reloadKey,
}: OnboardingScreenProps) {
  const router = useRouter();
  const { language: locale } = useAppPreferences();
  const initialFreshStateRef = useRef(createFreshOnboardingScreenState());
  const [isSaving, setIsSaving] = useState(false);
  const [state, setState] = useState<LoadedOnboardingState | null>(
    initialFreshStateRef.current.state,
  );
  const [profile, setProfile] = useState<ProfileRecord | null>(
    initialFreshStateRef.current.profile,
  );
  const [stepOneError, setStepOneError] = useState("");
  const [stepTwoError, setStepTwoError] = useState("");

  useEffect(() => {
    let isMounted = true;

    setIsSaving(false);
    setStepOneError("");
    setStepTwoError("");

    const freshState = createFreshOnboardingScreenState();
    setState(freshState.state);
    setProfile(freshState.profile);

    async function load() {
      const result = await loadOnboardingScreenState(storage);

      if (!isMounted) {
        return;
      }

      if (result.kind === "completed") {
        navigateToDashboard(router, onFinished);
        return;
      }

      setState(result.state);
      setProfile(result.profile);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [onFinished, reloadKey, router, storage]);

  const viewData = useMemo(() => {
    if (!state) {
      return null;
    }

    return buildOnboardingViewData(state.record, now, locale);
  }, [locale, now, state]);

  const guidance = useMemo(() => {
    if (!state) {
      return null;
    }

    return buildCycleGuidanceState(
      state.stepTwoValues.cycleLength,
      state.stepTwoValues.periodLength,
    );
  }, [state]);

  const stepOneNotice = useMemo(() => {
    if (!profile) {
      return null;
    }

    return buildOnboardingDayOneNotice(profile, locale);
  }, [locale, profile]);

  if (!state || !profile || !viewData || !guidance) {
    return null;
  }

  const readyState = state;
  const readyViewData = viewData;
  const readyGuidance = guidance;

  async function handleStepOneNext() {
    setIsSaving(true);
    setStepOneError("");

    const result = await saveOnboardingStepOne(storage, readyState, now);
    if (!result.ok) {
      setStepOneError(resolveStepOneError(result.errorCode, readyViewData));
      setIsSaving(false);
      return;
    }

    setState(result.state);
    setIsSaving(false);
  }

  async function handleFinish() {
    setIsSaving(true);
    setStepTwoError("");

    const result = await finishOnboarding(storage, readyState);
    if (!result.ok) {
      setStepTwoError(resolveStepTwoError(result.errorCode, readyViewData));
      setIsSaving(false);
      return;
    }

    setState(result.state);
    setIsSaving(false);
    navigateToDashboard(router, onFinished);
  }

  return (
    <OnboardingFlowScreen
      guidance={readyGuidance}
      isSaving={isSaving}
      locale={locale}
      onAutoPeriodFillChange={(value) => {
        setState((current) =>
          current
            ? patchOnboardingStepTwoValues(current, { autoPeriodFill: value })
            : current,
        );
      }}
      onAgeGroupSelect={(value) => {
        setState((current) =>
          current
            ? patchOnboardingStepTwoValues(current, { ageGroup: value })
            : current,
        );
      }}
      onBack={() => {
        setStepTwoError("");
        setState((current) => (current ? { ...current, step: 1 } : current));
        void persistIncompleteOnboardingStep(storage, 1).then((result) => {
          if (!result.ok) {
            setStepOneError(resolveStepOneError("generic", readyViewData));
          }
        });
      }}
      onCycleLengthChange={(value) => {
        setStepTwoError("");
        setState((current) =>
          current
            ? patchOnboardingStepTwoValues(current, {
                cycleLength: Math.round(value),
              })
            : current,
        );
      }}
      onDateSelected={(value) => {
        setStepOneError("");
        setState((current) =>
          current
            ? {
                ...current,
                selectedDate: value,
              }
            : current,
        );
      }}
      onFinish={handleFinish}
      onDismissStepOneNotice={async () => {
        const nextProfile = await dismissOnboardingDayOneNotice(storage, profile);
        setProfile(nextProfile);
      }}
      onDismissStepOneError={() => {
        setStepOneError("");
      }}
      onPredictionModeSelect={(value: PredictionMode) => {
        setState((current) =>
          current
            ? patchOnboardingStepTwoValues(current, { predictionMode: value })
            : current,
        );
      }}
      onNext={handleStepOneNext}
      onPeriodLengthChange={(value) => {
        setStepTwoError("");
        setState((current) =>
          current
            ? patchOnboardingStepTwoValues(current, {
                periodLength: Math.round(value),
              })
            : current,
        );
      }}
      onUsageGoalSelect={(value) => {
        setState((current) =>
          current
            ? patchOnboardingStepTwoValues(current, { usageGoal: value })
            : current,
        );
      }}
      state={readyState}
      stepOneNotice={stepOneNotice}
      stepOneError={stepOneError}
      onDismissStepTwoError={() => {
        setStepTwoError("");
      }}
      stepTwoError={stepTwoError}
      viewData={readyViewData}
    />
  );
}

function resolveStepOneError(
  code: "date_required" | "invalid_last_period_start" | "last_period_range" | "generic",
  viewData: ReturnType<typeof buildOnboardingViewData>,
): string {
  switch (code) {
    case "date_required":
      return viewData.errors.dateRequired;
    case "invalid_last_period_start":
      return viewData.errors.invalidLastPeriodStart;
    case "last_period_range":
      return viewData.errors.lastPeriodRange;
    case "generic":
      return viewData.errors.generic;
  }
}

function resolveStepTwoError(
  code: "date_required" | "generic",
  viewData: ReturnType<typeof buildOnboardingViewData>,
): string {
  switch (code) {
    case "date_required":
      return viewData.errors.dateRequired;
    case "generic":
      return viewData.errors.generic;
  }
}

function navigateToDashboard(
  router: ReturnType<typeof useRouter>,
  onFinished?: () => void,
) {
  if (onFinished) {
    onFinished();
    return;
  }

  router.replace("/(tabs)/dashboard");
}
