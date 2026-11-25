import { createSyncSecretsRecord } from "../security/sync-crypto";
import type { SyncSecretStore } from "../security/sync-secret-store";
import { clearWipeScopeSecrets } from "../security/wipe-scope-secrets";
import { resolveVerifiedEntitlements } from "../services/entitlement-token-service";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { entitlementTokenStore } from "./app-wipe-scope-secret-stores";
import type { ManagedCloudAPIClient } from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import {
  createDefaultSyncPreferencesRecord,
  type SyncPreferencesRecord,
} from "./sync-contract";
import {
  clearLocalSyncSession,
  connectSyncAccount,
  disconnectSyncAccount,
  finalizeSyncRecoveryAfterTOTP,
  finalizeSyncSessionAfterTOTP,
  persistGuestPartnerSession,
} from "./sync-client-service";

jest.mock("./app-wipe-scope-secret-stores", () => ({
  certPinStore: {},
  entitlementTokenStore: { clearEntitlementToken: jest.fn().mockResolvedValue(undefined) },
}));

const NOW = new Date("2026-03-20T08:05:00.000Z");

const managedPreferences: SyncPreferencesRecord = {
  ...createDefaultSyncPreferencesRecord(),
  mode: "managed",
  deviceLabel: "Pixel 7",
  setupStatus: "connected",
};

function entitlement() {
  return {
    syncAllowed: true,
    source: "manual",
    updatedAt: NOW.toISOString(),
    effectiveAt: NOW.toISOString(),
    explanation: "beta access",
  };
}

function managedClient(): ManagedCloudAPIClient {
  return {
    login: jest.fn().mockResolvedValue({
      ok: true,
      auth: {
        accountID: "account-1",
        login: "a3f9-0c12-77be-4d01",
        sessionToken: "managed-session",
        sessionExpiresAt: "2026-03-20T20:00:00.000Z",
        entitlement: entitlement(),
      },
    }),
    getSession: jest.fn().mockResolvedValue({
      ok: true,
      session: {
        accountID: "account-1",
        login: "a3f9-0c12-77be-4d01",
        sessionExpiresAt: "2026-03-20T20:00:00.000Z",
        entitlement: entitlement(),
        twoFactorEnabled: true,
      },
    }),
    createSyncSession: jest.fn().mockResolvedValue({
      ok: true,
      auth: {
        accountID: "account-1",
        sessionToken: "sync-session-1",
        sessionExpiresAt: "2026-03-21T08:00:00.000Z",
      },
    }),
    logout: jest.fn().mockResolvedValue({ ok: true }),
  } as unknown as ManagedCloudAPIClient;
}

function recoveryClient(wrappedKey: unknown): SyncAPIClient {
  return {
    getCapabilities: jest.fn().mockResolvedValue({
      ok: true,
      capabilities: {
        mode: "managed",
        syncEnabled: true,
        recoverySupported: true,
        pushSupported: false,
        portalSupported: false,
        advancedCloudInsights: false,
        maxDevices: 5,
        maxBlobBytes: 16 << 20,
      },
    }),
    getRecoveryKey: jest.fn().mockResolvedValue({ ok: true, recoveryKey: wrappedKey }),
    putRecoveryKey: jest.fn().mockResolvedValue({ ok: true }),
    attachDevice: jest.fn().mockResolvedValue({
      ok: true,
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: NOW.toISOString(),
        lastSeenAt: NOW.toISOString(),
      },
    }),
  } as unknown as SyncAPIClient;
}

function storedSecretStore(): SyncSecretStore {
  return createSyncSecretStoreMock({
    ...createSyncSecretsRecord("Pixel 7", NOW).record,
    authSessionToken: "sync-session-0",
    managedAuthSessionToken: "managed-session-0",
  });
}

// The billing cache is reset before the new session's secrets, so a stop
// between the two never leaves the previous session's snapshot readable as the
// new session's offline grace, and again after the session is stored, so a
// previous-session billing load that slipped in between cannot leave one.
function expectBillingResetBeforeSecretWrite(
  storage: ReturnType<typeof createLocalAppStorageMock>,
  writeSyncSecrets: jest.SpyInstance,
) {
  const reset = storage.writeManagedBillingCacheRecord as jest.Mock;
  const writePreferences = storage.writeSyncPreferencesRecord as jest.Mock;
  expect(reset).toHaveBeenCalledTimes(2);
  for (const call of reset.mock.calls) {
    expect(call[0]).toEqual({ snapshot: null, dismissedOfferIDs: [] });
  }
  expect(writeSyncSecrets).toHaveBeenCalled();
  const [firstReset = Infinity, lastReset = -Infinity] = reset.mock.invocationCallOrder;
  const firstSecretWrite = Math.min(...writeSyncSecrets.mock.invocationCallOrder);
  const lastPreferencesWrite = Math.max(...writePreferences.mock.invocationCallOrder);
  expect(firstReset).toBeLessThan(firstSecretWrite);
  expect(lastReset).toBeGreaterThan(lastPreferencesWrite);
}

beforeEach(() => {
  (entitlementTokenStore.clearEntitlementToken as jest.Mock).mockClear();
});

describe("billing-cache reset at a new managed session", () => {
  it("resets before storing the session on a managed connect", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = storedSecretStore();
    const writeSyncSecrets = jest.spyOn(secretStore, "writeSyncSecrets");

    const result = await connectSyncAccount(
      storage,
      secretStore,
      { ...managedPreferences, setupStatus: "local_ready" },
      { login: "alice@example.com", password: "correct horse battery staple" },
      "login",
      NOW,
      jest.fn(),
      jest.fn().mockReturnValue(managedClient()),
    );

    expect(result.ok).toBe(true);
    expectBillingResetBeforeSecretWrite(storage, writeSyncSecrets);
  });

  it("resets before storing the session on a managed TOTP finalize", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = storedSecretStore();
    const writeSyncSecrets = jest.spyOn(secretStore, "writeSyncSecrets");

    const result = await finalizeSyncSessionAfterTOTP(
      storage,
      secretStore,
      { ...managedPreferences, setupStatus: "local_ready" },
      { sessionToken: "managed-after-totp" },
      jest.fn(),
      jest.fn().mockReturnValue(managedClient()),
    );

    expect(result.ok).toBe(true);
    expectBillingResetBeforeSecretWrite(storage, writeSyncSecrets);
  });

  it("resets before storing the session on a guest accept", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = storedSecretStore();
    const writeSyncSecrets = jest.spyOn(secretStore, "writeSyncSecrets");

    await persistGuestPartnerSession(
      storage,
      secretStore,
      managedPreferences,
      { sessionToken: "guest-session", sessionExpiresAt: "2026-04-20T08:00:00.000Z" },
      NOW,
    );

    expectBillingResetBeforeSecretWrite(storage, writeSyncSecrets);
  });

  it("resets before storing the session on a managed phrase recovery", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const writeSyncSecrets = jest.spyOn(secretStore, "writeSyncSecrets");
    const account = createSyncSecretsRecord("Original device", NOW);

    const result = await finalizeSyncRecoveryAfterTOTP(
      storage,
      secretStore,
      { ...managedPreferences, setupStatus: "not_configured" },
      { sessionToken: "managed-after-totp", recoveryPhrase: account.recoveryPhrase },
      NOW,
      jest.fn().mockReturnValue(recoveryClient(account.record.wrappedKey)),
      jest.fn().mockReturnValue(managedClient()),
    );

    expect(result.ok).toBe(true);
    expectBillingResetBeforeSecretWrite(storage, writeSyncSecrets);
  });
});

describe("entitlement token at the end of a session", () => {
  it("clears the token of an ending managed session before the session secrets", async () => {
    const tokenStore = { clearEntitlementToken: jest.fn().mockResolvedValue(undefined) };
    const secretStore = storedSecretStore();
    const writeSyncSecrets = jest.spyOn(secretStore, "writeSyncSecrets");

    await clearLocalSyncSession(
      createLocalAppStorageMock(),
      secretStore,
      managedPreferences,
      tokenStore,
    );

    expect(tokenStore.clearEntitlementToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.clearEntitlementToken.mock.invocationCallOrder[0]).toBeLessThan(
      writeSyncSecrets.mock.invocationCallOrder[0] ?? -Infinity,
    );
  });

  it("keeps the token when a self-hosted session ends, since the managed session stays", async () => {
    const tokenStore = { clearEntitlementToken: jest.fn().mockResolvedValue(undefined) };

    await clearLocalSyncSession(
      createLocalAppStorageMock(),
      storedSecretStore(),
      { ...managedPreferences, mode: "self_hosted", endpointInput: "192.168.1.20:8080" },
      tokenStore,
    );

    expect(tokenStore.clearEntitlementToken).not.toHaveBeenCalled();
  });

  it("clears the app's token store on a managed disconnect", async () => {
    await disconnectSyncAccount(
      createLocalAppStorageMock(),
      storedSecretStore(),
      managedPreferences,
      jest.fn(),
      jest.fn().mockReturnValue(managedClient()),
      0,
    );

    expect(entitlementTokenStore.clearEntitlementToken).toHaveBeenCalledTimes(1);
  });

  it("fails the sign-out and keeps the session when the token cannot be cleared", async () => {
    const tokenStore = {
      clearEntitlementToken: jest.fn().mockRejectedValue(new Error("keychain locked")),
    };
    const secretStore = storedSecretStore();

    await expect(
      clearLocalSyncSession(
        createLocalAppStorageMock(),
        secretStore,
        managedPreferences,
        tokenStore,
      ),
    ).rejects.toThrow("keychain locked");
    await expect(secretStore.readSyncSecrets()).resolves.toMatchObject({
      managedAuthSessionToken: "managed-session-0",
    });
  });

  it("never writes back a token whose mint was in flight across the sign-out", async () => {
    let answerMint: (value: unknown) => void = () => undefined;
    const client = {
      getEntitlementToken: jest.fn(
        () =>
          new Promise((resolve) => {
            answerMint = resolve;
          }),
      ),
    } as unknown as ManagedCloudAPIClient;
    const tokenStore = {
      readEntitlementToken: jest.fn().mockResolvedValue(null),
      writeEntitlementToken: jest.fn().mockResolvedValue(undefined),
      clearEntitlementToken: jest.fn().mockResolvedValue(undefined),
    };

    const resolving = resolveVerifiedEntitlements({
      store: tokenStore,
      managedSessionToken: "managed-session-0",
      expectedSub: "account-1",
      now: Math.floor(NOW.getTime() / 1000),
      client,
    });
    await clearLocalSyncSession(
      createLocalAppStorageMock(),
      storedSecretStore(),
      managedPreferences,
      tokenStore,
    );
    answerMint({ ok: true, result: { token: "minted-before-sign-out" } });

    await expect(resolving).resolves.toEqual({ status: "unavailable" });
    expect(tokenStore.clearEntitlementToken).toHaveBeenCalledTimes(1);
    expect(tokenStore.writeEntitlementToken).not.toHaveBeenCalled();
  });

  it("never writes back a token whose mint was in flight across a local wipe", async () => {
    let answerMint: (value: unknown) => void = () => undefined;
    const client = {
      getEntitlementToken: jest.fn(
        () =>
          new Promise((resolve) => {
            answerMint = resolve;
          }),
      ),
    } as unknown as ManagedCloudAPIClient;
    const tokenStore = {
      readEntitlementToken: jest.fn().mockResolvedValue(null),
      writeEntitlementToken: jest.fn().mockResolvedValue(undefined),
      clearEntitlementToken: jest.fn().mockResolvedValue(undefined),
    };

    const resolving = resolveVerifiedEntitlements({
      store: tokenStore,
      managedSessionToken: "managed-session-0",
      expectedSub: "account-1",
      now: Math.floor(NOW.getTime() / 1000),
      client,
    });
    await clearWipeScopeSecrets(storedSecretStore(), {
      certPinStore: { clearAll: jest.fn().mockResolvedValue(undefined) },
      entitlementTokenStore: tokenStore,
      partnerShareSecretStore: {
        clearPartnerShareSecrets: jest.fn().mockResolvedValue(undefined),
      },
    });
    answerMint({ ok: true, result: { token: "minted-before-wipe" } });

    await expect(resolving).resolves.toEqual({ status: "unavailable" });
    expect(tokenStore.writeEntitlementToken).not.toHaveBeenCalled();
  });
});
