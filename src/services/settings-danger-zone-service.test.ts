import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  createInMemorySecureStoreBackend,
  createSecretStoresOverBackend,
  createWipeScopeSecretStoresMock,
  listSecureStoreKeysFromSource,
} from "../test/secure-store-inventory";
import {
  clearAllLocalSettingsData,
  CLEAR_LOCAL_DATA_CONFIRMATION,
  isClearLocalDataConfirmationValid,
} from "./settings-danger-zone-service";

describe("settings-danger-zone-service", () => {
  it("validates the destructive confirmation phrase strictly", () => {
    expect(isClearLocalDataConfirmationValid(CLEAR_LOCAL_DATA_CONFIRMATION)).toBe(
      true,
    );
    expect(isClearLocalDataConfirmationValid(" clear ")).toBe(true);
    expect(isClearLocalDataConfirmationValid("CLEAR ALL")).toBe(false);
    expect(isClearLocalDataConfirmationValid("")).toBe(false);
  });

  it("clears all local app data through the canonical storage boundary", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();

    await expect(
      clearAllLocalSettingsData(
        storage,
        secretStore,
        createWipeScopeSecretStoresMock(),
      ),
    ).resolves.toEqual({
      ok: true,
    });
    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
  });

  it("leaves no wipe-scope SecureStore key behind after clearing local data", async () => {
    const inventory = listSecureStoreKeysFromSource();
    // The local-data key belongs to the storage reset, which deletes it and
    // reseeds a fresh one; every other SecureStore key is the wipe's.
    const storageOwnedKeys = inventory
      .filter((entry) => entry.storeModule === "local-data-key-store")
      .map((entry) => entry.key);
    expect(storageOwnedKeys).toEqual(["ovumcy.local-data-key"]);
    expect(inventory.length).toBeGreaterThan(storageOwnedKeys.length);

    const backend = createInMemorySecureStoreBackend(
      inventory.map((entry) => entry.key),
    );
    const { syncSecretStore, wipeScopeSecretStores } =
      createSecretStoresOverBackend(backend);
    const storage = createLocalAppStorageMock();

    await expect(
      clearAllLocalSettingsData(storage, syncSecretStore, wipeScopeSecretStores),
    ).resolves.toEqual({ ok: true });

    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
    expect(backend.keys()).toEqual(storageOwnedKeys);
  });

  it("still clears the remaining secrets and reports failure when one secret clear throws", async () => {
    const inventory = listSecureStoreKeysFromSource();
    const backend = createInMemorySecureStoreBackend(
      inventory.map((entry) => entry.key),
    );
    const { syncSecretStore, wipeScopeSecretStores } =
      createSecretStoresOverBackend(backend);
    const storage = createLocalAppStorageMock();

    await expect(
      clearAllLocalSettingsData(storage, syncSecretStore, {
        ...wipeScopeSecretStores,
        partnerShareSecretStore: {
          clearPartnerShareSecrets: jest
            .fn()
            .mockRejectedValue(new Error("keychain locked")),
        },
      }),
    ).resolves.toEqual({ ok: false, errorCode: "generic" });

    expect(backend.keys()).toEqual(
      ["ovumcy.local-data-key", "ovumcy.partner-share-secrets"].sort(),
    );
  });

  it("returns a stable error code when the storage reset fails", async () => {
    const storage = createLocalAppStorageMock({
      clearAllLocalData: jest.fn().mockRejectedValue(new Error("boom")),
    });
    const secretStore = createSyncSecretStoreMock();

    await expect(
      clearAllLocalSettingsData(
        storage,
        secretStore,
        createWipeScopeSecretStoresMock(),
      ),
    ).resolves.toEqual({
      ok: false,
      errorCode: "generic",
    });
  });
});
