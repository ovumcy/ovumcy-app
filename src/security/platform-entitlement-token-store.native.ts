import * as SecureStore from "expo-secure-store";

import { createEntitlementTokenStore } from "./entitlement-token-store";

export function createPlatformEntitlementTokenStore() {
  return createEntitlementTokenStore({
    async deleteItem(key: string): Promise<void> {
      await SecureStore.deleteItemAsync(key);
    },

    async getItem(key: string): Promise<string | null> {
      return SecureStore.getItemAsync(key);
    },

    async setItem(key: string, value: string): Promise<void> {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    },
  });
}
