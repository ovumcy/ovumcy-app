import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { getPostpartumCopy } from "../../../i18n/postpartum-copy";
import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import { getPregnancyEndCopy } from "../../../i18n/pregnancy-end-copy";
import { getScreeningCopy } from "../../../i18n/screening-copy";
import type {
  EddBasis,
  ModeOfDelivery,
  PregnancyEndReason,
} from "../../../models/pregnancy";
import type { PregnancyStartPreview } from "../../../services/pregnancy-mode-service";
import { AppButton } from "../../components/AppButton";
import { AppTextInput } from "../../components/AppTextInput";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FeatureCard } from "../../components/FeatureCard";
import { PregnancyDisclaimer } from "../../components/PregnancyDisclaimer";
import { ScreenScaffold } from "../../components/ScreenScaffold";
import { StatusBanner } from "../../components/StatusBanner";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

// The "skip" option maps to a null mode of delivery — an explicit, skippable
// third choice rather than a hidden default.
type ModeChoice = ModeOfDelivery | "skip";

// Re-dating never offers "lmp" (see updateEddForActivePregnancy's own
// comment) -- ultrasound or a manually entered clinician date only.
export type UpdateDueDateBasis = Exclude<EddBasis, "lmp">;

export type PregnancyEndFlowScreenProps = {
  language: string;
  status: "loading" | "ready";
  hasActivePregnancy: boolean;
  hasEndedRecords: boolean;
  // Whether the choice screen offers "I gave birth" at all (see
  // BIRTH_OPTION_MIN_WEEK / resolveBirthOptionVisible in
  // pregnancy-timeline-service.ts). Below the threshold only loss/other are
  // offered; the service function itself stays reason-agnostic.
  birthOptionVisible: boolean;
  // null => the reason has not been chosen yet (the choice screen, when a
  // pregnancy is active). "birth" | "loss" | "other" => that reason's step.
  reason: PregnancyEndReason | null;
  modeOfDelivery: ModeOfDelivery | null;
  // Multiples: true when the ACTIVE record's fetusCount >= 2, selects the
  // plural congratulations/mode-of-delivery-question copy on the birth step.
  // Loss and "other" copy is never plural-aware -- untouched.
  isMultiples: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  error: string;
  deleteError: string;
  onSelectReason: (reason: PregnancyEndReason) => void;
  onSelectModeOfDelivery: (mode: ModeOfDelivery | null) => void;
  // Confirm carries the step's reason with the press (the button only exists
  // inside a chosen reason's step), so the container never re-derives it from
  // state.
  onConfirmEnd: (reason: PregnancyEndReason) => void | Promise<void>;
  onBack: () => void;
  onCancel: () => void;
  onDeletePress: () => void | Promise<void>;
  // Update due date (clinician re-dating, X14): a non-destructive maintenance
  // action offered only while a pregnancy is active, above the end-reason
  // choices. `updateDueDateActive` toggles between the plain choice screen
  // and this single-step form; everything else mirrors the start wizard's
  // date-entry + live preview step (basis limited to ultrasound/manual).
  updateDueDateActive: boolean;
  updateDueDateBasis: UpdateDueDateBasis;
  updateDueDateValue: string;
  updateDueDatePreview: PregnancyStartPreview;
  updateDueDateError: string;
  isUpdatingDueDate: boolean;
  onUpdateDueDatePress: () => void;
  onUpdateDueDateBasisSelect: (value: UpdateDueDateBasis) => void;
  onUpdateDueDateChange: (value: string) => void;
  onConfirmUpdateDueDate: () => void | Promise<void>;
  onCancelUpdateDueDate: () => void;
  // Postpartum. `postpartumOfferActive` is the one-time after-birth offer
  // step, shown ONLY after a just-confirmed birth in this flow session (never
  // on a bare deep link) — it takes over the screen with Start / Not now.
  // The manage-state rows below appear only when there is no active pregnancy:
  // an active postpartum offers End + Delete; a recent ended-birth pregnancy
  // (within the delayed-start window, premium-gated) offers a delayed Start so
  // someone who declined can change her mind.
  postpartumOfferActive: boolean;
  hasActivePostpartum: boolean;
  hasPostpartumData: boolean;
  postpartumStartOfferVisible: boolean;
  isStartingPostpartum: boolean;
  isEndingPostpartum: boolean;
  isDeletingPostpartum: boolean;
  postpartumError: string;
  postpartumDeleteError: string;
  onStartPostpartum: () => void | Promise<void>;
  onDeclinePostpartum: () => void;
  onEndPostpartum: () => void | Promise<void>;
  onDeletePostpartum: () => void | Promise<void>;
  // Screening. A "Delete check-in data" danger row on the manage state,
  // shown only when at least one screening response exists. SEPARATE from the
  // postpartum delete — mental-health screening is its own sensitive class,
  // deleted only via its own explicit device-auth + confirm action.
  hasScreeningData: boolean;
  isDeletingScreening: boolean;
  screeningDeleteError: string;
  onDeleteScreening: () => void | Promise<void>;
};

export function PregnancyEndFlowScreen({
  language,
  status,
  hasActivePregnancy,
  hasEndedRecords,
  birthOptionVisible,
  reason,
  modeOfDelivery,
  isMultiples,
  isSaving,
  isDeleting,
  error,
  deleteError,
  onSelectReason,
  onSelectModeOfDelivery,
  onConfirmEnd,
  onBack,
  onCancel,
  onDeletePress,
  updateDueDateActive,
  updateDueDateBasis,
  updateDueDateValue,
  updateDueDatePreview,
  updateDueDateError,
  isUpdatingDueDate,
  onUpdateDueDatePress,
  onUpdateDueDateBasisSelect,
  onUpdateDueDateChange,
  onConfirmUpdateDueDate,
  onCancelUpdateDueDate,
  postpartumOfferActive,
  hasActivePostpartum,
  hasPostpartumData,
  postpartumStartOfferVisible,
  isStartingPostpartum,
  isEndingPostpartum,
  isDeletingPostpartum,
  postpartumError,
  postpartumDeleteError,
  onStartPostpartum,
  onDeclinePostpartum,
  onEndPostpartum,
  onDeletePostpartum,
  hasScreeningData,
  isDeletingScreening,
  screeningDeleteError,
  onDeleteScreening,
}: PregnancyEndFlowScreenProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppPreferences();
  const copy = getPregnancyEndCopy(language);
  const pregnancyCopy = getPregnancyCopy(language);
  const postpartumCopy = getPostpartumCopy(language);
  const screeningCopy = getScreeningCopy(language);
  const disclaimer = pregnancyCopy.disclaimer;

  if (status === "loading") {
    return (
      <ScreenScaffold
        description={copy.subtitle}
        eyebrow={copy.eyebrow}
        title={copy.title}
      >
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  // The hard-delete danger action is available while a pregnancy is active (on
  // the choice screen, below the fold and clearly separated) and as the primary
  // action of the management state when no pregnancy is active but ended
  // records remain.
  const deleteSection = (
    <FeatureCard testID="pregnancy-end-delete-card" title={copy.delete.title}>
      <Text style={styles.bodyText}>{copy.delete.body}</Text>
      {deleteError ? (
        <StatusBanner
          message={deleteError}
          testID="pregnancy-end-delete-error"
          tone="error"
        />
      ) : null}
      <AppButton
        disabled={isDeleting}
        label={copy.delete.cta}
        onPress={onDeletePress}
        testID="pregnancy-end-delete-button"
        variant="danger"
      />
    </FeatureCard>
  );

  // Postpartum hard-delete danger action, separate from the pregnancy
  // delete: its own device-auth + confirm flow, removing only postpartum data.
  const postpartumDeleteSection = (
    <FeatureCard
      testID="pregnancy-end-postpartum-delete-card"
      title={postpartumCopy.delete.title}
    >
      <Text style={styles.bodyText}>{postpartumCopy.delete.body}</Text>
      {postpartumDeleteError ? (
        <StatusBanner
          message={postpartumDeleteError}
          testID="pregnancy-end-postpartum-delete-error"
          tone="error"
        />
      ) : null}
      <AppButton
        disabled={isDeletingPostpartum}
        label={postpartumCopy.delete.cta}
        onPress={onDeletePostpartum}
        testID="pregnancy-end-postpartum-delete-button"
        variant="danger"
      />
    </FeatureCard>
  );

  // Screening hard-delete danger action, a SEPARATE row from the postpartum
  // delete: its own device-auth + confirm flow, removing only screening data.
  // Screening is a distinct sensitive class and is never deleted as a side
  // effect of the postpartum delete — explicit consent per class.
  const screeningDeleteSection = (
    <FeatureCard
      testID="pregnancy-end-screening-delete-card"
      title={screeningCopy.delete.title}
    >
      <Text style={styles.bodyText}>{screeningCopy.delete.body}</Text>
      {screeningDeleteError ? (
        <StatusBanner
          message={screeningDeleteError}
          testID="pregnancy-end-screening-delete-error"
          tone="error"
        />
      ) : null}
      <AppButton
        disabled={isDeletingScreening}
        label={screeningCopy.delete.cta}
        onPress={onDeleteScreening}
        testID="pregnancy-end-screening-delete-button"
        variant="danger"
      />
    </FeatureCard>
  );

  let content: ReactNode;

  if (postpartumOfferActive) {
    // One-time after-birth offer step: reached only from a just-confirmed birth
    // in this session, never a bare deep link. Gentle, opt-out-first.
    content = (
      <FeatureCard
        testID="pregnancy-end-postpartum-offer-card"
        title={postpartumCopy.offer.title}
      >
        <Text style={styles.bodyText}>{postpartumCopy.offer.body}</Text>
        {postpartumError ? (
          <StatusBanner
            message={postpartumError}
            testID="pregnancy-end-postpartum-offer-error"
            tone="error"
          />
        ) : null}
        <View style={styles.actionsRow}>
          <AppButton
            label={postpartumCopy.offer.notNowCta}
            onPress={onDeclinePostpartum}
            testID="pregnancy-end-postpartum-offer-decline"
            variant="secondary"
          />
          <AppButton
            disabled={isStartingPostpartum}
            label={postpartumCopy.offer.startCta}
            onPress={onStartPostpartum}
            testID="pregnancy-end-postpartum-offer-start"
          />
        </View>
      </FeatureCard>
    );
  } else if (!hasActivePregnancy) {
    // No active pregnancy: postpartum management (an active postpartum offers
    // End; a recent ended-birth offers a delayed Start) plus saved-pregnancy
    // management and the two independent delete danger actions. The empty
    // state shows only when there is truly nothing to manage.
    const hasAnyContent =
      hasEndedRecords ||
      hasActivePostpartum ||
      hasPostpartumData ||
      hasScreeningData ||
      postpartumStartOfferVisible;

    content = (
      <>
        {hasActivePostpartum ? (
          <FeatureCard
            testID="pregnancy-end-postpartum-manage-card"
            title={postpartumCopy.manage.endRow}
          >
            <Text style={styles.bodyText}>{postpartumCopy.manage.endHint}</Text>
            {postpartumError ? (
              <StatusBanner
                message={postpartumError}
                testID="pregnancy-end-postpartum-error"
                tone="error"
              />
            ) : null}
            <View style={styles.actionsRow}>
              <AppButton
                disabled={isEndingPostpartum}
                label={postpartumCopy.manage.endRow}
                onPress={onEndPostpartum}
                testID="pregnancy-end-postpartum-end-button"
              />
            </View>
          </FeatureCard>
        ) : null}

        {!hasActivePostpartum && postpartumStartOfferVisible ? (
          <FeatureCard
            testID="pregnancy-end-postpartum-start-card"
            title={postpartumCopy.manage.startRow}
          >
            <Text style={styles.bodyText}>{postpartumCopy.manage.startHint}</Text>
            {postpartumError ? (
              <StatusBanner
                message={postpartumError}
                testID="pregnancy-end-postpartum-error"
                tone="error"
              />
            ) : null}
            <View style={styles.actionsRow}>
              <AppButton
                disabled={isStartingPostpartum}
                label={postpartumCopy.manage.startRow}
                onPress={onStartPostpartum}
                testID="pregnancy-end-postpartum-start-button"
              />
            </View>
          </FeatureCard>
        ) : null}

        {hasEndedRecords ? (
          <FeatureCard testID="pregnancy-end-manage-card" title={copy.manage.title}>
            <Text style={styles.bodyText}>{copy.manage.noActiveBody}</Text>
          </FeatureCard>
        ) : null}

        {!hasAnyContent ? (
          <FeatureCard testID="pregnancy-end-empty-card" title={copy.manage.title}>
            <Text style={styles.bodyText} testID="pregnancy-end-empty-body">
              {copy.manage.emptyBody}
            </Text>
          </FeatureCard>
        ) : null}

        {hasEndedRecords ? deleteSection : null}
        {hasPostpartumData ? postpartumDeleteSection : null}
        {hasScreeningData ? screeningDeleteSection : null}
        <BackAction label={copy.manage.backCta} onPress={onCancel} />
      </>
    );
  } else if (reason === null && updateDueDateActive) {
    // Update due date: a non-destructive, single-step form mirroring
    // the start wizard's date-entry + live W+D preview step (basis limited
    // to ultrasound/manual -- see UpdateDueDateBasis). Opened from the row
    // below and closed back to the choice screen without touching anything.
    const updateBasisHint =
      updateDueDateBasis === "ultrasound"
        ? pregnancyCopy.wizard.basisOptions.ultrasoundHint
        : pregnancyCopy.wizard.basisOptions.manualHint;

    content = (
      <FeatureCard
        testID="pregnancy-end-update-due-date-step"
        title={copy.updateDueDate.stepTitle}
      >
        <ChoiceGroup<UpdateDueDateBasis>
          groupLabel={copy.updateDueDate.stepTitle}
          onSelect={onUpdateDueDateBasisSelect}
          options={[
            {
              value: "ultrasound",
              label: pregnancyCopy.wizard.basisOptions.ultrasoundLabel,
            },
            {
              value: "manual",
              label: pregnancyCopy.wizard.basisOptions.manualLabel,
            },
          ]}
          selectedValue={updateDueDateBasis}
          testIDPrefix="pregnancy-end-update-due-date-basis"
        />
        <Text style={styles.helperText}>{updateBasisHint}</Text>

        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{pregnancyCopy.wizard.eddDateLabel}</Text>
          <AppTextInput
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={10}
            onChangeText={onUpdateDueDateChange}
            placeholder={pregnancyCopy.wizard.datePlaceholder}
            style={styles.dateInput}
            testID="pregnancy-end-update-due-date-input"
            value={updateDueDateValue}
          />
        </View>

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>{pregnancyCopy.wizard.previewTitle}</Text>
          {updateDueDatePreview.eddLabel ? (
            <>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>
                  {pregnancyCopy.wizard.previewEddLabel}
                </Text>
                <Text
                  style={styles.previewValue}
                  testID="pregnancy-end-update-due-date-preview-edd"
                >
                  {updateDueDatePreview.eddLabel}
                </Text>
              </View>
              {updateDueDatePreview.gaLabel ? (
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>
                    {pregnancyCopy.wizard.previewGaLabel}
                  </Text>
                  <Text
                    style={styles.previewValue}
                    testID="pregnancy-end-update-due-date-preview-ga"
                  >
                    {updateDueDatePreview.gaLabel}
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text
              style={styles.helperText}
              testID="pregnancy-end-update-due-date-preview-empty"
            >
              {pregnancyCopy.wizard.previewEmpty}
            </Text>
          )}
        </View>

        {updateDueDateError ? (
          <StatusBanner
            message={updateDueDateError}
            testID="pregnancy-end-update-due-date-error"
            tone="error"
          />
        ) : null}

        <View style={styles.actionsRow}>
          <AppButton
            label={pregnancyCopy.wizard.backCta}
            onPress={onCancelUpdateDueDate}
            testID="pregnancy-end-update-due-date-back-button"
            variant="secondary"
          />
          <AppButton
            disabled={isUpdatingDueDate}
            label={copy.updateDueDate.confirmCta}
            onPress={onConfirmUpdateDueDate}
            testID="pregnancy-end-update-due-date-confirm-button"
          />
        </View>
      </FeatureCard>
    );
  } else if (reason === null) {
    // Active pregnancy, reason not chosen yet: offer the paths, with the
    // hard-delete action separated below. "I gave birth" is only offered from
    // BIRTH_OPTION_MIN_WEEK onward (see resolveBirthOptionVisible) -- below
    // it, only loss/other are shown.
    const reasonOptions: {
      value: PregnancyEndReason;
      label: string;
      secondaryLabel?: string;
    }[] = [];
    if (birthOptionVisible) {
      reasonOptions.push({
        value: "birth",
        label: copy.choice.birthLabel,
        secondaryLabel: copy.choice.birthHint,
      });
    }
    reasonOptions.push(
      {
        value: "loss",
        label: copy.choice.lossLabel,
        secondaryLabel: copy.choice.lossHint,
      },
      {
        value: "other",
        label: copy.choice.otherLabel,
        secondaryLabel: copy.choice.otherHint,
      },
    );

    content = (
      <>
        {/* Update due date: maintenance, not an ending -- kept above
            and visually separated from the end-reason choices. */}
        <AppButton
          label={copy.updateDueDate.rowLabel}
          onPress={onUpdateDueDatePress}
          testID="pregnancy-end-update-due-date-row"
          variant="secondary"
        />
        <View style={styles.sectionSeparator} />
        <FeatureCard testID="pregnancy-end-choice-card" title={copy.choice.title}>
          <ChoiceGroup<PregnancyEndReason>
            groupLabel={copy.choice.title}
            onSelect={onSelectReason}
            options={reasonOptions}
            testIDPrefix="pregnancy-end-reason"
          />
          <View style={styles.actionsRow}>
            <AppButton
              label={copy.choice.backCta}
              onPress={onCancel}
              testID="pregnancy-end-choice-cancel-button"
              variant="secondary"
            />
          </View>
        </FeatureCard>
        <View style={styles.sectionSeparator} />
        {deleteSection}
      </>
    );
  } else if (reason === "birth") {
    const modeChoice: ModeChoice = modeOfDelivery ?? "skip";
    const congratulations = isMultiples
      ? copy.birth.congratulationsPlural
      : copy.birth.congratulations;
    const modeQuestion = isMultiples
      ? copy.birth.modeQuestionPlural
      : copy.birth.modeQuestion;
    content = (
      <FeatureCard testID="pregnancy-end-birth-card" title={copy.birth.title}>
        <Text style={styles.leadText} testID="pregnancy-end-birth-congratulations">
          {congratulations}
        </Text>
        <View style={styles.formGroup}>
          <Text style={styles.fieldLabel}>{modeQuestion}</Text>
          <Text style={styles.helperText}>{copy.birth.modeHint}</Text>
          <ChoiceGroup<ModeChoice>
            groupLabel={modeQuestion}
            layout="grid3"
            onSelect={(value) =>
              onSelectModeOfDelivery(value === "skip" ? null : value)
            }
            options={[
              { value: "vaginal", label: copy.birth.modeOptions.vaginal },
              { value: "cesarean", label: copy.birth.modeOptions.cesarean },
              { value: "skip", label: copy.birth.modeOptions.skip },
            ]}
            selectedValue={modeChoice}
            testIDPrefix="pregnancy-end-mode"
          />
        </View>
        {error ? (
          <StatusBanner
            message={error}
            testID="pregnancy-end-error"
            tone="error"
          />
        ) : null}
        <View style={styles.actionsRow}>
          <AppButton
            label={copy.birth.backCta}
            onPress={onBack}
            testID="pregnancy-end-back-button"
            variant="secondary"
          />
          <AppButton
            disabled={isSaving}
            label={copy.birth.confirmCta}
            onPress={() => onConfirmEnd("birth")}
            testID="pregnancy-end-confirm-button"
          />
        </View>
      </FeatureCard>
    );
  } else {
    // "loss" or "other": neutral, respectful copy; no mode-of-delivery question.
    const section = reason === "loss" ? copy.loss : copy.other;
    content = (
      <FeatureCard
        testID={`pregnancy-end-${reason}-card`}
        title={section.title}
      >
        <Text
          style={styles.leadText}
          testID="pregnancy-end-acknowledgment"
        >
          {section.acknowledgment}
        </Text>
        <Text style={styles.bodyText}>{section.body}</Text>
        {error ? (
          <StatusBanner
            message={error}
            testID="pregnancy-end-error"
            tone="error"
          />
        ) : null}
        <View style={styles.actionsRow}>
          <AppButton
            label={section.backCta}
            onPress={onBack}
            testID="pregnancy-end-back-button"
            variant="secondary"
          />
          <AppButton
            disabled={isSaving}
            label={section.confirmCta}
            onPress={() => onConfirmEnd(reason)}
            testID="pregnancy-end-confirm-button"
          />
        </View>
      </FeatureCard>
    );
  }

  return (
    <ScreenScaffold
      description={copy.subtitle}
      eyebrow={copy.eyebrow}
      title={copy.title}
    >
      {content}
      <PregnancyDisclaimer
        testID="pregnancy-end-disclaimer"
        text={disclaimer}
      />
    </ScreenScaffold>
  );
}

function BackAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.actionsRow}>
      <AppButton
        label={label}
        onPress={onPress}
        testID="pregnancy-end-back-button"
        variant="secondary"
      />
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    loadingBlock: {
      alignItems: "center",
      paddingVertical: 24,
    },
    leadText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 22,
    },
    bodyText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    formGroup: {
      gap: spacing.xs,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "flex-end",
      marginTop: spacing.xs,
    },
    // Generic hairline divider between sibling sections (the update-due-date
    // row, the reason choices, and the danger-zone delete card).
    sectionSeparator: {
      backgroundColor: colors.lineSoft,
      height: 1,
      marginVertical: spacing.xs,
    },
    dateInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      fontSize: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    previewCard: {
      backgroundColor: colors.surfaceTint,
      borderColor: colors.lineSoft,
      borderRadius: 14,
      borderWidth: 1,
      gap: spacing.xs,
      padding: 14,
    },
    previewTitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    previewRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    previewLabel: {
      color: colors.textMuted,
      flexShrink: 1,
      fontSize: 13,
    },
    previewValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      textAlign: "right",
    },
  });
