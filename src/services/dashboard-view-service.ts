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

export type DashboardViewData = {
  phaseStatus: {
    icon: string;
    label: string;
  };
  statusItems: string[];
  predictionExplanation: string;
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
    phaseStatus: buildPhaseStatus(projectedCycle.currentPhase, locale),
    statusItems,
    predictionExplanation: buildPredictionExplanation(profile, projectedCycle, locale),
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
