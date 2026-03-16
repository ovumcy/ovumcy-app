import AsyncStorage from "@react-native-async-storage/async-storage";

import type { OnboardingRecord } from "../../models/onboarding";
import { createDefaultOnboardingRecord } from "../../services/onboarding-policy";
import type {
  LocalAppStorage,
  LocalBootstrapState,
} from "./storage-contract";

const BOOTSTRAP_STATE_KEY = "ovumcy/bootstrap-state";
const ONBOARDING_RECORD_KEY = "ovumcy/onboarding-record";

export function createAsyncStorageAppStorage(): LocalAppStorage {
  return {
    async readBootstrapState(): Promise<LocalBootstrapState> {
      const rawValue = await AsyncStorage.getItem(BOOTSTRAP_STATE_KEY);
      if (!rawValue) {
        return {
          hasCompletedOnboarding: false,
          profileVersion: 1,
        };
      }

      const parsed = safeParse<Partial<LocalBootstrapState>>(rawValue);
      return {
        hasCompletedOnboarding: parsed?.hasCompletedOnboarding === true,
        profileVersion:
          typeof parsed?.profileVersion === "number" && Number.isFinite(parsed.profileVersion)
            ? parsed.profileVersion
            : 1,
      };
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
    },

    async writeOnboardingRecord(record: OnboardingRecord): Promise<void> {
      await AsyncStorage.setItem(ONBOARDING_RECORD_KEY, JSON.stringify(record));
    },
  };
}

function safeParse<T>(rawValue: string): T | null {
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return null;
  }
}
