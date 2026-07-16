import { getDashboardCopy } from "../i18n/dashboard-copy";
import { getStatsCopy } from "../i18n/stats-copy";
import type { DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildDayLogEditorViewData,
  type DayLogEditorViewData,
} from "./day-log-editor-service";
import {
  buildCycleHistorySummary,
  buildCurrentCycleProjection,
} from "./cycle-history-service";
import { calcOvulationDay } from "./cycle-prediction-policy";
import { buildPredictionExplanation } from "./prediction-explanation-service";
import { filterKnownSymptomIDs } from "./symptom-policy";
import {
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";
import {
  buildCurrentCycleAdvancedFertilitySummary,
  type CurrentCycleAdvancedFertilitySummaryViewData,
} from "./current-cycle-advanced-fertility-summary-service";

type DashboardCycleHeroPhaseKey =
  | "period"
  | "follicular"
  | "ovulation"
  | "luteal";

export type DashboardCycleHeroViewData = {
  state: "regular" | "approximate" | "facts_only" | "unknown" | "stale";
  title: string;
  value: string;
  detail: string;
  caption: string;
  // Web parity (dashboard.html:122, DisplayOvulationDate): the upcoming-ovulation
  // line the dashboard shows next to the next-period caption. Precomputed and
  // formatted here (never parsed by UI) — null hides the element entirely.
  // `projection.upcomingOvulationDate` is null/undefined on every
  // non-predictable path (pregnancy pause, unpredictable-cycle mode, no
  // resolvable anchor, or an uncalculable window) — see the doc comment on
  // that field in src/models/stats.ts — so hiding on that one falsy check is
  // sufficient and needs no separate gating here.
  upcomingOvulationLabel: string | null;
  progressPercent: number | null;
  currentTone: DashboardCycleHeroPhaseKey | "neutral";
  phaseSegments: {
    key: DashboardCycleHeroPhaseKey;
    startPercent: number;
    endPercent: number;
    tone: DashboardCycleHeroPhaseKey;
  }[];
  phaseCards: {
    key: DashboardCycleHeroPhaseKey;
    label: string;
    rangeLabel: string;
    tone: DashboardCycleHeroPhaseKey;
    active: boolean;
  }[];
};

export type DashboardViewData = {
  cycleHero: DashboardCycleHeroViewData;
  predictionExplanation: string;
  // Web parity (dashboard.html data-dashboard-prediction-disclaimer): a
  // persistent "estimates, not medical advice or contraception" disclaimer near
  // the prediction surfaces. Always present on the dashboard, which is the
  // owner's own-device surface (web gates on {{if .IsOwner}}; the partner shared
  // view is a separate screen and never reuses this view-data).
  predictionDisclaimer: string;
  advancedFertilitySummary?: CurrentCycleAdvancedFertilitySummaryViewData;
  quickActionsTitle: string;
  quickActions: {
    period: string;
    mood: string;
    symptom: string;
  };
  journal: {
    title: string;
    dateLabel: string;
  };
};

export type LoadedDashboardState = {
  historyRecords: DayLogRecord[];
  profile: ProfileRecord;
  todayEntry: DayLogRecord;
  viewData: DashboardViewData;
  editorViewData: DayLogEditorViewData;
};

export async function loadDashboardScreenState(
  storage: LocalAppStorage,
  now: Date,
  locale = "en",
  options: {
    showLHTests?: boolean;
  } = {},
): Promise<LoadedDashboardState> {
  const today = formatLocalDate(now);
  const rangeStart = formatLocalDate(
    new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()),
  );
  const [profile, todayEntry, historyRecords, symptomRecords] = await Promise.all([
    storage.readProfileRecord(),
    storage.readDayLogRecord(today),
    storage.listDayLogRecordsInRange(rangeStart, today),
    storage.listSymptomRecords(),
  ]);
  const filteredTodayEntry: DayLogRecord = {
    ...todayEntry,
    symptomIDs: filterKnownSymptomIDs(symptomRecords, todayEntry.symptomIDs),
  };
  const history = buildCycleHistorySummary(profile, historyRecords, now);
  const editorPremiumOptions =
    options.showLHTests === true ? { showLHTests: true as const } : {};

  return {
    historyRecords,
    profile,
    todayEntry: filteredTodayEntry,
    viewData: buildDashboardViewData(
      profile,
      historyRecords,
      history,
      now,
      locale,
      {
        showAdvancedFertilitySummary: options.showLHTests === true,
      },
    ),
    editorViewData: buildDayLogEditorViewData(
      profile,
      today,
      symptomRecords,
      filteredTodayEntry.symptomIDs,
      locale,
      editorPremiumOptions,
      {
        historyRecords,
        now,
      },
    ),
  };
}

export function buildDashboardViewData(
  profile: ProfileRecord,
  historyRecords: DayLogRecord[],
  history: ReturnType<typeof buildCycleHistorySummary>,
  now: Date,
  locale = "en",
  options: {
    showAdvancedFertilitySummary?: boolean;
  } = {},
): DashboardViewData {
  const dashboardCopy = getDashboardCopy(locale);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const projectedCycle = buildCurrentCycleProjection(
    profile,
    history,
    historyRecords,
    now,
  );
  const advancedFertilitySummary =
    options.showAdvancedFertilitySummary === true
      ? buildCurrentCycleAdvancedFertilitySummary(
          history,
          historyRecords,
          projectedCycle.cycleAnchorDate,
          profile.temperatureUnit,
          locale,
        )
      : null;

  return {
    cycleHero: buildDashboardCycleHero(profile, projectedCycle, history, locale),
    predictionExplanation: buildPredictionExplanation(profile, projectedCycle, locale),
    predictionDisclaimer: dashboardCopy.predictionDisclaimer,
    ...(advancedFertilitySummary ? { advancedFertilitySummary } : {}),
    quickActionsTitle: dashboardCopy.quickActionsTitle,
    quickActions: {
      period: dashboardCopy.quickActions.period,
      mood: dashboardCopy.quickActions.mood,
      symptom: dashboardCopy.quickActions.symptom,
    },
    journal: {
      title: dashboardCopy.todayEditor,
      dateLabel: new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(today),
    },
  };
}

function buildDashboardCycleHero(
  profile: ProfileRecord,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  history: ReturnType<typeof buildCycleHistorySummary>,
  locale: string,
): DashboardCycleHeroViewData {
  const dashboardCopy = getDashboardCopy(locale);
  const statsCopy = getStatsCopy(locale);
  const cycleDayValue =
    projection.currentCycleDay !== null
      ? String(projection.currentCycleDay)
      : statsCopy.phaseLabels.unknown;
  const heroTitle = dashboardCopy.cycleHeroDayLabel;
  const upcomingOvulationLabel = buildDashboardUpcomingOvulationLabel(
    projection,
    dashboardCopy,
    locale,
  );

  if (projection.isPredictionStale) {
    // Web parity (canRenderDashboardCycleHero=false when CycleDataStale): the
    // segmented hero is suppressed in favour of the text-first surface, but
    // predictions are NOT blanked. We surface the rolled-forward cycle day and a
    // conservative "log your period" hint, plus the rolled-forward next-period
    // date in approximate wording — mirroring web's dashboard-stale status line.
    const staleDayValue =
      projection.currentCycleDay !== null
        ? String(projection.currentCycleDay)
        : statsCopy.phaseLabels.unknown;
    const staleCaption = projection.nextPeriodDate
      ? `${dashboardCopy.nextPeriod}: ${dashboardCopy.approximateDatePrefix} ${formatDisplayDate(
          projection.nextPeriodDate,
          locale,
        )}`
      : `${dashboardCopy.nextPeriod}: ${dashboardCopy.nextPeriodUnknown}`;
    return {
      state: "stale",
      title: heroTitle,
      value: staleDayValue,
      detail: dashboardCopy.cycleHeroStale,
      caption: staleCaption,
      upcomingOvulationLabel,
      progressPercent: null,
      currentTone: "neutral",
      phaseSegments: [],
      phaseCards: [],
    };
  }

  if (profile.unpredictableCycle) {
    return {
      state: "facts_only",
      title: heroTitle,
      value: cycleDayValue,
      detail: dashboardCopy.cycleHeroFactsOnly,
      caption: "",
      upcomingOvulationLabel,
      progressPercent: null,
      currentTone: "neutral",
      phaseSegments: [],
      phaseCards: [],
    };
  }

  if (!projection.cycleAnchorDate || projection.currentCycleDay === null) {
    return {
      state: "unknown",
      title: heroTitle,
      value: statsCopy.phaseLabels.unknown,
      detail: dashboardCopy.cycleHeroWaiting,
      caption: dashboardCopy.nextPeriodPrompt,
      upcomingOvulationLabel,
      progressPercent: null,
      currentTone: "neutral",
      phaseSegments: [],
      phaseCards: [],
    };
  }

  if (profile.irregularCycle && !history.hasReliableTrend) {
    // Web parity: DisplayNextPeriodNeedsData (irregular && completedCycleCount<3)
    // forces canRenderDashboardCycleHero=false, so the segmented ring is
    // suppressed entirely. The text-first surface shows the cycle day plus the
    // approximate next-period date with the needs-more-cycles note as the
    // primary status — not an "approximate" ring in a falsely confident shape.
    return {
      state: "approximate",
      title: heroTitle,
      value: cycleDayValue,
      detail: dashboardCopy.cycleHeroApproximate,
      caption: buildDashboardCycleHeroCaption(profile, projection, history, locale),
      upcomingOvulationLabel,
      progressPercent: null,
      currentTone: "neutral",
      phaseSegments: [],
      phaseCards: [],
    };
  }

  const cyclePhases = buildDashboardCycleHeroPhases(profile, projection, locale);
  const currentTone = resolveDashboardCycleHeroCurrentTone(
    cyclePhases,
    projection.currentCycleDay,
  );
  return {
    state: profile.irregularCycle ? "approximate" : "regular",
    title: heroTitle,
    value: cycleDayValue,
    detail: profile.irregularCycle
      ? dashboardCopy.cycleHeroApproximate
      : dashboardCopy.cycleHeroRegular(projection.predictionCycleLength),
    caption: buildDashboardCycleHeroCaption(profile, projection, history, locale),
    upcomingOvulationLabel,
    progressPercent: resolveDashboardCycleHeroProgressPercent(projection),
    currentTone,
    phaseSegments: cyclePhases.map((phase) => ({
      key: phase.key,
      startPercent: phase.startPercent,
      endPercent: phase.endPercent,
      tone: phase.key,
    })),
    phaseCards: cyclePhases.map((phase) => ({
      key: phase.key,
      label: phase.label,
      rangeLabel: phase.rangeLabel,
      tone: phase.key,
      active: phase.key === currentTone,
    })),
  };
}

function buildDashboardCycleHeroCaption(
  profile: ProfileRecord,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  history: ReturnType<typeof buildCycleHistorySummary>,
  locale: string,
): string {
  const dashboardCopy = getDashboardCopy(locale);
  const rangeLabel = buildDashboardCycleHeroDateRange(projection, locale);

  if (rangeLabel) {
    return `${dashboardCopy.nextPeriod}: ${rangeLabel}`;
  }

  if (!projection.nextPeriodDate) {
    return "";
  }

  const nextPeriodValue = profile.irregularCycle
    ? `${dashboardCopy.approximateDatePrefix} ${formatDisplayDate(
        projection.nextPeriodDate,
        locale,
      )}`
    : formatDisplayDate(projection.nextPeriodDate, locale);

  const suffix =
    profile.irregularCycle && !history.hasReliableTrend
      ? ` · ${dashboardCopy.nextPeriodNeedsMoreCycles}`
      : "";

  return `${dashboardCopy.nextPeriod}: ${nextPeriodValue}${suffix}`;
}

function buildDashboardUpcomingOvulationLabel(
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  dashboardCopy: ReturnType<typeof getDashboardCopy>,
  locale: string,
): string | null {
  if (!projection.upcomingOvulationDate) {
    return null;
  }

  return `${dashboardCopy.ovulation}: ${formatDisplayDate(
    projection.upcomingOvulationDate,
    locale,
  )}`;
}

function buildDashboardCycleHeroDateRange(
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  locale: string,
): string | null {
  const startDate = projection.nextPeriodWindowStartDate;
  const endDate = projection.nextPeriodWindowEndDate;

  if (!startDate || !endDate) {
    return null;
  }

  if (startDate === endDate) {
    return null;
  }

  return formatDisplayDateRange(startDate, endDate, locale);
}

function resolveDashboardCycleHeroProgressPercent(
  projection: ReturnType<typeof buildCurrentCycleProjection>,
): number | null {
  if (projection.currentCycleDay === null) {
    return null;
  }

  const denominator = Math.max(projection.predictionCycleLength, 1);
  const normalized = (projection.currentCycleDay - 1) / denominator;

  return clampPercent(normalized);
}

function buildDashboardCycleHeroPhases(
  profile: ProfileRecord,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  locale: string,
): {
  key: DashboardCycleHeroPhaseKey;
  label: string;
  rangeLabel: string;
  startDay: number;
  endDay: number;
  startPercent: number;
  endPercent: number;
}[] {
  const dashboardCopy = getDashboardCopy(locale);
  const cycleLength = projection.predictionCycleLength;
  const { day: ovulationDay } = calcOvulationDay(
    cycleLength,
    projection.lutealPhase,
  );
  if (!ovulationDay) {
    return [];
  }

  const phaseRanges: {
    key: DashboardCycleHeroPhaseKey;
    label: string;
    startDay: number;
    endDay: number;
  }[] = [
    {
      key: "period",
      label: dashboardCopy.cycleHeroPhaseCards.period,
      startDay: 1,
      endDay: Math.min(profile.periodLength, cycleLength),
    },
    {
      key: "follicular",
      label: dashboardCopy.cycleHeroPhaseCards.follicular,
      startDay: Math.min(profile.periodLength + 1, cycleLength),
      endDay: Math.max(ovulationDay - 1, 0),
    },
    {
      key: "ovulation",
      label: dashboardCopy.cycleHeroPhaseCards.ovulation,
      startDay: ovulationDay,
      endDay: ovulationDay,
    },
    {
      key: "luteal",
      label: dashboardCopy.cycleHeroPhaseCards.luteal,
      startDay: Math.min(ovulationDay + 1, cycleLength),
      endDay: cycleLength,
    },
  ];

  return phaseRanges
    .filter((phase) => phase.startDay >= 1 && phase.endDay >= phase.startDay)
    .map((phase) => ({
      key: phase.key,
      label: phase.label,
      rangeLabel: dashboardCopy.cycleHeroDayRange(phase.startDay, phase.endDay),
      startDay: phase.startDay,
      endDay: phase.endDay,
      startPercent: clampPercent((phase.startDay - 1) / cycleLength),
      endPercent: clampPercent(phase.endDay / cycleLength),
    }));
}

function resolveDashboardCycleHeroCurrentTone(
  phases: {
    key: DashboardCycleHeroPhaseKey;
    startDay: number;
    endDay: number;
  }[],
  currentCycleDay: number | null,
): DashboardCycleHeroViewData["currentTone"] {
  if (currentCycleDay === null) {
    return "neutral";
  }

  const activePhase = phases.find(
    (phase) =>
      currentCycleDay >= phase.startDay && currentCycleDay <= phase.endDay,
  );

  return activePhase?.key ?? "neutral";
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

function formatDisplayDateRange(
  startValue: string,
  endValue: string,
  locale: string,
): string {
  return `${formatDisplayDate(startValue, locale)} - ${formatDisplayDate(
    endValue,
    locale,
  )}`;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }

  return value;
}
