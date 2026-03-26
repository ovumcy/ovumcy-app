import {
  type DimensionValue,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type {
  StatsEmptyActionKind,
  StatsViewData,
} from "../../services/stats-view-service";
import { AppScreenSurface } from "../components/AppScreenSurface";
import { resolveBottomContentPadding } from "../layout/bottom-content-padding";
import { useAppTheme, useThemedStyles } from "../theme/useThemedStyles";
import { StatsOverviewEmptyState } from "./stats/StatsOverviewEmptyState";
import { StatsOverviewPatternSections } from "./stats/StatsOverviewPatternSections";
import { StatsOverviewSummarySections } from "./stats/StatsOverviewSummarySections";
import { StatsOverviewTrendSections } from "./stats/StatsOverviewTrendSections";
import { createStatsOverviewStyles } from "./stats/stats-overview-styles";

type StatsOverviewScreenProps = {
  onEmptyStateAction?: ((action: StatsEmptyActionKind) => void) | undefined;
  viewData: StatsViewData;
};

export function StatsOverviewScreen({
  onEmptyStateAction,
  viewData,
}: StatsOverviewScreenProps) {
  const styles = useThemedStyles(createStatsOverviewStyles);
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardColumns = width >= 1080 ? 4 : width >= 760 ? 2 : 1;
  const cardWidth: DimensionValue =
    cardColumns === 4 ? "23.5%" : cardColumns === 2 ? "48.5%" : "100%";
  const pairWidth: DimensionValue = width >= 920 ? "48.5%" : "100%";
  const trendPrimaryWidth: DimensionValue = width >= 1080 ? "65.5%" : "100%";
  const trendSecondaryWidth: DimensionValue =
    width >= 1080 ? "32.5%" : "100%";

  return (
    <AppScreenSurface>
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingBottom: resolveBottomContentPadding(insets.bottom) },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} testID="stats-screen-title">
              {viewData.title}
            </Text>
            <Text style={styles.headerDescription}>{viewData.description}</Text>
          </View>

          {!viewData.hasInsights ? (
            <StatsOverviewEmptyState
              onPrimaryAction={
                viewData.emptyState?.action
                  ? () => onEmptyStateAction?.(viewData.emptyState!.action.kind)
                  : undefined
              }
              styles={styles}
              viewData={viewData}
            />
          ) : null}

          {viewData.predictionExplanation ? (
            <View style={styles.noticePanel}>
              <Text style={styles.noticeText}>{viewData.predictionExplanation}</Text>
            </View>
          ) : null}

          {viewData.notices.map((notice) => (
            <View key={notice} style={styles.noticePanel}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ))}

          {viewData.hasInsights ? (
            <>
              <StatsOverviewSummarySections
                cardWidth={cardWidth}
                styles={styles}
                viewData={viewData}
              />
              <StatsOverviewTrendSections
                colors={colors}
                pairWidth={pairWidth}
                styles={styles}
                trendPrimaryWidth={trendPrimaryWidth}
                trendSecondaryWidth={trendSecondaryWidth}
                viewData={viewData}
              />
              <StatsOverviewPatternSections
                pairWidth={pairWidth}
                styles={styles}
                viewData={viewData}
              />
            </>
          ) : null}
        </View>
      </ScrollView>
    </AppScreenSurface>
  );
}
