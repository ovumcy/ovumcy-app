import AsyncStorage from "@react-native-async-storage/async-storage";

import type { OnboardingRecord } from "../../models/onboarding";
import {
  createDefaultProfileRecord,
  type ProfileRecord,
} from "../../models/profile";
import {
  applyOnboardingRecordToProfile,
  createDefaultOnboardingRecord,
  profileToOnboardingRecord,
} from "../../services/onboarding-policy";
import type {
  LocalAppStorage,
  LocalBootstrapState,
} from "./storage-contract";
import { createDefaultBootstrapState } from "./storage-contract";

export const BOOTSTRAP_STATE_KEY = "ovumcy/bootstrap-state";
export const PROFILE_RECORD_KEY = "ovumcy/profile-record";
export const ONBOARDING_RECORD_KEY = "ovumcy/onboarding-record";

export function createAsyncStorageAppStorage(): LocalAppStorage {
  return {
    async readBootstrapState(): Promise<LocalBootstrapState> {
      return readAsyncStorageBootstrapState();
    },

    async writeBootstrapState(state: LocalBootstrapState): Promise<void> {
      await AsyncStorage.setItem(
        BOOTSTRAP_STATE_KEY,
        JSON.stringify({
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          profileVersion: state.profileVersion,
        }),
      );
    },

    async readProfileRecord(): Promise<ProfileRecord> {
      return readAsyncStorageProfileRecord();
    },

    async writeProfileRecord(record: ProfileRecord): Promise<void> {
      await AsyncStorage.setItem(PROFILE_RECORD_KEY, JSON.stringify(record));
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
  };
}

export async function readAsyncStorageBootstrapState(): Promise<LocalBootstrapState> {
  const rawValue = await AsyncStorage.getItem(BOOTSTRAP_STATE_KEY);
  if (!rawValue) {
    return createDefaultBootstrapState();
  }

  const parsed = safeParse<Partial<LocalBootstrapState>>(rawValue);
  return {
    hasCompletedOnboarding: parsed?.hasCompletedOnboarding === true,
    profileVersion:
      typeof parsed?.profileVersion === "number" && Number.isFinite(parsed.profileVersion)
        ? parsed.profileVersion
        : 2,
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

export async function readAsyncStorageOnboardingRecord(): Promise<OnboardingRecord> {
  const profile = await readAsyncStorageProfileRecord();
  return profileToOnboardingRecord(profile);
}

export async function hasAsyncStorageLocalAppData(): Promise<boolean> {
  const entries = await AsyncStorage.multiGet([
    BOOTSTRAP_STATE_KEY,
    PROFILE_RECORD_KEY,
    ONBOARDING_RECORD_KEY,
  ]);
  const bootstrapState = entries[0];
  const profileRecord = entries[1];
  const onboardingRecord = entries[2];

  return (
    bootstrapState?.[1] !== null ||
    profileRecord?.[1] !== null ||
    onboardingRecord?.[1] !== null
  );
}

export async function clearAsyncStorageLocalAppData(): Promise<void> {
  await AsyncStorage.multiRemove([
    BOOTSTRAP_STATE_KEY,
    PROFILE_RECORD_KEY,
    ONBOARDING_RECORD_KEY,
  ]);
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
  };
}
