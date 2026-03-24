import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AppThemeColors } from "../theme/tokens";
import { useThemedStyles } from "../theme/useThemedStyles";

type FeatureCardProps = PropsWithChildren<{
  title?: string | undefined;
  description?: string | undefined;
  testID?: string;
}>;

export function FeatureCard({
  title,
  description,
  testID,
  children,
}: FeatureCardProps) {
  const styles = useThemedStyles(createStyles);
  const hasHeader = Boolean(title || description);

  return (
    <View style={styles.card} testID={testID}>
      {hasHeader ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      ) : null}
      {children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) =>
  StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.lineSoft,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 18,
    shadowColor: colors.shadowSoft,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
  },
  header: {
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
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
