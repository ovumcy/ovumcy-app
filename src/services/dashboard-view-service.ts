import { dashboardCopy } from "../i18n/dashboard-copy";
import type { DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildDayLogEditorViewData,
  type DayLogEditorViewData,
} from "./day-log-editor-service";
import {
  addDays,
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
  const [profile, todayEntry] = await Promise.all([
    storage.readProfileRecord(),
    storage.readDayLogRecord(today),
  ]);

  return {
    profile,
    todayEntry,
    viewData: buildDashboardViewData(profile, todayEntry, now, locale),
    editorViewData: buildDayLogEditorViewData(profile, today, locale),
  };
}

export function buildDashboardViewData(
  profile: ProfileRecord,
  todayEntry: DayLogRecord,
  now: Date,
  locale = "en",
): DashboardViewData {
  const today = atLocalDay(now);
  const projectedCycle = projectCurrentCycle(profile, today);
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
  summary: ProjectedCycleSummary,
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
  summary: ProjectedCycleSummary,
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

type ProjectedCycleSummary = {
  currentCycleDay: number | null;
  nextPeriodDate: string | null;
  ovulationDate: string | null;
};

function projectCurrentCycle(
  profile: ProfileRecord,
  today: Date,
): ProjectedCycleSummary {
  if (!profile.lastPeriodStart) {
    return {
      currentCycleDay: null,
      nextPeriodDate: null,
      ovulationDate: null,
    };
  }

  const lastPeriodStart = parseLocalDate(profile.lastPeriodStart);
  if (!lastPeriodStart) {
    return {
      currentCycleDay: null,
      nextPeriodDate: null,
      ovulationDate: null,
    };
  }

  const cycleLength = Math.max(1, profile.cycleLength);
  let cycleStart = atLocalDay(lastPeriodStart);

  while (addDays(cycleStart, cycleLength) <= today) {
    cycleStart = addDays(cycleStart, cycleLength);
  }

  const currentCycleDay =
    Math.floor((today.getTime() - cycleStart.getTime()) / 86400000) + 1;
  const nextPeriodDate = formatLocalDate(addDays(cycleStart, cycleLength));
  const ovulationOffset = Math.max(cycleLength - 14, 1);

  return {
    currentCycleDay,
    nextPeriodDate,
    ovulationDate: profile.irregularCycle
      ? null
      : formatLocalDate(addDays(cycleStart, ovulationOffset)),
  };
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
