import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

import {
  createRecoveryPhrase,
  wrapMasterKeyWithRecoveryPhrase,
} from "../security/sync-crypto";
import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIClient,
  type ManagedCloudAPIErrorCode,
} from "./managed-cloud-api-client";
import { ensureFreshManagedSession } from "./managed-session-refresh-service";
import type { SyncRecoveryKeyStepUp } from "./sync-api-client";
import {
  MANAGED_CLOUD_AUTH_BASE_URL,
  type WrappedSyncKeyMetadata,
} from "./sync-contract";

type ManagedCloudAPIClientFactory = (baseURL: string) => ManagedCloudAPIClient;

export type ManagedRecoveryRotationErrorCode =
  | "not_connected"
  | "unauthorized"
  | "invalid_current_password"
  | "totp_invalid_code"
  | "totp_replayed"
  | "rate_limited"
  | "totp_not_configured"
  // 503: Ovumcy Cloud has no sync bridge, so nothing was replaced.
  | "sync_not_configured"
  // The code was spent on a refusal that replaced nothing (a 404 that
  // provisioned the sync account); a resend needs a new code.
  | "totp_fresh_code_required"
  // The server may already hold the new package (502, no answer, unreadable
  // answer, or a local write that failed after a 200). The old phrase stays
  // active here; a retry resends the same package with a fresh code.
  | "rotation_unconfirmed"
  // 409: the stored package is no longer the one this device holds (another
  // device rotated, or an earlier rotation here landed but its confirmation
  // was lost with the process). Nothing was replaced and the shown
  // candidate is dropped; this device still holds the old package.
  | "recovery_key_conflict"
  | "generic";

type PendingRotation = {
  recoveryPhrase: string;
  recoveryKeyPackage: WrappedSyncKeyMetadata;
  masterKeyTag: string;
  // Set once a 404 made this device provision the sync account: that account
  // holds no package yet, and an expectation would be refused as a conflict.
  serverHoldsNoPackage?: true;
};

// Process memory only, never persisted: it outlives a cancelled card or a left
// screen so a retry after an unconfirmed answer resends the SAME package, and
// dies with the process. Cleared by a confirmed rotation, a definitive package
// refusal, and every session end or wipe. The user sees its phrase before any
// request, so a request only ever carries a candidate that was shown.
let pendingRotation: PendingRotation | null = null;

// A confirmed phrase the user has not acknowledged yet; the old phrase is
// already dead, so an unmount or reload before the acknowledgement must not
// lose it, and nothing may show it again after.
let unacknowledgedPhrase: string | null = null;

const MASTER_KEY_TAG_INFO = "ovumcy-managed-rotation-tag|";

export function clearPendingManagedRecoveryRotation(): void {
  pendingRotation = null;
  unacknowledgedPhrase = null;
}

export function peekUnacknowledgedManagedRecoveryPhrase(): string | null {
  return unacknowledgedPhrase;
}

export function acknowledgeManagedRecoveryPhrase(): void {
  unacknowledgedPhrase = null;
}

/**
 * The phrase the next rotation request will carry, for the user to write down
 * before the request: inactive until Ovumcy Cloud confirms it. The same
 * candidate comes back until a confirmed rotation, a definitive package
 * refusal, a session end, a wipe or a different master key drops it. Null when
 * this device holds no master key.
 */
export async function prepareManagedRecoveryRotationCandidate(
  secretStore: SyncSecretStore,
): Promise<string | null> {
  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.masterKeyHex) {
    return null;
  }
  return resolvePendingRotation(secrets.masterKeyHex).recoveryPhrase;
}

/**
 * Rotates the managed account's recovery phrase: a new phrase wraps the SAME
 * master key, Ovumcy Cloud re-confirms the password (+ TOTP code) and stores
 * the package, and only after its 200 does this device adopt the new package
 * and hand the phrase back for the one-time reveal. The password, code and
 * phrase never reach a log, an error or storage other than the wrapped package.
 */
export async function rotateManagedRecoveryPhrase(
  secretStore: SyncSecretStore,
  stepUp: SyncRecoveryKeyStepUp,
  now: Date = new Date(),
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | { ok: true; recoveryPhrase: string }
  | { ok: false; errorCode: ManagedRecoveryRotationErrorCode }
> {
  const session = await ensureFreshManagedSession(secretStore, now, managedClientFactory);
  if (!session.ok) {
    return {
      ok: false,
      errorCode: session.errorCode === "session_expired" ? "unauthorized" : "not_connected",
    };
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.masterKeyHex) {
    return { ok: false, errorCode: "not_connected" };
  }
  // Never a candidate made here: the user has not seen it.
  const pending = pendingRotation;
  if (!pending || pending.masterKeyTag !== masterKeyTag(secrets.masterKeyHex)) {
    return { ok: false, errorCode: "generic" };
  }

  const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
  const code = stepUp.code?.trim();
  // The package this device holds is the one it last fetched or adopted; the
  // server replaces only that one, so a rotation made elsewhere since is
  // refused instead of silently overwritten.
  const buildInput = () => ({
    currentPassword: stepUp.currentPassword,
    ...(code ? { code } : {}),
    recoveryKeyPackage: pending.recoveryKeyPackage,
    ...(pending.serverHoldsNoPackage
      ? {}
      : { expectedPhraseFingerprintHex: secrets.wrappedKey.phraseFingerprintHex }),
  });

  let result = await client.replaceRecoveryKey(session.sessionToken, buildInput());
  if (!result.ok && result.errorCode === "sync_account_not_found") {
    const provisioned = await client.createSyncSession(session.sessionToken);
    if (!provisioned.ok) {
      return { ok: false, errorCode: mapRotationError(provisioned.errorCode) };
    }
    pending.serverHoldsNoPackage = true;
    const current = await secretStore.readSyncSecrets();
    if (current) {
      await secretStore.writeSyncSecrets({
        ...current,
        authSessionToken: provisioned.auth.sessionToken,
      });
    }
    // The server checked the code before it looked for the sync account, so
    // a code is spent; only a password-only step-up can be resent as is.
    if (code) {
      return { ok: false, errorCode: "totp_fresh_code_required" };
    }
    result = await client.replaceRecoveryKey(session.sessionToken, buildInput());
  }
  if (!result.ok) {
    // The server refused this package's format, so it was not applied and a
    // resend could only be refused again. A conflict means the account's
    // phrase changed elsewhere: replacing it from here would void the phrase
    // the user wrote down there, so the candidate is dropped, not resent.
    if (
      result.errorCode === "invalid_recovery_package" ||
      result.errorCode === "recovery_key_conflict"
    ) {
      pendingRotation = null;
    }
    return { ok: false, errorCode: mapRotationError(result.errorCode) };
  }

  try {
    const latest = await secretStore.readSyncSecrets();
    if (!latest || masterKeyTag(latest.masterKeyHex) !== pending.masterKeyTag) {
      return { ok: false, errorCode: "generic" };
    }
    await secretStore.writeSyncSecrets({
      ...latest,
      wrappedKey: pending.recoveryKeyPackage,
    });
  } catch {
    return { ok: false, errorCode: "rotation_unconfirmed" };
  }

  pendingRotation = null;
  unacknowledgedPhrase = pending.recoveryPhrase;
  return { ok: true, recoveryPhrase: pending.recoveryPhrase };
}

function resolvePendingRotation(masterKeyHex: string): PendingRotation {
  const tag = masterKeyTag(masterKeyHex);
  if (pendingRotation && pendingRotation.masterKeyTag === tag) {
    return pendingRotation;
  }
  const recoveryPhrase = createRecoveryPhrase();
  pendingRotation = {
    recoveryPhrase,
    recoveryKeyPackage: wrapMasterKeyWithRecoveryPhrase(recoveryPhrase, masterKeyHex),
    masterKeyTag: tag,
  };
  return pendingRotation;
}

// Binds a pending package to the key it wraps without holding the key itself.
function masterKeyTag(masterKeyHex: string): string {
  return bytesToHex(sha256(utf8ToBytes(`${MASTER_KEY_TAG_INFO}${masterKeyHex}`)));
}

function mapRotationError(
  errorCode: ManagedCloudAPIErrorCode,
): ManagedRecoveryRotationErrorCode {
  switch (errorCode) {
    case "invalid_current_password":
    case "totp_invalid_code":
    case "totp_replayed":
    case "rate_limited":
    case "totp_not_configured":
    case "unauthorized":
    case "sync_not_configured":
    case "recovery_key_conflict":
      return errorCode;
    case "sync_bridge_unavailable":
    case "network_failed":
    case "invalid_response":
      return "rotation_unconfirmed";
    default:
      return "generic";
  }
}
