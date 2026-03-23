import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createSyncSecretsRecord } from "../../security/sync-crypto";
import { requestSensitiveActionChallenge } from "../../security/sensitive-action-auth";
import { createSettingsStorageMock } from "../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../test/create-sync-secret-store-mock";
import { openConfirmation } from "../confirm/open-confirmation";
import { BackupSyncScreen } from "./BackupSyncScreen";

const mockUseEffect = React.useEffect;
const mockReplace = jest.fn();
const mockDispatch = jest.fn();
const mockRouter = {
  replace: mockReplace,
};
let preventRemoveCallback:
  | ((options: { data: { action: { type: string } } }) => void)
  | null = null;

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
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
    mockOpenConfirmation.mockReset();
    mockRequestSensitiveActionChallenge.mockReset();
    mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
    mockReplace.mockReset();
    global.fetch = originalFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
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
      authSessionToken: "session-1",
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          mode: "managed",
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

    expect(screen.queryByTestId("settings-sync-upload-button")).toBeNull();
    expect(screen.queryByTestId("settings-sync-restore-button")).toBeNull();
    expect(screen.getByTestId("settings-sync-disconnect-button")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-plan-blocked-banner")).toBeTruthy();
  });

  it("does not show inline sync account fields in managed cloud mode", async () => {
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

    expect(screen.getByTestId("settings-sync-managed-account-banner")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-login-input")).toBeNull();
    expect(screen.queryByTestId("settings-sync-password-input")).toBeNull();
    expect(screen.queryByTestId("settings-sync-recovery-import-block")).toBeNull();
    expect(screen.queryByTestId("settings-sync-register-button")).toBeNull();
    expect(screen.queryByTestId("settings-sync-login-button")).toBeNull();
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
