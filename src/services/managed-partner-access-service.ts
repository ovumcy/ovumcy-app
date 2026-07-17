import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIErrorCode,
  type ManagedCloudGuestPartnerAcceptResult,
  type ManagedCloudPartnerAccessLevel,
  type ManagedCloudPartnerAccessOverview,
  type ManagedCloudPartnerAccessGrant,
  type ManagedCloudPartnerInvite,
  type ManagedCloudPartnerInviteIssueResult,
} from "../sync/managed-cloud-api-client";
import { MANAGED_CLOUD_AUTH_BASE_URL, type SyncMode } from "../sync/sync-contract";
import type { SyncSecretStore } from "../security/sync-secret-store";

export type ManagedPartnerAccessResult<T> =
  | { ok: true; value: T }
  | { ok: false; errorCode: ManagedCloudAPIErrorCode | "not_connected" };

export async function loadManagedPartnerAccess(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
): Promise<ManagedPartnerAccessResult<ManagedCloudPartnerAccessOverview>> {
  const sessionToken = await readManagedSessionToken(secretStore, syncMode);
  if (!sessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  const result = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).getPartnerAccess(sessionToken);

  return result.ok
    ? { ok: true, value: result.overview }
    : { ok: false, errorCode: result.errorCode };
}

export async function issueManagedPartnerInvite(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  input: {
    accessLevel: ManagedCloudPartnerAccessLevel;
  },
): Promise<ManagedPartnerAccessResult<ManagedCloudPartnerInviteIssueResult>> {
  const sessionToken = await readManagedSessionToken(secretStore, syncMode);
  if (!sessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  const result = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).issuePartnerInvite(sessionToken, input);

  return result.ok
    ? { ok: true, value: result.result }
    : { ok: false, errorCode: result.errorCode };
}

export async function acceptManagedPartnerInvite(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  inviteToken: string,
): Promise<
  ManagedPartnerAccessResult<{
    invite: ManagedCloudPartnerInvite;
    grant: ManagedCloudPartnerAccessGrant;
  }>
> {
  const sessionToken = await readManagedSessionToken(secretStore, syncMode);
  if (!sessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  const result = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).acceptPartnerInvite(sessionToken, inviteToken);

  return result.ok
    ? {
        ok: true,
        value: {
          invite: result.invite,
          grant: result.grant,
        },
      }
    : { ok: false, errorCode: result.errorCode };
}

/**
 * acceptManagedPartnerInviteAsGuest redeems a pending invite through the
 * unauthenticated guest endpoint — unlike every other function in this file,
 * it takes no `secretStore`/`syncMode` because there is no existing managed
 * session to read; the whole point is that a device with none can still
 * accept in one tap. The server atomically provisions a fresh guest account
 * and issues it a session, so the returned session token is the caller's cue
 * to persist it exactly like a normal managed login (see
 * `persistGuestPartnerSession` in `src/sync/sync-client-service.ts`).
 *
 * Error keys mirror `acceptManagedPartnerInvite` exactly
 * (`partner_invite_not_found`, `partner_invite_expired`,
 * `partner_access_unavailable`, `invalid_partner_invite`, `rate_limited`) —
 * there is no `not_connected` variant because this call has no session
 * precondition to fail.
 */
export async function acceptManagedPartnerInviteAsGuest(
  inviteToken: string,
): Promise<
  | { ok: true; value: ManagedCloudGuestPartnerAcceptResult }
  | { ok: false; errorCode: ManagedCloudAPIErrorCode }
> {
  const result = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).acceptPartnerInviteAsGuest(inviteToken);

  return result.ok
    ? { ok: true, value: result.result }
    : { ok: false, errorCode: result.errorCode };
}

export async function revokeManagedPartnerInvite(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  inviteID: string,
): Promise<ManagedPartnerAccessResult<ManagedCloudPartnerInvite>> {
  const sessionToken = await readManagedSessionToken(secretStore, syncMode);
  if (!sessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  const result = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).revokePartnerInvite(sessionToken, inviteID);

  return result.ok
    ? { ok: true, value: result.invite }
    : { ok: false, errorCode: result.errorCode };
}

export async function revokeManagedPartnerGrant(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  grantID: string,
): Promise<ManagedPartnerAccessResult<ManagedCloudPartnerAccessGrant>> {
  const sessionToken = await readManagedSessionToken(secretStore, syncMode);
  if (!sessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  const result = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).revokePartnerGrant(sessionToken, grantID);

  return result.ok
    ? { ok: true, value: result.grant }
    : { ok: false, errorCode: result.errorCode };
}

async function readManagedSessionToken(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
): Promise<string | null> {
  if (syncMode !== "managed") {
    return null;
  }

  const secrets = await secretStore.readSyncSecrets();
  return secrets?.managedAuthSessionToken?.trim() || null;
}
