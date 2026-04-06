export type PartnerShareSecretsRecord = {
  grantKeysByGrantID: Record<string, string>;
  pendingInviteKeysByInviteID: Record<string, string>;
};

const PARTNER_SHARE_SECRET_STORE_KEY = "ovumcy.partner-share-secrets";

export interface PartnerShareSecretStoreBackend {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface PartnerShareSecretStore {
  clearPartnerShareSecrets(): Promise<void>;
  readPartnerShareSecrets(): Promise<PartnerShareSecretsRecord>;
  writePartnerShareSecrets(record: PartnerShareSecretsRecord): Promise<void>;
}

export function createEmptyPartnerShareSecretsRecord(): PartnerShareSecretsRecord {
  return {
    grantKeysByGrantID: {},
    pendingInviteKeysByInviteID: {},
  };
}

export function createPartnerShareSecretStore(
  backend: PartnerShareSecretStoreBackend,
): PartnerShareSecretStore {
  return {
    async clearPartnerShareSecrets(): Promise<void> {
      await backend.deleteItem(PARTNER_SHARE_SECRET_STORE_KEY);
    },

    async readPartnerShareSecrets(): Promise<PartnerShareSecretsRecord> {
      const rawValue = await backend.getItem(PARTNER_SHARE_SECRET_STORE_KEY);
      if (!rawValue) {
        return createEmptyPartnerShareSecretsRecord();
      }

      try {
        const parsed = JSON.parse(rawValue) as Partial<PartnerShareSecretsRecord>;
        return {
          grantKeysByGrantID: normalizeSecretsMap(parsed.grantKeysByGrantID),
          pendingInviteKeysByInviteID: normalizeSecretsMap(
            parsed.pendingInviteKeysByInviteID,
          ),
        };
      } catch {
        return createEmptyPartnerShareSecretsRecord();
      }
    },

    async writePartnerShareSecrets(record: PartnerShareSecretsRecord): Promise<void> {
      await backend.setItem(
        PARTNER_SHARE_SECRET_STORE_KEY,
        JSON.stringify({
          grantKeysByGrantID: normalizeSecretsMap(record.grantKeysByGrantID),
          pendingInviteKeysByInviteID: normalizeSecretsMap(
            record.pendingInviteKeysByInviteID,
          ),
        }),
      );
    },
  };
}

function normalizeSecretsMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, item]) =>
          typeof key === "string" &&
          key.trim().length > 0 &&
          typeof item === "string" &&
          item.trim().length > 0,
      )
      .map(([key, item]) => [key.trim(), item.trim()]),
  );
}
