import type { LocalAppStorage } from "../storage/local/storage-contract";
import type { SyncSecretStore } from "../security/sync-secret-store";
import type { EntitlementTokenStore } from "../security/entitlement-token-store";
import {
  createManagedCloudAPIClient,
  isManagedCloudTransportFailure,
  type ManagedCloudAPIErrorCode,
  type ManagedCloudBillingSnapshot,
  type ManagedCloudPremiumFeatures,
} from "../sync/managed-cloud-api-client";
import { ensureFreshManagedSession } from "../sync/managed-session-refresh-service";
import { MANAGED_CLOUD_AUTH_BASE_URL, type SyncMode } from "../sync/sync-contract";
import { loadSyncSetupState } from "../sync/sync-setup-service";
import { buildEntitlementTokenGate } from "./entitlement-token-gate-service";
import { resolveVerifiedEntitlements } from "./entitlement-token-service";

/**
 * Maps a signed-token entitlement key to the corresponding
 * `ManagedCloudPremiumFeatures` flag. ONLY the two purely-local premium
 * features are token-gated (per the memo); server-gated features
 * (sync/partner/reminders/etc.) keep reading the snapshot and are never
 * overlaid here, because the server refusing the operation is their real
 * boundary.
 */
const TOKEN_GATED_FEATURE_BY_ENTITLEMENT: Readonly<
  Record<string, "doctorPDF" | "advancedInsights">
> = Object.freeze({
  doctor_pdf: "doctorPDF",
  advanced_insights: "advancedInsights",
});

/**
 * Optional signed-entitlement-token gate. When provided, the two purely-local
 * premium features are decided by a VERIFIED token; when absent (today's
 * state) every gate behaves exactly as before — pure billing-snapshot
 * booleans. `now` is injected for deterministic verification.
 */
export type EntitlementTokenGate = {
  store: EntitlementTokenStore;
  now: number;
  // The active managed account id, bound into verification so a token minted
  // for another account is rejected.
  expectedSub?: string;
};

/**
 * Overlays a verified token's entitlements onto the two token-gated features.
 *
 * Rollout phase 1 fallback contract: when a valid token is present, it is
 * authoritative for `doctorPDF` / `advancedInsights`; when no valid token is
 * present (no gate passed, no endpoint, offline with an expired cache, tamper,
 * unknown kid, …) the original snapshot booleans stand unchanged. Server-gated
 * features are never touched.
 */
async function applyEntitlementTokenOverlay(
  features: ManagedCloudPremiumFeatures,
  gate: EntitlementTokenGate | undefined,
  managedSessionToken: string | null,
): Promise<ManagedCloudPremiumFeatures> {
  if (!gate) {
    return features;
  }

  const verified = await resolveVerifiedEntitlements({
    store: gate.store,
    managedSessionToken,
    now: gate.now,
    ...(gate.expectedSub !== undefined ? { expectedSub: gate.expectedSub } : {}),
  });

  // No valid token -> leave the snapshot booleans exactly as they were. A
  // verified token with an empty list is still the issuer's answer and
  // re-locks both features.
  if (verified.status !== "verified") {
    return features;
  }

  const overlaid = { ...features };
  for (const [entitlement, feature] of Object.entries(
    TOKEN_GATED_FEATURE_BY_ENTITLEMENT,
  )) {
    overlaid[feature] = verified.entitlements.has(entitlement);
  }
  return overlaid;
}

export const EMPTY_MANAGED_PREMIUM_FEATURES: ManagedCloudPremiumFeatures = {
  advancedFertility: false,
  advancedInsights: false,
  doctorPDF: false,
  extendedReports: false,
  partnerAccess: false,
  reminders: false,
};

// Bounded offline grace for the LOCAL premium gates. Trade-off: bounded
// availability grace (a network blip or managed outage must not instantly
// re-lock all six premium gates on a paying device) versus strict
// fail-closed enforcement (a revoked plan keeps its local unlocks for at
// most this long while the device cannot reach billing truth). 72 hours is
// the ceiling; after it every failed fetch fails closed exactly as before.
// Server-checked actions (sync upload/restore, partner projections) never
// read this cache — the server stays their authority.
export const MANAGED_BILLING_CACHE_TTL_MS = 72 * 60 * 60 * 1000;

export function isManagedBillingCacheFresh(
  fetchedAt: string,
  now: Date,
  lastServedAt?: string,
): boolean {
  if (isManagedBillingClockWoundBack(fetchedAt, now, lastServedAt)) {
    return false;
  }
  return now.getTime() - Date.parse(fetchedAt) <= MANAGED_BILLING_CACHE_TTL_MS;
}

// Concurrent loads take `now` before their network await and can reach the
// cache out of order, so instants a few minutes apart are not a rewind.
export const MANAGED_BILLING_CLOCK_SKEW_TOLERANCE_MS = 10 * 60 * 1000;

// The 72h window is measured on the device clock, so the clock must never
// run backwards across reads: well behind the fetch instant, or well behind
// the last instant the cache was already served, means it was wound back.
function isManagedBillingClockWoundBack(
  fetchedAt: string,
  now: Date,
  lastServedAt: string | undefined,
): boolean {
  const floorMs = now.getTime() + MANAGED_BILLING_CLOCK_SKEW_TOLERANCE_MS;
  const fetchedAtMs = Date.parse(fetchedAt);
  if (Number.isNaN(fetchedAtMs) || floorMs < fetchedAtMs) {
    return true;
  }
  if (lastServedAt === undefined) {
    return false;
  }
  const lastServedMs = Date.parse(lastServedAt);
  return Number.isNaN(lastServedMs) || floorMs < lastServedMs;
}

function laterInstant(a: string | undefined, b: Date): string {
  const aMs = a === undefined ? Number.NaN : Date.parse(a);
  return !Number.isNaN(aMs) && aMs > b.getTime() ? (a as string) : b.toISOString();
}

/**
 * persistManagedBillingSnapshotCache refreshes the last-known-good billing
 * snapshot after any successful billing fetch. Only the locally-derived plan
 * state and premium booleans are persisted (pre token-overlay server truth);
 * server-driven display state (subscription details, offers) intentionally
 * stays out so it fails closed when served from cache.
 * Cache IO failures are swallowed: caching must never break a successful
 * billing fetch.
 */
export async function persistManagedBillingSnapshotCache(
  storage: LocalAppStorage,
  billing: ManagedCloudBillingSnapshot,
  now: Date,
): Promise<void> {
  try {
    const record = await storage.readManagedBillingCacheRecord();
    await storage.writeManagedBillingCacheRecord({
      ...record,
      snapshot: {
        hasActivePlan: billing.hasActivePlan,
        premiumFeatures: { ...billing.premiumFeatures },
        fetchedAt: now.toISOString(),
      },
    });
  } catch {
    // Best-effort cache refresh; the live snapshot result stands regardless.
  }
}


async function discardCachedBillingSnapshot(storage: LocalAppStorage): Promise<void> {
  try {
    const record = await storage.readManagedBillingCacheRecord();
    if (record.snapshot) {
      await storage.writeManagedBillingCacheRecord({ ...record, snapshot: null });
    }
  } catch {
    // Best-effort: an unreadable cache serves nothing anyway.
  }
}

async function readFreshCachedBillingSnapshot(
  storage: LocalAppStorage,
  now: Date,
): Promise<ManagedCloudBillingSnapshot | null> {
  try {
    const record = await storage.readManagedBillingCacheRecord();
    const snapshot = record.snapshot;
    if (!snapshot) {
      return null;
    }
    if (isManagedBillingClockWoundBack(snapshot.fetchedAt, now, snapshot.lastServedAt)) {
      await storage.writeManagedBillingCacheRecord({ ...record, snapshot: null });
      return null;
    }
    if (!isManagedBillingCacheFresh(snapshot.fetchedAt, now, snapshot.lastServedAt)) {
      return null;
    }
    try {
      // Re-read so a concurrent writer (offer dismissal, another serve) is
      // not overwritten, and only ever move the high-water mark forward.
      const latest = await storage.readManagedBillingCacheRecord();
      if (latest.snapshot?.fetchedAt === snapshot.fetchedAt) {
        await storage.writeManagedBillingCacheRecord({
          ...latest,
          snapshot: {
            ...latest.snapshot,
            lastServedAt: laterInstant(latest.snapshot.lastServedAt, now),
          },
        });
      }
    } catch {
      // The high-water mark is best-effort; the window bound still holds.
    }

    return {
      hasActivePlan: snapshot.hasActivePlan,
      premiumFeatures: { ...snapshot.premiumFeatures },
      // Server-driven display state is never cached: the countdown and the
      // offers both degrade to their empty defaults while the device is on
      // cached billing truth.
      activeSubscription: null,
      offers: [],
    };
  } catch {
    return null;
  }
}

export type ManagedBillingLoadOptions = {
  // Server-checked operations set this: the offline-grace cache is never read,
  // so a failed live fetch yields no premium at all.
  liveOnly?: boolean;
};

export type ManagedBillingSnapshotResult = {
  billing: ManagedCloudBillingSnapshot;
  // "cache" marks the offline-grace copy: premium booleans only, never plan
  // truth for a server-checked decision.
  source: "live" | "cache";
};

// A sign-out or account switch while a managed fetch is in flight replaces or
// clears the session token; the answer then belongs to a session that is gone.
async function isManagedSessionStillCurrent(
  secretStore: SyncSecretStore,
  sessionToken: string,
): Promise<boolean> {
  try {
    const secrets = await secretStore.readSyncSecrets();
    return secrets?.managedAuthSessionToken === sessionToken;
  } catch {
    return false;
  }
}

export async function loadManagedBillingSnapshot(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  // Optional signed-token gate. Absent -> pure snapshot behaviour (today).
  tokenGate?: EntitlementTokenGate,
  now: Date = new Date(),
  options: ManagedBillingLoadOptions = {},
): Promise<ManagedCloudBillingSnapshot | null> {
  const result = await loadManagedBillingSnapshotWithSource(
    storage,
    secretStore,
    syncMode,
    tokenGate,
    now,
    options,
  );
  return result?.billing ?? null;
}

// Only an answer about the session or the plan itself retires the cache; a
// rate limit or an unrecognized refusal says nothing about the plan.
const BILLING_CACHE_RETIRING_ERROR_CODES: ReadonlySet<ManagedCloudAPIErrorCode> =
  new Set<ManagedCloudAPIErrorCode>(["unauthorized", "sync_not_allowed"]);

const SESSION_CHANGED = Symbol("session_changed");

export async function loadManagedBillingSnapshotWithSource(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  tokenGate?: EntitlementTokenGate,
  now: Date = new Date(),
  options: ManagedBillingLoadOptions = {},
): Promise<ManagedBillingSnapshotResult | null> {
  if (syncMode !== "managed") {
    return null;
  }

  // A session token that changes mid-load is either a refresh rotation or an
  // account switch; one more pass reads billing under the session now present.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await loadManagedBillingSnapshotOnce(
      storage,
      secretStore,
      tokenGate,
      now,
      options,
    );
    if (result !== SESSION_CHANGED) {
      return result;
    }
  }
  return null;
}

async function loadManagedBillingSnapshotOnce(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  tokenGate: EntitlementTokenGate | undefined,
  now: Date,
  options: ManagedBillingLoadOptions,
): Promise<ManagedBillingSnapshotResult | null | typeof SESSION_CHANGED> {
  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.managedAuthSessionToken) {
    // No session, no grace: the cache is only ever served underneath a
    // still-present managed session whose billing fetch failed.
    return null;
  }

  // This is the managed read every premium surface funnels through — dashboard,
  // calendar, stats, backup-sync — so it is where a short-lived access session
  // gets renewed. Doing it here keeps one refresher for many readers: every
  // other consumer of `managedAuthSessionToken` finds a fresh token already
  // written to the secret store.
  const session = await ensureFreshManagedSession(secretStore, now);
  if (!session.ok) {
    // The refresh chain is dead and the credentials have been cleared. Serving
    // the offline-grace cache under a session that no longer exists would be
    // exactly the unbounded cached-premium the billing invariant forbids.
    return null;
  }

  const billingResult = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).getBillingSnapshot(session.sessionToken);

  let billing: ManagedCloudBillingSnapshot;
  let source: ManagedBillingSnapshotResult["source"];
  if (billingResult.ok) {
    billing = billingResult.billing;
    source = "live";
  } else {
    // The offline-grace cache answers only "the server could not be asked"
    // (no response / temporary unavailability), and only for premium display
    // surfaces. A refusal yields no cached premium, and one about the session
    // or the plan discards the cached snapshot so a later network blip cannot
    // revive premium the server has just refused. A server-checked caller
    // (`liveOnly`) gets no cached premium.
    if (!isManagedCloudTransportFailure(billingResult.errorCode)) {
      if (!(await isManagedSessionStillCurrent(secretStore, session.sessionToken))) {
        return SESSION_CHANGED;
      }
      if (BILLING_CACHE_RETIRING_ERROR_CODES.has(billingResult.errorCode)) {
        await discardCachedBillingSnapshot(storage);
      }
      return null;
    }
    if (options.liveOnly === true) {
      return null;
    }
    const cached = await readFreshCachedBillingSnapshot(storage, now);
    if (!cached) {
      return null;
    }
    billing = cached;
    source = "cache";
  }

  // Overlay verified-token entitlements onto the two purely-local features.
  // When no gate is supplied or no valid token is present, premiumFeatures is
  // returned unchanged.
  const premiumFeatures = await applyEntitlementTokenOverlay(
    billing.premiumFeatures,
    tokenGate,
    session.sessionToken,
  );

  if (!(await isManagedSessionStillCurrent(secretStore, session.sessionToken))) {
    return SESSION_CHANGED;
  }
  if (source === "live") {
    await persistManagedBillingSnapshotCache(storage, billing, now);
  }
  return {
    billing:
      premiumFeatures === billing.premiumFeatures
        ? billing
        : { ...billing, premiumFeatures },
    source,
  };
}

export async function loadManagedPremiumFeatures(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  tokenGate?: EntitlementTokenGate,
  now: Date = new Date(),
  options: ManagedBillingLoadOptions = {},
): Promise<ManagedCloudPremiumFeatures> {
  const billingSnapshot = await loadManagedBillingSnapshot(
    storage,
    secretStore,
    syncMode,
    tokenGate,
    now,
    options,
  );
  return billingSnapshot?.premiumFeatures ?? EMPTY_MANAGED_PREMIUM_FEATURES;
}

export async function loadManagedPremiumFeaturesForCurrentSession(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  // When a caller supplies a gate it is used verbatim (tests / DI). Otherwise
  // the signed-token gate is constructed for the active managed session so the
  // two purely-local premium features are decided by a verified token; the
  // builder returns undefined (snapshot behaviour preserved) whenever the
  // active account id cannot be confirmed.
  tokenGate?: EntitlementTokenGate,
): Promise<ManagedCloudPremiumFeatures> {
  try {
    const syncState = await loadSyncSetupState(storage, secretStore);
    if (!syncState.hasAuthSession || syncState.preferences.mode !== "managed") {
      return EMPTY_MANAGED_PREMIUM_FEATURES;
    }

    const gate =
      tokenGate ??
      (await buildEntitlementTokenGate(
        secretStore,
        syncState.preferences.mode,
      ));

    return loadManagedPremiumFeatures(
      storage,
      secretStore,
      syncState.preferences.mode,
      gate,
    );
  } catch {
    return EMPTY_MANAGED_PREMIUM_FEATURES;
  }
}
