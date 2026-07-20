import type { EntitlementTokenStore } from "../security/entitlement-token-store";
import { createPlatformEntitlementTokenStore } from "../security/platform-entitlement-token-store";
import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIClient,
} from "../sync/managed-cloud-api-client";
import { MANAGED_CLOUD_AUTH_BASE_URL, type SyncMode } from "../sync/sync-contract";
import type { EntitlementTokenGate } from "./managed-premium-features-service";

/**
 * Builds the optional signed-entitlement-token gate for the two purely-local
 * premium features (doctor PDF, advanced insights). When this returns a gate,
 * `loadManagedBillingSnapshot`/`loadManagedPremiumFeatures` decide
 * `doctorPDF`/`advancedInsights` from a VERIFIED token; when it returns
 * `undefined`, those functions keep reading the billing-snapshot booleans
 * exactly as before (the fail-to-snapshot default). Server-gated features are
 * never touched by the gate.
 *
 * `expectedSub` is bound to the ACTIVE managed account id (resolved from the
 * live session view) so a token minted for another account — e.g. a token
 * cached under a previous account before this device switched accounts — is
 * rejected by the verifier and the gate falls back to the snapshot.
 *
 * Fail-to-snapshot, never crash, never silently grant: the builder returns
 * `undefined` (no gate) whenever it cannot AUTHORITATIVELY confirm the active
 * account id — not managed, no managed session, the session view fetch fails
 * (offline / unauthorized / malformed), or the account id is empty. In every
 * such case the premium resolution degrades to the billing snapshot (which may
 * itself be served from the bounded 72h offline-grace cache). The signed-token
 * hardening therefore raises the bar on the ONLINE decision; offline it degrades
 * to the same snapshot booleans callers already trusted.
 */
export type BuildEntitlementTokenGateOptions = {
  // Current time in UNIX SECONDS (the unit the token `exp` claim uses); injected
  // for deterministic verification. Defaults to the real wall clock.
  nowSeconds?: number;
  // Injected for tests; defaults to the platform secure-store-backed token cache.
  tokenStore?: EntitlementTokenStore;
  // Injected for tests; defaults to the real managed client against the
  // configured base URL.
  managedClient?: ManagedCloudAPIClient;
};

export async function buildEntitlementTokenGate(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  options: BuildEntitlementTokenGateOptions = {},
): Promise<EntitlementTokenGate | undefined> {
  // Only the managed cloud mints entitlement tokens; self-hosted / no sync never
  // carries a token, so there is nothing to overlay.
  if (syncMode !== "managed") {
    return undefined;
  }

  let sessionToken: string | null = null;
  try {
    const secrets = await secretStore.readSyncSecrets();
    sessionToken = secrets?.managedAuthSessionToken ?? null;
  } catch {
    return undefined;
  }
  if (!sessionToken) {
    return undefined;
  }

  const client =
    options.managedClient ??
    createManagedCloudAPIClient(MANAGED_CLOUD_AUTH_BASE_URL);

  let expectedSub = "";
  try {
    const sessionResult = await client.getSession(sessionToken);
    if (!sessionResult.ok) {
      // Cannot confirm the active account id (offline, unauthorized, malformed):
      // do NOT bind a gate. The premium resolution falls back to the snapshot.
      return undefined;
    }
    expectedSub = sessionResult.session.accountID;
  } catch {
    return undefined;
  }
  if (expectedSub.length === 0) {
    return undefined;
  }

  const tokenStore = options.tokenStore ?? createPlatformEntitlementTokenStore();
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);

  return {
    store: tokenStore,
    now: nowSeconds,
    expectedSub,
  };
}
