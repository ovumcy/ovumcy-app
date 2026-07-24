import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import {
  EPDS_ITEM_COUNT,
  createScreeningResponse,
} from "../../../models/screening";
import { appStorage } from "../../../services/app-bootstrap-service";
import {
  formatLocalDate,
  sanitizeCrisisContactValues,
} from "../../../services/profile-settings-policy";
import {
  buildScreeningHistoryViewData,
  buildScreeningQuestionnaireViewData,
  buildScreeningResultViewData,
  scoreScreening,
  type ScreeningHistoryViewData,
  type ScreeningScore,
} from "../../../services/screening-service";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import { ScreeningFlowScreen, type ScreeningStage } from "./ScreeningFlowScreen";

export type ScreeningScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
  // "questionnaire" opens the intro -> questions -> result flow (dashboard offer
  // card). "history" opens the read-only past-check-ins list (the dashboard
  // "Last check-in" row). Transport-only param, tolerated missing.
  initialView?: "questionnaire" | "history";
};

// Index lookup for the one-question-per-step flow. The null fallback is the
// contract for an out-of-range index; the stepper's own clamping keeps the
// index in range, so the fallback is exercised directly rather than through
// the screen.
export function questionAtIndex<T>(questions: readonly T[], index: number): T | null {
  return questions[index] ?? null;
}

export function ScreeningScreen({
  storage = appStorage,
  now,
  initialView = "questionnaire",
}: ScreeningScreenProps) {
  const router = useRouter();
  const { language } = useAppPreferences();
  const [effectiveNow] = useState(() => now ?? new Date());

  const questionnaire = useMemo(
    () => buildScreeningQuestionnaireViewData(language),
    [language],
  );

  const [stage, setStage] = useState<ScreeningStage>(
    initialView === "history" ? "history" : "intro",
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  // One slot per EPDS item; null until the owner picks an option. Kept ONLY in
  // component state and never persisted until finish — a partially answered,
  // then abandoned, mental-health questionnaire must never leave a stored trace.
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    new Array<number | null>(EPDS_ITEM_COUNT).fill(null),
  );
  const [screeningScore, setScreeningScore] = useState<ScreeningScore | null>(
    null,
  );
  // The owner's personal crisis contact, loaded once from the profile so the
  // CrisisSupportCard can show it and prefill its edit fields. Held in local
  // state (not routed/logged) and updated in place after an inline save.
  const [crisisContact, setCrisisContact] = useState<{
    name: string;
    phone: string;
  }>({ name: "", phone: "" });
  const [history, setHistory] = useState<ScreeningHistoryViewData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      const profile = await storage.readProfileRecord();
      if (isMounted) {
        setCrisisContact({
          name: profile.crisisContactName ?? "",
          phone: profile.crisisContactPhone ?? "",
        });
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [storage]);

  // Result view-data is derived (not stored) so an inline crisis-contact edit
  // re-renders the card with the new contact. The self-harm guidance shows the
  // moment `screeningScore` is set on finish — before the persist completes.
  const result = useMemo(
    () =>
      screeningScore
        ? buildScreeningResultViewData(screeningScore, language, crisisContact)
        : null,
    [screeningScore, language, crisisContact],
  );

  // Load past responses only for the history view (date + score only surface).
  useEffect(() => {
    if (stage !== "history") {
      return;
    }
    let isMounted = true;
    void (async () => {
      const responses = await storage.listScreeningResponses();
      if (isMounted) {
        setHistory(buildScreeningHistoryViewData(responses, language));
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [stage, storage, language]);

  const totalQuestions = questionnaire.questions.length;
  const currentQuestion = questionAtIndex(questionnaire.questions, questionIndex);
  const selectedValue = questionAtIndex(answers, questionIndex);

  function handleBegin() {
    setQuestionIndex(0);
    setStage("questions");
  }

  function handleSelectOption(value: number) {
    setAnswers((current) => {
      const next = [...current];
      next[questionIndex] = value;
      return next;
    });
  }

  function handleNext() {
    if (selectedValue === null) {
      return;
    }
    setQuestionIndex((index) => Math.min(index + 1, totalQuestions - 1));
  }

  function handleBack() {
    // Back on the first question returns to intro and discards silently — no
    // partial save (comment mirrored from the state: partial mental-health
    // answers must never persist). Back mid-questionnaire steps one question.
    if (questionIndex === 0) {
      setAnswers(new Array<number | null>(EPDS_ITEM_COUNT).fill(null));
      setStage("intro");
      return;
    }
    setQuestionIndex((index) => Math.max(index - 1, 0));
  }

  async function handleFinish() {
    // Every item must be answered before finishing (the Next gate enforces this
    // stepwise; this is the defensive backstop).
    const finalAnswers = answers.map((value) => value ?? -1);
    if (finalAnswers.some((value) => value < 0)) {
      return;
    }

    // Compute + show the result FIRST so the crisis-support guidance is never
    // gated on a successful write, then persist. answers/score reach storage
    // only here — on an explicit finish.
    const score = scoreScreening(finalAnswers);
    setScreeningScore(score);
    setSaveFailed(false);
    setStage("result");

    setIsSaving(true);
    try {
      const response = createScreeningResponse({
        date: formatLocalDate(effectiveNow),
        answers: finalAnswers,
      });
      await storage.writeScreeningResponse(response);
    } catch {
      setSaveFailed(true);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveCrisisContact(contact: {
    name: string;
    phone: string;
  }) {
    // Merge only the two crisis fields onto the latest profile (never clobber
    // other settings), normalized in the policy layer. Update local state so the
    // card re-renders with the saved contact. No premium/plan read anywhere here.
    const sanitized = sanitizeCrisisContactValues(contact);
    const current = await storage.readProfileRecord();
    await storage.writeProfileRecord({ ...current, ...sanitized });
    setCrisisContact({
      name: sanitized.crisisContactName,
      phone: sanitized.crisisContactPhone,
    });
  }

  function handleDone() {
    router.replace("/(tabs)/dashboard");
  }

  function handleCloseHistory() {
    router.back();
  }

  return (
    <ScreeningFlowScreen
      stage={stage}
      questionnaire={questionnaire}
      question={currentQuestion}
      questionNumber={questionIndex + 1}
      totalQuestions={totalQuestions}
      progressLabel={questionnaire.flow.progress(
        questionIndex + 1,
        totalQuestions,
      )}
      selectedValue={selectedValue}
      result={result}
      history={history}
      screenTitle={questionnaire.intro.title}
      isSaving={isSaving}
      saveError={saveFailed && result ? result.saveError : ""}
      onBegin={handleBegin}
      onSelectOption={handleSelectOption}
      onBack={handleBack}
      onNext={handleNext}
      onFinish={handleFinish}
      onDone={handleDone}
      onCloseHistory={handleCloseHistory}
      onSaveCrisisContact={handleSaveCrisisContact}
    />
  );
}
