import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
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
  type SyncPreferencesRecord,
} from "./sync-contract";
import {
  normalizeSyncEndpoint,
  type NormalizeSyncEndpointErrorCode,
} from "./sync-endpoint-policy";
import { isPasswordTooLong, isPasswordTooShort } from "./password-policy";
import { isTOTPCodeFormat } from "./sync-totp-service";

export type ChangeSyncPasswordErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "not_connected"
  | "current_password_required"
  | "new_password_required"
  | "password_too_short"
  | "password_too_long"
  | "invalid_current_password"
  | "new_password_must_differ"
  | "weak_new_password"
  | "totp_code_required"
  | "totp_invalid_code"
  | "totp_replayed"
  | "totp_not_configured"
  | "unauthorized"
  | "rate_limited"
  | "network_failed"
  | "generic";

export type RequestSyncPasswordResetErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "login_required"
  | "recovery_code_required"
  | "invalid_recovery_credentials"
  | "rate_limited"
  | "network_failed"
  | "generic";

export type ResetSyncPasswordErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "reset_token_required"
  | "new_password_required"
  | "password_too_short"
  | "password_too_long"
  | "invalid_reset_token"
  | "weak_new_password"
  | "rate_limited"
  | "network_failed"
  | "generic";

export type RegenerateSyncRecoveryCodeErrorCode =
  | NormalizeSyncEndpointErrorCode
  | "not_connected"
  | "current_password_required"
  | "invalid_current_password"
  | "totp_code_required"
  | "totp_invalid_code"
  | "totp_replayed"
  | "totp_not_configured"
  | "totp_secret_failed"
  | "unauthorized"
  | "rate_limited"
  | "network_failed"
  | "generic";

type SyncAPIClientFactory = (baseURL: string) => SyncAPIClient;
type ManagedCloudAPIClientFactory = (baseURL: string) => ManagedCloudAPIClient;

/**
 * Changes the account password on whichever backend the current sync setup
 * points at. The current session stays valid (backends preserve the caller's
 * session and revoke every other session of the account), so no local secret
 * rewrite is needed on success.
 *
 * A community server also rotates the recovery code and returns the new one
 * (`recoveryCode`, null from a server that predates the rotation); the old
 * code stops working, so the caller shows the new one once. `code` is the
 * current TOTP code that server requires once two-factor is on; it is sent
 * only when given and never to Ovumcy Cloud.
 */
export async function changeSyncAccountPassword(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: { currentPassword: string; newPassword: string; code?: string },
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | { ok: true; recoveryCode: string | null }
  | { ok: false; errorCode: ChangeSyncPasswordErrorCode }
> {
  if (input.currentPassword.length === 0) {
    return { ok: false, errorCode: "current_password_required" };
  }
  if (input.newPassword.length === 0) {
    return { ok: false, errorCode: "new_password_required" };
  }
  // Pre-validate against the shared server minimum so a short password is
  // caught before the network round-trip (the server would otherwise reject it
  // with weak_new_password). The empty check above takes precedence so a blank
  // field still reads "required", not "too short".
  if (isPasswordTooShort(input.newPassword)) {
    return { ok: false, errorCode: "password_too_short" };
  }
  if (isPasswordTooLong(input.newPassword)) {
    return { ok: false, errorCode: "password_too_long" };
  }
  const code = preferences.mode === "managed" ? undefined : input.code?.trim();
  if (code === "") {
    return { ok: false, errorCode: "totp_code_required" };
  }
  if (code !== undefined && !isTOTPCodeFormat(code)) {
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
    const credentials = {
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    };
    const result = await callWithManagedSession(
      secretStore,
      (sessionToken) => client.changePassword(sessionToken, credentials),
      { managedClientFactory },
    );
    if (!result.ok) {
      return {
        ok: false,
        errorCode: mapManagedChangePasswordError(result.errorCode),
      };
    }
    return { ok: true, recoveryCode: null };
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
  const result = await client.changePassword(
    secrets.authSessionToken,
    code === undefined
      ? { currentPassword: input.currentPassword, newPassword: input.newPassword }
      : {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          code,
        },
  );
  if (!result.ok) {
    return {
      ok: false,
      errorCode: mapCommunityChangePasswordError(result.errorCode),
    };
  }
  return { ok: true, recoveryCode: result.recoveryCode };
}

/**
 * Exchanges the account-level recovery code for a short-lived reset token.
 * Does NOT require a logged-in session — this is exactly the flow for owners
 * who lost their password. The caller carries the returned reset token to the
 * subsequent new-password screen.
 */
export async function requestSyncPasswordReset(
  preferences: SyncPreferencesRecord,
  input: { loginOrEmail: string; recoveryCode: string },
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | {
      ok: true;
      resetToken: string;
      resetTokenExpiresAt: string;
    }
  | { ok: false; errorCode: RequestSyncPasswordResetErrorCode }
> {
  const identifier = input.loginOrEmail.trim();
  if (identifier.length === 0) {
    return { ok: false, errorCode: "login_required" };
  }
  if (input.recoveryCode.trim().length === 0) {
    return { ok: false, errorCode: "recovery_code_required" };
  }

  if (preferences.mode === "managed") {
    const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const result = await client.forgotPassword({
      email: identifier,
      recoveryCode: input.recoveryCode,
    });
    if (!result.ok) {
      return {
        ok: false,
        errorCode: mapManagedForgotPasswordError(result.errorCode),
      };
    }
    return {
      ok: true,
      resetToken: result.result.resetToken,
      resetTokenExpiresAt: result.result.resetTokenExpiresAt,
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
  const result = await client.forgotPassword({
    login: identifier,
    recoveryCode: input.recoveryCode,
  });
  if (!result.ok) {
    return {
      ok: false,
      errorCode: mapCommunityForgotPasswordError(result.errorCode),
    };
  }
  return {
    ok: true,
    resetToken: result.result.resetToken,
    resetTokenExpiresAt: result.result.resetTokenExpiresAt,
  };
}

/**
 * Consumes a reset token to rotate password + recovery code. Backend revokes
 * every session of the account on success, so local session tokens become
 * invalid; we clear them and drop the setup status back to `local_ready` so
 * the next connect attempt forces a fresh login with the new password.
 */
export async function resetSyncAccountPassword(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: { resetToken: string; newPassword: string },
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | {
      ok: true;
      recoveryCode: string;
      preferences: SyncPreferencesRecord;
    }
  | { ok: false; errorCode: ResetSyncPasswordErrorCode }
> {
  if (input.resetToken.trim().length === 0) {
    return { ok: false, errorCode: "reset_token_required" };
  }
  if (input.newPassword.length === 0) {
    return { ok: false, errorCode: "new_password_required" };
  }
  // Same client-side floor as change-password: reject a short new password
  // before consuming the single-use reset token on a call the server would
  // reject with weak_new_password anyway.
  if (isPasswordTooShort(input.newPassword)) {
    return { ok: false, errorCode: "password_too_short" };
  }
  if (isPasswordTooLong(input.newPassword)) {
    return { ok: false, errorCode: "password_too_long" };
  }

  let recoveryCode: string;
  if (preferences.mode === "managed") {
    const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const result = await client.resetPassword(input);
    if (!result.ok) {
      return {
        ok: false,
        errorCode: mapManagedResetPasswordError(result.errorCode),
      };
    }
    recoveryCode = result.result.recoveryCode;
  } else {
    const normalizedEndpoint = normalizeSyncEndpoint(
      preferences.mode,
      preferences.endpointInput,
    );
    if (!normalizedEndpoint.ok) {
      return normalizedEndpoint;
    }
    const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
    const result = await client.resetPassword(input);
    if (!result.ok) {
      return {
        ok: false,
        errorCode: mapCommunityResetPasswordError(result.errorCode),
      };
    }
    recoveryCode = result.result.recoveryCode;
  }

  // Backend revoked all sessions for the account. Wipe local session tokens
  // so subsequent connect attempts go through a fresh login.
  const secrets = await secretStore.readSyncSecrets();
  if (secrets) {
    await secretStore.writeSyncSecrets({
      ...secrets,
      authSessionToken: null,
      managedAuthSessionToken: null,
    });
  }

  let nextPreferences = preferences;
  if (preferences.setupStatus === "connected") {
    nextPreferences = { ...preferences, setupStatus: "local_ready" };
    await storage.writeSyncPreferencesRecord(nextPreferences);
  }

  return { ok: true, recoveryCode, preferences: nextPreferences };
}

/**
 * Rotates the account-level recovery code. Requires an authenticated session
 * and the current password as a re-confirmation step (defense against a
 * hijacked session silently rotating the code and locking the legitimate
 * owner out of the recovery surface). Sessions are left untouched; a
 * community server also deletes pending reset tokens.
 *
 * `code` is the current TOTP code: both servers require it once the account
 * has two-factor on, because a recovery-code reset clears TOTP. It is sent
 * only when given — both servers reject a body field they do not know.
 */
export async function regenerateSyncAccountRecoveryCode(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  input: { currentPassword: string; code?: string },
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | { ok: true; recoveryCode: string }
  | { ok: false; errorCode: RegenerateSyncRecoveryCodeErrorCode }
> {
  if (input.currentPassword.length === 0) {
    return { ok: false, errorCode: "current_password_required" };
  }

  const code = input.code?.trim();
  if (code === "") {
    return { ok: false, errorCode: "totp_code_required" };
  }
  if (code !== undefined && !isTOTPCodeFormat(code)) {
    return { ok: false, errorCode: "totp_invalid_code" };
  }
  const body =
    code === undefined
      ? { currentPassword: input.currentPassword }
      : { currentPassword: input.currentPassword, code };

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
      (sessionToken) => client.regenerateRecoveryCode(sessionToken, body),
      { managedClientFactory },
    );
    if (!result.ok) {
      return {
        ok: false,
        errorCode: mapManagedRegenerateError(result.errorCode),
      };
    }
    return { ok: true, recoveryCode: result.result.recoveryCode };
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
  const result = await client.regenerateRecoveryCode(
    secrets.authSessionToken,
    body,
  );
  if (!result.ok) {
    return {
      ok: false,
      errorCode: mapCommunityRegenerateError(result.errorCode),
    };
  }
  return { ok: true, recoveryCode: result.result.recoveryCode };
}

// "unauthorized" means the session ended and its credentials were cleared
// (`session_expired`); a 401 callWithManagedSession passes through kept them,
// so it reads as "generic": callers end the local session on "unauthorized".
type ManagedSessionCallErrorCode =
  | ManagedCloudAPIErrorCode
  | ManagedSessionCallFailure["errorCode"];

function mapManagedChangePasswordError(
  code: ManagedSessionCallErrorCode,
): ChangeSyncPasswordErrorCode {
  switch (code) {
    case "no_session":
      return "not_connected";
    case "session_expired":
      return "unauthorized";
    case "invalid_current_password":
    case "new_password_must_differ":
    case "weak_new_password":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapCommunityChangePasswordError(
  code: SyncAPIErrorCode,
): ChangeSyncPasswordErrorCode {
  switch (code) {
    case "invalid_current_password":
    case "new_password_must_differ":
    case "weak_new_password":
    case "totp_invalid_code":
    case "totp_replayed":
    case "totp_not_configured":
    case "unauthorized":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapManagedForgotPasswordError(
  code: ManagedCloudAPIErrorCode,
): RequestSyncPasswordResetErrorCode {
  switch (code) {
    case "invalid_recovery_credentials":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapCommunityForgotPasswordError(
  code: SyncAPIErrorCode,
): RequestSyncPasswordResetErrorCode {
  switch (code) {
    case "invalid_recovery_credentials":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapManagedResetPasswordError(
  code: ManagedCloudAPIErrorCode,
): ResetSyncPasswordErrorCode {
  switch (code) {
    case "invalid_reset_token":
    case "weak_new_password":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapCommunityResetPasswordError(
  code: SyncAPIErrorCode,
): ResetSyncPasswordErrorCode {
  switch (code) {
    case "invalid_reset_token":
    case "weak_new_password":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapManagedRegenerateError(
  code: ManagedSessionCallErrorCode,
): RegenerateSyncRecoveryCodeErrorCode {
  switch (code) {
    case "no_session":
      return "not_connected";
    case "session_expired":
      return "unauthorized";
    case "invalid_current_password":
    case "totp_invalid_code":
    case "totp_replayed":
    case "totp_not_configured":
    case "totp_secret_failed":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}

function mapCommunityRegenerateError(
  code: SyncAPIErrorCode,
): RegenerateSyncRecoveryCodeErrorCode {
  switch (code) {
    case "invalid_current_password":
    case "totp_invalid_code":
    case "totp_replayed":
    case "totp_not_configured":
    case "totp_secret_failed":
    case "unauthorized":
    case "rate_limited":
    case "network_failed":
      return code;
    default:
      return "generic";
  }
}
