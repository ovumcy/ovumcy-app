import { getDayLogCopy } from "../i18n/day-log-copy";
import {
  DAY_CYCLE_FACTOR_KEYS,
  createEmptyDayLogRecord,
  type DayCervicalMucus,
  type DayCycleFactorKey,
  type DayFlow,
  type DayLHTest,
  type DayLogRecord,
  type DayPregnancyTest,
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
  collectAutoFilledPeriodDaysToClear,
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
  temperatureUnit: ProfileRecord["temperatureUnit"];
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
    pregnancyTest: string;
    pregnancyTestHint: string;
    bbt: string;
    bbtHint: string;
    weight: string;
    weightUnit: string;
    weightHint: string;
    bloodPressure: string;
    bloodPressureUnit: string;
    bloodPressureHint: string;
    bloodPressureSystolicPlaceholder: string;
    bloodPressureDiastolicPlaceholder: string;
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
    pregnancyTest: readonly {
      value: DayPregnancyTest;
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

export type DayLogEditorPremiumOptions = Pick<
  DayLogVisibilityOptions,
  "showLHTests" | "showPregnancyMetrics"
>;

export async function loadDayLogEditorState(
  storage: LocalAppStorage,
  date: DayLogRecord["date"],
  locale = "en",
  premiumOptions: DayLogEditorPremiumOptions = {},
): Promise<LoadedDayLogEditorState> {
  const [profile, record, symptomRecords, activePregnancy] = await Promise.all([
    storage.readProfileRecord(),
    storage.readDayLogRecord(date),
    storage.listSymptomRecords(),
    storage.readActivePregnancy(),
  ]);
  const filteredRecord: DayLogRecord = {
    ...record,
    symptomIDs: filterKnownSymptomIDs(symptomRecords, record.symptomIDs),
  };
  // Pregnancy-metric visibility is derived here, alongside every other
  // visibility input this function already loads -- unlike showLHTests
  // (a managed-premium flag the caller must supply), active-pregnancy status
  // is available directly from this same storage contract.
  const resolvedPremiumOptions: DayLogEditorPremiumOptions = {
    ...premiumOptions,
    ...(activePregnancy ? { showPregnancyMetrics: true as const } : {}),
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
      resolvedPremiumOptions,
    ),
  };
}

export async function saveDayLogEditorRecord(
  storage: LocalAppStorage,
  record: DayLogRecord,
  now: Date = new Date(),
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
    appendAutoFilledPeriodDays(recordsToWrite, relevantRecords, normalized, profile, now);
  } else if (shouldClearAutoFilledNeighbors(profile, relevantRecords, normalized)) {
    for (const dayToClear of collectAutoFilledPeriodDaysToClear(
      relevantRecords,
      normalized.date,
      profile.periodLength,
    )) {
      recordsToWrite.set(
        dayToClear.date,
        sanitizeDayLogRecord({
          ...dayToClear,
          isPeriod: false,
        }),
      );
    }
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
  personalizationOptions: {
    historyRecords?: readonly DayLogRecord[];
    now?: Date;
  } = {},
): DayLogEditorViewData {
  const dayLogCopy = getDayLogCopy(locale);
  const pickerSymptoms = buildLocalizedEntryPickerSymptoms(
    symptomRecords,
    selectedSymptomIDs,
    locale,
    personalizationOptions,
  );

  return {
    title: dayLogCopy.title,
    subtitle: dayLogCopy.subtitle,
    dateLabel: formatDayLogDateLabel(date, locale),
    visibility: buildDayLogVisibility(profile, premiumOptions),
    temperatureUnit: profile.temperatureUnit,
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
      pregnancyTest: dayLogCopy.pregnancyTest,
      pregnancyTestHint: dayLogCopy.pregnancyTestHint,
      bbt: dayLogCopy.bbt,
      bbtHint: `${dayLogCopy.bbtHint} ${profile.temperatureUnit === "f" ? "°F" : "°C"}.`,
      weight: dayLogCopy.weight,
      weightUnit: dayLogCopy.weightUnit,
      weightHint: dayLogCopy.weightHint,
      bloodPressure: dayLogCopy.bloodPressure,
      bloodPressureUnit: dayLogCopy.bloodPressureUnit,
      bloodPressureHint: dayLogCopy.bloodPressureHint,
      bloodPressureSystolicPlaceholder: dayLogCopy.bloodPressureSystolicPlaceholder,
      bloodPressureDiastolicPlaceholder: dayLogCopy.bloodPressureDiastolicPlaceholder,
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
      pregnancyTest: [...dayLogCopy.options.pregnancyTest],
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

// ACOG red-flag guidance, surfaced as a soft, non-diagnostic hint next to the
// flow field (SECURITY.md "Medical safety": estimates/guidance, never a
// diagnosis). ovumcy-web carries no equivalent — its flow enum has no safety
// prompt — so these thresholds are a conservative app-only default rather than a
// ported value. Two observable bleeding patterns trigger the hint:
//
//  - Prolonged bleeding: a run of period days longer than ~7 days
//    (PROLONGED_BLEEDING_HINT_THRESHOLD_DAYS = 8, i.e. the 8th day onward).
//  - Sustained very heavy flow: the app records only a daily flow CATEGORY, not
//    the "soaking through protection every hour for several consecutive hours"
//    ACOG describes, so that criterion is proxied by several consecutive days
//    logged at the heaviest category (HEAVY_FLOW_RUN_HINT_THRESHOLD_DAYS = 3).
//
// Both are deliberately conservative: firing a little early is safe for a hint
// that only suggests raising the pattern with a clinician.
export const HEAVY_FLOW_RUN_HINT_THRESHOLD_DAYS = 3;
export const PROLONGED_BLEEDING_HINT_THRESHOLD_DAYS = 8;

export function resolveBleedingSafetyHint(
  record: DayLogRecord,
  historyRecords: readonly DayLogRecord[],
  locale = "en",
): string | null {
  if (!record.isPeriod) {
    return null;
  }

  // The live record (which may carry unsaved edits) wins over any persisted copy
  // for the same day, so the hint reacts to the flow the owner is choosing now.
  const recordsByDate = new Map(
    historyRecords.map((current) => [current.date, current]),
  );
  recordsByDate.set(record.date, record);

  const prolongedBleeding =
    contiguousDayRunLength(
      recordsByDate,
      record.date,
      (candidate) => candidate?.isPeriod === true,
    ) >= PROLONGED_BLEEDING_HINT_THRESHOLD_DAYS;

  const sustainedHeavyFlow =
    record.flow === "heavy" &&
    contiguousDayRunLength(
      recordsByDate,
      record.date,
      (candidate) => candidate?.isPeriod === true && candidate.flow === "heavy",
    ) >= HEAVY_FLOW_RUN_HINT_THRESHOLD_DAYS;

  if (!prolongedBleeding && !sustainedHeavyFlow) {
    return null;
  }

  return getDayLogCopy(locale).bleedingSafetyHint;
}

// Length of the maximal run of calendar-consecutive days around `date` whose
// records all satisfy `predicate` (the anchor day included). Both directions are
// walked so the hint fires whether the owner is editing the day that tips the
// run over or an earlier day already inside it.
function contiguousDayRunLength(
  recordsByDate: Map<string, DayLogRecord>,
  date: string,
  predicate: (record: DayLogRecord | undefined) => boolean,
): number {
  const anchor = parseLocalDate(date);
  if (!anchor || !predicate(recordsByDate.get(date))) {
    return 0;
  }

  let length = 1;
  for (let step = 1; ; step += 1) {
    const previous = recordsByDate.get(formatLocalDate(addDays(anchor, -step)));
    if (!predicate(previous)) {
      break;
    }
    length += 1;
  }
  for (let step = 1; ; step += 1) {
    const next = recordsByDate.get(formatLocalDate(addDays(anchor, step)));
    if (!predicate(next)) {
      break;
    }
    length += 1;
  }
  return length;
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

function shouldClearAutoFilledNeighbors(
  profile: ProfileRecord,
  existingRecords: readonly DayLogRecord[],
  nextRecord: DayLogRecord,
): boolean {
  if (!profile.autoPeriodFill || nextRecord.isPeriod) {
    return false;
  }

  const existingRecord = existingRecords.find(
    (record) => record.date === nextRecord.date,
  );
  if (!existingRecord?.isPeriod) {
    return false;
  }

  const parsedDate = parseLocalDate(nextRecord.date);
  if (!parsedDate) {
    return false;
  }

  const previousDate = formatLocalDate(addDays(parsedDate, -1));
  const previousRecord = existingRecords.find(
    (record) => record.date === previousDate,
  );
  return !previousRecord?.isPeriod;
}
