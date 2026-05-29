import type { SyncSecretsRecord } from "../sync/sync-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import { connectBackupSyncAccount } from "./backup-sync-screen-service";
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
    });
  });
});
