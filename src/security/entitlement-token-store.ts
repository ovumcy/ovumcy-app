/**
 * Secure-storage cache for the signed entitlement token.
 *
 * The token is a short-lived bearer-ish credential (it carries the account id
 * and the unlocked feature keys, no health data). Per the memo it must live in
 * platform secure storage — never plaintext AsyncStorage — exactly like the
 * other sync/partner secrets. A separate store (not folded into
 * SyncSecretsRecord) keeps the token's read/refresh/clear lifecycle isolated
 * from the session secrets.
 */

const ENTITLEMENT_TOKEN_STORE_KEY = "ovumcy.entitlement-token";

export type EntitlementTokenRecord = {
  // The compact JWT (EdDSA). Opaque to the store; verified on read by the
  // entitlement-token-service before any claim is trusted.
  token: string;
};

export interface EntitlementTokenStoreBackend {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface EntitlementTokenStore {
  clearEntitlementToken(): Promise<void>;
  readEntitlementToken(): Promise<EntitlementTokenRecord | null>;
  writeEntitlementToken(record: EntitlementTokenRecord): Promise<void>;
}

export function createEntitlementTokenStore(
  backend: EntitlementTokenStoreBackend,
): EntitlementTokenStore {
  return {
    async clearEntitlementToken(): Promise<void> {
      await backend.deleteItem(ENTITLEMENT_TOKEN_STORE_KEY);
    },

    async readEntitlementToken(): Promise<EntitlementTokenRecord | null> {
      const rawValue = await backend.getItem(ENTITLEMENT_TOKEN_STORE_KEY);
      if (!rawValue) {
        return null;
      }

      try {
        const parsed = JSON.parse(rawValue) as EntitlementTokenRecord;
        if (typeof parsed?.token !== "string" || parsed.token.length === 0) {
          return null;
        }
        return { token: parsed.token };
      } catch {
        return null;
      }
    },

    async writeEntitlementToken(
      record: EntitlementTokenRecord,
    ): Promise<void> {
      await backend.setItem(
        ENTITLEMENT_TOKEN_STORE_KEY,
        JSON.stringify({ token: record.token }),
      );
    },
  };
}
