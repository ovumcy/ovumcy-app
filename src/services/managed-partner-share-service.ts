import type {
  PartnerShareSecretStore,
  PartnerShareSecretsRecord,
} from "../security/partner-share-secret-store";
import {
  derivePartnerShareKeyHex,
  decryptPartnerSharedProjection,
  encryptPartnerSharedProjection,
} from "../security/partner-share-crypto";
import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIErrorCode,
  type ManagedCloudPartnerAccessOverview,
  type ManagedCloudPartnerAccessGrant,
  type ManagedCloudPartnerInviteIssueResult,
  type ManagedCloudPartnerProjection,
} from "../sync/managed-cloud-api-client";
import { MANAGED_CLOUD_AUTH_BASE_URL, type SyncMode } from "../sync/sync-contract";
import type { PartnerSharedProjectionPayload } from "../models/partner-share";

export type ManagedPartnerShareResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      errorCode:
        | ManagedCloudAPIErrorCode
        | "not_connected"
        | "share_key_unavailable"
        | "invalid_partner_projection";
    };

export async function storeIssuedManagedPartnerInviteKey(
  partnerShareSecretStore: PartnerShareSecretStore,
  result: ManagedCloudPartnerInviteIssueResult,
): Promise<void> {
  const inviteToken = parseInviteTokenFromURL(result.inviteURL);
  const nextState = await partnerShareSecretStore.readPartnerShareSecrets();
  nextState.pendingInviteKeysByInviteID[result.invite.id] =
    derivePartnerShareKeyHex(inviteToken);
  await partnerShareSecretStore.writePartnerShareSecrets(nextState);
}

export async function storeAcceptedManagedPartnerGrantKey(
  partnerShareSecretStore: PartnerShareSecretStore,
  grantID: string,
  inviteToken: string,
): Promise<void> {
  const nextState = await partnerShareSecretStore.readPartnerShareSecrets();
  nextState.grantKeysByGrantID[grantID] = derivePartnerShareKeyHex(inviteToken);
  await partnerShareSecretStore.writePartnerShareSecrets(nextState);
}

export async function reconcileManagedPartnerShareKeys(
  partnerShareSecretStore: PartnerShareSecretStore,
  overview: ManagedCloudPartnerAccessOverview,
): Promise<PartnerShareSecretsRecord> {
  const nextState = await partnerShareSecretStore.readPartnerShareSecrets();
  let didChange = false;
  for (const grant of overview.owned.grants) {
    const inviteID = grant.sourceInviteID?.trim() || "";
    if (!inviteID) {
      continue;
    }
    const pendingKey = nextState.pendingInviteKeysByInviteID[inviteID];
    if (!pendingKey || nextState.grantKeysByGrantID[grant.id]) {
      continue;
    }
    nextState.grantKeysByGrantID[grant.id] = pendingKey;
    delete nextState.pendingInviteKeysByInviteID[inviteID];
    didChange = true;
  }

  const activePendingInviteIDs = new Set(
    overview.owned.invites
      .filter(
        (invite) =>
          invite.acceptedAt === null &&
          invite.revokedAt === null &&
          invite.status === "pending",
      )
      .map((invite) => invite.id),
  );
  for (const inviteID of Object.keys(nextState.pendingInviteKeysByInviteID)) {
    if (activePendingInviteIDs.has(inviteID)) {
      continue;
    }

    delete nextState.pendingInviteKeysByInviteID[inviteID];
    didChange = true;
  }

  if (didChange) {
    await partnerShareSecretStore.writePartnerShareSecrets(nextState);
  }
  return nextState;
}

export async function uploadManagedPartnerProjection(
  syncSecretStore: SyncSecretStore,
  syncMode: SyncMode,
  input: {
    projection: PartnerSharedProjectionPayload;
    partnerShareSecretStore: PartnerShareSecretStore;
  },
): Promise<ManagedPartnerShareResult<ManagedCloudPartnerProjection>> {
  const sessionToken = await readManagedSessionToken(syncSecretStore, syncMode);
  if (!sessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  const shareKey = await readGrantShareKey(
    input.partnerShareSecretStore,
    input.projection.grantID,
  );
  if (!shareKey) {
    return { ok: false, errorCode: "share_key_unavailable" };
  }

  const encryptedProjection = encryptPartnerSharedProjection(
    shareKey,
    input.projection,
  );
  const result = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).upsertPartnerProjection(sessionToken, input.projection.grantID, {
    schemaVersion: encryptedProjection.schemaVersion,
    checksumSHA256: encryptedProjection.checksumSHA256,
    ciphertextBase64: encryptedProjection.ciphertextBase64,
    ciphertextSize: encryptedProjection.ciphertextSize,
  });

  return result.ok
    ? { ok: true, value: result.projection }
    : { ok: false, errorCode: result.errorCode };
}

export async function loadManagedPartnerProjection(
  syncSecretStore: SyncSecretStore,
  partnerShareSecretStore: PartnerShareSecretStore,
  syncMode: SyncMode,
  grant: Pick<ManagedCloudPartnerAccessGrant, "id">,
): Promise<ManagedPartnerShareResult<PartnerSharedProjectionPayload>> {
  const sessionToken = await readManagedSessionToken(syncSecretStore, syncMode);
  if (!sessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  const shareKey = await readGrantShareKey(partnerShareSecretStore, grant.id);
  if (!shareKey) {
    return { ok: false, errorCode: "share_key_unavailable" };
  }

  const result = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).getPartnerProjection(sessionToken, grant.id);
  if (!result.ok) {
    return { ok: false, errorCode: result.errorCode };
  }

  try {
    return {
      ok: true,
      value: decryptPartnerSharedProjection(shareKey, result.projection),
    };
  } catch {
    return { ok: false, errorCode: "invalid_partner_projection" };
  }
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

async function readGrantShareKey(
  partnerShareSecretStore: PartnerShareSecretStore,
  grantID: string,
): Promise<string | null> {
  const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
  return secrets.grantKeysByGrantID[grantID]?.trim() || null;
}

function parseInviteTokenFromURL(inviteURL: string): string {
  const parsed = new URL(inviteURL);
  const inviteToken = parsed.searchParams.get("invite_token")?.trim() || "";
  if (inviteToken.length === 0) {
    throw new Error("invalid_partner_invite");
  }
  return inviteToken;
}
