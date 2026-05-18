import { getDayLogCopy } from "../i18n/day-log-copy";
import {
  DAY_CYCLE_FACTOR_KEYS,
  createEmptyDayLogRecord,
  type DayCervicalMucus,
  type DayCycleFactorKey,
  type DayFlow,
  type DayLHTest,
  type DayLogRecord,
  type DaySexActivity,
  type DaySymptomID,
} from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildDayLogVisibility,
  type DayLogVisibilityOptions,
  sanitizeDayLogRecord,
  trimDayLogNotes,
} from "./day-log-policy";
import {
  appendAutoFilledPeriodDays,
  shouldAutoFillPeriodWindowFromSave,
} from "./period-auto-fill-service";
import { resolveLatestCycleStartAnchorBeforeOrOn } from "./cycle-history-service";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";
import {
  filterKnownSymptomIDs,
} from "./symptom-policy";
import { buildLocalizedEntryPickerSymptoms } from "./symptom-presentation-service";

const MIN_CANONICAL_DAY_LOG_DATE = "0001-01-01";
const MAX_CANONICAL_DAY_LOG_DATE = "9999-12-31";

export type DayLogEditorViewData = {
  title: string;
  subtitle: string;
  dateLabel: string;
  visibility: ReturnType<typeof buildDayLogVisibility>;
  labels: {
    periodDay: string;
    symptoms: string;
    mood: string;
    cycleFactors: string;
    cycleFactorsHint: string;
    flow: string;
    intimacy: string;
    cervicalMucus: string;
    cervicalMucusExplainer: string;
    lhTest: string;
    lhTestHint: string;
    bbt: string;
    bbtHint: string;
    notes: string;
    showMoreSymptoms: string;
    showFewerSymptoms: string;
    notesPlaceholder: string;
    periodOffHint: string;
    deleteHint: string;
    deletePrompt: string;
  };
  actions: {
    saveLabel: string;
    updateLabel: string;
    savingLabel: string;
    savedLabel: string;
    saveFailedLabel: string;
    deleteLabel: string;
    deletedLabel: string;
    deleteFailedLabel: string;
  };
  options: {
    mood: readonly { value: number; label: string; secondaryLabel?: string }[];
    flow: readonly { value: DayFlow; label: string }[];
    sexActivity: readonly { value: DaySexActivity; label: string }[];
    cervicalMucus: readonly { value: DayCervicalMucus; label: string }[];
    lhTest: readonly {
      value: DayLHTest;
      label: string;
      secondaryLabel?: string;
    }[];
    cycleFactors: readonly {
      value: DayCycleFactorKey;
      label: string;
      icon: string;
    }[];
    symptoms: readonly {
      value: DaySymptomID;
      label: string;
      icon: string;
    }[];
  };
};

export type LoadedDayLogEditorState = {
  profile: ProfileRecord;
  record: DayLogRecord;
  symptomRecords: SymptomRecord[];
  viewData: DayLogEditorViewData;
};

export type DayLogEditorPremiumOptions = Pick<DayLogVisibilityOptions, "showLHTests">;

export async function loadDayLogEditorState(
  storage: LocalAppStorage,
  date: DayLogRecord["date"],
  locale = "en",
  premiumOptions: DayLogEditorPremiumOptions = {},
): Promise<LoadedDayLogEditorState> {
  const [profile, record, symptomRecords] = await Promise.all([
    storage.readProfileRecord(),
    storage.readDayLogRecord(date),
    storage.listSymptomRecords(),
  ]);
  const filteredRecord: DayLogRecord = {
    ...record,
    symptomIDs: filterKnownSymptomIDs(symptomRecords, record.symptomIDs),
  };

  return {
    profile,
    record: filteredRecord,
    symptomRecords,
    viewData: buildDayLogEditorViewData(
      profile,
      date,
      symptomRecords,
      filteredRecord.symptomIDs,
      locale,
      premiumOptions,
    ),
  };
}

export async function saveDayLogEditorRecord(
  storage: LocalAppStorage,
  record: DayLogRecord,
): Promise<{ ok: true; record: DayLogRecord } | { ok: false }> {
  const [profile, symptomRecords] = await Promise.all([
    storage.readProfileRecord(),
    storage.listSymptomRecords(),
  ]);
  const normalized = sanitizeDayLogRecord({
    ...record,
    symptomIDs: filterKnownSymptomIDs(symptomRecords, record.symptomIDs),
  });
  const relevantRecords = await loadAutoFillRelevantRecords(
    storage,
    profile,
    normalized.date,
  );
  const recordsToWrite = new Map<string, DayLogRecord>([[normalized.date, normalized]]);

  if (shouldAutoFillPeriodWindowFromSave(profile, relevantRecords, normalized)) {
    appendAutoFilledPeriodDays(recordsToWrite, relevantRecords, normalized, profile);
  }

  try {
    for (const nextRecord of recordsToWrite.values()) {
      await storage.writeDayLogRecord(nextRecord);
    }
  } catch {
    return { ok: false };
  }

  return {
    ok: true,
    record: normalized,
  };
}

export async function deleteDayLogEditorRecord(
  storage: LocalAppStorage,
  date: DayLogRecord["date"],
): Promise<boolean> {
  try {
    await storage.deleteDayLogRecord(date);
    return true;
  } catch {
    return false;
  }
}

export async function clearDayLogEditorRecord(
  storage: LocalAppStorage,
  date: DayLogRecord["date"],
): Promise<{ ok: true; record: DayLogRecord } | { ok: false }> {
  try {
    const profile = await storage.readProfileRecord();
    await storage.deleteDayLogRecord(date);
    if (profile.lastPeriodStart === date) {
      const remainingRecords = await storage.listDayLogRecordsInRange(
        MIN_CANONICAL_DAY_LOG_DATE,
        MAX_CANONICAL_DAY_LOG_DATE,
      );
      await storage.writeProfileRecord({
        ...profile,
        lastPeriodStart: resolveLatestCycleStartAnchorBeforeOrOn(
          {
            ...profile,
            lastPeriodStart: null,
          },
          remainingRecords,
          MAX_CANONICAL_DAY_LOG_DATE,
        ),
      });
    }
    return {
      ok: true,
      record: createEmptyDayLogRecord(date),
    };
  } catch {
    return { ok: false };
  }
}

export function buildDayLogEditorViewData(
  profile: ProfileRecord,
  date: DayLogRecord["date"],
  symptomRecords: readonly SymptomRecord[],
  selectedSymptomIDs: readonly DaySymptomID[] = [],
  locale = "en",
  premiumOptions: DayLogEditorPremiumOptions = {},
): DayLogEditorViewData {
  const dayLogCopy = getDayLogCopy(locale);
  const pickerSymptoms = buildLocalizedEntryPickerSymptoms(
    symptomRecords,
    selectedSymptomIDs,
    locale,
  );

  return {
    title: dayLogCopy.title,
    subtitle: dayLogCopy.subtitle,
    dateLabel: formatDayLogDateLabel(date, locale),
    visibility: buildDayLogVisibility(profile, premiumOptions),
    labels: {
      periodDay: dayLogCopy.periodDay,
      symptoms: dayLogCopy.symptoms,
      mood: dayLogCopy.mood,
      cycleFactors: dayLogCopy.cycleFactors,
      cycleFactorsHint: dayLogCopy.cycleFactorsHint,
      flow: dayLogCopy.flow,
      intimacy: dayLogCopy.intimacy,
      cervicalMucus: dayLogCopy.cervicalMucus,
      cervicalMucusExplainer: dayLogCopy.cervicalMucusExplainer,
      lhTest: dayLogCopy.lhTest,
      lhTestHint: dayLogCopy.lhTestHint,
      bbt: dayLogCopy.bbt,
      bbtHint: `${dayLogCopy.bbtHint} ${profile.temperatureUnit === "f" ? "°F" : "°C"}.`,
      notes: dayLogCopy.notes,
      showMoreSymptoms: dayLogCopy.showMoreSymptoms,
      showFewerSymptoms: dayLogCopy.showFewerSymptoms,
      notesPlaceholder: dayLogCopy.notesPlaceholder,
      periodOffHint: dayLogCopy.periodOffHint,
      deleteHint: dayLogCopy.deleteHint,
      deletePrompt: dayLogCopy.deletePrompt,
    },
    actions: {
      saveLabel: dayLogCopy.saveDay,
      updateLabel: dayLogCopy.saveDay,
      savingLabel: dayLogCopy.saving,
      savedLabel: dayLogCopy.saved,
      saveFailedLabel: dayLogCopy.saveFailed,
      deleteLabel: dayLogCopy.deleteEntry,
      deletedLabel: dayLogCopy.deleted,
      deleteFailedLabel: dayLogCopy.deleteFailed,
    },
    options: {
      mood: [...dayLogCopy.options.mood],
      flow: [...dayLogCopy.options.flow],
      sexActivity: [...dayLogCopy.options.sexActivity],
      cervicalMucus: [...dayLogCopy.options.cervicalMucus],
      lhTest: [...dayLogCopy.options.lhTest],
      cycleFactors: DAY_CYCLE_FACTOR_KEYS.map((value) => ({
        value,
        label: dayLogCopy.options.cycleFactors[value].label,
        icon: dayLogCopy.options.cycleFactors[value].icon,
      })),
      symptoms: pickerSymptoms,
    },
  };
}

export function buildNextDayLogRecordPatch(
  current: DayLogRecord,
  updates: Partial<DayLogRecord>,
): DayLogRecord {
  return sanitizeDayLogRecord({
    ...current,
    ...updates,
    notes:
      typeof updates.notes === "string" ? trimDayLogNotes(updates.notes) : current.notes,
  });
}

function formatDayLogDateLabel(
  date: DayLogRecord["date"],
  locale: string,
): string {
  const parsed = parseLocalDate(date);
  if (!parsed) {
    return date;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

async function loadAutoFillRelevantRecords(
  storage: LocalAppStorage,
  profile: ProfileRecord,
  date: DayLogRecord["date"],
) {
  const parsedDate = parseLocalDate(date);
  if (!parsedDate) {
    return [];
  }

  return storage.listDayLogRecordsInRange(
    formatLocalDate(addDays(parsedDate, -1)),
    formatLocalDate(addDays(parsedDate, Math.max(profile.periodLength - 1, 0))),
  );
}
