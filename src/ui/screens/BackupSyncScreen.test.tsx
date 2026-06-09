import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

import { createSyncSecretsRecord } from "../../security/sync-crypto";
import { clearManagedPartnerInviteToken } from "../../security/managed-partner-invite-token-buffer";
import { requestSensitiveActionChallenge } from "../../security/sensitive-action-auth";
import * as backupSyncScreenService from "../../services/backup-sync-screen-service";
import { formatBackupSyncLastSeen } from "../../services/backup-sync-view-service";
import { createLoadedSettingsState } from "../../services/settings-view-service";
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
              premiumActive: false,
              recoverySupported: true,
              pushSupported: false,
              portalSupported: false,
              advancedCloudInsights: false,
              maxDevices: 5,
              maxBlobBytes: 1024,
            },
            {
              planStatus: "unknown",
              doctorPDF: false,
              reminders: false,
              activeSubscription: null,
            },
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

    fireEvent.press(await screen.findByTestId("backup-sync-advanced-toggle"));
    await screen.findByTestId("settings-partner-section");
    expect(screen.queryByTestId("settings-partner-plan-lock")).toBeNull();

    fireEvent.press(screen.getByTestId("settings-partner-access-level-full"));
    fireEvent.press(screen.getByTestId("settings-partner-issue-button"));

    await screen.findByTestId("settings-partner-invite-link-card");
    expect(screen.getByTestId("settings-partner-invite-link").props.children).toBe(
      "ovumcy://backup-sync?invite_token=invite-token-1-fixture-padding",
    );
    expect(screen.getByTestId("settings-partner-invite-invite-1")).toBeTruthy();
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

    fireEvent.press(await screen.findByTestId("backup-sync-advanced-toggle"));
    await screen.findByTestId("settings-partner-accept-card");
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
            premiumActive: true,
            recoverySupported: false,
            pushSupported: false,
            portalSupported: false,
            advancedCloudInsights: false,
            maxDevices: 5,
            maxBlobBytes: 1024,
          },
          {
            planStatus: "active",
            doctorPDF: false,
            reminders: false,
            activeSubscription: null,
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
});
