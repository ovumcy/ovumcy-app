import type { SyncSecretsRecord } from "../sync/sync-contract";

const SYNC_SECRET_STORE_KEY = "ovumcy.sync-secrets";

export interface SyncSecretStoreBackend {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface SyncSecretStore {
  clearSyncSecrets(): Promise<void>;
  readSyncSecrets(): Promise<SyncSecretsRecord | null>;
  writeSyncSecrets(record: SyncSecretsRecord): Promise<void>;
}

export function createSyncSecretStore(
  backend: SyncSecretStoreBackend,
): SyncSecretStore {
  return {
    async clearSyncSecrets(): Promise<void> {
      await backend.deleteItem(SYNC_SECRET_STORE_KEY);
    },

    async readSyncSecrets(): Promise<SyncSecretsRecord | null> {
      const rawValue = await backend.getItem(SYNC_SECRET_STORE_KEY);
      if (!rawValue) {
        return null;
      }

      try {
        return JSON.parse(rawValue) as SyncSecretsRecord;
      } catch {
        return null;
      }
    },

    async writeSyncSecrets(record: SyncSecretsRecord): Promise<void> {
      await backend.setItem(SYNC_SECRET_STORE_KEY, JSON.stringify(record));
    },
  };
}
