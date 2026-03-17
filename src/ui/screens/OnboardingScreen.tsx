import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { buildCycleGuidanceState } from "../../services/onboarding-policy";
import {
  finishOnboarding,
  loadOnboardingScreenState,
  patchOnboardingStepTwoValues,
  saveOnboardingStepOne,
  type LoadedOnboardingState,
} from "../../services/onboarding-screen-service";
import { buildOnboardingViewData } from "../../services/onboarding-view-service";
import { appStorage } from "../../services/app-bootstrap-service";
import {
  OnboardingFlowScreen,
  OnboardingLoadingScreen,
} from "./OnboardingFlowScreen";

type OnboardingScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
  onFinished?: () => void;
};

export function OnboardingScreen({
  storage = appStorage,
  now = new Date(),
  onFinished,
}: OnboardingScreenProps) {
  const router = useRouter();
  const locale = useMemo(() => resolveLocale(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [state, setState] = useState<LoadedOnboardingState | null>(null);
  const [stepOneError, setStepOneError] = useState("");
  const [stepTwoError, setStepTwoError] = useState("");

  useEffect(() => {
    let isMounted = true;

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
      setIsLoading(false);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [onFinished, router, storage]);

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

  if (isLoading || !state || !viewData || !guidance) {
    return <OnboardingLoadingScreen />;
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
      now={now}
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
      onIrregularCycleChange={(value) => {
        setState((current) =>
          current
            ? patchOnboardingStepTwoValues(current, { irregularCycle: value })
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
      stepOneError={stepOneError}
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

function resolveLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || "en";
  } catch {
    return "en";
  }
}
