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
};

// Owner-side anti-replay marker. Once an invite has been rotated into a
// K_grant, no second grant can ever consume the same invite — a malicious
// managed cloud that calls `acceptPartnerInvite(T)` twice for different
// partner accounts cannot trick the owner into deriving K_grant for the
// second grant. Entries are kept indefinitely (the set is one row per
// historical invite and only cleared by `clearPartnerShareSecrets`, which
// runs on disconnect / mode-switch / forced unauthorized clear).
export type PartnerShareConsumedInviteRecord = {
  grantID: string;
  consumedAtISO: string;
};

export type PartnerShareSecretsRecord = {
  grantKeysByGrantID: Record<string, PartnerShareGrantKeyRecord>;
  pendingInviteKeysByInviteID: Record<string, string>;
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
};

const PARTNER_SHARE_SECRET_STORE_KEY = "ovumcy.partner-share-secrets";

export interface PartnerShareSecretStoreBackend {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface PartnerShareSecretStore {
  clearPartnerShareSecrets(): Promise<void>;
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
  ): Promise<T>;
}

export function createEmptyPartnerShareSecretsRecord(): PartnerShareSecretsRecord {
  return {
    grantKeysByGrantID: {},
    pendingInviteKeysByInviteID: {},
    consumedInviteIDs: {},
    ownerGenerationByGrantID: {},
    partnerLastSeenGenerationByGrantID: {},
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

  async function clearPartnerShareSecrets(): Promise<void> {
    await backend.deleteItem(PARTNER_SHARE_SECRET_STORE_KEY);
  }

  async function readPartnerShareSecrets(): Promise<PartnerShareSecretsRecord> {
    const rawValue = await backend.getItem(PARTNER_SHARE_SECRET_STORE_KEY);
    if (!rawValue) {
      return createEmptyPartnerShareSecretsRecord();
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<{
        grantKeysByGrantID: unknown;
        pendingInviteKeysByInviteID: unknown;
        consumedInviteIDs: unknown;
        ownerGenerationByGrantID: unknown;
        partnerLastSeenGenerationByGrantID: unknown;
      }>;
      return {
        grantKeysByGrantID: normalizeGrantKeysMap(parsed.grantKeysByGrantID),
        pendingInviteKeysByInviteID: normalizeSecretsMap(
          parsed.pendingInviteKeysByInviteID,
        ),
        consumedInviteIDs: normalizeConsumedInvitesMap(parsed.consumedInviteIDs),
        ownerGenerationByGrantID: normalizeGenerationsMap(
          parsed.ownerGenerationByGrantID,
        ),
        partnerLastSeenGenerationByGrantID: normalizeGenerationsMap(
          parsed.partnerLastSeenGenerationByGrantID,
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
        consumedInviteIDs: normalizeConsumedInvitesMap(record.consumedInviteIDs),
        ownerGenerationByGrantID: normalizeGenerationsMap(
          record.ownerGenerationByGrantID,
        ),
        partnerLastSeenGenerationByGrantID: normalizeGenerationsMap(
          record.partnerLastSeenGenerationByGrantID,
        ),
      }),
    );
  }

  function mutatePartnerShareSecrets<T>(
    updater: (record: PartnerShareSecretsRecord) => T | Promise<T>,
  ): Promise<T> {
    const next = mutateChain.then(async () => {
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
    readPartnerShareSecrets,
    writePartnerShareSecrets,
    mutatePartnerShareSecrets,
  };
}

function normalizeSecretsMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, item]) =>
          typeof key === "string" &&
          key.trim().length > 0 &&
          typeof item === "string" &&
          item.trim().length > 0,
      )
      .map(([key, item]) => [key.trim(), item.trim()]),
  );
}

function normalizeGenerationsMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, item]) =>
          typeof key === "string" &&
          key.trim().length > 0 &&
          typeof item === "number" &&
          Number.isInteger(item) &&
          item >= 0,
      )
      .map(([key, item]) => [key.trim(), item as number]),
  );
}

function normalizeGrantKeysMap(
  value: unknown,
): Record<string, PartnerShareGrantKeyRecord> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const out: Record<string, PartnerShareGrantKeyRecord> = {};
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
    out[key] = { keyHex, rotatedAtISO, sourceInviteID };
  }
  return out;
}

function normalizeConsumedInvitesMap(
  value: unknown,
): Record<string, PartnerShareConsumedInviteRecord> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const out: Record<string, PartnerShareConsumedInviteRecord> = {};
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
