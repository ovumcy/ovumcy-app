import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createEmptyDayLogRecord,
  type DayLogRecord,
} from "../../models/day-log";
import type { OnboardingRecord } from "../../models/onboarding";
import {
  sanitizeContractionSession,
  sanitizeKickCountSession,
  sanitizePregnancyRecord,
  type ContractionSession,
  type KickCountSession,
  type PregnancyRecord,
} from "../../models/pregnancy";
import {
  sanitizePostpartumRecord,
  type PostpartumRecord,
} from "../../models/postpartum";
import {
  sanitizeScreeningResponse,
  type ScreeningResponse,
} from "../../models/screening";
import {
  createDefaultSymptomRecords,
  type SymptomRecord,
} from "../../models/symptom";
import {
  createDefaultProfileRecord,
  normalizeCalendarPredictionNoticeKey,
  normalizeInterfaceLanguage,
  normalizeOnboardingHelperNoticeKey,
  normalizeThemePreference,
  normalizeWeekStartDay,
  type LocalDateISO,
  type ProfileRecord,
} from "../../models/profile";
import {
  createDefaultSyncPreferencesRecord,
  normalizeSyncMode,
  normalizeSyncSetupStatus,
  type SyncPreferencesRecord,
} from "../../sync/sync-contract";
import {
  applyOnboardingRecordToProfile,
  createDefaultOnboardingRecord,
  profileToOnboardingRecord,
} from "../../services/onboarding-policy";
import { sanitizeDayLogRecord } from "../../services/day-log-policy";
import { normalizeAgeGroup } from "../../services/profile-settings-policy";
import type {
  LocalAppStorage,
  LocalBootstrapState,
  LocalDayLogSummary,
  ManagedBillingCacheRecord,
} from "./storage-contract";
import {
  createDefaultBootstrapState,
  createDefaultManagedBillingCacheRecord,
  persistBootstrapIncompleteOnboardingStep,
  resolveBootstrapIncompleteOnboardingStep,
} from "./storage-contract";

export const BOOTSTRAP_STATE_KEY = "ovumcy/bootstrap-state";
export const PROFILE_RECORD_KEY = "ovumcy/profile-record";
export const ONBOARDING_RECORD_KEY = "ovumcy/onboarding-record";
export const DAY_LOG_RECORDS_KEY = "ovumcy/day-log-records";
export const SYMPTOM_RECORDS_KEY = "ovumcy/symptom-records";
export const SYNC_PREFERENCES_RECORD_KEY = "ovumcy/sync-preferences";
export const PREGNANCY_RECORDS_KEY = "ovumcy/pregnancy-records";
export const KICK_SESSIONS_KEY = "ovumcy/kick-sessions";
export const CONTRACTION_SESSIONS_KEY = "ovumcy/contraction-sessions";
export const POSTPARTUM_RECORDS_KEY = "ovumcy/postpartum-records";
export const SCREENING_RESPONSES_KEY = "ovumcy/screening-responses";

export function createAsyncStorageAppStorage(): LocalAppStorage {
  return {
    async readBootstrapState(): Promise<LocalBootstrapState> {
      return readAsyncStorageBootstrapState();
    },

    async writeBootstrapState(state: LocalBootstrapState): Promise<void> {
      const hasCompletedOnboarding = state.hasCompletedOnboarding === true;
      await AsyncStorage.setItem(
        BOOTSTRAP_STATE_KEY,
        JSON.stringify({
          hasCompletedOnboarding,
          profileVersion: state.profileVersion,
          incompleteOnboardingStep: persistBootstrapIncompleteOnboardingStep(
            state.incompleteOnboardingStep,
            hasCompletedOnboarding,
          ),
        }),
      );
    },

    async clearAllLocalData(): Promise<void> {
      await clearAsyncStorageLocalAppData();
    },

    async readProfileRecord(): Promise<ProfileRecord> {
      return readAsyncStorageProfileRecord();
    },

    async writeProfileRecord(record: ProfileRecord): Promise<void> {
      await AsyncStorage.setItem(PROFILE_RECORD_KEY, JSON.stringify(record));
    },

    async readSyncPreferencesRecord(): Promise<SyncPreferencesRecord> {
      return readAsyncStorageSyncPreferencesRecord();
    },

    async writeSyncPreferencesRecord(record: SyncPreferencesRecord): Promise<void> {
      await AsyncStorage.setItem(
        SYNC_PREFERENCES_RECORD_KEY,
        JSON.stringify(record),
      );
    },

    async readOnboardingRecord(): Promise<OnboardingRecord> {
      const profile = await readAsyncStorageProfileRecord();
      return profileToOnboardingRecord(profile);
    },

    async writeOnboardingRecord(record: OnboardingRecord): Promise<void> {
      const currentProfile = await readAsyncStorageProfileRecord();
      const nextProfile = applyOnboardingRecordToProfile(currentProfile, record);

      await AsyncStorage.setItem(PROFILE_RECORD_KEY, JSON.stringify(nextProfile));
    },

    async readDayLogRecord(date: DayLogRecord["date"]): Promise<DayLogRecord> {
      const records = await readAsyncStorageDayLogRecords();
      return mergeDayLogRecord(records[date], date);
    },

    async writeDayLogRecord(record: DayLogRecord): Promise<void> {
      const records = await readAsyncStorageDayLogRecords();
      records[record.date] = record;
      await AsyncStorage.setItem(DAY_LOG_RECORDS_KEY, JSON.stringify(records));
    },

    async deleteDayLogRecord(date: DayLogRecord["date"]): Promise<void> {
      const records = await readAsyncStorageDayLogRecords();
      delete records[date];
      await AsyncStorage.setItem(DAY_LOG_RECORDS_KEY, JSON.stringify(records));
    },

    async listDayLogRecordsInRange(
      from: DayLogRecord["date"],
      to: DayLogRecord["date"],
    ): Promise<DayLogRecord[]> {
      const records = await readAsyncStorageDayLogRecords();

      return filterSortedDayLogRecords(records, from, to);
    },

    async readDayLogSummary(
      from?: DayLogRecord["date"],
      to?: DayLogRecord["date"],
    ): Promise<LocalDayLogSummary> {
      const records = await readAsyncStorageDayLogRecords();
      const filtered = filterSortedDayLogRecords(
        records,
        from ?? "0001-01-01",
        to ?? "9999-12-31",
      );
      if (filtered.length === 0) {
        return {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        };
      }

      const firstRecord = filtered[0];
      const lastRecord = filtered[filtered.length - 1];
      if (!firstRecord || !lastRecord) {
        return {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        };
      }

      return {
        totalEntries: filtered.length,
        hasData: true,
        dateFrom: firstRecord.date,
        dateTo: lastRecord.date,
      };
    },

    async listSymptomRecords(): Promise<SymptomRecord[]> {
      return readAsyncStorageSymptomRecords();
    },

    async writeSymptomRecord(record: SymptomRecord): Promise<void> {
      const records = await readAsyncStorageSymptomRecords();
      const nextRecords = records.filter((current) => current.id !== record.id);
      nextRecords.push(mergeSymptomRecord(record));
      await AsyncStorage.setItem(SYMPTOM_RECORDS_KEY, JSON.stringify(nextRecords));
    },

    // Deliberate no-op cache: this legacy adapter persists to plain
    // AsyncStorage, and derived premium flags must never live in a broadly
    // readable plaintext store (see SECURITY.md). The active
    // backends (encrypted SQLite, volatile web) carry the real cache.
    async readManagedBillingCacheRecord(): Promise<ManagedBillingCacheRecord> {
      return createDefaultManagedBillingCacheRecord();
    },

    async writeManagedBillingCacheRecord(): Promise<void> {},

    async readActivePregnancy(): Promise<PregnancyRecord | null> {
      const records = await readAsyncStoragePregnancyRecords();
      return records.find((record) => record.status === "active") ?? null;
    },

    async listPregnancyRecords(): Promise<PregnancyRecord[]> {
      return readAsyncStoragePregnancyRecords();
    },

    async writePregnancyRecord(record: PregnancyRecord): Promise<void> {
      const normalized = sanitizePregnancyRecord(record);
      if (!normalized) {
        throw new Error("writePregnancyRecord: record failed sanitize");
      }

      const map = await readAsyncStorageRecordMap(PREGNANCY_RECORDS_KEY);
      // At-most-one-active invariant, enforced on every backend so services
      // never branch on storage tech: reject a second concurrently active
      // record; updating the SAME active record (same id) still succeeds.
      if (normalized.status === "active") {
        for (const [id, value] of Object.entries(map)) {
          if (id === normalized.id) {
            continue;
          }
          const existing = sanitizePregnancyRecord(value);
          if (existing && existing.status === "active") {
            throw new Error(
              "writePregnancyRecord: another pregnancy is already active",
            );
          }
        }
      }

      map[normalized.id] = normalized;
      await AsyncStorage.setItem(PREGNANCY_RECORDS_KEY, JSON.stringify(map));
    },

    async listKickSessions(
      fromDate?: LocalDateISO,
      toDate?: LocalDateISO,
    ): Promise<KickCountSession[]> {
      const sessions = await readAsyncStorageKickSessions();
      return sessions.filter((session) =>
        isDayInRange(session.date, fromDate, toDate),
      );
    },

    async writeKickSession(session: KickCountSession): Promise<void> {
      const normalized = sanitizeKickCountSession(session);
      if (!normalized) {
        throw new Error("writeKickSession: session failed sanitize");
      }

      const map = await readAsyncStorageRecordMap(KICK_SESSIONS_KEY);
      map[normalized.id] = normalized;
      await AsyncStorage.setItem(KICK_SESSIONS_KEY, JSON.stringify(map));
    },

    async deleteKickSession(id: string): Promise<void> {
      const map = await readAsyncStorageRecordMap(KICK_SESSIONS_KEY);
      delete map[id];
      await AsyncStorage.setItem(KICK_SESSIONS_KEY, JSON.stringify(map));
    },

    async listContractionSessions(
      fromDate?: LocalDateISO,
      toDate?: LocalDateISO,
    ): Promise<ContractionSession[]> {
      const sessions = await readAsyncStorageContractionSessions();
      return sessions.filter((session) =>
        isDayInRange(session.date, fromDate, toDate),
      );
    },

    async writeContractionSession(session: ContractionSession): Promise<void> {
      const normalized = sanitizeContractionSession(session);
      if (!normalized) {
        throw new Error("writeContractionSession: session failed sanitize");
      }

      const map = await readAsyncStorageRecordMap(CONTRACTION_SESSIONS_KEY);
      map[normalized.id] = normalized;
      await AsyncStorage.setItem(CONTRACTION_SESSIONS_KEY, JSON.stringify(map));
    },

    async deleteContractionSession(id: string): Promise<void> {
      const map = await readAsyncStorageRecordMap(CONTRACTION_SESSIONS_KEY);
      delete map[id];
      await AsyncStorage.setItem(CONTRACTION_SESSIONS_KEY, JSON.stringify(map));
    },

    async deleteAllPregnancyData(): Promise<void> {
      await clearAsyncStoragePregnancyData();
    },

    async readActivePostpartum(): Promise<PostpartumRecord | null> {
      const records = await readAsyncStoragePostpartumRecords();
      return records.find((record) => record.status === "active") ?? null;
    },

    async listPostpartumRecords(): Promise<PostpartumRecord[]> {
      return readAsyncStoragePostpartumRecords();
    },

    async writePostpartumRecord(record: PostpartumRecord): Promise<void> {
      const normalized = sanitizePostpartumRecord(record);
      if (!normalized) {
        throw new Error("writePostpartumRecord: record failed sanitize");
      }

      const map = await readAsyncStorageRecordMap(POSTPARTUM_RECORDS_KEY);
      // At-most-one-active invariant, enforced on every backend so services
      // never branch on storage tech: reject a second concurrently active
      // record; updating the SAME active record (same id) still succeeds.
      if (normalized.status === "active") {
        for (const [id, value] of Object.entries(map)) {
          if (id === normalized.id) {
            continue;
          }
          const existing = sanitizePostpartumRecord(value);
          if (existing && existing.status === "active") {
            throw new Error(
              "writePostpartumRecord: another postpartum is already active",
            );
          }
        }
      }

      map[normalized.id] = normalized;
      await AsyncStorage.setItem(POSTPARTUM_RECORDS_KEY, JSON.stringify(map));
    },

    async deleteAllPostpartumData(): Promise<void> {
      await clearAsyncStoragePostpartumData();
    },

    async listScreeningResponses(): Promise<ScreeningResponse[]> {
      return readAsyncStorageScreeningResponses();
    },

    async writeScreeningResponse(response: ScreeningResponse): Promise<void> {
      // Sanitize (also recomputes score/flag from answers) before persisting,
      // matching every other backend so services never branch on storage tech.
      const normalized = sanitizeScreeningResponse(response);
      if (!normalized) {
        throw new Error("writeScreeningResponse: response failed sanitize");
      }

      const map = await readAsyncStorageRecordMap(SCREENING_RESPONSES_KEY);
      map[normalized.id] = normalized;
      await AsyncStorage.setItem(SCREENING_RESPONSES_KEY, JSON.stringify(map));
    },

    async deleteAllScreeningData(): Promise<void> {
      await clearAsyncStorageScreeningData();
    },
  };
}

export async function readAsyncStorageBootstrapState(): Promise<LocalBootstrapState> {
  const rawValue = await AsyncStorage.getItem(BOOTSTRAP_STATE_KEY);
  if (!rawValue) {
    return createDefaultBootstrapState();
  }

  const parsed = safeParse<Partial<LocalBootstrapState>>(rawValue);
  const hasCompletedOnboarding = parsed?.hasCompletedOnboarding === true;
  const defaults = createDefaultBootstrapState();

  return {
    hasCompletedOnboarding,
    profileVersion:
      typeof parsed?.profileVersion === "number" && Number.isFinite(parsed.profileVersion)
        ? parsed.profileVersion
        : defaults.profileVersion,
    incompleteOnboardingStep: resolveBootstrapIncompleteOnboardingStep(
      parsed?.incompleteOnboardingStep,
      hasCompletedOnboarding,
    ),
  };
}

export async function readAsyncStorageProfileRecord(): Promise<ProfileRecord> {
  const rawProfile = await AsyncStorage.getItem(PROFILE_RECORD_KEY);
  if (rawProfile) {
    return mergeProfileRecord(safeParse<Partial<ProfileRecord>>(rawProfile));
  }

  const rawOnboardingRecord = await AsyncStorage.getItem(ONBOARDING_RECORD_KEY);
  if (!rawOnboardingRecord) {
    return createDefaultProfileRecord();
  }

  const parsedLegacyRecord = safeParse<Partial<OnboardingRecord>>(rawOnboardingRecord);
  return applyOnboardingRecordToProfile(
    createDefaultProfileRecord(),
    {
      ...createDefaultOnboardingRecord(),
      ...parsedLegacyRecord,
      lastPeriodStart:
        typeof parsedLegacyRecord?.lastPeriodStart === "string"
          ? parsedLegacyRecord.lastPeriodStart
          : null,
    },
  );
}

export async function hasAsyncStorageLocalAppData(): Promise<boolean> {
  const entries = await AsyncStorage.multiGet([
    BOOTSTRAP_STATE_KEY,
    PROFILE_RECORD_KEY,
    ONBOARDING_RECORD_KEY,
    DAY_LOG_RECORDS_KEY,
    SYMPTOM_RECORDS_KEY,
    SYNC_PREFERENCES_RECORD_KEY,
  ]);
  const bootstrapState = entries[0];
  const profileRecord = entries[1];
  const onboardingRecord = entries[2];
  const dayLogRecords = entries[3];

  return (
    bootstrapState?.[1] !== null ||
    profileRecord?.[1] !== null ||
    onboardingRecord?.[1] !== null ||
    dayLogRecords?.[1] !== null ||
    entries[4]?.[1] !== null ||
    entries[5]?.[1] !== null
  );
}

const LEGACY_LOCAL_APP_DATA_KEYS = [
  BOOTSTRAP_STATE_KEY,
  PROFILE_RECORD_KEY,
  ONBOARDING_RECORD_KEY,
  DAY_LOG_RECORDS_KEY,
  SYMPTOM_RECORDS_KEY,
  SYNC_PREFERENCES_RECORD_KEY,
  // Pregnancy-mode, postpartum-mode, and screening keys are wiped and
  // forensically scrubbed on clear like the other health-data keys (this
  // adapter owns them all).
  PREGNANCY_RECORDS_KEY,
  KICK_SESSIONS_KEY,
  CONTRACTION_SESSIONS_KEY,
  POSTPARTUM_RECORDS_KEY,
  SCREENING_RESPONSES_KEY,
] as const;

export async function clearAsyncStorageLocalAppData(): Promise<void> {
  // Overwrite-before-remove. AsyncStorage's `multiRemove` only unlinks the key
  // references; on the SQLite/RocksDB-backed native store it does not reclaim
  // or scrub the underlying pages, so the freed bytes can still hold the old
  // plaintext health data and be recovered forensically (raw disk / backup
  // extraction) after an upgrade migrates a user to the encrypted store.
  // Writing a same-key overwrite first lets the store reuse those pages for
  // junk before the delete, best-effort scrubbing the residue. This runs only
  // on the legacy plaintext store; the encrypted SQLite backend never routes
  // through here. Best-effort: if overwrite fails we still remove the keys.
  await overwriteLegacyLocalAppDataKeys();
  await AsyncStorage.multiRemove([...LEGACY_LOCAL_APP_DATA_KEYS]);
}

async function overwriteLegacyLocalAppDataKeys(): Promise<void> {
  // Size the scrub value to plausibly cover the largest legacy record so the
  // overwrite spans the pages the original occupied. Value content is inert
  // (no health data, no secrets) — a fixed filler string.
  const scrubValue = "0".repeat(SCRUB_OVERWRITE_LENGTH);
  try {
    await AsyncStorage.multiSet(
      LEGACY_LOCAL_APP_DATA_KEYS.map((key) => [key, scrubValue]),
    );
  } catch {
    // Overwrite is a hardening step, not a correctness requirement: the
    // subsequent multiRemove still deletes the key references either way.
  }
}

const SCRUB_OVERWRITE_LENGTH = 4096;

// The three pregnancy-data keys, targeted by the hard-delete action that
// removes the whole pregnancy data class while leaving cycle/day-log/profile
// data intact — unlike the full clear above.
const PREGNANCY_DATA_KEYS = [
  PREGNANCY_RECORDS_KEY,
  KICK_SESSIONS_KEY,
  CONTRACTION_SESSIONS_KEY,
] as const;

export async function clearAsyncStoragePregnancyData(): Promise<void> {
  // Overwrite-before-remove, same forensic-scrub reasoning as
  // clearAsyncStorageLocalAppData: `multiRemove` only unlinks the keys on the
  // native SQLite/RocksDB-backed store, so the freed pages can still hold the
  // old plaintext pregnancy-outcome data (the most sensitive class in the app)
  // and be recovered forensically. Overwriting with inert filler first lets the
  // store reuse those pages before the delete. Best-effort: a failed overwrite
  // still falls through to the removal.
  const scrubValue = "0".repeat(SCRUB_OVERWRITE_LENGTH);
  try {
    await AsyncStorage.multiSet(
      PREGNANCY_DATA_KEYS.map((key) => [key, scrubValue]),
    );
  } catch {
    // Hardening step, not a correctness requirement.
  }
  await AsyncStorage.multiRemove([...PREGNANCY_DATA_KEYS]);
}

// The postpartum-data key, targeted by the hard-delete action that removes
// the whole postpartum data class while leaving cycle/day-log/profile AND
// pregnancy data intact — pregnancy and postpartum are deleted independently.
const POSTPARTUM_DATA_KEYS = [POSTPARTUM_RECORDS_KEY] as const;

export async function clearAsyncStoragePostpartumData(): Promise<void> {
  // Overwrite-before-remove, same forensic-scrub reasoning as
  // clearAsyncStoragePregnancyData: `multiRemove` only unlinks the keys on the
  // native SQLite/RocksDB-backed store, so the freed pages can still hold the
  // old plaintext postpartum-outcome data (same sensitivity class as pregnancy
  // outcome data) and be recovered forensically. Overwriting with inert filler
  // first lets the store reuse those pages before the delete. Best-effort: a
  // failed overwrite still falls through to the removal.
  const scrubValue = "0".repeat(SCRUB_OVERWRITE_LENGTH);
  try {
    await AsyncStorage.multiSet(
      POSTPARTUM_DATA_KEYS.map((key) => [key, scrubValue]),
    );
  } catch {
    // Hardening step, not a correctness requirement.
  }
  await AsyncStorage.multiRemove([...POSTPARTUM_DATA_KEYS]);
}

// The screening-data key, targeted by the hard-delete action that removes
// the whole EPDS screening data class while leaving cycle/day-log/profile,
// pregnancy, AND postpartum data intact — mental-health screening is a distinct
// sensitive class deleted only via its own explicit consent.
const SCREENING_DATA_KEYS = [SCREENING_RESPONSES_KEY] as const;

export async function clearAsyncStorageScreeningData(): Promise<void> {
  // Overwrite-before-remove, same forensic-scrub reasoning as
  // clearAsyncStoragePostpartumData: `multiRemove` only unlinks the keys on the
  // native SQLite/RocksDB-backed store, so the freed pages can still hold the
  // old plaintext screening answers (mental-health answers, the most sensitive
  // class in the app) and be recovered forensically. Overwriting with inert
  // filler first lets the store reuse those pages before the delete.
  // Best-effort: a failed overwrite still falls through to the removal.
  const scrubValue = "0".repeat(SCRUB_OVERWRITE_LENGTH);
  try {
    await AsyncStorage.multiSet(
      SCREENING_DATA_KEYS.map((key) => [key, scrubValue]),
    );
  } catch {
    // Hardening step, not a correctness requirement.
  }
  await AsyncStorage.multiRemove([...SCREENING_DATA_KEYS]);
}

export async function readAsyncStorageSyncPreferencesRecord(): Promise<SyncPreferencesRecord> {
  const rawValue = await AsyncStorage.getItem(SYNC_PREFERENCES_RECORD_KEY);
  if (!rawValue) {
    return createDefaultSyncPreferencesRecord();
  }

  return mergeSyncPreferencesRecord(
    safeParse<Partial<SyncPreferencesRecord>>(rawValue),
  );
}

async function readAsyncStorageDayLogRecords(): Promise<
  Record<string, DayLogRecord>
> {
  const rawValue = await AsyncStorage.getItem(DAY_LOG_RECORDS_KEY);
  if (!rawValue) {
    return {};
  }

  return safeParse<Record<string, DayLogRecord>>(rawValue) ?? {};
}

async function readAsyncStorageSymptomRecords(): Promise<SymptomRecord[]> {
  const rawValue = await AsyncStorage.getItem(SYMPTOM_RECORDS_KEY);
  if (!rawValue) {
    return createDefaultSymptomRecords();
  }

  const parsed = safeParse<Partial<SymptomRecord>[]>(rawValue);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return createDefaultSymptomRecords();
  }

  return parsed.map((record) => mergeSymptomRecord(record));
}

async function readAsyncStorageRecordMap(
  key: string,
): Promise<Record<string, unknown>> {
  const rawValue = await AsyncStorage.getItem(key);
  if (!rawValue) {
    return {};
  }

  const parsed = safeParse<Record<string, unknown>>(rawValue);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed
    : {};
}

async function readAsyncStoragePregnancyRecords(): Promise<PregnancyRecord[]> {
  const map = await readAsyncStorageRecordMap(PREGNANCY_RECORDS_KEY);
  return Object.values(map)
    .map((value) => sanitizePregnancyRecord(value))
    .filter((record): record is PregnancyRecord => record !== null)
    .sort(comparePregnancyRecords);
}

async function readAsyncStorageKickSessions(): Promise<KickCountSession[]> {
  const map = await readAsyncStorageRecordMap(KICK_SESSIONS_KEY);
  return Object.values(map)
    .map((value) => sanitizeKickCountSession(value))
    .filter((session): session is KickCountSession => session !== null)
    .sort(compareSessionsByDate);
}

async function readAsyncStorageContractionSessions(): Promise<
  ContractionSession[]
> {
  const map = await readAsyncStorageRecordMap(CONTRACTION_SESSIONS_KEY);
  return Object.values(map)
    .map((value) => sanitizeContractionSession(value))
    .filter((session): session is ContractionSession => session !== null)
    .sort(compareSessionsByDate);
}

async function readAsyncStoragePostpartumRecords(): Promise<PostpartumRecord[]> {
  const map = await readAsyncStorageRecordMap(POSTPARTUM_RECORDS_KEY);
  return Object.values(map)
    .map((value) => sanitizePostpartumRecord(value))
    .filter((record): record is PostpartumRecord => record !== null)
    .sort(comparePostpartumRecords);
}

function comparePregnancyRecords(
  left: PregnancyRecord,
  right: PregnancyRecord,
): number {
  if (left.startedAt !== right.startedAt) {
    return left.startedAt.localeCompare(right.startedAt);
  }
  return left.id.localeCompare(right.id);
}

function comparePostpartumRecords(
  left: PostpartumRecord,
  right: PostpartumRecord,
): number {
  if (left.startedAt !== right.startedAt) {
    return left.startedAt.localeCompare(right.startedAt);
  }
  return left.id.localeCompare(right.id);
}

async function readAsyncStorageScreeningResponses(): Promise<ScreeningResponse[]> {
  const map = await readAsyncStorageRecordMap(SCREENING_RESPONSES_KEY);
  return Object.values(map)
    .map((value) => sanitizeScreeningResponse(value))
    .filter((response): response is ScreeningResponse => response !== null)
    .sort(compareScreeningResponses);
}

function compareScreeningResponses(
  left: ScreeningResponse,
  right: ScreeningResponse,
): number {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }
  return left.id.localeCompare(right.id);
}

function compareSessionsByDate(
  left: { date: string; id: string },
  right: { date: string; id: string },
): number {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }
  return left.id.localeCompare(right.id);
}

function isDayInRange(
  day: string,
  fromDate?: LocalDateISO,
  toDate?: LocalDateISO,
): boolean {
  if (fromDate && day < fromDate) {
    return false;
  }
  if (toDate && day > toDate) {
    return false;
  }
  return true;
}

function safeParse<T>(rawValue: string): T | null {
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}

function mergeProfileRecord(
  parsed: Partial<ProfileRecord> | null,
): ProfileRecord {
  const defaults = createDefaultProfileRecord();

  return {
    ...defaults,
    ...parsed,
    lastPeriodStart:
      typeof parsed?.lastPeriodStart === "string" ? parsed.lastPeriodStart : null,
    temperatureUnit: parsed?.temperatureUnit === "f" ? "f" : defaults.temperatureUnit,
    ageGroup: normalizeAgeGroup(parsed?.ageGroup ?? ""),
    languageOverride: normalizeInterfaceLanguage(parsed?.languageOverride),
    themeOverride: normalizeThemePreference(parsed?.themeOverride),
    firstDayOfWeek: normalizeWeekStartDay(parsed?.firstDayOfWeek),
    dismissedCalendarPredictionNoticeKey: normalizeCalendarPredictionNoticeKey(
      parsed?.dismissedCalendarPredictionNoticeKey,
    ) ?? null,
    dismissedOnboardingHelperNoticeKey: normalizeOnboardingHelperNoticeKey(
      parsed?.dismissedOnboardingHelperNoticeKey,
    ) ?? null,
  };
}

function mergeSyncPreferencesRecord(
  parsed: Partial<SyncPreferencesRecord> | null,
): SyncPreferencesRecord {
  const defaults = createDefaultSyncPreferencesRecord();

  return {
    ...defaults,
    ...parsed,
    mode: normalizeSyncMode(parsed?.mode),
    endpointInput:
      typeof parsed?.endpointInput === "string"
        ? parsed.endpointInput
        : defaults.endpointInput,
    normalizedEndpoint:
      typeof parsed?.normalizedEndpoint === "string" &&
      parsed.normalizedEndpoint.trim().length > 0
        ? parsed.normalizedEndpoint
        : defaults.normalizedEndpoint,
    deviceLabel:
      typeof parsed?.deviceLabel === "string"
        ? parsed.deviceLabel
        : defaults.deviceLabel,
    setupStatus: normalizeSyncSetupStatus(parsed?.setupStatus),
    preparedAt:
      typeof parsed?.preparedAt === "string" ? parsed.preparedAt : null,
    lastRemoteGeneration:
      typeof parsed?.lastRemoteGeneration === "number" &&
      Number.isFinite(parsed.lastRemoteGeneration)
        ? parsed.lastRemoteGeneration
        : null,
    lastSyncedAt:
      typeof parsed?.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
    guestSessionExpiresAt:
      typeof parsed?.guestSessionExpiresAt === "string"
        ? parsed.guestSessionExpiresAt
        : null,
    // Defaults to false, which is also what a blob written before this field
    // existed means: those guest sessions had no renewal path, so the
    // countdown they were showing stays correct.
    guestSessionRenewable: parsed?.guestSessionRenewable === true,
  };
}

function mergeDayLogRecord(
  parsed: Partial<DayLogRecord> | undefined,
  date: DayLogRecord["date"],
): DayLogRecord {
  return sanitizeDayLogRecord({
    ...createEmptyDayLogRecord(date),
    ...parsed,
    date,
  });
}

function filterSortedDayLogRecords(
  records: Record<string, DayLogRecord>,
  from: DayLogRecord["date"],
  to: DayLogRecord["date"],
): DayLogRecord[] {
  return Object.keys(records)
    .filter((date) => date >= from && date <= to)
    .sort()
    .map((date) => mergeDayLogRecord(records[date], date));
}

function mergeSymptomRecord(record: Partial<SymptomRecord>): SymptomRecord {
  const defaults = createSymptomRecordFallback();

  return {
    ...defaults,
    ...record,
    id: typeof record.id === "string" ? record.id : defaults.id,
    slug: typeof record.slug === "string" ? record.slug : defaults.slug,
    label: typeof record.label === "string" ? record.label : defaults.label,
    icon: typeof record.icon === "string" ? record.icon : defaults.icon,
    color: typeof record.color === "string" ? record.color : defaults.color,
    isArchived: record.isArchived === true,
    sortOrder:
      typeof record.sortOrder === "number" && Number.isFinite(record.sortOrder)
        ? record.sortOrder
        : defaults.sortOrder,
    isDefault: record.isDefault === true,
  };
}

function createSymptomRecordFallback(): SymptomRecord {
  return {
    id: "custom_unknown",
    slug: "custom-unknown",
    label: "Custom symptom",
    icon: "✨",
    color: "#E8799F",
    isArchived: false,
    sortOrder: createDefaultSymptomRecords().length,
    isDefault: false,
  };
}
