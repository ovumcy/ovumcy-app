import { createCertPinStore } from "./cert-pin-store";

const memoryState = new Map<string, string>();

export function createPlatformCertPinStore() {
  return createCertPinStore({
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
