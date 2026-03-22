import type { ReactNode } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppScreenSurface } from "../../components/AppScreenSurface";
import type { OnboardingFlowStyles } from "./onboarding-flow-styles";

type OnboardingShellProps = {
  children: ReactNode;
  compact: boolean;
  progressLabel: string;
  progressPercent: number;
  screenHeight: number;
  scrollEnabled: boolean;
  styles: OnboardingFlowStyles;
  subtitle?: string | undefined;
  title: string;
};

export function OnboardingShell({
  children,
  compact,
  progressLabel,
  progressPercent,
  screenHeight,
  scrollEnabled,
  styles,
  subtitle,
  title,
}: OnboardingShellProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const minCardHeight =
    width < 760
      ? Math.max(screenHeight - insets.top - insets.bottom - 42, 0)
      : 0;

  const contentPadding = {
    paddingTop: insets.top + (compact ? 10 : 12),
    paddingBottom: Math.max(insets.bottom + (compact ? 14 : 18), compact ? 18 : 24),
  };

  const progressContent = (
    <>
      <View style={[styles.progressBlock, compact ? styles.progressBlockCompact : null]}>
        <Text style={[styles.kicker, compact ? styles.kickerCompact : null]}>{progressLabel}</Text>
        <View style={[styles.progressPanel, compact ? styles.progressPanelCompact : null]}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>
        </View>
      </View>
      <View style={[styles.panel, scrollEnabled ? null : styles.panelPinned, compact ? styles.panelCompact : null]}>
        <Text style={[styles.heroTitle, compact ? styles.heroTitleCompact : null]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.heroMuted, compact ? styles.heroMutedCompact : null]}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </View>
    </>
  );

  return (
    <AppScreenSurface>
      <View style={styles.screen}>
        {scrollEnabled ? (
          <ScrollView
            contentContainerStyle={[
              styles.screenContent,
              compact ? styles.screenContentCompact : null,
              contentPadding,
            ]}
            showsVerticalScrollIndicator={false}
            style={styles.screen}
          >
            <View
              style={[
                styles.heroCard,
                compact ? styles.heroCardCompact : null,
                minCardHeight > 0 ? { minHeight: minCardHeight } : null,
              ]}
            >
              {progressContent}
            </View>
          </ScrollView>
        ) : (
          <View
            style={[
              styles.screenContent,
              styles.screenContentPinned,
              compact ? styles.screenContentCompact : null,
              contentPadding,
            ]}
          >
            <View
              style={[
                styles.heroCard,
                styles.heroCardPinned,
                compact ? styles.heroCardCompact : null,
                minCardHeight > 0 ? { height: minCardHeight } : null,
              ]}
            >
              {progressContent}
            </View>
          </View>
        )}
      </View>
    </AppScreenSurface>
  );
}
