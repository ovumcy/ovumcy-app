import { Pressable, StyleSheet, Text, View } from "react-native";

import { getKickCounterCopy } from "../../../i18n/kick-counter-copy";
import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import { KICK_COUNT_TARGET } from "../../../services/kick-counter-service";
import type { KickCounterViewData } from "../../../services/kick-counter-service";
import { AppButton } from "../../components/AppButton";
import { BinaryToggleCard } from "../../components/BinaryToggleCard";
import { FeatureCard } from "../../components/FeatureCard";
import { PregnancyDisclaimer } from "../../components/PregnancyDisclaimer";
import { ScreenScaffold } from "../../components/ScreenScaffold";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { fontScale, spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

export type KickCounterFlowScreenProps = {
  language: string;
  viewData: KickCounterViewData;
  sessionPhase: "idle" | "counting";
  tapCount: number;
  elapsedMinutes: number;
  isSaving: boolean;
  statusMessage: string;
  statusTone?: "error" | "info" | "success" | undefined;
  reminderEnabled: boolean;
  onTap: () => void;
  onFinish: () => void | Promise<void>;
  onDiscard: () => void | Promise<void>;
  onDeleteSession: (id: string) => void | Promise<void>;
  onReminderToggle: (value: boolean) => void | Promise<void>;
};

export function KickCounterFlowScreen({
  language,
  viewData,
  sessionPhase,
  tapCount,
  elapsedMinutes,
  isSaving,
  statusMessage,
  statusTone = "success",
  reminderEnabled,
  onTap,
  onFinish,
  onDiscard,
  onDeleteSession,
  onReminderToggle,
}: KickCounterFlowScreenProps) {
  const styles = useThemedStyles(createStyles);
  const copy = getKickCounterCopy(language);
  const pregnancyCopy = getPregnancyCopy(language);

  // Not accessible (no active pregnancy / before week 28 / deep-linked while
  // out of range): a neutral info body only -- no counter, no history, no
  // reminder toggle. The disclaimer still renders unconditionally.
  if (!viewData.accessible) {
    return (
      <ScreenScaffold
        description={copy.notAccessible.body}
        eyebrow={copy.notAccessible.title}
        title={copy.notAccessible.title}
      >
        <FeatureCard
          description={copy.notAccessible.body}
          testID="kick-counter-not-accessible"
          title={copy.notAccessible.title}
        />
        <PregnancyDisclaimer
          testID="kick-counter-disclaimer"
          text={pregnancyCopy.disclaimer}
        />
      </ScreenScaffold>
    );
  }

  const isCounting = sessionPhase === "counting";

  return (
    <ScreenScaffold
      description={copy.counter.subtitle}
      eyebrow={copy.counter.title}
      title={copy.counter.title}
    >
      <FeatureCard testID="kick-counter-counter-card">
        <Pressable
          accessibilityLabel={`${copy.counter.title}. ${tapCount} / ${KICK_COUNT_TARGET}`}
          accessibilityRole="button"
          disabled={isSaving}
          onPress={onTap}
          style={styles.tapCircle}
          testID="kick-counter-tap-button"
        >
          <Text
            maxFontSizeMultiplier={fontScale.dense}
            style={styles.tapCount}
            testID="kick-counter-tap-count"
          >
            {tapCount}
          </Text>
          <Text maxFontSizeMultiplier={fontScale.dense} style={styles.tapTarget}>
            / {KICK_COUNT_TARGET}
          </Text>
        </Pressable>

        {isCounting ? (
          <Text style={styles.elapsedLabel} testID="kick-counter-elapsed">
            {copy.counter.elapsedLabel(elapsedMinutes)}
          </Text>
        ) : (
          <Text style={styles.startHint} testID="kick-counter-start-hint">
            {copy.counter.startHint}
          </Text>
        )}

        {statusMessage ? (
          <StatusBanner
            message={statusMessage}
            testID="kick-counter-status-banner"
            tone={statusTone}
          />
        ) : null}

        <View style={styles.actionsRow}>
          <AppButton
            disabled={!isCounting || isSaving}
            label={copy.counter.discardCta}
            onPress={onDiscard}
            testID="kick-counter-discard-button"
            variant="secondary"
          />
          <AppButton
            disabled={!isCounting || tapCount === 0 || isSaving}
            label={copy.counter.finishCta}
            onPress={onFinish}
            testID="kick-counter-finish-button"
          />
        </View>
      </FeatureCard>

      <Text style={styles.educationLine} testID="kick-counter-education-line">
        {viewData.educationLine}
      </Text>

      <FeatureCard testID="kick-counter-reminder-card">
        <BinaryToggleCard
          description={copy.reminder.hint}
          descriptionPosition="below"
          label={copy.reminder.label}
          onValueChange={onReminderToggle}
          testID="kick-counter-reminder-toggle"
          value={reminderEnabled}
        />
      </FeatureCard>

      <PregnancyDisclaimer
        testID="kick-counter-disclaimer"
        text={pregnancyCopy.disclaimer}
      />

      <FeatureCard testID="kick-counter-history" title={viewData.history.title}>
        {viewData.history.rows.length > 0 ? (
          <View style={styles.historyList}>
            {viewData.history.rows.map((row) => (
              <View
                key={row.id}
                style={styles.historyRow}
                testID={`kick-counter-history-row-${row.id}`}
              >
                <View style={styles.historyRowMeta}>
                  <Text style={styles.historyDate}>{row.dateLabel}</Text>
                  <Text style={styles.historyDetail}>
                    {row.kickCount} &middot; {row.durationLabel}
                  </Text>
                </View>
                <AppButton
                  label={viewData.history.deleteLabel}
                  onPress={() => onDeleteSession(row.id)}
                  testID={`kick-counter-history-delete-${row.id}`}
                  variant="danger_secondary"
                />
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.helperText} testID="kick-counter-history-empty">
            {viewData.history.emptyLabel}
          </Text>
        )}
      </FeatureCard>
    </ScreenScaffold>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    tapCircle: {
      alignItems: "center",
      alignSelf: "center",
      backgroundColor: colors.accentSoft,
      borderColor: colors.accentStrong,
      borderRadius: 999,
      borderWidth: 2,
      height: 160,
      justifyContent: "center",
      width: 160,
    },
    tapCount: {
      color: colors.accentStrong,
      fontSize: 48,
      fontWeight: "800",
      lineHeight: 52,
    },
    tapTarget: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
    elapsedLabel: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
    },
    startHint: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
    },
    actionsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
    },
    educationLine: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
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
    helperText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
  });
