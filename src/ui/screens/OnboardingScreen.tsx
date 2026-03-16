import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { buildOnboardingShellViewData } from "../../services/onboarding-view-service";
import { FeatureCard } from "../components/FeatureCard";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { colors, spacing } from "../theme/tokens";

export function OnboardingScreen() {
  const viewData = buildOnboardingShellViewData();

  return (
    <ScreenScaffold
      eyebrow={viewData.eyebrow}
      title={viewData.title}
      description={viewData.description}
      footer={
        <Link href="/(tabs)/dashboard" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{viewData.continueLabel}</Text>
          </Pressable>
        </Link>
      }
    >
      {viewData.cards.map((card) => (
        <FeatureCard
          key={card.title}
          title={card.title}
          description={card.description}
        />
      ))}
      <View style={styles.note}>
        <Text style={styles.noteText}>{viewData.note}</Text>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  note: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 20,
    padding: spacing.md,
  },
  noteText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
});
