import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  buildAboutViewData,
  readAppVersion,
} from "../../services/about-view-service";
import { FeatureCard } from "../components/FeatureCard";
import { InlineBackButton } from "../components/InlineBackButton";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useAppPreferences } from "../providers/AppPreferencesProvider";
import type { AppThemeColors } from "../theme/tokens";
import { spacing } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

export type AboutScreenProps = {
  appVersion?: string | null;
};

export function AboutScreen({ appVersion = readAppVersion() }: AboutScreenProps) {
  const router = useRouter();
  const { language } = useAppPreferences();
  const styles = useThemedStyles(createStyles);
  const viewData = buildAboutViewData(language, appVersion);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <ScreenScaffold
      description={viewData.subtitle}
      title={viewData.title}
      topAccessory={
        <InlineBackButton
          label={viewData.backLabel}
          onPress={goBack}
          testID="about-back-button"
        />
      }
    >
      <View style={styles.stack}>
        <FeatureCard
          description={viewData.version.hint}
          testID="about-version"
          title={viewData.version.title}
        >
          <Text selectable style={styles.version} testID="about-version-value">
            {viewData.version.value}
          </Text>
        </FeatureCard>

        {viewData.sections.map((section) => (
          <FeatureCard
            key={section.id}
            description={section.body}
            testID={`about-section-${section.id}`}
            title={section.title}
          />
        ))}

        <FeatureCard testID="about-font-license" title={viewData.fontLicense.title}>
          <Text selectable style={styles.licenseText}>
            {viewData.fontLicense.text}
          </Text>
        </FeatureCard>
      </View>
    </ScreenScaffold>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
    stack: {
      gap: spacing.md,
    },
    version: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    licenseText: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
  });
