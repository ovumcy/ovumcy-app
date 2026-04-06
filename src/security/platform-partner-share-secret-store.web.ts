import { createPartnerShareSecretStore } from "./partner-share-secret-store";

const memoryState = new Map<string, string>();

export function createPlatformPartnerShareSecretStore() {
  return createPartnerShareSecretStore({
    async deleteItem(key: string): Promise<void> {
      memoryState.delete(key);
    },

    async getItem(key: string): Promise<string | null> {
      return memoryState.get(key) ?? null;
    },

    async setItem(key: string, value: string): Promise<void> {
      memoryState.set(key, value);
    },
  });
}
