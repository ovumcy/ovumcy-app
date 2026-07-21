import {
  createEntitlementTokenStore,
  type EntitlementTokenStore,
} from "../security/entitlement-token-store";
import type { SyncSecretStore } from "../security/sync-secret-store";
import type { ManagedCloudAPIClient } from "../sync/managed-cloud-api-client";
import type { SyncSecretsRecord } from "../sync/sync-contract";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { buildEntitlementTokenGate } from "./entitlement-token-gate-service";

const MANAGED_SECRETS: SyncSecretsRecord = {
  device: {
    deviceID: "device-1",
    deviceLabel: "Pixel 7",
    createdAt: "2026-03-19T08:15:00.000Z",
  },
  masterKeyHex: "aa",
  deviceSecretHex: "bb",
  wrappedKey: {
    algorithm: "xchacha20poly1305",
    kdf: "bip39_seed_hkdf_sha256",
    mnemonicWordCount: 12,
    wrapNonceHex: "cc",
    wrappedMasterKeyHex: "dd",
    phraseFingerprintHex: "ee",
  },
  authSessionToken: null,
  managedAuthSessionToken: "managed-session-1",
  managedAuthSessionExpiresAt: null,
  managedRefreshToken: null,
  managedRefreshTokenExpiresAt: null,
};

function createMemoryEntitlementTokenStore(): EntitlementTokenStore {
  let raw: string | null = null;
  return createEntitlementTokenStore({
    async deleteItem(): Promise<void> {
      raw = null;
    },
    async getItem(): Promise<string | null> {
      return raw;
    },
    async setItem(_key: string, value: string): Promise<void> {
      raw = value;
    },
  });
}

function sessionClient(
  result:
    | { ok: true; accountID: string }
    | { ok: false }
    | { throws: true },
): ManagedCloudAPIClient {
  return {
    getSession: jest.fn(async () => {
      if ("throws" in result) {
        throw new Error("network down");
      }
      if (!result.ok) {
        return { ok: false, errorCode: "network_failed" as const };
      }
      return {
        ok: true,
        session: {
          accountID: result.accountID,
          email: "owner@example.com",
          sessionExpiresAt: "2026-03-21T08:00:00.000Z",
          entitlement: {
            syncAllowed: true,
            source: "billing_subscription",
            updatedAt: "2026-03-20T08:05:00.000Z",
            effectiveAt: "2026-03-20T08:05:00.000Z",
            explanation: "plan active",
          },
          twoFactorEnabled: false,
        },
      };
    }),
  } as unknown as ManagedCloudAPIClient;
}

describe("buildEntitlementTokenGate", () => {
  it("returns undefined for a non-managed sync mode (self-hosted / no cloud carries no token)", async () => {
    const client = sessionClient({ ok: true, accountID: "acct-1" });

    const gate = await buildEntitlementTokenGate(
      createSyncSecretStoreMock(MANAGED_SECRETS),
      "self_hosted",
      { managedClient: client, tokenStore: createMemoryEntitlementTokenStore() },
    );

    expect(gate).toBeUndefined();
    expect(client.getSession).not.toHaveBeenCalled();
  });

  it("returns undefined (fail to snapshot) when the secure-store read throws, without touching the network", async () => {
    // A throwing secret store (secure storage unavailable) must degrade to no
    // gate and never reach the session-view fetch — fail-to-snapshot, not crash.
    const throwingSecretStore = {
      readSyncSecrets: jest.fn(async () => {
        throw new Error("secure store unavailable");
      }),
    } as unknown as SyncSecretStore;
    const client = sessionClient({ ok: true, accountID: "acct-1" });

    const gate = await buildEntitlementTokenGate(throwingSecretStore, "managed", {
      managedClient: client,
      tokenStore: createMemoryEntitlementTokenStore(),
    });

    expect(gate).toBeUndefined();
    expect(client.getSession).not.toHaveBeenCalled();
  });

  it("returns undefined (fail to snapshot) when there is no managed session token", async () => {
    const client = sessionClient({ ok: true, accountID: "acct-1" });

    const gate = await buildEntitlementTokenGate(
      createSyncSecretStoreMock({
        ...MANAGED_SECRETS,
        managedAuthSessionToken: null,
      }),
      "managed",
      { managedClient: client, tokenStore: createMemoryEntitlementTokenStore() },
    );

    expect(gate).toBeUndefined();
    expect(client.getSession).not.toHaveBeenCalled();
  });

  it("binds expectedSub to the active account id when the session view resolves", async () => {
    const store = createMemoryEntitlementTokenStore();
    const client = sessionClient({ ok: true, accountID: "acct-test-0001" });

    const gate = await buildEntitlementTokenGate(
      createSyncSecretStoreMock(MANAGED_SECRETS),
      "managed",
      { managedClient: client, tokenStore: store, nowSeconds: 1_750_000_000 },
    );

    expect(gate).toEqual({
      store,
      now: 1_750_000_000,
      expectedSub: "acct-test-0001",
    });
    expect(client.getSession).toHaveBeenCalledWith("managed-session-1");
  });

  it("defaults now to the real wall clock (in seconds) when nowSeconds is not injected", async () => {
    const beforeSeconds = Math.floor(Date.now() / 1000);
    const client = sessionClient({ ok: true, accountID: "acct-clock" });

    const gate = await buildEntitlementTokenGate(
      createSyncSecretStoreMock(MANAGED_SECRETS),
      "managed",
      {
        managedClient: client,
        tokenStore: createMemoryEntitlementTokenStore(),
      },
    );
    const afterSeconds = Math.floor(Date.now() / 1000);

    // No nowSeconds injected -> the gate falls back to the wall clock.
    expect(gate?.now).toBeGreaterThanOrEqual(beforeSeconds);
    expect(gate?.now).toBeLessThanOrEqual(afterSeconds);
    expect(gate?.expectedSub).toBe("acct-clock");
  });

  it("returns undefined when the session view fetch fails (offline / unauthorized)", async () => {
    const gate = await buildEntitlementTokenGate(
      createSyncSecretStoreMock(MANAGED_SECRETS),
      "managed",
      {
        managedClient: sessionClient({ ok: false }),
        tokenStore: createMemoryEntitlementTokenStore(),
      },
    );

    expect(gate).toBeUndefined();
  });

  it("never throws — a session-view error resolves to no gate", async () => {
    const gate = await buildEntitlementTokenGate(
      createSyncSecretStoreMock(MANAGED_SECRETS),
      "managed",
      {
        managedClient: sessionClient({ throws: true }),
        tokenStore: createMemoryEntitlementTokenStore(),
      },
    );

    expect(gate).toBeUndefined();
  });

  it("returns undefined when the resolved account id is empty (cannot bind expectedSub)", async () => {
    const gate = await buildEntitlementTokenGate(
      createSyncSecretStoreMock(MANAGED_SECRETS),
      "managed",
      {
        managedClient: sessionClient({ ok: true, accountID: "" }),
        tokenStore: createMemoryEntitlementTokenStore(),
      },
    );

    expect(gate).toBeUndefined();
  });
});
