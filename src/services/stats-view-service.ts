import { dayLogCopy } from "../i18n/day-log-copy";
import { statsCopy } from "../i18n/stats-copy";
import type { DayCycleFactorKey, DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
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
  emptyState?: {
    title: string;
    body: string;
    progressLabel: string;
    progressPercent: number;
    hint: string;
  };
  notices: string[];
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
  const [profile, records] = await Promise.all([
    storage.readProfileRecord(),
    storage.listDayLogRecordsInRange(rangeStart, rangeEnd),
  ]);

  return {
    profile,
    records,
    viewData: buildStatsViewData(profile, records, now, locale),
  };
}

export function buildStatsViewData(
  profile: ProfileRecord,
  records: DayLogRecord[],
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

  return {
    title: statsCopy.title,
    description: statsCopy.subtitle,
    hasInsights: true,
    notices: buildStatsNotices(profile, history),
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
