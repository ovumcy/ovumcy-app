import type { SyncSecretsRecord } from "../sync/sync-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  connectBackupSyncAccount,
  updateBackupSyncRenewal,
} from "./backup-sync-screen-service";
import { loadSettingsScreenState } from "./settings-state-service";

const originalFetch = global.fetch;

const PREPARED_MANAGED_SECRETS: SyncSecretsRecord = {
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
  managedAuthSessionToken: null,
};

describe("connectBackupSyncAccount managed plan refresh", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("refreshes the cloud plan to active right after a managed register, without reopening the screen", async () => {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);

    // Prepared but not yet connected: plan status starts "unknown".
    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    expect(initialState.managedPremiumAccess.planStatus).toBe("unknown");

    global.fetch = jest
      .fn()
      // POST /auth/register
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account_id: "acct-1",
            email: "owner@example.com",
            session_token: "managed-session-1",
            session_expires_at: "2026-06-19T08:15:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "billing_subscription",
              updated_at: "2026-03-19T08:15:00.000Z",
              effective_at: "2026-03-19T08:15:00.000Z",
              explanation: "Trial active.",
            },
            recovery_code: "recovery-code-1",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      )
      // GET /account/billing (the refresh added by the fix)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            has_active_plan: true,
            premium_features: {
              doctor_pdf: true,
              advanced_insights: true,
              advanced_fertility: true,
              extended_reports: true,
              partner_access: true,
              reminders: true,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch;

    const result = await connectBackupSyncAccount(
      storage,
      secretStore,
      initialState,
      { login: "owner@example.com", password: "very-secure-pass" },
      "register",
      new Date(2026, 2, 19),
    );

    expect(result.ok).toBe(true);
    if (!result.ok || !("state" in result)) {
      throw new Error("expected a connected state result");
    }
    expect(result.state.managedPremiumAccess).toEqual({
      planStatus: "active",
      doctorPDF: true,
      reminders: true,
      activeSubscription: null,
      billingManagement: {
        canManageRenewal: false,
        canCancelAtPeriodEnd: false,
        canResumeRenewal: false,
      },
      offers: [],
    });
  });
});

describe("updateBackupSyncRenewal", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createConnectedManagedState(storage: ReturnType<typeof createLocalAppStorageMock>) {
    const preferences = {
      mode: "managed" as const,
      endpointInput: "",
      normalizedEndpoint: "https://sync.ovumcy.cloud",
      deviceLabel: "Pixel 7",
      setupStatus: "connected" as const,
      preparedAt: "2026-03-19T08:15:00.000Z",
      lastRemoteGeneration: 7,
      lastSyncedAt: "2026-03-19T09:00:00.000Z",
    };
    (storage.readSyncPreferencesRecord as jest.Mock).mockResolvedValue(preferences);
    return preferences;
  }

  it("returns not_connected without a managed session and never calls the server", async () => {
    const storage = createLocalAppStorageMock();
    createConnectedManagedState(storage);
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      updateBackupSyncRenewal(
        storage,
        secretStore,
        state,
        "cancel_at_period_end",
        new Date("2026-03-19T10:00:00.000Z"),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "not_connected" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("cancels at period end, refreshes state from the returned snapshot, and updates the cache", async () => {
    const storage = createLocalAppStorageMock();
    createConnectedManagedState(storage);
    const secretStore = createSyncSecretStoreMock({
      ...PREPARED_MANAGED_SECRETS,
      managedAuthSessionToken: "managed-session-1",
    });

    const fetchSpy = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/account/billing/renewal") && init?.method === "PUT") {
        expect(init.body).toBe(JSON.stringify({ cancel_at_period_end: true }));
        return new Response(
          JSON.stringify({
            has_active_plan: true,
            premium_features: { doctor_pdf: true, reminders: true },
            active_subscription: {
              status: "active",
              current_period_ends_at: "2026-04-19T00:00:00.000Z",
              cancel_at_period_end: true,
            },
            billing_management: {
              can_manage_renewal: true,
              can_cancel_at_period_end: false,
              can_resume_renewal: true,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/auth/session")) {
        return new Response(
          JSON.stringify({
            account_id: "acct-1",
            email: "owner@example.com",
            session_expires_at: "2026-06-19T08:15:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "billing_subscription",
              updated_at: "2026-03-19T08:15:00.000Z",
              effective_at: "2026-03-19T08:15:00.000Z",
              explanation: "Trial active.",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/account/billing")) {
        return new Response(
          JSON.stringify({
            has_active_plan: true,
            billing_management: {
              can_manage_renewal: true,
              can_cancel_at_period_end: true,
              can_resume_renewal: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch in test: ${url}`);
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    expect(state.managedPremiumAccess.billingManagement.canCancelAtPeriodEnd).toBe(
      true,
    );

    const now = new Date("2026-03-19T10:00:00.000Z");
    const result = await updateBackupSyncRenewal(
      storage,
      secretStore,
      state,
      "cancel_at_period_end",
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok renewal result");
    }
    expect(result.state.managedPremiumAccess.billingManagement).toEqual({
      canManageRenewal: true,
      canCancelAtPeriodEnd: false,
      canResumeRenewal: true,
    });
    expect(
      result.state.managedPremiumAccess.activeSubscription?.cancelAtPeriodEnd,
    ).toBe(true);
    // The refreshed snapshot doubles as the new offline-grace cache entry.
    expect(storage.writeManagedBillingCacheRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshot: expect.objectContaining({
          hasActivePlan: true,
          fetchedAt: now.toISOString(),
        }),
      }),
    );
  });

  it("maps a billing_management_unavailable rejection", async () => {
    const storage = createLocalAppStorageMock();
    createConnectedManagedState(storage);
    const secretStore = createSyncSecretStoreMock({
      ...PREPARED_MANAGED_SECRETS,
      managedAuthSessionToken: "managed-session-1",
    });
    // Every endpoint rejects: session load degrades to "unknown" plan, the
    // renewal PUT surfaces the specific error code under test.
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: "billing_management_unavailable" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    ) as unknown as typeof fetch;
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );

    await expect(
      updateBackupSyncRenewal(
        storage,
        secretStore,
        state,
        "resume",
        new Date("2026-03-19T10:00:00.000Z"),
      ),
    ).resolves.toEqual({
      ok: false,
      errorCode: "billing_management_unavailable",
    });
  });
});
