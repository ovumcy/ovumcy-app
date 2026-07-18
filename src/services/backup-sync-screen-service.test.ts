import {
  createDefaultSyncPreferencesRecord,
  type SyncSecretsRecord,
} from "../sync/sync-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  acceptBackupSyncPartnerInviteAsGuest,
  connectBackupSyncAccount,
  updateBackupSyncRenewal,
  upgradeBackupSyncGuestAccount,
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

describe("acceptBackupSyncPartnerInviteAsGuest", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const GUEST_ACCEPT_RESPONSE = {
    account_id: "guest-account-1",
    session_token: "guest-session-1",
    session_expires_at: "2026-04-12T00:00:00.000Z",
    grant: {
      id: "grant-9",
      owner_account_id: "owner-1",
      partner_account_id: "guest-account-1",
      access_level: "full",
      source_invite_id: "invite-9",
      accepted_at: "2026-04-05T08:00:00.000Z",
      last_seen_at: "2026-04-05T08:00:00.000Z",
      created_at: "2026-04-05T08:00:00.000Z",
      updated_at: "2026-04-05T08:00:00.000Z",
    },
    invite: {
      id: "invite-9",
      owner_account_id: "owner-1",
      access_level: "full",
      status: "accepted",
      expires_at: "2026-04-10T00:00:00.000Z",
      accepted_at: "2026-04-05T08:00:00.000Z",
      accepted_account_id: "guest-account-1",
      created_by: "owner-1",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-05T08:00:00.000Z",
    },
  };

  it("redeems the invite with no bearer, persists the session on a brand-new device, and returns a connected managed state + grant", async () => {
    const storage = createLocalAppStorageMock();
    // A brand-new device: no local sync secrets prepared at all. The guest
    // accept must not require the "prepare local sync" step a normal
    // register/login does.
    const secretStore = createSyncSecretStoreMock();

    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 3, 5),
    );
    expect(initialState.hasSyncSession).toBe(false);
    expect(initialState.hasStoredSyncSecrets).toBe(false);

    global.fetch = jest
      .fn()
      // POST /auth/partner/invites/accept (unauthenticated guest accept)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(GUEST_ACCEPT_RESPONSE), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      // GET /account/billing (managed-premium refresh under the new session)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            has_active_plan: false,
            premium_features: {
              advanced_fertility: false,
              advanced_insights: false,
              doctor_pdf: false,
              extended_reports: false,
              partner_access: false,
              reminders: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch;

    const result = await acceptBackupSyncPartnerInviteAsGuest(
      storage,
      secretStore,
      initialState,
      "invite-token-9-fixture-padding",
      new Date(2026, 3, 5),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected a successful guest-accept result");
    }
    expect(result.grant).toEqual(expect.objectContaining({ id: "grant-9" }));
    expect(result.state.hasSyncSession).toBe(true);
    expect(result.state.syncPreferences.mode).toBe("managed");
    expect(result.state.syncPreferences.setupStatus).toBe("connected");

    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets?.managedAuthSessionToken).toBe("guest-session-1");
    expect(storedSecrets?.authSessionToken).toBeNull();

    const guestAcceptCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(guestAcceptCall[0])).toContain("/auth/partner/invites/accept");
    expect((guestAcceptCall[1]?.headers as Headers).has("Authorization")).toBe(
      false,
    );
  });

  it("forwards each mapped error key and persists no session", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 3, 5),
    );

    const errorCodes = [
      "partner_invite_not_found",
      "partner_invite_expired",
      "invalid_partner_invite",
      "partner_access_unavailable",
      "rate_limited",
    ] as const;

    for (const errorCode of errorCodes) {
      global.fetch = jest.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: errorCode }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ) as typeof fetch;

      const result = await acceptBackupSyncPartnerInviteAsGuest(
        storage,
        secretStore,
        initialState,
        "some-token",
        new Date(2026, 3, 5),
      );

      expect(result).toEqual({ ok: false, errorCode });
    }

    // None of the rejected attempts wrote a session.
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });
});

describe("upgradeBackupSyncGuestAccount", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const GUEST_SYNC_PREFERENCES = {
    ...createDefaultSyncPreferencesRecord(),
    mode: "managed" as const,
    setupStatus: "connected" as const,
    guestSessionExpiresAt: "2026-05-05T08:00:00.000Z",
  };

  // Loads a realistic guest-session LoadedSettingsState through the same
  // loadSettingsScreenState path the screen uses on focus, so the test
  // exercises upgradeBackupSyncGuestAccount against the same state shape the
  // real controller would pass it (rather than a hand-built stand-in).
  async function loadGuestState() {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue(GUEST_SYNC_PREFERENCES),
    });
    const secretStore = createSyncSecretStoreMock({
      ...PREPARED_MANAGED_SECRETS,
      managedAuthSessionToken: "guest-session-1",
    });

    global.fetch = jest
      .fn()
      // GET /auth/session (loadConnectedSyncCapabilities)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account_id: "guest-account-1",
            email: "guest+guest-account-1@guest.invalid",
            session_expires_at: "2026-05-05T08:00:00.000Z",
            sync_entitlement: {
              sync_allowed: false,
              source: "guest_partner",
              updated_at: "2026-04-05T08:00:00.000Z",
              effective_at: "2026-04-05T08:00:00.000Z",
              explanation: "guest partner",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      // GET /account/billing
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            has_active_plan: false,
            premium_features: {
              advanced_fertility: false,
              advanced_insights: false,
              doctor_pdf: false,
              extended_reports: false,
              partner_access: false,
              reminders: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ) as typeof fetch;

    const state = await loadSettingsScreenState(storage, secretStore, new Date(2026, 3, 5));
    expect(state.syncPreferences.guestSessionExpiresAt).toBe(
      "2026-05-05T08:00:00.000Z",
    );
    return { storage, secretStore, state };
  }

  it("returns unauthorized with no managed session and does not touch storage", async () => {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue(GUEST_SYNC_PREFERENCES),
    });
    const secretStore = createSyncSecretStoreMock();
    const state = await loadSettingsScreenState(storage, secretStore, new Date(2026, 3, 5));

    const result = await upgradeBackupSyncGuestAccount(storage, secretStore, state, {
      email: "owner@example.com",
      password: "very secure password 12345",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected an unauthorized failure");
    }
    expect(result.errorCode).toBe("unauthorized");
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("on success clears the guest marker in the returned state and surfaces the recovery code once", async () => {
    const { storage, secretStore, state } = await loadGuestState();

    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "guest-account-1",
          email: "owner@example.com",
          recovery_code: "fresh1234fresh1234fresh1234fresh",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as typeof fetch;

    const result = await upgradeBackupSyncGuestAccount(storage, secretStore, state, {
      email: "owner@example.com",
      password: "very secure password 12345",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected a successful upgrade result");
    }
    expect(result.email).toBe("owner@example.com");
    expect(result.recoveryCode).toBe("fresh1234fresh1234fresh1234fresh");
    // The one and only local side effect on success: the guest marker is
    // gone from BOTH the draft and saved preferences on the returned state,
    // so the "Keep your access" CTA disappears immediately.
    expect(result.state.syncPreferences.guestSessionExpiresAt).toBeNull();
    expect(result.state.savedSyncPreferences.guestSessionExpiresAt).toBeNull();
    // Still connected — upgrade never revokes or reissues the session.
    expect(result.state.hasSyncSession).toBe(true);

    const upgradeCall = (global.fetch as jest.Mock).mock.calls[0];
    expect(String(upgradeCall[0])).toContain("/account/upgrade");
    expect((upgradeCall[1]?.headers as Headers).get("Authorization")).toBe(
      "Bearer guest-session-1",
    );
  });

  it("clears the guest marker on account_not_guest so the CTA hides even though the call failed", async () => {
    const { storage, secretStore, state } = await loadGuestState();

    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "account_not_guest" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await upgradeBackupSyncGuestAccount(storage, secretStore, state, {
      email: "owner@example.com",
      password: "very secure password 12345",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected an account_not_guest failure");
    }
    expect(result.errorCode).toBe("account_not_guest");
    expect(result.state.syncPreferences.guestSessionExpiresAt).toBeNull();
  });

  it("leaves the guest marker untouched on a retryable error (invalid_registration_input)", async () => {
    const { storage, secretStore, state } = await loadGuestState();

    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "invalid_registration_input" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await upgradeBackupSyncGuestAccount(storage, secretStore, state, {
      email: "owner@example.com",
      password: "short",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected an invalid_registration_input failure");
    }
    expect(result.errorCode).toBe("invalid_registration_input");
    // Retryable: the guest is still a guest, so the CTA and form must stay
    // exactly as they were for a retry.
    expect(result.state.syncPreferences.guestSessionExpiresAt).toBe(
      "2026-05-05T08:00:00.000Z",
    );
  });
});
