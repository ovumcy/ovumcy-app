import { Pressable, StyleSheet, Text, View } from "react-native";

import { getContractionTimerCopy } from "../../../i18n/contraction-timer-copy";
import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import type {
  ContractionSessionHistoryViewData,
  ContractionTimerViewData,
} from "../../../services/contraction-timer-service";
import { AppButton } from "../../components/AppButton";
import { FeatureCard } from "../../components/FeatureCard";
import { PregnancyDisclaimer } from "../../components/PregnancyDisclaimer";
import { ScreenScaffold } from "../../components/ScreenScaffold";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { fontScale, spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

export type ContractionTimerFlowScreenProps = {
  language: string;
  viewData: ContractionTimerViewData;
  historyViewData: ContractionSessionHistoryViewData;
  isTiming: boolean;
  // Raw "M:SS" value (locale-agnostic digits) -- wrapped with the translated
  // "Elapsed ..." caption here via copy.counter.elapsedLabel.
  elapsedValue: string;
  isSaving: boolean;
  statusMessage: string;
  statusTone?: "error" | "info" | "success" | undefined;
  onToggle: () => void | Promise<void>;
  onFinish: () => void | Promise<void>;
  onDiscard: () => void | Promise<void>;
  onDeleteHistorySession: (id: string) => void | Promise<void>;
  onBirthPress?: (() => void) | undefined;
};

export function ContractionTimerFlowScreen({
  language,
  viewData,
  historyViewData,
  isTiming,
  elapsedValue,
  isSaving,
  statusMessage,
  statusTone = "success",
  onToggle,
  onFinish,
  onDiscard,
  onDeleteHistorySession,
  onBirthPress,
}: ContractionTimerFlowScreenProps) {
  const styles = useThemedStyles(createStyles);
  const copy = getContractionTimerCopy(language);
  const pregnancyCopy = getPregnancyCopy(language);

  // Not accessible (no active pregnancy / a deep-linked visit with no
  // pregnancy tracked): a neutral info body only -- no toggle, no rows, no
  // history. The disclaimer still renders unconditionally.
  if (!viewData.accessible) {
    return (
      <ScreenScaffold
        description={copy.notAccessible.body}
        eyebrow={copy.notAccessible.title}
        title={copy.notAccessible.title}
      >
        <FeatureCard
          description={copy.notAccessible.body}
          testID="contraction-timer-not-accessible"
          title={copy.notAccessible.title}
        />
        <PregnancyDisclaimer
          testID="contraction-timer-disclaimer"
          text={pregnancyCopy.disclaimer}
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      description={copy.counter.subtitle}
      eyebrow={copy.counter.title}
      title={copy.counter.title}
    >
      <FeatureCard testID="contraction-timer-counter-card">
        <Pressable
          accessibilityLabel={isTiming ? copy.counter.stopLabel : copy.counter.startLabel}
          accessibilityRole="button"
          disabled={isSaving}
          onPress={onToggle}
          style={[styles.toggleButton, isTiming ? styles.toggleButtonActive : null]}
          testID="contraction-timer-toggle-button"
        >
          <Text
            maxFontSizeMultiplier={fontScale.dense}
            style={styles.toggleLabel}
            testID="contraction-timer-toggle-label"
          >
            {isTiming ? copy.counter.stopLabel : copy.counter.startLabel}
          </Text>
        </Pressable>

        {isTiming ? (
          <Text
            maxFontSizeMultiplier={fontScale.dense}
            style={styles.elapsedLabel}
            testID="contraction-timer-elapsed"
          >
            {copy.counter.elapsedLabel(elapsedValue)}
          </Text>
        ) : (
          <Text style={styles.idleHint} testID="contraction-timer-idle-hint">
            {copy.counter.idleHint}
          </Text>
        )}

        {statusMessage ? (
          <StatusBanner
            message={statusMessage}
            testID="contraction-timer-status-banner"
            tone={statusTone}
          />
        ) : null}

        <View style={styles.actionsRow}>
          <AppButton
            disabled={isSaving}
            label={copy.counter.discardCta}
            onPress={onDiscard}
            testID="contraction-timer-discard-button"
            variant="secondary"
          />
          <AppButton
            disabled={isSaving}
            label={copy.counter.finishCta}
            onPress={onFinish}
            testID="contraction-timer-finish-button"
          />
        </View>
      </FeatureCard>

      {viewData.birthCta.visible ? (
        <AppButton
          label={viewData.birthCta.label}
          onPress={onBirthPress ?? (() => {})}
          testID="contraction-timer-birth-cta"
        />
      ) : null}

      <View
        style={[styles.educationWrap, viewData.educationProminent ? styles.educationWrapProminent : null]}
        testID={
          viewData.educationProminent
            ? "contraction-timer-education-wrap-prominent"
            : "contraction-timer-education-wrap"
        }
      >
        <Text style={styles.educationLine} testID="contraction-timer-education-line">
          {viewData.educationLine}
        </Text>
      </View>

      <FeatureCard testID="contraction-timer-window-summary" title={viewData.windowSummary.title}>
        <Text style={styles.helperText} testID="contraction-timer-window-count">
          {viewData.windowSummary.countLabel}
        </Text>
        {viewData.windowSummary.hasData ? (
          <View style={styles.windowRow}>
            <View style={styles.windowCell}>
              <Text style={styles.metaLabel}>{viewData.windowSummary.averageIntervalCaption}</Text>
              <Text style={styles.metaValue} testID="contraction-timer-window-avg-interval">
                {viewData.windowSummary.averageIntervalLabel}
              </Text>
            </View>
            <View style={styles.windowCell}>
              <Text style={styles.metaLabel}>{viewData.windowSummary.averageDurationCaption}</Text>
              <Text style={styles.metaValue} testID="contraction-timer-window-avg-duration">
                {viewData.windowSummary.averageDurationLabel}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.helperText} testID="contraction-timer-window-empty">
            {viewData.windowSummary.emptyLabel}
          </Text>
        )}
      </FeatureCard>

      <PregnancyDisclaimer
        testID="contraction-timer-disclaimer"
        text={pregnancyCopy.disclaimer}
      />

      <FeatureCard testID="contraction-timer-rows" title={viewData.rowsTitle}>
        {viewData.rows.length > 0 ? (
          <View style={styles.rowsList}>
            <Text style={styles.columnCaption}>{viewData.rowsColumnCaption}</Text>
            {viewData.rows.map((row) => (
              <View key={row.id} style={styles.row} testID={`contraction-timer-row-${row.id}`}>
                <Text style={styles.rowTime}>{row.timeLabel}</Text>
                <Text style={styles.rowMeta}>
                  {row.durationLabel} &middot; {row.intervalLabel}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.helperText} testID="contraction-timer-rows-empty">
            {viewData.emptyRowsLabel}
          </Text>
        )}
      </FeatureCard>

      <FeatureCard testID="contraction-timer-history" title={historyViewData.title}>
        {historyViewData.rows.length > 0 ? (
          <View style={styles.historyList}>
            {historyViewData.rows.map((row) => (
              <View
                key={row.id}
                style={styles.historyRow}
                testID={`contraction-timer-history-row-${row.id}`}
              >
                <View style={styles.historyRowMeta}>
                  <Text style={styles.historyDate}>
                    {row.dateLabel} &middot; {row.startTimeLabel}
                  </Text>
                  <Text style={styles.historyDetail}>{row.contractionCountLabel}</Text>
                </View>
                <AppButton
                  label={historyViewData.deleteLabel}
                  onPress={() => onDeleteHistorySession(row.id)}
                  testID={`contraction-timer-history-delete-${row.id}`}
                  variant="danger_secondary"
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.helperText} testID="contraction-timer-history-empty">
            {historyViewData.emptyLabel}
          </Text>
        )}
      </FeatureCard>
    </ScreenScaffold>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    toggleButton: {
      alignItems: "center",
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentStrong,
      borderRadius: 18,
      borderWidth: 2,
      justifyContent: "center",
      minHeight: 96,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
    },
    toggleButtonActive: {
      backgroundColor: colors.accent,
    },
    toggleLabel: {
      color: colors.accentStrong,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    elapsedLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
    },
    idleHint: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
    },
    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
    },
    educationWrap: {
      borderRadius: 14,
      padding: spacing.sm,
    },
    educationWrapProminent: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentStrong,
      borderWidth: 1,
    },
    educationLine: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    windowRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    windowCell: {
      flex: 1,
      gap: 2,
    },
    metaLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    metaValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    rowsList: {
      gap: spacing.xs,
    },
    columnCaption: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    rowTime: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    rowMeta: {
      color: colors.textMuted,
      fontSize: 13,
    },
    historyList: {
      gap: spacing.sm,
    },
    historyRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    historyRowMeta: {
      flex: 1,
      gap: 2,
    },
    historyDate: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    historyDetail: {
      color: colors.textMuted,
      fontSize: 13,
    },
  });
