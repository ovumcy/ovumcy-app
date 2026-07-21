import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

import { getDeviceCopy } from "../../i18n/device-copy";
import { getPartnerCopy } from "../../i18n/partner-copy";
import { getSettingsCopy } from "../../i18n/settings-copy";
import { createSyncSecretsRecord } from "../../security/sync-crypto";
import { clearManagedPartnerInviteToken } from "../../security/managed-partner-invite-token-buffer";
import { requestSensitiveActionChallenge } from "../../security/sensitive-action-auth";
import * as backupSyncScreenService from "../../services/backup-sync-screen-service";
import { formatBackupSyncLastSeen } from "../../services/backup-sync-view-service";
import {
  createEmptySettingsManagedPremiumAccess,
  createLoadedSettingsState,
} from "../../services/settings-view-service";
import { createSettingsStorageMock } from "../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../test/create-sync-secret-store-mock";
import { createDefaultSyncPreferencesRecord } from "../../sync/sync-contract";
import { openConfirmation, openLeaveConfirmation } from "../confirm/open-confirmation";
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
    openLeaveConfirmation: jest.fn(),
  };
});

jest.mock("../../security/sensitive-action-auth", () => {
  return {
    requestSensitiveActionChallenge: jest.fn(),
  };
});

const mockOpenConfirmation = jest.mocked(openConfirmation);
const mockOpenLeaveConfirmation = jest.mocked(openLeaveConfirmation);
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
    clearManagedPartnerInviteToken();
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
    mockOpenLeaveConfirmation.mockReset();
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

  it(
    "recovers sync access on a new device from the recovery phrase",
    async () => {
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
      const restoredPreferences = {
        ...createDefaultSyncPreferencesRecord(),
        mode: "self_hosted" as const,
        endpointInput: "192.168.1.20:8080",
        normalizedEndpoint: "http://192.168.1.20:8080",
        deviceLabel: "Recovered Pixel",
        setupStatus: "connected" as const,
        preparedAt: "2026-03-20T08:05:00.000Z",
        lastRemoteGeneration: null,
        lastSyncedAt: null,
      };
      const recoverSpy = jest
        .spyOn(backupSyncScreenService, "recoverBackupSyncAccess")
        .mockResolvedValue({
          ok: true,
          state: createLoadedSettingsState(
            {
              lastPeriodStart: "2026-03-10",
              cycleLength: 28,
              periodLength: 5,
              autoPeriodFill: true,
              irregularCycle: false,
              unpredictableCycle: false,
              ageGroup: "",
              usageGoal: "health",
              trackBBT: false,
              temperatureUnit: "c",
              trackCervicalMucus: false,
              hideSexChip: false,
              hideNotes: false,
              languageOverride: "en",
              themeOverride: "light",
              screenCaptureProtectionEnabled: true,
            },
            restoredPreferences,
            true,
            true,
            [],
            {
              values: {
                preset: "all",
                fromDate: "2026-03-10",
                toDate: "2026-03-20",
              },
              availableSummary: {
                totalEntries: 1,
                hasData: true,
                dateFrom: "2026-03-10",
                dateTo: "2026-03-10",
              },
              summary: {
                totalEntries: 1,
                hasData: true,
                dateFrom: "2026-03-10",
                dateTo: "2026-03-10",
              },
              bounds: {
                minDate: "2026-03-10",
                maxDate: "2026-03-20",
              },
            },
            restoredPreferences,
            {
              mode: "self_hosted",
              syncEnabled: true,
              recoverySupported: true,
              pushSupported: false,
              portalSupported: false,
              advancedCloudInsights: false,
              maxDevices: 5,
              maxBlobBytes: 1024,
            },
            createEmptySettingsManagedPremiumAccess(),
          ),
        });

      try {
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
        expect(recoverSpy).toHaveBeenCalled();
      } finally {
        recoverSpy.mockRestore();
      }
    },
    15000,
  );

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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
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

  function createConnectedSelfHostedDeviceFixture() {
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
    const writeSecrets = syncSecretStore.writeSyncSecrets({
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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });

    let remoteDevices = [
      {
        device_id: "device-1",
        device_label: "Pixel 7",
        created_at: "2026-03-19T08:15:00.000Z",
        last_seen_at: "2026-03-20T08:10:00.000Z",
      },
      {
        device_id: "device-2",
        device_label: "Old tablet",
        created_at: "2026-03-20T09:00:00.000Z",
        last_seen_at: "2026-03-20T09:30:00.000Z",
      },
    ];
    const deletedDeviceIDs: string[] = [];
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith("/sync/capabilities")) {
          return createJSONResponse({
            mode: "self_hosted",
            sync_enabled: true,
            recovery_supported: true,
            push_supported: false,
            portal_supported: false,
            advanced_cloud_insights: false,
            max_devices: 5,
            max_blob_bytes: 1024,
          });
        }
        if (method === "GET" && url.endsWith("/sync/devices")) {
          return createJSONResponse({ devices: remoteDevices });
        }
        if (method === "DELETE" && url.includes("/sync/devices/")) {
          const deviceID = url.slice(url.lastIndexOf("/") + 1);
          deletedDeviceIDs.push(deviceID);
          remoteDevices = remoteDevices.filter(
            (device) => device.device_id !== deviceID,
          );
          return createJSONResponse({ status: "removed" });
        }
        throw new Error(`Unexpected fetch in test: ${method} ${url}`);
      },
    ) as typeof fetch;

    return { storage, syncSecretStore, writeSecrets, deletedDeviceIDs };
  }

  it("lists sync devices on demand with a this-device badge and last-seen line", async () => {
    const fixture = createConnectedSelfHostedDeviceFixture();
    await fixture.writeSecrets;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={fixture.storage}
        syncSecretStore={fixture.syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");
    fireEvent.press(await screen.findByTestId("backup-sync-advanced-toggle"));
    await screen.findByTestId("settings-sync-devices-section");

    // Nothing is fetched until the owner asks for the list.
    expect(screen.queryByTestId("settings-sync-device-device-1")).toBeNull();

    fireEvent.press(screen.getByTestId("settings-sync-devices-load-button"));

    await screen.findByTestId("settings-sync-device-device-1");
    expect(screen.getByTestId("settings-sync-device-device-2")).toBeTruthy();
    expect(
      screen.getByTestId("settings-sync-device-current-device-1"),
    ).toBeTruthy();
    expect(
      screen.queryByTestId("settings-sync-device-current-device-2"),
    ).toBeNull();
    expect(screen.getByText("Pixel 7")).toBeTruthy();
    expect(screen.getByText("Old tablet")).toBeTruthy();
    // The raw timestamp never renders; the line is locale-formatted.
    expect(screen.queryByText(/2026-03-20T09:30:00/)).toBeNull();

    // Each device row groups its label, this-device badge, and last-seen
    // line into one composed accessibility label so a screen reader
    // announces the row as a single phrase, independent of the (untouched)
    // Remove button next to it.
    const deviceCopy = getDeviceCopy("en");
    const device1LastSeen = (
      screen.getByTestId("settings-sync-device-last-seen-device-1").props
        .children as string[]
    ).join("");
    expect(
      screen.getByTestId("settings-sync-device-info-device-1").props
        .accessibilityLabel,
    ).toBe(`Pixel 7. ${deviceCopy.thisDeviceBadge}. ${device1LastSeen}`);

    const device2LastSeen = (
      screen.getByTestId("settings-sync-device-last-seen-device-2").props
        .children as string[]
    ).join("");
    expect(
      screen.getByTestId("settings-sync-device-info-device-2").props
        .accessibilityLabel,
    ).toBe(`Old tablet. ${device2LastSeen}`);
  });

  it("removes another device only after an explicit confirm and refreshes the list", async () => {
    const fixture = createConnectedSelfHostedDeviceFixture();
    await fixture.writeSecrets;
    const deviceCopy = getDeviceCopy("en");
    mockOpenConfirmation.mockResolvedValue(true);

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={fixture.storage}
        syncSecretStore={fixture.syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");
    fireEvent.press(await screen.findByTestId("backup-sync-advanced-toggle"));
    fireEvent.press(
      await screen.findByTestId("settings-sync-devices-load-button"),
    );
    await screen.findByTestId("settings-sync-device-device-2");

    fireEvent.press(screen.getByTestId("settings-sync-device-remove-device-2"));

    await waitFor(() =>
      expect(fixture.deletedDeviceIDs).toEqual(["device-2"]),
    );
    expect(mockOpenConfirmation).toHaveBeenCalledWith(
      deviceCopy.removeDevicePrompt("Old tablet"),
      deviceCopy.removeConfirmAction,
      expect.any(String),
    );
    await screen.findByTestId("settings-sync-devices-status-banner");
    await waitFor(() =>
      expect(screen.queryByTestId("settings-sync-device-device-2")).toBeNull(),
    );
    expect(screen.getByTestId("settings-sync-device-device-1")).toBeTruthy();
  });

  it("keeps a device when the removal confirm is dismissed and words the current-device confirm distinctly", async () => {
    const fixture = createConnectedSelfHostedDeviceFixture();
    await fixture.writeSecrets;
    const deviceCopy = getDeviceCopy("en");
    // Dismissal resolves false = keep the device attached.
    mockOpenConfirmation.mockResolvedValue(false);

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={fixture.storage}
        syncSecretStore={fixture.syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");
    fireEvent.press(await screen.findByTestId("backup-sync-advanced-toggle"));
    fireEvent.press(
      await screen.findByTestId("settings-sync-devices-load-button"),
    );
    await screen.findByTestId("settings-sync-device-device-1");

    fireEvent.press(screen.getByTestId("settings-sync-device-remove-device-1"));

    await waitFor(() =>
      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        deviceCopy.removeCurrentDevicePrompt("Pixel 7"),
        deviceCopy.removeConfirmAction,
        expect.any(String),
      ),
    );
    expect(fixture.deletedDeviceIDs).toEqual([]);
    expect(screen.getByTestId("settings-sync-device-device-1")).toBeTruthy();
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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/session")) {
        return new Response(
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
        );
      }

      if (url.includes("/account/billing")) {
        return new Response(
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
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      if (url.includes("/account/partner/access")) {
        return createJSONResponse({
          owned: {
            invites: [],
            grants: [],
          },
          shared_with_me: [],
        });
      }

      throw new Error(`Unexpected fetch in test: ${url}`);
    }) as typeof fetch;

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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });
    const fetchMock = jest
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
      // Settings now probes the session again to bind the entitlement-token
      // gate (buildEntitlementTokenGate -> getSession). This fixture answers it
      // with a non-session payload, so the gate stays inert and doctorPDF and
      // the other snapshot features are read straight from the billing snapshot.
      .mockResolvedValueOnce(createJSONResponse({}, 503))
      .mockResolvedValueOnce(
        createJSONResponse({
          has_active_plan: true,
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
          has_active_plan: true,
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
              access_level: "full",
              status: "pending",
              expires_at: "2026-04-10T00:00:00.000Z",
              created_by: "managed-account-1",
              created_at: "2026-04-03T00:00:00.000Z",
              updated_at: "2026-04-03T00:00:00.000Z",
            },
            invite_url: "ovumcy://backup-sync?invite_token=invite-token-1-fixture-padding",
          },
          201,
        ),
      )
      .mockResolvedValueOnce(
        createJSONResponse({
          has_active_plan: true,
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
                access_level: "full",
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
        }));
    global.fetch = fetchMock as typeof fetch;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    // No pending invite token: the partner section stays behind "Advanced"
    // exactly like every other advanced-only control, unchanged.
    await screen.findByTestId("backup-sync-advanced-toggle");
    expect(screen.queryByTestId("settings-partner-section")).toBeNull();

    fireEvent.press(screen.getByTestId("backup-sync-advanced-toggle"));
    await screen.findByTestId("settings-partner-section");
    expect(screen.queryByTestId("settings-partner-plan-lock")).toBeNull();

    fireEvent.press(screen.getByTestId("settings-partner-access-level-full"));
    fireEvent.press(screen.getByTestId("settings-partner-issue-button"));

    await screen.findByTestId("settings-partner-invite-link-card");
    expect(screen.getByTestId("settings-partner-invite-link").props.children).toBe(
      "ovumcy://backup-sync?invite_token=invite-token-1-fixture-padding",
    );
    expect(screen.getByTestId("settings-partner-invite-invite-1")).toBeTruthy();
    // The pending-invite row groups its label and access level into one
    // composed accessibility label; the Revoke button next to it stays a
    // separate, independently reachable element.
    const partnerCopy = getPartnerCopy("en");
    expect(
      screen.getByTestId("settings-partner-invite-info-invite-1").props
        .accessibilityLabel,
    ).toBe(
      [partnerCopy.pendingInviteLabel, partnerCopy.accessLevelFull].join(". "),
    );
    expect(screen.getByText("Partner invite link created.")).toBeTruthy();
    const issueInviteCall = fetchMock.mock.calls.find(
      ([url, init]: [unknown, unknown?]) =>
        String(url).includes("/account/partner/invites") &&
        (init as RequestInit | undefined)?.method === "POST",
    );
    expect(issueInviteCall).toBeDefined();
    const issueInviteBody = JSON.parse(
      String((issueInviteCall?.[1] as RequestInit | undefined)?.body ?? "{}"),
    ) as { access_level?: string; invited_email?: string; email_notifications_allowed?: boolean };
    expect(issueInviteBody.access_level).toBe("full");
    expect(issueInviteBody.invited_email).toBeUndefined();
    expect(issueInviteBody.email_notifications_allowed).toBeUndefined();
  });

  it("accepts a managed partner invite from the route token and clears the pending card", async () => {
    mockSearchParams = { invite_token: "invite-token-1-fixture-padding" };

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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
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
      // Settings now probes the session again to bind the entitlement-token
      // gate (buildEntitlementTokenGate -> getSession); a non-session payload
      // keeps the gate inert so snapshot features are read as-is.
      .mockResolvedValueOnce(createJSONResponse({}, 503))
      .mockResolvedValueOnce(
        createJSONResponse({
          has_active_plan: false,
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
          has_active_plan: false,
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
            access_level: "summary",
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
            access_level: "summary",
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
          has_active_plan: false,
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
              access_level: "summary",
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

    // A buffered invite token surfaces the ready-to-accept button immediately
    // — no tap on "Advanced" required.
    await screen.findByTestId("settings-partner-accept-card");
    expect(screen.getByTestId("settings-partner-accept-button")).toBeTruthy();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/backup-sync"),
    );
    mockReplace.mockClear();
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

  it("shows an explicit guest-vs-sign-in choice when a pending invite arrives with no managed session, and never auto-redeems on render", async () => {
    mockSearchParams = { invite_token: "invite-token-guest-fixture-padding" };

    const storage = createSettingsStorageMock();
    // A brand-new device: no local sync secrets and no managed session at
    // all — the default mode from createDefaultSyncPreferencesRecord is
    // already "managed", so this is the realistic first-open shape.
    const syncSecretStore = createSyncSecretStoreMock();
    const fetchMock = jest.fn().mockResolvedValue(createJSONResponse({}));
    global.fetch = fetchMock as typeof fetch;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    // A buffered invite token surfaces the guest-vs-sign-in choice
    // immediately — no tap on "Advanced" required.
    await screen.findByTestId("settings-partner-accept-card");

    expect(screen.getByTestId("settings-partner-accept-guest-button")).toBeTruthy();
    expect(screen.getByTestId("settings-partner-signin-to-accept-button")).toBeTruthy();
    // The single ready-to-accept button is a with-session-only affordance —
    // it must not render at all while there is no managed session.
    expect(screen.queryByTestId("settings-partner-accept-button")).toBeNull();
    // Landing on the screen and revealing the choice must never itself
    // redeem the single-use token.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts a partner invite as a guest with one tap and shows the shared grant", async () => {
    mockSearchParams = { invite_token: "invite-token-guest-fixture-padding" };

    const storage = createSettingsStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();
    const fetchMock = jest
      .fn()
      // POST /auth/partner/invites/accept (guest, unauthenticated)
      .mockResolvedValueOnce(
        createJSONResponse(
          {
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
          },
          201,
        ),
      )
      // GET /account/billing — resolveManagedPremiumAccessAfterConnect,
      // called inside acceptBackupSyncPartnerInviteAsGuest.
      .mockResolvedValueOnce(
        createJSONResponse({
          has_active_plan: false,
          premium_features: {
            advanced_fertility: false,
            advanced_insights: false,
            doctor_pdf: false,
            extended_reports: false,
            partner_access: false,
          },
        }),
      )
      // GET /account/billing — loadPartnerState's own loadManagedPremiumFeatures
      // call during the post-accept reloadPartnerAccess.
      .mockResolvedValueOnce(
        createJSONResponse({
          has_active_plan: false,
          premium_features: {
            advanced_fertility: false,
            advanced_insights: false,
            doctor_pdf: false,
            extended_reports: false,
            partner_access: false,
          },
        }),
      )
      // GET /account/partner/access — loadPartnerState's loadManagedPartnerAccess.
      .mockResolvedValueOnce(
        createJSONResponse({
          owned: { invites: [], grants: [] },
          shared_with_me: [
            {
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
          ],
        }),
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    // Visible immediately: no tap on "Advanced" before the guest button
    // appears.
    await screen.findByTestId("settings-partner-accept-guest-button");

    fireEvent.press(screen.getByTestId("settings-partner-accept-guest-button"));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/backup-sync"));
    await waitFor(() =>
      expect(screen.queryByTestId("settings-partner-accept-card")).toBeNull(),
    );
    expect(screen.getByTestId("settings-partner-status-banner")).toBeTruthy();
    expect(screen.getByTestId("settings-partner-shared-grant-grant-9")).toBeTruthy();

    // The shared-with-me row for this guest-accepted grant groups its label,
    // access hint, and last-seen line into one composed accessibility label,
    // the same as any other shared grant row — guest acceptance does not
    // change the row shape.
    const partnerCopy = getPartnerCopy("en");
    expect(
      screen.getByTestId("settings-partner-shared-grant-info-grant-9").props
        .accessibilityLabel,
    ).toBe(
      [
        partnerCopy.sharedGrantLabel,
        partnerCopy.accessLevelFullHint,
        `${partnerCopy.lastSeenLabel}: ${formatBackupSyncLastSeen("2026-04-05T08:00:00.000Z", "en", partnerCopy.lastSeenNever)}`,
      ].join(". "),
    );

    // The guest-accept call specifically must never carry a bearer token.
    const guestAcceptCall = fetchMock.mock.calls[0];
    expect(String(guestAcceptCall[0])).toContain("/auth/partner/invites/accept");
    expect((guestAcceptCall[1]?.headers as Headers).has("Authorization")).toBe(
      false,
    );

    await expect(syncSecretStore.readSyncSecrets()).resolves.toEqual(
      expect.objectContaining({ managedAuthSessionToken: "guest-session-1" }),
    );
  });

  it("choosing sign in instead of guest accept leaves the pending invite token untouched", async () => {
    mockSearchParams = { invite_token: "invite-token-guest-fixture-padding" };

    const storage = createSettingsStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();
    const fetchMock = jest.fn().mockResolvedValue(createJSONResponse({}));
    global.fetch = fetchMock as typeof fetch;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    // Visible immediately: no tap on "Advanced" before the choice appears.
    await screen.findByTestId("settings-partner-signin-to-accept-button");

    fireEvent.press(screen.getByTestId("settings-partner-signin-to-accept-button"));

    // The card and both choice buttons must stay exactly as they were: the
    // token is single-use, and choosing "sign in instead" must not spend it
    // (the owner can still tap "Accept as guest" afterward).
    expect(screen.getByTestId("settings-partner-accept-card")).toBeTruthy();
    expect(screen.getByTestId("settings-partner-accept-guest-button")).toBeTruthy();
    expect(screen.getByTestId("settings-partner-signin-to-accept-button")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("onboarding bypass for a guest partner invite (issue #118)", () => {
    function createUnonboardedStorage(overrides: Parameters<typeof createSettingsStorageMock>[0] = {}) {
      return createSettingsStorageMock({
        readBootstrapState: jest.fn().mockResolvedValue({
          hasCompletedOnboarding: false,
          profileVersion: 2,
          incompleteOnboardingStep: 1,
        }),
        ...overrides,
      });
    }

    it("reaches the accept card directly on a brand-new device with a buffered invite token, without the onboarding wizard", async () => {
      mockSearchParams = { invite_token: "invite-token-guest-fixture-padding" };

      const storage = createUnonboardedStorage();
      const syncSecretStore = createSyncSecretStoreMock();
      const fetchMock = jest.fn().mockResolvedValue(createJSONResponse({}));
      global.fetch = fetchMock as typeof fetch;

      render(
        <BackupSyncScreen
          now={new Date(2026, 2, 20)}
          storage={storage}
          syncSecretStore={syncSecretStore}
        />,
      );

      // The guest-vs-sign-in choice is reachable directly — no detour through
      // "/onboarding" for a device that never completed the owner's
      // cycle-tracking wizard.
      await screen.findByTestId("settings-partner-accept-card");
      expect(screen.getByTestId("settings-partner-accept-guest-button")).toBeTruthy();
      expect(screen.getByTestId("settings-partner-signin-to-accept-button")).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalledWith("/onboarding");
      // Landing on the screen must never itself redeem the single-use token.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("still routes a brand-new device with no buffered token to onboarding, unchanged", async () => {
      const storage = createUnonboardedStorage();
      const syncSecretStore = createSyncSecretStoreMock();

      render(
        <BackupSyncScreen
          now={new Date(2026, 2, 20)}
          storage={storage}
          syncSecretStore={syncSecretStore}
        />,
      );

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/onboarding"),
      );
    });

    it("does not bounce a guest back to onboarding when refocusing after the single-use token is already spent", async () => {
      // No invite_token in the URL this time — the token was already
      // redeemed earlier in the same visit (e.g. the guest tapped "view
      // shared data", then navigated back). The only remaining signal that
      // this is a legitimate guest, not a fresh unauthenticated device, is
      // the live session persistGuestPartnerSession left behind.
      const storage = createUnonboardedStorage();
      const syncSecretStore = createSyncSecretStoreMock();
      await syncSecretStore.writeSyncSecrets({
        device: {
          deviceID: "guest-device-1",
          deviceLabel: "",
          createdAt: "2026-04-05T08:00:00.000Z",
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
        managedAuthSessionToken: "guest-session-1",
        managedAuthSessionExpiresAt: null,
        managedRefreshToken: null,
        managedRefreshTokenExpiresAt: null,
      });

      global.fetch = jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/auth/session")) {
          return createJSONResponse({
            account_id: "guest-account-1",
            email: "guest+guest-account-1@guest.invalid",
            session_expires_at: "2026-04-12T00:00:00.000Z",
            sync_entitlement: {
              sync_allowed: false,
              source: "guest_partner",
              updated_at: "2026-04-05T08:00:00.000Z",
              effective_at: "2026-04-05T08:00:00.000Z",
              explanation: "guest partner",
            },
          });
        }
        if (url.includes("/account/billing")) {
          return createJSONResponse({
            has_active_plan: false,
            premium_features: {
              advanced_fertility: false,
              advanced_insights: false,
              doctor_pdf: false,
              extended_reports: false,
              partner_access: false,
              reminders: false,
            },
          });
        }
        if (url.includes("/account/partner/access")) {
          return createJSONResponse({
            owned: { invites: [], grants: [] },
            shared_with_me: [
              {
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
            ],
          });
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      }) as typeof fetch;

      render(
        <BackupSyncScreen
          now={new Date(2026, 2, 20)}
          storage={storage}
          syncSecretStore={syncSecretStore}
        />,
      );

      await screen.findByTestId("settings-sync-section");
      expect(mockReplace).not.toHaveBeenCalledWith("/onboarding");
    });
  });

  it("formats partner last seen values and explains access levels in the partner section", async () => {
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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });
    const rawLastSeen = "2026-04-05T10:30:00.000Z";
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/session")) {
        return createJSONResponse({
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
        });
      }

      if (url.includes("/account/billing")) {
        return createJSONResponse({
          has_active_plan: true,
          premium_features: {
            advanced_fertility: false,
            advanced_insights: false,
            doctor_pdf: false,
            extended_reports: false,
            partner_access: true,
            reminders: false,
          },
        });
      }

      if (url.includes("/account/partner/access")) {
        return createJSONResponse({
          owned: {
            invites: [],
            grants: [
              {
                id: "grant-1",
                owner_account_id: "managed-account-1",
                partner_account_id: "partner-account-1",
                access_level: "summary",
                source_invite_id: "invite-1",
                accepted_at: "2026-04-04T10:30:00.000Z",
                last_seen_at: rawLastSeen,
                created_at: "2026-04-04T10:30:00.000Z",
                updated_at: "2026-04-05T10:30:00.000Z",
              },
            ],
          },
          shared_with_me: [],
        });
      }

      throw new Error(`Unexpected fetch in test: ${url}`);
    }) as typeof fetch;

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    fireEvent.press(await screen.findByTestId("backup-sync-advanced-toggle"));
    await screen.findByTestId("settings-partner-grant-grant-1");
    expect(
      screen.getAllByText(
        "Share the lighter summary view instead of detailed day-by-day history.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(rawLastSeen)).toBeNull();
    expect(
      screen.getByText(
        `Last seen: ${formatBackupSyncLastSeen(rawLastSeen, "en", "Not opened yet.")}`,
      ),
    ).toBeTruthy();

    // The active-grant row groups its label, access level, hint, and
    // last-seen line into one composed accessibility label; the Open/Revoke
    // buttons next to it stay separate, independently reachable elements.
    const partnerCopy = getPartnerCopy("en");
    expect(
      screen.getByTestId("settings-partner-grant-info-grant-1").props
        .accessibilityLabel,
    ).toBe(
      [
        partnerCopy.activePartnerLabel,
        partnerCopy.accessLevelSummary,
        partnerCopy.accessLevelSummaryHint,
        `${partnerCopy.lastSeenLabel}: ${formatBackupSyncLastSeen(rawLastSeen, "en", partnerCopy.lastSeenNever)}`,
      ].join(". "),
    );
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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
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

  it("blocks sync disconnect until the device security challenge passes", async () => {
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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
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
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    ) as typeof fetch;
    mockOpenConfirmation.mockResolvedValue(true);
    mockRequestSensitiveActionChallenge.mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");

    fireEvent.press(screen.getByTestId("settings-sync-disconnect-button"));

    await waitFor(() =>
      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledTimes(1),
    );
    // Device-auth runs first: a failed challenge stops the flow before the
    // confirmation dialog and before the sync session is torn down.
    expect(mockOpenConfirmation).not.toHaveBeenCalled();
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
    mockOpenLeaveConfirmation.mockResolvedValue("reject");

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

  it("drives a managed login through the TOTP challenge and finalises the connection", async () => {
    const preparedPreferences = {
      mode: "managed" as const,
      endpointInput: "",
      normalizedEndpoint: "https://sync.ovumcy.cloud",
      deviceLabel: "Pixel 7",
      setupStatus: "local_ready" as const,
      preparedAt: "2026-05-17T08:00:00.000Z",
      lastRemoteGeneration: null,
      lastSyncedAt: null,
      guestSessionExpiresAt: null,
    };
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest
        .fn()
        .mockResolvedValue(preparedPreferences),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-05-17T08:00:00.000Z",
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
    });

    // `connectBackupSyncAccount` is the controller's entry point for the
    // password step. Returning the totp-challenge branch tells the screen to
    // swap the setup section for the dedicated 6-digit prompt instead of
    // persisting a (non-existent) session token.
    const connectSpy = jest
      .spyOn(backupSyncScreenService, "connectBackupSyncAccount")
      .mockResolvedValue({
        ok: true,
        totpChallengeRequired: true,
        challengeID: "challenge-123",
        challengeExpiresAt: "2026-05-17T08:05:00.000Z",
        accountID: "managed-account-1",
        preferences: preparedPreferences,
      });

    const connectedPreferences = {
      ...preparedPreferences,
      setupStatus: "connected" as const,
    };
    const completeSpy = jest
      .spyOn(backupSyncScreenService, "completeBackupSyncTOTPChallenge")
      .mockResolvedValue({
        ok: true,
        connected: true,
        state: createLoadedSettingsState(
          {
            lastPeriodStart: "2026-05-01",
            cycleLength: 28,
            periodLength: 5,
            autoPeriodFill: true,
            irregularCycle: false,
            unpredictableCycle: false,
            ageGroup: "",
            usageGoal: "health",
            trackBBT: false,
            temperatureUnit: "c",
            trackCervicalMucus: false,
            hideSexChip: false,
            hideNotes: false,
            languageOverride: "en",
            themeOverride: "light",
            screenCaptureProtectionEnabled: true,
          },
          connectedPreferences,
          true,
          true,
          [],
          {
            values: {
              preset: "all",
              fromDate: "2026-05-01",
              toDate: "2026-05-17",
            },
            availableSummary: {
              totalEntries: 1,
              hasData: true,
              dateFrom: "2026-05-01",
              dateTo: "2026-05-17",
            },
            summary: {
              totalEntries: 1,
              hasData: true,
              dateFrom: "2026-05-01",
              dateTo: "2026-05-17",
            },
            bounds: {
              minDate: "2026-05-01",
              maxDate: "2026-05-17",
            },
          },
          connectedPreferences,
          {
            mode: "managed",
            syncEnabled: true,
            recoverySupported: false,
            pushSupported: false,
            portalSupported: false,
            advancedCloudInsights: false,
            maxDevices: 5,
            maxBlobBytes: 1024,
          },
          {
            ...createEmptySettingsManagedPremiumAccess(),
            planStatus: "active",
          },
        ),
      });

    try {
      render(
        <BackupSyncScreen
          now={new Date("2026-05-17T08:00:00.000Z")}
          storage={storage}
          syncSecretStore={syncSecretStore}
        />,
      );

      await screen.findByTestId("settings-sync-section");

      fireEvent.changeText(
        screen.getByTestId("settings-sync-login-input"),
        "owner@example.com",
      );
      fireEvent.changeText(
        screen.getByTestId("settings-sync-password-input"),
        "correct horse battery staple",
      );
      fireEvent.press(screen.getByTestId("settings-sync-login-button"));

      // The challenge prompt is rendered once connect returns the deferred
      // result. Until the user submits the code there must be no session
      // token written to the secret store.
      await screen.findByTestId("backup-sync-totp-challenge-submit");
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("settings-sync-upload-button")).toBeNull();

      fireEvent.changeText(
        screen.getByTestId("backup-sync-totp-challenge-code"),
        "123456",
      );
      fireEvent.press(
        screen.getByTestId("backup-sync-totp-challenge-submit"),
      );

      await waitFor(() => expect(completeSpy).toHaveBeenCalledTimes(1));
      expect(completeSpy.mock.calls[0]?.[3]).toEqual(preparedPreferences);
      expect(completeSpy.mock.calls[0]?.[4]).toEqual({
        challengeID: "challenge-123",
        code: "123456",
      });

      // After a successful challenge the prompt is gone and the screen
      // transitions to the connected layout.
      await waitFor(() =>
        expect(
          screen.queryByTestId("backup-sync-totp-challenge-submit"),
        ).toBeNull(),
      );
      expect(screen.getByTestId("settings-sync-upload-button")).toBeTruthy();
    } finally {
      connectSpy.mockRestore();
      completeSpy.mockRestore();
    }
  });

  it("clears a TOTP challenge when the server reports it expired and surfaces the localized banner", async () => {
    const preparedPreferences = {
      mode: "managed" as const,
      endpointInput: "",
      normalizedEndpoint: "https://sync.ovumcy.cloud",
      deviceLabel: "Pixel 7",
      setupStatus: "local_ready" as const,
      preparedAt: "2026-05-17T08:00:00.000Z",
      lastRemoteGeneration: null,
      lastSyncedAt: null,
      guestSessionExpiresAt: null,
    };
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest
        .fn()
        .mockResolvedValue(preparedPreferences),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets({
      device: {
        deviceID: "device-1",
        deviceLabel: "Pixel 7",
        createdAt: "2026-05-17T08:00:00.000Z",
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
    });
    const connectSpy = jest
      .spyOn(backupSyncScreenService, "connectBackupSyncAccount")
      .mockResolvedValue({
        ok: true,
        totpChallengeRequired: true,
        challengeID: "challenge-stale",
        challengeExpiresAt: "2026-05-17T08:05:00.000Z",
        accountID: "managed-account-1",
        preferences: preparedPreferences,
      });
    const completeSpy = jest
      .spyOn(backupSyncScreenService, "completeBackupSyncTOTPChallenge")
      .mockResolvedValue({
        ok: false,
        errorCode: "totp_challenge_invalid",
      });

    try {
      render(
        <BackupSyncScreen
          now={new Date("2026-05-17T08:00:00.000Z")}
          storage={storage}
          syncSecretStore={syncSecretStore}
        />,
      );

      await screen.findByTestId("settings-sync-section");
      fireEvent.changeText(
        screen.getByTestId("settings-sync-login-input"),
        "owner@example.com",
      );
      fireEvent.changeText(
        screen.getByTestId("settings-sync-password-input"),
        "correct horse battery staple",
      );
      fireEvent.press(screen.getByTestId("settings-sync-login-button"));

      await screen.findByTestId("backup-sync-totp-challenge-submit");
      fireEvent.changeText(
        screen.getByTestId("backup-sync-totp-challenge-code"),
        "000000",
      );
      fireEvent.press(
        screen.getByTestId("backup-sync-totp-challenge-submit"),
      );

      await waitFor(() => expect(completeSpy).toHaveBeenCalledTimes(1));

      // Expired/invalid challenge must drop the prompt and route the owner
      // back to the login form so they re-enter their password.
      await waitFor(
        () =>
          expect(
            screen.queryByTestId("backup-sync-totp-challenge-submit"),
          ).toBeNull(),
        { timeout: 5000 },
      );
      expect(connectSpy).toHaveBeenCalled();
      expect(screen.getByTestId("settings-sync-login-button")).toBeTruthy();
    } finally {
      connectSpy.mockRestore();
      completeSpy.mockRestore();
    }
  });

  it("renders no manage-renewal row when both billing management flags are false", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest
        .fn()
        .mockResolvedValue(createConnectedManagedPreferences()),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets(createConnectedManagedSecrets());
    global.fetch = createManagedBillingFetchMock({
      billing: {
        has_active_plan: true,
        premium_features: { partner_access: false },
      },
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");
    await screen.findByTestId("settings-sync-plan-banner");

    expect(screen.queryByTestId("settings-sync-renewal-row")).toBeNull();
    expect(screen.queryByTestId("settings-sync-renewal-cancel-button")).toBeNull();
    expect(screen.queryByTestId("settings-sync-renewal-resume-button")).toBeNull();
  });

  it("states the EU withdrawal and refund terms on the plan step, with or without a renewal row", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest
        .fn()
        .mockResolvedValue(createConnectedManagedPreferences()),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets(createConnectedManagedSecrets());
    global.fetch = createManagedBillingFetchMock({
      billing: {
        has_active_plan: false,
        premium_features: { partner_access: false },
      },
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");
    await screen.findByTestId("settings-sync-plan-banner");

    expect(screen.getByTestId("settings-sync-withdrawal-notice")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-renewal-row")).toBeNull();
    expect(screen.getByText(/14 days to withdraw/)).toBeTruthy();
  });

  it("shows only the flag-enabled renewal action and requires confirmation before cancelling", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest
        .fn()
        .mockResolvedValue(createConnectedManagedPreferences()),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets(createConnectedManagedSecrets());
    const renewalPut = jest.fn(async () =>
      createJSONResponse({
        has_active_plan: true,
        premium_features: {},
        active_subscription: {
          status: "active",
          current_period_ends_at: "2026-04-20T00:00:00.000Z",
          cancel_at_period_end: true,
        },
        billing_management: {
          can_manage_renewal: true,
          can_cancel_at_period_end: false,
          can_resume_renewal: true,
        },
      }),
    );
    global.fetch = createManagedBillingFetchMock({
      billing: {
        has_active_plan: true,
        premium_features: {},
        billing_management: {
          can_manage_renewal: true,
          can_cancel_at_period_end: true,
          can_resume_renewal: false,
        },
      },
      onRenewalPut: renewalPut,
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-renewal-row");
    expect(screen.getByTestId("settings-sync-renewal-cancel-button")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-renewal-resume-button")).toBeNull();

    // Dismissal / decline resolves false = the subscription stays untouched.
    mockOpenConfirmation.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId("settings-sync-renewal-cancel-button"));
    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(1));
    expect(mockOpenConfirmation).toHaveBeenCalledWith(
      expect.stringContaining("automatic renewal"),
      expect.any(String),
      expect.any(String),
    );
    expect(renewalPut).not.toHaveBeenCalled();

    // Explicit accept drives the PUT and the row flips to the resume action.
    mockOpenConfirmation.mockResolvedValueOnce(true);
    fireEvent.press(screen.getByTestId("settings-sync-renewal-cancel-button"));
    await waitFor(() => expect(renewalPut).toHaveBeenCalledTimes(1));
    await screen.findByTestId("settings-sync-renewal-resume-button");
    expect(screen.queryByTestId("settings-sync-renewal-cancel-button")).toBeNull();
  });

  it("renders billing offers in the plan area and persists dismissal", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest
        .fn()
        .mockResolvedValue(createConnectedManagedPreferences()),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets(createConnectedManagedSecrets());
    global.fetch = createManagedBillingFetchMock({
      billing: {
        has_active_plan: true,
        premium_features: {},
        offers: [
          {
            id: "promo-1",
            kind: "subscription_promo",
            audience: ["trial"],
            startsAt: null,
            endsAt: null,
            copy: {
              en: {
                title: "Yearly saves 20%",
                body: "Switch to the yearly plan.",
                cta: "See plans",
              },
            },
            action: {
              type: "play_checkout",
              productId: "premium",
              basePlanId: "yearly",
            },
          },
        ],
      },
    });

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-offer-promo-1");
    expect(screen.getByTestId("settings-sync-offer-promo-1-title").props.children).toBe(
      "Yearly saves 20%",
    );
    // play_checkout stays inert until Play Billing lands.
    expect(
      screen.getByTestId("settings-sync-offer-promo-1-cta").props
        .accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));

    fireEvent.press(screen.getByTestId("settings-sync-offer-promo-1-dismiss"));

    await waitFor(() =>
      expect(storage.writeManagedBillingCacheRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          dismissedOfferIDs: ["promo-1"],
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("settings-sync-offer-promo-1")).toBeNull(),
    );
  });

  it("shows a distinct subscription-warning dialog for an active managed subscription, and a dismissal keeps the account untouched", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest
        .fn()
        .mockResolvedValue(createConnectedManagedPreferences()),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets(createConnectedManagedSecrets());
    global.fetch = createManagedDeletionFetchMock({
      billing: {
        has_active_plan: true,
        premium_features: {},
        active_subscription: {
          status: "active",
          current_period_ends_at: "2026-04-20T00:00:00.000Z",
          cancel_at_period_end: false,
        },
      },
    });
    const settingsCopy = getSettingsCopy("en");
    // Accept the standard destructive confirm, then dismiss the distinct
    // subscription warning that follows it.
    mockOpenConfirmation.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");
    fireEvent.press(screen.getByTestId("settings-sync-delete-account-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(2));
    expect(mockOpenConfirmation).toHaveBeenNthCalledWith(
      1,
      settingsCopy.account.deleteAccountPrompt,
      settingsCopy.account.deleteAccountAccept,
    );
    expect(mockOpenConfirmation).toHaveBeenNthCalledWith(
      2,
      `${settingsCopy.account.deleteAccountSubscriptionWarningTitle}\n\n${settingsCopy.account.deleteAccountSubscriptionWarningMessage}`,
      settingsCopy.account.deleteAccountSubscriptionWarningAccept,
    );

    // A dismissal is the safe answer, exactly like every other destructive
    // confirm in this screen: nothing about the account is touched.
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    await expect(syncSecretStore.readSyncSecrets()).resolves.not.toBeNull();
  });

  it("proceeds with the destructive deletion only once both the standard confirm and the subscription warning are explicitly accepted", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest
        .fn()
        .mockResolvedValue(createConnectedManagedPreferences()),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets(createConnectedManagedSecrets());
    global.fetch = createManagedDeletionFetchMock({
      billing: {
        has_active_plan: true,
        premium_features: {},
        active_subscription: {
          status: "active",
          current_period_ends_at: "2026-04-20T00:00:00.000Z",
          cancel_at_period_end: false,
        },
      },
    });
    mockOpenConfirmation.mockResolvedValue(true);

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");
    fireEvent.press(screen.getByTestId("settings-sync-delete-account-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1),
    );
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("/onboarding?reset="),
    );
    await expect(syncSecretStore.readSyncSecrets()).resolves.toBeNull();
  });

  it("skips the subscription warning for a pure trial (no store billing to cancel) and deletes after the single confirm", async () => {
    const storage = createSettingsStorageMock({
      readSyncPreferencesRecord: jest
        .fn()
        .mockResolvedValue(createConnectedManagedPreferences()),
    });
    const syncSecretStore = createSyncSecretStoreMock();
    await syncSecretStore.writeSyncSecrets(createConnectedManagedSecrets());
    global.fetch = createManagedDeletionFetchMock({
      billing: {
        has_active_plan: true,
        premium_features: {},
        active_subscription: {
          status: "trialing",
          current_period_ends_at: "2026-04-20T00:00:00.000Z",
          cancel_at_period_end: false,
        },
      },
    });
    const settingsCopy = getSettingsCopy("en");
    mockOpenConfirmation.mockResolvedValue(true);

    render(
      <BackupSyncScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-sync-section");
    fireEvent.press(screen.getByTestId("settings-sync-delete-account-button"));

    await waitFor(() =>
      expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1),
    );
    // Only the standard destructive confirm ever shows for a pure trial: no
    // store/paid-backed subscription is on the hook for real charges, so the
    // second, distinctly-worded warning never appears (bae1ddf regression:
    // trials used to wrongly trigger this warning for every trialing user).
    expect(mockOpenConfirmation).toHaveBeenCalledTimes(1);
    expect(mockOpenConfirmation).toHaveBeenCalledWith(
      settingsCopy.account.deleteAccountPrompt,
      settingsCopy.account.deleteAccountAccept,
    );
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining("/onboarding?reset="),
    );
  });

  describe("guest account upgrade (ovumcy-app#118)", () => {
    const partnerCopy = getPartnerCopy("en");

    function createGuestSecrets() {
      return {
        device: {
          deviceID: "guest-device-1",
          deviceLabel: "",
          createdAt: "2026-04-05T08:00:00.000Z",
        },
        masterKeyHex: "aa",
        deviceSecretHex: "bb",
        wrappedKey: {
          algorithm: "xchacha20poly1305" as const,
          kdf: "bip39_seed_hkdf_sha256" as const,
          mnemonicWordCount: 12 as const,
          wrapNonceHex: "cc",
          wrappedMasterKeyHex: "dd",
          phraseFingerprintHex: "ee",
        },
        authSessionToken: null,
        managedAuthSessionToken: "guest-session-1",
        managedAuthSessionExpiresAt: null,
        managedRefreshToken: null,
        managedRefreshTokenExpiresAt: null,
      };
    }

    // Fetch mock for the initial focus-load only (getSession, billing,
    // partner access) — matches the "does not bounce a guest back to
    // onboarding" fixture above. Each test that submits the upgrade form
    // swaps global.fetch to a dedicated single-call mock afterward, since
    // POST /account/upgrade is the only network call the submit path makes.
    function createGuestLoadFetchMock(guestSessionExpiresAt: string): typeof fetch {
      return jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/auth/session")) {
          return createJSONResponse({
            account_id: "guest-account-1",
            email: "guest+guest-account-1@guest.invalid",
            session_expires_at: guestSessionExpiresAt,
            sync_entitlement: {
              sync_allowed: false,
              source: "guest_partner",
              updated_at: "2026-04-05T08:00:00.000Z",
              effective_at: "2026-04-05T08:00:00.000Z",
              explanation: "guest partner",
            },
          });
        }
        if (url.includes("/account/billing")) {
          return createJSONResponse({
            has_active_plan: false,
            premium_features: {
              advanced_fertility: false,
              advanced_insights: false,
              doctor_pdf: false,
              extended_reports: false,
              partner_access: false,
              reminders: false,
            },
          });
        }
        if (url.includes("/account/partner/access")) {
          return createJSONResponse({
            owned: { invites: [], grants: [] },
            shared_with_me: [
              {
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
            ],
          });
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      }) as typeof fetch;
    }

    async function renderGuestScreen(options: {
      guestSessionExpiresAt: string;
      now?: Date;
    }) {
      const storage = createSettingsStorageMock({
        readBootstrapState: jest.fn().mockResolvedValue({
          hasCompletedOnboarding: false,
          profileVersion: 2,
          incompleteOnboardingStep: null,
        }),
        readSyncPreferencesRecord: jest.fn().mockResolvedValue({
          ...createDefaultSyncPreferencesRecord(),
          mode: "managed",
          setupStatus: "connected",
          guestSessionExpiresAt: options.guestSessionExpiresAt,
        }),
      });
      const syncSecretStore = createSyncSecretStoreMock();
      await syncSecretStore.writeSyncSecrets(createGuestSecrets());
      global.fetch = createGuestLoadFetchMock(options.guestSessionExpiresAt);

      render(
        <BackupSyncScreen
          now={options.now ?? new Date(2026, 3, 5)}
          storage={storage}
          syncSecretStore={syncSecretStore}
        />,
      );
      await screen.findByTestId("backup-sync-guest-upgrade-cta");
      return { storage, syncSecretStore };
    }

    it("shows the Keep-your-access CTA immediately for a guest session, with no Advanced tap needed", async () => {
      await renderGuestScreen({ guestSessionExpiresAt: "2026-05-05T08:00:00.000Z" });
      // Immediately visible with no invite token buffered and "Advanced"
      // never tapped — proving this CTA does NOT ride the same
      // advancedOpen/hasShownPartnerSectionForToken gate
      // SettingsPartnerAccessSection sits behind (that section stays
      // collapsed here, confirming the two are independent).
      expect(screen.queryByTestId("settings-partner-section")).toBeNull();
    });

    it("never shows the Keep-your-access CTA for a full (non-guest) managed session", async () => {
      const ownerStorage = createSettingsStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue(
          createConnectedManagedPreferences(),
        ),
      });
      const ownerSecretStore = createSyncSecretStoreMock();
      await ownerSecretStore.writeSyncSecrets(createConnectedManagedSecrets());
      global.fetch = createManagedBillingFetchMock({
        billing: {
          has_active_plan: true,
          premium_features: {
            advanced_fertility: true,
            advanced_insights: true,
            doctor_pdf: true,
            extended_reports: true,
            partner_access: true,
            reminders: true,
          },
        },
      });

      render(
        <BackupSyncScreen
          now={new Date(2026, 2, 20)}
          storage={ownerStorage}
          syncSecretStore={ownerSecretStore}
        />,
      );
      await screen.findByTestId("settings-sync-section");
      expect(screen.queryByTestId("backup-sync-guest-upgrade-cta")).toBeNull();
    });

    it("gates the form behind device security, and shows the unavailable message when the gate fails", async () => {
      await renderGuestScreen({ guestSessionExpiresAt: "2026-05-05T08:00:00.000Z" });

      mockRequestSensitiveActionChallenge.mockResolvedValueOnce({
        ok: false,
        reason: "unavailable",
      });
      fireEvent.press(screen.getByTestId("backup-sync-guest-upgrade-cta"));

      await waitFor(() =>
        expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledWith(
          partnerCopy.guestUpgrade.deviceAuthPrompt,
        ),
      );
      expect(screen.queryByTestId("backup-sync-guest-upgrade-form-modal")).toBeNull();
      expect(
        await screen.findByText(partnerCopy.guestUpgrade.errors.deviceAuthUnavailable),
      ).toBeTruthy();

      // A second tap that passes the gate opens the form.
      fireEvent.press(screen.getByTestId("backup-sync-guest-upgrade-cta"));
      await screen.findByTestId("backup-sync-guest-upgrade-form-modal");
    });

    it("validates email and password before submitting, with no network call", async () => {
      await renderGuestScreen({ guestSessionExpiresAt: "2026-05-05T08:00:00.000Z" });
      fireEvent.press(screen.getByTestId("backup-sync-guest-upgrade-cta"));
      await screen.findByTestId("backup-sync-guest-upgrade-form-modal");

      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as unknown as typeof fetch;

      fireEvent.press(screen.getByTestId("backup-sync-guest-upgrade-submit-button"));
      expect(
        await screen.findByText(partnerCopy.guestUpgrade.errors.emailRequired),
      ).toBeTruthy();

      fireEvent.changeText(
        screen.getByTestId("backup-sync-guest-upgrade-email-input"),
        "owner@example.com",
      );
      fireEvent.press(screen.getByTestId("backup-sync-guest-upgrade-submit-button"));
      expect(
        await screen.findByText(partnerCopy.guestUpgrade.errors.passwordRequired),
      ).toBeTruthy();

      fireEvent.changeText(
        screen.getByTestId("backup-sync-guest-upgrade-password-input"),
        "short",
      );
      fireEvent.press(screen.getByTestId("backup-sync-guest-upgrade-submit-button"));
      expect(
        await screen.findByText(partnerCopy.guestUpgrade.errors.passwordTooShort),
      ).toBeTruthy();

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("on success shows the one-time recovery code, hides it on acknowledgement, and the CTA disappears", async () => {
      await renderGuestScreen({ guestSessionExpiresAt: "2026-05-05T08:00:00.000Z" });
      fireEvent.press(screen.getByTestId("backup-sync-guest-upgrade-cta"));
      await screen.findByTestId("backup-sync-guest-upgrade-form-modal");

      fireEvent.changeText(
        screen.getByTestId("backup-sync-guest-upgrade-email-input"),
        "owner@example.com",
      );
      fireEvent.changeText(
        screen.getByTestId("backup-sync-guest-upgrade-password-input"),
        "very secure password 12345",
      );

      global.fetch = jest.fn().mockResolvedValueOnce(
        createJSONResponse({
          account_id: "guest-account-1",
          email: "owner@example.com",
          recovery_code: "fresh1234fresh1234fresh1234fresh",
        }),
      ) as unknown as typeof fetch;

      fireEvent.press(screen.getByTestId("backup-sync-guest-upgrade-submit-button"));

      const codeNode = await screen.findByTestId(
        "backup-sync-guest-upgrade-recovery-code-value",
      );
      expect(codeNode.props.children).toBe("fresh1234fresh1234fresh1234fresh");
      expect(codeNode.props.selectable).toBe(true);
      // The form itself is gone once the reveal is up.
      expect(screen.queryByTestId("backup-sync-guest-upgrade-form-modal")).toBeNull();
      // The CTA/nudge card is gone too — the account is no longer a guest —
      // but the reveal must stay visible regardless (see GuestUpgradeSection).
      expect(screen.queryByTestId("backup-sync-guest-upgrade-cta")).toBeNull();

      const upgradeCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(String(upgradeCall[0])).toContain("/account/upgrade");
      expect((upgradeCall[1]?.headers as Headers).get("Authorization")).toBe(
        "Bearer guest-session-1",
      );

      fireEvent.press(
        screen.getByTestId("backup-sync-guest-upgrade-recovery-code-confirm-button"),
      );
      await waitFor(() =>
        expect(
          screen.queryByTestId("backup-sync-guest-upgrade-recovery-code-modal"),
        ).toBeNull(),
      );
    });

    it("hides the CTA on account_not_guest without leaving the form open", async () => {
      await renderGuestScreen({ guestSessionExpiresAt: "2026-05-05T08:00:00.000Z" });
      fireEvent.press(screen.getByTestId("backup-sync-guest-upgrade-cta"));
      await screen.findByTestId("backup-sync-guest-upgrade-form-modal");

      fireEvent.changeText(
        screen.getByTestId("backup-sync-guest-upgrade-email-input"),
        "owner@example.com",
      );
      fireEvent.changeText(
        screen.getByTestId("backup-sync-guest-upgrade-password-input"),
        "very secure password 12345",
      );

      global.fetch = jest.fn().mockResolvedValueOnce(
        createJSONResponse({ error: "account_not_guest" }, 409),
      ) as unknown as typeof fetch;

      fireEvent.press(screen.getByTestId("backup-sync-guest-upgrade-submit-button"));

      await waitFor(
        () =>
          expect(screen.queryByTestId("backup-sync-guest-upgrade-cta")).toBeNull(),
        { timeout: 5000 },
      );
      expect(screen.queryByTestId("backup-sync-guest-upgrade-form-modal")).toBeNull();
      expect(
        screen.queryByTestId("backup-sync-guest-upgrade-recovery-code-modal"),
      ).toBeNull();
    });

    it("shows the expiry nudge when the guest session is close to expiring, and not when it is far out", async () => {
      // now = 2026-04-05T12:00:00.000Z, expires = 2026-04-08T00:00:00.000Z:
      // 2.5 days remaining rounds up to 3 — inside the 7-day nudge window.
      await renderGuestScreen({
        guestSessionExpiresAt: "2026-04-08T00:00:00.000Z",
        now: new Date("2026-04-05T12:00:00.000Z"),
      });
      expect(
        await screen.findByText(partnerCopy.guestUpgrade.nudgeMessage(3)),
      ).toBeTruthy();
    });

    it("does not show the expiry nudge when the guest session is not close to expiring", async () => {
      await renderGuestScreen({
        guestSessionExpiresAt: "2026-06-05T00:00:00.000Z",
        now: new Date("2026-04-05T12:00:00.000Z"),
      });
      expect(screen.queryByTestId("backup-sync-guest-upgrade-nudge")).toBeNull();
    });
  });

  // Trust-model gap found incidentally during the #118 guest-upgrade work
  // (predates it): docs/sync-trust-model.md's "Guest Partner Access" section
  // states "Guests never see a recovery phrase." Guest accept
  // (persistGuestPartnerSession) silently generates local sync secrets so
  // state.hasStoredSyncSecrets is true for a guest, which used to make the
  // local-step "Create a new recovery phrase" affordance in
  // SettingsSyncSetupSection render for a guest exactly like it does for an
  // owner -- reachable end-to-end through the same confirm + device-auth
  // gate, ending in a REAL freshly generated phrase in the reveal modal.
  describe("guest local-step recovery-phrase regenerate gap (docs/sync-trust-model.md Guest Partner Access)", () => {
    function createGuestSecretsWithMasterKey() {
      return {
        device: {
          deviceID: "guest-device-1",
          deviceLabel: "",
          createdAt: "2026-04-05T08:00:00.000Z",
        },
        masterKeyHex: "aa",
        deviceSecretHex: "bb",
        wrappedKey: {
          algorithm: "xchacha20poly1305" as const,
          kdf: "bip39_seed_hkdf_sha256" as const,
          mnemonicWordCount: 12 as const,
          wrapNonceHex: "cc",
          wrappedMasterKeyHex: "dd",
          phraseFingerprintHex: "ee",
        },
        authSessionToken: null,
        managedAuthSessionToken: "guest-session-1",
        managedAuthSessionExpiresAt: null,
        managedRefreshToken: null,
        managedRefreshTokenExpiresAt: null,
      };
    }

    function createGuestRegenerateFetchMock(): typeof fetch {
      return jest.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/auth/session")) {
          return createJSONResponse({
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
          });
        }
        if (url.includes("/account/billing")) {
          return createJSONResponse({
            has_active_plan: false,
            premium_features: {
              advanced_fertility: false,
              advanced_insights: false,
              doctor_pdf: false,
              extended_reports: false,
              partner_access: false,
              reminders: false,
            },
          });
        }
        if (url.includes("/account/partner/access")) {
          return createJSONResponse({
            owned: { invites: [], grants: [] },
            shared_with_me: [],
          });
        }
        throw new Error(`Unexpected fetch in test: ${url}`);
      }) as typeof fetch;
    }

    async function renderGuestScreenForRegenerate() {
      const storage = createSettingsStorageMock({
        readSyncPreferencesRecord: jest.fn().mockResolvedValue({
          ...createDefaultSyncPreferencesRecord(),
          mode: "managed",
          deviceLabel: "Pixel 7",
          setupStatus: "connected",
          guestSessionExpiresAt: "2026-05-05T08:00:00.000Z",
        }),
      });
      const syncSecretStore = createSyncSecretStoreMock();
      await syncSecretStore.writeSyncSecrets(createGuestSecretsWithMasterKey());
      global.fetch = createGuestRegenerateFetchMock();

      render(
        <BackupSyncScreen
          now={new Date(2026, 3, 5)}
          storage={storage}
          syncSecretStore={syncSecretStore}
        />,
      );
      await screen.findByTestId("settings-sync-section");
      return { storage, syncSecretStore };
    }

    it("hides the local-step regenerate affordance for a guest session, leaving the rest of that step intact", async () => {
      await renderGuestScreenForRegenerate();

      // The affordance that would mint and reveal a NEW, real recovery
      // phrase must be gone for a guest...
      expect(screen.queryByTestId("settings-sync-prepare-button")).toBeNull();
      // ...but this is a targeted hide, not a wholesale collapse of the
      // step: local secrets already exist (silently, from guest accept), so
      // step 1 still legitimately shows done, and the generic notice text
      // (which never mentions the button) still renders.
      expect(
        (await screen.findAllByTestId("settings-sync-step-done")).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByText(
          "This screen shows the recovery phrase only when you prepare or recreate local sync keys.",
        ),
      ).toBeTruthy();
      // No path to the reveal modal exists either.
      expect(screen.queryByTestId("settings-sync-recovery-phrase")).toBeNull();
    });

    it("still lets a non-guest complete the local-step regenerate flow and reveal a fresh phrase (owner path pinned unchanged)", async () => {
      const settingsCopy = getSettingsCopy("en");
      const ownerStorage = createSettingsStorageMock({
        readSyncPreferencesRecord: jest
          .fn()
          .mockResolvedValue(createConnectedManagedPreferences()),
      });
      const ownerSecretStore = createSyncSecretStoreMock();
      await ownerSecretStore.writeSyncSecrets(createConnectedManagedSecrets());
      global.fetch = createManagedBillingFetchMock({
        billing: {
          has_active_plan: true,
          premium_features: {
            advanced_fertility: true,
            advanced_insights: true,
            doctor_pdf: true,
            extended_reports: true,
            partner_access: true,
            reminders: true,
          },
        },
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });

      render(
        <BackupSyncScreen
          now={new Date(2026, 2, 20)}
          storage={ownerStorage}
          syncSecretStore={ownerSecretStore}
        />,
      );
      await screen.findByTestId("settings-sync-section");

      const prepareButton = screen.getByTestId("settings-sync-prepare-button");
      expect(prepareButton).toBeTruthy();
      fireEvent.press(prepareButton);

      await waitFor(() =>
        expect(mockOpenConfirmation).toHaveBeenCalledWith(
          settingsCopy.account.regeneratePrompt,
          settingsCopy.account.regenerateAccept,
        ),
      );
      await waitFor(() =>
        expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledWith(
          settingsCopy.account.regenerateDeviceAuthPrompt,
        ),
      );
      await waitFor(() =>
        expect(screen.getByTestId("settings-sync-recovery-phrase").props.children)
          .toEqual(expect.any(String)),
      );
      const phrase = screen.getByTestId("settings-sync-recovery-phrase")
        .props.children as string;
      expect(phrase.split(" ")).toHaveLength(12);
    });
  });
});

function createConnectedManagedPreferences() {
  return {
    mode: "managed" as const,
    endpointInput: "",
    normalizedEndpoint: "https://sync.ovumcy.cloud",
    deviceLabel: "Pixel 7",
    setupStatus: "connected" as const,
    preparedAt: "2026-03-19T08:15:00.000Z",
    lastRemoteGeneration: 12,
    lastSyncedAt: "2026-03-19T09:00:00.000Z",
  };
}

function createConnectedManagedSecrets() {
  return {
    device: {
      deviceID: "device-1",
      deviceLabel: "Pixel 7",
      createdAt: "2026-03-19T08:15:00.000Z",
    },
    masterKeyHex: "aa",
    deviceSecretHex: "bb",
    wrappedKey: {
      algorithm: "xchacha20poly1305" as const,
      kdf: "bip39_seed_hkdf_sha256" as const,
      mnemonicWordCount: 12 as const,
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
}

function createManagedBillingFetchMock(options: {
  billing: Record<string, unknown>;
  onRenewalPut?: (() => Promise<Response>) | undefined;
}): typeof fetch {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/account/billing/renewal")) {
      if (options.onRenewalPut && init?.method === "PUT") {
        return options.onRenewalPut();
      }
      throw new Error(`Unexpected renewal fetch in test: ${url}`);
    }
    if (url.includes("/auth/session")) {
      return createJSONResponse({
        account_id: "managed-account-1",
        email: "alice@example.com",
        session_expires_at: "2026-03-21T08:00:00.000Z",
        sync_entitlement: {
          sync_allowed: true,
          source: "billing_subscription",
          updated_at: "2026-03-20T08:05:00.000Z",
          effective_at: "2026-03-20T08:05:00.000Z",
          explanation: "plan active",
        },
      });
    }
    if (url.includes("/account/billing")) {
      return createJSONResponse(options.billing);
    }
    if (url.includes("/account/partner/access")) {
      return createJSONResponse({
        owned: { invites: [], grants: [] },
        shared_with_me: [],
      });
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  }) as unknown as typeof fetch;
}

// createManagedDeletionFetchMock extends the createManagedBillingFetchMock
// fixture with the DELETE /account endpoint the "Delete account" flow calls
// once both confirms are accepted, so account-deletion tests can exercise
// the real ManagedCloudAPIClient instead of injecting a factory mock.
function createManagedDeletionFetchMock(options: {
  billing: Record<string, unknown>;
}): typeof fetch {
  return jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "DELETE" && url.endsWith("/account")) {
      return createJSONResponse({ status: "deleted" });
    }
    if (url.includes("/auth/session")) {
      return createJSONResponse({
        account_id: "managed-account-1",
        email: "alice@example.com",
        session_expires_at: "2026-03-21T08:00:00.000Z",
        sync_entitlement: {
          sync_allowed: true,
          source: "billing_subscription",
          updated_at: "2026-03-20T08:05:00.000Z",
          effective_at: "2026-03-20T08:05:00.000Z",
          explanation: "plan active",
        },
      });
    }
    if (url.includes("/account/billing")) {
      return createJSONResponse(options.billing);
    }
    if (url.includes("/account/partner/access")) {
      return createJSONResponse({
        owned: { invites: [], grants: [] },
        shared_with_me: [],
      });
    }
    throw new Error(`Unexpected fetch in test: ${method} ${url}`);
  }) as unknown as typeof fetch;
}
