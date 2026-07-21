import {
  createPartnerShareSecretStore,
  type PartnerShareSecretStoreBackend,
} from "../security/partner-share-secret-store";
import {
  derivePartnerShareKeyHex,
  deriveGrantSubkeyHex,
  encryptPartnerSharedProjection,
} from "../security/partner-share-crypto";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  clearManagedPartnerGrantKey,
  loadManagedPartnerProjection,
  reconcileManagedPartnerShareKeys,
  reserveNextManagedPartnerProjectionGeneration,
  storeAcceptedManagedPartnerGrantKey,
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
      usageGoal: "health",
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

  describe("reconcileManagedPartnerShareKeys", () => {
    it("rotates pending invite keys into per-grant subkeys and clears K_invite", async () => {
      const partnerShareSecretStore = createPartnerShareSecretStoreMock();

      await storeIssuedManagedPartnerInviteKey(partnerShareSecretStore, {
        invite: buildInviteFixture(),
        inviteURL: `ovumcy://backup-sync?invite_token=${INVITE_TOKEN}`,
      });

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
      const inviteKeyHex = derivePartnerShareKeyHex(INVITE_TOKEN);
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
        inviteURL: `ovumcy://backup-sync?invite_token=${INVITE_TOKEN}`,
      });

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
        inviteURL: `ovumcy://backup-sync?invite_token=${INVITE_TOKEN}`,
      });

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
          derivePartnerShareKeyHex(INVITE_TOKEN);
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
        inviteURL: `ovumcy://backup-sync?invite_token=${INVITE_TOKEN}`,
      });
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

      // Partner accept flow.
      await storeAcceptedManagedPartnerGrantKey(
        partnerStore,
        buildGrantFixture(),
        INVITE_TOKEN,
        NOW,
      );

      // Owner side: invite issued, then reconciled against the same grant.
      await storeIssuedManagedPartnerInviteKey(ownerStore, {
        invite: buildInviteFixture(),
        inviteURL: `ovumcy://backup-sync?invite_token=${INVITE_TOKEN}`,
      });
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

    it("refuses a grant without sourceInviteID", async () => {
      const partnerStore = createPartnerShareSecretStoreMock();
      await expect(
        storeAcceptedManagedPartnerGrantKey(
          partnerStore,
          buildGrantFixture({ sourceInviteID: null }),
          INVITE_TOKEN,
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
        inviteURL: `ovumcy://backup-sync?invite_token=${INVITE_TOKEN}`,
      });
      await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        { owned: { invites: [], grants: [buildGrantFixture()] }, sharedWithMe: [] },
        NOW,
      );

      await clearManagedPartnerGrantKey(partnerShareSecretStore, "grant-1");

      const secrets = await partnerShareSecretStore.readPartnerShareSecrets();
      expect(secrets.consumedInviteIDs["invite-1"]?.grantID).toBe("grant-1");
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
        inviteURL: `ovumcy://backup-sync?invite_token=${INVITE_TOKEN}`,
      });
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
        }),
      ).resolves.toEqual({
        ok: true,
        value: expect.objectContaining({ grantID: "grant-1" }),
      });

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
        NOW,
      );

      // Server returns ciphertext that was (maliciously) encrypted with the
      // raw invite-derived key — i.e. the attacker still has K_invite but the
      // partner has rotated to K_grant. Decryption MUST fail.
      const wrongKey = derivePartnerShareKeyHex(INVITE_TOKEN);
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
        NOW,
      );

      await clearManagedPartnerGrantKey(partnerShareSecretStore, "grant-1");

      // No fetch mock — if the code path ever reached the network we'd see a
      // hard error from the default fetch, which would surface here.
      await expect(
        uploadManagedPartnerProjection(syncSecretStore, "managed", {
          projection: buildProjectionPayload(),
          partnerShareSecretStore,
        }),
      ).resolves.toEqual({
        ok: false,
        errorCode: "share_key_unavailable",
      });
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
  });
});
