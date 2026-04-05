import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

import { createSyncSecretsRecord } from "../../security/sync-crypto";
import { requestSensitiveActionChallenge } from "../../security/sensitive-action-auth";
import { createSettingsStorageMock } from "../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../test/create-sync-secret-store-mock";
import { openConfirmation } from "../confirm/open-confirmation";
import { BackupSyncScreen } from "./BackupSyncScreen";

const mockUseEffect = React.useEffect;
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockDispatch = jest.fn();
const mockRouter = {
  back: mockBack,
  replace: mockReplace,
};
let mockSearchParams: { invite_token?: string | string[] } = {};
let preventRemoveCallback:
  | ((options: { data: { action: { type: string } } }) => void)
  | null = null;

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
    useLocalSearchParams: () => mockSearchParams,
    useRouter: () => mockRouter,
  };
});

jest.mock("@react-navigation/native", () => {
  return {
    useNavigation: () => ({
      dispatch: mockDispatch,
    }),
    usePreventRemove: (
      preventRemove: boolean,
      callback: (options: { data: { action: { type: string } } }) => void,
    ) => {
      preventRemoveCallback = preventRemove ? callback : null;
    },
  };
});

jest.mock("../confirm/open-confirmation", () => {
  return {
    openConfirmation: jest.fn(),
  };
});

jest.mock("../../security/sensitive-action-auth", () => {
  return {
    requestSensitiveActionChallenge: jest.fn(),
  };
});

const mockOpenConfirmation = jest.mocked(openConfirmation);
const mockRequestSensitiveActionChallenge = jest.mocked(
  requestSensitiveActionChallenge,
);
const originalFetch = global.fetch;
const originalPlatformOS = Platform.OS;

function createJSONResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("BackupSyncScreen", () => {
  beforeEach(() => {
    if (!global.requestAnimationFrame) {
      global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      }) as typeof requestAnimationFrame;
    }

    preventRemoveCallback = null;
    mockDispatch.mockReset();
    mockBack.mockReset();
    mockOpenConfirmation.mockReset();
    mockRequestSensitiveActionChallenge.mockReset();
    mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
    mockReplace.mockReset();
    mockSearchParams = {};
    global.fetch = originalFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  it("prepares local encrypted sync and reveals the recovery phrase once", async () => {
    const storage = createSettingsStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 17)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    fireEvent.changeText(
      screen.getByTestId("settings-sync-device-label-input"),
      "Pixel 7",
    );
    fireEvent.press(screen.getByTestId("settings-sync-prepare-button"));

    await waitFor(() =>
      expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "managed",
          normalizedEndpoint: "https://sync.ovumcy.cloud",
          deviceLabel: "Pixel 7",
          setupStatus: "local_ready",
        }),
      ),
    );
    expect(screen.getByTestId("settings-sync-recovery-export-button")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("settings-sync-recovery-phrase").props.children)
        .toEqual(expect.any(String)),
    );
    await expect(syncSecretStore.readSyncSecrets()).resolves.not.toBeNull();
  });

  it("recovers sync access on a new device from the recovery phrase", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "",
        deviceLabel: "Recovered Pixel",
        setupStatus: "not_configured",
        preparedAt: null,
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    const originalSecrets = createSyncSecretsRecord(
      "Original device",
      new Date("2026-03-20T08:00:00.000Z"),
    );
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            account_id: "account-1",
            session_token: "session-1",
            session_expires_at: "2026-03-21T10:00:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            mode: "self_hosted",
            sync_enabled: true,
            premium_active: false,
            recovery_supported: true,
            push_supported: false,
            portal_supported: false,
            advanced_cloud_insights: false,
            max_devices: 5,
            max_blob_bytes: 1024,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            algorithm: originalSecrets.record.wrappedKey.algorithm,
            kdf: originalSecrets.record.wrappedKey.kdf,
            mnemonic_word_count: originalSecrets.record.wrappedKey.mnemonicWordCount,
            wrap_nonce_hex: originalSecrets.record.wrappedKey.wrapNonceHex,
            wrapped_master_key_hex:
              originalSecrets.record.wrappedKey.wrappedMasterKeyHex,
            phrase_fingerprint_hex:
              originalSecrets.record.wrappedKey.phraseFingerprintHex,
            updated_at: "2026-03-20T08:05:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            device_id: "recovered-device",
            device_label: "Recovered Pixel",
            created_at: "2026-03-20T08:05:00.000Z",
            last_seen_at: "2026-03-20T08:05:00.000Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ) as typeof fetch;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");
    fireEvent.press(screen.getByTestId("settings-sync-account-pane-restore"));
    expect(screen.getByTestId("settings-sync-recovery-import-block")).toBeTruthy();

    fireEvent.changeText(
      screen.getByTestId("settings-sync-login-input"),
      "alice@example.com",
    );
    fireEvent.changeText(
      screen.getByTestId("settings-sync-password-input"),
      "correct horse battery staple",
    );
    fireEvent.changeText(
      screen.getByTestId("settings-sync-recovery-input"),
      originalSecrets.recoveryPhrase,
    );
    fireEvent.press(screen.getByTestId("settings-sync-recover-button"));

    await waitFor(() =>
      expect(screen.getByTestId("settings-sync-upload-button")).toBeTruthy(),
    );
    await expect(syncSecretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({
        authSessionToken: "session-1",
        managedAuthSessionToken: null,
        masterKeyHex: originalSecrets.record.masterKeyHex,
      }),
    );
  });

  it("shows connected sync actions when the device already has an auth session", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "self_hosted",
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: 123,
        lastSyncedAt: "2026-03-20T08:10:00.000Z",
      }),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets({
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
      authSessionToken: "session-1",
      managedAuthSessionToken: null,
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: "self_hosted",
          sync_enabled: true,
          premium_active: false,
          recovery_supported: true,
          push_supported: false,
          portal_supported: false,
          advanced_cloud_insights: false,
          max_devices: 5,
          max_blob_bytes: 1024,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    ) as typeof fetch;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    expect(screen.getByTestId("settings-sync-upload-button")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-restore-button")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-disconnect-button")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-login-button")).toBeNull();
    expect(screen.queryByTestId("settings-sync-register-button")).toBeNull();
  });

  it("keeps managed sync locked when the signed-in cloud account has no active plan", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets({
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
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          account_id: "managed-account-1",
          email: "alice@example.com",
          session_expires_at: "2026-03-21T08:00:00.000Z",
          sync_entitlement: {
            sync_allowed: false,
            source: "manual",
            updated_at: "2026-03-20T08:05:00.000Z",
            effective_at: "2026-03-20T08:05:00.000Z",
            explanation: "plan inactive",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    ) as typeof fetch;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    expect(screen.queryByTestId("settings-sync-upload-button")).toBeNull();
    expect(screen.queryByTestId("settings-sync-restore-button")).toBeNull();
    expect(screen.getByTestId("settings-sync-disconnect-button")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-plan-blocked-banner")).toBeTruthy();
  });

  it("shows managed partner owner controls and issues an invite link for premium accounts", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets({
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
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        createJSONResponse({
          account_id: "managed-account-1",
          email: "owner@example.com",
          session_expires_at: "2026-03-21T08:00:00.000Z",
          sync_entitlement: {
            sync_allowed: true,
            source: "manual",
            updated_at: "2026-03-20T08:05:00.000Z",
            effective_at: "2026-03-20T08:05:00.000Z",
            explanation: "plan active",
          },
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          premium_features: {
            advanced_fertility: false,
            advanced_insights: false,
            doctor_pdf: false,
            extended_reports: false,
            partner_access: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          premium_features: {
            advanced_fertility: false,
            advanced_insights: false,
            doctor_pdf: false,
            extended_reports: false,
            partner_access: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          owned: {
            invites: [],
            grants: [],
          },
          shared_with_me: [],
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse(
          {
            invite: {
              id: "invite-1",
              owner_account_id: "managed-account-1",
              invited_email: "partner@example.com",
              access_level: "full",
              email_notifications_allowed: false,
              status: "pending",
              expires_at: "2026-04-10T00:00:00.000Z",
              created_by: "managed-account-1",
              created_at: "2026-04-03T00:00:00.000Z",
              updated_at: "2026-04-03T00:00:00.000Z",
            },
            invite_token: "invite-token-1",
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          premium_features: {
            advanced_fertility: false,
            advanced_insights: false,
            doctor_pdf: false,
            extended_reports: false,
            partner_access: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          owned: {
            invites: [
              {
                id: "invite-1",
                owner_account_id: "managed-account-1",
                invited_email: "partner@example.com",
                access_level: "full",
                email_notifications_allowed: false,
                status: "pending",
                expires_at: "2026-04-10T00:00:00.000Z",
                created_by: "managed-account-1",
                created_at: "2026-04-03T00:00:00.000Z",
                updated_at: "2026-04-03T00:00:00.000Z",
              },
            ],
            grants: [],
          },
          shared_with_me: [],
        })) as typeof fetch;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-partner-section");
    expect(screen.getByTestId("settings-partner-invite-email-input")).toBeTruthy();
    expect(screen.queryByTestId("settings-partner-plan-banner")).toBeNull();

    fireEvent.changeText(
      screen.getByTestId("settings-partner-invite-email-input"),
      "partner@example.com",
    );
    fireEvent.press(screen.getByTestId("settings-partner-access-level-full"));
    fireEvent.press(screen.getByTestId("settings-partner-issue-button"));

    await screen.findByTestId("settings-partner-invite-link-card");
    expect(screen.getByTestId("settings-partner-invite-link").props.children).toBe(
      "ovumcy://backup-sync?invite_token=invite-token-1",
    );
    expect(screen.getByTestId("settings-partner-invite-invite-1")).toBeTruthy();
  });

  it("accepts a managed partner invite from the route token and clears the pending card", async () => {
    mockSearchParams = { invite_token: "invite-token-1" };

    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "connected",
        preparedAt: "2026-03-19T08:15:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets({
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
    });
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        createJSONResponse({
          account_id: "managed-account-1",
          email: "partner@example.com",
          session_expires_at: "2026-03-21T08:00:00.000Z",
          sync_entitlement: {
            sync_allowed: true,
            source: "manual",
            updated_at: "2026-03-20T08:05:00.000Z",
            effective_at: "2026-03-20T08:05:00.000Z",
            explanation: "plan active",
          },
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          premium_features: {
            advanced_fertility: false,
            advanced_insights: false,
            doctor_pdf: false,
            extended_reports: false,
            partner_access: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          premium_features: {
            advanced_fertility: false,
            advanced_insights: false,
            doctor_pdf: false,
            extended_reports: false,
            partner_access: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          owned: {
            invites: [],
            grants: [],
          },
          shared_with_me: [],
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          invite: {
            id: "invite-1",
            owner_account_id: "owner-1",
            invited_email: "partner@example.com",
            access_level: "summary",
            email_notifications_allowed: false,
            status: "accepted",
            expires_at: "2026-04-10T00:00:00.000Z",
            accepted_at: "2026-04-05T08:00:00.000Z",
            accepted_account_id: "managed-account-1",
            created_by: "owner-1",
            created_at: "2026-04-03T00:00:00.000Z",
            updated_at: "2026-04-05T08:00:00.000Z",
          },
          grant: {
            id: "grant-1",
            owner_account_id: "owner-1",
            partner_account_id: "managed-account-1",
            partner_email: "partner@example.com",
            access_level: "summary",
            email_notifications_allowed: false,
            source_invite_id: "invite-1",
            accepted_at: "2026-04-05T08:00:00.000Z",
            last_seen_at: "2026-04-05T08:05:00.000Z",
            created_at: "2026-04-05T08:00:00.000Z",
            updated_at: "2026-04-05T08:05:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          premium_features: {
            advanced_fertility: false,
            advanced_insights: false,
            doctor_pdf: false,
            extended_reports: false,
            partner_access: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          owned: {
            invites: [],
            grants: [],
          },
          shared_with_me: [
            {
              id: "grant-1",
              owner_account_id: "owner-1",
              partner_account_id: "managed-account-1",
              partner_email: "partner@example.com",
              access_level: "summary",
              email_notifications_allowed: false,
              source_invite_id: "invite-1",
              accepted_at: "2026-04-05T08:00:00.000Z",
              last_seen_at: "2026-04-05T08:05:00.000Z",
              created_at: "2026-04-05T08:00:00.000Z",
              updated_at: "2026-04-05T08:05:00.000Z",
            },
          ],
        }),
      ) as typeof fetch;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-partner-accept-card");
    fireEvent.press(screen.getByTestId("settings-partner-accept-button"));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/backup-sync"),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("settings-partner-accept-card")).toBeNull(),
    );
    expect(screen.getByTestId("settings-partner-status-banner")).toBeTruthy();
    expect(screen.getByTestId("settings-partner-shared-grant-grant-1")).toBeTruthy();
  });

  it("shows managed cloud account fields on the dedicated backup and sync screen", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "not_configured",
        preparedAt: null,
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={createSyncSecretStoreMock()}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    expect(screen.getByTestId("settings-sync-login-input")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-password-input")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-register-button")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-login-button")).toBeTruthy();
    fireEvent.press(screen.getByTestId("settings-sync-account-pane-restore"));
    expect(screen.getByTestId("settings-sync-recovery-import-block")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-managed-account-banner")).toBeNull();
  });

  it("keeps the device label empty until the owner enters a real value", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "",
        setupStatus: "not_configured",
        preparedAt: null,
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={createSyncSecretStoreMock()}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    expect(screen.getByTestId("settings-sync-device-label-input").props.value).toBe("");
    expect(screen.getByTestId("settings-sync-device-label-input").props.placeholder).not.toBe(
      "Pixel 7",
    );
  });

  it("uses a text endpoint field on web so the browser does not mark hostnames invalid", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "self_hosted",
        endpointInput: "",
        normalizedEndpoint: "",
        deviceLabel: "",
        setupStatus: "not_configured",
        preparedAt: null,
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={createSyncSecretStoreMock()}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    expect(screen.getByTestId("settings-sync-endpoint-input").props.keyboardType).toBe(
      "default",
    );
  });

  it("shows the backup and sync title only once on the dedicated screen", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "not_configured",
        preparedAt: null,
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={createSyncSecretStoreMock()}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    expect(screen.getAllByText(/backup & sync|резервная копия и sync/i)).toHaveLength(
      1,
    );
  });

  it("uses the inline back button instead of a native header route chrome", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "not_configured",
        preparedAt: null,
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={createSyncSecretStoreMock()}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    fireEvent.press(screen.getByTestId("backup-sync-back-button"));

    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
  });

  it("requires confirmation before recreating local sync keys", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-03-19T08:15:00.000Z",
      }),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets({
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
    });
    mockOpenConfirmation.mockResolvedValue(false);

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 17)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    fireEvent.press(screen.getByTestId("settings-sync-prepare-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(1));
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("blocks sync key recreation when device security challenge is unavailable", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "local_ready",
        preparedAt: "2026-03-19T08:15:00.000Z",
      }),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets({
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
    });
    mockOpenConfirmation.mockResolvedValue(true);
    mockRequestSensitiveActionChallenge.mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 17)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    fireEvent.press(screen.getByTestId("settings-sync-prepare-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledTimes(1),
    );
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("discards unsaved sync draft changes before leaving the screen", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.cloud",
        deviceLabel: "Pixel 7",
        setupStatus: "not_configured",
        preparedAt: null,
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      }),
    });
    mockOpenConfirmation.mockResolvedValue(false);

    render(<BackupSyncScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-sync-section");

    fireEvent.changeText(
      screen.getByTestId("settings-sync-device-label-input"),
      "Draft device",
    );

    expect(preventRemoveCallback).toEqual(expect.any(Function));

    await act(async () => {
      preventRemoveCallback?.({ data: { action: { type: "NAVIGATE" } } });
    });

    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "NAVIGATE" }),
      ),
    );
    expect(screen.getByTestId("settings-sync-device-label-input").props.value).toBe(
      "Pixel 7",
    );
  });
});
