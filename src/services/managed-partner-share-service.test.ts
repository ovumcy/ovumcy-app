import {
  createPartnerShareSecretStore,
  type PartnerShareSecretStoreBackend,
} from "../security/partner-share-secret-store";
import {
  derivePartnerShareKeyHex,
  deriveGrantSubkeyHex,
  encryptPartnerSharedProjection,
} from "../security/partner-share-crypto";
import { parsePartnerInviteLink } from "../security/partner-invite-link";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  clearManagedPartnerGrantKey,
  isManagedPartnerGrantReshareRequired,
  listManagedPartnerGrantsNeedingReshare,
  loadManagedPartnerProjection,
  reconcileManagedPartnerShareKeys,
  reserveNextManagedPartnerProjectionGeneration,
  storeAcceptedManagedPartnerGrantKey,
  resolveManagedPartnerProjectionAccessLevel,
  storeIssuedManagedPartnerInviteKey,
  uploadManagedPartnerProjection,
} from "./managed-partner-share-service";
import type {
  ManagedCloudPartnerAccessGrant,
  ManagedCloudPartnerAccessOverview,
  ManagedCloudPartnerInvite,
} from "../sync/managed-cloud-api-client";
import {
  PARTNER_SHARE_SCHEMA_VERSION,
  type PartnerSharedProjectionPayload,
} from "../models/partner-share";

const INVITE_TOKEN = "invite-token-1-fixture-padding";
const INVITE_SECRET_HEX = "11".repeat(32);
const NOW = new Date("2026-04-05T08:00:00.000Z");

function createPartnerShareSecretStoreMock() {
  const state = new Map<string, string>();
  const backend: PartnerShareSecretStoreBackend = {
    async deleteItem(key: string) {
      state.delete(key);
    },
    async getItem(key: string) {
      return state.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      state.set(key, value);
    },
  };

  return createPartnerShareSecretStore(backend);
}

// The owner derives the same K_grant as the partner; only the recorded side
// differs, and only an owner-side key may encrypt an upload.
async function storeOwnerGrantKeyFixture(
  store: ReturnType<typeof createPartnerShareSecretStoreMock>,
) {
  await storeAcceptedManagedPartnerGrantKey(
    store,
    buildGrantFixture(),
    INVITE_TOKEN,
    INVITE_SECRET_HEX,
    NOW,
  );
  await store.mutatePartnerShareSecrets((record) => {
    record.grantKeysByGrantID["grant-1"]!.role = "owner";
    record.grantKeysByGrantID["grant-1"]!.accountID = "owner-1";
  });
}

function buildInviteFixture(
  overrides: Partial<ManagedCloudPartnerInvite> = {},
): ManagedCloudPartnerInvite {
  return {
    id: "invite-1",
    ownerAccountID: "owner-1",
    accessLevel: "summary",
    status: "pending",
    expiresAt: "2026-04-10T00:00:00.000Z",
    acceptedAt: null,
    acceptedAccountID: null,
    revokedAt: null,
    revokedReason: "",
    createdBy: "owner-1",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
    ...overrides,
  };
}

function buildGrantFixture(
  overrides: Partial<ManagedCloudPartnerAccessGrant> = {},
): ManagedCloudPartnerAccessGrant {
  return {
    id: "grant-1",
    ownerAccountID: "owner-1",
    partnerAccountID: "partner-1",
    accessLevel: "summary",
    sourceInviteID: "invite-1",
    acceptedAt: "2026-04-05T08:00:00.000Z",
    lastSeenAt: null,
    revokedAt: null,
    revokedReason: "",
    createdAt: "2026-04-05T08:00:00.000Z",
    updatedAt: "2026-04-05T08:00:00.000Z",
    ...overrides,
  };
}

function buildProjectionPayload(
  overrides: Partial<PartnerSharedProjectionPayload> = {},
): PartnerSharedProjectionPayload {
  return {
    schemaVersion: PARTNER_SHARE_SCHEMA_VERSION,
    generatedAt: "2026-04-05T08:00:00.000Z",
    generation: 1,
    accessLevel: "summary",
    ownerAccountID: "owner-1",
    grantID: "grant-1",
    profile: {
      ageGroup: "",
      cycleLength: 28,
      hideNotes: false,
      hideSexChip: false,
      irregularCycle: false,
      lastPeriodStart: "2026-04-01",
      periodLength: 5,
      temperatureUnit: "c",
      trackBBT: false,
      trackCervicalMucus: false,
      unpredictableCycle: false,
    },
    dayLogs: [],
    symptomRecords: [],
    ...overrides,
  };
}

async function setupConnectedSyncSecrets() {
  const syncSecretStore = createSyncSecretStoreMock();
  await syncSecretStore.writeSyncSecrets({
    device: {
      deviceID: "device-1",
      deviceLabel: "Pixel 7",
      createdAt: "2026-04-05T08:00:00.000Z",
    },
    masterKeyHex: "aa",
    deviceSecretHex: "bb",
    wrappedKey: {
      algorithm: "xchacha20poly1305",
      kdf: "bip39_seed_hkdf_sha256",
      mnemonicWordCount: 12,
      wrapNonceHex: "cc",
      wrappedMasterKeyHex: "dd",
      phraseFingerprintHex: "ee",
    },
    authSessionToken: null,
    managedAuthSessionToken: "managed-session-1",
    managedAuthSessionExpiresAt: null,
    managedRefreshToken: null,
    managedRefreshTokenExpiresAt: null,
  });
  return syncSecretStore;
}

describe("managed-partner-share-service", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("pinned access level", () => {
    it("pins the owner's chosen level with the pending key, not the server's echo", async () => {
      const store = createPartnerShareSecretStoreMock();

      await storeIssuedManagedPartnerInviteKey(
        store,
        {
          invite: buildInviteFixture({ accessLevel: "full" }),
          inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
        },
        "summary",
      );

      const secrets = await store.readPartnerShareSecrets();
      expect(secrets.pendingInviteAccessLevelsByInviteID).toEqual({
        "invite-1": "summary",
      });
    });

    it("carries the pinned level into the grant key record and clears the pending pin", async () => {
      const store = createPartnerShareSecretStoreMock();
      await storeIssuedManagedPartnerInviteKey(
        store,
        {
          invite: buildInviteFixture(),
          inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
        },
        "summary",
      );

      const reconciled = await reconcileManagedPartnerShareKeys(
        store,
        {
          owned: {
            invites: [],
            grants: [buildGrantFixture({ accessLevel: "full" })],
          },
          sharedWithMe: [],
        },
        NOW,
      );

      expect(reconciled.grantKeysByGrantID["grant-1"]?.accessLevel).toBe("summary");
      expect(reconciled.pendingInviteAccessLevelsByInviteID).toEqual({});
      expect(reconciled.consumedInviteIDs["invite-1"]?.grantID).toBe("grant-1");
    });

    it("leaves a pending key without a pinned level unpinned when it rotates", async () => {
      const store = createPartnerShareSecretStoreMock();
      await store.mutatePartnerShareSecrets((record) => {
        record.pendingInviteKeysByInviteID["invite-1"] = "ab".repeat(32);
      });

      const reconciled = await reconcileManagedPartnerShareKeys(
        store,
        { owned: { invites: [], grants: [buildGrantFixture()] }, sharedWithMe: [] },
        NOW,
      );

      expect(reconciled.grantKeysByGrantID["grant-1"]).toBeDefined();
      expect(reconciled.grantKeysByGrantID["grant-1"]?.accessLevel).toBeUndefined();
    });

    it.each([
      ["summary", "summary", "summary"],
      ["summary", "full", "summary"],
      ["full", "summary", "summary"],
      ["full", "full", "full"],
      [undefined, "full", "summary"],
      [undefined, "summary", "summary"],
    ] as const)(
      "builds at the stricter level: pinned %p, listed %p gives %p",
      (pinned, listed, expected) => {
        expect(resolveManagedPartnerProjectionAccessLevel(pinned, listed)).toBe(expected);
      },
    );
  });

  describe("reconcileManagedPartnerShareKeys", () => {
    it("rotates pending invite keys into per-grant subkeys and clears K_invite", async () => {
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();

      const shareableLink = await storeIssuedManagedPartnerInviteKey(
        partnerShareSecretStore,
        {
          invite: buildInviteFixture(),
          inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
        },
        "full",
      );

      const overview: ManagedCloudPartnerAccessOverview = {
        owned: {
          invites: [],
          grants: [buildGrantFixture()],
        },
        sharedWithMe: [],
      };

      const reconciled = await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        overview,
        NOW,
      );

      // K_invite discarded from pending map.
      expect(reconciled.pendingInviteKeysByInviteID["invite-1"]).toBeUndefined();

      // K_grant != K_invite — rotation actually happened.
      const inviteKeyHex = derivePartnerShareKeyHex(
        INVITE_TOKEN,
        parsePartnerInviteLink(shareableLink).inviteSecretHex,
      );
      const expectedGrantKey = deriveGrantSubkeyHex(inviteKeyHex, {
        grantID: "grant-1",
        ownerAccountID: "owner-1",
        sourceInviteID: "invite-1",
      });
      expect(reconciled.grantKeysByGrantID["grant-1"]?.keyHex).toBe(
        expectedGrantKey,
      );
      expect(reconciled.grantKeysByGrantID["grant-1"]?.sourceInviteID).toBe(
        "invite-1",
      );
      expect(reconciled.grantKeysByGrantID["grant-1"]?.keyHex).not.toBe(
        inviteKeyHex,
      );

      // Anti-replay marker recorded for the consumed invite.
      expect(reconciled.consumedInviteIDs["invite-1"]).toEqual({
        grantID: "grant-1",
        consumedAtISO: NOW.toISOString(),
      });
    });

    it("drops pending invite keys once the invite is no longer active", async () => {
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();

      await storeIssuedManagedPartnerInviteKey(partnerShareSecretStore, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");

      const reconciled = await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        {
          owned: {
            invites: [],
            grants: [],
          },
          sharedWithMe: [],
        },
        NOW,
      );

      expect(reconciled.pendingInviteKeysByInviteID["invite-1"]).toBeUndefined();
    });

    it("refuses to derive K_grant for a second grant that reuses a consumed invite", async () => {
      // A compromised managed cloud calls acceptPartnerInvite(T) twice for two
      // different partner accounts. Only the first observed grant ever gets a
      // usable K_grant on the owner side; the second is left unkeyed and
      // upload silently fails downstream.
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();

      await storeIssuedManagedPartnerInviteKey(partnerShareSecretStore, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");

      // First reconcile: invite-1 → grant-1. Pending K_invite is consumed.
      await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        {
          owned: { invites: [], grants: [buildGrantFixture()] },
          sharedWithMe: [],
        },
        NOW,
      );

      // Second reconcile sees a NEW grant whose sourceInviteID still points at
      // the same consumed invite-1 — a replay attempt. Re-seed pending key to
      // make the rotation step theoretically possible; the anti-replay marker
      // is the only thing that blocks it.
      await partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
        record.pendingInviteKeysByInviteID["invite-1"] =
          derivePartnerShareKeyHex(INVITE_TOKEN, INVITE_SECRET_HEX);
      });

      const reconciled = await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        {
          owned: {
            invites: [],
            grants: [
              buildGrantFixture(),
              buildGrantFixture({ id: "grant-2", partnerAccountID: "partner-2" }),
            ],
          },
          sharedWithMe: [],
        },
        NOW,
      );

      // grant-1 still keyed (idempotent), grant-2 refused.
      expect(reconciled.grantKeysByGrantID["grant-1"]).toBeDefined();
      expect(reconciled.grantKeysByGrantID["grant-2"]).toBeUndefined();
      // Marker still points at the original consumer.
      expect(reconciled.consumedInviteIDs["invite-1"]?.grantID).toBe("grant-1");
    });

    it("is idempotent: re-reconciling the same overview does not re-rotate", async () => {
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();
      await storeIssuedManagedPartnerInviteKey(partnerShareSecretStore, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");
      const overview: ManagedCloudPartnerAccessOverview = {
        owned: { invites: [], grants: [buildGrantFixture()] },
        sharedWithMe: [],
      };

      const first = await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        overview,
        NOW,
      );
      const firstRotatedAt =
        first.grantKeysByGrantID["grant-1"]?.rotatedAtISO;

      const laterNow = new Date("2026-04-06T08:00:00.000Z");
      const second = await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        overview,
        laterNow,
      );

      expect(second.grantKeysByGrantID["grant-1"]?.rotatedAtISO).toBe(
        firstRotatedAt,
      );
    });
  });

  describe("storeAcceptedManagedPartnerGrantKey", () => {
    it("derives the same K_grant on the partner side as the owner-side reconcile produces", async () => {
      const partnerStore = createPartnerShareSecretStoreMock();
      const ownerStore = createPartnerShareSecretStoreMock();

      // Owner side: invite issued; the shared link carries token + secret.
      const shareableLink = await storeIssuedManagedPartnerInviteKey(ownerStore, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");

      // Partner accept flow, from the link alone.
      const { inviteToken, inviteSecretHex } = parsePartnerInviteLink(shareableLink);
      await storeAcceptedManagedPartnerGrantKey(
        partnerStore,
        buildGrantFixture(),
        inviteToken,
        inviteSecretHex,
        NOW,
      );

      await reconcileManagedPartnerShareKeys(
        ownerStore,
        {
          owned: { invites: [], grants: [buildGrantFixture()] },
          sharedWithMe: [],
        },
        NOW,
      );

      const partnerSecrets = await partnerStore.readPartnerShareSecrets();
      const ownerSecrets = await ownerStore.readPartnerShareSecrets();
      expect(partnerSecrets.grantKeysByGrantID["grant-1"]?.keyHex).toBe(
        ownerSecrets.grantKeysByGrantID["grant-1"]?.keyHex,
      );
    });

    it("server-known material alone does not reproduce the owner's K_grant", async () => {
      const ownerStore = createPartnerShareSecretStoreMock();
      const serverStore = createPartnerShareSecretStoreMock();

      await storeIssuedManagedPartnerInviteKey(ownerStore, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");
      await reconcileManagedPartnerShareKeys(
        ownerStore,
        {
          owned: { invites: [], grants: [buildGrantFixture()] },
          sharedWithMe: [],
        },
        NOW,
      );

      // The server holds the token and every grant context field; without
      // the link fragment it can only guess a secret.
      await storeAcceptedManagedPartnerGrantKey(
        serverStore,
        buildGrantFixture(),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );

      const ownerSecrets = await ownerStore.readPartnerShareSecrets();
      const serverSecrets = await serverStore.readPartnerShareSecrets();
      expect(ownerSecrets.grantKeysByGrantID["grant-1"]?.keyHex).toMatch(
        /^[0-9a-f]{64}$/,
      );
      expect(serverSecrets.grantKeysByGrantID["grant-1"]?.keyHex).not.toBe(
        ownerSecrets.grantKeysByGrantID["grant-1"]?.keyHex,
      );
    });

    it("refuses an accept without the link's invite secret and stores nothing", async () => {
      const partnerStore = createPartnerShareSecretStoreMock();
      await expect(
        storeAcceptedManagedPartnerGrantKey(
          partnerStore,
          buildGrantFixture(),
          INVITE_TOKEN,
          "",
          NOW,
        ),
      ).rejects.toThrow("invalid_partner_invite");

      const secrets = await partnerStore.readPartnerShareSecrets();
      expect(secrets.grantKeysByGrantID).toEqual({});
    });

    it("refuses a grant without sourceInviteID", async () => {
      const partnerStore = createPartnerShareSecretStoreMock();
      await expect(
        storeAcceptedManagedPartnerGrantKey(
          partnerStore,
          buildGrantFixture({ sourceInviteID: null }),
          INVITE_TOKEN,
          INVITE_SECRET_HEX,
          NOW,
        ),
      ).rejects.toThrow("invalid_partner_grant_context");

      const secrets = await partnerStore.readPartnerShareSecrets();
      expect(secrets.grantKeysByGrantID["grant-1"]).toBeUndefined();
    });
  });

  describe("clearManagedPartnerGrantKey", () => {
    it("drops K_grant and the owner generation counter on revoke", async () => {
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();
      await storeAcceptedManagedPartnerGrantKey(
        partnerShareSecretStore,
        buildGrantFixture(),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );
      // Pretend an upload happened and incremented the counter.
      await reserveNextManagedPartnerProjectionGeneration(
        partnerShareSecretStore,
        "grant-1",
      );

      await clearManagedPartnerGrantKey(partnerShareSecretStore, "grant-1");

      const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
      expect(secrets.grantKeysByGrantID["grant-1"]).toBeUndefined();
      expect(secrets.ownerGenerationByGrantID["grant-1"]).toBeUndefined();
    });

    it("preserves the anti-replay marker so re-issuing the same invite stays blocked", async () => {
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();
      await storeIssuedManagedPartnerInviteKey(partnerShareSecretStore, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");
      await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        { owned: { invites: [], grants: [buildGrantFixture()] }, sharedWithMe: [] },
        NOW,
      );

      await clearManagedPartnerGrantKey(partnerShareSecretStore, "grant-1");

      const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
      expect(secrets.consumedInviteIDs["invite-1"]?.grantID).toBe("grant-1");
    });

    it("drops every pending invite key, since the server revokes them with the grant", async () => {
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();
      await storeIssuedManagedPartnerInviteKey(partnerShareSecretStore, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");
      expect(
        Object.keys(
          (await partnerShareSecretStore.readPartnerShareSecrets())
            .pendingInviteKeysByInviteID,
        ),
      ).toEqual(["invite-1"]);

      await clearManagedPartnerGrantKey(partnerShareSecretStore, "grant-1");

      const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
      expect(secrets.pendingInviteKeysByInviteID).toEqual({});
    });
  });

  describe("reserveNextManagedPartnerProjectionGeneration", () => {
    it("reserves a fresh monotonic generation per grant", async () => {
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();

      const firstForGrant1 =
        await reserveNextManagedPartnerProjectionGeneration(
          partnerShareSecretStore,
          "grant-1",
        );
      const secondForGrant1 =
        await reserveNextManagedPartnerProjectionGeneration(
          partnerShareSecretStore,
          "grant-1",
        );
      const firstForGrant2 =
        await reserveNextManagedPartnerProjectionGeneration(
          partnerShareSecretStore,
          "grant-2",
        );

      expect(firstForGrant1).toBe(1);
      expect(secondForGrant1).toBe(2);
      expect(firstForGrant2).toBe(1);

      const persisted =
        await partnerShareSecretStore.readPartnerShareSecrets();
      expect(persisted.ownerGenerationByGrantID).toEqual({
        "grant-1": 2,
        "grant-2": 1,
      });
    });
  });

  describe("upload + load round trip with rotated K_grant", () => {
    it("uploads and decrypts a managed partner projection using K_grant, not K_invite", async () => {
      const syncSecretStore = await setupConnectedSyncSecrets();
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();

      // Owner side: issue + reconcile rotates K_invite → K_grant.
      await storeIssuedManagedPartnerInviteKey(partnerShareSecretStore, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");
      await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        { owned: { invites: [], grants: [buildGrantFixture()] }, sharedWithMe: [] },
        NOW,
      );

      let uploadedProjectionBody: Record<string, unknown> | null = null;
      global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.includes("/account/partner/grants/grant-1/projection") &&
          init?.method === "PUT"
        ) {
          uploadedProjectionBody = JSON.parse(String(init.body));
          return new Response(
            JSON.stringify({
              grant_id: "grant-1",
              access_level: "summary",
              schema_version: uploadedProjectionBody?.schema_version,
              checksum_sha256: uploadedProjectionBody?.checksum_sha256,
              ciphertext_base64: uploadedProjectionBody?.ciphertext_base64,
              ciphertext_size: uploadedProjectionBody?.ciphertext_size,
              created_at: "2026-04-05T08:00:00.000Z",
              updated_at: "2026-04-05T08:00:00.000Z",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/account/partner/grants/grant-1/projection")) {
          return new Response(
            JSON.stringify({
              grant_id: "grant-1",
              access_level: "summary",
              schema_version: uploadedProjectionBody?.schema_version,
              checksum_sha256: uploadedProjectionBody?.checksum_sha256,
              ciphertext_base64: uploadedProjectionBody?.ciphertext_base64,
              ciphertext_size: uploadedProjectionBody?.ciphertext_size,
              created_at: "2026-04-05T08:00:00.000Z",
              updated_at: "2026-04-05T08:00:00.000Z",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        throw new Error(`Unexpected fetch ${url}`);
      }) as typeof fetch;

      const projection = buildProjectionPayload();

      await expect(
        uploadManagedPartnerProjection(syncSecretStore, "managed", {
          projection,
          partnerShareSecretStore,
          listedSourceInviteID: "invite-1",
        }),
      ).resolves.toEqual({
        ok: true,
        value: expect.objectContaining({ grantID: "grant-1" }),
      });
      expect(
        (uploadedProjectionBody as Record<string, unknown> | null)?.source_invite_id,
      ).toBe("invite-1");

      await expect(
        loadManagedPartnerProjection(
          syncSecretStore,
          partnerShareSecretStore,
          "managed",
          { id: "grant-1" },
        ),
      ).resolves.toEqual({
        ok: true,
        value: expect.objectContaining({
          grantID: "grant-1",
          ownerAccountID: "owner-1",
          generation: 1,
        }),
      });
    });

    it("refuses ciphertext encrypted under K_invite once K_grant is in place", async () => {
      const syncSecretStore = await setupConnectedSyncSecrets();
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();
      await storeAcceptedManagedPartnerGrantKey(
        partnerShareSecretStore,
        buildGrantFixture(),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );

      // Server returns ciphertext that was (maliciously) encrypted with the
      // raw invite-derived key — i.e. the attacker still has K_invite but the
      // partner has rotated to K_grant. Decryption MUST fail.
      const wrongKey = derivePartnerShareKeyHex(INVITE_TOKEN, INVITE_SECRET_HEX);
      const envelope = encryptPartnerSharedProjection(
        wrongKey,
        buildProjectionPayload(),
      );
      global.fetch = jest.fn(
        async () =>
          new Response(
            JSON.stringify({
              grant_id: envelope.grantID,
              access_level: envelope.accessLevel,
              schema_version: envelope.schemaVersion,
              checksum_sha256: envelope.checksumSHA256,
              ciphertext_base64: envelope.ciphertextBase64,
              ciphertext_size: envelope.ciphertextSize,
              created_at: "2026-04-05T08:00:00.000Z",
              updated_at: "2026-04-05T08:00:00.000Z",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ) as typeof fetch;

      await expect(
        loadManagedPartnerProjection(
          syncSecretStore,
          partnerShareSecretStore,
          "managed",
          { id: "grant-1" },
        ),
      ).resolves.toEqual({
        ok: false,
        errorCode: "invalid_partner_projection",
      });
    });

    it("refuses upload after revoke (K_grant gone → share_key_unavailable)", async () => {
      const syncSecretStore = await setupConnectedSyncSecrets();
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();
      await storeAcceptedManagedPartnerGrantKey(
        partnerShareSecretStore,
        buildGrantFixture(),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );

      await clearManagedPartnerGrantKey(partnerShareSecretStore, "grant-1");

      // No fetch mock — if the code path ever reached the network we'd see a
      // hard error from the default fetch, which would surface here.
      await expect(
        uploadManagedPartnerProjection(syncSecretStore, "managed", {
          projection: buildProjectionPayload(),
          partnerShareSecretStore,
          listedSourceInviteID: "invite-1",
        }),
      ).resolves.toEqual({
        ok: false,
        errorCode: "share_key_unavailable",
      });
    });

    it("forwards a rate-limited upload with the server's Retry-After", async () => {
      const syncSecretStore = await setupConnectedSyncSecrets();
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();
      await storeOwnerGrantKeyFixture(partnerShareSecretStore);
      global.fetch = jest.fn(
        async () =>
          new Response(JSON.stringify({ error: "rate_limited" }), {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "12" },
          }),
      ) as typeof fetch;

      await expect(
        uploadManagedPartnerProjection(syncSecretStore, "managed", {
          projection: buildProjectionPayload(),
          partnerShareSecretStore,
          listedSourceInviteID: "invite-1",
        }),
      ).resolves.toEqual({
        ok: false,
        errorCode: "rate_limited",
        retryAfterSeconds: 12,
      });
    });
  });

  describe("projection key context (MNG-29 source_invite_id)", () => {
    async function setupOwnerWithGrantKey() {
      const syncSecretStore = await setupConnectedSyncSecrets();
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();
      await storeOwnerGrantKeyFixture(partnerShareSecretStore);
      return { syncSecretStore, partnerShareSecretStore };
    }

    it.each([null, "", "   "])(
      "refuses a legacy grant listed with source invite %p without touching the network",
      async (listedSourceInviteID) => {
        const { syncSecretStore, partnerShareSecretStore } =
          await setupOwnerWithGrantKey();
        const fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(
          uploadManagedPartnerProjection(syncSecretStore, "managed", {
            projection: buildProjectionPayload(),
            partnerShareSecretStore,
            listedSourceInviteID,
          }),
        ).resolves.toEqual({ ok: false, errorCode: "partner_grant_rekeyed" });
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it("refuses when the listed key context no longer matches the stored key's", async () => {
      const { syncSecretStore, partnerShareSecretStore } =
        await setupOwnerWithGrantKey();
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(
        uploadManagedPartnerProjection(syncSecretStore, "managed", {
          projection: buildProjectionPayload(),
          partnerShareSecretStore,
          listedSourceInviteID: "invite-2",
        }),
      ).resolves.toEqual({ ok: false, errorCode: "partner_grant_rekeyed" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("forwards the server's 409 partner_grant_rekeyed", async () => {
      const { syncSecretStore, partnerShareSecretStore } =
        await setupOwnerWithGrantKey();
      global.fetch = jest.fn(
        async () =>
          new Response(JSON.stringify({ error: "partner_grant_rekeyed" }), {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }),
      ) as typeof fetch;

      await expect(
        uploadManagedPartnerProjection(syncSecretStore, "managed", {
          projection: buildProjectionPayload(),
          partnerShareSecretStore,
          listedSourceInviteID: "invite-1",
        }),
      ).resolves.toEqual({ ok: false, errorCode: "partner_grant_rekeyed" });
    });

    it("flags a live grant whose local key was derived under another invite", () => {
      const overview: ManagedCloudPartnerAccessOverview = {
        owned: {
          invites: [],
          grants: [
            buildGrantFixture({ id: "grant-1", sourceInviteID: "invite-1" }),
            buildGrantFixture({ id: "grant-2", sourceInviteID: "invite-2" }),
            buildGrantFixture({ id: "grant-3", sourceInviteID: "invite-3" }),
            buildGrantFixture({ id: "grant-4", sourceInviteID: null }),
          ],
        },
        sharedWithMe: [],
      };
      const grantKey = (sourceInviteID: string) => ({
        keyHex: "ab".repeat(32),
        rotatedAtISO: NOW.toISOString(),
        sourceInviteID,
      });

      expect(
        listManagedPartnerGrantsNeedingReshare(overview, {
          grantKeysByGrantID: {
            "grant-1": grantKey("invite-1"),
            "grant-2": grantKey("invite-old"),
            "grant-3": grantKey(""),
          },
        }),
      ).toEqual(["grant-2", "grant-3", "grant-4"]);
    });

    it("flags only live grants without a source invite as needing a re-share", () => {
      expect(isManagedPartnerGrantReshareRequired(buildGrantFixture())).toBe(false);
      expect(
        isManagedPartnerGrantReshareRequired(buildGrantFixture({ sourceInviteID: null })),
      ).toBe(true);
      expect(
        isManagedPartnerGrantReshareRequired(buildGrantFixture({ sourceInviteID: " " })),
      ).toBe(true);
      expect(
        isManagedPartnerGrantReshareRequired(
          buildGrantFixture({ sourceInviteID: null, revokedAt: "2026-04-06T08:00:00.000Z" }),
        ),
      ).toBe(false);
    });
  });

  describe("partner-side anti-replay (F5)", () => {
    function mockProjectionGetReturnsPayload(
      shareKey: string,
      payload: PartnerSharedProjectionPayload,
    ) {
      const envelope = encryptPartnerSharedProjection(shareKey, payload);
      global.fetch = jest.fn(
        async () =>
          new Response(
            JSON.stringify({
              grant_id: envelope.grantID,
              access_level: envelope.accessLevel,
              schema_version: envelope.schemaVersion,
              checksum_sha256: envelope.checksumSHA256,
              ciphertext_base64: envelope.ciphertextBase64,
              ciphertext_size: envelope.ciphertextSize,
              created_at: "2026-04-05T08:00:00.000Z",
              updated_at: "2026-04-05T08:00:00.000Z",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ) as typeof fetch;
    }

    async function setupPartnerGrant() {
      const syncSecretStore = await setupConnectedSyncSecrets();
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();
      await storeAcceptedManagedPartnerGrantKey(
        partnerShareSecretStore,
        buildGrantFixture(),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );
      const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
      const shareKey = secrets.grantKeysByGrantID["grant-1"]!.keyHex;
      return { syncSecretStore, partnerShareSecretStore, shareKey };
    }

    it("records the first observed generation as the last-seen marker", async () => {
      const { syncSecretStore, partnerShareSecretStore, shareKey } =
        await setupPartnerGrant();
      mockProjectionGetReturnsPayload(
        shareKey,
        buildProjectionPayload({ generation: 7 }),
      );

      await expect(
        loadManagedPartnerProjection(
          syncSecretStore,
          partnerShareSecretStore,
          "managed",
          { id: "grant-1" },
        ),
      ).resolves.toEqual({
        ok: true,
        value: expect.objectContaining({ generation: 7 }),
      });
      const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
      expect(secrets.partnerLastSeenGenerationByGrantID["grant-1"]).toBe(7);
    });

    it("rejects a regression below the last-seen marker", async () => {
      const { syncSecretStore, partnerShareSecretStore, shareKey } =
        await setupPartnerGrant();
      await partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
        record.partnerLastSeenGenerationByGrantID["grant-1"] = 5;
      });
      mockProjectionGetReturnsPayload(
        shareKey,
        buildProjectionPayload({ generation: 3 }),
      );

      await expect(
        loadManagedPartnerProjection(
          syncSecretStore,
          partnerShareSecretStore,
          "managed",
          { id: "grant-1" },
        ),
      ).resolves.toEqual({
        ok: false,
        errorCode: "invalid_partner_projection",
      });
      const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
      expect(secrets.partnerLastSeenGenerationByGrantID["grant-1"]).toBe(5);
    });

    it("drops the floor when a re-share replaces the key under a new invite", async () => {
      const { syncSecretStore, partnerShareSecretStore } = await setupPartnerGrant();
      await partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
        record.partnerLastSeenGenerationByGrantID["grant-1"] = 9;
        record.partnerLastSeenInviteIDByGrantID["grant-1"] = "invite-1";
      });

      await storeAcceptedManagedPartnerGrantKey(
        partnerShareSecretStore,
        buildGrantFixture({ sourceInviteID: "invite-2" }),
        INVITE_TOKEN,
        "22".repeat(32),
        NOW,
      );
      const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
      expect(secrets.partnerLastSeenGenerationByGrantID["grant-1"]).toBeUndefined();
      expect(secrets.partnerLastSeenInviteIDByGrantID["grant-1"]).toBeUndefined();

      mockProjectionGetReturnsPayload(
        secrets.grantKeysByGrantID["grant-1"]!.keyHex,
        buildProjectionPayload({ generation: 1 }),
      );
      await expect(
        loadManagedPartnerProjection(syncSecretStore, partnerShareSecretStore, "managed", {
          id: "grant-1",
          sourceInviteID: "invite-2",
        }),
      ).resolves.toEqual({ ok: true, value: expect.objectContaining({ generation: 1 }) });
      const after = await partnerShareSecretStore.readPartnerShareSecrets();
      expect(after.partnerLastSeenGenerationByGrantID["grant-1"]).toBe(1);
      expect(after.partnerLastSeenInviteIDByGrantID["grant-1"]).toBe("invite-2");
    });

    it("keeps the floor when the same invite is accepted again", async () => {
      const { partnerShareSecretStore } = await setupPartnerGrant();
      await partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
        record.partnerLastSeenGenerationByGrantID["grant-1"] = 9;
        record.partnerLastSeenInviteIDByGrantID["grant-1"] = "invite-1";
      });

      await storeAcceptedManagedPartnerGrantKey(
        partnerShareSecretStore,
        buildGrantFixture(),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );
      const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
      expect(secrets.partnerLastSeenGenerationByGrantID["grant-1"]).toBe(9);
    });

    it("ignores a floor recorded under another invite than the key's", async () => {
      const { syncSecretStore, partnerShareSecretStore, shareKey } =
        await setupPartnerGrant();
      await partnerShareSecretStore.mutatePartnerShareSecrets((record) => {
        record.partnerLastSeenGenerationByGrantID["grant-1"] = 9;
        record.partnerLastSeenInviteIDByGrantID["grant-1"] = "invite-0";
      });
      mockProjectionGetReturnsPayload(shareKey, buildProjectionPayload({ generation: 2 }));

      await expect(
        loadManagedPartnerProjection(syncSecretStore, partnerShareSecretStore, "managed", {
          id: "grant-1",
        }),
      ).resolves.toEqual({ ok: true, value: expect.objectContaining({ generation: 2 }) });
      const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
      expect(secrets.partnerLastSeenGenerationByGrantID["grant-1"]).toBe(2);
      expect(secrets.partnerLastSeenInviteIDByGrantID["grant-1"]).toBe("invite-1");
    });

    it("answers partner_grant_rekeyed without a fetch when the listing names a newer invite", async () => {
      const { syncSecretStore, partnerShareSecretStore } = await setupPartnerGrant();
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(
        loadManagedPartnerProjection(syncSecretStore, partnerShareSecretStore, "managed", {
          id: "grant-1",
          sourceInviteID: "invite-2",
        }),
      ).resolves.toEqual({ ok: false, errorCode: "partner_grant_rekeyed" });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("grant direction", () => {
    it("records a received key as the partner's, under the partner account", async () => {
      const store = createPartnerShareSecretStoreMock();
      await storeAcceptedManagedPartnerGrantKey(
        store,
        buildGrantFixture(),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );

      const secrets = await store.readPartnerShareSecrets();
      expect(secrets.grantKeysByGrantID["grant-1"]).toEqual(
        expect.objectContaining({ role: "partner", accountID: "partner-1" }),
      );
    });

    it("records a rotated owner key as the owner's, under the owner account", async () => {
      const store = createPartnerShareSecretStoreMock();
      await storeIssuedManagedPartnerInviteKey(store, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");

      await reconcileManagedPartnerShareKeys(
        store,
        { owned: { invites: [], grants: [buildGrantFixture()] }, sharedWithMe: [] },
        NOW,
      );

      const secrets = await store.readPartnerShareSecrets();
      expect(secrets.grantKeysByGrantID["grant-1"]).toEqual(
        expect.objectContaining({ role: "owner", accountID: "owner-1" }),
      );
    });

    it("never encrypts an upload under a received key, whatever the listing says", async () => {
      const syncSecretStore = await setupConnectedSyncSecrets();
      const store = createPartnerShareSecretStoreMock();
      await storeAcceptedManagedPartnerGrantKey(
        store,
        buildGrantFixture(),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(
        uploadManagedPartnerProjection(syncSecretStore, "managed", {
          projection: buildProjectionPayload({ ownerAccountID: "partner-1" }),
          partnerShareSecretStore: store,
          listedSourceInviteID: "invite-1",
        }),
      ).resolves.toEqual({ ok: false, errorCode: "share_key_unavailable" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses an owner key created under another account than the projection's", async () => {
      const syncSecretStore = await setupConnectedSyncSecrets();
      const store = createPartnerShareSecretStoreMock();
      await storeOwnerGrantKeyFixture(store);
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      await expect(
        uploadManagedPartnerProjection(syncSecretStore, "managed", {
          projection: buildProjectionPayload({ ownerAccountID: "owner-2" }),
          partnerShareSecretStore: store,
          listedSourceInviteID: "invite-1",
        }),
      ).resolves.toEqual({ ok: false, errorCode: "share_key_unavailable" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("uploads under a key written before the side was recorded", async () => {
      const syncSecretStore = await setupConnectedSyncSecrets();
      const store = createPartnerShareSecretStoreMock();
      await storeAcceptedManagedPartnerGrantKey(
        store,
        buildGrantFixture(),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );
      await store.mutatePartnerShareSecrets((record) => {
        delete record.grantKeysByGrantID["grant-1"]!.role;
        delete record.grantKeysByGrantID["grant-1"]!.accountID;
      });
      const fetchMock = jest.fn(
        async () =>
          new Response(JSON.stringify({ error: "rate_limited" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      await uploadManagedPartnerProjection(syncSecretStore, "managed", {
        projection: buildProjectionPayload(),
        partnerShareSecretStore: store,
        listedSourceInviteID: "invite-1",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("never replaces a received key with an owner key for the same grant id", async () => {
      const store = createPartnerShareSecretStoreMock();
      await storeAcceptedManagedPartnerGrantKey(
        store,
        buildGrantFixture({ sourceInviteID: "invite-0" }),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );
      const received = (await store.readPartnerShareSecrets()).grantKeysByGrantID["grant-1"];
      await storeIssuedManagedPartnerInviteKey(store, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");

      await reconcileManagedPartnerShareKeys(
        store,
        { owned: { invites: [], grants: [buildGrantFixture()] }, sharedWithMe: [] },
        NOW,
      );

      const secrets = await store.readPartnerShareSecrets();
      expect(secrets.grantKeysByGrantID["grant-1"]).toEqual(received);
    });
  });

  describe("owner re-share under a reused grant id", () => {
    it("replaces the key derived under the earlier invite once the new invite's key is here", async () => {
      const store = createPartnerShareSecretStoreMock();
      await storeIssuedManagedPartnerInviteKey(store, {
        invite: buildInviteFixture(),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
      }, "summary");
      await reconcileManagedPartnerShareKeys(
        store,
        { owned: { invites: [], grants: [buildGrantFixture()] }, sharedWithMe: [] },
        NOW,
      );
      const firstKey = (await store.readPartnerShareSecrets()).grantKeysByGrantID["grant-1"];

      await storeIssuedManagedPartnerInviteKey(store, {
        invite: buildInviteFixture({ id: "invite-2" }),
        inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}-2`,
      }, "full");
      await reconcileManagedPartnerShareKeys(
        store,
        {
          owned: {
            invites: [],
            grants: [buildGrantFixture({ sourceInviteID: "invite-2", accessLevel: "full" })],
          },
          sharedWithMe: [],
        },
        NOW,
      );

      const secrets = await store.readPartnerShareSecrets();
      const replaced = secrets.grantKeysByGrantID["grant-1"];
      expect(replaced?.sourceInviteID).toBe("invite-2");
      expect(replaced?.keyHex).not.toBe(firstKey?.keyHex);
      expect(replaced).toEqual(
        expect.objectContaining({ accessLevel: "full", role: "owner", accountID: "owner-1" }),
      );
      expect(secrets.consumedInviteIDs["invite-2"]?.grantID).toBe("grant-1");
      expect(secrets.pendingInviteKeysByInviteID["invite-2"]).toBeUndefined();
    });
  });

  describe("received grant revoked", () => {
    it("purges the key and replay markers of a received grant listed as revoked", async () => {
      const store = createPartnerShareSecretStoreMock();
      await storeAcceptedManagedPartnerGrantKey(
        store,
        buildGrantFixture(),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );
      await storeAcceptedManagedPartnerGrantKey(
        store,
        buildGrantFixture({ id: "grant-2" }),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );
      await store.mutatePartnerShareSecrets((record) => {
        record.partnerLastSeenGenerationByGrantID["grant-1"] = 4;
        record.partnerLastSeenInviteIDByGrantID["grant-1"] = "invite-1";
      });

      await reconcileManagedPartnerShareKeys(
        store,
        {
          owned: { invites: [], grants: [] },
          sharedWithMe: [buildGrantFixture({ revokedAt: "2026-04-06T00:00:00.000Z" })],
        },
        NOW,
      );

      const secrets = await store.readPartnerShareSecrets();
      expect(secrets.grantKeysByGrantID["grant-1"]).toBeUndefined();
      expect(secrets.partnerLastSeenGenerationByGrantID["grant-1"]).toBeUndefined();
      expect(secrets.partnerLastSeenInviteIDByGrantID["grant-1"]).toBeUndefined();
      // Missing from the listing is not revoked: the key stays.
      expect(secrets.grantKeysByGrantID["grant-2"]).toBeDefined();
    });

    it("keeps a key accepted under a newer invite than the revoked row names", async () => {
      const store = createPartnerShareSecretStoreMock();
      await storeAcceptedManagedPartnerGrantKey(
        store,
        buildGrantFixture({ sourceInviteID: "invite-2" }),
        INVITE_TOKEN,
        INVITE_SECRET_HEX,
        NOW,
      );

      await reconcileManagedPartnerShareKeys(
        store,
        {
          owned: { invites: [], grants: [] },
          sharedWithMe: [buildGrantFixture({ revokedAt: "2026-04-06T00:00:00.000Z" })],
        },
        NOW,
      );

      const secrets = await store.readPartnerShareSecrets();
      expect(secrets.grantKeysByGrantID["grant-1"]?.sourceInviteID).toBe("invite-2");
    });

    it("keeps an owner key even if the listing shows the grant revoked as received", async () => {
      const store = createPartnerShareSecretStoreMock();
      await storeOwnerGrantKeyFixture(store);

      await reconcileManagedPartnerShareKeys(
        store,
        {
          owned: { invites: [], grants: [] },
          sharedWithMe: [buildGrantFixture({ revokedAt: "2026-04-06T00:00:00.000Z" })],
        },
        NOW,
      );

      const secrets = await store.readPartnerShareSecrets();
      expect(secrets.grantKeysByGrantID["grant-1"]?.role).toBe("owner");
    });
  });

  describe("server ids that name Object members", () => {
    it.each(["__proto__", "constructor", "toString"])(
      "treats grant id %p as having no key instead of throwing",
      async (grantID) => {
        const syncSecretStore = await setupConnectedSyncSecrets();
        const store = createPartnerShareSecretStoreMock();
        const fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        await expect(
          uploadManagedPartnerProjection(syncSecretStore, "managed", {
            projection: buildProjectionPayload({ grantID }),
            partnerShareSecretStore: store,
            listedSourceInviteID: "invite-1",
          }),
        ).resolves.toEqual({ ok: false, errorCode: "share_key_unavailable" });
        await expect(
          loadManagedPartnerProjection(syncSecretStore, store, "managed", { id: grantID }),
        ).resolves.toEqual({ ok: false, errorCode: "share_key_unavailable" });
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it.each(["__proto__", "constructor"])(
      "rotates and stores a key for grant id %p",
      async (grantID) => {
        const store = createPartnerShareSecretStoreMock();
        await storeIssuedManagedPartnerInviteKey(store, {
          invite: buildInviteFixture(),
          inviteURL: `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`,
        }, "summary");

        await reconcileManagedPartnerShareKeys(
          store,
          { owned: { invites: [], grants: [buildGrantFixture({ id: grantID })] }, sharedWithMe: [] },
          NOW,
        );

        const secrets = await store.readPartnerShareSecrets();
        expect(Object.hasOwn(secrets.grantKeysByGrantID, grantID)).toBe(true);
        expect(secrets.grantKeysByGrantID[grantID]?.role).toBe("owner");
      },
    );
  });
});
