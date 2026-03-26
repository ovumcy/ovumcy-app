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
import { buildPredictionExplanation } from "./prediction-explanation-service";
import { filterKnownSymptomIDs } from "./symptom-policy";
import {
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";

export type DashboardCycleHeroViewData = {
  state: "regular" | "approximate" | "facts_only" | "unknown" | "stale";
  title: string;
  icon: string;
  value: string;
  detail: string;
  caption: string;
  progressPercent: number | null;
  markers: {
    key: "start" | "fertile" | "ovulation";
    label: string;
    offsetPercent: number;
    tone: "period" | "fertile" | "ovulation";
  }[];
};

export type DashboardViewData = {
  cycleHero: DashboardCycleHeroViewData;
  phaseStatus: {
    icon: string;
    label: string;
  };
  statusItems: string[];
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
  const statusItems = buildStatusItems(profile, projectedCycle, locale);

  return {
    cycleHero: buildDashboardCycleHero(profile, projectedCycle, locale),
    phaseStatus: buildPhaseStatus(projectedCycle.currentPhase, locale),
    statusItems,
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

function buildPhaseStatus(
  phase: ReturnType<typeof buildCurrentCycleProjection>["currentPhase"],
  locale = "en",
) {
  const statsCopy = getStatsCopy(locale);
  return {
    icon: statsCopy.phaseIcons[phase],
    label: statsCopy.phaseLabels[phase],
  };
}

function buildDashboardCycleHero(
  profile: ProfileRecord,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  locale: string,
): DashboardCycleHeroViewData {
  const dashboardCopy = getDashboardCopy(locale);
  const statsCopy = getStatsCopy(locale);
  const phaseStatus = buildPhaseStatus(projection.currentPhase, locale);
  const cycleDayValue =
    projection.currentCycleDay !== null
      ? dashboardCopy.cycleHeroDay(projection.currentCycleDay)
      : statsCopy.phaseLabels.unknown;

  if (projection.isPredictionStale) {
    return {
      state: "stale",
      title: statsCopy.phaseLabels.unknown,
      icon: statsCopy.phaseIcons.unknown,
      value: statsCopy.phaseLabels.unknown,
      detail: dashboardCopy.cycleHeroStale,
      caption: `${dashboardCopy.nextPeriod}: ${dashboardCopy.nextPeriodUnknown}`,
      progressPercent: null,
      markers: [],
    };
  }

  if (profile.unpredictableCycle) {
    return {
      state: "facts_only",
      title: statsCopy.factsOnlyTitle,
      icon: statsCopy.phaseIcons.unknown,
      value: cycleDayValue,
      detail: dashboardCopy.cycleHeroFactsOnly,
      caption: "",
      progressPercent: null,
      markers: buildDashboardCycleHeroMarkers(projection, locale),
    };
  }

  if (!projection.cycleAnchorDate || projection.currentCycleDay === null) {
    return {
      state: "unknown",
      title: statsCopy.phaseLabels.unknown,
      icon: statsCopy.phaseIcons.unknown,
      value: statsCopy.phaseLabels.unknown,
      detail: dashboardCopy.cycleHeroWaiting,
      caption: dashboardCopy.nextPeriodPrompt,
      progressPercent: null,
      markers: [],
    };
  }

  return {
    state: profile.irregularCycle ? "approximate" : "regular",
    title: phaseStatus.label,
    icon: phaseStatus.icon,
    value: cycleDayValue,
    detail: profile.irregularCycle
      ? dashboardCopy.cycleHeroApproximate
      : dashboardCopy.cycleHeroRegular(projection.predictionCycleLength),
    caption: buildDashboardCycleHeroCaption(profile, projection, locale),
    progressPercent: resolveDashboardCycleHeroProgressPercent(projection),
    markers: buildDashboardCycleHeroMarkers(projection, locale),
  };
}

function buildStatusItems(
  profile: ProfileRecord,
  summary: ReturnType<typeof buildCurrentCycleProjection>,
  locale: string,
): string[] {
  const dashboardCopy = getDashboardCopy(locale);

  if (profile.unpredictableCycle) {
    return [
      `${dashboardCopy.nextPeriod}: ${dashboardCopy.nextPeriodUnknown}`,
      dashboardCopy.predictionsOff,
    ];
  }

  const items: string[] = [];

  if (summary.isPredictionStale) {
    return [
      `${dashboardCopy.nextPeriod}: ${dashboardCopy.nextPeriodUnknown}`,
      `${dashboardCopy.ovulation}: ${dashboardCopy.ovulationUnavailable}`,
    ];
  }

  if (summary.currentCycleDay !== null) {
    items.push(`${dashboardCopy.cycleDay} ${summary.currentCycleDay}`);
  }

  if (!profile.lastPeriodStart) {
    items.push(`${dashboardCopy.nextPeriod}: ${dashboardCopy.nextPeriodPrompt}`);
    return items;
  }

  if (profile.irregularCycle && summary.nextPeriodDate) {
    items.push(
      `${dashboardCopy.nextPeriod}: ${dashboardCopy.approximateDatePrefix} ${formatDisplayDate(summary.nextPeriodDate, locale)}`,
    );
    if (summary.ovulationDate) {
      items.push(
        `${dashboardCopy.ovulation}: ${dashboardCopy.approximateDatePrefix} ${formatDisplayDate(summary.ovulationDate, locale)}`,
      );
    } else {
      items.push(`${dashboardCopy.ovulation}: ${dashboardCopy.ovulationUnavailable}`);
    }
    return items;
  }

  if (summary.nextPeriodDate) {
    items.push(
      `${dashboardCopy.nextPeriod}: ${formatDisplayDate(summary.nextPeriodDate, locale)}`,
    );
  }

  if (summary.ovulationDate) {
    items.push(
      `${dashboardCopy.ovulation}: ${formatDisplayDate(summary.ovulationDate, locale)}`,
    );
  } else {
    items.push(`${dashboardCopy.ovulation}: ${dashboardCopy.ovulationUnavailable}`);
  }

  return items;
}

function buildDashboardCycleHeroCaption(
  profile: ProfileRecord,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  locale: string,
): string {
  const dashboardCopy = getDashboardCopy(locale);

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

function resolveDashboardCycleHeroProgressPercent(
  projection: ReturnType<typeof buildCurrentCycleProjection>,
): number | null {
  if (projection.currentCycleDay === null) {
    return null;
  }

  const denominator = Math.max(projection.predictionCycleLength - 1, 1);
  const normalized =
    (projection.currentCycleDay - 1) / denominator;

  return clampPercent(normalized);
}

function buildDashboardCycleHeroMarkers(
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  locale: string,
): DashboardCycleHeroViewData["markers"] {
  const dashboardCopy = getDashboardCopy(locale);
  const markers: DashboardCycleHeroViewData["markers"] = [
    {
      key: "start",
      label: dashboardCopy.cycleHeroLegendStart,
      offsetPercent: 0,
      tone: "period",
    },
  ];

  if (!projection.cycleAnchorDate || !projection.ovulationDate) {
    return markers;
  }

  const anchor = parseLocalDate(projection.cycleAnchorDate);
  const ovulation = parseLocalDate(projection.ovulationDate);
  if (!anchor || !ovulation) {
    return markers;
  }

  const denominator = Math.max(projection.predictionCycleLength - 1, 1);
  const ovulationOffset = diffLocalDays(anchor, ovulation);
  const fertileOffset = Math.max(ovulationOffset - 5, 0);

  markers.push(
    {
      key: "fertile",
      label: dashboardCopy.cycleHeroLegendFertile,
      offsetPercent: clampPercent(fertileOffset / denominator),
      tone: "fertile",
    },
    {
      key: "ovulation",
      label: dashboardCopy.cycleHeroLegendOvulation,
      offsetPercent: clampPercent(ovulationOffset / denominator),
      tone: "ovulation",
    },
  );

  return markers;
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

function diffLocalDays(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startValue = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  ).getTime();
  const endValue = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  ).getTime();

  return Math.round((endValue - startValue) / msPerDay);
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
