const LOCAL_DATA_KEY_STORE_KEY = "ovumcy.local-data-key";

export interface LocalDataKeyStoreBackend {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface LocalDataKeyStore {
  clearLocalDataKey(): Promise<void>;
  readLocalDataKey(): Promise<string | null>;
  writeLocalDataKey(keyHex: string): Promise<void>;
}

export function createLocalDataKeyStore(
  backend: LocalDataKeyStoreBackend,
): LocalDataKeyStore {
  return {
    async clearLocalDataKey(): Promise<void> {
      await backend.deleteItem(LOCAL_DATA_KEY_STORE_KEY);
    },

    async readLocalDataKey(): Promise<string | null> {
      return backend.getItem(LOCAL_DATA_KEY_STORE_KEY);
    },

    async writeLocalDataKey(keyHex: string): Promise<void> {
      await backend.setItem(LOCAL_DATA_KEY_STORE_KEY, keyHex);
    },
  };
}

export function createInMemoryLocalDataKeyStore(): LocalDataKeyStore {
  let keyHex: string | null = null;

  return createLocalDataKeyStore({
    async deleteItem() {
      keyHex = null;
    },

    async getItem() {
      return keyHex;
    },

    async setItem(_key, value) {
      keyHex = value;
    },
  });
}
