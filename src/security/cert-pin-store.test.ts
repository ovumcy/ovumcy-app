import {
  createCertPinStore,
  type CertPinStoreBackend,
} from "./cert-pin-store";

function createFakeBackend(): CertPinStoreBackend & {
  store: Map<string, string>;
} {
  const store = new Map<string, string>();
  return {
    store,
    async getItem(key: string): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      store.set(key, value);
    },
    async deleteItem(key: string): Promise<void> {
      store.delete(key);
    },
  };
}

const VALID_FINGERPRINT_A = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const VALID_FINGERPRINT_B = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=";

describe("cert-pin-store", () => {
  it("returns null when no pin has ever been recorded for a host", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    expect(await store.readPin("sync.partner.com")).toBeNull();
  });

  it("persists a pin and reads it back under the same host", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await store.writePin({
      host: "sync.partner.com",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });

    expect(await store.readPin("sync.partner.com")).toEqual({
      host: "sync.partner.com",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });
  });

  it("treats host lookup as case-insensitive and whitespace-tolerant", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await store.writePin({
      host: "Sync.Partner.COM",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });

    expect(await store.readPin("  SYNC.partner.com  ")).toEqual({
      host: "sync.partner.com",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });
  });

  it("overwrites the prior pin when the same host is written again", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await store.writePin({
      host: "sync.partner.com",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });
    await store.writePin({
      host: "sync.partner.com",
      fingerprint: VALID_FINGERPRINT_B,
      pinnedAt: "2026-05-23T10:00:00.000Z",
    });

    const pin = await store.readPin("sync.partner.com");
    expect(pin?.fingerprint).toBe(VALID_FINGERPRINT_B);
    expect(pin?.pinnedAt).toBe("2026-05-23T10:00:00.000Z");
  });

  it("keeps pins for distinct hosts independent", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await store.writePin({
      host: "sync.partner-one.com",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });
    await store.writePin({
      host: "sync.partner-two.com",
      fingerprint: VALID_FINGERPRINT_B,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });

    expect((await store.readPin("sync.partner-one.com"))?.fingerprint).toBe(
      VALID_FINGERPRINT_A,
    );
    expect((await store.readPin("sync.partner-two.com"))?.fingerprint).toBe(
      VALID_FINGERPRINT_B,
    );
  });

  it("removes a single pin without affecting the others", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await store.writePin({
      host: "sync.partner-one.com",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });
    await store.writePin({
      host: "sync.partner-two.com",
      fingerprint: VALID_FINGERPRINT_B,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });

    await store.clearPin("sync.partner-one.com");

    expect(await store.readPin("sync.partner-one.com")).toBeNull();
    expect((await store.readPin("sync.partner-two.com"))?.fingerprint).toBe(
      VALID_FINGERPRINT_B,
    );
  });

  it("collapses to a fully cleared backend entry when the last pin is removed", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await store.writePin({
      host: "sync.partner.com",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });
    await store.clearPin("sync.partner.com");

    // No empty `{}` should remain — never-pinned and clearPin-of-last-pin
    // must be indistinguishable to the enforcement layer.
    expect(backend.store.has("ovumcy.sync-cert-pins")).toBe(false);
  });

  it("clearAll removes every pin", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await store.writePin({
      host: "sync.partner-one.com",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });
    await store.writePin({
      host: "sync.partner-two.com",
      fingerprint: VALID_FINGERPRINT_B,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });

    await store.clearAll();

    expect(await store.readPin("sync.partner-one.com")).toBeNull();
    expect(await store.readPin("sync.partner-two.com")).toBeNull();
    expect(backend.store.has("ovumcy.sync-cert-pins")).toBe(false);
  });

  it("rejects writes with a malformed fingerprint", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await expect(
      store.writePin({
        host: "sync.partner.com",
        fingerprint: "too-short",
        pinnedAt: "2026-05-22T10:00:00.000Z",
      }),
    ).rejects.toThrow("invalid_fingerprint");

    await expect(
      store.writePin({
        host: "sync.partner.com",
        fingerprint: "not!valid$base64!!!!!!!!!!!!!!!!!!!!!!!!!!!",
        pinnedAt: "2026-05-22T10:00:00.000Z",
      }),
    ).rejects.toThrow("invalid_fingerprint");
  });

  it("rejects writes with an empty host", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await expect(
      store.writePin({
        host: "   ",
        fingerprint: VALID_FINGERPRINT_A,
        pinnedAt: "2026-05-22T10:00:00.000Z",
      }),
    ).rejects.toThrow("invalid_host");
  });

  it("rejects writes with a non-ISO-8601 timestamp", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await expect(
      store.writePin({
        host: "sync.partner.com",
        fingerprint: VALID_FINGERPRINT_A,
        pinnedAt: "not-a-timestamp",
      }),
    ).rejects.toThrow("invalid_pinned_at");
  });

  it("returns null when the persisted payload is unparseable JSON", async () => {
    const backend = createFakeBackend();
    backend.store.set("ovumcy.sync-cert-pins", "{not json");
    const store = createCertPinStore(backend);

    expect(await store.readPin("sync.partner.com")).toBeNull();
  });

  it("returns null when the persisted payload is JSON but not an object map", async () => {
    const backend = createFakeBackend();
    backend.store.set("ovumcy.sync-cert-pins", "[1,2,3]");
    const store = createCertPinStore(backend);

    expect(await store.readPin("sync.partner.com")).toBeNull();
  });

  it("rejects a stored record whose embedded host differs from its map key", async () => {
    // Defends against an attacker with arbitrary SecureStore write access
    // aliasing a pin to a different host than where it was minted: the
    // policy layer reads by host key, so a mismatched record could otherwise
    // serve a pin for the wrong identity.
    const backend = createFakeBackend();
    backend.store.set(
      "ovumcy.sync-cert-pins",
      JSON.stringify({
        "sync.partner.com": {
          host: "attacker.example",
          fingerprint: VALID_FINGERPRINT_A,
          pinnedAt: "2026-05-22T10:00:00.000Z",
        },
      }),
    );
    const store = createCertPinStore(backend);

    expect(await store.readPin("sync.partner.com")).toBeNull();
  });

  it("skips a record with a malformed fingerprint when reading the map", async () => {
    const backend = createFakeBackend();
    backend.store.set(
      "ovumcy.sync-cert-pins",
      JSON.stringify({
        "sync.partner.com": {
          host: "sync.partner.com",
          fingerprint: "too-short",
          pinnedAt: "2026-05-22T10:00:00.000Z",
        },
        "sync.other.com": {
          host: "sync.other.com",
          fingerprint: VALID_FINGERPRINT_B,
          pinnedAt: "2026-05-22T10:00:00.000Z",
        },
      }),
    );
    const store = createCertPinStore(backend);

    expect(await store.readPin("sync.partner.com")).toBeNull();
    expect((await store.readPin("sync.other.com"))?.fingerprint).toBe(
      VALID_FINGERPRINT_B,
    );
  });

  it("readPin returns null for an empty host argument", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await store.writePin({
      host: "sync.partner.com",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });

    expect(await store.readPin("")).toBeNull();
    expect(await store.readPin("   ")).toBeNull();
  });

  it("clearPin is a no-op for unknown hosts", async () => {
    const backend = createFakeBackend();
    const store = createCertPinStore(backend);

    await store.writePin({
      host: "sync.partner.com",
      fingerprint: VALID_FINGERPRINT_A,
      pinnedAt: "2026-05-22T10:00:00.000Z",
    });
    await store.clearPin("never-pinned.example");

    expect((await store.readPin("sync.partner.com"))?.fingerprint).toBe(
      VALID_FINGERPRINT_A,
    );
  });
});
