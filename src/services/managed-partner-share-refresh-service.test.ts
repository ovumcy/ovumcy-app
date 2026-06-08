import {
  createPartnerShareSecretStore,
  type PartnerShareSecretStoreBackend,
} from "../security/partner-share-secret-store";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { refreshManagedPartnerSharedProjectionsOnAppActive } from "./managed-partner-share-refresh-service";

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

describe("managed-partner-share-refresh-service", () => {
  it("skips refresh when there are no pending invites or grants", async () => {
    const partnerShareSecretStore = createPartnerShareSecretStoreMock();
    const storage = createLocalAppStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();
    const syncPartnerProjections = jest.fn();

    await expect(
      refreshManagedPartnerSharedProjectionsOnAppActive(
        storage,
        syncSecretStore,
        partnerShareSecretStore,
        new Date("2026-04-06T10:00:00.000Z"),
        syncPartnerProjections,
      ),
    ).resolves.toEqual({
      skipped: true,
      syncedCount: 0,
    });

    expect(syncPartnerProjections).not.toHaveBeenCalled();
  });

  it("syncs projections when there is a pending invite key to reconcile", async () => {
    const partnerShareSecretStore = createPartnerShareSecretStoreMock();
    const storage = createLocalAppStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();
    const syncPartnerProjections = jest.fn().mockResolvedValue({
      skipped: false,
      syncedCount: 1,
    });

    await partnerShareSecretStore.writePartnerShareSecrets({
      grantKeysByGrantID: {},
      pendingInviteKeysByInviteID: {
        "invite-1": "derived-key-1",
      },
      consumedInviteIDs: {},
      ownerGenerationByGrantID: {},
      partnerLastSeenGenerationByGrantID: {},
    });

    await expect(
      refreshManagedPartnerSharedProjectionsOnAppActive(
        storage,
        syncSecretStore,
        partnerShareSecretStore,
        new Date("2026-04-06T10:00:00.000Z"),
        syncPartnerProjections,
      ),
    ).resolves.toEqual({
      skipped: false,
      syncedCount: 1,
    });

    expect(syncPartnerProjections).toHaveBeenCalledWith(
      storage,
      syncSecretStore,
      partnerShareSecretStore,
      new Date("2026-04-06T10:00:00.000Z"),
    );
  });

  it("syncs projections when an accepted grant exists without pending invites", async () => {
    const partnerShareSecretStore = createPartnerShareSecretStoreMock();
    const storage = createLocalAppStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();
    const syncPartnerProjections = jest.fn().mockResolvedValue({
      skipped: false,
      syncedCount: 1,
    });

    await partnerShareSecretStore.writePartnerShareSecrets({
      grantKeysByGrantID: {
        "grant-1": {
          keyHex:
            "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
          rotatedAtISO: "2026-04-01T00:00:00.000Z",
          sourceInviteID: "invite-1",
        },
      },
      pendingInviteKeysByInviteID: {},
      consumedInviteIDs: {},
      ownerGenerationByGrantID: {},
      partnerLastSeenGenerationByGrantID: {},
    });

    await expect(
      refreshManagedPartnerSharedProjectionsOnAppActive(
        storage,
        syncSecretStore,
        partnerShareSecretStore,
        new Date("2026-04-06T10:00:00.000Z"),
        syncPartnerProjections,
      ),
    ).resolves.toEqual({
      skipped: false,
      syncedCount: 1,
    });

    expect(syncPartnerProjections).toHaveBeenCalled();
  });
});
