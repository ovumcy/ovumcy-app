import { getDayLogCopy } from "../i18n/day-log-copy";
import {
  DAY_CYCLE_FACTOR_KEYS,
  type DayCervicalMucus,
  type DayCycleFactorKey,
  type DayFlow,
  type DayLogRecord,
  type DaySexActivity,
  type DaySymptomID,
} from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildDayLogVisibility,
  sanitizeDayLogRecord,
  trimDayLogNotes,
} from "./day-log-policy";
import { parseLocalDate } from "./profile-settings-policy";
import {
  buildEntryPickerSymptoms,
  filterKnownSymptomIDs,
} from "./symptom-policy";

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
    intimacyHiddenHint: string;
    intimacyVisibleHint: string;
    cervicalMucus: string;
    cervicalMucusExplainer: string;
    bbt: string;
    bbtHint: string;
    notes: string;
    addNote: string;
    editNote: string;
    hideNote: string;
    notesPlaceholder: string;
    periodOffHint: string;
    deleteHint: string;
  };
  actions: {
    saveLabel: string;
    updateLabel: string;
    savedLabel: string;
    saveFailedLabel: string;
    deleteLabel: string;
    deletedLabel: string;
    deleteFailedLabel: string;
  };
  options: {
    mood: readonly { value: number; label: string }[];
    flow: readonly { value: DayFlow; label: string }[];
    sexActivity: readonly { value: DaySexActivity; label: string }[];
    cervicalMucus: readonly { value: DayCervicalMucus; label: string }[];
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

export async function loadDayLogEditorState(
  storage: LocalAppStorage,
  date: DayLogRecord["date"],
  locale = "en",
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
    ),
  };
}

export async function saveDayLogEditorRecord(
  storage: LocalAppStorage,
  record: DayLogRecord,
): Promise<{ ok: true; record: DayLogRecord } | { ok: false }> {
  const symptomRecords = await storage.listSymptomRecords();
  const normalized = sanitizeDayLogRecord({
    ...record,
    symptomIDs: filterKnownSymptomIDs(symptomRecords, record.symptomIDs),
  });

  try {
    await storage.writeDayLogRecord(normalized);
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

export function buildDayLogEditorViewData(
  profile: ProfileRecord,
  date: DayLogRecord["date"],
  symptomRecords: readonly SymptomRecord[],
  selectedSymptomIDs: readonly DaySymptomID[] = [],
  locale = "en",
): DayLogEditorViewData {
  const dayLogCopy = getDayLogCopy(locale);
  const pickerSymptoms = buildEntryPickerSymptoms(symptomRecords, selectedSymptomIDs);

  return {
    title: dayLogCopy.title,
    subtitle: dayLogCopy.subtitle,
    dateLabel: formatDayLogDateLabel(date, locale),
    visibility: buildDayLogVisibility(profile),
    labels: {
      periodDay: dayLogCopy.periodDay,
      symptoms: dayLogCopy.symptoms,
      mood: dayLogCopy.mood,
      cycleFactors: dayLogCopy.cycleFactors,
      cycleFactorsHint: dayLogCopy.cycleFactorsHint,
      flow: dayLogCopy.flow,
      intimacy: dayLogCopy.intimacy,
      intimacyHiddenHint: dayLogCopy.intimacyHiddenHint,
      intimacyVisibleHint: dayLogCopy.intimacyVisibleHint,
      cervicalMucus: dayLogCopy.cervicalMucus,
      cervicalMucusExplainer: dayLogCopy.cervicalMucusExplainer,
      bbt: dayLogCopy.bbt,
      bbtHint: `${dayLogCopy.bbtHint} ${profile.temperatureUnit === "f" ? "°F" : "°C"}.`,
      notes: dayLogCopy.notes,
      addNote: dayLogCopy.addNote,
      editNote: dayLogCopy.editNote,
      hideNote: dayLogCopy.hideNote,
      notesPlaceholder: dayLogCopy.notesPlaceholder,
      periodOffHint: dayLogCopy.periodOffHint,
      deleteHint: dayLogCopy.deleteHint,
    },
    actions: {
      saveLabel: dayLogCopy.saveDay,
      updateLabel: dayLogCopy.updateEntry,
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
      cycleFactors: DAY_CYCLE_FACTOR_KEYS.map((value) => ({
        value,
        label: dayLogCopy.options.cycleFactors[value].label,
        icon: dayLogCopy.options.cycleFactors[value].icon,
      })),
      symptoms: pickerSymptoms.map((definition) => ({
        value: definition.id,
        label: definition.label,
        icon: definition.icon,
      })),
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
