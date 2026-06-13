import { createEntitlementTokenStore } from "./entitlement-token-store";

function createBackedStore() {
  const state = new Map<string, string>();
  const store = createEntitlementTokenStore({
    async deleteItem(key) {
      state.delete(key);
    },
    async getItem(key) {
      return state.get(key) ?? null;
    },
    async setItem(key, value) {
      state.set(key, value);
    },
  });
  return { store, state };
}

describe("entitlement-token-store", () => {
  it("round-trips a token record and clears it", async () => {
    const { store } = createBackedStore();

    expect(await store.readEntitlementToken()).toBeNull();

    await store.writeEntitlementToken({ token: "jwt-value" });
    expect(await store.readEntitlementToken()).toEqual({ token: "jwt-value" });

    await store.clearEntitlementToken();
    expect(await store.readEntitlementToken()).toBeNull();
  });

  it("returns null for malformed or empty stored values rather than throwing", async () => {
    const { store, state } = createBackedStore();

    state.set("ovumcy.entitlement-token", "{not json");
    expect(await store.readEntitlementToken()).toBeNull();

    state.set("ovumcy.entitlement-token", JSON.stringify({ token: "" }));
    expect(await store.readEntitlementToken()).toBeNull();

    state.set("ovumcy.entitlement-token", JSON.stringify({ other: "x" }));
    expect(await store.readEntitlementToken()).toBeNull();
  });
});
