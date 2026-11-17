import {
  createInMemorySecureStoreBackend,
  listSecureStoreKeys,
} from "./secure-store-inventory";

const FACTORY = 'import * as SecureStore from "expo-secure-store";\nimport { createFooStore } from "./foo-store";\n';

describe("listSecureStoreKeys", () => {
  it("lists the key a platform factory's store module declares", () => {
    expect(
      listSecureStoreKeys(
        [
          { relativePath: "security/platform-foo-store.native.ts", source: FACTORY },
          { relativePath: "services/unrelated.ts", source: "export const x = 1;" },
        ],
        () => 'const KEY = "ovumcy.foo";',
      ),
    ).toEqual([{ key: "ovumcy.foo", storeModule: "foo-store" }]);
  });

  it("rejects an expo-secure-store import outside a platform store factory", () => {
    expect(() =>
      listSecureStoreKeys(
        [{ relativePath: "services/leaky.ts", source: FACTORY }],
        () => "",
      ),
    ).toThrow("services/leaky.ts imports expo-secure-store outside");
  });

  it("rejects a platform factory that names no store module", () => {
    expect(() =>
      listSecureStoreKeys(
        [
          {
            relativePath: "security/platform-foo-store.native.ts",
            source: 'import * as SecureStore from "expo-secure-store";\n',
          },
        ],
        () => "",
      ),
    ).toThrow("does not import a ./<store> factory");
  });

  it("rejects a store module that declares no key", () => {
    expect(() =>
      listSecureStoreKeys(
        [{ relativePath: "security/platform-foo-store.native.ts", source: FACTORY }],
        () => "const A = 1;",
      ),
    ).toThrow("foo-store.ts declares no ovumcy.* key");
  });

  it("inventories every key a store module declares, a retired one included", () => {
    expect(
      listSecureStoreKeys(
        [{ relativePath: "security/platform-foo-store.native.ts", source: FACTORY }],
        () => 'const A = "ovumcy.a-v2"; const B = "ovumcy.a";',
      ),
    ).toEqual([
      { key: "ovumcy.a", storeModule: "foo-store" },
      { key: "ovumcy.a-v2", storeModule: "foo-store" },
    ]);
  });
});

describe("createInMemorySecureStoreBackend", () => {
  it("returns null for a key that was never written", async () => {
    await expect(
      createInMemorySecureStoreBackend().getItem("ovumcy.absent"),
    ).resolves.toBeNull();
  });
});
