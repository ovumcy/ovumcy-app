import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

type FeatureCardProps = PropsWithChildren<{
  title: string;
  description: string;
}>;

export function FeatureCard({
  title,
  description,
  children,
}: FeatureCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  description: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  content: {
    gap: spacing.sm,
  },
});
