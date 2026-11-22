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
  // The server may already hold the new package (502, no answer, unreadable
  // answer, or a local write that failed after a 200). The old phrase stays
  // active here; a retry resends the same package with a fresh code.
  | "rotation_unconfirmed"
  | "generic";

type PendingRotation = {
  recoveryPhrase: string;
  recoveryKeyPackage: WrappedSyncKeyMetadata;
  masterKeyTag: string;
};

// Process memory only, never persisted: it outlives a cancelled card or a left
// screen so a retry after an unconfirmed answer resends the SAME package, and
// dies with the process. Cleared by a confirmed rotation, a definitive package
// refusal, and every session end or wipe.
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
  const pending = resolvePendingRotation(secrets.masterKeyHex);

  const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
  const code = stepUp.code?.trim();
  const input = {
    currentPassword: stepUp.currentPassword,
    ...(code ? { code } : {}),
    recoveryKeyPackage: pending.recoveryKeyPackage,
  };

  let result = await client.replaceRecoveryKey(session.sessionToken, input);
  if (!result.ok && result.errorCode === "sync_account_not_found") {
    const provisioned = await client.createSyncSession(session.sessionToken);
    if (!provisioned.ok) {
      return { ok: false, errorCode: mapRotationError(provisioned.errorCode) };
    }
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
      return { ok: false, errorCode: "rotation_unconfirmed" };
    }
    result = await client.replaceRecoveryKey(session.sessionToken, input);
  }
  if (!result.ok) {
    // The server refused this package's format, so it was not applied and a
    // resend could only be refused again.
    if (result.errorCode === "invalid_recovery_package") {
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
      return errorCode;
    case "sync_bridge_unavailable":
    case "network_failed":
    case "invalid_response":
      return "rotation_unconfirmed";
    default:
      return "generic";
  }
}
