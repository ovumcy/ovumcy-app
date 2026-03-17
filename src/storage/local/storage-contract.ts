import type { OnboardingRecord } from "../../models/onboarding";
import type { ProfileRecord } from "../../models/profile";

export type LocalBootstrapState = {
  hasCompletedOnboarding: boolean;
  profileVersion: number;
};

export function createDefaultBootstrapState(): LocalBootstrapState {
  return {
    hasCompletedOnboarding: false,
    profileVersion: 2,
  };
}

export interface LocalAppStorage {
  readBootstrapState(): Promise<LocalBootstrapState>;
  writeBootstrapState(state: LocalBootstrapState): Promise<void>;
  readProfileRecord(): Promise<ProfileRecord>;
  writeProfileRecord(record: ProfileRecord): Promise<void>;
  readOnboardingRecord(): Promise<OnboardingRecord>;
  writeOnboardingRecord(record: OnboardingRecord): Promise<void>;
}
