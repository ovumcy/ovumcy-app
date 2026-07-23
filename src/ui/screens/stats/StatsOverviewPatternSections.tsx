import { type DimensionValue, Text, View } from "react-native";

import type { StatsViewData } from "../../../services/stats-view-service";
import { FeatureCard } from "../../components/FeatureCard";
import {
  composeStatsAccessibilityLabel,
  StatsOverviewSymptomRow,
} from "./StatsOverviewShared";
import type { StatsOverviewStyles } from "./stats-overview-styles";

type StatsOverviewPatternSectionsProps = {
  pairWidth: DimensionValue;
  styles: StatsOverviewStyles;
  viewData: StatsViewData;
};

export function StatsOverviewPatternSections({
  pairWidth,
  styles,
  viewData,
}: StatsOverviewPatternSectionsProps) {
  const hasPhaseInsights = Boolean(
    viewData.phaseMoodInsights?.items.some((item) => item.hasData) ||
      viewData.phaseSymptomInsights?.items.some((item) => item.hasData),
  );

  return (
    <>
      {viewData.symptomPatterns && viewData.symptomPatterns.items.length > 0 ? (
        <FeatureCard
          description={viewData.symptomPatterns.subtitle}
          testID="stats-symptom-patterns"
          title={viewData.symptomPatterns.title}
        >
          <View style={styles.sectionGrid}>
            {viewData.symptomPatterns.items.map((item) => (
              <View
                accessibilityLabel={composeStatsAccessibilityLabel([
                  item.label,
                  item.summary,
                ])}
                accessible
                key={item.id}
                style={[styles.panel, { width: pairWidth }]}
              >
                <View style={styles.metaRow}>
                  <Text style={styles.metaIcon}>{item.icon}</Text>
                  <Text style={styles.metaLabel}>{item.label}</Text>
                </View>
                <Text style={styles.helperText}>{item.summary}</Text>
              </View>
            ))}
          </View>
        </FeatureCard>
      ) : null}

      {hasPhaseInsights ? (
        <View style={styles.sectionGrid}>
          {viewData.phaseMoodInsights &&
          viewData.phaseMoodInsights.items.some((item) => item.hasData) ? (
            <View style={{ width: pairWidth }}>
              <FeatureCard
                description={viewData.phaseMoodInsights.subtitle}
                testID="stats-phase-mood"
                title={viewData.phaseMoodInsights.title}
              >
                <View style={styles.sectionGrid}>
                  {viewData.phaseMoodInsights.items.map((item) => (
                    <View
                      accessibilityLabel={composeStatsAccessibilityLabel(
                        item.hasData
                          ? [item.phase, item.averageMood, item.countLabel]
                          : [item.phase, item.emptyLabel],
                      )}
                      accessible
                      key={item.key}
                      style={[styles.panel, { width: pairWidth }]}
                    >
                      <View style={styles.metaRow}>
                        <Text style={styles.metaIcon}>{item.icon}</Text>
                        <Text style={styles.metaLabel}>{item.phase}</Text>
                      </View>
                      {item.hasData ? (
                        <>
                          <View style={styles.meterTrack}>
                            <View
                              style={[
                                styles.meterFill,
                                { width: `${item.percentage}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.rowValue}>{item.averageMood}</Text>
                          <Text style={styles.helperText}>
                            {item.countLabel}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.helperText}>{item.emptyLabel}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </FeatureCard>
            </View>
          ) : null}

          {viewData.phaseSymptomInsights &&
          viewData.phaseSymptomInsights.items.some((item) => item.hasData) ? (
            <View style={{ width: pairWidth }}>
              <FeatureCard
                description={viewData.phaseSymptomInsights.subtitle}
                testID="stats-phase-symptoms"
                title={viewData.phaseSymptomInsights.title}
              >
                <View style={styles.listStack}>
                  {viewData.phaseSymptomInsights.items.map((item) => (
                    // Deliberately not one grouped element: each symptom row
                    // below is already its own composed label, and grouping the
                    // panel would collapse them into a single unreadable
                    // paragraph. The phase heading names the group instead.
                    <View key={item.key} style={styles.panel}>
                      <View style={styles.metaRow}>
                        <Text
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                          style={styles.metaIcon}
                        >
                          {item.icon}
                        </Text>
                        <Text accessibilityRole="header" style={styles.metaLabel}>
                          {item.phase}
                        </Text>
                      </View>
                      {item.hasData ? (
                        <>
                          <View style={styles.listStack}>
                            {item.symptoms.map((symptom) => (
                              <StatsOverviewSymptomRow
                                key={symptom.id}
                                frequencySummary={symptom.percentageLabel}
                                icon={symptom.icon}
                                label={symptom.label}
                                styles={styles}
                              />
                            ))}
                          </View>
                          <Text style={styles.helperText}>
                            {item.totalDaysLabel}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.helperText}>{item.emptyLabel}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </FeatureCard>
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
