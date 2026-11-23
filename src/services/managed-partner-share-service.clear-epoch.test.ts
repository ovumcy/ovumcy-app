import {
  createPartnerShareSecretStore,
  PartnerShareStoreClearedError,
  type PartnerShareSecretStoreBackend,
} from "../security/partner-share-secret-store";
import {
  reconcileManagedPartnerShareKeys,
  reserveNextManagedPartnerProjectionGeneration,
  storeAcceptedManagedPartnerGrantKey,
  storeIssuedManagedPartnerInviteKey,
} from "./managed-partner-share-service";
import type {
  ManagedCloudPartnerAccessGrant,
  ManagedCloudPartnerInvite,
} from "../sync/managed-cloud-api-client";

const STORE_KEY = "ovumcy.partner-share-secrets-v2";
const INVITE_TOKEN = "invite-token-1-fixture-padding";
const INVITE_URL = `https://invite.ovumcy.cloud/backup-sync?invite_token=${INVITE_TOKEN}`;
const INVITE_SECRET_HEX = "11".repeat(32);
const NOW = new Date("2026-04-05T08:00:00.000Z");

function createStore() {
  const state = new Map<string, string>();
  const backend: PartnerShareSecretStoreBackend = {
    async deleteItem(key) {
      state.delete(key);
    },
    async getItem(key) {
      return state.get(key) ?? null;
    },
    async setItem(key, value) {
      state.set(key, value);
    },
  };
  return { state, store: createPartnerShareSecretStore(backend) };
}

const invite: ManagedCloudPartnerInvite = {
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
};

const grant: ManagedCloudPartnerAccessGrant = {
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
};

// Each case captures the epoch where its flow would start the network call,
// then clears the store as a disconnect landing mid-request would.
describe("partner-share writers started before a store clear", () => {
  it("drops an issued invite key", async () => {
    const { state, store } = createStore();
    const clearEpoch = store.readPartnerShareClearEpoch();
    await store.clearPartnerShareSecrets();

    const issued = storeIssuedManagedPartnerInviteKey(
      store,
      { invite, inviteURL: INVITE_URL },
      "summary",
      clearEpoch,
    );

    await expect(issued).rejects.toBeInstanceOf(PartnerShareStoreClearedError);
    expect(state.has(STORE_KEY)).toBe(false);
  });

  it("drops an accepted grant key", async () => {
    const { state, store } = createStore();
    const clearEpoch = store.readPartnerShareClearEpoch();
    await store.clearPartnerShareSecrets();

    const accepted = storeAcceptedManagedPartnerGrantKey(
      store,
      grant,
      INVITE_TOKEN,
      INVITE_SECRET_HEX,
      NOW,
      clearEpoch,
    );

    await expect(accepted).rejects.toBeInstanceOf(PartnerShareStoreClearedError);
    expect(state.has(STORE_KEY)).toBe(false);
  });

  it("drops a reconcile and a generation reserve", async () => {
    const { state, store } = createStore();
    const clearEpoch = store.readPartnerShareClearEpoch();
    await store.clearPartnerShareSecrets();

    await expect(
      reconcileManagedPartnerShareKeys(
        store,
        { owned: { invites: [], grants: [grant] }, sharedWithMe: [] },
        NOW,
        clearEpoch,
      ),
    ).rejects.toBeInstanceOf(PartnerShareStoreClearedError);
    await expect(
      reserveNextManagedPartnerProjectionGeneration(store, "grant-1", clearEpoch),
    ).rejects.toBeInstanceOf(PartnerShareStoreClearedError);
    expect(state.has(STORE_KEY)).toBe(false);
  });

  it("keeps writing for a flow that started after the clear", async () => {
    const { store } = createStore();
    await store.clearPartnerShareSecrets();
    const clearEpoch = store.readPartnerShareClearEpoch();

    await storeAcceptedManagedPartnerGrantKey(
      store,
      grant,
      INVITE_TOKEN,
      INVITE_SECRET_HEX,
      NOW,
      clearEpoch,
    );

    const secrets = await store.readPartnerShareSecrets();
    expect(secrets.grantKeysByGrantID["grant-1"]?.role).toBe("partner");
  });
});
