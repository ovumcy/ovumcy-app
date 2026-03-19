import { dayLogCopy } from "../i18n/day-log-copy";
import { statsCopy } from "../i18n/stats-copy";
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
import {
  buildLastCycleSymptomFrequency,
  buildStatsBBTSeries,
  buildStatsPhaseMoodInsights,
  buildStatsPhaseSymptomInsights,
  buildStatsSymptomFrequency,
  buildStatsSymptomPatterns,
  buildStatsTrendPoints,
} from "./stats-insights-service";
import { formatLocalDate, parseLocalDate } from "./profile-settings-policy";

export type StatsTopCardViewData = {
  key: string;
  title: string;
  value: string;
  description?: string;
};

export type StatsViewData = {
  title: string;
  description: string;
  hasInsights: boolean;
  predictionExplanation?: string;
  emptyState?: {
    title: string;
    body: string;
    progressLabel: string;
    progressPercent: number;
    hint: string;
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
    viewData: buildStatsViewData(profile, records, symptomRecords, now, locale),
  };
}

export function buildStatsViewData(
  profile: ProfileRecord,
  records: DayLogRecord[],
  symptomRecords: SymptomRecord[],
  now: Date,
  locale = "en",
): StatsViewData {
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
        progressLabel: statsCopy.completedCyclesProgress(
          history.completedCycleCount,
        ),
        progressPercent: history.insightProgress,
        hint: statsCopy.emptyProgressHint,
      },
    };
  }

  const projection = buildCurrentCycleProjection(profile, history, records, now);
  const reliability = buildStatsReliability(profile, history);
  const factorContext = buildStatsFactorContext(profile, history, records, now);
  const trendPoints = buildStatsTrendPoints(history, locale);
  const symptomFrequency = buildStatsSymptomFrequency(records, symptomRecords);
  const lastCycleSymptoms = buildLastCycleSymptomFrequency(
    history,
    records,
    symptomRecords,
  );
  const symptomPatterns = buildStatsSymptomPatterns(history, records, symptomRecords);
  const phaseMoodInsights = buildStatsPhaseMoodInsights(history, records);
  const phaseSymptomInsights = buildStatsPhaseSymptomInsights(
    history,
    records,
    symptomRecords,
  );
  const bbtSeries = buildStatsBBTSeries(projection, records, now, locale);

  return {
    title: statsCopy.title,
    description: statsCopy.subtitle,
    hasInsights: true,
    predictionExplanation: buildPredictionExplanation(profile, projection),
    notices: buildStatsNotices(profile, history),
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
    topCards: buildTopCards(profile, history, projection, reliability),
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

function buildTopCards(
  profile: ProfileRecord,
  history: ReturnType<typeof buildCycleHistorySummary>,
  projection: StatsCycleProjection,
  reliability: ReturnType<typeof buildStatsReliability>,
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

  if (profile.unpredictableCycle) {
    cards.push({
      key: "facts-only",
      title: statsCopy.factsOnlyTitle,
      value: statsCopy.factsOnlyValue,
      description: statsCopy.factsOnlyHint,
    });
  } else {
    const description =
      projection.currentCycleDay !== null
        ? `Cycle day ${projection.currentCycleDay}`
        : undefined;
    cards.push({
      key: "current-phase",
      title: statsCopy.currentPhase,
      value: buildPhaseValue(projection.currentPhase),
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

function buildStatsNotices(
  profile: ProfileRecord,
  history: ReturnType<typeof buildCycleHistorySummary>,
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

function buildPhaseValue(phase: StatsPhase): string {
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
