import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  buildPrivacyNoticeViewData,
  openPrivacyPolicy as openPrivacyPolicyURL,
} from "../../services/privacy-notice-service";
import { AppButton } from "../components/AppButton";
import { FeatureCard } from "../components/FeatureCard";
import { InlineBackButton } from "../components/InlineBackButton";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { StatusBanner } from "../components/StatusBanner";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

export type PrivacyNoticeScreenProps = {
  openPrivacyPolicy?: () => Promise<boolean>;
};

export function PrivacyNoticeScreen({
  openPrivacyPolicy = openPrivacyPolicyURL,
}: PrivacyNoticeScreenProps = {}) {
  const router = useRouter();
  const { language } = useAppPreferences();
  const styles = useThemedStyles(createStyles);
  const viewData = buildPrivacyNoticeViewData(language);
  const [linkErrorMessage, setLinkErrorMessage] = useState("");

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const handleOpenPolicy = async () => {
    const opened = await openPrivacyPolicy();
    setLinkErrorMessage(opened ? "" : viewData.policyLink.unavailable);
  };

  return (
    <ScreenScaffold
      description={viewData.subtitle}
      title={viewData.title}
      topAccessory={
        <InlineBackButton
          label={viewData.backLabel}
          onPress={goBack}
          testID="privacy-notice-back-button"
        />
      }
    >
      <View style={styles.stack}>
        {viewData.sections.map((section) => (
          <FeatureCard
            key={section.id}
            description={section.body}
            testID={`privacy-notice-section-${section.id}`}
            title={section.title}
          />
        ))}

        <FeatureCard
          description={viewData.policyLink.hint}
          testID="privacy-notice-policy-link"
          title={viewData.policyLink.title}
        >
          <Text style={styles.url}>{viewData.policyLink.url}</Text>
          <AppButton
            label={viewData.policyLink.actionLabel}
            onPress={handleOpenPolicy}
            testID="privacy-notice-open-policy-button"
            variant="secondary"
          />
          {linkErrorMessage ? (
            <StatusBanner
              message={linkErrorMessage}
              testID="privacy-notice-policy-link-error"
              tone="error"
            />
          ) : null}
        </FeatureCard>

        <Text style={styles.revision} testID="privacy-notice-revision">
          {viewData.revisionText}
        </Text>
      </View>
    </ScreenScaffold>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    stack: {
      gap: spacing.md,
    },
    url: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    revision: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: "center",
    },
  });
