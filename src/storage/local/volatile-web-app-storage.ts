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
  createDefaultSymptomRecords,
  type SymptomRecord,
} from "../../models/symptom";
import {
  applyOnboardingRecordToProfile,
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
  normalizeManagedBillingCacheRecord,
  persistBootstrapIncompleteOnboardingStep,
  resolveBootstrapIncompleteOnboardingStep,
} from "./storage-contract";

type VolatileWebStorageState = {
  bootstrapState: LocalBootstrapState;
  profileRecord: ProfileRecord;
  syncPreferencesRecord: SyncPreferencesRecord;
  dayLogRecords: Record<string, DayLogRecord>;
  symptomRecords: SymptomRecord[];
  managedBillingCacheRecord: ManagedBillingCacheRecord;
  pregnancyRecords: Record<string, PregnancyRecord>;
  kickSessions: Record<string, KickCountSession>;
  contractionSessions: Record<string, ContractionSession>;
  postpartumRecords: Record<string, PostpartumRecord>;
  screeningResponses: Record<string, ScreeningResponse>;
};

export function createVolatileWebAppStorage(): LocalAppStorage {
  let state = createDefaultVolatileWebStorageState();

  return {
    async readBootstrapState(): Promise<LocalBootstrapState> {
      return {
        ...state.bootstrapState,
      };
    },

    async writeBootstrapState(nextState: LocalBootstrapState): Promise<void> {
      const hasCompletedOnboarding = nextState.hasCompletedOnboarding === true;
      state = {
        ...state,
        bootstrapState: {
          hasCompletedOnboarding,
          profileVersion:
            Number.isFinite(nextState.profileVersion) &&
            nextState.profileVersion > 0
              ? nextState.profileVersion
              : state.bootstrapState.profileVersion,
          incompleteOnboardingStep: resolveBootstrapIncompleteOnboardingStep(
            persistBootstrapIncompleteOnboardingStep(
              nextState.incompleteOnboardingStep,
              hasCompletedOnboarding,
            ),
            hasCompletedOnboarding,
          ),
        },
      };
    },

    async clearAllLocalData(): Promise<void> {
      state = createDefaultVolatileWebStorageState();
    },

    async readProfileRecord(): Promise<ProfileRecord> {
      return mergeProfileRecord(state.profileRecord);
    },

    async writeProfileRecord(record: ProfileRecord): Promise<void> {
      state = {
        ...state,
        profileRecord: mergeProfileRecord(record),
      };
    },

    async readSyncPreferencesRecord(): Promise<SyncPreferencesRecord> {
      return mergeSyncPreferencesRecord(state.syncPreferencesRecord);
    },

    async writeSyncPreferencesRecord(record: SyncPreferencesRecord): Promise<void> {
      state = {
        ...state,
        syncPreferencesRecord: mergeSyncPreferencesRecord(record),
      };
    },

    async readOnboardingRecord(): Promise<OnboardingRecord> {
      return profileToOnboardingRecord(state.profileRecord);
    },

    async writeOnboardingRecord(record: OnboardingRecord): Promise<void> {
      state = {
        ...state,
        profileRecord: applyOnboardingRecordToProfile(state.profileRecord, record),
      };
    },

    async readDayLogRecord(date: DayLogRecord["date"]): Promise<DayLogRecord> {
      return mergeDayLogRecord(state.dayLogRecords[date], date);
    },

    async writeDayLogRecord(record: DayLogRecord): Promise<void> {
      state = {
        ...state,
        dayLogRecords: {
          ...state.dayLogRecords,
          [record.date]: sanitizeDayLogRecord(record),
        },
      };
    },

    async deleteDayLogRecord(date: DayLogRecord["date"]): Promise<void> {
      const nextDayLogRecords = {
        ...state.dayLogRecords,
      };

      delete nextDayLogRecords[date];

      state = {
        ...state,
        dayLogRecords: nextDayLogRecords,
      };
    },

    async listDayLogRecordsInRange(
      from: DayLogRecord["date"],
      to: DayLogRecord["date"],
    ): Promise<DayLogRecord[]> {
      return filterSortedDayLogRecords(state.dayLogRecords, from, to)
        .map((record) => mergeDayLogRecord(record, record.date));
    },

    async readDayLogSummary(
      from?: DayLogRecord["date"],
      to?: DayLogRecord["date"],
    ): Promise<LocalDayLogSummary> {
      const records = filterSortedDayLogRecords(
        state.dayLogRecords,
        from ?? "0001-01-01",
        to ?? "9999-12-31",
      );
      if (records.length === 0) {
        return {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        };
      }

      const firstRecord = records[0];
      const lastRecord = records[records.length - 1];
      if (!firstRecord || !lastRecord) {
        return {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        };
      }

      return {
        totalEntries: records.length,
        hasData: true,
        dateFrom: firstRecord.date,
        dateTo: lastRecord.date,
      };
    },

    async listSymptomRecords(): Promise<SymptomRecord[]> {
      return state.symptomRecords.map((record) => mergeSymptomRecord(record));
    },

    async writeSymptomRecord(record: SymptomRecord): Promise<void> {
      state = {
        ...state,
        symptomRecords: [
          ...state.symptomRecords.filter((current) => current.id !== record.id),
          mergeSymptomRecord(record),
        ],
      };
    },

    async readManagedBillingCacheRecord(): Promise<ManagedBillingCacheRecord> {
      return normalizeManagedBillingCacheRecord(state.managedBillingCacheRecord);
    },

    async writeManagedBillingCacheRecord(
      record: ManagedBillingCacheRecord,
    ): Promise<void> {
      state = {
        ...state,
        managedBillingCacheRecord: normalizeManagedBillingCacheRecord(record),
      };
    },

    async readActivePregnancy(): Promise<PregnancyRecord | null> {
      return (
        sanitizePregnancyRecords(state.pregnancyRecords).find(
          (record) => record.status === "active",
        ) ?? null
      );
    },

    async listPregnancyRecords(): Promise<PregnancyRecord[]> {
      return sanitizePregnancyRecords(state.pregnancyRecords);
    },

    async writePregnancyRecord(record: PregnancyRecord): Promise<void> {
      const normalized = sanitizePregnancyRecord(record);
      if (!normalized) {
        throw new Error("writePregnancyRecord: record failed sanitize");
      }

      // At-most-one-active invariant, enforced on every backend so services
      // never branch on storage tech: reject a second concurrently active
      // record; updating the SAME active record (same id) still succeeds.
      if (normalized.status === "active") {
        for (const [id, existing] of Object.entries(state.pregnancyRecords)) {
          if (id !== normalized.id && existing.status === "active") {
            throw new Error(
              "writePregnancyRecord: another pregnancy is already active",
            );
          }
        }
      }

      state = {
        ...state,
        pregnancyRecords: {
          ...state.pregnancyRecords,
          [normalized.id]: normalized,
        },
      };
    },

    async listKickSessions(
      fromDate?: LocalDateISO,
      toDate?: LocalDateISO,
    ): Promise<KickCountSession[]> {
      return sanitizeKickSessions(state.kickSessions).filter((session) =>
        isDayInRange(session.date, fromDate, toDate),
      );
    },

    async writeKickSession(session: KickCountSession): Promise<void> {
      const normalized = sanitizeKickCountSession(session);
      if (!normalized) {
        throw new Error("writeKickSession: session failed sanitize");
      }

      state = {
        ...state,
        kickSessions: {
          ...state.kickSessions,
          [normalized.id]: normalized,
        },
      };
    },

    async deleteKickSession(id: string): Promise<void> {
      const nextKickSessions = { ...state.kickSessions };
      delete nextKickSessions[id];
      state = {
        ...state,
        kickSessions: nextKickSessions,
      };
    },

    async listContractionSessions(
      fromDate?: LocalDateISO,
      toDate?: LocalDateISO,
    ): Promise<ContractionSession[]> {
      return sanitizeContractionSessions(state.contractionSessions).filter(
        (session) => isDayInRange(session.date, fromDate, toDate),
      );
    },

    async writeContractionSession(session: ContractionSession): Promise<void> {
      const normalized = sanitizeContractionSession(session);
      if (!normalized) {
        throw new Error("writeContractionSession: session failed sanitize");
      }

      state = {
        ...state,
        contractionSessions: {
          ...state.contractionSessions,
          [normalized.id]: normalized,
        },
      };
    },

    async deleteContractionSession(id: string): Promise<void> {
      const nextContractionSessions = { ...state.contractionSessions };
      delete nextContractionSessions[id];
      state = {
        ...state,
        contractionSessions: nextContractionSessions,
      };
    },

    async deleteAllPregnancyData(): Promise<void> {
      // Hard-delete the whole pregnancy data class; every other collection
      // (day logs, profile, symptoms, sync prefs) is left intact.
      state = {
        ...state,
        pregnancyRecords: {},
        kickSessions: {},
        contractionSessions: {},
      };
    },

    async readActivePostpartum(): Promise<PostpartumRecord | null> {
      return (
        sanitizePostpartumRecords(state.postpartumRecords).find(
          (record) => record.status === "active",
        ) ?? null
      );
    },

    async listPostpartumRecords(): Promise<PostpartumRecord[]> {
      return sanitizePostpartumRecords(state.postpartumRecords);
    },

    async writePostpartumRecord(record: PostpartumRecord): Promise<void> {
      const normalized = sanitizePostpartumRecord(record);
      if (!normalized) {
        throw new Error("writePostpartumRecord: record failed sanitize");
      }

      // At-most-one-active invariant, enforced on every backend so services
      // never branch on storage tech: reject a second concurrently active
      // record; updating the SAME active record (same id) still succeeds.
      if (normalized.status === "active") {
        for (const [id, existing] of Object.entries(state.postpartumRecords)) {
          if (id !== normalized.id && existing.status === "active") {
            throw new Error(
              "writePostpartumRecord: another postpartum is already active",
            );
          }
        }
      }

      state = {
        ...state,
        postpartumRecords: {
          ...state.postpartumRecords,
          [normalized.id]: normalized,
        },
      };
    },

    async deleteAllPostpartumData(): Promise<void> {
      // Hard-delete the whole postpartum data class; every other collection
      // (day logs, profile, symptoms, sync prefs, pregnancy) is left intact.
      state = {
        ...state,
        postpartumRecords: {},
      };
    },

    async listScreeningResponses(): Promise<ScreeningResponse[]> {
      return sanitizeScreeningResponses(state.screeningResponses);
    },

    async writeScreeningResponse(response: ScreeningResponse): Promise<void> {
      const normalized = sanitizeScreeningResponse(response);
      if (!normalized) {
        throw new Error("writeScreeningResponse: response failed sanitize");
      }

      state = {
        ...state,
        screeningResponses: {
          ...state.screeningResponses,
          [normalized.id]: normalized,
        },
      };
    },

    async deleteAllScreeningData(): Promise<void> {
      // Hard-delete the whole screening data class; every other collection
      // (incl. postpartum) is left intact — screening is deleted only via its
      // own explicit consent, never coupled to the postpartum delete.
      state = {
        ...state,
        screeningResponses: {},
      };
    },
  };
}

function filterSortedDayLogRecords(
  dayLogRecords: Record<string, DayLogRecord>,
  from: DayLogRecord["date"],
  to: DayLogRecord["date"],
): DayLogRecord[] {
  return Object.keys(dayLogRecords)
        .filter((date) => date >= from && date <= to)
        .sort()
        .map((date) => mergeDayLogRecord(dayLogRecords[date], date));
}

function createDefaultVolatileWebStorageState(): VolatileWebStorageState {
  return {
    bootstrapState: createDefaultBootstrapState(),
    profileRecord: createDefaultProfileRecord(),
    syncPreferencesRecord: createDefaultSyncPreferencesRecord(),
    dayLogRecords: {},
    symptomRecords: createDefaultSymptomRecords(),
    managedBillingCacheRecord: createDefaultManagedBillingCacheRecord(),
    pregnancyRecords: {},
    kickSessions: {},
    contractionSessions: {},
    postpartumRecords: {},
    screeningResponses: {},
  };
}

function sanitizePregnancyRecords(
  records: Record<string, PregnancyRecord>,
): PregnancyRecord[] {
  return Object.values(records)
    .map((record) => sanitizePregnancyRecord(record))
    .filter((record): record is PregnancyRecord => record !== null)
    .sort(comparePregnancyRecords);
}

function sanitizeKickSessions(
  sessions: Record<string, KickCountSession>,
): KickCountSession[] {
  return Object.values(sessions)
    .map((session) => sanitizeKickCountSession(session))
    .filter((session): session is KickCountSession => session !== null)
    .sort(compareSessionsByDate);
}

function sanitizeContractionSessions(
  sessions: Record<string, ContractionSession>,
): ContractionSession[] {
  return Object.values(sessions)
    .map((session) => sanitizeContractionSession(session))
    .filter((session): session is ContractionSession => session !== null)
    .sort(compareSessionsByDate);
}

function sanitizePostpartumRecords(
  records: Record<string, PostpartumRecord>,
): PostpartumRecord[] {
  return Object.values(records)
    .map((record) => sanitizePostpartumRecord(record))
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

function sanitizeScreeningResponses(
  responses: Record<string, ScreeningResponse>,
): ScreeningResponse[] {
  return Object.values(responses)
    .map((response) => sanitizeScreeningResponse(response))
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

function mergeProfileRecord(record: Partial<ProfileRecord>): ProfileRecord {
  const defaults = createDefaultProfileRecord();

  return {
    ...defaults,
    ...record,
    lastPeriodStart:
      typeof record.lastPeriodStart === "string" ? record.lastPeriodStart : null,
    temperatureUnit: record.temperatureUnit === "f" ? "f" : defaults.temperatureUnit,
    ageGroup: normalizeAgeGroup(record.ageGroup ?? ""),
    languageOverride: normalizeInterfaceLanguage(record.languageOverride),
    themeOverride: normalizeThemePreference(record.themeOverride),
    firstDayOfWeek: normalizeWeekStartDay(record.firstDayOfWeek),
    dismissedCalendarPredictionNoticeKey: normalizeCalendarPredictionNoticeKey(
      record.dismissedCalendarPredictionNoticeKey,
    ) ?? null,
    dismissedOnboardingHelperNoticeKey: normalizeOnboardingHelperNoticeKey(
      record.dismissedOnboardingHelperNoticeKey,
    ) ?? null,
  };
}

function mergeSyncPreferencesRecord(
  record: Partial<SyncPreferencesRecord>,
): SyncPreferencesRecord {
  const defaults = createDefaultSyncPreferencesRecord();

  return {
    ...defaults,
    ...record,
    mode: normalizeSyncMode(record.mode),
    endpointInput:
      typeof record.endpointInput === "string"
        ? record.endpointInput
        : defaults.endpointInput,
    normalizedEndpoint:
      typeof record.normalizedEndpoint === "string" &&
      record.normalizedEndpoint.trim().length > 0
        ? record.normalizedEndpoint
        : defaults.normalizedEndpoint,
    deviceLabel:
      typeof record.deviceLabel === "string"
        ? record.deviceLabel
        : defaults.deviceLabel,
    setupStatus: normalizeSyncSetupStatus(record.setupStatus),
    preparedAt: typeof record.preparedAt === "string" ? record.preparedAt : null,
    lastRemoteGeneration:
      typeof record.lastRemoteGeneration === "number" &&
      Number.isFinite(record.lastRemoteGeneration)
        ? record.lastRemoteGeneration
        : null,
    lastSyncedAt:
      typeof record.lastSyncedAt === "string" ? record.lastSyncedAt : null,
    guestSessionExpiresAt:
      typeof record.guestSessionExpiresAt === "string"
        ? record.guestSessionExpiresAt
        : null,
    // Defaults to false, which is also what a record written before this
    // field existed means: those guest sessions had no renewal path, so the
    // countdown they were showing stays correct.
    guestSessionRenewable: record.guestSessionRenewable === true,
  };
}

function mergeDayLogRecord(
  record: Partial<DayLogRecord> | undefined,
  date: DayLogRecord["date"],
): DayLogRecord {
  return sanitizeDayLogRecord({
    ...createEmptyDayLogRecord(date),
    ...record,
    date,
  });
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
