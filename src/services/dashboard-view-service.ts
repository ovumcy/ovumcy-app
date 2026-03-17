import { dashboardCopy } from "../i18n/dashboard-copy";
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
import {
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";

export type DashboardViewData = {
  eyebrow: string;
  title: string;
  description: string;
  statusItems: string[];
  predictionExplanation: string;
  snapshot: {
    title: string;
    items: { label: string; value: string }[];
  };
  journal: {
    title: string;
    description: string;
    dateLabel: string;
  };
};

export type LoadedDashboardState = {
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
  const [profile, todayEntry, historyRecords] = await Promise.all([
    storage.readProfileRecord(),
    storage.readDayLogRecord(today),
    storage.listDayLogRecordsInRange(rangeStart, today),
  ]);
  const history = buildCycleHistorySummary(profile, historyRecords, now);

  return {
    profile,
    todayEntry,
    viewData: buildDashboardViewData(
      profile,
      todayEntry,
      historyRecords,
      history,
      now,
      locale,
    ),
    editorViewData: buildDayLogEditorViewData(profile, today, locale),
  };
}

export function buildDashboardViewData(
  profile: ProfileRecord,
  todayEntry: DayLogRecord,
  historyRecords: DayLogRecord[],
  history: ReturnType<typeof buildCycleHistorySummary>,
  now: Date,
  locale = "en",
): DashboardViewData {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const projectedCycle = buildCurrentCycleProjection(
    profile,
    history,
    historyRecords,
    now,
  );
  const statusItems = buildStatusItems(profile, projectedCycle, locale);

  return {
    eyebrow: dashboardCopy.eyebrow,
    title: dashboardCopy.title,
    description: dashboardCopy.subtitle,
    statusItems,
    predictionExplanation: buildPredictionExplanation(profile, projectedCycle),
    snapshot: {
      title: dashboardCopy.cycleSnapshot,
      items: [
        {
          label: dashboardCopy.averageCycle,
          value: `${profile.cycleLength} d`,
        },
        {
          label: dashboardCopy.averagePeriod,
          value: `${profile.periodLength} d`,
        },
        {
          label: dashboardCopy.lastPeriodStart,
          value: profile.lastPeriodStart
            ? formatDisplayDate(profile.lastPeriodStart, locale)
            : dashboardCopy.noDate,
        },
        {
          label: "Mode",
          value: profile.unpredictableCycle
            ? dashboardCopy.cycleModeUnpredictable
            : profile.irregularCycle
              ? dashboardCopy.cycleModeIrregular
              : dashboardCopy.cycleModeRegular,
        },
      ],
    },
    journal: {
      title: dashboardCopy.todayEditor,
      description: buildJournalDescription(profile, todayEntry),
      dateLabel: new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(today),
    },
  };
}

function buildStatusItems(
  profile: ProfileRecord,
  summary: ReturnType<typeof buildCurrentCycleProjection>,
  locale: string,
): string[] {
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
      `${dashboardCopy.nextPeriod}: around ${formatDisplayDate(summary.nextPeriodDate, locale)}`,
    );
    items.push(dashboardCopy.nextPeriodNeedsCycles);
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
  }

  return items;
}

function buildPredictionExplanation(
  profile: ProfileRecord,
  summary: ReturnType<typeof buildCurrentCycleProjection>,
): string {
  if (profile.unpredictableCycle) {
    return dashboardCopy.factsOnlyHint;
  }

  if (!profile.lastPeriodStart) {
    return dashboardCopy.nextPeriodPrompt;
  }

  if (profile.irregularCycle) {
    return dashboardCopy.nextPeriodNeedsCycles;
  }

  if (!summary.ovulationDate) {
    return dashboardCopy.ovulationUnavailable;
  }

  return dashboardCopy.cycleFactorsHint;
}

function buildJournalDescription(
  profile: ProfileRecord,
  todayEntry: DayLogRecord,
): string {
  const sections: string[] = [
    dashboardCopy.periodDay,
    dashboardCopy.symptoms,
    dashboardCopy.mood,
    dashboardCopy.cycleFactors,
  ];

  if (!profile.hideSexChip) {
    sections.push(dashboardCopy.intimacy);
  }
  if (profile.trackCervicalMucus) {
    sections.push(dashboardCopy.cervicalMucus);
  }
  if (profile.trackBBT) {
    sections.push(dashboardCopy.bbt);
  }
  if (todayEntry.notes.trim()) {
    sections.push(dashboardCopy.notes);
  }

  return `Visible today: ${sections.join(", ")}.`;
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
