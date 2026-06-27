import { createEntitlementTokenStore } from "./entitlement-token-store";

const memoryState = new Map<string, string>();

export function createPlatformEntitlementTokenStore() {
  return createEntitlementTokenStore({
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
