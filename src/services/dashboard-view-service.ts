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
    ),
    editorViewData: buildDayLogEditorViewData(
      profile,
      today,
      symptomRecords,
      filteredTodayEntry.symptomIDs,
      locale,
    ),
  };
}

export function buildDashboardViewData(
  profile: ProfileRecord,
  historyRecords: DayLogRecord[],
  history: ReturnType<typeof buildCycleHistorySummary>,
  now: Date,
  locale = "en",
): DashboardViewData {
  const dashboardCopy = getDashboardCopy(locale);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const projectedCycle = buildCurrentCycleProjection(
    profile,
    history,
    historyRecords,
    now,
  );

  return {
    cycleHero: buildDashboardCycleHero(profile, projectedCycle, locale),
    predictionExplanation: buildPredictionExplanation(profile, projectedCycle, locale),
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
  locale: string,
): DashboardCycleHeroViewData {
  const dashboardCopy = getDashboardCopy(locale);
  const statsCopy = getStatsCopy(locale);
  const cycleDayValue =
    projection.currentCycleDay !== null
      ? String(projection.currentCycleDay)
      : statsCopy.phaseLabels.unknown;
  const heroTitle = dashboardCopy.cycleHeroDayLabel;

  if (projection.isPredictionStale) {
    return {
      state: "stale",
      title: heroTitle,
      value: statsCopy.phaseLabels.unknown,
      detail: dashboardCopy.cycleHeroStale,
      caption: `${dashboardCopy.nextPeriod}: ${dashboardCopy.nextPeriodUnknown}`,
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
    caption: buildDashboardCycleHeroCaption(profile, projection, locale),
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

  return `${dashboardCopy.nextPeriod}: ${nextPeriodValue}`;
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
  const { day: ovulationDay } = calcOvulationDay(cycleLength);
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
