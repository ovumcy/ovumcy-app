import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIClient,
  type ManagedCloudAuthResult,
} from "./managed-cloud-api-client";
import {
  MANAGED_CLOUD_AUTH_BASE_URL,
  type SyncSecretsRecord,
} from "./sync-contract";

type ManagedCloudAPIClientFactory = (baseURL: string) => ManagedCloudAPIClient;

/**
 * How close to its expiry an access session may get before it is renewed. The
 * managed cloud issues short access sessions (24h by default), so renewing
 * with a few minutes to spare keeps a long-running screen from firing a
 * request that expires mid-flight, without renewing on every read.
 */
export const MANAGED_SESSION_REFRESH_SKEW_MS = 5 * 60 * 1000;

export type EnsureFreshManagedSessionResult =
  | {
      ok: true;
      sessionToken: string;
      /** True only when this call actually exchanged a refresh token. */
      refreshed: boolean;
    }
  | {
      ok: false;
      /** No managed session on this device at all — nothing to refresh. */
      errorCode: "no_session";
    }
  | {
      ok: false;
      /**
       * The refresh chain is dead (revoked, expired, or already spent) and the
       * stored session has been cleared. The owner has to sign in again.
       */
      errorCode: "session_expired";
    };

// A single in-flight refresh, shared by every concurrent caller. Refresh
// tokens are single-use and the server treats a second use of the same token
// as a leak — it revokes the whole family — so two parallel refreshes would
// sign the owner out of their own device. One device holds at most one managed
// session, so a single module-level slot is the whole coordination needed.
let inFlightRefresh: Promise<EnsureFreshManagedSessionResult> | null = null;

/**
 * ensureFreshManagedSession returns a managed access token that is safe to use
 * right now, renewing it first when it is about to expire.
 *
 * It is deliberately forgiving in every direction except a dead refresh chain:
 * a device whose server never issued a refresh token keeps using its long-lived
 * session unchanged, and a network failure returns the existing token rather
 * than clearing it — being offline must never look like being signed out.
 */
export async function ensureFreshManagedSession(
  secretStore: SyncSecretStore,
  now: Date = new Date(),
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<EnsureFreshManagedSessionResult> {
  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.managedAuthSessionToken) {
    return { ok: false, errorCode: "no_session" };
  }

  const sessionToken = secrets.managedAuthSessionToken;
  if (!secrets.managedRefreshToken) {
    // Legacy session, or a managed deployment without refresh tokens: the
    // session is long-lived by construction, so there is nothing to renew.
    return { ok: true, sessionToken, refreshed: false };
  }

  if (!isDueForRefresh(secrets.managedAuthSessionExpiresAt, now)) {
    return { ok: true, sessionToken, refreshed: false };
  }

  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const refreshToken = secrets.managedRefreshToken;
  inFlightRefresh = exchangeRefreshToken(
    secretStore,
    secrets,
    { refreshToken, currentSessionToken: sessionToken },
    managedClientFactory,
  ).finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}

/**
 * applyManagedAuthResultToSecrets folds a fresh auth result into a secrets
 * record. Every managed sign-in path routes its result through here so the
 * session token, its expiry, and the refresh pair are always written together
 * — a half-updated record would either renew against a spent token or expire
 * with a usable one sitting unused beside it.
 */
export function applyManagedAuthResultToSecrets(
  secrets: SyncSecretsRecord,
  auth: ManagedCloudAuthResult,
): SyncSecretsRecord {
  return {
    ...secrets,
    managedAuthSessionToken: auth.sessionToken,
    managedAuthSessionExpiresAt: auth.sessionExpiresAt || null,
    managedRefreshToken: auth.refreshToken ?? null,
    managedRefreshTokenExpiresAt: auth.refreshTokenExpiresAt ?? null,
  };
}

/**
 * clearManagedSessionFromSecrets drops every managed credential at once. Used
 * when the server has told us the session is gone, so no stale token or
 * unusable refresh token is left behind to be retried.
 */
export function clearManagedSessionFromSecrets(
  secrets: SyncSecretsRecord,
): SyncSecretsRecord {
  return {
    ...secrets,
    managedAuthSessionToken: null,
    managedAuthSessionExpiresAt: null,
    managedRefreshToken: null,
    managedRefreshTokenExpiresAt: null,
  };
}

/** Test seam: drops the shared in-flight refresh between cases. */
export function resetManagedSessionRefreshStateForTests(): void {
  inFlightRefresh = null;
}

async function exchangeRefreshToken(
  secretStore: SyncSecretStore,
  secrets: SyncSecretsRecord,
  // The caller has already established that a session token exists, so it is
  // handed over rather than re-derived here — re-reading it from the record
  // would need a defensive fallback for a case that cannot happen.
  tokens: { refreshToken: string; currentSessionToken: string },
  managedClientFactory: ManagedCloudAPIClientFactory,
): Promise<EnsureFreshManagedSessionResult> {
  const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
  const result = await client.refreshSession(tokens.refreshToken);

  if (result.ok) {
    await secretStore.writeSyncSecrets(
      applyManagedAuthResultToSecrets(secrets, result.auth),
    );
    return {
      ok: true,
      sessionToken: result.auth.sessionToken,
      refreshed: true,
    };
  }

  if (result.errorCode === "unauthorized") {
    // The server has already revoked this token's whole family; keeping the
    // credentials would only produce repeated failures.
    await secretStore.writeSyncSecrets(clearManagedSessionFromSecrets(secrets));
    return { ok: false, errorCode: "session_expired" };
  }

  // Network trouble, rate limiting, or a server error. The session may well
  // still be valid — hand back what we have and let the actual request decide.
  return {
    ok: true,
    sessionToken: tokens.currentSessionToken,
    refreshed: false,
  };
}

function isDueForRefresh(expiresAt: string | null, now: Date): boolean {
  if (!expiresAt) {
    // A session whose expiry the server never reported cannot be renewed on a
    // schedule; leave it alone and let a real 401 drive re-authentication.
    return false;
  }

  const expiryMs = Date.parse(expiresAt);
  if (Number.isNaN(expiryMs)) {
    return false;
  }

  return expiryMs - now.getTime() <= MANAGED_SESSION_REFRESH_SKEW_MS;
}
