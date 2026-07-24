import { StyleSheet, Text, View } from "react-native";

import type {
  ScreeningHistoryViewData,
  ScreeningQuestionViewData,
  ScreeningQuestionnaireViewData,
  ScreeningResultViewData,
} from "../../../services/screening-service";
import { AppButton } from "../../components/AppButton";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { CrisisSupportCard } from "../../components/CrisisSupportCard";
import { FeatureCard } from "../../components/FeatureCard";
import { PregnancyDisclaimer } from "../../components/PregnancyDisclaimer";
import { ScreenScaffold } from "../../components/ScreenScaffold";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

// Presentational EPDS screening flow. Fully driven by precomputed
// view-data + props (architecture invariant: no date parsing, no visibility
// derivation, no scoring here). Stages: intro -> one-question-per-step -> result;
// plus a standalone history list. When the self-harm flag is raised the result
// stage renders the shared CrisisSupportCard above the band copy — calm and
// visually distinct (not a red alarm), NEVER premium-gated (replaced
// the interim inline urgent-support block).

export type ScreeningStage = "intro" | "questions" | "result" | "history";

export type ScreeningFlowScreenProps = {
  stage: ScreeningStage;
  questionnaire: ScreeningQuestionnaireViewData;
  // The current question when stage === "questions".
  question: ScreeningQuestionViewData | null;
  questionNumber: number;
  totalQuestions: number;
  progressLabel: string;
  // The selected option's score for the current question, or null when nothing
  // is chosen yet (Next/Finish stays disabled until an answer is picked).
  selectedValue: number | null;
  result: ScreeningResultViewData | null;
  history: ScreeningHistoryViewData | null;
  screenTitle: string;
  isSaving: boolean;
  saveError: string;
  onBegin: () => void;
  onSelectOption: (value: number) => void;
  onBack: () => void;
  onNext: () => void;
  onFinish: () => void | Promise<void>;
  onDone: () => void;
  onCloseHistory: () => void;
  // Persists an inline crisis-contact edit through the profile-update path.
  onSaveCrisisContact: (contact: { name: string; phone: string }) => void | Promise<void>;
};

export function ScreeningFlowScreen({
  stage,
  questionnaire,
  question,
  questionNumber,
  totalQuestions,
  progressLabel,
  selectedValue,
  result,
  history,
  screenTitle,
  isSaving,
  saveError,
  onBegin,
  onSelectOption,
  onBack,
  onNext,
  onFinish,
  onDone,
  onCloseHistory,
  onSaveCrisisContact,
}: ScreeningFlowScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { intro, disclaimer } = questionnaire;

  if (stage === "history") {
    return (
      <ScreenScaffold description={""} title={history?.title ?? screenTitle}>
        <FeatureCard testID="screening-history-card" title={history?.title ?? ""}>
          {history && history.hasEntries ? (
            <View style={styles.historyList}>
              {history.rows.map((row) => (
                <View
                  key={row.id}
                  style={styles.historyRow}
                  testID={`screening-history-row-${row.id}`}
                >
                  <Text style={styles.historyRowText}>{row.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.mutedText} testID="screening-history-empty">
              {history?.empty ?? ""}
            </Text>
          )}
          <View style={styles.actionsRow}>
            <AppButton
              label={history?.backCta ?? ""}
              onPress={onCloseHistory}
              testID="screening-history-back-button"
              variant="secondary"
            />
          </View>
        </FeatureCard>
      </ScreenScaffold>
    );
  }

  if (stage === "result" && result) {
    return (
      <ScreenScaffold description={""} title={result.title}>
        {result.crisisSupport ? (
          // Item-10 override: the shared crisis-support block, calm and visually
          // distinct at the top, NOT a red alarm. NEVER premium-gated. It
          // renders BEFORE the finish-time persist completes (see ScreeningScreen)
          // so safety guidance never depends on a successful write.
          <CrisisSupportCard
            onSaveContact={onSaveCrisisContact}
            testID="screening-crisis-support"
            viewData={result.crisisSupport}
          />
        ) : null}

        <FeatureCard testID="screening-result-card" title={result.bandTitle}>
          <Text style={styles.scoreCaption} testID="screening-score-caption">
            {result.scoreCaption}
          </Text>
          <Text style={styles.bodyText} testID="screening-band-body">
            {result.bandBody}
          </Text>
          {saveError ? (
            <StatusBanner
              message={saveError}
              testID="screening-save-error"
              tone="error"
            />
          ) : null}
          <View style={styles.actionsRow}>
            <AppButton
              label={result.doneCta}
              onPress={onDone}
              testID="screening-done-button"
            />
          </View>
        </FeatureCard>

        <PregnancyDisclaimer
          testID="screening-result-disclaimer"
          text={result.disclaimer}
        />
      </ScreenScaffold>
    );
  }

  if (stage === "questions" && question) {
    return (
      <ScreenScaffold
        description={intro.instruction}
        eyebrow={progressLabel}
        title={screenTitle}
      >
        <FeatureCard testID="screening-question-card" title={question.question}>
          <ChoiceGroup<number>
            groupLabel={question.question}
            onSelect={onSelectOption}
            options={question.options.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            selectedValue={selectedValue ?? undefined}
            testIDPrefix="screening-option"
          />
          <View style={styles.actionsRow}>
            <AppButton
              label={questionnaire.flow.back}
              onPress={onBack}
              testID="screening-back-button"
              variant="secondary"
            />
            {questionNumber < totalQuestions ? (
              <AppButton
                disabled={selectedValue === null}
                label={questionnaire.flow.next}
                onPress={onNext}
                testID="screening-next-button"
              />
            ) : (
              <AppButton
                disabled={selectedValue === null || isSaving}
                label={questionnaire.flow.next}
                onPress={onFinish}
                testID="screening-finish-button"
              />
            )}
          </View>
        </FeatureCard>
        <PregnancyDisclaimer
          testID="screening-question-disclaimer"
          text={disclaimer}
        />
      </ScreenScaffold>
    );
  }

  // Default: intro stage.
  return (
    <ScreenScaffold description={intro.body} title={intro.title}>
      <FeatureCard testID="screening-intro-card" title={intro.title}>
        <Text style={styles.bodyText}>{intro.instruction}</Text>
        <Text style={styles.privacyNote} testID="screening-privacy-note">
          {intro.privacyNote}
        </Text>
        <Text style={styles.attribution} testID="screening-attribution">
          {intro.attribution}
        </Text>
        <View style={styles.actionsRow}>
          <AppButton
            label={intro.startCta}
            onPress={onBegin}
            testID="screening-begin-button"
          />
        </View>
      </FeatureCard>
      <PregnancyDisclaimer
        testID="screening-intro-disclaimer"
        text={disclaimer}
      />
    </ScreenScaffold>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    bodyText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    privacyNote: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    attribution: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    scoreCaption: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    mutedText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    historyList: {
      gap: spacing.xs,
    },
    historyRow: {
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    historyRowText: {
      color: colors.text,
      fontSize: 15,
    },
    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "flex-end",
      marginTop: spacing.xs,
    },
  });
