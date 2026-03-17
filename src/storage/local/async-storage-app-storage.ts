import AsyncStorage from "@react-native-async-storage/async-storage";

import type { OnboardingRecord } from "../../models/onboarding";
import { createDefaultOnboardingRecord } from "../../services/onboarding-policy";
import type {
  LocalAppStorage,
  LocalBootstrapState,
} from "./storage-contract";
import { createDefaultBootstrapState } from "./storage-contract";

export const BOOTSTRAP_STATE_KEY = "ovumcy/bootstrap-state";
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

    async readOnboardingRecord(): Promise<OnboardingRecord> {
      return readAsyncStorageOnboardingRecord();
    },

    async writeOnboardingRecord(record: OnboardingRecord): Promise<void> {
      await AsyncStorage.setItem(ONBOARDING_RECORD_KEY, JSON.stringify(record));
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
        : 1,
  };
}

export async function readAsyncStorageOnboardingRecord(): Promise<OnboardingRecord> {
  const rawValue = await AsyncStorage.getItem(ONBOARDING_RECORD_KEY);
  if (!rawValue) {
    return createDefaultOnboardingRecord();
  }

  const parsed = safeParse<Partial<OnboardingRecord>>(rawValue);
  return {
    ...createDefaultOnboardingRecord(),
    ...parsed,
    lastPeriodStart:
      typeof parsed?.lastPeriodStart === "string" ? parsed.lastPeriodStart : null,
  };
}

export async function hasAsyncStorageLocalAppData(): Promise<boolean> {
  const entries = await AsyncStorage.multiGet([
    BOOTSTRAP_STATE_KEY,
    ONBOARDING_RECORD_KEY,
  ]);
  const bootstrapState = entries[0];
  const onboardingRecord = entries[1];

  return bootstrapState?.[1] !== null || onboardingRecord?.[1] !== null;
}

export async function clearAsyncStorageLocalAppData(): Promise<void> {
  await AsyncStorage.multiRemove([BOOTSTRAP_STATE_KEY, ONBOARDING_RECORD_KEY]);
}

function safeParse<T>(rawValue: string): T | null {
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}
