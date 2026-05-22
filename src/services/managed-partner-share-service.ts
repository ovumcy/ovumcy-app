import type {
  PartnerShareGrantKeyRecord,
  PartnerShareSecretStore,
  PartnerShareSecretsRecord,
} from "../security/partner-share-secret-store";
import {
  decryptPartnerSharedProjection,
  deriveGrantSubkeyHex,
  derivePartnerShareKeyHex,
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

/**
 * Subset of `ManagedCloudPartnerAccessGrant` required to derive K_grant. The
 * three fields are server-emitted and immutable per grant; documented in
 * `docs/sync-trust-model.md` (Partner-Share Key Rotation) so the managed
 * cloud team treats them as key-binding context.
 */
export type ManagedPartnerGrantKeyContext = Pick<
  ManagedCloudPartnerAccessGrant,
  "id" | "ownerAccountID" | "sourceInviteID"
>;

export async function storeIssuedManagedPartnerInviteKey(
  partnerShareSecretStore: PartnerShareSecretStore,
  result: ManagedCloudPartnerInviteIssueResult,
): Promise<void> {
  const inviteToken = parseInviteTokenFromURL(result.inviteURL);
  const inviteKeyHex = derivePartnerShareKeyHex(inviteToken);
  await partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
    record.pendingInviteKeysByInviteID[result.invite.id] = inviteKeyHex;
  });
}

/**
 * Partner-side handler for the accept flow. Derives K_invite from the raw
 * invite token, then immediately rotates to K_grant via `deriveGrantSubkeyHex`
 * — K_invite is never persisted on the partner device. A transient observer
 * of the invite token therefore cannot decrypt any partner-share blob the
 * owner uploads after accept.
 *
 * Throws `invalid_partner_grant_context` if the server returned a grant
 * without `sourceInviteID`, which would happen only with a broken managed
 * cloud — silently falling back to K_invite would defeat the whole point of
 * rotation, so we refuse rather than store a degraded key.
 */
export async function storeAcceptedManagedPartnerGrantKey(
  partnerShareSecretStore: PartnerShareSecretStore,
  grant: ManagedPartnerGrantKeyContext,
  inviteToken: string,
  now: Date,
): Promise<void> {
  const sourceInviteID = grant.sourceInviteID?.trim() ?? "";
  if (sourceInviteID.length === 0) {
    throw new Error("invalid_partner_grant_context");
  }

  // Derive both keys outside the mutate critical section to keep the
  // section short and to surface any derivation error before we touch
  // the store at all.
  const inviteKeyHex = derivePartnerShareKeyHex(inviteToken);
  const grantKeyHex = deriveGrantSubkeyHex(inviteKeyHex, {
    grantID: grant.id,
    ownerAccountID: grant.ownerAccountID,
    sourceInviteID,
  });
  const rotatedAtISO = now.toISOString();

  await partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
    record.grantKeysByGrantID[grant.id] = {
      keyHex: grantKeyHex,
      rotatedAtISO,
      sourceInviteID,
    };
  });
}

export async function reconcileManagedPartnerShareKeys(
  partnerShareSecretStore: PartnerShareSecretStore,
  overview: ManagedCloudPartnerAccessOverview,
  now: Date,
): Promise<PartnerShareSecretsRecord> {
  const nowISO = now.toISOString();
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

  return partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
    for (const grant of overview.owned.grants) {
      const inviteID = grant.sourceInviteID?.trim() || "";
      if (!inviteID) {
        continue;
      }
      // Idempotent: if K_grant for this grantID already exists we don't re-derive,
      // even if the same overview is re-processed (e.g. on a focus refresh).
      if (record.grantKeysByGrantID[grant.id]) {
        continue;
      }
      // Anti-replay (F4): once an invite has been consumed for one grant, refuse
      // to derive K_grant for any other grant from the same invite. This catches
      // a malicious managed cloud that calls acceptPartnerInvite(T) twice for
      // different partner accounts — only the first observed grant ever gets a
      // usable key on the owner side; the second grant ends up with no key and
      // upload silently fails with share_key_unavailable.
      const consumed = record.consumedInviteIDs[inviteID];
      if (consumed && consumed.grantID !== grant.id) {
        continue;
      }
      const pendingKey = record.pendingInviteKeysByInviteID[inviteID];
      if (!pendingKey) {
        continue;
      }
      const grantKeyHex = deriveGrantSubkeyHex(pendingKey, {
        grantID: grant.id,
        ownerAccountID: grant.ownerAccountID,
        sourceInviteID: inviteID,
      });
      record.grantKeysByGrantID[grant.id] = {
        keyHex: grantKeyHex,
        rotatedAtISO: nowISO,
        sourceInviteID: inviteID,
      };
      record.consumedInviteIDs[inviteID] = {
        grantID: grant.id,
        consumedAtISO: nowISO,
      };
      delete record.pendingInviteKeysByInviteID[inviteID];
    }

    // Drop pending invite keys whose invite is no longer active server-side
    // (revoked / expired before accept, or already rotated in the loop above).
    for (const inviteID of Object.keys(record.pendingInviteKeysByInviteID)) {
      if (activePendingInviteIDs.has(inviteID)) {
        continue;
      }
      delete record.pendingInviteKeysByInviteID[inviteID];
    }

    return record;
  });
}

/**
 * Owner-side handler invoked after a successful server revoke. Drops the
 * local copy of K_grant and the per-grant generation counter so subsequent
 * uploads cannot re-encrypt under a stale key (and so the secret store
 * does not accumulate dead rows). The anti-replay marker in
 * `consumedInviteIDs[sourceInviteID]` is preserved on purpose — re-issuing
 * the same invite token would otherwise become possible if the marker were
 * cleared.
 */
export async function clearManagedPartnerGrantKey(
  partnerShareSecretStore: PartnerShareSecretStore,
  grantID: string,
): Promise<void> {
  const trimmed = grantID.trim();
  if (trimmed.length === 0) {
    return;
  }
  await partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
    delete record.grantKeysByGrantID[trimmed];
    delete record.ownerGenerationByGrantID[trimmed];
  });
}

/**
 * Reserves the next monotonic generation for the given grant. Reads the
 * current owner counter from the partner-share secret store, increments by
 * one, persists, and returns the reserved value. Callers MUST embed the
 * returned generation inside the projection payload before encryption so the
 * partner can enforce non-regression on decrypt (F5 replay defence).
 *
 * Commits the new counter BEFORE the upload runs: a failed upload leaves a
 * gap in the sequence, which is intentional. Monotonic protection only
 * requires that the counter never regress on a successful path; gaps are safe.
 *
 * Atomic under the store's `mutatePartnerShareSecrets` serialization, so
 * concurrent reservations for the same grantID emit distinct values.
 */
export async function reserveNextManagedPartnerProjectionGeneration(
  partnerShareSecretStore: PartnerShareSecretStore,
  grantID: string,
): Promise<number> {
  return partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
    const nextGeneration = (record.ownerGenerationByGrantID[grantID] ?? 0) + 1;
    record.ownerGenerationByGrantID[grantID] = nextGeneration;
    return nextGeneration;
  });
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

  let decrypted: PartnerSharedProjectionPayload;
  try {
    decrypted = decryptPartnerSharedProjection(shareKey, result.projection);
  } catch {
    return { ok: false, errorCode: "invalid_partner_projection" };
  }

  // F5 anti-replay: a malicious managed cloud could retain and serve an
  // older ciphertext (same grant key, same AAD-bound metadata, same
  // checksum). The monotonic generation embedded inside the AEAD-protected
  // payload lets us detect rollback. Equal generation is accepted without
  // touching the store (it just means the same projection was re-read
  // before a fresh upload). Strict regression is treated as tampering.
  //
  // Whole compare-and-advance runs inside `mutate` so that two concurrent
  // loads cannot regress each other's marker.
  return partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
    const lastSeen = record.partnerLastSeenGenerationByGrantID[grant.id];
    if (lastSeen !== undefined && decrypted.generation < lastSeen) {
      return {
        ok: false,
        errorCode: "invalid_partner_projection",
      } satisfies ManagedPartnerShareResult<PartnerSharedProjectionPayload>;
    }
    if (lastSeen === undefined || decrypted.generation > lastSeen) {
      record.partnerLastSeenGenerationByGrantID[grant.id] = decrypted.generation;
    }
    return {
      ok: true,
      value: decrypted,
    } satisfies ManagedPartnerShareResult<PartnerSharedProjectionPayload>;
  });
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
  const record: PartnerShareGrantKeyRecord | undefined =
    secrets.grantKeysByGrantID[grantID];
  return record?.keyHex.trim() || null;
}

function parseInviteTokenFromURL(inviteURL: string): string {
  const parsed = new URL(inviteURL);
  const inviteToken = parsed.searchParams.get("invite_token")?.trim() || "";
  if (inviteToken.length === 0) {
    throw new Error("invalid_partner_invite");
  }
  return inviteToken;
}
