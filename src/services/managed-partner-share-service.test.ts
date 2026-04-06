import {
  createPartnerShareSecretStore,
  type PartnerShareSecretStoreBackend,
} from "../security/partner-share-secret-store";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  loadManagedPartnerProjection,
  reconcileManagedPartnerShareKeys,
  storeAcceptedManagedPartnerGrantKey,
  storeIssuedManagedPartnerInviteKey,
  uploadManagedPartnerProjection,
} from "./managed-partner-share-service";
import type { ManagedCloudPartnerAccessOverview } from "../sync/managed-cloud-api-client";
import type { PartnerSharedProjectionPayload } from "../models/partner-share";

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

describe("managed-partner-share-service", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("stores pending invite keys and reconciles them into grant keys", async () => {
    const partnerShareSecretStore = createPartnerShareSecretStoreMock();

    await storeIssuedManagedPartnerInviteKey(partnerShareSecretStore, {
      invite: {
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
      },
      inviteURL: "ovumcy://backup-sync?invite_token=invite-token-1",
    });

    const overview: ManagedCloudPartnerAccessOverview = {
      owned: {
        invites: [],
        grants: [
          {
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
          },
        ],
      },
      sharedWithMe: [],
    };

    const reconciled = await reconcileManagedPartnerShareKeys(
      partnerShareSecretStore,
      overview,
    );

    expect(reconciled.pendingInviteKeysByInviteID["invite-1"]).toBeUndefined();
    expect(reconciled.grantKeysByGrantID["grant-1"]).toEqual(expect.any(String));
  });

  it("drops pending invite keys once the invite is no longer active", async () => {
    const partnerShareSecretStore = createPartnerShareSecretStoreMock();

    await storeIssuedManagedPartnerInviteKey(partnerShareSecretStore, {
      invite: {
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
      },
      inviteURL: "ovumcy://backup-sync?invite_token=invite-token-1",
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
    );

    expect(reconciled.pendingInviteKeysByInviteID["invite-1"]).toBeUndefined();
  });

  it("uploads and decrypts a managed partner projection with the derived grant key", async () => {
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
    });
    const partnerShareSecretStore = createPartnerShareSecretStoreMock();
    await storeAcceptedManagedPartnerGrantKey(
      partnerShareSecretStore,
      "grant-1",
      "invite-token-1",
    );

    let uploadedProjectionBody: Record<string, unknown> | null = null;
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/account/partner/grants/grant-1/projection") && init?.method === "PUT") {
        uploadedProjectionBody = JSON.parse(String(init.body));
        return new Response(JSON.stringify({
          grant_id: "grant-1",
          access_level: "summary",
          schema_version: uploadedProjectionBody?.schema_version,
          checksum_sha256: uploadedProjectionBody?.checksum_sha256,
          ciphertext_base64: uploadedProjectionBody?.ciphertext_base64,
          ciphertext_size: uploadedProjectionBody?.ciphertext_size,
          created_at: "2026-04-05T08:00:00.000Z",
          updated_at: "2026-04-05T08:00:00.000Z",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/account/partner/grants/grant-1/projection")) {
        return new Response(JSON.stringify({
          grant_id: "grant-1",
          access_level: "summary",
          schema_version: uploadedProjectionBody?.schema_version,
          checksum_sha256: uploadedProjectionBody?.checksum_sha256,
          ciphertext_base64: uploadedProjectionBody?.ciphertext_base64,
          ciphertext_size: uploadedProjectionBody?.ciphertext_size,
          created_at: "2026-04-05T08:00:00.000Z",
          updated_at: "2026-04-05T08:00:00.000Z",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    }) as typeof fetch;

    const projection: PartnerSharedProjectionPayload = {
      schemaVersion: 1,
      generatedAt: "2026-04-05T08:00:00.000Z",
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
    };

    await expect(
      uploadManagedPartnerProjection(syncSecretStore, "managed", {
        projection,
        partnerShareSecretStore,
      }),
    ).resolves.toEqual({
      ok: true,
      value: expect.objectContaining({
        grantID: "grant-1",
      }),
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
      }),
    });
  });
});
