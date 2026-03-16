import type { LocalBootstrapState } from "../storage/local/storage-contract";

export function buildInitialBootstrapState(): LocalBootstrapState {
  return {
    hasCompletedOnboarding: false,
    profileVersion: 1,
  };
}
