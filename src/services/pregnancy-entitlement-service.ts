// Ownership check for the pregnancy/postpartum module — a one-time on-device
// unlock, deliberately independent of the managed billing snapshot and of any
// account or session: a free, offline, account-less user can own the module,
// and a managed subscription neither grants nor revokes it. Nothing in this
// chain may consult loadManagedBillingSnapshot or require a sync session.
//
// Lapse / scope policy (same rule as every premium gate in this codebase):
// ownership gates ONLY (i) starting or creating new pregnancy data and
// (ii) rendering pregnancy-mode surfaces. Reading and exporting already-logged
// data must never consult it — baseline local tracking, local analytics, and
// CSV/JSON export stay available regardless (local-first privacy boundary
// invariant, see SECURITY.md).

/**
 * A source answers one question: does this device own the pregnancy module?
 *
 * The production source will be a store-receipt check (StoreKit 2 /
 * Play Billing) once in-app purchases land; until then the dev-flag source
 * below is the only implementation. Every source is treated as untrusted by
 * the resolver: a throw or a non-`true` answer reads as "not owned".
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
  source: PregnancyEntitlementSource = createDevFlagPregnancyEntitlementSource(),
): Promise<boolean> {
  try {
    return (await source.loadOwnsPregnancyModule()) === true;
  } catch {
    return false;
  }
}

/**
 * Interim source until the store-receipt source exists: a build-time flag,
 * honored ONLY in development builds (`__DEV__`, which also covers the E2E
 * lanes — they run dev builds). A release build always resolves `false`, no
 * matter what the environment claims: there is no legitimate way to own the
 * module in production before the purchase path ships.
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
