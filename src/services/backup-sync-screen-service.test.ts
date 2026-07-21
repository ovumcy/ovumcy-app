import { fromByteArray } from "base64-js";

import { createEmptyDayLogRecord } from "../models/day-log";
import {
  buildSyncPayloadAad,
  createSyncSecretsRecord,
  encryptSyncPayload,
} from "../security/sync-crypto";
import {
  encodeSyncSnapshot,
  SYNC_SNAPSHOT_SCHEMA_VERSION,
} from "../sync/sync-snapshot-service";
import {
  createDefaultSyncPreferencesRecord,
  type SyncSecretsRecord,
} from "../sync/sync-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  acceptBackupSyncPartnerInviteAsGuest,
  clearUnauthorizedBackupSyncSession,
  completeBackupSyncTOTPChallenge,
  connectBackupSyncAccount,
  disconnectBackupSyncAccount,
  prepareBackupSyncSetup,
  recoverBackupSyncAccess,
  restoreBackupSyncSnapshot,
  saveBackupSyncDraft,
  updateBackupSyncRenewal,
  uploadBackupSyncSnapshot,
  upgradeBackupSyncGuestAccount,
} from "./backup-sync-screen-service";
import { createEmptySettingsManagedPremiumAccess } from "./settings-view-service";
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
  managedAuthSessionExpiresAt: null,
  managedRefreshToken: null,
  managedRefreshTokenExpiresAt: null,
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

  it("returns not_connected for a self-hosted state without ever reading local secrets", async () => {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
      }),
    });
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    const readSecretsSpy = jest.spyOn(secretStore, "readSyncSecrets");
    readSecretsSpy.mockClear();
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    await expect(
      updateBackupSyncRenewal(
        storage,
        secretStore,
        state,
        "resume",
        new Date("2026-03-19T10:00:00.000Z"),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "not_connected" });
    // Renewal management only ever applies to a managed account — the mode
    // guard short-circuits before even reading local secrets.
    expect(readSecretsSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps an unauthorized renewal rejection distinctly from the pre-check not_connected case", async () => {
    const storage = createLocalAppStorageMock();
    createConnectedManagedState(storage);
    const secretStore = createSyncSecretStoreMock({
      ...PREPARED_MANAGED_SECRETS,
      managedAuthSessionToken: "managed-session-1",
    });
    // Unlike the "no managed session" pre-check test above, this state loads
    // with a genuinely live session (the /auth/session and /account/billing
    // prefetch both succeed) — only the renewal PUT itself then rejects with
    // unauthorized (e.g. the session died between page load and the renewal
    // click), so the mapper's dedicated "unauthorized" case, not the
    // not_connected pre-check and not the generic fallback, must fire.
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/auth/session") && method === "GET") {
        return new Response(
          JSON.stringify({
            account_id: "acct-1",
            email: "owner@example.com",
            session_expires_at: "2026-06-19T08:15:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "manual",
              updated_at: "2026-03-19T08:15:00.000Z",
              effective_at: "2026-03-19T08:15:00.000Z",
              explanation: "Trial active.",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/account/billing") && method === "GET") {
        return new Response(
          JSON.stringify({
            has_active_plan: true,
            billing_management: {
              can_manage_renewal: true,
              can_cancel_at_period_end: false,
              can_resume_renewal: true,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/account/billing/renewal") && method === "PUT") {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    expect(state.hasSyncSession).toBe(true);

    await expect(
      updateBackupSyncRenewal(
        storage,
        secretStore,
        state,
        "resume",
        new Date("2026-03-19T10:00:00.000Z"),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "unauthorized" });
  });

  it("maps an unrecognized billing rejection to the generic renewal error", async () => {
    const storage = createLocalAppStorageMock();
    createConnectedManagedState(storage);
    const secretStore = createSyncSecretStoreMock({
      ...PREPARED_MANAGED_SECRETS,
      managedAuthSessionToken: "managed-session-1",
    });
    // Every endpoint rejects with a code outside mapRenewalAPIError's named
    // cases (unauthorized / billing_management_unavailable /
    // billing_subscription_conflict / billing_provider_unavailable /
    // network_failed): the mapper must collapse it to "generic" rather than
    // leaking the raw server code or throwing.
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
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
        "cancel_at_period_end",
        new Date("2026-03-19T10:00:00.000Z"),
      ),
    ).resolves.toEqual({ ok: false, errorCode: "generic" });
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
      // Settings probes the session again to bind the entitlement-token gate;
      // a non-session payload keeps the gate inert so snapshot features stand.
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
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

describe("prepareBackupSyncSetup", () => {
  it("forwards a device_label_required failure without persisting any secrets", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    const blankLabelState = {
      ...state,
      syncPreferences: { ...state.syncPreferences, deviceLabel: "   " },
    };

    const result = await prepareBackupSyncSetup(
      storage,
      secretStore,
      blankLabelState,
      new Date(2026, 2, 19),
    );

    expect(result).toEqual({ ok: false, errorCode: "device_label_required" });
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
  });
});

describe("saveBackupSyncDraft", () => {
  it("returns the mapped endpoint validation error without touching storage", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    const draftState = {
      ...state,
      syncPreferences: {
        ...state.syncPreferences,
        mode: "self_hosted" as const,
        endpointInput: "http://public-server.example.com",
      },
    };

    const result = await saveBackupSyncDraft(storage, secretStore, draftState);

    expect(result).toEqual({ ok: false, errorCode: "insecure_public_http" });
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("drops hasSyncSession in the rebuilt state when a materially-changed draft clears the locally stored secrets", async () => {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        preparedAt: "2026-03-19T08:15:00.000Z",
      }),
    });
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    const connectedState = { ...initialState, hasSyncSession: true };
    const draftState = {
      ...connectedState,
      syncPreferences: {
        ...connectedState.syncPreferences,
        deviceLabel: "A brand new device label",
      },
    };

    const result = await saveBackupSyncDraft(storage, secretStore, draftState);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected an ok draft-save result");
    }
    expect(result.state.hasStoredSyncSecrets).toBe(false);
    // Even though the caller still thought it had a live session, a material
    // change resets local secrets underneath it — the rebuilt state must not
    // keep claiming hasSyncSession, or the UI would show "connected" over
    // dead secrets.
    expect(result.state.hasSyncSession).toBe(false);
    await expect(secretStore.readSyncSecrets()).resolves.toBeNull();
  });

  it("keeps hasSyncSession false for a non-material draft save before ever connecting", async () => {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-03-19T08:15:00.000Z",
      }),
    });
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    expect(initialState.hasSyncSession).toBe(false);
    // Same mode/label/endpoint as saved — not a material change, so secrets
    // survive and hasSyncSession stays whatever it already was (false).
    const draftState = {
      ...initialState,
      syncPreferences: { ...initialState.syncPreferences },
    };

    const result = await saveBackupSyncDraft(storage, secretStore, draftState);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected an ok draft-save result");
    }
    expect(result.state.hasStoredSyncSecrets).toBe(true);
    expect(result.state.hasSyncSession).toBe(false);
  });
});

describe("connectBackupSyncAccount additional branches", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns login_required without attempting any network call", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await connectBackupSyncAccount(
      storage,
      secretStore,
      state,
      { login: "", password: "very-secure-pass" },
      "login",
      new Date(2026, 2, 19),
    );

    expect(result).toEqual({ ok: false, errorCode: "login_required" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("surfaces a TOTP challenge without persisting any session yet", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );

    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          account_id: "managed-account-1",
          email: "owner@example.com",
          session_token: "",
          session_expires_at: "",
          sync_entitlement: {
            sync_allowed: true,
            source: "manual",
            updated_at: "2026-03-19T08:15:00.000Z",
            effective_at: "2026-03-19T08:15:00.000Z",
            explanation: "Trial active.",
          },
          totp_challenge: {
            challenge_id: "chal-1",
            challenge_expires_at: "2026-03-19T08:20:00.000Z",
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
      "login",
      new Date(2026, 2, 19),
    );

    expect(result.ok).toBe(true);
    if (!result.ok || !("totpChallengeRequired" in result)) {
      throw new Error("expected a totp challenge result");
    }
    expect(result.totpChallengeRequired).toBe(true);
    expect(result.challengeID).toBe("chal-1");
    expect(result.challengeExpiresAt).toBe("2026-03-19T08:20:00.000Z");
    const secrets = await secretStore.readSyncSecrets();
    expect(secrets?.managedAuthSessionToken).toBeNull();
  });

  it("registers a self-hosted account and leaves the prior managed premium access untouched (self-hosted never reads managed billing)", async () => {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    // A prior sentinel value proves the self-hosted branch never overwrites
    // managedPremiumAccess with a managed billing fetch — loadManagedBillingSnapshot
    // short-circuits to null for self-hosted mode, so resolveManagedPremiumAccessAfterConnect
    // must fall back to this exact prior value.
    const seededState = {
      ...initialState,
      managedPremiumAccess: {
        ...createEmptySettingsManagedPremiumAccess(),
        planStatus: "inactive" as const,
      },
    };

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/auth/register") && method === "POST") {
        return new Response(
          JSON.stringify({
            account_id: "self-hosted-account-1",
            session_token: "self-hosted-session-1",
            session_expires_at: "2026-03-20T08:15:00.000Z",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/sync/capabilities") && method === "GET") {
        return new Response(
          JSON.stringify({
            mode: "self_hosted",
            sync_enabled: true,
            recovery_supported: false,
            push_supported: false,
            portal_supported: false,
            advanced_cloud_insights: false,
            max_devices: 5,
            max_blob_bytes: 1024,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/sync/devices") && method === "POST") {
        return new Response(
          JSON.stringify({
            device_id: "device-1",
            device_label: "Pixel 7",
            created_at: "2026-03-19T08:15:00.000Z",
            last_seen_at: "2026-03-19T08:15:00.000Z",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;

    const result = await connectBackupSyncAccount(
      storage,
      secretStore,
      seededState,
      { login: "alice", password: "correct horse battery staple" },
      "register",
      new Date(2026, 2, 19),
    );

    expect(result.ok).toBe(true);
    if (!result.ok || "totpChallengeRequired" in result) {
      throw new Error("expected a connected self-hosted state result");
    }
    expect(result.state.syncPreferences.mode).toBe("self_hosted");
    expect(result.state.syncPreferences.setupStatus).toBe("connected");
    expect(result.state.managedPremiumAccess).toEqual(
      seededState.managedPremiumAccess,
    );
  });
});

describe("completeBackupSyncTOTPChallenge", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("rejects a malformed code before any network call", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await completeBackupSyncTOTPChallenge(
      storage,
      secretStore,
      state,
      state.syncPreferences,
      { challengeID: "chal-1", code: "12" },
    );

    expect(result).toEqual({ ok: false, errorCode: "totp_invalid_code" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards a totp_challenge_invalid rejection from the server without finalising a session", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );

    global.fetch = jest.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "totp_challenge_invalid" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    ) as typeof fetch;

    const result = await completeBackupSyncTOTPChallenge(
      storage,
      secretStore,
      state,
      state.syncPreferences,
      { challengeID: "chal-1", code: "123456" },
    );

    expect(result).toEqual({ ok: false, errorCode: "totp_challenge_invalid" });
    const secrets = await secretStore.readSyncSecrets();
    expect(secrets?.managedAuthSessionToken).toBeNull();
  });

  it("forwards a finalize failure from the post-challenge session check without marking the session connected", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/auth/totp/challenge") && method === "POST") {
        return new Response(
          JSON.stringify({
            account_id: "managed-account-1",
            email: "owner@example.com",
            session_token: "totp-session-1",
            session_expires_at: "2026-03-20T08:15:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "manual",
              updated_at: "2026-03-19T08:15:00.000Z",
              effective_at: "2026-03-19T08:15:00.000Z",
              explanation: "Trial active.",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/auth/session") && method === "GET") {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;

    const result = await completeBackupSyncTOTPChallenge(
      storage,
      secretStore,
      state,
      state.syncPreferences,
      { challengeID: "chal-1", code: "123456" },
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
    const secrets = await secretStore.readSyncSecrets();
    expect(secrets?.managedAuthSessionToken).toBeNull();
  });

  it("finalises the session after a valid code and refreshes managed premium access", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/auth/totp/challenge") && method === "POST") {
        return new Response(
          JSON.stringify({
            account_id: "managed-account-1",
            email: "owner@example.com",
            session_token: "totp-session-1",
            session_expires_at: "2026-03-20T08:15:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "manual",
              updated_at: "2026-03-19T08:15:00.000Z",
              effective_at: "2026-03-19T08:15:00.000Z",
              explanation: "Trial active.",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/auth/session") && method === "GET") {
        return new Response(
          JSON.stringify({
            account_id: "managed-account-1",
            email: "owner@example.com",
            session_expires_at: "2026-03-20T08:15:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "manual",
              updated_at: "2026-03-19T08:15:00.000Z",
              effective_at: "2026-03-19T08:15:00.000Z",
              explanation: "Trial active.",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/account/billing") && method === "GET") {
        return new Response(
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
        );
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;

    const result = await completeBackupSyncTOTPChallenge(
      storage,
      secretStore,
      state,
      state.syncPreferences,
      { challengeID: "chal-1", code: "123456" },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected a connected result");
    }
    expect(result.connected).toBe(true);
    expect(result.state.hasSyncSession).toBe(true);
    expect(result.state.syncPreferences.setupStatus).toBe("connected");
    expect(result.state.managedPremiumAccess.planStatus).toBe("active");
    const secrets = await secretStore.readSyncSecrets();
    expect(secrets?.managedAuthSessionToken).toBe("totp-session-1");
  });

  it("persists the refresh token issued alongside the post-2FA session", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(PREPARED_MANAGED_SECRETS);
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/auth/totp/challenge") && method === "POST") {
        return new Response(
          JSON.stringify({
            account_id: "managed-account-1",
            email: "owner@example.com",
            session_token: "totp-session-1",
            session_expires_at: "2026-03-20T08:15:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "manual",
              updated_at: "2026-03-19T08:15:00.000Z",
              effective_at: "2026-03-19T08:15:00.000Z",
              explanation: "Trial active.",
            },
            refresh_token: "totp-refresh-1",
            refresh_token_expires_at: "2026-06-17T08:15:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/auth/session") && method === "GET") {
        return new Response(
          JSON.stringify({
            account_id: "managed-account-1",
            email: "owner@example.com",
            session_expires_at: "2026-03-20T08:15:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "manual",
              updated_at: "2026-03-19T08:15:00.000Z",
              effective_at: "2026-03-19T08:15:00.000Z",
              explanation: "Trial active.",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/account/billing") && method === "GET") {
        return new Response(
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
        );
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;

    const result = await completeBackupSyncTOTPChallenge(
      storage,
      secretStore,
      state,
      state.syncPreferences,
      { challengeID: "chal-1", code: "123456" },
    );

    expect(result.ok).toBe(true);
    const secrets = await secretStore.readSyncSecrets();
    // A session finalized after the second factor must be as renewable as one
    // from a password-only login; otherwise 2FA users alone would be pushed
    // back to re-entering credentials when the short session expires.
    expect(secrets?.managedAuthSessionToken).toBe("totp-session-1");
    expect(secrets?.managedRefreshToken).toBe("totp-refresh-1");
    expect(secrets?.managedRefreshTokenExpiresAt).toBe("2026-06-17T08:15:00.000Z");
    expect(secrets?.managedAuthSessionExpiresAt).toBe("2026-03-20T08:15:00.000Z");
  });
});

describe("recoverBackupSyncAccess", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns login_required before attempting any network recovery", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 3, 5),
    );
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await recoverBackupSyncAccess(
      storage,
      secretStore,
      state,
      { login: "", password: "correct horse battery staple" },
      "some recovery phrase",
      new Date(2026, 3, 5),
    );

    expect(result).toEqual({ ok: false, errorCode: "login_required" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("recovers self-hosted sync access, attaches a fresh device, and returns a connected state", async () => {
    const originalSecrets = createSyncSecretsRecord(
      "Original device",
      new Date("2026-04-01T08:00:00.000Z"),
    );
    const secretStore = createSyncSecretStoreMock(); // brand-new device: nothing prepared locally yet.
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Recovered Pixel",
      }),
    });
    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 3, 5),
    );
    expect(initialState.hasStoredSyncSecrets).toBe(false);

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/auth/login") && method === "POST") {
        return new Response(
          JSON.stringify({
            account_id: "self-hosted-account-1",
            session_token: "recovery-session-1",
            session_expires_at: "2026-04-06T08:00:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/sync/capabilities") && method === "GET") {
        return new Response(
          JSON.stringify({
            mode: "self_hosted",
            sync_enabled: true,
            recovery_supported: true,
            push_supported: false,
            portal_supported: false,
            advanced_cloud_insights: false,
            max_devices: 5,
            max_blob_bytes: 1024,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/sync/recovery-key") && method === "GET") {
        return new Response(
          JSON.stringify({
            algorithm: "xchacha20poly1305",
            kdf: "bip39_seed_hkdf_sha256",
            mnemonic_word_count: 12,
            wrap_nonce_hex: originalSecrets.record.wrappedKey.wrapNonceHex,
            wrapped_master_key_hex:
              originalSecrets.record.wrappedKey.wrappedMasterKeyHex,
            phrase_fingerprint_hex:
              originalSecrets.record.wrappedKey.phraseFingerprintHex,
            updated_at: "2026-04-01T08:00:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/sync/devices") && method === "POST") {
        return new Response(
          JSON.stringify({
            device_id: "recovered-device-1",
            device_label: "Recovered Pixel",
            created_at: "2026-04-05T08:05:00.000Z",
            last_seen_at: "2026-04-05T08:05:00.000Z",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;

    const result = await recoverBackupSyncAccess(
      storage,
      secretStore,
      initialState,
      { login: "alice@example.com", password: "correct horse battery staple" },
      originalSecrets.recoveryPhrase,
      new Date("2026-04-05T08:05:00.000Z"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected a successful recovery result");
    }
    expect(result.state.hasSyncSession).toBe(true);
    expect(result.state.syncPreferences.setupStatus).toBe("connected");
    expect(result.state.syncPreferences.mode).toBe("self_hosted");

    const storedSecrets = await secretStore.readSyncSecrets();
    expect(storedSecrets?.authSessionToken).toBe("recovery-session-1");
    expect(storedSecrets?.masterKeyHex).toBe(originalSecrets.record.masterKeyHex);
  });
});

describe("uploadBackupSyncSnapshot", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns sync_not_prepared without any network call when no local secrets are stored", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 3, 5),
    );
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await uploadBackupSyncSnapshot(
      storage,
      secretStore,
      state,
      new Date(2026, 3, 5),
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uploads a fresh-device snapshot after the no-existing-backup probe and marks the state connected", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-04-05T08:00:00.000Z"),
    );
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-04-05T08:00:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "upload-session-1",
    });
    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 3, 5),
    );

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/sync/blob") && method === "GET") {
        return new Response(JSON.stringify({ error: "blob_not_found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.endsWith("/sync/capabilities") && method === "GET") {
        return new Response(
          JSON.stringify({
            mode: "self_hosted",
            sync_enabled: true,
            recovery_supported: false,
            push_supported: false,
            portal_supported: false,
            advanced_cloud_insights: false,
            max_devices: 5,
            max_blob_bytes: 1024,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/sync/blob") && method === "PUT") {
        return new Response(
          JSON.stringify({
            schema_version: SYNC_SNAPSHOT_SCHEMA_VERSION,
            generation: 501,
            checksum_sha256: "checksum-upload-1",
            ciphertext_base64: "ignored-in-this-test",
            ciphertext_size: 0,
            updated_at: "2026-04-05T08:10:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;

    const result = await uploadBackupSyncSnapshot(
      storage,
      secretStore,
      initialState,
      new Date("2026-04-05T08:10:00.000Z"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected a successful upload result");
    }
    expect(result.state.hasSyncSession).toBe(true);
    expect(result.state.syncPreferences.lastRemoteGeneration).toBe(501);
    expect(result.state.syncPreferences.lastSyncedAt).toBe(
      "2026-04-05T08:10:00.000Z",
    );
    expect(result.state.syncPreferences.setupStatus).toBe("connected");
  });
});

describe("restoreBackupSyncSnapshot", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns sync_not_prepared without any network call when no local secrets are stored", async () => {
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock();
    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 3, 5),
    );
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await restoreBackupSyncSnapshot(
      storage,
      secretStore,
      state,
      new Date(2026, 3, 5),
    );

    expect(result).toEqual({ ok: false, errorCode: "sync_not_prepared" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("decrypts a remote snapshot, restores canonical local storage, and returns a connected state", async () => {
    const preparedSecrets = createSyncSecretsRecord(
      "Pixel 7",
      new Date("2026-04-05T08:00:00.000Z"),
    );
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-04-05T08:00:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const secretStore = createSyncSecretStoreMock({
      ...preparedSecrets.record,
      authSessionToken: "restore-session-1",
    });
    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 3, 5),
    );

    const dayLog = { ...createEmptyDayLogRecord("2026-03-11"), mood: 5 };
    const snapshotPayload = encodeSyncSnapshot({
      schemaVersion: SYNC_SNAPSHOT_SCHEMA_VERSION,
      createdAt: "2026-04-05T08:12:00.000Z",
      bootstrapState: await storage.readBootstrapState(),
      profile: await storage.readProfileRecord(),
      symptomRecords: await storage.listSymptomRecords(),
      dayLogs: [dayLog],
    });
    const encryptedEnvelope = encryptSyncPayload(
      preparedSecrets.record.masterKeyHex,
      snapshotPayload,
      buildSyncPayloadAad(preparedSecrets.record.device.deviceID),
    );
    const ciphertextBytes = new TextEncoder().encode(
      JSON.stringify(encryptedEnvelope),
    );
    const ciphertextBase64 = fromByteArray(ciphertextBytes);

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/sync/blob") && method === "GET") {
        return new Response(
          JSON.stringify({
            schema_version: SYNC_SNAPSHOT_SCHEMA_VERSION,
            generation: 456,
            checksum_sha256: "checksum-restore-1",
            ciphertext_base64: ciphertextBase64,
            ciphertext_size: ciphertextBytes.byteLength,
            updated_at: "2026-04-05T08:12:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;

    const result = await restoreBackupSyncSnapshot(
      storage,
      secretStore,
      initialState,
      new Date("2026-04-05T08:12:00.000Z"),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected a successful restore result");
    }
    expect(result.state.hasSyncSession).toBe(true);
    expect(result.state.syncPreferences.lastRemoteGeneration).toBe(456);
    expect(result.state.syncPreferences.setupStatus).toBe("connected");
    expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1);
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(dayLog);
  });
});

describe("disconnectBackupSyncAccount", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("logs out of the managed session and resets to a local-only disconnected state", async () => {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: 7,
        lastSyncedAt: "2026-03-19T09:00:00.000Z",
      }),
    });
    const secretStore = createSyncSecretStoreMock({
      ...PREPARED_MANAGED_SECRETS,
      managedAuthSessionToken: "managed-session-1",
    });

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith("/auth/session") && method === "GET") {
        return new Response(
          JSON.stringify({
            account_id: "acct-1",
            email: "owner@example.com",
            session_expires_at: "2026-06-19T08:15:00.000Z",
            sync_entitlement: {
              sync_allowed: true,
              source: "manual",
              updated_at: "2026-03-19T08:15:00.000Z",
              effective_at: "2026-03-19T08:15:00.000Z",
              explanation: "Trial active.",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.endsWith("/account/billing") && method === "GET") {
        return new Response(
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
        );
      }
      if (url.endsWith("/auth/session") && method === "DELETE") {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    }) as typeof fetch;

    const state = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 2, 19),
    );
    expect(state.hasSyncSession).toBe(true);
    expect(state.managedPremiumAccess.planStatus).toBe("active");

    const result = await disconnectBackupSyncAccount(storage, secretStore, state);

    expect(result.ok).toBe(true);
    expect(result.state.hasSyncSession).toBe(false);
    expect(result.state.managedPremiumAccess).toEqual(
      createEmptySettingsManagedPremiumAccess(),
    );
    const remainingSecrets = await secretStore.readSyncSecrets();
    expect(remainingSecrets?.managedAuthSessionToken).toBeNull();
  });
});

describe("clearUnauthorizedBackupSyncSession", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("clears local session state without any network call and resets managed premium access", async () => {
    const storage = createLocalAppStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
      }),
    });
    const secretStore = createSyncSecretStoreMock({
      ...PREPARED_MANAGED_SECRETS,
      authSessionToken: "stale-session-1",
    });
    const initialState = await loadSettingsScreenState(
      storage,
      secretStore,
      new Date(2026, 3, 5),
    );

    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const nextState = await clearUnauthorizedBackupSyncSession(
      storage,
      secretStore,
      initialState,
    );

    expect(nextState.hasSyncSession).toBe(false);
    expect(nextState.managedPremiumAccess).toEqual(
      createEmptySettingsManagedPremiumAccess(),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    const remainingSecrets = await secretStore.readSyncSecrets();
    expect(remainingSecrets?.authSessionToken).toBeNull();
  });
});
