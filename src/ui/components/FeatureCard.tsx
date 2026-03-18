import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/tokens";

type FeatureCardProps = PropsWithChildren<{
  title: string;
  description?: string;
  testID?: string;
}>;

export function FeatureCard({
  title,
  description,
  testID,
  children,
}: FeatureCardProps) {
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  header: {
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  content: {
    gap: 10,
  },
});
