import { createSyncSecretsRecord } from "../security/sync-crypto";
import { clearManagedPartnerInviteToken, readManagedPartnerInviteToken, stashManagedPartnerInviteToken } from "../security/managed-partner-invite-token-buffer";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  createInMemorySecureStoreBackend,
  createSecretStoresOverBackend,
  createWipeScopeSecretStoresMock,
  listSecureStoreKeysFromSource,
} from "../test/secure-store-inventory";
import {
  buildAccountDeletionViewModel,
  deleteOvumcyAccount,
} from "./account-deletion-service";
import type {
  ManagedCloudActiveSubscription,
  ManagedCloudAPIClient,
} from "./managed-cloud-api-client";
import type { SyncAPIClient } from "./sync-api-client";
import { createDefaultSyncPreferencesRecord } from "./sync-contract";

function createActiveSubscriptionFixture(
  overrides: Partial<ManagedCloudActiveSubscription> = {},
): ManagedCloudActiveSubscription {
  return {
    planCode: "plus",
    planName: "Plus",
    billingInterval: "monthly",
    source: "play",
    status: "active",
    currency: "USD",
    amountMinor: 999,
    displayAmount: "$9.99",
    currentPeriodStartsAt: "2026-05-01T00:00:00.000Z",
    currentPeriodEndsAt: "2026-07-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

function createAPIClientMock(
  overrides: Partial<SyncAPIClient> = {},
): SyncAPIClient {
  return {
    register: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    deleteAccount: jest.fn(),
    getCapabilities: jest.fn(),
    getRecoveryKey: jest.fn(),
    attachDevice: jest.fn(),
    putRecoveryKey: jest.fn(),
    putBlob: jest.fn(),
    getBlob: jest.fn(),
    ...overrides,
  } as SyncAPIClient;
}

function createManagedClientMock(
  overrides: Partial<ManagedCloudAPIClient> = {},
): ManagedCloudAPIClient {
  return {
    register: jest.fn(),
    login: jest.fn(),
    getSession: jest.fn(),
    createSyncSession: jest.fn(),
    logout: jest.fn(),
    deleteAccount: jest.fn(),
    ...overrides,
  } as ManagedCloudAPIClient;
}

describe("buildAccountDeletionViewModel", () => {
  it("requires the subscription warning only for a store/paid-backed subscription (active or canceling)", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const preferences = { ...createDefaultSyncPreferencesRecord(), mode: "managed" as const };

    const activeViewModel = buildAccountDeletionViewModel({
      hasConnectedSession: true,
      preferences,
      activeSubscription: createActiveSubscriptionFixture({ status: "active" }),
      planStatus: "inactive",
      now,
    });
    expect(activeViewModel.requiresSubscriptionWarning).toBe(true);

    // cancelAtPeriodEnd on a paid plan classifies as "canceling", which still
    // requires the warning: the subscription remains billable until period end.
    const cancelingViewModel = buildAccountDeletionViewModel({
      hasConnectedSession: true,
      preferences,
      activeSubscription: createActiveSubscriptionFixture({
        cancelAtPeriodEnd: true,
      }),
      planStatus: "inactive",
      now,
    });
    expect(cancelingViewModel.requiresSubscriptionWarning).toBe(true);
  });

  // Trigger matrix (none/trialing/active/canceling/ended) below. "trialing" is
  // deliberately a "false" case even though describeSubscriptionCountdown
  // classifies it as a live, non-"none"/"ended" state: the managed backend
  // starts every account on a 30-day trial with no payment method, and
  // in-app purchase is not possible on-device until Google Play Billing (the
  // first planned IAP channel — see README.md's "Project Status")
  // lands, so a trial can never actually be store/paid-backed today. See the
  // `requiresSubscriptionWarning` doc comment on `AccountDeletionViewModel`
  // for why `ManagedCloudActiveSubscription.source` isn't used to distinguish
  // a store-backed trial from a plain one.
  it("does not require the subscription warning for a pure trial, no subscription, an ended one, or self-hosted/local-only mode", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");

    expect(
      buildAccountDeletionViewModel({
        hasConnectedSession: true,
        preferences: { ...createDefaultSyncPreferencesRecord(), mode: "managed" },
        activeSubscription: createActiveSubscriptionFixture({ status: "trialing" }),
        planStatus: "inactive",
        now,
      }).requiresSubscriptionWarning,
    ).toBe(false);

    expect(
      buildAccountDeletionViewModel({
        hasConnectedSession: true,
        preferences: { ...createDefaultSyncPreferencesRecord(), mode: "managed" },
        activeSubscription: null,
        planStatus: "inactive",
        now,
      }).requiresSubscriptionWarning,
    ).toBe(false);

    expect(
      buildAccountDeletionViewModel({
        hasConnectedSession: false,
        preferences: { ...createDefaultSyncPreferencesRecord(), mode: "self_hosted" },
        activeSubscription: null,
        planStatus: "inactive",
        now,
      }).requiresSubscriptionWarning,
    ).toBe(false);

    // Period already ended (well before `now`): describeSubscriptionCountdown
    // classifies this as "ended", not "active" — no warning required.
    expect(
      buildAccountDeletionViewModel({
        hasConnectedSession: true,
        preferences: { ...createDefaultSyncPreferencesRecord(), mode: "managed" },
        activeSubscription: createActiveSubscriptionFixture({
          currentPeriodStartsAt: "2026-04-01T00:00:00.000Z",
          currentPeriodEndsAt: "2026-05-01T00:00:00.000Z",
        }),
        planStatus: "inactive",
        now,
      }).requiresSubscriptionWarning,
    ).toBe(false);
  });

  describe("billing status", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const managed = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
    };

    it("flags unknown billing (failed live fetch) on a connected managed account without claiming a subscription", () => {
      const viewModel = buildAccountDeletionViewModel({
        hasConnectedSession: true,
        preferences: managed,
        activeSubscription: null,
        planStatus: "unknown",
        now,
      });
      expect(viewModel.billingStatusUnknown).toBe(true);
      expect(viewModel.requiresSubscriptionWarning).toBe(false);
    });

    it("shows no billing warning for a confirmed no-subscription account", () => {
      const viewModel = buildAccountDeletionViewModel({
        hasConnectedSession: true,
        preferences: managed,
        activeSubscription: null,
        planStatus: "inactive",
        now,
      });
      expect(viewModel.billingStatusUnknown).toBe(false);
      expect(viewModel.requiresSubscriptionWarning).toBe(false);
    });

    it("keeps the active-subscription warning and never reports it as unknown", () => {
      const viewModel = buildAccountDeletionViewModel({
        hasConnectedSession: true,
        preferences: managed,
        activeSubscription: createActiveSubscriptionFixture({ status: "active" }),
        planStatus: "active",
        now,
      });
      expect(viewModel.requiresSubscriptionWarning).toBe(true);
      expect(viewModel.billingStatusUnknown).toBe(false);
    });

    it("never flags unknown billing without a managed session (self-hosted or signed out)", () => {
      expect(
        buildAccountDeletionViewModel({
          hasConnectedSession: true,
          preferences: {
            ...createDefaultSyncPreferencesRecord(),
            mode: "self_hosted",
          },
          activeSubscription: null,
          planStatus: "unknown",
          now,
        }).billingStatusUnknown,
      ).toBe(false);
      expect(
        buildAccountDeletionViewModel({
          hasConnectedSession: false,
          preferences: managed,
          activeSubscription: null,
          planStatus: "unknown",
          now,
        }).billingStatusUnknown,
      ).toBe(false);
    });
  });

  it("mirrors the mode and connected-session flags through unchanged", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const viewModel = buildAccountDeletionViewModel({
      hasConnectedSession: false,
      preferences: { ...createDefaultSyncPreferencesRecord(), mode: "self_hosted" },
      activeSubscription: null,
      planStatus: "inactive",
      now,
    });
    expect(viewModel.mode).toBe("self_hosted");
    expect(viewModel.hasConnectedSession).toBe(false);
  });
});

describe("deleteOvumcyAccount", () => {
  afterEach(() => {
    clearManagedPartnerInviteToken();
  });

  it("calls DELETE /account on the managed backend, then clears secrets, the pending invite buffer, and local data", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      managedAuthSessionToken: "managed-session-1",
    });
    stashManagedPartnerInviteToken("pending-invite-token-value-long-enough");
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      setupStatus: "connected" as const,
    };
    const deleteAccount = jest.fn().mockResolvedValue({ ok: true });
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({ deleteAccount }),
    );

    const result = await deleteOvumcyAccount(
      storage,
      secretStore,
      createWipeScopeSecretStoresMock(),
      preferences,
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: true });
    expect(deleteAccount).toHaveBeenCalledWith("managed-session-1");
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
    expect(readManagedPartnerInviteToken()).toBe("");
    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
  });

  it("calls DELETE /account on the self-hosted backend using the normalized endpoint", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      normalizedEndpoint: "http://192.168.1.20:8080",
      setupStatus: "connected" as const,
    };
    const deleteAccount = jest.fn().mockResolvedValue({ ok: true });
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({ deleteAccount }),
    );

    const result = await deleteOvumcyAccount(
      storage,
      secretStore,
      createWipeScopeSecretStoresMock(),
      preferences,
      apiClientFactory,
    );

    expect(result).toEqual({ ok: true });
    expect(deleteAccount).toHaveBeenCalledWith("session-1");
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
  });

  it("skips the network call and only wipes local state when there is no session for the active mode (local-only)", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(null);
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      setupStatus: "not_configured" as const,
    };
    const managedClientFactory = jest.fn();
    const apiClientFactory = jest.fn();

    const result = await deleteOvumcyAccount(
      storage,
      secretStore,
      createWipeScopeSecretStoresMock(),
      preferences,
      apiClientFactory,
      managedClientFactory,
    );

    expect(result).toEqual({ ok: true });
    expect(managedClientFactory).not.toHaveBeenCalled();
    expect(apiClientFactory).not.toHaveBeenCalled();
    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
  });

  it("aborts and does NOT wipe local data when the managed server delete fails", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      managedAuthSessionToken: "managed-session-1",
    });
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      setupStatus: "connected" as const,
    };
    const deleteAccount = jest
      .fn()
      .mockResolvedValue({ ok: false, errorCode: "network_failed" });
    const managedClientFactory = jest.fn().mockReturnValue(
      createManagedClientMock({ deleteAccount }),
    );

    const result = await deleteOvumcyAccount(
      storage,
      secretStore,
      createWipeScopeSecretStoresMock(),
      preferences,
      jest.fn(),
      managedClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "network_failed" });
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
    // Secrets must survive an aborted deletion exactly as they were.
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ managedAuthSessionToken: "managed-session-1" }),
    );
  });

  it("aborts and does NOT wipe local data when the self-hosted server delete fails", async () => {
    const storage = createLocalAppStorageMock();
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "session-1",
    });
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "self_hosted" as const,
      endpointInput: "192.168.1.20:8080",
      normalizedEndpoint: "http://192.168.1.20:8080",
      setupStatus: "connected" as const,
    };
    const deleteAccount = jest
      .fn()
      .mockResolvedValue({ ok: false, errorCode: "unauthorized" });
    const apiClientFactory = jest.fn().mockReturnValue(
      createAPIClientMock({ deleteAccount }),
    );

    const result = await deleteOvumcyAccount(
      storage,
      secretStore,
      createWipeScopeSecretStoresMock(),
      preferences,
      apiClientFactory,
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
    await expect(secretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ authSessionToken: "session-1" }),
    );
  });

  it("surfaces a generic error and leaves nothing half-cleared when the local wipe itself throws", async () => {
    const storage = createLocalAppStorageMock({
      clearAllLocalData: jest.fn().mockRejectedValue(new Error("disk full")),
    });
    const secretStore = createSyncSecretStoreMock(null);
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      setupStatus: "not_configured" as const,
    };

    const result = await deleteOvumcyAccount(
      storage,
      secretStore,
      createWipeScopeSecretStoresMock(),
      preferences,
    );

    expect(result).toEqual({ ok: false, errorCode: "generic" });
  });

  it("leaves no wipe-scope SecureStore key behind after deleting the account", async () => {
    const inventory = listSecureStoreKeysFromSource();
    // The local-data key belongs to the storage reset, which deletes it and
    // reseeds a fresh one; every other SecureStore key is the deletion's.
    const storageOwnedKeys = inventory
      .filter((entry) => entry.storeModule === "local-data-key-store")
      .map((entry) => entry.key);
    expect(storageOwnedKeys).toEqual(["ovumcy.local-data-key"]);
    expect(inventory.length).toBeGreaterThan(storageOwnedKeys.length);

    const backend = createInMemorySecureStoreBackend(
      inventory.map((entry) => entry.key),
    );
    const { syncSecretStore, wipeScopeSecretStores } =
      createSecretStoresOverBackend(backend);
    await syncSecretStore.writeSyncSecrets({
      ...createSyncSecretsRecord("Pixel 7", new Date("2026-03-20T08:00:00.000Z"))
        .record,
      managedAuthSessionToken: "managed-session-1",
    });
    const storage = createLocalAppStorageMock();
    const deleteAccount = jest.fn().mockResolvedValue({ ok: true });
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      setupStatus: "connected" as const,
    };

    const result = await deleteOvumcyAccount(
      storage,
      syncSecretStore,
      wipeScopeSecretStores,
      preferences,
      jest.fn(),
      jest.fn().mockReturnValue(createManagedClientMock({ deleteAccount })),
    );

    expect(result).toEqual({ ok: true });
    expect(deleteAccount).toHaveBeenCalledWith("managed-session-1");
    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
    expect(backend.keys()).toEqual(storageOwnedKeys);
  });

  it("clears every other secret and still wipes local data, but reports failure, when one secret clear throws", async () => {
    const inventory = listSecureStoreKeysFromSource();
    const backend = createInMemorySecureStoreBackend(
      inventory.map((entry) => entry.key),
    );
    const { syncSecretStore, wipeScopeSecretStores } =
      createSecretStoresOverBackend(backend);
    const storage = createLocalAppStorageMock();
    const preferences = {
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed" as const,
      setupStatus: "not_configured" as const,
    };

    const result = await deleteOvumcyAccount(
      storage,
      syncSecretStore,
      {
        ...wipeScopeSecretStores,
        entitlementTokenStore: {
          clearEntitlementToken: jest
            .fn()
            .mockRejectedValue(new Error("keychain locked")),
        },
      },
      preferences,
    );

    expect(result).toEqual({ ok: false, errorCode: "generic" });
    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
    expect(backend.keys()).toEqual(
      ["ovumcy.entitlement-token", "ovumcy.local-data-key"].sort(),
    );
  });
});
