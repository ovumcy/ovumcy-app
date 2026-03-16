import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { appInfo } from "../../../lib/app-info";
import { FeatureCard } from "../../../ui/components/FeatureCard";
import { ScreenScaffold } from "../../../ui/components/ScreenScaffold";
import { colors, spacing } from "../../../ui/theme/tokens";

export function OnboardingScreen() {
  return (
    <ScreenScaffold
      eyebrow="Start here"
      title="A private cycle tracker that starts on your phone."
      description={`${appInfo.name} begins as a local-first app. Core tracking works before sync, before accounts, and before any cloud setup.`}
      footer={
        <Link href="/(tabs)/dashboard" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Continue to app shell</Text>
          </Pressable>
        </Link>
      }
    >
      <FeatureCard
        title="Local-first by default"
        description="Cycle logs, predictions, and settings are designed to work on-device before optional sync exists."
      />
      <FeatureCard
        title="One product, several clients"
        description="This repo targets iOS and Android first, while keeping a future web client and optional sync contract in mind."
      />
      <View style={styles.note}>
        <Text style={styles.noteText}>
          Bootstrap milestone: establish architecture, quality gates, and screen shells before moving real cycle logic into shared domain modules.
        </Text>
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
