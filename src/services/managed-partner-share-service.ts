import type {
  PartnerShareGrantKeyRecord,
  PartnerShareSecretStore,
  PartnerShareSecretsRecord,
} from "../security/partner-share-secret-store";
import {
  createPartnerInviteSecretHex,
  decryptPartnerSharedProjection,
  deriveGrantSubkeyHex,
  derivePartnerShareKeyHex,
  encryptPartnerSharedProjection,
} from "../security/partner-share-crypto";
import { buildShareablePartnerInviteURL } from "../security/partner-invite-link";
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
import type {
  PartnerShareAccessLevel,
  PartnerSharedProjectionPayload,
} from "../models/partner-share";

/**
 * The level a projection is built at: the stricter of the level the owner
 * pinned on this device and the one the server lists. A record without a
 * pin (written before pinning existed) builds as `summary`, so a server can
 * never widen what the owner chose.
 */
export function resolveManagedPartnerProjectionAccessLevel(
  pinned: PartnerShareAccessLevel | undefined,
  listed: PartnerShareAccessLevel,
): PartnerShareAccessLevel {
  return pinned === "full" && listed === "full" ? "full" : "summary";
}

export type ManagedPartnerShareResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      errorCode:
        | ManagedCloudAPIErrorCode
        | "not_connected"
        | "share_key_unavailable"
        | "invalid_partner_projection";
      retryAfterSeconds?: number;
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
> &
  Partial<Pick<ManagedCloudPartnerAccessGrant, "partnerAccountID">>;

/**
 * Owner-side handler for a freshly issued invite. Generates the client-only
 * invite secret, stores K_invite under the invite ID, and returns the link to
 * share: the server's invite URL with the secret in its fragment. The secret
 * itself is not persisted, so the link can be shown only once.
 */
export async function storeIssuedManagedPartnerInviteKey(
  partnerShareSecretStore: PartnerShareSecretStore,
  result: ManagedCloudPartnerInviteIssueResult,
  // The level the owner chose, not the one the server echoes back.
  accessLevel: PartnerShareAccessLevel,
): Promise<string> {
  const inviteToken = parseInviteTokenFromURL(result.inviteURL);
  const inviteSecretHex = createPartnerInviteSecretHex();
  const inviteKeyHex = derivePartnerShareKeyHex(inviteToken, inviteSecretHex);
  const shareableInviteURL = buildShareablePartnerInviteURL(
    result.inviteURL,
    inviteSecretHex,
  );
  await partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
    record.pendingInviteKeysByInviteID[result.invite.id] = inviteKeyHex;
    record.pendingInviteAccessLevelsByInviteID[result.invite.id] = accessLevel;
  });
  return shareableInviteURL;
}

/**
 * Partner-side handler for the accept flow. Derives K_invite from the invite
 * token and the link's invite secret, then immediately rotates to K_grant via
 * `deriveGrantSubkeyHex` — K_invite is never persisted on the partner device.
 * A transient observer of the invite link therefore cannot decrypt any
 * partner-share blob the owner uploads after accept.
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
  inviteSecretHex: string,
  now: Date,
): Promise<void> {
  const sourceInviteID = grant.sourceInviteID?.trim() ?? "";
  if (sourceInviteID.length === 0) {
    throw new Error("invalid_partner_grant_context");
  }

  // Derive both keys outside the mutate critical section to keep the
  // section short and to surface any derivation error before we touch
  // the store at all.
  const inviteKeyHex = derivePartnerShareKeyHex(inviteToken, inviteSecretHex);
  const grantKeyHex = deriveGrantSubkeyHex(inviteKeyHex, {
    grantID: grant.id,
    ownerAccountID: grant.ownerAccountID,
    sourceInviteID,
  });
  const rotatedAtISO = now.toISOString();
  const partnerAccountID = grant.partnerAccountID?.trim() ?? "";

  await partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
    // A re-shared grant keeps its id under a new invite and the owner's
    // counter restarts, so the floor seen under the previous key is dropped.
    // Old ciphertexts cannot be replayed past this: they fail to decrypt
    // under the new key.
    if (record.grantKeysByGrantID[grant.id]?.sourceInviteID !== sourceInviteID) {
      delete record.partnerLastSeenGenerationByGrantID[grant.id];
      delete record.partnerLastSeenInviteIDByGrantID[grant.id];
    }
    record.grantKeysByGrantID[grant.id] = {
      keyHex: grantKeyHex,
      rotatedAtISO,
      sourceInviteID,
      role: "partner",
      ...(partnerAccountID.length > 0 ? { accountID: partnerAccountID } : {}),
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
      // Idempotent: K_grant already derived under the listed invite is kept,
      // even if the same overview is re-processed (e.g. on a focus refresh).
      // A key derived under an earlier invite is replaced below once the
      // re-share's pending key is here. A key this device holds as the
      // partner is never replaced by an owner key.
      const existingKey = record.grantKeysByGrantID[grant.id];
      if (
        existingKey &&
        (existingKey.role === "partner" || existingKey.sourceInviteID === inviteID)
      ) {
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
      const pinnedLevel = record.pendingInviteAccessLevelsByInviteID[inviteID];
      const ownerAccountID = grant.ownerAccountID.trim();
      record.grantKeysByGrantID[grant.id] = {
        keyHex: grantKeyHex,
        rotatedAtISO: nowISO,
        sourceInviteID: inviteID,
        ...(pinnedLevel ? { accessLevel: pinnedLevel } : {}),
        role: "owner",
        ...(ownerAccountID.length > 0 ? { accountID: ownerAccountID } : {}),
      };
      record.consumedInviteIDs[inviteID] = {
        grantID: grant.id,
        consumedAtISO: nowISO,
      };
      delete record.pendingInviteKeysByInviteID[inviteID];
      delete record.pendingInviteAccessLevelsByInviteID[inviteID];
    }

    // Drop pending invite keys whose invite is no longer active server-side
    // (revoked / expired before accept, or already rotated in the loop above).
    for (const inviteID of Object.keys(record.pendingInviteKeysByInviteID)) {
      if (activePendingInviteIDs.has(inviteID)) {
        continue;
      }
      delete record.pendingInviteKeysByInviteID[inviteID];
      delete record.pendingInviteAccessLevelsByInviteID[inviteID];
    }

    // A received grant the server lists as revoked can never be read again,
    // so its key and replay markers go. A grant missing from the listing is
    // kept: a partial or failed listing must not cost the partner a key the
    // single-use invite cannot restore. Only a key from the revoked row's own
    // invite goes, so a listing fetched before a re-share accept cannot delete
    // the key just stored under the new invite.
    for (const grant of overview.sharedWithMe) {
      const receivedKey = record.grantKeysByGrantID[grant.id];
      if (
        grant.revokedAt !== null &&
        receivedKey?.role === "partner" &&
        receivedKey.sourceInviteID === (grant.sourceInviteID?.trim() ?? "")
      ) {
        delete record.grantKeysByGrantID[grant.id];
        delete record.partnerLastSeenGenerationByGrantID[grant.id];
        delete record.partnerLastSeenInviteIDByGrantID[grant.id];
      }
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
 *
 * Managed cloud revokes every pending invite of the owner in the same
 * transaction as a grant revoke (MNG-29), so the pending invite keys are
 * dropped here too: no invite they could rotate into a grant is left.
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
    record.pendingInviteKeysByInviteID = {};
    record.pendingInviteAccessLevelsByInviteID = {};
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
    // `sourceInviteID` of the grant as the current listing shows it.
    listedSourceInviteID: string | null;
  },
): Promise<ManagedPartnerShareResult<ManagedCloudPartnerProjection>> {
  const sessionToken = await readManagedSessionToken(syncSecretStore, syncMode);
  if (!sessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  // A legacy grant has no key context the server can bind; only a revoke
  // plus a fresh invite repairs it, so nothing is encrypted or sent.
  const listedSourceInviteID = input.listedSourceInviteID?.trim() ?? "";
  if (listedSourceInviteID.length === 0) {
    return { ok: false, errorCode: "partner_grant_rekeyed" };
  }

  // Key and key context come from one read of one record, so the id sent is
  // the one the ciphertext's K_grant was derived under.
  const grantKey = await readGrantKeyRecord(
    input.partnerShareSecretStore,
    input.projection.grantID,
  );
  if (!grantKey) {
    return { ok: false, errorCode: "share_key_unavailable" };
  }
  // A received key, or an owner key created under another account than the
  // projection names, never encrypts this device's data.
  if (
    grantKey.role === "partner" ||
    (grantKey.accountID !== undefined &&
      grantKey.accountID !== input.projection.ownerAccountID.trim())
  ) {
    return { ok: false, errorCode: "share_key_unavailable" };
  }
  if (grantKey.sourceInviteID !== listedSourceInviteID) {
    return { ok: false, errorCode: "partner_grant_rekeyed" };
  }

  const encryptedProjection = encryptPartnerSharedProjection(
    grantKey.keyHex,
    input.projection,
  );
  const result = await createManagedCloudAPIClient(
    MANAGED_CLOUD_AUTH_BASE_URL,
  ).upsertPartnerProjection(sessionToken, input.projection.grantID, {
    schemaVersion: encryptedProjection.schemaVersion,
    checksumSHA256: encryptedProjection.checksumSHA256,
    ciphertextBase64: encryptedProjection.ciphertextBase64,
    ciphertextSize: encryptedProjection.ciphertextSize,
    sourceInviteID: grantKey.sourceInviteID,
  });

  return result.ok ? { ok: true, value: result.projection } : result;
}

/**
 * True when no projection from this device can land on a live grant, so the
 * owner must revoke it and invite again: the grant predates
 * `source_invite_id` (the server refuses every key context), or this
 * device's K_grant was derived under another invite than the one listed
 * (re-shared since). A grant with no key here is not flagged — it may be
 * keyed on another owner device.
 */
export function isManagedPartnerGrantReshareRequired(
  grant: Pick<ManagedCloudPartnerAccessGrant, "sourceInviteID" | "revokedAt">,
  grantKey?: Pick<PartnerShareGrantKeyRecord, "sourceInviteID">,
): boolean {
  if (grant.revokedAt !== null) {
    return false;
  }
  const listedSourceInviteID = grant.sourceInviteID?.trim() ?? "";
  if (listedSourceInviteID.length === 0) {
    return true;
  }
  return (
    grantKey !== undefined && grantKey.sourceInviteID.trim() !== listedSourceInviteID
  );
}

export function listManagedPartnerGrantsNeedingReshare(
  overview: ManagedCloudPartnerAccessOverview,
  secrets: Pick<PartnerShareSecretsRecord, "grantKeysByGrantID">,
): string[] {
  return overview.owned.grants
    .filter((grant) =>
      isManagedPartnerGrantReshareRequired(grant, secrets.grantKeysByGrantID[grant.id]),
    )
    .map((grant) => grant.id);
}

export async function loadManagedPartnerProjection(
  syncSecretStore: SyncSecretStore,
  partnerShareSecretStore: PartnerShareSecretStore,
  syncMode: SyncMode,
  grant: Pick<ManagedCloudPartnerAccessGrant, "id"> &
    Partial<Pick<ManagedCloudPartnerAccessGrant, "sourceInviteID">>,
): Promise<ManagedPartnerShareResult<PartnerSharedProjectionPayload>> {
  const sessionToken = await readManagedSessionToken(syncSecretStore, syncMode);
  if (!sessionToken) {
    return { ok: false, errorCode: "not_connected" };
  }

  const grantKey = await readGrantKeyRecord(partnerShareSecretStore, grant.id);
  if (!grantKey) {
    return { ok: false, errorCode: "share_key_unavailable" };
  }
  const shareKey = grantKey.keyHex;
  const keyInviteID = grantKey.sourceInviteID;
  // The listing names a newer invite than the one this key came from: the
  // owner re-shared, and only accepting the new invite restores reading.
  const listedSourceInviteID = grant.sourceInviteID?.trim() ?? "";
  if (
    listedSourceInviteID.length > 0 &&
    keyInviteID.length > 0 &&
    listedSourceInviteID !== keyInviteID
  ) {
    return { ok: false, errorCode: "partner_grant_rekeyed" };
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
  // loads cannot regress each other's marker. The floor counts only for the
  // invite it was seen under (a re-shared grant restarts the counter).
  return partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
    // The key was replaced while this projection was being decrypted.
    if (pickGrantKey(record.grantKeysByGrantID, grant.id)?.keyHex !== shareKey) {
      return {
        ok: false,
        errorCode: "invalid_partner_projection",
      } satisfies ManagedPartnerShareResult<PartnerSharedProjectionPayload>;
    }
    const floorInviteID = Object.prototype.hasOwnProperty.call(record.partnerLastSeenInviteIDByGrantID, grant.id)
      ? record.partnerLastSeenInviteIDByGrantID[grant.id]
      : undefined;
    const lastSeen =
      Object.prototype.hasOwnProperty.call(record.partnerLastSeenGenerationByGrantID, grant.id) &&
      (floorInviteID === undefined || floorInviteID === keyInviteID)
        ? record.partnerLastSeenGenerationByGrantID[grant.id]
        : undefined;
    if (lastSeen !== undefined && decrypted.generation < lastSeen) {
      return {
        ok: false,
        errorCode: "invalid_partner_projection",
      } satisfies ManagedPartnerShareResult<PartnerSharedProjectionPayload>;
    }
    if (lastSeen === undefined || decrypted.generation > lastSeen) {
      record.partnerLastSeenGenerationByGrantID[grant.id] = decrypted.generation;
    }
    if (keyInviteID.length > 0) {
      record.partnerLastSeenInviteIDByGrantID[grant.id] = keyInviteID;
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

type ReadGrantKey = Pick<PartnerShareGrantKeyRecord, "keyHex" | "sourceInviteID"> &
  Partial<Pick<PartnerShareGrantKeyRecord, "role" | "accountID">>;

async function readGrantKeyRecord(
  partnerShareSecretStore: PartnerShareSecretStore,
  grantID: string,
): Promise<ReadGrantKey | null> {
  const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
  return pickGrantKey(secrets.grantKeysByGrantID, grantID);
}

function pickGrantKey(
  grantKeysByGrantID: PartnerShareSecretsRecord["grantKeysByGrantID"],
  grantID: string,
): ReadGrantKey | null {
  if (!Object.prototype.hasOwnProperty.call(grantKeysByGrantID, grantID)) {
    return null;
  }
  const record = grantKeysByGrantID[grantID];
  const keyHex = typeof record?.keyHex === "string" ? record.keyHex.trim() : "";
  if (!record || keyHex.length === 0) {
    return null;
  }
  const accountID = record.accountID?.trim() ?? "";
  return {
    keyHex,
    sourceInviteID: record.sourceInviteID.trim(),
    ...(record.role ? { role: record.role } : {}),
    ...(accountID.length > 0 ? { accountID } : {}),
  };
}

function parseInviteTokenFromURL(inviteURL: string): string {
  const parsed = new URL(inviteURL);
  const inviteToken = parsed.searchParams.get("invite_token")?.trim() || "";
  if (inviteToken.length === 0) {
    throw new Error("invalid_partner_invite");
  }
  return inviteToken;
}
