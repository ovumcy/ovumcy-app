import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import * as backupSyncScreenService from "../../services/backup-sync-screen-service";
import { DATA_SHARING_CONSENT_REVISION } from "../../services/data-sharing-consent-service";
import { clearManagedPartnerInviteToken } from "../../security/managed-partner-invite-token-buffer";
import { createSettingsStorageMock } from "../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../test/create-sync-secret-store-mock";
import {
  createDefaultSyncPreferencesRecord,
  withDataSharingConsent,
  type SyncPreferencesRecord,
} from "../../sync/sync-contract";
import { BackupSyncScreen } from "./BackupSyncScreen";

const mockUseEffect = React.useEffect;
const mockRouter = { back: jest.fn(), replace: jest.fn() };
const mockNavigation = { dispatch: jest.fn() };
const mockSearchParams = {};

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockUseEffect(effect, [effect]);
  },
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => mockRouter,
}));

jest.mock("expo-router/react-navigation", () => ({
  useNavigation: () => mockNavigation,
  usePreventRemove: jest.fn(),
}));

jest.mock("../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

jest.mock("../../security/sensitive-action-auth", () => ({
  requestSensitiveActionChallenge: jest.fn().mockResolvedValue({ ok: true }),
}));

const NOW = new Date("2026-05-17T08:00:00.000Z");
const originalFetch = global.fetch;

function managedPreferences(
  overrides: Partial<SyncPreferencesRecord> = {},
): SyncPreferencesRecord {
  return {
    ...createDefaultSyncPreferencesRecord(),
    deviceLabel: "Pixel 7",
    setupStatus: "local_ready",
    preparedAt: "2026-05-17T08:00:00.000Z",
    ...overrides,
  };
}

async function renderReadyToLogIn(preferences: SyncPreferencesRecord) {
  // Keeps the stored consent the way the real storage does: only a write that
  // passes `options.dataSharingConsent` changes it.
  let stored = preferences;
  const storage = createSettingsStorageMock({
    readSyncPreferencesRecord: jest.fn(async () => stored),
    writeSyncPreferencesRecord: jest.fn(
      async (
        record: SyncPreferencesRecord,
        options?: { dataSharingConsent?: SyncPreferencesRecord["dataSharingConsent"] },
      ) => {
        stored = withDataSharingConsent(
          record,
          options?.dataSharingConsent !== undefined
            ? options.dataSharingConsent
            : stored.dataSharingConsent,
        );
      },
    ),
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
  await render(
    <BackupSyncScreen
      now={NOW}
      storage={storage}
      syncSecretStore={syncSecretStore}
    />,
  );
  await screen.findByTestId("settings-sync-section");
  await fireEvent.changeText(
    screen.getByTestId("settings-sync-login-input"),
    "owner@example.com",
  );
  await fireEvent.changeText(
    screen.getByTestId("settings-sync-password-input"),
    "correct horse battery staple",
  );
  return storage;
}

function consentWrites(storage: ReturnType<typeof createSettingsStorageMock>) {
  return jest
    .mocked(storage.writeSyncPreferencesRecord)
    .mock.calls.filter(([, options]) => options?.dataSharingConsent !== undefined);
}

describe("BackupSyncScreen data-sharing consent", () => {
  let fetchMock: jest.Mock;
  let connectSpy: jest.SpyInstance;

  beforeEach(() => {
    clearManagedPartnerInviteToken();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    connectSpy = jest
      .spyOn(backupSyncScreenService, "connectBackupSyncAccount")
      .mockResolvedValue({ ok: false, errorCode: "network_failed" } as Awaited<
        ReturnType<typeof backupSyncScreenService.connectBackupSyncAccount>
      >);
  });

  afterEach(() => {
    connectSpy.mockRestore();
    global.fetch = originalFetch;
  });

  it("asks before the first connect and sends nothing while the dialog is open or after it is declined", async () => {
    const storage = await renderReadyToLogIn(managedPreferences());

    await fireEvent.press(screen.getByTestId("settings-sync-login-button"));

    expect(await screen.findByTestId("data-sharing-consent-dialog")).toBeTruthy();
    expect(
      screen.getByText("Turn on encrypted sync with Ovumcy Cloud?"),
    ).toBeTruthy();
    expect(connectSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("data-sharing-consent-decline"));

    await waitFor(() =>
      expect(screen.queryByTestId("data-sharing-consent-dialog")).toBeNull(),
    );
    expect(connectSpy).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consentWrites(storage)).toHaveLength(0);
  });

  it("records the consent with its revision and date before connecting", async () => {
    const storage = await renderReadyToLogIn(managedPreferences());

    await fireEvent.press(screen.getByTestId("settings-sync-login-button"));
    await fireEvent.press(await screen.findByTestId("data-sharing-consent-agree"));

    await waitFor(() => expect(connectSpy).toHaveBeenCalledTimes(1));
    expect(consentWrites(storage)).toHaveLength(1);
    expect(consentWrites(storage)[0]?.[1]).toEqual({
      dataSharingConsent: {
        managed_sync: {
          revision: DATA_SHARING_CONSENT_REVISION,
          givenAt: NOW.toISOString(),
        },
      },
    });
    const consentWriteOrder = jest
      .mocked(storage.writeSyncPreferencesRecord)
      .mock.invocationCallOrder.find(
        (_order, index) =>
          jest.mocked(storage.writeSyncPreferencesRecord).mock.calls[index]?.[1]
            ?.dataSharingConsent !== undefined,
      );
    expect(consentWriteOrder).toBeLessThan(
      connectSpy.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("does not ask again when consent at the current revision is stored", async () => {
    await renderReadyToLogIn(
      managedPreferences({
        dataSharingConsent: {
          managed_sync: {
            revision: DATA_SHARING_CONSENT_REVISION,
            givenAt: "2026-05-01T08:00:00.000Z",
          },
        },
      }),
    );

    await fireEvent.press(screen.getByTestId("settings-sync-login-button"));

    await waitFor(() => expect(connectSpy).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("data-sharing-consent-dialog")).toBeNull();
  });

  it("asks again when the stored consent is for an older revision or another destination", async () => {
    await renderReadyToLogIn(
      managedPreferences({
        dataSharingConsent: {
          managed_sync: { revision: "2020-01-01", givenAt: "2020-01-01T08:00:00.000Z" },
          self_hosted_sync: {
            revision: DATA_SHARING_CONSENT_REVISION,
            givenAt: "2026-05-01T08:00:00.000Z",
          },
        },
      }),
    );

    await fireEvent.press(screen.getByTestId("settings-sync-login-button"));

    expect(await screen.findByTestId("data-sharing-consent-dialog")).toBeTruthy();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("says the withdrawal failed and keeps the control when the write fails", async () => {
    const storage = await renderReadyToLogIn(
      managedPreferences({
        dataSharingConsent: {
          managed_sync: {
            revision: DATA_SHARING_CONSENT_REVISION,
            givenAt: "2026-05-01T08:00:00.000Z",
          },
        },
      }),
    );
    await screen.findByTestId("data-sharing-consent-withdraw-button");
    jest
      .mocked(storage.writeSyncPreferencesRecord)
      .mockRejectedValueOnce(new Error("disk full"));

    await fireEvent.press(screen.getByTestId("data-sharing-consent-withdraw-button"));

    expect(
      await screen.findByText("Could not withdraw the consent. Try again."),
    ).toBeTruthy();
    expect(screen.queryByTestId("data-sharing-consent-withdrawal-status")).toBeNull();
    expect(screen.getByTestId("data-sharing-consent-withdraw-button")).toBeTruthy();
  });

  it("offers no withdrawal control while no consent is stored", async () => {
    await renderReadyToLogIn(managedPreferences());

    expect(screen.queryByTestId("data-sharing-consent-withdrawal-section")).toBeNull();
    expect(screen.queryByTestId("data-sharing-consent-withdraw-button")).toBeNull();
  });

  it("withdraws every stored consent in one tap, says what stops, and the next connect asks again", async () => {
    const storage = await renderReadyToLogIn(
      managedPreferences({
        dataSharingConsent: {
          managed_sync: {
            revision: DATA_SHARING_CONSENT_REVISION,
            givenAt: "2026-05-01T08:00:00.000Z",
          },
          partner_share: {
            revision: DATA_SHARING_CONSENT_REVISION,
            givenAt: "2026-05-01T08:00:00.000Z",
          },
        },
      }),
    );

    expect(
      await screen.findByTestId("data-sharing-consent-withdrawal-section"),
    ).toBeTruthy();
    expect(screen.getByText("• Encrypted sync with Ovumcy Cloud")).toBeTruthy();
    expect(screen.getByText("• Sharing your cycle with a partner")).toBeTruthy();
    expect(
      screen.getByText(/stops new backups and partner updates from leaving this device/),
    ).toBeTruthy();
    expect(
      screen.getByTestId("data-sharing-consent-withdrawal-revokes-partners"),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId("data-sharing-consent-withdraw-button"));

    expect(
      await screen.findByText(
        "Consent withdrawn. Nothing more is sent until you agree again.",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("data-sharing-consent-withdraw-button")).toBeNull();
    expect(screen.queryByTestId("data-sharing-consent-dialog")).toBeNull();
    expect(consentWrites(storage).at(-1)?.[1]).toEqual({ dataSharingConsent: {} });
    expect(fetchMock).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("settings-sync-login-button"));

    expect(await screen.findByTestId("data-sharing-consent-dialog")).toBeTruthy();
    expect(connectSpy).not.toHaveBeenCalled();
  });
});
