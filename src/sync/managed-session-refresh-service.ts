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

export type ManagedCloudAPIClientFactory = (baseURL: string) => ManagedCloudAPIClient;

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

export type RenewRejectedManagedSessionResult =
  | {
      ok: true;
      /** A session token other than the rejected one, safe to retry with. */
      sessionToken: string;
    }
  | { ok: false; errorCode: "no_session" }
  /** The session is gone and its credentials have been cleared. */
  | { ok: false; errorCode: "session_expired" }
  /**
   * The refresh could not be completed (network, rate limit, server fault).
   * The stored credentials are untouched: the refresh token may still be good.
   */
  | { ok: false; errorCode: "refresh_unavailable" };

type RefreshFlightOutcome =
  | { kind: "session"; sessionToken: string; refreshed: boolean }
  | { kind: "unavailable"; sessionToken: string }
  | { kind: "no_session" }
  | { kind: "expired" };

type RefreshFlightTrigger =
  | { kind: "due"; now: Date }
  | { kind: "rejected"; sessionToken: string };

// A single in-flight refresh, shared by every concurrent caller. Refresh
// tokens are single-use and the server treats a second use of the same token
// as a leak — it revokes the whole family — so two parallel refreshes would
// sign the owner out of their own device. One device holds at most one managed
// session, so a single module-level slot is the whole coordination needed.
// The flight reads the stored record itself, after taking the slot: a caller's
// earlier read may predate a refresh that has since landed, and exchanging the
// refresh token from that read would spend a token the server already rotated.
let inFlightRefresh: Promise<RefreshFlightOutcome> | null = null;

// Advanced when the managed session ends on this device: a refresh begun under
// an earlier epoch must not write its tokens back over the wipe.
let sessionEpoch = 0;

/** Waits out a refresh already in flight, so the caller reads its tokens. */
export async function settleInFlightManagedRefresh(): Promise<void> {
  await inFlightRefresh?.catch(() => undefined);
}

/** Keeps any refresh still in flight from reviving the session that ended. */
export function endManagedSessionRefresh(): void {
  sessionEpoch += 1;
}

/** Changes whenever a managed session ends on this device. */
export function readManagedSessionEpoch(): number {
  return sessionEpoch;
}

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
  if (
    !secrets.managedRefreshToken ||
    !isDueForRefresh(secrets.managedAuthSessionExpiresAt, now)
  ) {
    // No refresh token: a legacy session, or a managed deployment without
    // refresh tokens, long-lived by construction — nothing to renew.
    return { ok: true, sessionToken, refreshed: false };
  }

  const outcome = await (inFlightRefresh ??
    startRefreshFlight(secretStore, { kind: "due", now }, managedClientFactory));
  switch (outcome.kind) {
    case "session":
      return { ok: true, sessionToken: outcome.sessionToken, refreshed: outcome.refreshed };
    case "unavailable":
      return { ok: true, sessionToken: outcome.sessionToken, refreshed: false };
    case "no_session":
      return { ok: false, errorCode: "no_session" };
    case "expired":
      return { ok: false, errorCode: "session_expired" };
  }
}

/**
 * renewRejectedManagedSession answers a 401 on `rejectedSessionToken`: it
 * yields a different token to retry with — one a concurrent refresh already
 * stored, or one this call obtains by spending the refresh token — whatever
 * the stored expiry says.
 *
 * A rejected access token alone never clears a refresh token. Credentials are
 * cleared only when the server refuses the refresh token itself, or when the
 * rejected session has no refresh token to fall back on (a legacy session the
 * 401 has already ended).
 */
export async function renewRejectedManagedSession(
  secretStore: SyncSecretStore,
  rejectedSessionToken: string,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<RenewRejectedManagedSessionResult> {
  for (;;) {
    const joined = inFlightRefresh;
    const outcome = await (joined ??
      startRefreshFlight(
        secretStore,
        { kind: "rejected", sessionToken: rejectedSessionToken },
        managedClientFactory,
      ));
    switch (outcome.kind) {
      case "session":
        if (outcome.sessionToken !== rejectedSessionToken) {
          return { ok: true, sessionToken: outcome.sessionToken };
        }
        if (!joined) {
          // The exchange handed back the rejected token itself: nothing new
          // to retry with, and looping would only spend another refresh.
          return { ok: false, errorCode: "refresh_unavailable" };
        }
        // A scheduled refresh that found nothing due; this 401 needs its own.
        continue;
      case "unavailable":
        if (joined && outcome.sessionToken !== rejectedSessionToken) {
          continue;
        }
        return { ok: false, errorCode: "refresh_unavailable" };
      case "no_session":
        return { ok: false, errorCode: "no_session" };
      case "expired":
        return { ok: false, errorCode: "session_expired" };
    }
  }
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

/**
 * keepManagedSessionOf carries the managed credentials of `current` (a record
 * read just before the write) onto `next`. A write that builds `next` from a
 * read taken before a network await would otherwise put back a refresh token
 * a renewal has since rotated away, and the server revokes the family on its
 * next use.
 */
export function keepManagedSessionOf(
  next: SyncSecretsRecord,
  current: SyncSecretsRecord,
): SyncSecretsRecord {
  return {
    ...next,
    managedAuthSessionToken: current.managedAuthSessionToken,
    managedAuthSessionExpiresAt: current.managedAuthSessionExpiresAt,
    managedRefreshToken: current.managedRefreshToken,
    managedRefreshTokenExpiresAt: current.managedRefreshTokenExpiresAt,
  };
}

/** Test seam: drops the shared in-flight refresh between cases. */
export function resetManagedSessionRefreshStateForTests(): void {
  inFlightRefresh = null;
}

// Must be called with the slot empty and with no await between that check and
// this call, so two flights can never exchange at once.
function startRefreshFlight(
  secretStore: SyncSecretStore,
  trigger: RefreshFlightTrigger,
  managedClientFactory: ManagedCloudAPIClientFactory,
): Promise<RefreshFlightOutcome> {
  // The slot cannot hold another flight while this one runs, so clearing it
  // unconditionally releases only this flight.
  inFlightRefresh = runRefreshFlight(secretStore, trigger, managedClientFactory).finally(
    () => {
      inFlightRefresh = null;
    },
  );
  return inFlightRefresh;
}

async function runRefreshFlight(
  secretStore: SyncSecretStore,
  trigger: RefreshFlightTrigger,
  managedClientFactory: ManagedCloudAPIClientFactory,
): Promise<RefreshFlightOutcome> {
  const epoch = sessionEpoch;
  const secrets = await secretStore.readSyncSecrets();
  const sessionToken = secrets?.managedAuthSessionToken;
  if (!secrets || !sessionToken) {
    return { kind: "no_session" };
  }

  if (trigger.kind === "rejected" && sessionToken !== trigger.sessionToken) {
    // Another refresh already replaced the rejected token.
    return { kind: "session", sessionToken, refreshed: false };
  }

  const refreshToken = secrets.managedRefreshToken;
  if (!refreshToken) {
    if (trigger.kind === "due") {
      return { kind: "session", sessionToken, refreshed: false };
    }
    if (epoch === sessionEpoch) {
      await secretStore.writeSyncSecrets(clearManagedSessionFromSecrets(secrets));
    }
    return { kind: "expired" };
  }

  if (
    trigger.kind === "due" &&
    !isDueForRefresh(secrets.managedAuthSessionExpiresAt, trigger.now)
  ) {
    return { kind: "session", sessionToken, refreshed: false };
  }

  return exchangeRefreshToken(
    secretStore,
    { refreshToken, currentSessionToken: sessionToken },
    epoch,
    managedClientFactory,
  );
}

async function exchangeRefreshToken(
  secretStore: SyncSecretStore,
  tokens: { refreshToken: string; currentSessionToken: string },
  epoch: number,
  managedClientFactory: ManagedCloudAPIClientFactory,
): Promise<RefreshFlightOutcome> {
  const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
  const result = await client.refreshSession(tokens.refreshToken);

  if (epoch !== sessionEpoch) {
    return { kind: "expired" };
  }

  if (result.ok) {
    // The record is re-read after the await: anything else that changed it in
    // the meantime (a recovery package, a sync session) must survive.
    const fresh = await readRecordStillOnSession(secretStore, tokens.currentSessionToken);
    if (!fresh) {
      return { kind: "expired" };
    }
    await secretStore.writeSyncSecrets(
      applyManagedAuthResultToSecrets(fresh, result.auth),
    );
    return { kind: "session", sessionToken: result.auth.sessionToken, refreshed: true };
  }

  if (result.errorCode === "unauthorized") {
    // The server has already revoked this token's whole family; keeping the
    // credentials would only produce repeated failures.
    const fresh = await readRecordStillOnSession(secretStore, tokens.currentSessionToken);
    if (fresh) {
      await secretStore.writeSyncSecrets(clearManagedSessionFromSecrets(fresh));
    }
    return { kind: "expired" };
  }

  // Network trouble, rate limiting, or a server error. The session may well
  // still be valid — hand back what we have and let the actual request decide.
  return { kind: "unavailable", sessionToken: tokens.currentSessionToken };
}

// The stored record, only while it still holds the managed session the refresh
// started from. A cleared or replaced session is not this refresh's to write.
async function readRecordStillOnSession(
  secretStore: SyncSecretStore,
  sessionToken: string,
): Promise<SyncSecretsRecord | null> {
  const fresh = await secretStore.readSyncSecrets();
  return fresh?.managedAuthSessionToken === sessionToken ? fresh : null;
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
