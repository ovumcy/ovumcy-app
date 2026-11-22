import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIErrorCode,
} from "./managed-cloud-api-client";
import {
  ensureFreshManagedSession,
  renewRejectedManagedSession,
  type ManagedCloudAPIClientFactory,
} from "./managed-session-refresh-service";

type ManagedCallResult =
  | { ok: true }
  | { ok: false; errorCode: ManagedCloudAPIErrorCode };

export type ManagedSessionCallFailure =
  /** No managed session on this device. */
  | { ok: false; errorCode: "no_session" }
  /** The session is gone and its credentials have been cleared: sign in again. */
  | { ok: false; errorCode: "session_expired" };

export type ManagedSessionCallResult<R extends ManagedCallResult> =
  | R
  | ManagedSessionCallFailure;

/**
 * callWithManagedSession runs one authorized managed-cloud call with a fresh
 * session token, and on a 401 renews the session and retries exactly once.
 *
 * The wrapper owns the decision to end the session: it answers
 * `session_expired` only after the credentials were cleared (the refresh token
 * itself was refused, or a legacy session without one was rejected). An
 * `unauthorized` it passes through means the credentials were kept — the
 * refresh could not be completed, or the renewed token was refused too — so a
 * caller must not clear the session on it.
 */
export async function callWithManagedSession<R extends ManagedCallResult>(
  secretStore: SyncSecretStore,
  call: (sessionToken: string) => Promise<R>,
  options: {
    now?: Date;
    managedClientFactory?: ManagedCloudAPIClientFactory;
  } = {},
): Promise<ManagedSessionCallResult<R>> {
  const managedClientFactory =
    options.managedClientFactory ?? createManagedCloudAPIClient;
  const session = await ensureFreshManagedSession(
    secretStore,
    options.now ?? new Date(),
    managedClientFactory,
  );
  if (!session.ok) {
    return { ok: false, errorCode: session.errorCode };
  }

  const first = await call(session.sessionToken);
  if (!isUnauthorized(first)) {
    return first;
  }

  const renewed = await renewRejectedManagedSession(
    secretStore,
    session.sessionToken,
    managedClientFactory,
  );
  if (renewed.ok) {
    return call(renewed.sessionToken);
  }
  if (renewed.errorCode === "refresh_unavailable") {
    return first;
  }
  return { ok: false, errorCode: renewed.errorCode };
}

function isUnauthorized(result: ManagedCallResult): boolean {
  return !result.ok && result.errorCode === "unauthorized";
}
