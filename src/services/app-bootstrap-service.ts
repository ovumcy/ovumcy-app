import type {
  LocalAppStorage,
  LocalBootstrapState,
} from "../storage/local/storage-contract";
import { createDefaultBootstrapState } from "../storage/local/storage-contract";
import { createPlatformLocalAppStorage } from "../storage/local/platform-local-app-storage";

export function buildInitialBootstrapState(): LocalBootstrapState {
  return createDefaultBootstrapState();
}

export function resolveEntryHref(
  state: LocalBootstrapState,
): "/onboarding" | "/(tabs)/dashboard" {
  return state.hasCompletedOnboarding ? "/(tabs)/dashboard" : "/onboarding";
}

export const appStorage = createPlatformLocalAppStorage();

export async function loadBootstrapState(
  storage: LocalAppStorage = appStorage,
): Promise<LocalBootstrapState> {
  return storage.readBootstrapState();
}

export async function resolveInitialEntryHref(
  storage: LocalAppStorage = appStorage,
): Promise<"/onboarding" | "/(tabs)/dashboard"> {
  const state = await loadBootstrapState(storage);
  return resolveEntryHref(state);
}

export async function readHasCompletedOnboarding(
  storage: LocalAppStorage = appStorage,
): Promise<boolean> {
  const state = await loadBootstrapState(storage);
  return state.hasCompletedOnboarding;
}
