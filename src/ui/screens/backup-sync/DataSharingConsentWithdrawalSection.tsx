import { StyleSheet, Text, View } from "react-native";

import type { DataSharingConsentWithdrawalViewData } from "../../../services/data-sharing-consent-service";
import { AppButton } from "../../components/AppButton";
import { FeatureCard } from "../../components/FeatureCard";
import { StatusBanner } from "../../components/StatusBanner";
import type { AppThemeColors } from "../../theme/tokens";
import { spacing } from "../../theme/tokens";
import { useThemedStyles } from "../../theme/useThemedStyles";

type DataSharingConsentWithdrawalSectionProps = {
  errorMessage: string;
  hasConsent: boolean;
  isBusy: boolean;
  onWithdraw: () => void | Promise<void>;
  statusMessage: string;
  viewData: DataSharingConsentWithdrawalViewData;
};

/** Shown while a consent is stored, and afterwards only to confirm the withdrawal. */
export function DataSharingConsentWithdrawalSection({
  errorMessage,
  hasConsent,
  isBusy,
  onWithdraw,
  statusMessage,
  viewData,
}: DataSharingConsentWithdrawalSectionProps) {
  const styles = useThemedStyles(createStyles);

  if (!hasConsent && !statusMessage && !errorMessage) {
    return null;
  }

  return (
    <FeatureCard
      testID="data-sharing-consent-withdrawal-section"
      title={viewData.title}
    >
      <View style={styles.stack}>
        {statusMessage ? (
          <StatusBanner
            message={statusMessage}
            testID="data-sharing-consent-withdrawal-status"
            tone="success"
          />
        ) : null}
        {errorMessage ? (
          <StatusBanner
            message={errorMessage}
            testID="data-sharing-consent-withdrawal-error"
            tone="error"
          />
        ) : null}
        {hasConsent ? (
          <>
            <Text style={styles.body}>{viewData.givenHeading}</Text>
            {viewData.given.map((label) => (
              <Text key={label} style={styles.item}>
                {`• ${label}`}
              </Text>
            ))}
            <Text style={styles.body}>{viewData.stops}</Text>
            <Text style={styles.muted}>{viewData.keeps}</Text>
            {viewData.revokesPartners ? (
              <Text
                style={styles.muted}
                testID="data-sharing-consent-withdrawal-revokes-partners"
              >
                {viewData.revokesPartners}
              </Text>
            ) : null}
            <AppButton
              disabled={isBusy}
              label={viewData.withdrawLabel}
              onPress={() => {
                void onWithdraw();
              }}
              testID="data-sharing-consent-withdraw-button"
              variant="secondary"
            />
          </>
        ) : null}
      </View>
    </FeatureCard>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    stack: {
      gap: spacing.sm,
    },
    body: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    item: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
      paddingLeft: spacing.xs,
    },
    muted: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
  });
