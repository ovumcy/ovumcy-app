import {
  createEmptyPartnerShareSecretsRecord,
  createPartnerShareSecretStore,
  type PartnerShareSecretStoreBackend,
  type PartnerShareSecretsRecord,
} from "./partner-share-secret-store";

function createBackendMock(): PartnerShareSecretStoreBackend & {
  state: Map<string, string>;
} {
  const state = new Map<string, string>();
  return {
    state,
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
}

const STORE_KEY = "ovumcy.partner-share-secrets-v2";
const LEGACY_STORE_KEY = "ovumcy.partner-share-secrets";
const LEGACY_RECORD = JSON.stringify({
  grantKeysByGrantID: {
    grant_1: { keyHex: "aa".repeat(32), rotatedAtISO: "", sourceInviteID: "invite_1" },
  },
  pendingInviteKeysByInviteID: { invite_2: "bb".repeat(32) },
});

describe("partner-share-secret-store retired token-derived entry", () => {
  it("never reads keys from the retired entry and deletes it on first access", async () => {
    const backend = createBackendMock();
    backend.state.set(LEGACY_STORE_KEY, LEGACY_RECORD);
    const store = createPartnerShareSecretStore(backend);

    await expect(store.readPartnerShareSecrets()).resolves.toEqual(
      createEmptyPartnerShareSecretsRecord(),
    );
    expect(backend.state.has(LEGACY_STORE_KEY)).toBe(false);
  });

  it("retries the delete on the next access after a failure", async () => {
    const backend = createBackendMock();
    backend.state.set(LEGACY_STORE_KEY, LEGACY_RECORD);
    const deleteItem = backend.deleteItem.bind(backend);
    let failNext = true;
    backend.deleteItem = async (key: string) => {
      if (failNext) {
        failNext = false;
        throw new Error("keychain locked");
      }
      await deleteItem(key);
    };
    const store = createPartnerShareSecretStore(backend);

    await store.readPartnerShareSecrets();
    expect(backend.state.has(LEGACY_STORE_KEY)).toBe(true);

    await store.readPartnerShareSecrets();
    expect(backend.state.has(LEGACY_STORE_KEY)).toBe(false);
  });

  it("still deletes the retired entry and reports failure when the current entry's delete throws", async () => {
    const backend = createBackendMock();
    backend.state.set(LEGACY_STORE_KEY, LEGACY_RECORD);
    const deleteItem = backend.deleteItem.bind(backend);
    backend.deleteItem = async (key: string) => {
      if (key === STORE_KEY) {
        throw new Error("keychain locked");
      }
      await deleteItem(key);
    };
    const store = createPartnerShareSecretStore(backend);

    await expect(store.clearPartnerShareSecrets()).rejects.toThrow(
      "keychain locked",
    );
    expect(backend.state.has(LEGACY_STORE_KEY)).toBe(false);
  });

  it("is deleted by a clear together with the current entry", async () => {
    const backend = createBackendMock();
    const store = createPartnerShareSecretStore(backend);
    await store.writePartnerShareSecrets(createEmptyPartnerShareSecretsRecord());
    backend.state.set(LEGACY_STORE_KEY, LEGACY_RECORD);

    await store.clearPartnerShareSecrets();

    expect(backend.state.has(STORE_KEY)).toBe(false);
    expect(backend.state.has(LEGACY_STORE_KEY)).toBe(false);
  });
});

describe("partner-share-secret-store", () => {
  describe("readPartnerShareSecrets", () => {
    it("returns an empty record when nothing is stored", async () => {
      const backend = createBackendMock();
      const store = createPartnerShareSecretStore(backend);

      await expect(store.readPartnerShareSecrets()).resolves.toEqual(
        createEmptyPartnerShareSecretsRecord(),
      );
    });

    it("falls back to an empty record when the stored value is corrupted JSON", async () => {
      const backend = createBackendMock();
      backend.state.set(STORE_KEY, "{not valid json");
      const store = createPartnerShareSecretStore(backend);

      await expect(store.readPartnerShareSecrets()).resolves.toEqual(
        createEmptyPartnerShareSecretsRecord(),
      );
    });

    it("round-trips a fully populated record", async () => {
      const backend = createBackendMock();
      const store = createPartnerShareSecretStore(backend);
      const record: PartnerShareSecretsRecord = {
        grantKeysByGrantID: {
          grant_1: {
            keyHex: "aa".repeat(32),
            rotatedAtISO: "2026-05-01T00:00:00.000Z",
            sourceInviteID: "invite_1",
          },
        },
        pendingInviteKeysByInviteID: { invite_2: "bb".repeat(32) },
        consumedInviteIDs: {
          invite_1: { grantID: "grant_1", consumedAtISO: "2026-05-01T00:00:00.000Z" },
        },
        ownerGenerationByGrantID: { grant_1: 3 },
        partnerLastSeenGenerationByGrantID: { grant_1: 2 },
      };

      await store.writePartnerShareSecrets(record);

      await expect(store.readPartnerShareSecrets()).resolves.toEqual(record);
    });

    it("drops a grant-key entry with a non-string key value", async () => {
      // Untrusted-input hardening: a corrupted or tampered stored blob must
      // never surface a zombie grant-key entry, since a caller could try to
      // decrypt with an empty keyHex.
      const backend = createBackendMock();
      backend.state.set(
        STORE_KEY,
        JSON.stringify({
          grantKeysByGrantID: {
            grant_bad: { keyHex: 42, rotatedAtISO: "x", sourceInviteID: "y" },
            grant_missing_key: { rotatedAtISO: "x" },
          },
        }),
      );
      const store = createPartnerShareSecretStore(backend);

      const result = await store.readPartnerShareSecrets();

      expect(result.grantKeysByGrantID).toEqual({});
    });

    it("trims whitespace and drops a non-object entry in the grant-key map", async () => {
      const backend = createBackendMock();
      backend.state.set(
        STORE_KEY,
        JSON.stringify({
          grantKeysByGrantID: {
            " grant_1 ": {
              keyHex: " aa11 ",
              rotatedAtISO: " 2026-05-01T00:00:00.000Z ",
              sourceInviteID: " invite_1 ",
            },
            grant_not_object: "oops",
          },
        }),
      );
      const store = createPartnerShareSecretStore(backend);

      const result = await store.readPartnerShareSecrets();

      expect(result.grantKeysByGrantID).toEqual({
        grant_1: {
          keyHex: "aa11",
          rotatedAtISO: "2026-05-01T00:00:00.000Z",
          sourceInviteID: "invite_1",
        },
      });
    });

    it("drops a consumed-invite entry with an empty grantID", async () => {
      // Anti-replay needs a grantID to compare against on the next
      // reconcile; an entry without one is meaningless and must not persist.
      const backend = createBackendMock();
      backend.state.set(
        STORE_KEY,
        JSON.stringify({
          consumedInviteIDs: {
            invite_1: { grantID: "", consumedAtISO: "2026-05-01T00:00:00.000Z" },
            invite_2: { grantID: "grant_2" },
          },
        }),
      );
      const store = createPartnerShareSecretStore(backend);

      const result = await store.readPartnerShareSecrets();

      expect(result.consumedInviteIDs).toEqual({
        invite_2: { grantID: "grant_2", consumedAtISO: "" },
      });
    });

    it("drops non-integer, negative, and non-numeric entries from generation maps", async () => {
      const backend = createBackendMock();
      backend.state.set(
        STORE_KEY,
        JSON.stringify({
          ownerGenerationByGrantID: {
            grant_ok: 5,
            grant_float: 1.5,
            grant_negative: -1,
            grant_string: "3",
          },
        }),
      );
      const store = createPartnerShareSecretStore(backend);

      const result = await store.readPartnerShareSecrets();

      expect(result.ownerGenerationByGrantID).toEqual({ grant_ok: 5 });
    });

    it("drops a pending-invite-key entry with a blank value", async () => {
      const backend = createBackendMock();
      backend.state.set(
        STORE_KEY,
        JSON.stringify({
          pendingInviteKeysByInviteID: {
            invite_ok: "cc".repeat(32),
            invite_blank: "   ",
          },
        }),
      );
      const store = createPartnerShareSecretStore(backend);

      const result = await store.readPartnerShareSecrets();

      expect(result.pendingInviteKeysByInviteID).toEqual({
        invite_ok: "cc".repeat(32),
      });
    });

    it("treats a non-object stored maps section as empty", async () => {
      const backend = createBackendMock();
      backend.state.set(
        STORE_KEY,
        JSON.stringify({
          grantKeysByGrantID: "not-an-object",
          pendingInviteKeysByInviteID: null,
          consumedInviteIDs: 42,
          ownerGenerationByGrantID: ["array"],
        }),
      );
      const store = createPartnerShareSecretStore(backend);

      await expect(store.readPartnerShareSecrets()).resolves.toEqual(
        createEmptyPartnerShareSecretsRecord(),
      );
    });
  });

  describe("clearPartnerShareSecrets", () => {
    it("removes the stored record entirely", async () => {
      const backend = createBackendMock();
      const store = createPartnerShareSecretStore(backend);
      await store.writePartnerShareSecrets({
        ...createEmptyPartnerShareSecretsRecord(),
        pendingInviteKeysByInviteID: { invite_1: "dd".repeat(32) },
      });

      await store.clearPartnerShareSecrets();

      expect(backend.state.has(STORE_KEY)).toBe(false);
      await expect(store.readPartnerShareSecrets()).resolves.toEqual(
        createEmptyPartnerShareSecretsRecord(),
      );
    });

    it("runs after a mutation already in flight, so the record is not written back", async () => {
      const backend = createBackendMock();
      const store = createPartnerShareSecretStore(backend);

      const mutation = store.mutatePartnerShareSecrets((record) => ({
        ...record,
        pendingInviteKeysByInviteID: { invite_1: "ee".repeat(32) },
      }));
      const clear = store.clearPartnerShareSecrets();
      await Promise.all([mutation, clear]);

      expect(backend.state.has(STORE_KEY)).toBe(false);
    });
  });

  describe("mutatePartnerShareSecrets", () => {
    it("persists the mutation the updater applies to the record", async () => {
      const backend = createBackendMock();
      const store = createPartnerShareSecretStore(backend);

      const returned = await store.mutatePartnerShareSecrets((record) => {
        record.ownerGenerationByGrantID.grant_1 = 1;
        return "updater-return-value";
      });

      expect(returned).toBe("updater-return-value");
      await expect(store.readPartnerShareSecrets()).resolves.toEqual(
        expect.objectContaining({
          ownerGenerationByGrantID: { grant_1: 1 },
        }),
      );
    });

    it("serializes concurrent mutate calls so neither turn clobbers the other", async () => {
      const backend = createBackendMock();
      const store = createPartnerShareSecretStore(backend);

      // Both turns start from the same on-disk snapshot conceptually, but
      // mutate() must serialize them: the second turn's read must observe
      // the first turn's write, not race it.
      const [firstResult, secondResult] = await Promise.all([
        store.mutatePartnerShareSecrets((record) => {
          record.ownerGenerationByGrantID.grant_a = 1;
          return "first";
        }),
        store.mutatePartnerShareSecrets((record) => {
          record.ownerGenerationByGrantID.grant_b = 2;
          return "second";
        }),
      ]);

      expect(firstResult).toBe("first");
      expect(secondResult).toBe("second");
      await expect(store.readPartnerShareSecrets()).resolves.toEqual(
        expect.objectContaining({
          ownerGenerationByGrantID: { grant_a: 1, grant_b: 2 },
        }),
      );
    });

    it("keeps the mutate chain alive after an updater rejects", async () => {
      const backend = createBackendMock();
      const store = createPartnerShareSecretStore(backend);

      await expect(
        store.mutatePartnerShareSecrets(() => {
          throw new Error("updater failed");
        }),
      ).rejects.toThrow("updater failed");

      // A subsequent mutate() call must still run rather than hanging behind
      // a permanently-rejected chain link.
      const result = await store.mutatePartnerShareSecrets((record) => {
        record.ownerGenerationByGrantID.grant_after_failure = 9;
        return "recovered";
      });

      expect(result).toBe("recovered");
      await expect(store.readPartnerShareSecrets()).resolves.toEqual(
        expect.objectContaining({
          ownerGenerationByGrantID: { grant_after_failure: 9 },
        }),
      );
    });
  });
});
