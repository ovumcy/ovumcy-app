import type { OnboardingRecord } from "../../models/onboarding";

export type LocalBootstrapState = {
  hasCompletedOnboarding: boolean;
  profileVersion: number;
};

export function createDefaultBootstrapState(): LocalBootstrapState {
  return {
    hasCompletedOnboarding: false,
    profileVersion: 1,
  };
}

export interface LocalAppStorage {
  readBootstrapState(): Promise<LocalBootstrapState>;
  writeBootstrapState(state: LocalBootstrapState): Promise<void>;
  readOnboardingRecord(): Promise<OnboardingRecord>;
  writeOnboardingRecord(record: OnboardingRecord): Promise<void>;
}
