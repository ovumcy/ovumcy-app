import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIClient,
  type ManagedCloudAPIErrorCode,
} from "./managed-cloud-api-client";
import {
  callWithManagedSession,
  type ManagedSessionCallFailure,
} from "./managed-session-call";
import {
  createSyncAPIClient,
  type SyncAPIClient,
  type SyncAPIErrorCode,
} from "./sync-api-client";
import {
  MANAGED_CLOUD_AUTH_BASE_URL,
  type SyncAuthResult,
  type SyncPreferencesRecord,
  type SyncTOTPEnrollmentStart,
} from "./sync-contract";
import {
  normalizeSyncEndpoint,
  type NormalizeSyncEndpointErrorCode,
} from "./sync-endpoint-policy";

export function isTOTPCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

// All TOTP service entry points collapse the wider API client error vocabulary
// into a small, UI-friendly set of error codes that drive the enrollment,
// disable, and challenge flows. Anything outside the known set becomes
// `generic` so unknown server responses do not crash the screen but also do
// not leak provider-specific implementation details into copy.

export type StartTOTPEnrollmentErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "not_connected"
  | "current_password_required"
  | "invalid_current_password"
  | "totp_not_configured"
  | "totp_already_enabled"
  | "totp_secret_failed"
  | "unauthorized"
  | "rate_limited"
  | "network_failed"
  | "generic";

export type VerifyTOTPEnrollmentErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "not_connected"
  | "totp_not_configured"
  | "totp_already_enabled"
  | "totp_invalid_code"
  | "totp_replayed"
  | "totp_secret_failed"
  | "totp_enrollment_not_started"
  | "unauthorized"
  | "rate_limited"
  | "network_failed"
  | "generic";

export type DisableTOTPErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "not_connected"
  | "current_password_required"
  | "invalid_current_password"
  | "totp_not_configured"
  | "totp_already_disabled"
  | "totp_invalid_code"
  | "totp_replayed"
  | "totp_secret_failed"
  | "unauthorized"
  | "rate_limited"
  | "network_failed"
  | "generic";

export type CompleteTOTPChallengeErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "challenge_id_required"
  | "totp_not_configured"
  | "totp_invalid_code"
  | "totp_replayed"
  | "totp_challenge_invalid"
  | "totp_secret_failed"
  | "rate_limited"
  | "network_failed"
  | "generic";

type SyncAPIClientFactory = (baseURL: string) => SyncAPIClient;
type ManagedCloudAPIClientFactory = (baseURL: string) => ManagedCloudAPIClient;

/**
 * StartTOTPEnrollment asks the backend to generate a fresh TOTP secret bound
 * to the current account and returns the QR/manual-entry payload. The current
 * password is re-verified to keep a hijacked session from silently flipping
 * the second-factor state. On success the account row holds the encrypted
 * secret but `totp_enabled` stays `false` until the matching verify call
 * confirms the user has stored the secret in their authenticator app.
 */
export async function startTOTPEnrollment(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: { currentPassword: string },
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | { ok: true; enrollment: SyncTOTPEnrollmentStart }
  | { ok: false; errorCode: StartTOTPEnrollmentErrorCode }
> {
  if (input.currentPassword.length === 0) {
    return { ok: false, errorCode: "current_password_required" };
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets) {
    return { ok: false, errorCode: "not_connected" };
  }

  if (preferences.mode === "managed") {
    if (!secrets.managedAuthSessionToken) {
      return { ok: false, errorCode: "not_connected" };
    }
    const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const result = await callWithManagedSession(
      secretStore,
      (sessionToken) => client.startTOTPEnrollment(sessionToken, input),
      { managedClientFactory },
    );
    if (!result.ok) {
      return {
        ok: false,
        errorCode: mapManagedStartEnrollmentError(result.errorCode),
      };
    }
    return { ok: true, enrollment: result.enrollment };
  }

  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return normalizedEndpoint;
  }
  if (!secrets.authSessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }
  const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
  const result = await client.startTOTPEnrollment(secrets.authSessionToken, input);
  if (!result.ok) {
    return {
      ok: false,
      errorCode: mapCommunityStartEnrollmentError(result.errorCode),
    };
  }
  return { ok: true, enrollment: result.enrollment };
}

/**
 * VerifyTOTPEnrollment completes an in-progress enrollment by submitting a
 * code from the authenticator app. On success the backend marks the secret as
 * active, revokes every other session of the account (the caller's session is
 * preserved), and from this point on `login` returns a TOTP challenge instead
 * of a session.
 *
 * Both backends also rotate the account recovery code on success and return
 * the new one; it is the only working recovery code from then on, so the
 * caller must show it once. `recoveryCode` is null when the backend issued
 * none (a community server that predates rotation). A 429 is the
 * rolling attempt budget and keeps the pending secret: it surfaces as
 * `rate_limited`. A 409 `totp_enrollment_discarded` (the secret's own attempt
 * or lifetime cap) or `totp_enrollment_not_started` (community or managed)
 * means no secret is pending (expired, or replaced by a newer setup) — a
 * restart, not a server fault.
 */
export async function verifyTOTPEnrollment(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: { code: string },
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | { ok: true; recoveryCode: string | null }
  | { ok: false; errorCode: VerifyTOTPEnrollmentErrorCode }
> {
  if (!isTOTPCodeFormat(input.code)) {
    return { ok: false, errorCode: "totp_invalid_code" };
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets) {
    return { ok: false, errorCode: "not_connected" };
  }

  if (preferences.mode === "managed") {
    if (!secrets.managedAuthSessionToken) {
      return { ok: false, errorCode: "not_connected" };
    }
    const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const result = await callWithManagedSession(
      secretStore,
      (sessionToken) => client.verifyTOTPEnrollment(sessionToken, input),
      { managedClientFactory },
    );
    if (!result.ok) {
      return {
        ok: false,
        errorCode: mapManagedVerifyEnrollmentError(result.errorCode),
      };
    }
    return { ok: true, recoveryCode: result.recoveryCode };
  }

  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return normalizedEndpoint;
  }
  if (!secrets.authSessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }
  const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
  const result = await client.verifyTOTPEnrollment(secrets.authSessionToken, input);
  if (!result.ok) {
    return {
      ok: false,
      errorCode: mapCommunityVerifyEnrollmentError(result.errorCode),
    };
  }
  return { ok: true, recoveryCode: result.recoveryCode };
}

/**
 * DisableTOTP turns off the second factor. Requires both the current password
 * AND a current TOTP code so a temporarily-borrowed authenticator cannot
 * remove 2FA on its own. On success: every session of the account is revoked
 * (the user must log in fresh) and any pending TOTP challenges are deleted.
 * A 409 `totp_not_enabled` (community or managed) surfaces as `totp_already_disabled`: the
 * account state moved under this screen, so the caller refreshes it.
 */
export async function disableTOTP(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: { currentPassword: string; code: string },
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<{ ok: true } | { ok: false; errorCode: DisableTOTPErrorCode }> {
  if (input.currentPassword.length === 0) {
    return { ok: false, errorCode: "current_password_required" };
  }
  if (!isTOTPCodeFormat(input.code)) {
    return { ok: false, errorCode: "totp_invalid_code" };
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets) {
    return { ok: false, errorCode: "not_connected" };
  }

  if (preferences.mode === "managed") {
    if (!secrets.managedAuthSessionToken) {
      return { ok: false, errorCode: "not_connected" };
    }
    const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const result = await callWithManagedSession(
      secretStore,
      (sessionToken) => client.disableTOTP(sessionToken, input),
      { managedClientFactory },
    );
    if (!result.ok) {
      return {
        ok: false,
        errorCode: mapManagedDisableError(result.errorCode),
      };
    }
    return { ok: true };
  }

  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return normalizedEndpoint;
  }
  if (!secrets.authSessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }
  const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
  const result = await client.disableTOTP(secrets.authSessionToken, input);
  if (!result.ok) {
    return {
      ok: false,
      errorCode: mapCommunityDisableError(result.errorCode),
    };
  }
  return { ok: true };
}

/**
 * CompleteTOTPChallenge completes the pending login second factor and returns
 * a real `SyncAuthResult` with a fresh session token. The challenge id is
 * always single-use; reusing it returns `totp_challenge_invalid` from the
 * backend. The caller should never persist the challenge id — it lives only
 * in memory between the failed-because-2FA login response and this call.
 */
export async function completeTOTPChallenge(
  preferences: SyncPreferencesRecord,
  input: { challengeID: string; code: string },
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | { ok: true; auth: SyncAuthResult }
  | { ok: false; errorCode: CompleteTOTPChallengeErrorCode }
> {
  if (input.challengeID.length === 0) {
    return { ok: false, errorCode: "challenge_id_required" };
  }
  if (!isTOTPCodeFormat(input.code)) {
    return { ok: false, errorCode: "totp_invalid_code" };
  }

  if (preferences.mode === "managed") {
    const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const result = await client.completeTOTPChallenge(input);
    if (!result.ok) {
      return {
        ok: false,
        errorCode: mapManagedCompleteChallengeError(result.errorCode),
      };
    }
    // ManagedCloudAuthResult is a structural superset of SyncAuthResult; we
    // only need the session-token-ish fields here. The caller (login flow)
    // is the one that picks up the login / entitlement.
    return {
      ok: true,
      auth: {
        accountID: result.auth.accountID,
        sessionToken: result.auth.sessionToken,
        sessionExpiresAt: result.auth.sessionExpiresAt,
        // Carried through so the finalize step can persist the renewal
        // credential; dropping it here would leave the post-2FA session
        // short-lived with no way to renew.
        ...(result.auth.refreshToken
          ? {
              refreshToken: result.auth.refreshToken,
              refreshTokenExpiresAt: result.auth.refreshTokenExpiresAt,
            }
          : {}),
      },
    };
  }

  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return normalizedEndpoint;
  }
  const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
  const result = await client.completeTOTPChallenge(input);
  if (!result.ok) {
    return {
      ok: false,
      errorCode: mapCommunityCompleteChallengeError(result.errorCode),
    };
  }
  return { ok: true, auth: result.auth };
}

// "unauthorized" means the session ended and its credentials were cleared
// (`session_expired`); a 401 callWithManagedSession passes through kept them,
// so it reads as "generic": callers end the local session on "unauthorized".
type ManagedSessionCallErrorCode =
  | ManagedCloudAPIErrorCode
  | ManagedSessionCallFailure["errorCode"];

function mapManagedStartEnrollmentError(
  code: ManagedSessionCallErrorCode,
): StartTOTPEnrollmentErrorCode {
  switch (code) {
    case "no_session":
      return "not_connected";
    case "session_expired":
      return "unauthorized";
    case "invalid_current_password":
    case "totp_not_configured":
    case "totp_already_enabled":
    case "totp_secret_failed":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapCommunityStartEnrollmentError(
  code: SyncAPIErrorCode,
): StartTOTPEnrollmentErrorCode {
  switch (code) {
    case "invalid_current_password":
    case "totp_not_configured":
    case "totp_already_enabled":
    case "totp_secret_failed":
    case "unauthorized":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapManagedVerifyEnrollmentError(
  code: ManagedSessionCallErrorCode,
): VerifyTOTPEnrollmentErrorCode {
  switch (code) {
    case "no_session":
      return "not_connected";
    case "session_expired":
      return "unauthorized";
    case "totp_enrollment_discarded":
      return "totp_enrollment_not_started";
    case "totp_enrollment_not_started":
    case "totp_not_configured":
    case "totp_already_enabled":
    case "totp_invalid_code":
    case "totp_replayed":
    case "totp_secret_failed":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapCommunityVerifyEnrollmentError(
  code: SyncAPIErrorCode,
): VerifyTOTPEnrollmentErrorCode {
  switch (code) {
    case "totp_enrollment_discarded":
      return "totp_enrollment_not_started";
    case "totp_enrollment_not_started":
    case "totp_not_configured":
    case "totp_already_enabled":
    case "totp_invalid_code":
    case "totp_replayed":
    case "totp_secret_failed":
    case "unauthorized":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapManagedDisableError(
  code: ManagedSessionCallErrorCode,
): DisableTOTPErrorCode {
  switch (code) {
    case "no_session":
      return "not_connected";
    case "session_expired":
      return "unauthorized";
    case "totp_not_enabled":
      return "totp_already_disabled";
    case "invalid_current_password":
    case "totp_not_configured":
    case "totp_invalid_code":
    case "totp_replayed":
    case "totp_secret_failed":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapCommunityDisableError(
  code: SyncAPIErrorCode,
): DisableTOTPErrorCode {
  switch (code) {
    case "totp_not_enabled":
      return "totp_already_disabled";
    case "invalid_current_password":
    case "totp_not_configured":
    case "totp_invalid_code":
    case "totp_replayed":
    case "totp_secret_failed":
    case "unauthorized":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapManagedCompleteChallengeError(
  code: ManagedCloudAPIErrorCode,
): CompleteTOTPChallengeErrorCode {
  switch (code) {
    case "totp_not_configured":
    case "totp_invalid_code":
    case "totp_replayed":
    case "totp_challenge_invalid":
    case "totp_secret_failed":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapCommunityCompleteChallengeError(
  code: SyncAPIErrorCode,
): CompleteTOTPChallengeErrorCode {
  switch (code) {
    case "totp_not_configured":
    case "totp_invalid_code":
    case "totp_replayed":
    case "totp_challenge_invalid":
    case "totp_secret_failed":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}
