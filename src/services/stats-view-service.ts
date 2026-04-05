import { getDayLogCopy } from "../i18n/day-log-copy";
import { getStatsCopy } from "../i18n/stats-copy";
import type { DayCycleFactorKey, DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import {
  STATS_FACTOR_CONTEXT_WINDOW_DAYS,
  type StatsComparisonKind,
  type StatsCycleProjection,
  type StatsPhase,
} from "../models/stats";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildCycleHistorySummary,
  buildCurrentCycleProjection,
  buildStatsFactorContext,
  buildStatsReliability,
  shouldShowAgeVariabilityHint,
  shouldShowIrregularityNotice,
  shouldShowIrregularModeRecommendation,
} from "./cycle-history-service";
import { buildPredictionExplanation } from "./prediction-explanation-service";
import type { ManagedCloudPremiumFeatures } from "../sync/managed-cloud-api-client";
import {
  buildLastCycleSymptomFrequency,
  buildStatsBBTSeries,
  buildStatsPhaseMoodInsights,
  buildStatsPhaseSymptomInsights,
  buildStatsSymptomFrequency,
  buildStatsSymptomPatterns,
  buildStatsTrendPoints,
} from "./stats-insights-service";
import { buildStatsAdvancedFertility } from "./stats-advanced-fertility-service";
import { buildStatsExtendedReports } from "./stats-extended-reports-service";
import { buildStatsPersonalForecasts } from "./stats-personal-forecasts-service";
import { buildStatsPremiumInsights } from "./stats-premium-insights-service";
import { formatLocalDate, parseLocalDate } from "./profile-settings-policy";
import { localizeSymptomRecords } from "./symptom-presentation-service";

export type StatsTopCardViewData = {
  key: string;
  title: string;
  value: string;
  description?: string;
};

export type StatsEmptyActionKind = "open_logging";

export type StatsPremiumSectionViewData = {
  title: string;
  subtitle: string;
  items: {
    key: string;
    title: string;
    value: string;
    description: string;
    tone: "info" | "success" | "warning";
  }[];
};

export type StatsViewData = {
  title: string;
  description: string;
  hasInsights: boolean;
  predictionExplanation?: string;
  extendedReports?: {
    title: string;
    subtitle: string;
    summary: string;
    rows: {
      key: string;
      title: string;
      cycleLengthLabel: string;
      periodLengthLabel: string;
      comparisonLabel: string;
    }[];
  };
  advancedInsights?: StatsPremiumSectionViewData;
  advancedFertility?: StatsPremiumSectionViewData;
  personalForecasts?: StatsPremiumSectionViewData;
  emptyState?: {
    title: string;
    body: string;
    lockedSections: string[];
    progressLabel: string;
    progressPercent: number;
    hint: string;
    action: {
      kind: StatsEmptyActionKind;
      label: string;
    };
  };
  notices: string[];
  trendChart?: {
    title: string;
    legendActualLabel: string;
    legendAverageLabel: string;
    baselineValue: number | null;
    points: {
      key: string;
      label: string;
      value: number;
    }[];
    valueSuffix: string;
    emptyLabel: string;
  };
  symptomFrequency?: {
    title: string;
    emptyLabel: string;
    items: {
      id: string;
      icon: string;
      label: string;
      frequencySummary: string;
    }[];
  };
  lastCycleSymptoms?: {
    title: string;
    subtitle: string;
    emptyLabel: string;
    items: {
      id: string;
      icon: string;
      label: string;
      frequencySummary: string;
    }[];
  };
  symptomPatterns?: {
    title: string;
    subtitle: string;
    items: {
      id: string;
      icon: string;
      label: string;
      summary: string;
    }[];
  };
  phaseMoodInsights?: {
    title: string;
    subtitle: string;
    items: {
      key: StatsPhase;
      phase: string;
      icon: string;
      hasData: boolean;
      averageMood: string;
      percentage: number;
      countLabel: string;
      emptyLabel: string;
    }[];
  };
  phaseSymptomInsights?: {
    title: string;
    subtitle: string;
    items: {
      key: StatsPhase;
      phase: string;
      icon: string;
      hasData: boolean;
      totalDaysLabel: string;
      emptyLabel: string;
      symptoms: {
        id: string;
        icon: string;
        label: string;
        percentageLabel: string;
      }[];
    }[];
  };
  bbtTrend?: {
    title: string;
    caption: string;
    unitLabel: string;
    valueSuffix: string;
    points: {
      key: string;
      label: string;
      value: number;
    }[];
  };
  topCards: StatsTopCardViewData[];
  cycleOverview?: {
    title: string;
    averageLabel: string;
    averageValue: string;
    medianLabel: string;
    medianValue: string;
    rangeTitle: string;
    rangeValue: string;
  };
  factorContext?: {
    title: string;
    description: string;
    recentFactors: {
      key: DayCycleFactorKey;
      icon: string;
      label: string;
      count: number;
    }[];
    patternSummaries: {
      key: StatsComparisonKind;
      title: string;
      items: {
        key: DayCycleFactorKey;
        icon: string;
        label: string;
        count: number;
      }[];
    }[];
    recentCycles: {
      startDate: string;
      endDate: string;
      title: string;
      comparisonLabel: string;
      factors: {
        key: DayCycleFactorKey;
        icon: string;
        label: string;
      }[];
    }[];
    hint: string;
  };
};

export type LoadedStatsState = {
  profile: ProfileRecord;
  records: DayLogRecord[];
  symptomRecords: SymptomRecord[];
  viewData: StatsViewData;
};

export async function loadStatsScreenState(
  storage: LocalAppStorage,
  now: Date,
  locale = "en",
  premiumFeatures: ManagedCloudPremiumFeatures = {
    advancedFertility: false,
    advancedInsights: false,
    doctorPDF: false,
    extendedReports: false,
  },
): Promise<LoadedStatsState> {
  const today = atLocalDay(now);
  const rangeStart = formatLocalDate(
    new Date(today.getFullYear() - 2, today.getMonth(), today.getDate()),
  );
  const rangeEnd = formatLocalDate(today);
  const [profile, records, symptomRecords] = await Promise.all([
    storage.readProfileRecord(),
    storage.listDayLogRecordsInRange(rangeStart, rangeEnd),
    storage.listSymptomRecords(),
  ]);

  return {
    profile,
    records,
    symptomRecords,
    viewData: buildStatsViewData(
      profile,
      records,
      symptomRecords,
      now,
      locale,
      premiumFeatures,
    ),
  };
}

export function buildStatsViewData(
  profile: ProfileRecord,
  records: DayLogRecord[],
  symptomRecords: SymptomRecord[],
  now: Date,
  locale = "en",
  premiumFeatures: ManagedCloudPremiumFeatures = {
    advancedFertility: false,
    advancedInsights: false,
    doctorPDF: false,
    extendedReports: false,
  },
): StatsViewData {
  const statsCopy = getStatsCopy(locale);
  const dayLogCopy = getDayLogCopy(locale);
  const localizedSymptomRecords = localizeSymptomRecords(symptomRecords, locale);
  const history = buildCycleHistorySummary(profile, records, now);

  if (!history.hasInsights) {
    return {
      title: statsCopy.title,
      description: statsCopy.subtitle,
      hasInsights: false,
      notices: [],
      topCards: [],
      emptyState: {
        title: statsCopy.emptyTitle,
        body:
          history.completedCycleCount === 0
            ? statsCopy.emptyBodyZero
            : statsCopy.emptyBodyOne,
        lockedSections: [
          statsCopy.cycleLengthCard,
          statsCopy.cycleTrend,
          statsCopy.symptomFrequency,
          statsCopy.lastCycleSymptomsTitle,
          statsCopy.phaseMoodTitle,
          statsCopy.phaseSymptomsTitle,
        ],
        progressLabel: statsCopy.completedCyclesProgress(
          history.completedCycleCount,
        ),
        progressPercent: history.insightProgress,
        hint: statsCopy.emptyProgressHint,
        action: {
          kind: "open_logging",
          label: statsCopy.emptyActionLabel,
        },
      },
    };
  }

  const projection = buildCurrentCycleProjection(profile, history, records, now);
  const reliability = buildStatsReliability(profile, history);
  const factorContext = buildStatsFactorContext(profile, history, records, now);
  const trendPoints = buildStatsTrendPoints(history, locale);
  const symptomFrequency = buildStatsSymptomFrequency(records, localizedSymptomRecords);
  const lastCycleSymptoms = buildLastCycleSymptomFrequency(
    history,
    records,
    localizedSymptomRecords,
  );
  const symptomPatterns = buildStatsSymptomPatterns(
    history,
    records,
    localizedSymptomRecords,
  );
  const phaseMoodInsights = buildStatsPhaseMoodInsights(history, records);
  const phaseSymptomInsights = buildStatsPhaseSymptomInsights(
    history,
    records,
    localizedSymptomRecords,
  );
  const personalForecasts = premiumFeatures.advancedInsights
    ? buildStatsPersonalForecasts(symptomPatterns, projection.currentCycleDay)
    : [];
  const premiumInsights = premiumFeatures.advancedInsights
    ? buildStatsPremiumInsights(history)
    : null;
  const advancedInsightsSection = premiumInsights
    ? buildAdvancedInsightsSection(premiumInsights, statsCopy)
    : null;
  const premiumFertility = premiumFeatures.advancedFertility
    ? buildStatsAdvancedFertility(
        history,
        records,
        projection.cycleAnchorDate,
        profile.temperatureUnit,
      )
    : null;
  const advancedFertilitySection = premiumFertility
    ? buildAdvancedFertilitySection(premiumFertility, profile, statsCopy)
    : null;
  const personalForecastsSection =
    personalForecasts.length > 0
      ? buildPersonalForecastsSection(personalForecasts, statsCopy)
      : null;
  const extendedReports = premiumFeatures.extendedReports
    ? buildStatsExtendedReports(history)
    : null;
  const bbtSeries = buildStatsBBTSeries(projection, records, now, locale);

  return {
    title: statsCopy.title,
    description: statsCopy.subtitle,
    hasInsights: true,
    ...(advancedInsightsSection
      ? {
          advancedInsights: advancedInsightsSection,
        }
      : {}),
    ...(advancedFertilitySection
      ? {
          advancedFertility: advancedFertilitySection,
        }
      : {}),
    ...(personalForecastsSection
      ? {
          personalForecasts: personalForecastsSection,
        }
      : {}),
    ...(extendedReports
      ? {
          extendedReports: {
            title: statsCopy.extendedReports.title,
            subtitle: statsCopy.extendedReports.subtitle,
            summary: statsCopy.extendedReports.summary(
              extendedReports.rowCount,
              extendedReports.minCycleLength,
              extendedReports.maxCycleLength,
            ),
            rows: extendedReports.rows.map((row) => ({
              key: row.key,
              title: statsCopy.extendedReports.rowTitle(
                formatDisplayDate(row.startDate, locale),
              ),
              cycleLengthLabel: statsCopy.extendedReports.cycleLengthLabel(
                row.cycleLength,
              ),
              periodLengthLabel: statsCopy.extendedReports.periodLengthLabel(
                row.periodLength,
              ),
              comparisonLabel:
                statsCopy.extendedReports.comparisonLabels[row.comparisonKind],
            })),
          },
        }
      : {}),
    predictionExplanation: buildPredictionExplanation(profile, projection, locale),
    notices: buildStatsNotices(profile, history, statsCopy),
    trendChart: {
      title: statsCopy.cycleTrend,
      legendActualLabel: statsCopy.chartActualLabel,
      legendAverageLabel: statsCopy.chartAverageLabel,
      baselineValue:
        history.averageCycleLength > 0 ? history.averageCycleLength : null,
      points: trendPoints.map((point) => ({
        key: point.key,
        label: point.label,
        value: point.value,
      })),
      valueSuffix: "d",
      emptyLabel: statsCopy.noCycleData,
    },
    symptomFrequency: {
      title: statsCopy.symptomFrequency,
      emptyLabel: statsCopy.noSymptomData,
      items: symptomFrequency.map((item) => ({
        id: item.id,
        icon: item.icon,
        label: item.label,
        frequencySummary: item.frequencySummary,
      })),
    },
    lastCycleSymptoms: {
      title: statsCopy.lastCycleSymptomsTitle,
      subtitle: statsCopy.lastCycleSymptomsSubtitle,
      emptyLabel: statsCopy.noCycleSymptomData,
      items: lastCycleSymptoms.map((item) => ({
        id: item.id,
        icon: item.icon,
        label: item.label,
        frequencySummary: item.frequencySummary,
      })),
    },
    symptomPatterns: {
      title: statsCopy.symptomPatternsTitle,
      subtitle: statsCopy.symptomPatternsSubtitle,
      items: symptomPatterns.map((item) => ({
        id: item.id,
        icon: item.icon,
        label: item.label,
        summary:
          item.dayStart === item.dayEnd
            ? statsCopy.symptomPatternDay(item.dayStart)
            : statsCopy.symptomPatternDays(item.dayStart, item.dayEnd),
      })),
    },
    phaseMoodInsights: {
      title: statsCopy.phaseMoodTitle,
      subtitle: statsCopy.phaseMoodSubtitle,
      items: phaseMoodInsights.map((item) => ({
        key: item.phase,
        phase: statsCopy.phaseLabels[item.phase],
        icon: statsCopy.phaseIcons[item.phase],
        hasData: item.hasData,
        averageMood: item.hasData ? `${item.averageMood.toFixed(1)} / 5` : "",
        percentage: item.percentage,
        countLabel: statsCopy.phaseMoodCount(item.entryCount),
        emptyLabel: statsCopy.phaseMoodEmpty,
      })),
    },
    phaseSymptomInsights: {
      title: statsCopy.phaseSymptomsTitle,
      subtitle: statsCopy.phaseSymptomsSubtitle,
      items: phaseSymptomInsights.map((item) => ({
        key: item.phase,
        phase: statsCopy.phaseLabels[item.phase],
        icon: statsCopy.phaseIcons[item.phase],
        hasData: item.hasData,
        totalDaysLabel: statsCopy.phaseSymptomsDays(item.totalDays),
        emptyLabel: statsCopy.phaseSymptomsEmpty,
        symptoms: item.items.map((symptom) => ({
          id: symptom.id,
          icon: symptom.icon,
          label: symptom.label,
          percentageLabel: `${Math.round(symptom.percentage)}%`,
        })),
      })),
    },
    ...(bbtSeries.length > 0
      ? {
          bbtTrend: {
            title: statsCopy.bbtTitle,
            caption: statsCopy.bbtCaption,
            unitLabel:
              profile.temperatureUnit === "f"
                ? statsCopy.bbtUnitFahrenheit
                : statsCopy.bbtUnitCelsius,
            valueSuffix:
              profile.temperatureUnit === "f"
                ? statsCopy.bbtUnitFahrenheit
                : statsCopy.bbtUnitCelsius,
            points: bbtSeries.map((point) => ({
              key: point.key,
              label: point.label,
              value: point.value,
            })),
          },
        }
      : {}),
    topCards: buildTopCards(
      profile,
      history,
      projection,
      records,
      reliability,
      locale,
      statsCopy,
    ),
    cycleOverview: {
      title: statsCopy.cycleLengthCard,
      averageLabel: statsCopy.averageLabel,
      averageValue:
        history.averageCycleLength > 0
          ? `${Math.round(history.averageCycleLength)} d`
          : statsCopy.noData,
      medianLabel: statsCopy.medianLabel,
      medianValue:
        history.medianCycleLength > 0
          ? `${history.medianCycleLength} d`
          : statsCopy.noData,
      rangeTitle: statsCopy.cycleRange,
      rangeValue:
        history.minCycleLength > 0
          ? statsCopy.cycleRangeSummary(
              history.minCycleLength,
              history.maxCycleLength,
            )
          : statsCopy.noData,
    },
    ...(factorContext
      ? {
          factorContext: {
            title: statsCopy.factorContextTitle,
            description: statsCopy.factorContextWindow(
              STATS_FACTOR_CONTEXT_WINDOW_DAYS,
            ),
            recentFactors: factorContext.recentFactors.map((item) => ({
              key: item.key,
              icon: dayLogCopy.options.cycleFactors[item.key].icon,
              label: dayLogCopy.options.cycleFactors[item.key].label,
              count: item.count,
            })),
            patternSummaries: factorContext.patternSummaries.map((summary) => ({
              key: summary.kind,
              title: statsCopy.factorPatternLabels[summary.kind],
              items: summary.items.map((item) => ({
                key: item.key,
                icon: dayLogCopy.options.cycleFactors[item.key].icon,
                label: dayLogCopy.options.cycleFactors[item.key].label,
                count: item.count,
              })),
            })),
            recentCycles: factorContext.recentCycles.map((cycle) => ({
              startDate: formatDisplayDate(cycle.startDate, locale),
              endDate: formatDisplayDate(cycle.endDate, locale),
              title: statsCopy.factorCycleLength(cycle.cycleLength),
              comparisonLabel: statsCopy.factorCycleKinds[cycle.comparisonKind],
              factors: cycle.factorKeys.map((key) => ({
                key,
                icon: dayLogCopy.options.cycleFactors[key].icon,
                label: dayLogCopy.options.cycleFactors[key].label,
              })),
            })),
            hint: statsCopy.factorContextHint,
          },
        }
      : {}),
  };
}

function buildAdvancedInsightsSection(
  premiumInsights: ReturnType<typeof buildStatsPremiumInsights>,
  statsCopy: ReturnType<typeof getStatsCopy>,
): StatsPremiumSectionViewData | null {
  const items: StatsPremiumSectionViewData["items"] = [];

  if (premiumInsights.weightedAverageCycleLength !== null) {
    items.push({
      key: "weighted-average",
      title: statsCopy.advancedInsights.weightedAverageTitle,
      value: formatDaysValue(
        premiumInsights.weightedAverageCycleLength,
        statsCopy,
      ),
      description: statsCopy.advancedInsights.weightedAverageDescription(
        premiumInsights.weightedAverageSampleCount,
      ),
      tone: "success",
    });
  }

  if (premiumInsights.patternDrift) {
    const insight = premiumInsights.patternDrift;
    items.push({
      key: "pattern-drift",
      title: statsCopy.advancedInsights.patternDriftTitle,
      value:
        insight.kind === "stable"
          ? statsCopy.advancedInsights.patternDriftStableValue
          : insight.kind === "drifting"
            ? statsCopy.advancedInsights.patternDriftDriftingValue
            : statsCopy.advancedInsights.patternDriftStrongValue,
      description:
        insight.kind === "stable"
          ? statsCopy.advancedInsights.patternDriftStableDescription(
              insight.recentAverage,
              insight.baselineAverage,
            )
          : statsCopy.advancedInsights.patternDriftDescription(
              insight.deltaDays,
              insight.recentAverage,
              insight.baselineAverage,
            ),
      tone:
        insight.kind === "stable"
          ? "success"
          : insight.kind === "drifting"
            ? "info"
            : "warning",
    });
  }

  if (premiumInsights.anomalousCycle) {
    const insight = premiumInsights.anomalousCycle;
    items.push({
      key: "anomalous-cycle",
      title: statsCopy.advancedInsights.anomalousCycleTitle,
      value:
        insight.kind === "longer"
          ? statsCopy.advancedInsights.anomalousCycleLongerValue
          : statsCopy.advancedInsights.anomalousCycleShorterValue,
      description: statsCopy.advancedInsights.anomalousCycleDescription(
        insight.cycleLength,
        insight.baselineLength,
        insight.deltaDays,
      ),
      tone: "warning",
    });
  }

  if (items.length === 0) {
    return null;
  }

  return {
    title: statsCopy.advancedInsights.title,
    subtitle: statsCopy.advancedInsights.subtitle,
    items,
  };
}

function buildAdvancedFertilitySection(
  premiumFertility: NonNullable<ReturnType<typeof buildStatsAdvancedFertility>>,
  profile: ProfileRecord,
  statsCopy: ReturnType<typeof getStatsCopy>,
): StatsPremiumSectionViewData | null {
  const items: StatsPremiumSectionViewData["items"] = [];

  if (
    premiumFertility.observedLutealAverageDays !== null &&
    premiumFertility.observedLutealSampleCount > 0
  ) {
    items.push({
      key: "observed-luteal",
      title: statsCopy.advancedFertility.observedLutealTitle,
      value: statsCopy.advancedFertility.daysValue(
        premiumFertility.observedLutealAverageDays.toFixed(1),
      ),
      description: statsCopy.advancedFertility.observedLutealDescription(
        premiumFertility.observedLutealSampleCount,
        premiumFertility.observedLutealAverageDays.toFixed(1),
      ),
      tone: "info",
    });
  }

  if (premiumFertility.signalCoverageSampleCount > 0) {
    items.push({
      key: "signal-coverage",
      title: statsCopy.advancedFertility.signalCoverageTitle,
      value: statsCopy.advancedFertility.signalCoverageValue(
        premiumFertility.signalCoverageCount,
        premiumFertility.signalCoverageSampleCount,
      ),
      description: statsCopy.advancedFertility.signalCoverageDescription(
        premiumFertility.signalCoverageCount,
        premiumFertility.signalCoverageSampleCount,
      ),
      tone:
        premiumFertility.signalCoverageCount === 0
          ? "warning"
          : premiumFertility.signalCoverageCount >=
              premiumFertility.signalCoverageSampleCount / 2
            ? "success"
            : "info",
    });
  }

  if (premiumFertility.thermalShift) {
    const unitLabel =
      profile.temperatureUnit === "f"
        ? statsCopy.bbtUnitFahrenheit
        : statsCopy.bbtUnitCelsius;
    items.push({
      key: "thermal-shift",
      title: statsCopy.advancedFertility.thermalShiftTitle,
      value:
        premiumFertility.thermalShift.kind === "confirmed"
          ? statsCopy.advancedFertility.thermalShiftConfirmedValue
          : statsCopy.advancedFertility.thermalShiftBuildingValue,
      description:
        premiumFertility.thermalShift.kind === "confirmed"
          ? statsCopy.advancedFertility.thermalShiftConfirmedDescription(
              premiumFertility.thermalShift.rise.toFixed(2),
              unitLabel,
              premiumFertility.thermalShift.sampleCount,
            )
          : statsCopy.advancedFertility.thermalShiftBuildingDescription(
              premiumFertility.thermalShift.rise.toFixed(2),
              unitLabel,
              premiumFertility.thermalShift.sampleCount,
            ),
      tone: premiumFertility.thermalShift.kind === "confirmed" ? "success" : "info",
    });
  }

  if (items.length === 0) {
    return null;
  }

  return {
    title: statsCopy.advancedFertility.title,
    subtitle: statsCopy.advancedFertility.subtitle,
    items,
  };
}

function buildPersonalForecastsSection(
  forecasts: ReturnType<typeof buildStatsPersonalForecasts>,
  statsCopy: ReturnType<typeof getStatsCopy>,
): StatsPremiumSectionViewData | null {
  const items: StatsPremiumSectionViewData["items"] = forecasts.map((forecast) => ({
    key: forecast.id,
    title: forecast.label,
    value:
      forecast.offsetStart <= 0
        ? statsCopy.personalForecasts.aroundNowValue
        : forecast.offsetStart === forecast.offsetEnd
          ? statsCopy.personalForecasts.inDaysValue(forecast.offsetStart)
          : statsCopy.personalForecasts.inDayRangeValue(
              forecast.offsetStart,
              forecast.offsetEnd,
            ),
    description:
      forecast.dayStart === forecast.dayEnd
        ? statsCopy.personalForecasts.descriptionSingle(forecast.dayStart)
        : statsCopy.personalForecasts.descriptionRange(
            forecast.dayStart,
            forecast.dayEnd,
          ),
    tone: forecast.offsetStart <= 0 ? "success" : "info",
  }));

  if (items.length === 0) {
    return null;
  }

  return {
    title: statsCopy.personalForecasts.title,
    subtitle: statsCopy.personalForecasts.subtitle,
    items,
  };
}

function formatDaysValue(
  value: number,
  statsCopy: ReturnType<typeof getStatsCopy>,
): string {
  const rounded = Math.round(value * 10) / 10;
  const displayValue =
    Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);

  return statsCopy.advancedInsights.daysValue(displayValue);
}

function buildTopCards(
  profile: ProfileRecord,
  history: ReturnType<typeof buildCycleHistorySummary>,
  projection: StatsCycleProjection,
  records: readonly DayLogRecord[],
  reliability: ReturnType<typeof buildStatsReliability>,
  locale: string,
  statsCopy: ReturnType<typeof getStatsCopy>,
): StatsTopCardViewData[] {
  const cards: StatsTopCardViewData[] = [
    {
      key: "last-cycle-length",
      title: statsCopy.lastCycleLength,
      value:
        history.lastCycleLength > 0
          ? `${history.lastCycleLength} d`
          : statsCopy.noData,
    },
    {
      key: "last-period-length",
      title: statsCopy.lastPeriodLength,
      value:
        history.lastPeriodLength > 0
          ? `${history.lastPeriodLength} d`
          : statsCopy.noData,
    },
  ];
  const mucusFertilityCard = buildMucusFertilityCard(
    projection,
    records,
    locale,
    statsCopy,
  );

  if (profile.unpredictableCycle) {
    cards.push({
      key: "facts-only",
      title: statsCopy.factsOnlyTitle,
      value: statsCopy.factsOnlyValue,
      description: statsCopy.factsOnlyHint,
    });
  } else if (mucusFertilityCard) {
    cards.push(mucusFertilityCard);
  } else {
    const description =
      projection.currentCycleDay !== null
        ? `Cycle day ${projection.currentCycleDay}`
        : undefined;
    cards.push({
      key: "current-phase",
      title: statsCopy.currentPhase,
      value: buildPhaseValue(projection.currentPhase, statsCopy),
      ...(description ? { description } : {}),
    });
  }

  if (reliability) {
    cards.push({
      key: "prediction-reliability",
      title: statsCopy.predictionReliability,
      value: statsCopy.reliabilityLabels[reliability.kind],
      description: `${
        reliability.usesRecentWindow
          ? statsCopy.reliabilitySampleRecent(reliability.sampleCount)
          : statsCopy.reliabilitySample(reliability.sampleCount)
      } ${
        reliability.hintKind === "variable"
          ? statsCopy.reliabilityHintVariable
          : statsCopy.reliabilityHint
      }`,
    });
  }

  return cards;
}

function buildMucusFertilityCard(
  projection: StatsCycleProjection,
  records: readonly DayLogRecord[],
  locale: string,
  statsCopy: ReturnType<typeof getStatsCopy>,
): StatsTopCardViewData | null {
  const cycleAnchorDate = projection.cycleAnchorDate;
  if (!cycleAnchorDate) {
    return null;
  }

  const eggWhiteRecords = records
    .filter(
      (record) =>
        record.date >= cycleAnchorDate &&
        record.cervicalMucus === "eggwhite",
    )
    .sort((left, right) => left.date.localeCompare(right.date));
  const latestSignal = eggWhiteRecords[eggWhiteRecords.length - 1];

  if (!latestSignal) {
    return null;
  }

  return {
    key: "mucus-fertility",
    title: statsCopy.mucusFertilityTitle,
    value: statsCopy.mucusFertilityValue,
    description: statsCopy.mucusFertilityDescription(
      formatDisplayDate(latestSignal.date, locale),
    ),
  };
}

function buildStatsNotices(
  profile: ProfileRecord,
  history: ReturnType<typeof buildCycleHistorySummary>,
  statsCopy: ReturnType<typeof getStatsCopy>,
): string[] {
  const notices: string[] = [];

  if (!history.hasReliableTrend) {
    notices.push(statsCopy.dataNotice);
  }
  if (shouldShowIrregularityNotice(profile, history)) {
    notices.push(
      statsCopy.irregularNotice(history.minCycleLength, history.maxCycleLength),
    );
  }
  if (shouldShowIrregularModeRecommendation(profile, history)) {
    notices.push(statsCopy.irregularRecommendation);
  }
  if (shouldShowAgeVariabilityHint(profile)) {
    notices.push(statsCopy.ageVariabilityHint);
  }

  return notices;
}

function buildPhaseValue(
  phase: StatsPhase,
  statsCopy: ReturnType<typeof getStatsCopy>,
): string {
  return `${statsCopy.phaseIcons[phase]} ${statsCopy.phaseLabels[phase]}`;
}

function formatDisplayDate(value: string, locale: string): string {
  const parsed = parseLocalDate(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(parsed);
}

function atLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
