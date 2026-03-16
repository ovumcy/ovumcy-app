import type { LocalBootstrapState } from "../storage/local/storage-contract";
import { createAsyncStorageAppStorage } from "../storage/local/async-storage-app-storage";

export function buildInitialBootstrapState(): LocalBootstrapState {
  return {
    hasCompletedOnboarding: false,
    profileVersion: 1,
  };
}

export function resolveEntryHref(
  state: LocalBootstrapState,
): "/onboarding" | "/(tabs)/dashboard" {
  return state.hasCompletedOnboarding ? "/(tabs)/dashboard" : "/onboarding";
}

export const appStorage = createAsyncStorageAppStorage();
