import type { PropsWithChildren, ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../theme/tokens";

type ScreenScaffoldProps = PropsWithChildren<{
  eyebrow?: string;
  title: string;
  description: string;
  footer?: ReactNode;
}>;

export function ScreenScaffold({
  eyebrow,
  title,
  description,
  footer,
  children,
}: ScreenScaffoldProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = width < 768;
  const topPadding = (isCompact ? 16 : 20) + insets.top;
  const bottomPadding = Math.max(insets.bottom + 16, 28);

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      style={styles.screen}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.container,
          isCompact ? styles.containerCompact : styles.containerWide,
          { paddingTop: topPadding },
        ]}
      >
        <View style={[styles.hero, isCompact ? styles.heroCompact : null]}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={[styles.title, isCompact ? styles.titleCompact : null]}>
            {title}
          </Text>
          <Text
            style={[
              styles.description,
              isCompact ? styles.descriptionCompact : null,
            ]}
          >
            {description}
          </Text>
        </View>
        <View style={styles.body}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
  },
  container: {
    alignSelf: "center",
    gap: 20,
    maxWidth: 1080,
    width: "100%",
  },
  containerCompact: {
    paddingHorizontal: 16,
  },
  containerWide: {
    paddingHorizontal: 20,
  },
  hero: {
    gap: 6,
  },
  heroCompact: {
    gap: 4,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: "800",
    lineHeight: 34,
  },
  titleCompact: {
    fontSize: 25,
    lineHeight: 30,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  descriptionCompact: {
    fontSize: 13,
    lineHeight: 20,
  },
  body: {
    gap: 20,
  },
  footer: {
    marginTop: spacing.sm,
  },
});
