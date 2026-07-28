import type { DayLogRecord } from "../../models/day-log";
import type { OnboardingRecord, OnboardingStep } from "../../models/onboarding";
import type { LocalDateISO, ProfileRecord } from "../../models/profile";
import type {
  ContractionSession,
  KickCountSession,
  PregnancyRecord,
} from "../../models/pregnancy";
import type { PostpartumRecord } from "../../models/postpartum";
import type { ScreeningResponse } from "../../models/screening";
import type { SyncPreferencesRecord } from "../../sync/sync-contract";
import type { SymptomRecord } from "../../models/symptom";

// ManagedBillingCachedSnapshot is the last-known-good managed billing state
// persisted for the bounded offline grace window. It carries only what local
// feature gates derive (plan state + the six premium booleans) plus the
// fetchedAt timestamp of the successful server fetch; server-driven display
// state (active subscription details, offers) is deliberately NOT cached so
// it fails closed while offline.
export type ManagedBillingCachedSnapshot = {
  hasActivePlan: boolean;
  premiumFeatures: {
    advancedFertility: boolean;
    advancedInsights: boolean;
    doctorPDF: boolean;
    extendedReports: boolean;
    partnerAccess: boolean;
    reminders: boolean;
  };
  fetchedAt: string;
};

export type ManagedBillingCacheRecord = {
  snapshot: ManagedBillingCachedSnapshot | null;
  dismissedOfferIDs: string[];
};

export function createDefaultManagedBillingCacheRecord(): ManagedBillingCacheRecord {
  return {
    snapshot: null,
    dismissedOfferIDs: [],
  };
}

export function normalizeManagedBillingCacheRecord(
  value: unknown,
): ManagedBillingCacheRecord {
  const defaults = createDefaultManagedBillingCacheRecord();
  if (typeof value !== "object" || value === null) {
    return defaults;
  }

  const record = value as Partial<ManagedBillingCacheRecord>;
  return {
    snapshot: normalizeManagedBillingCachedSnapshot(record.snapshot),
    dismissedOfferIDs: Array.isArray(record.dismissedOfferIDs)
      ? record.dismissedOfferIDs.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : defaults.dismissedOfferIDs,
  };
}

function normalizeManagedBillingCachedSnapshot(
  value: unknown,
): ManagedBillingCachedSnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const snapshot = value as Partial<ManagedBillingCachedSnapshot>;
  if (typeof snapshot.fetchedAt !== "string" || snapshot.fetchedAt.length === 0) {
    return null;
  }

  const features: Partial<ManagedBillingCachedSnapshot["premiumFeatures"]> =
    typeof snapshot.premiumFeatures === "object" && snapshot.premiumFeatures !== null
      ? snapshot.premiumFeatures
      : {};
  return {
    hasActivePlan: snapshot.hasActivePlan === true,
    premiumFeatures: {
      advancedFertility: features.advancedFertility === true,
      advancedInsights: features.advancedInsights === true,
      doctorPDF: features.doctorPDF === true,
      extendedReports: features.extendedReports === true,
      partnerAccess: features.partnerAccess === true,
      reminders: features.reminders === true,
    },
    fetchedAt: snapshot.fetchedAt,
  };
}

export type LocalBootstrapState = {
  hasCompletedOnboarding: boolean;
  profileVersion: number;
  incompleteOnboardingStep: OnboardingStep | null;
};

export function createDefaultBootstrapState(): LocalBootstrapState {
  return {
    hasCompletedOnboarding: false,
    profileVersion: 2,
    incompleteOnboardingStep: 1,
  };
}

export function normalizeIncompleteOnboardingStep(
  value: unknown,
): OnboardingStep | null {
  return value === 1 || value === 2 ? value : null;
}

export function resolveBootstrapIncompleteOnboardingStep(
  value: unknown,
  hasCompletedOnboarding: boolean,
): OnboardingStep | null {
  if (hasCompletedOnboarding) {
    return null;
  }

  const normalized = normalizeIncompleteOnboardingStep(value);
  if (normalized !== null) {
    return normalized;
  }

  return createDefaultBootstrapState().incompleteOnboardingStep;
}

export function persistBootstrapIncompleteOnboardingStep(
  value: unknown,
  hasCompletedOnboarding: boolean,
): OnboardingStep {
  const defaultStep = createDefaultBootstrapState().incompleteOnboardingStep ?? 1;

  if (hasCompletedOnboarding) {
    return defaultStep;
  }

  return resolveBootstrapIncompleteOnboardingStep(value, false) ?? defaultStep;
}

export type LocalDayLogSummary = {
  totalEntries: number;
  hasData: boolean;
  dateFrom: DayLogRecord["date"] | null;
  dateTo: DayLogRecord["date"] | null;
};

export interface LocalAppStorage {
  readBootstrapState(): Promise<LocalBootstrapState>;
  writeBootstrapState(state: LocalBootstrapState): Promise<void>;
  clearAllLocalData(): Promise<void>;
  readProfileRecord(): Promise<ProfileRecord>;
  writeProfileRecord(record: ProfileRecord): Promise<void>;
  readSyncPreferencesRecord(): Promise<SyncPreferencesRecord>;
  writeSyncPreferencesRecord(record: SyncPreferencesRecord): Promise<void>;
  readOnboardingRecord(): Promise<OnboardingRecord>;
  writeOnboardingRecord(record: OnboardingRecord): Promise<void>;
  readDayLogRecord(date: DayLogRecord["date"]): Promise<DayLogRecord>;
  writeDayLogRecord(record: DayLogRecord): Promise<void>;
  deleteDayLogRecord(date: DayLogRecord["date"]): Promise<void>;
  listDayLogRecordsInRange(
    from: DayLogRecord["date"],
    to: DayLogRecord["date"],
  ): Promise<DayLogRecord[]>;
  readDayLogSummary(
    from?: DayLogRecord["date"],
    to?: DayLogRecord["date"],
  ): Promise<LocalDayLogSummary>;
  listSymptomRecords(): Promise<SymptomRecord[]>;
  writeSymptomRecord(record: SymptomRecord): Promise<void>;
  readManagedBillingCacheRecord(): Promise<ManagedBillingCacheRecord>;
  writeManagedBillingCacheRecord(record: ManagedBillingCacheRecord): Promise<void>;
  // Pregnancy-mode repositories. Sensitive fields (edd, dates, endReason,
  // modeOfDelivery, session payloads) live only in the encrypted payload; the
  // plaintext status/day columns carry the minimum needed for selection.
  readActivePregnancy(): Promise<PregnancyRecord | null>;
  listPregnancyRecords(): Promise<PregnancyRecord[]>;
  writePregnancyRecord(record: PregnancyRecord): Promise<void>;
  listKickSessions(
    fromDate?: LocalDateISO,
    toDate?: LocalDateISO,
  ): Promise<KickCountSession[]>;
  writeKickSession(session: KickCountSession): Promise<void>;
  deleteKickSession(id: string): Promise<void>;
  listContractionSessions(
    fromDate?: LocalDateISO,
    toDate?: LocalDateISO,
  ): Promise<ContractionSession[]>;
  writeContractionSession(session: ContractionSession): Promise<void>;
  deleteContractionSession(id: string): Promise<void>;
  // Hard-delete of the entire pregnancy data class: removes ALL pregnancy
  // records, kick sessions, and contraction sessions. A destructive, device-auth
  // gated action; other tables (day logs, profile, symptoms) are untouched.
  deleteAllPregnancyData(): Promise<void>;
  // Postpartum-mode repository. Sensitive fields (startedAt/birth date,
  // modeOfDelivery, endedAt, endReason) live only in the encrypted payload; the
  // plaintext status column carries the minimum needed for the one-active
  // selection query, mirroring pregnancy_records.
  readActivePostpartum(): Promise<PostpartumRecord | null>;
  listPostpartumRecords(): Promise<PostpartumRecord[]>;
  writePostpartumRecord(record: PostpartumRecord): Promise<void>;
  // Hard-delete of the whole postpartum data class: removes ALL postpartum
  // records. Its own destructive, device-auth gated action, separate from
  // deleteAllPregnancyData — pregnancy and postpartum data are deleted
  // independently. Other tables (day logs, profile, symptoms, pregnancy) are
  // untouched.
  deleteAllPostpartumData(): Promise<void>;
  // EPDS mood-screening repository. Mental-health screening answers are a
  // distinct, more-sensitive data class: the answer vector and derived score
  // live ONLY in the encrypted payload, bound to
  // buildLocalDataAad("screening_responses", id); the sole plaintext is the
  // coarse completion `day` used for history ordering and the repeat-cadence
  // query. There is no read-active/single-row concept — a screening is an
  // append-only history — so only a list read is exposed.
  listScreeningResponses(): Promise<ScreeningResponse[]>;
  writeScreeningResponse(response: ScreeningResponse): Promise<void>;
  // Hard-delete of the whole screening data class: removes ALL screening
  // responses. Its own destructive, device-auth gated action, SEPARATE from
  // deleteAllPostpartumData — mental-health screening data is a distinct
  // sensitive class deleted only via its own explicit consent, never coupled to
  // the postpartum delete. Every other table stays untouched.
  deleteAllScreeningData(): Promise<void>;
}
