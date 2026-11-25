// Ownership check for the pregnancy/postpartum module — a one-time on-device
// unlock, deliberately independent of the managed billing snapshot and of any
// account or session: a free, offline, account-less user can own the module,
// and a managed subscription neither grants nor revokes it. Nothing in this
// chain may consult loadManagedBillingSnapshot or require a sync session.
//
// Lapse / scope policy (same rule as every premium gate in this codebase):
// ownership gates ONLY the entry of new pregnancy data (starting a pregnancy,
// logging into the module). Reading, rendering and exporting already-logged
// data must never consult it — baseline local tracking, local analytics, and
// CSV/JSON export stay available regardless (local-first privacy boundary
// invariant, see SECURITY.md).

import { createStorePregnancyEntitlementSource } from "./pregnancy-store-entitlement-source";

/**
 * A source answers one question: does this device own the pregnancy module?
 *
 * The production source is the store's purchase record
 * (pregnancy-store-entitlement-source). Every source is treated as untrusted
 * by the resolver: a throw or a non-`true` answer reads as "not owned".
 */
export type PregnancyEntitlementSource = {
  loadOwnsPregnancyModule(): Promise<boolean>;
};

/**
 * Resolves module ownership through the given source, failing closed: any
 * source error — and any answer that is not literally `true` — resolves to
 * `false`. Callers never need their own try/catch.
 */
export async function loadPregnancyModuleOwned(
  source: PregnancyEntitlementSource = createDefaultPregnancyEntitlementSource(),
): Promise<boolean> {
  try {
    return (await source.loadOwnsPregnancyModule()) === true;
  } catch {
    return false;
  }
}

/**
 * The runtime source: the store purchase, OR-ed with the development flag.
 * The flag can only add ownership, and only in a development build — in a
 * release build it answers `false` and the store alone decides. A flag that
 * is off, or throws, never hides a store purchase.
 */
export function createDefaultPregnancyEntitlementSource(
  options: {
    devFlagSource?: PregnancyEntitlementSource;
    storeSource?: PregnancyEntitlementSource;
  } = {},
): PregnancyEntitlementSource {
  const devFlagSource =
    options.devFlagSource ?? createDevFlagPregnancyEntitlementSource();
  const storeSource =
    options.storeSource ?? createStorePregnancyEntitlementSource();

  return {
    async loadOwnsPregnancyModule(): Promise<boolean> {
      const devUnlocked = await devFlagSource
        .loadOwnsPregnancyModule()
        .catch(() => false);
      if (devUnlocked === true) {
        return true;
      }
      return storeSource.loadOwnsPregnancyModule();
    },
  };
}

/**
 * Development override: a build-time flag, honored ONLY in development builds
 * (`__DEV__`, which also covers the E2E lanes — they run dev builds). A
 * release build always resolves `false`, no matter what the environment
 * claims: the only way to own the module in production is the store purchase.
 *
 * `isDevelopment` / `flagValue` exist for tests (mirrors
 * app-screen-protection's `options.isDevelopment ?? __DEV__` pattern); runtime
 * callers use the defaults.
 */
export function createDevFlagPregnancyEntitlementSource(
  options: { isDevelopment?: boolean; flagValue?: string } = {},
): PregnancyEntitlementSource {
  const isDevelopment = options.isDevelopment ?? __DEV__;
  const flagValue =
    options.flagValue ?? process.env.EXPO_PUBLIC_PREGNANCY_MODULE_DEV_UNLOCK;

  return {
    async loadOwnsPregnancyModule(): Promise<boolean> {
      if (!isDevelopment) {
        return false;
      }
      return flagValue === "1" || flagValue === "true";
    },
  };
}
