import { createSyncSecretStore, type SyncSecretStore } from "../security/sync-secret-store";
import type { SyncSecretsRecord } from "../sync/sync-contract";

export function createSyncSecretStoreMock(
  initialRecord: SyncSecretsRecord | null = null,
): SyncSecretStore {
  let rawState = initialRecord ? JSON.stringify(initialRecord) : null;

  return createSyncSecretStore({
    async deleteItem(): Promise<void> {
      rawState = null;
    },

    async getItem(): Promise<string | null> {
      return rawState;
    },

    async setItem(_key: string, value: string): Promise<void> {
      rawState = value;
    },
  });
}
