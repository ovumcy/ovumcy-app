import { getDashboardCopy } from "../i18n/dashboard-copy";
import { getDayLogCopy } from "../i18n/day-log-copy";
import { getStatsCopy } from "../i18n/stats-copy";
import type { DayCycleFactorKey, DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import {
  celsiusDeltaToUnit,
  celsiusToUnit,
  roundTemperature,
} from "./temperature-policy";
import {
  STATS_FACTOR_CONTEXT_WINDOW_DAYS,
  STATS_MINIMUM_PHASE_INSIGHTS_CYCLES,
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
  hasDataDrivenPredictionSpan,
  shouldShowAgeVariabilityHint,
  shouldShowIrregularityNotice,
  shouldShowIrregularModeRecommendation,
  shouldShowLongCycleNotice,
  shouldShowShortCycleNotice,
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
import { detectSustainedThermalShift } from "./observed-ovulation-service";
import { buildStatsAdvancedFertility } from "./stats-advanced-fertility-service";
import { buildStatsExtendedReports } from "./stats-extended-reports-service";
import { buildStatsPersonalForecasts } from "./stats-personal-forecasts-service";
import { buildStatsPremiumPhaseInsights } from "./stats-premium-phase-insights-service";
import {
  buildShortLutealHint,
  buildStatsPremiumInsights,
  type StatsShortLutealHint,
} from "./stats-premium-insights-service";
import {
  addDays,
  atLocalDay,
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";
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

export type StatsPremiumLockViewData = {
  eyebrowLabel: string;
  title: string;
  description: string;
  ctaLabel: string;
};

export type StatsViewData = {
  title: string;
  description: string;
  hasInsights: boolean;
  // Web parity (stats.html data-stats-prediction-disclaimer): the same
  // persistent "estimates, not medical advice or contraception" disclaimer the
  // dashboard shows, reusing the shared `dashboard.prediction_disclaimer` copy.
  // Always present on this owner surface — including the empty state — so the
  // Medical-safety invariant holds regardless of whether insights are unlocked.
  predictionDisclaimer: string;
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
  premiumLocks?: {
    advancedInsights?: StatsPremiumLockViewData;
    advancedFertility?: StatsPremiumLockViewData;
    extendedReports?: StatsPremiumLockViewData;
  };
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
    // Free-tier baseline signals matching ovumcy-web's owner BBT chart: the
    // coverline (drawn only once a sustained shift is confirmed) and the
    // probable-ovulation caption. These are baseline local analytics, never
    // gated behind managed premium (see SECURITY.md).
    coverlineValue: number | null;
    coverlineLabel: string;
    probableOvulationLabel: string | null;
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
    partnerAccess: false,
    reminders: false,
  },
): Promise<LoadedStatsState> {
  const today = atLocalDay(now);
  const rangeStart = formatLocalDate(
    new Date(today.getFullYear() - 2, today.getMonth(), today.getDate()),
  );
  const rangeEnd = formatLocalDate(today);
  const [profile, records, symptomRecords, activePregnancy] = await Promise.all([
    storage.readProfileRecord(),
    storage.listDayLogRecordsInRange(rangeStart, rangeEnd),
    storage.listSymptomRecords(),
    storage.readActivePregnancy(),
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
      {
        // An ACTIVE pregnancy record must suppress stats
        // predictions even when resolvePregnancyPause (cycle-history-service,
        // untouched) has itself lifted the pause -- e.g. a period/bleeding day
        // logged after the latest positive test while the pregnancy is still
        // being tracked. Same flag, same meaning, same storage read as
        // loadCalendarScreenState.
        suppressPredictions: activePregnancy !== null,
      },
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
    partnerAccess: false,
    reminders: false,
  },
  options: {
    // Additive: true when an active pregnancy record exists -- the record's
    // status alone, with no gestational-age condition, so a record whose GA
    // has left the trackable window suppresses exactly the same.
    // A period logged after the latest positive test lifts
    // resolvePregnancyPause's own pause (cycle-history-service, untouched by
    // this option) -- during an ACTIVE pregnancy that lift is medically wrong,
    // so this flag suppresses the prediction-bearing sections (BBT current
    // cycle, prediction explanation, personal forecasts, current-cycle
    // fertility signals, phase/mucus top cards) independently of
    // projection.isPregnancyPaused. The builder ORs the day-log pause in
    // itself (the paused projection deliberately keeps cycleAnchorDate, so
    // anchor-driven sections are not covered by the pause alone). Defaults to
    // false, so a caller without the record still gets pause-driven
    // suppression, never less.
    suppressPredictions?: boolean;
  } = {},
): StatsViewData {
  const hasActivePregnancy = options.suppressPredictions ?? false;
  const statsCopy = getStatsCopy(locale);
  const dashboardCopy = getDashboardCopy(locale);
  const dayLogCopy = getDayLogCopy(locale);
  const localizedSymptomRecords = localizeSymptomRecords(symptomRecords, locale);
  const history = buildCycleHistorySummary(profile, records, now);

  if (!history.hasInsights) {
    return {
      title: statsCopy.title,
      description: statsCopy.subtitle,
      hasInsights: false,
      predictionDisclaimer: dashboardCopy.predictionDisclaimer,
      notices: shouldShowAgeVariabilityHint(profile)
        ? [statsCopy.ageVariabilityHint]
        : [],
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
  // Medical-safety suppression (SECURITY.md), mirroring the dashboard: an
  // active pregnancy record OR the un-lifted day-log pause hides every
  // current-cycle fertility signal below. The pause leg cannot ride on the
  // projection alone -- a paused projection deliberately keeps
  // cycleAnchorDate, so the anchor-driven sections (BBT trend/coverline,
  // mucus peak-fertility card, advanced-fertility current-cycle signals)
  // would keep rendering without this OR. predictionExplanation is the one
  // deliberate exception: it stays keyed on hasActivePregnancy so the plain
  // pause keeps its own pregnancyPausedHint (same split as the dashboard).
  const suppressPredictions = hasActivePregnancy || projection.isPregnancyPaused;
  const reliability = buildStatsReliability(profile, history);
  const factorContext = buildStatsFactorContext(profile, history, records, now);
  const trendPoints = buildStatsTrendPoints(history, locale);
  const symptomFrequency = buildStatsSymptomFrequency(records, localizedSymptomRecords);
  const lastCycleSymptoms = buildLastCycleSymptomFrequency(
    history,
    records,
    localizedSymptomRecords,
  );
  const phaseInsightsUnlocked =
    history.completedCycleCount >= STATS_MINIMUM_PHASE_INSIGHTS_CYCLES;
  const symptomPatterns = phaseInsightsUnlocked
    ? buildStatsSymptomPatterns(history, records, localizedSymptomRecords)
    : [];
  const phaseMoodInsights = phaseInsightsUnlocked
    ? buildStatsPhaseMoodInsights(records)
    : [];
  const phaseSymptomInsights = phaseInsightsUnlocked
    ? buildStatsPhaseSymptomInsights(records, localizedSymptomRecords)
    : [];
  const personalForecasts =
    premiumFeatures.advancedInsights && !suppressPredictions
      ? buildStatsPersonalForecasts(symptomPatterns, projection.currentCycleDay)
      : [];
  const premiumInsights = premiumFeatures.advancedInsights
    ? buildStatsPremiumInsights(history)
    : null;
  const premiumPhaseInsights = premiumFeatures.advancedInsights
    ? buildStatsPremiumPhaseInsights(phaseMoodInsights, phaseSymptomInsights)
    : null;
  const shortLutealHint = premiumFeatures.advancedInsights
    ? buildShortLutealHint(history, records)
    : null;
  const advancedInsightsSection = premiumInsights
    ? buildAdvancedInsightsSection(
        premiumInsights,
        premiumPhaseInsights,
        shortLutealHint,
        statsCopy,
      )
    : null;
  const premiumFertility = premiumFeatures.advancedFertility
    ? buildStatsAdvancedFertility(
        history,
        records,
        // A null anchor drops the current-cycle fertility signals (thermal
        // shift, LH peak, ovulation confirmation) while keeping the
        // completed-cycle facts (observed luteal, signal coverage).
        suppressPredictions ? null : projection.cycleAnchorDate,
      )
    : null;
  const advancedFertilitySection = premiumFertility
    ? buildAdvancedFertilitySection(premiumFertility, profile, statsCopy, locale)
    : null;
  const personalForecastsSection =
    personalForecasts.length > 0
      ? buildPersonalForecastsSection(personalForecasts, statsCopy)
      : null;
  const extendedReports = premiumFeatures.extendedReports
    ? buildStatsExtendedReports(history)
    : null;
  // The BBT series and the derived coverline / probable-ovulation marker are
  // current-cycle fertility signals: while suppressPredictions holds (active
  // pregnancy, or the day-log pause), they are phantom math and stay hidden —
  // same rule as the doctor PDF and the partner projection.
  const bbtSeries = suppressPredictions
    ? []
    : buildStatsBBTSeries(projection, records, now, locale);
  // Free-tier BBT baseline (owner decision 2026-07-20): the coverline and
  // probable-ovulation marker are baseline local analytics shown for free,
  // matching ovumcy-web's owner BBT chart — never gated behind managed premium.
  // Reuse the canonical "3-over-6" detector on the current cycle up to today.
  // (Reaching this point requires history.hasInsights, so a real
  // cycleAnchorDate always exists here; the null check only narrows the type.)
  let bbtCurrentCycleShift: ReturnType<typeof detectSustainedThermalShift> =
    null;
  if (!suppressPredictions && projection.cycleAnchorDate) {
    bbtCurrentCycleShift = detectSustainedThermalShift(
      records.filter((record) => record.date <= formatLocalDate(now)),
      projection.cycleAnchorDate,
    );
  }
  const bbtCoverlineValue = bbtCurrentCycleShift
    ? roundTemperature(
        celsiusToUnit(bbtCurrentCycleShift.coverline, profile.temperatureUnit),
      )
    : null;
  let bbtProbableOvulationLabel: string | null = null;
  if (bbtCurrentCycleShift) {
    const shiftStart = parseLocalDate(bbtCurrentCycleShift.shiftStartDate);
    /* istanbul ignore else -- unreachable: detectSustainedThermalShift only
       returns a shift whose shiftStartDate is a real, parseable calendar day
       (its consecutiveness check requires it), so shiftStart is never null. */
    if (shiftStart) {
      // Probable ovulation is the calendar day before the first elevated day.
      const probableOvulationDate = formatLocalDate(addDays(shiftStart, -1));
      bbtProbableOvulationLabel = `${statsCopy.bbtProbableOvulationLabel}: ${formatDisplayDate(
        probableOvulationDate,
        locale,
      )}`;
    }
  }
  const premiumLocks = buildStatsPremiumLocks(premiumFeatures, statsCopy);

  return {
    title: statsCopy.title,
    description: statsCopy.subtitle,
    hasInsights: true,
    predictionDisclaimer: dashboardCopy.predictionDisclaimer,
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
    ...(premiumLocks ? { premiumLocks } : {}),
    // Blanked for an active record only: pregnancyPausedHint instructs "log a
    // new period to resume", which is exactly the wrong instruction while a
    // pregnancy is actively tracked (and would promise a resume the record
    // correctly refuses). The plain day-log pause keeps that hint --
    // buildPredictionExplanation resolves it from the paused projection
    // itself. Dedicated pregnancy-mode notice copy is still open.
    predictionExplanation: hasActivePregnancy
      ? ""
      : buildPredictionExplanation(profile, projection, locale),
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
              value: roundTemperature(
                celsiusToUnit(point.value, profile.temperatureUnit),
              ),
            })),
            coverlineValue: bbtCoverlineValue,
            coverlineLabel: statsCopy.bbtCoverlineLabel,
            probableOvulationLabel: bbtProbableOvulationLabel,
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
      suppressPredictions,
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
  premiumPhaseInsights: ReturnType<typeof buildStatsPremiumPhaseInsights> | null,
  shortLutealHint: StatsShortLutealHint | null,
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

  if (premiumInsights.seasonalPattern) {
    const insight = premiumInsights.seasonalPattern;
    const longestSeasonLabel =
      statsCopy.advancedInsights.seasonLabels[insight.longestSeason];
    const shortestSeasonLabel =
      statsCopy.advancedInsights.seasonLabels[insight.shortestSeason];
    items.push({
      key: "seasonal-pattern",
      title: statsCopy.advancedInsights.seasonalPatternTitle,
      value: longestSeasonLabel,
      description: statsCopy.advancedInsights.seasonalPatternDescription(
        longestSeasonLabel,
        insight.longestAverage,
        shortestSeasonLabel,
        insight.shortestAverage,
        insight.deltaDays,
      ),
      tone: "info",
    });
  }

  if (premiumPhaseInsights?.moodContrast) {
    const insight = premiumPhaseInsights.moodContrast;
    const bestPhaseLabel = statsCopy.phaseLabels[insight.bestPhase];
    const worstPhaseLabel = statsCopy.phaseLabels[insight.worstPhase];
    items.push({
      key: "phase-mood-contrast",
      title: statsCopy.advancedInsights.phaseMoodContrastTitle,
      value: statsCopy.advancedInsights.phaseMoodContrastValue(
        bestPhaseLabel,
        worstPhaseLabel,
      ),
      description: statsCopy.advancedInsights.phaseMoodContrastDescription(
        bestPhaseLabel,
        insight.bestAverageMood,
        worstPhaseLabel,
        insight.worstAverageMood,
        insight.deltaMood,
      ),
      tone: "info",
    });
  }

  if (premiumPhaseInsights?.symptomPeak) {
    const insight = premiumPhaseInsights.symptomPeak;
    const phaseLabel = statsCopy.phaseLabels[insight.phase];
    items.push({
      key: "phase-symptom-peak",
      title: statsCopy.advancedInsights.phaseSymptomPeakTitle,
      value: insight.symptom.label,
      description: statsCopy.advancedInsights.phaseSymptomPeakDescription(
        phaseLabel,
        insight.symptom.label,
        insight.percentage,
        insight.totalDays,
      ),
      tone: insight.percentage >= 50 ? "warning" : "info",
    });
  }

  if (shortLutealHint) {
    items.push({
      key: "short-luteal-warning",
      title: statsCopy.advancedInsights.shortLutealTitle,
      value: statsCopy.advancedInsights.shortLutealValue(
        shortLutealHint.averageDays,
      ),
      description: statsCopy.advancedInsights.shortLutealDescription(
        shortLutealHint.observationCount,
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
  locale: string,
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

  if (premiumFertility.observedLutealConsistency) {
    const consistency = premiumFertility.observedLutealConsistency;
    items.push({
      key: "luteal-consistency",
      title: statsCopy.advancedFertility.lutealConsistencyTitle,
      value:
        consistency.kind === "stable"
          ? statsCopy.advancedFertility.lutealConsistencyStableValue
          : consistency.kind === "variable"
            ? statsCopy.advancedFertility.lutealConsistencyVariableValue
            : statsCopy.advancedFertility.lutealConsistencyStrongValue,
      description: statsCopy.advancedFertility.lutealConsistencyDescription(
        consistency.sampleCount,
        consistency.minDays,
        consistency.maxDays,
        consistency.spreadDays,
      ),
      tone:
        consistency.kind === "stable"
          ? "success"
          : consistency.kind === "variable"
            ? "info"
            : "warning",
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
              celsiusDeltaToUnit(
                premiumFertility.thermalShift.rise,
                profile.temperatureUnit,
              ).toFixed(2),
              unitLabel,
              premiumFertility.thermalShift.sampleCount,
            )
          : statsCopy.advancedFertility.thermalShiftBuildingDescription(
              celsiusDeltaToUnit(
                premiumFertility.thermalShift.rise,
                profile.temperatureUnit,
              ).toFixed(2),
              unitLabel,
              premiumFertility.thermalShift.sampleCount,
            ),
      tone: premiumFertility.thermalShift.kind === "confirmed" ? "success" : "info",
    });
  }

  if (premiumFertility.ovulationConfirmation) {
    const confirmation = premiumFertility.ovulationConfirmation;
    items.push({
      key: "ovulation-confirmation",
      title: statsCopy.advancedFertility.ovulationConfirmationTitle,
      value:
        confirmation.kind === "confirmed"
          ? statsCopy.advancedFertility.ovulationConfirmationConfirmedValue
          : statsCopy.advancedFertility.ovulationConfirmationBuildingValue,
      description: statsCopy.advancedFertility.ovulationConfirmationDescription(
        formatDisplayDate(confirmation.mucusDate, locale),
        confirmation.gapDays,
      ),
      tone: confirmation.kind === "confirmed" ? "success" : "info",
    });
  }

  if (premiumFertility.lhPeakSignal) {
    const lhPeakSignal = premiumFertility.lhPeakSignal;
    items.push({
      key: "lh-peak",
      title: statsCopy.advancedFertility.lhPeakTitle,
      value:
        lhPeakSignal.kind === "aligned"
          ? statsCopy.advancedFertility.lhPeakAlignedValue
          : statsCopy.advancedFertility.lhPeakLoggedValue,
      description:
        lhPeakSignal.kind === "aligned" && lhPeakSignal.gapDays !== null
          ? statsCopy.advancedFertility.lhPeakAlignedDescription(
              formatDisplayDate(lhPeakSignal.date, locale),
              lhPeakSignal.gapDays,
            )
          : statsCopy.advancedFertility.lhPeakLoggedDescription(
              formatDisplayDate(lhPeakSignal.date, locale),
            ),
      tone: lhPeakSignal.kind === "aligned" ? "success" : "info",
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

function buildStatsPremiumLocks(
  premiumFeatures: ManagedCloudPremiumFeatures,
  statsCopy: ReturnType<typeof getStatsCopy>,
): StatsViewData["premiumLocks"] | null {
  const locks: NonNullable<StatsViewData["premiumLocks"]> = {};
  if (!premiumFeatures.advancedInsights) {
    locks.advancedInsights = {
      eyebrowLabel: statsCopy.premiumLock.eyebrowLabel,
      title: statsCopy.premiumLock.advancedInsights.title,
      description: statsCopy.premiumLock.advancedInsights.description,
      ctaLabel: statsCopy.premiumLock.ctaLabel,
    };
  }
  if (!premiumFeatures.advancedFertility) {
    locks.advancedFertility = {
      eyebrowLabel: statsCopy.premiumLock.eyebrowLabel,
      title: statsCopy.premiumLock.advancedFertility.title,
      description: statsCopy.premiumLock.advancedFertility.description,
      ctaLabel: statsCopy.premiumLock.ctaLabel,
    };
  }
  if (!premiumFeatures.extendedReports) {
    locks.extendedReports = {
      eyebrowLabel: statsCopy.premiumLock.eyebrowLabel,
      title: statsCopy.premiumLock.extendedReports.title,
      description: statsCopy.premiumLock.extendedReports.description,
      ctaLabel: statsCopy.premiumLock.ctaLabel,
    };
  }

  return Object.keys(locks).length > 0 ? locks : null;
}

function buildTopCards(
  profile: ProfileRecord,
  history: ReturnType<typeof buildCycleHistorySummary>,
  projection: StatsCycleProjection,
  records: readonly DayLogRecord[],
  reliability: ReturnType<typeof buildStatsReliability>,
  locale: string,
  statsCopy: ReturnType<typeof getStatsCopy>,
  suppressPredictions: boolean,
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
  // Suppression drops the "peak fertility" framing and the phase/cycle-day
  // claim entirely: both key off an anchor the paused projection deliberately
  // keeps, which is why the caller ORs the pause into this flag rather than
  // relying on the pause alone. The phase card falls back to the same
  // unknown-phase rendering a genuinely paused projection produces.
  const mucusFertilityCard = suppressPredictions
    ? null
    : buildMucusFertilityCard(projection, records, locale, statsCopy);

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
      !suppressPredictions && projection.currentCycleDay !== null
        ? `Cycle day ${projection.currentCycleDay}`
        : undefined;
    cards.push({
      key: "current-phase",
      title: statsCopy.currentPhase,
      value: buildPhaseValue(
        suppressPredictions ? "unknown" : projection.currentPhase,
        statsCopy,
      ),
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
  if (shouldShowShortCycleNotice(history)) {
    notices.push(statsCopy.shortCycleNotice);
  }
  if (shouldShowLongCycleNotice(history)) {
    notices.push(statsCopy.longCycleNotice);
  }
  if (hasDataDrivenPredictionSpan(profile, history)) {
    notices.push(statsCopy.dataDrivenRangeHint);
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

