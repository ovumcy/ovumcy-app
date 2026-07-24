import { StyleSheet, Text, View } from "react-native";

import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import type { Chorionicity, EddBasis, FetusCount } from "../../../models/pregnancy";
import type { PregnancyStartPreview } from "../../../services/pregnancy-mode-service";
import { AppButton } from "../../components/AppButton";
import { AppTextInput } from "../../components/AppTextInput";
import { ChoiceGroup } from "../../components/ChoiceGroup";
import { FeatureCard } from "../../components/FeatureCard";
import { PregnancyDisclaimer } from "../../components/PregnancyDisclaimer";
import { PremiumLockCard } from "../../components/PremiumLockCard";
import { ScreenScaffold } from "../../components/ScreenScaffold";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

export type PregnancyStartFlowScreenProps = {
  language: string;
  locked: boolean;
  step: 1 | 2 | 3;
  basis: EddBasis;
  dateValue: string;
  preview: PregnancyStartPreview;
  error: string;
  isSaving: boolean;
  onBasisSelect: (value: EddBasis) => void;
  onDateChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  onPremiumCTAPress?: (() => void) | undefined;
  // Multiples(education-only; optional, skippable). `fetusCount`
  // undefined == "One" == singleton, identical to never touching this block
  // -- see PregnancyStartScreen's onFetusCountSelect. `chorionicity` is only
  // ever rendered once fetusCount is 2 or 3.
  fetusCount: FetusCount | undefined;
  chorionicity: Chorionicity | undefined;
  onFetusCountSelect: (value: FetusCount) => void;
  onChorionicitySelect: (value: Chorionicity) => void;
};

export function PregnancyStartFlowScreen({
  language,
  locked,
  step,
  basis,
  dateValue,
  preview,
  error,
  isSaving,
  onBasisSelect,
  onDateChange,
  onBack,
  onNext,
  onConfirm,
  onCancel,
  onPremiumCTAPress,
  fetusCount,
  chorionicity,
  onFetusCountSelect,
  onChorionicitySelect,
}: PregnancyStartFlowScreenProps) {
  const styles = useThemedStyles(createStyles);
  const copy = getPregnancyCopy(language);

  // Locked (deep-linked while the premium gate is closed): the shared lock card
  // is shown, never the form. The disclaimer still renders unconditionally.
  if (locked) {
    return (
      <ScreenScaffold
        description={copy.wizard.subtitle}
        eyebrow={copy.entryCard.eyebrow}
        title={copy.wizard.title}
      >
        <PremiumLockCard
          ctaLabel={onPremiumCTAPress ? copy.entryCard.lockedCta : undefined}
          description={copy.entryCard.lockedBody}
          eyebrowLabel={copy.entryCard.eyebrow}
          onPress={onPremiumCTAPress}
          testID="pregnancy-start-lock"
          title={copy.entryCard.lockedTitle}
        />
        <PregnancyDisclaimer
          testID="pregnancy-start-disclaimer"
          text={copy.disclaimer}
        />
      </ScreenScaffold>
    );
  }

  const basisHint =
    basis === "lmp"
      ? copy.wizard.basisOptions.lmpHint
      : basis === "ultrasound"
        ? copy.wizard.basisOptions.ultrasoundHint
        : copy.wizard.basisOptions.manualHint;
  const dateFieldLabel =
    basis === "lmp" ? copy.wizard.lmpDateLabel : copy.wizard.eddDateLabel;

  return (
    <ScreenScaffold
      description={copy.wizard.subtitle}
      eyebrow={copy.entryCard.eyebrow}
      title={copy.wizard.title}
    >
      {step === 1 ? (
        <FeatureCard
          testID="pregnancy-start-basis-step"
          title={copy.wizard.basisStepTitle}
        >
          <ChoiceGroup<EddBasis>
            groupLabel={copy.wizard.basisStepTitle}
            onSelect={onBasisSelect}
            options={[
              { value: "lmp", label: copy.wizard.basisOptions.lmpLabel },
              {
                value: "ultrasound",
                label: copy.wizard.basisOptions.ultrasoundLabel,
              },
              { value: "manual", label: copy.wizard.basisOptions.manualLabel },
            ]}
            selectedValue={basis}
            testIDPrefix="pregnancy-start-basis"
          />
          <Text style={styles.helperText}>{basisHint}</Text>
          <View style={styles.actionsRow}>
            <AppButton
              label={copy.wizard.cancelCta}
              onPress={onCancel}
              testID="pregnancy-start-cancel-button"
              variant="secondary"
            />
            <AppButton
              disabled={isSaving}
              label={copy.wizard.nextCta}
              onPress={onNext}
              testID="pregnancy-start-next-button"
            />
          </View>
        </FeatureCard>
      ) : null}

      {step === 2 ? (
        <FeatureCard
          testID="pregnancy-start-date-step"
          title={copy.wizard.dateStepTitle}
        >
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>{dateFieldLabel}</Text>
            <AppTextInput
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={10}
              onChangeText={onDateChange}
              placeholder={copy.wizard.datePlaceholder}
              style={styles.dateInput}
              testID="pregnancy-start-date-input"
              value={dateValue}
            />
          </View>

          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>{copy.wizard.previewTitle}</Text>
            {preview.eddLabel ? (
              <>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>
                    {copy.wizard.previewEddLabel}
                  </Text>
                  <Text
                    style={styles.previewValue}
                    testID="pregnancy-start-preview-edd"
                  >
                    {preview.eddLabel}
                  </Text>
                </View>
                {preview.gaLabel ? (
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>
                      {copy.wizard.previewGaLabel}
                    </Text>
                    <Text
                      style={styles.previewValue}
                      testID="pregnancy-start-preview-ga"
                    >
                      {preview.gaLabel}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text
                style={styles.helperText}
                testID="pregnancy-start-preview-empty"
              >
                {copy.wizard.previewEmpty}
              </Text>
            )}
          </View>

          {error ? (
            <StatusBanner
              message={error}
              testID="pregnancy-start-error"
              tone="error"
            />
          ) : null}

          <View style={styles.actionsRow}>
            <AppButton
              label={copy.wizard.backCta}
              onPress={onBack}
              testID="pregnancy-start-back-button"
              variant="secondary"
            />
            <AppButton
              disabled={isSaving}
              label={copy.wizard.nextCta}
              onPress={onNext}
              testID="pregnancy-start-next-button"
            />
          </View>
        </FeatureCard>
      ) : null}

      {step === 3 ? (
        <FeatureCard
          testID="pregnancy-start-confirm-step"
          title={copy.wizard.confirmStepTitle}
        >
          <View style={styles.summaryRow}>
            <Text style={styles.previewLabel}>
              {copy.wizard.confirmBasisLabel}
            </Text>
            <Text style={styles.previewValue}>
              {copy.wizard.confirmBasisValue[basis]}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.previewLabel}>
              {copy.wizard.confirmEddLabel}
            </Text>
            <Text style={styles.previewValue} testID="pregnancy-start-confirm-edd">
              {preview.eddLabel ?? ""}
            </Text>
          </View>
          {preview.gaLabel ? (
            <View style={styles.summaryRow}>
              <Text style={styles.previewLabel}>
                {copy.wizard.confirmGaLabel}
              </Text>
              <Text style={styles.previewValue}>{preview.gaLabel}</Text>
            </View>
          ) : null}

          {/* Multiples: optional, skippable -- additive block on the
              existing confirm step rather than a new wizard step. "One" is
              shown pre-selected (fetusCount ?? 1) but resolves to an absent
              fetusCount either way, so skipping this entirely and explicitly
              choosing "One" both produce today's plain singleton record. */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>{copy.wizard.multiplesQuestion}</Text>
            <ChoiceGroup<FetusCount>
              groupLabel={copy.wizard.multiplesQuestion}
              layout="grid3"
              onSelect={onFetusCountSelect}
              options={[
                { value: 1, label: copy.wizard.multiplesOptions.one },
                { value: 2, label: copy.wizard.multiplesOptions.twins },
                { value: 3, label: copy.wizard.multiplesOptions.tripletsPlus },
              ]}
              selectedValue={fetusCount ?? 1}
              testIDPrefix="pregnancy-start-fetus-count"
            />
          </View>

          {fetusCount !== undefined && fetusCount >= 2 ? (
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                {copy.wizard.chorionicityQuestion}
              </Text>
              <Text style={styles.helperText}>
                {copy.wizard.chorionicityExplainer}
              </Text>
              <ChoiceGroup<Chorionicity>
                groupLabel={copy.wizard.chorionicityQuestion}
                onSelect={onChorionicitySelect}
                options={[
                  { value: "dcda", label: copy.wizard.chorionicityOptions.dcda },
                  { value: "mcda", label: copy.wizard.chorionicityOptions.mcda },
                  { value: "mcma", label: copy.wizard.chorionicityOptions.mcma },
                  {
                    value: "unknown",
                    label: copy.wizard.chorionicityOptions.unknown,
                  },
                ]}
                selectedValue={chorionicity}
                testIDPrefix="pregnancy-start-chorionicity"
              />
            </View>
          ) : null}

          {error ? (
            <StatusBanner
              message={error}
              testID="pregnancy-start-error"
              tone="error"
            />
          ) : null}

          <View style={styles.actionsRow}>
            <AppButton
              label={copy.wizard.backCta}
              onPress={onBack}
              testID="pregnancy-start-back-button"
              variant="secondary"
            />
            <AppButton
              disabled={isSaving}
              label={copy.wizard.confirmCta}
              onPress={onConfirm}
              testID="pregnancy-start-confirm-button"
            />
          </View>
        </FeatureCard>
      ) : null}

      <PregnancyDisclaimer
        testID="pregnancy-start-disclaimer"
        text={copy.disclaimer}
      />
    </ScreenScaffold>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
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
    formGroup: {
      gap: spacing.xs,
    },
    fieldLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
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
    summaryRow: {
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
