import type { EntitlementTokenStore } from "../security/entitlement-token-store";
import {
  resolveEmbeddedEntitlementPublicKeys,
  verifyEntitlementToken,
} from "../security/entitlement-token";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIClient,
} from "../sync/managed-cloud-api-client";
import { MANAGED_CLOUD_AUTH_BASE_URL } from "../sync/sync-contract";

/**
 * Token lifecycle for the purely-local premium gates.
 *
 * Flow (rollout phase 1, fail-closed):
 *  1. If a managed session token is available, POST /account/entitlements/token.
 *     - On success: cache the JWT in secure storage and verify it for THIS
 *       request.
 *     - On 503 / absent endpoint / network failure: keep the cached token (the
 *       offline grace — the signed 24h `exp` is the authoritative window) and
 *       verify that instead.
 *  2. Verify the chosen token against the embedded public keys + `now` +
 *     `expectedSub` (the active managed account id). Only a token that passes
 *     verification yields entitlements; an expired token re-locks (the verifier
 *     rejects `exp <= now`), and the caller then falls back to the snapshot.
 *
 * This module NEVER throws to its callers — any failure resolves to an empty
 * entitlement set so the premium gate falls back to the billing-snapshot
 * boolean, preserving today's behaviour exactly.
 */

export type ResolveVerifiedEntitlementsInput = {
  store: EntitlementTokenStore;
  // The managed session bearer token; when absent we can't fetch a fresh token
  // and rely on whatever is cached.
  managedSessionToken: string | null;
  // The active managed account id; bound into verification so a token minted
  // for another account is rejected. Omitted -> no sub binding.
  expectedSub?: string;
  now: number;
  // Injected for tests; defaults to the real managed client against the
  // configured base URL.
  client?: ManagedCloudAPIClient;
  // Injected for tests; defaults to the embedded/production public-key map.
  publicKeysByKid?: Record<string, string>;
};

/**
 * Resolves the set of entitlement keys carried by a VERIFIED token, or an empty
 * set when no valid token is available (offline with an expired cache, no
 * endpoint, unknown kid, tamper, etc.). The caller overlays this set onto the
 * billing snapshot for the token-gated features and falls back to the snapshot
 * boolean when the set is empty/absent.
 */
export async function resolveVerifiedEntitlements(
  input: ResolveVerifiedEntitlementsInput,
): Promise<Set<string>> {
  const publicKeysByKid =
    input.publicKeysByKid ?? resolveEmbeddedEntitlementPublicKeys();

  try {
    const token = await loadToken(input);
    if (!token) {
      return new Set();
    }

    const verifyOptions: Parameters<typeof verifyEntitlementToken>[1] = {
      publicKeysByKid,
      now: input.now,
    };
    if (input.expectedSub !== undefined) {
      verifyOptions.expectedSub = input.expectedSub;
    }

    const result = verifyEntitlementToken(token, verifyOptions);
    if (!result.valid) {
      return new Set();
    }
    return new Set(result.entitlements);
  } catch {
    // Defensive: any unexpected error must not break the gate; fall back.
    return new Set();
  }
}

/**
 * Picks the token to verify: a freshly fetched one when the endpoint answers,
 * otherwise the cached one (offline grace). Caches a freshly fetched token.
 * Returns null when neither source yields a token.
 */
async function loadToken(
  input: ResolveVerifiedEntitlementsInput,
): Promise<string | null> {
  const client =
    input.client ?? createManagedCloudAPIClient(MANAGED_CLOUD_AUTH_BASE_URL);

  if (input.managedSessionToken) {
    const fetched = await client.getEntitlementToken(input.managedSessionToken);
    if (fetched.ok) {
      // Cache for offline use; the signed exp bounds how long it stays useful.
      await input.store.writeEntitlementToken({ token: fetched.result.token });
      return fetched.result.token;
    }
    // 503 / absent endpoint / network failure: fall through to the cached
    // token (offline grace). Pre-rollout (no endpoint) this is the common path
    // and there is simply no cached token, so the gate falls back to snapshot.
  }

  const cached = await input.store.readEntitlementToken();
  return cached?.token ?? null;
}

/**
 * Clears the cached entitlement token. Call on sign-out / disconnect so a
 * stale token cannot keep premium UI unlocked after the session is gone.
 */
export async function clearEntitlementTokenCache(
  store: EntitlementTokenStore,
): Promise<void> {
  await store.clearEntitlementToken();
}
