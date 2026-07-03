import type { DayLogRecord } from "../../models/day-log";
import type { OnboardingRecord, OnboardingStep } from "../../models/onboarding";
import type { ProfileRecord } from "../../models/profile";
import type { SyncPreferencesRecord } from "../../sync/sync-contract";
import type { SymptomRecord } from "../../models/symptom";

// ManagedBillingCachedSnapshot is the last-known-good managed billing state
// persisted for the bounded offline grace window. It carries only what local
// feature gates derive (plan state + the six premium booleans) plus the
// fetchedAt timestamp of the successful server fetch; server-driven
// affordances (active subscription details, renewal management, offers) are
// deliberately NOT cached so they fail closed while offline.
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
}
