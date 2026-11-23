import type { PartnerShareAccessLevel } from "../models/partner-share";

// Per-grant share key after rotation. `keyHex` is K_grant — derived
// deterministically by both owner and partner from K_invite once the grant
// exists (see `deriveGrantSubkeyHex` in `partner-share-crypto`). The invite
// key K_invite is never persisted under a grant ID; on the owner it lives
// in `pendingInviteKeysByInviteID` until reconcile rotates it, on the
// partner it is ephemeral and discarded right after the accept handler
// derives K_grant.
export type PartnerShareGrantKeyRecord = {
  keyHex: string;
  rotatedAtISO: string;
  // The inviteID that originally minted this grant, mirrored from the
  // server's `grant.sourceInviteID`. Kept so the anti-replay check in
  // `consumedInviteIDs` has a stable cross-reference even if the secret
  // store is inspected without a fresh `getPartnerAccess` overview.
  sourceInviteID: string;
  // The access level the owner chose when issuing the invite, pinned on
  // this device. The projection never exceeds it, whatever level the
  // server lists for the grant. Absent on records written before the pin
  // existed, which build as the narrowest level.
  accessLevel?: PartnerShareAccessLevel;
  // Which side of the grant this device holds the key for, and the account
  // the key was created under. A `partner` key never encrypts an upload, so a
  // server that lists a received grant as owned cannot make this device
  // publish its own data to the inviter. Absent on records written before
  // the fields existed: such a key behaves as before.
  role?: PartnerShareGrantKeyRole;
  accountID?: string;
};

export type PartnerShareGrantKeyRole = "owner" | "partner";

// Owner-side anti-replay marker. Once an invite has been rotated into a
// K_grant, no second grant can ever consume the same invite — a malicious
// managed cloud that calls `acceptPartnerInvite(T)` twice for different
// partner accounts cannot trick the owner into deriving K_grant for the
// second grant. Entries are kept indefinitely (the set is one row per
// historical invite and only cleared by `clearPartnerShareSecrets`, which
// runs on "clear local data", account deletion and a managed disconnect
// together with every key; an unauthorized sign-out and a mode switch keep the
// entry).
export type PartnerShareConsumedInviteRecord = {
  grantID: string;
  consumedAtISO: string;
};

export type PartnerShareSecretsRecord = {
  grantKeysByGrantID: Record<string, PartnerShareGrantKeyRecord>;
  pendingInviteKeysByInviteID: Record<string, string>;
  // Access level the owner chose per pending invite, rotated into the
  // grant key record at reconcile. Kept beside (not inside) the key map so
  // an older build reading this record still finds every pending key.
  pendingInviteAccessLevelsByInviteID: Record<string, PartnerShareAccessLevel>;
  consumedInviteIDs: Record<string, PartnerShareConsumedInviteRecord>;
  // Owner-side monotonic counter, one per grant. Incremented before
  // every projection upload and embedded inside the AEAD-protected
  // payload. Gaps caused by failed uploads are safe; partner only
  // rejects strict regressions, not arbitrary increases.
  ownerGenerationByGrantID: Record<string, number>;
  // Partner-side anti-rollback marker: the highest projection
  // generation this device has accepted for the given grant. A
  // managed cloud that retains and replays an older ciphertext gets
  // rejected once the partner has observed a newer generation.
  partnerLastSeenGenerationByGrantID: Record<string, number>;
  // The invite the floor above was observed under. A re-shared grant keeps
  // its id but restarts the owner's counter under a new invite key, so a
  // floor applies only to projections decrypted under the same invite. A
  // floor without an entry here (written before the field existed) applies
  // as before until the grant's key is replaced.
  partnerLastSeenInviteIDByGrantID: Record<string, string>;
};

const PARTNER_SHARE_SECRET_STORE_KEY = "ovumcy.partner-share-secrets-v2";
// Keys stored under the previous entry were derived from the server-minted
// invite token alone, so the managed cloud could derive them too. The entry
// is never read; it is deleted on first access and on every clear.
const LEGACY_PARTNER_SHARE_SECRET_STORE_KEY = "ovumcy.partner-share-secrets";

export interface PartnerShareSecretStoreBackend {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

// A mutate whose captured clear epoch is stale: the store was cleared after
// the writer's flow started, so its write is dropped.
export class PartnerShareStoreClearedError extends Error {
  constructor() {
    super("partner_share_store_cleared");
    this.name = "PartnerShareStoreClearedError";
  }
}

export function isPartnerShareStoreClearedError(error: unknown): boolean {
  return error instanceof PartnerShareStoreClearedError;
}

export type PartnerShareMutateOptions = {
  // From `readPartnerShareClearEpoch()` before the flow's first await. A
  // clear that runs after the capture fails the mutate with
  // `PartnerShareStoreClearedError` before anything is read or written.
  clearEpoch?: number | undefined;
};

export interface PartnerShareSecretStore {
  clearPartnerShareSecrets(): Promise<void>;
  // In memory, per store instance: a write in flight dies with the process,
  // so only same-process races need it.
  readPartnerShareClearEpoch(): number;
  readPartnerShareSecrets(): Promise<PartnerShareSecretsRecord>;
  writePartnerShareSecrets(record: PartnerShareSecretsRecord): Promise<void>;
  // Serializes a read-modify-write turn against the secret store. The
  // updater receives the current record (a fresh in-memory copy from
  // disk), mutates it in place, and the wrapper writes the mutated
  // record back atomically with respect to other mutate() calls on
  // this same store instance. Use this instead of bare read+write
  // whenever a critical section spans both — the bare interface has
  // no atomicity and concurrent callers will overwrite each other.
  // The updater may return a value that the wrapper forwards as the
  // promise resolution (useful for reserve-and-return-the-new-value
  // patterns).
  mutatePartnerShareSecrets<T>(
    updater: (record: PartnerShareSecretsRecord) => T | Promise<T>,
    options?: PartnerShareMutateOptions,
  ): Promise<T>;
}

// Maps keyed by server-issued ids have no prototype, so an id such as
// `__proto__` or `constructor` reads as absent instead of an inherited member.
export function createPartnerShareIDMap<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

export function createEmptyPartnerShareSecretsRecord(): PartnerShareSecretsRecord {
  return {
    grantKeysByGrantID: createPartnerShareIDMap(),
    pendingInviteKeysByInviteID: createPartnerShareIDMap(),
    pendingInviteAccessLevelsByInviteID: createPartnerShareIDMap(),
    consumedInviteIDs: createPartnerShareIDMap(),
    ownerGenerationByGrantID: createPartnerShareIDMap(),
    partnerLastSeenGenerationByGrantID: createPartnerShareIDMap(),
    partnerLastSeenInviteIDByGrantID: createPartnerShareIDMap(),
  };
}

export function createPartnerShareSecretStore(
  backend: PartnerShareSecretStoreBackend,
): PartnerShareSecretStore {
  // Promise chain used to serialize concurrent mutate() turns against
  // a single store instance. Each new mutate() chains onto this
  // promise's resolution, guaranteeing read+update+write atomicity.
  // A rejection in one turn is swallowed for the *chaining* purpose
  // only — the original caller still sees their error via the returned
  // promise.
  let mutateChain: Promise<unknown> = Promise.resolve();
  let legacyEntryDeleted = false;
  let clearEpoch = 0;

  // Best-effort: a failed delete is retried on the next access, and the
  // legacy entry is never read either way.
  async function deleteLegacyEntryOnce(): Promise<void> {
    if (legacyEntryDeleted) {
      return;
    }
    try {
      await backend.deleteItem(LEGACY_PARTNER_SHARE_SECRET_STORE_KEY);
      legacyEntryDeleted = true;
    } catch {
      // Retried on the next access.
    }
  }

  // Queued on the mutate chain so a read-update-write turn already in flight
  // cannot write the record back after the delete. The epoch moves even when
  // the delete fails, so a writer that started earlier never lands.
  async function clearPartnerShareSecrets(): Promise<void> {
    const next = mutateChain.then(async () => {
      clearEpoch += 1;
      const results = await Promise.allSettled([
        backend.deleteItem(PARTNER_SHARE_SECRET_STORE_KEY),
        backend.deleteItem(LEGACY_PARTNER_SHARE_SECRET_STORE_KEY),
      ]);
      const failure = results.find((result) => result.status === "rejected");
      if (failure) {
        throw failure.reason;
      }
    });
    mutateChain = next.catch(() => undefined);
    await next;
  }

  async function readPartnerShareSecrets(): Promise<PartnerShareSecretsRecord> {
    await deleteLegacyEntryOnce();
    const rawValue = await backend.getItem(PARTNER_SHARE_SECRET_STORE_KEY);
    if (!rawValue) {
      return createEmptyPartnerShareSecretsRecord();
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<{
        grantKeysByGrantID: unknown;
        pendingInviteKeysByInviteID: unknown;
        pendingInviteAccessLevelsByInviteID: unknown;
        consumedInviteIDs: unknown;
        ownerGenerationByGrantID: unknown;
        partnerLastSeenGenerationByGrantID: unknown;
        partnerLastSeenInviteIDByGrantID: unknown;
      }>;
      return {
        grantKeysByGrantID: normalizeGrantKeysMap(parsed.grantKeysByGrantID),
        pendingInviteKeysByInviteID: normalizeSecretsMap(
          parsed.pendingInviteKeysByInviteID,
        ),
        pendingInviteAccessLevelsByInviteID: normalizeAccessLevelsMap(
          parsed.pendingInviteAccessLevelsByInviteID,
        ),
        consumedInviteIDs: normalizeConsumedInvitesMap(parsed.consumedInviteIDs),
        ownerGenerationByGrantID: normalizeGenerationsMap(
          parsed.ownerGenerationByGrantID,
        ),
        partnerLastSeenGenerationByGrantID: normalizeGenerationsMap(
          parsed.partnerLastSeenGenerationByGrantID,
        ),
        partnerLastSeenInviteIDByGrantID: normalizeSecretsMap(
          parsed.partnerLastSeenInviteIDByGrantID,
        ),
      };
    } catch {
      return createEmptyPartnerShareSecretsRecord();
    }
  }

  async function writePartnerShareSecrets(
    record: PartnerShareSecretsRecord,
  ): Promise<void> {
    await backend.setItem(
      PARTNER_SHARE_SECRET_STORE_KEY,
      JSON.stringify({
        grantKeysByGrantID: normalizeGrantKeysMap(record.grantKeysByGrantID),
        pendingInviteKeysByInviteID: normalizeSecretsMap(
          record.pendingInviteKeysByInviteID,
        ),
        pendingInviteAccessLevelsByInviteID: normalizeAccessLevelsMap(
          record.pendingInviteAccessLevelsByInviteID,
        ),
        consumedInviteIDs: normalizeConsumedInvitesMap(record.consumedInviteIDs),
        ownerGenerationByGrantID: normalizeGenerationsMap(
          record.ownerGenerationByGrantID,
        ),
        partnerLastSeenGenerationByGrantID: normalizeGenerationsMap(
          record.partnerLastSeenGenerationByGrantID,
        ),
        partnerLastSeenInviteIDByGrantID: normalizeSecretsMap(
          record.partnerLastSeenInviteIDByGrantID,
        ),
      }),
    );
  }

  function readPartnerShareClearEpoch(): number {
    return clearEpoch;
  }

  function mutatePartnerShareSecrets<T>(
    updater: (record: PartnerShareSecretsRecord) => T | Promise<T>,
    options?: PartnerShareMutateOptions,
  ): Promise<T> {
    const next = mutateChain.then(async () => {
      if (options?.clearEpoch !== undefined && options.clearEpoch !== clearEpoch) {
        throw new PartnerShareStoreClearedError();
      }
      const current = await readPartnerShareSecrets();
      const result = await updater(current);
      await writePartnerShareSecrets(current);
      return result;
    });
    mutateChain = next.catch(() => undefined);
    return next;
  }

  return {
    clearPartnerShareSecrets,
    readPartnerShareClearEpoch,
    readPartnerShareSecrets,
    writePartnerShareSecrets,
    mutatePartnerShareSecrets,
  };
}

function normalizeSecretsMap(value: unknown): Record<string, string> {
  const out = createPartnerShareIDMap<string>();
  if (!value || typeof value !== "object") {
    return out;
  }

  for (const [rawKey, item] of Object.entries(value)) {
    const key = rawKey.trim();
    if (key.length > 0 && typeof item === "string" && item.trim().length > 0) {
      out[key] = item.trim();
    }
  }
  return out;
}

function isAccessLevel(value: unknown): value is PartnerShareAccessLevel {
  return value === "summary" || value === "full";
}

function isGrantKeyRole(value: unknown): value is PartnerShareGrantKeyRole {
  return value === "owner" || value === "partner";
}

function normalizeAccessLevelsMap(
  value: unknown,
): Record<string, PartnerShareAccessLevel> {
  const out = createPartnerShareIDMap<PartnerShareAccessLevel>();
  if (!value || typeof value !== "object") {
    return out;
  }

  for (const [rawKey, item] of Object.entries(value)) {
    const key = rawKey.trim();
    if (key.length > 0 && isAccessLevel(item)) {
      out[key] = item;
    }
  }
  return out;
}

function normalizeGenerationsMap(value: unknown): Record<string, number> {
  const out = createPartnerShareIDMap<number>();
  if (!value || typeof value !== "object") {
    return out;
  }

  for (const [rawKey, item] of Object.entries(value)) {
    const key = rawKey.trim();
    if (
      key.length > 0 &&
      typeof item === "number" &&
      Number.isInteger(item) &&
      item >= 0
    ) {
      out[key] = item;
    }
  }
  return out;
}

function normalizeGrantKeysMap(
  value: unknown,
): Record<string, PartnerShareGrantKeyRecord> {
  const out = createPartnerShareIDMap<PartnerShareGrantKeyRecord>();
  if (!value || typeof value !== "object") {
    return out;
  }

  for (const [rawKey, rawItem] of Object.entries(value)) {
    if (typeof rawKey !== "string") {
      continue;
    }
    const key = rawKey.trim();
    if (key.length === 0 || !rawItem || typeof rawItem !== "object") {
      continue;
    }

    const record = rawItem as Partial<PartnerShareGrantKeyRecord>;
    const keyHex = typeof record.keyHex === "string" ? record.keyHex.trim() : "";
    const rotatedAtISO =
      typeof record.rotatedAtISO === "string" ? record.rotatedAtISO.trim() : "";
    const sourceInviteID =
      typeof record.sourceInviteID === "string" ? record.sourceInviteID.trim() : "";
    if (keyHex.length === 0) {
      // An entry without a key is unusable — drop it rather than persist
      // a zombie record that would later surface as `share_key_unavailable`.
      continue;
    }
    const accountID =
      typeof record.accountID === "string" ? record.accountID.trim() : "";
    out[key] = {
      keyHex,
      rotatedAtISO,
      sourceInviteID,
      ...(isAccessLevel(record.accessLevel) ? { accessLevel: record.accessLevel } : {}),
      ...(isGrantKeyRole(record.role) ? { role: record.role } : {}),
      ...(accountID.length > 0 ? { accountID } : {}),
    };
  }
  return out;
}

function normalizeConsumedInvitesMap(
  value: unknown,
): Record<string, PartnerShareConsumedInviteRecord> {
  const out = createPartnerShareIDMap<PartnerShareConsumedInviteRecord>();
  if (!value || typeof value !== "object") {
    return out;
  }

  for (const [rawKey, rawItem] of Object.entries(value)) {
    if (typeof rawKey !== "string") {
      continue;
    }
    const key = rawKey.trim();
    if (key.length === 0 || !rawItem || typeof rawItem !== "object") {
      continue;
    }

    const record = rawItem as Partial<PartnerShareConsumedInviteRecord>;
    const grantID = typeof record.grantID === "string" ? record.grantID.trim() : "";
    const consumedAtISO =
      typeof record.consumedAtISO === "string" ? record.consumedAtISO.trim() : "";
    if (grantID.length === 0) {
      // Anti-replay needs a grantID to compare against on the next reconcile.
      // An entry without one is meaningless, so drop it.
      continue;
    }
    out[key] = { grantID, consumedAtISO };
  }
  return out;
}
