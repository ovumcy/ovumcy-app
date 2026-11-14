import AsyncStorage from "@react-native-async-storage/async-storage";

import type { OnboardingRecord } from "../../models/onboarding";
import {
  createDefaultProfileRecord,
  normalizeCalendarPredictionNoticeKey,
  normalizeInterfaceLanguage,
  normalizeOnboardingHelperNoticeKey,
  normalizeThemePreference,
  normalizeWeekStartDay,
  type ProfileRecord,
} from "../../models/profile";
import {
  applyOnboardingRecordToProfile,
  createDefaultOnboardingRecord,
} from "../../services/onboarding-policy";
import { normalizeAgeGroup } from "../../services/profile-settings-policy";
import type { LocalBootstrapState } from "./storage-contract";
import {
  createDefaultBootstrapState,
  resolveBootstrapIncompleteOnboardingStep,
} from "./storage-contract";

// Legacy plaintext source only. Builds that predate SQLite kept health data
// under these keys; this module reads the bootstrap and profile records for the
// one-time import into the encrypted store and scrubs every legacy key. Nothing
// here writes health data to AsyncStorage.
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
  // forensically scrubbed on clear like the other health-data keys.
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
