import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../../test/create-sync-secret-store-mock";
import { requestSensitiveActionChallenge } from "../../security/sensitive-action-auth";
import { openConfirmation } from "../confirm/open-confirmation";
import { SettingsScreen } from "./SettingsScreen";

const mockUseEffect = React.useEffect;
const mockReplace = jest.fn();
const mockDispatch = jest.fn();
let preventRemoveCallback:
  | ((options: { data: { action: { type: string } } }) => void)
  | null = null;

jest.setTimeout(15000);

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
    useRouter: () => ({
      replace: mockReplace,
    }),
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

function createStorageMock(overrides = {}) {
  return createLocalAppStorageMock({
    readProfileRecord: jest.fn().mockResolvedValue({
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
      languageOverride: "en",
      themeOverride: "light",
    }),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    readDayLogSummary: jest.fn().mockResolvedValue({
      totalEntries: 1,
      hasData: true,
      dateFrom: "2026-03-10",
      dateTo: "2026-03-10",
    }),
    listDayLogRecordsInRange: jest.fn().mockResolvedValue([
      {
        date: "2026-03-10",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "Cycle start",
      },
    ]),
    ...overrides,
  });
}

describe("SettingsScreen", () => {
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
  });

  it("saves cycle settings through the canonical profile repository", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      35,
    );
    fireEvent.press(screen.getByTestId("settings-save-cycle-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          cycleLength: 35,
        }),
      ),
    );
  });

  it("saves tracking settings with the chosen temperature unit", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-temperature-unit-f"));
    fireEvent.press(screen.getByTestId("settings-save-tracking-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          temperatureUnit: "f",
        }),
      ),
    );
  });

  it("toggles tracking cards through the shared binary toggle control", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-toggle-track-bbt"));
    fireEvent.press(screen.getByTestId("settings-save-tracking-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          trackBBT: true,
        }),
      ),
    );
  });

  it("creates and archives a custom symptom through the settings flow", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.changeText(
      screen.getByTestId("settings-symptom-create-name-input"),
      "Jaw pain",
    );
    fireEvent.press(screen.getByTestId("settings-symptom-create-icon-🔥"));
    fireEvent.press(screen.getByTestId("settings-symptom-create-action-button"));

    await waitFor(() =>
      expect(storage.writeSymptomRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "Jaw pain",
          icon: "🔥",
          isArchived: false,
        }),
      ),
    );

    const createdRecord = (
      storage.writeSymptomRecord as jest.Mock
    ).mock.calls[0][0];

    fireEvent.press(screen.getByTestId(`settings-symptom-archive-${createdRecord.id}`));

    await waitFor(() =>
      expect(storage.writeSymptomRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          id: createdRecord.id,
          isArchived: true,
        }),
      ),
    );
  });

  it("prepares local encrypted sync and reveals the recovery phrase once", async () => {
    const storage = createStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();

    render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-cycle-section");

    fireEvent.changeText(
      screen.getByTestId("settings-sync-device-label-input"),
      "Pixel 7",
    );
    fireEvent.press(screen.getByTestId("settings-sync-prepare-button"));

    await waitFor(() =>
      expect(storage.writeSyncPreferencesRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "managed",
          normalizedEndpoint: "https://sync.ovumcy.com",
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

  it("shows connected sync actions when the device already has an auth session", async () => {
    const storage = createStorageMock({
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

    render(
      <SettingsScreen
        now={new Date(2026, 2, 20)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-cycle-section");

    expect(screen.getByTestId("settings-sync-upload-button")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-restore-button")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-disconnect-button")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-login-button")).toBeNull();
    expect(screen.queryByTestId("settings-sync-register-button")).toBeNull();
  });

  it("requires confirmation before recreating local sync keys", async () => {
    const storage = createStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.com",
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
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-sync-prepare-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(1));
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("blocks sync key recreation when device security challenge is unavailable", async () => {
    const storage = createStorageMock({
      readSyncPreferencesRecord: jest.fn().mockResolvedValue({
        mode: "managed",
        endpointInput: "",
        normalizedEndpoint: "https://sync.ovumcy.com",
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
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-sync-prepare-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledTimes(1),
    );
    expect(storage.writeSyncPreferencesRecord).not.toHaveBeenCalled();
  });

  it("prepares a JSON export through the settings flow and hands it to the delivery client", async () => {
    const storage = createStorageMock();
    const exportDeliveryClient = {
      deliver: jest.fn().mockResolvedValue({ ok: true }),
    };

    render(
      <SettingsScreen
        exportDeliveryClient={exportDeliveryClient}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-export-json-button"));

    await waitFor(() =>
      expect(exportDeliveryClient.deliver).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "ovumcy-export-2026-03-17.json",
          mimeType: "application/json",
        }),
      ),
    );
  });

  it("prepares a PDF export through the settings flow and hands it to the delivery client", async () => {
    const storage = createStorageMock();
    const buildPDFContent = jest
      .fn()
      .mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    const exportDeliveryClient = {
      deliver: jest.fn().mockResolvedValue({ ok: true }),
    };

    render(
      <SettingsScreen
        exportDeliveryClient={exportDeliveryClient}
        exportServiceDependencies={{ buildPDFContent }}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-export-pdf-button"));

    await waitFor(() =>
      expect(exportDeliveryClient.deliver).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "ovumcy-export-2026-03-17.pdf",
          mimeType: "application/pdf",
        }),
      ),
    );
    expect(buildPDFContent).toHaveBeenCalledTimes(1);
  });

  it("updates the native export range through the date picker instead of free-text input", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    await act(async () => {
      fireEvent.press(screen.getByTestId("settings-export-from-button"));
    });

    await act(async () => {
      fireEvent(
        screen.getByTestId("settings-export-date-picker"),
        "onChange",
        { type: "set" },
        new Date(2026, 2, 12),
      );
      await Promise.resolve();
    });

    expect(screen.getByTestId("settings-export-from-value").props.children).toBe(
      "2026-03-12",
    );
    expect(screen.getByTestId("settings-export-to-value").props.children).toBe(
      "2026-03-17",
    );
  });

  it("uses one prediction-mode selector and keeps age-group copy honest", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    expect(screen.getByText(/Insights/i)).toBeTruthy();
    expect(screen.queryByTestId("settings-toggle-irregular-cycle")).toBeNull();
    expect(screen.queryByTestId("settings-toggle-unpredictable-cycle")).toBeNull();

    fireEvent.press(screen.getByTestId("settings-prediction-mode-irregular"));
    expect(
      screen.getByTestId("settings-prediction-mode-irregular").props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));

    fireEvent.press(screen.getByTestId("settings-prediction-mode-facts_only"));
    expect(
      screen.getByTestId("settings-prediction-mode-facts_only").props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));
    expect(screen.queryByText(/Ignored|Игнорируется|Ignorado/)).toBeNull();
  });

  it("maps the prediction-mode selector to the persisted cycle flags", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-prediction-mode-facts_only"));
    fireEvent.press(screen.getByTestId("settings-save-cycle-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          irregularCycle: false,
          unpredictableCycle: true,
        }),
      ),
    );
  });

  it("saves cycle changes before leaving settings when the general guard accepts saving", async () => {
    const storage = createStorageMock();
    mockOpenConfirmation.mockResolvedValue(true);

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      35,
    );

    expect(preventRemoveCallback).toEqual(expect.any(Function));

    await act(async () => {
      preventRemoveCallback?.({ data: { action: { type: "NAVIGATE" } } });
    });

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          cycleLength: 35,
        }),
      ),
    );
    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "NAVIGATE" }),
      ),
    );
  });

  it("saves interface changes before leaving settings when the guard accepts saving", async () => {
    const storage = createStorageMock();
    mockOpenConfirmation.mockResolvedValue(true);

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-interface-theme-dark"));

    expect(preventRemoveCallback).toEqual(expect.any(Function));

    await act(async () => {
      preventRemoveCallback?.({ data: { action: { type: "NAVIGATE" } } });
    });

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          themeOverride: "dark",
        }),
      ),
    );
    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "NAVIGATE" }),
      ),
    );
  });

  it("discards interface preview changes when leaving settings without saving", async () => {
    const storage = createStorageMock();
    mockOpenConfirmation.mockResolvedValue(false);

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-interface-theme-dark"));

    expect(preventRemoveCallback).toEqual(expect.any(Function));

    await act(async () => {
      preventRemoveCallback?.({ data: { action: { type: "NAVIGATE" } } });
    });

    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "NAVIGATE" }),
      ),
    );
    expect(storage.writeProfileRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({
        themeOverride: "dark",
      }),
    );
    expect(
      screen.getByTestId("settings-interface-theme-light").props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));
  });

  it("renders the app-equivalent interface, sync, export, and danger sections", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    expect(screen.getByTestId("settings-cycle-section")).toBeTruthy();
    expect(screen.getByTestId("settings-symptoms-section")).toBeTruthy();
    expect(screen.getByTestId("settings-tracking-section")).toBeTruthy();
    expect(screen.getByTestId("settings-interface-section")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-section")).toBeTruthy();
    expect(screen.getByTestId("settings-export-section")).toBeTruthy();
    expect(screen.getByTestId("settings-danger-zone-section")).toBeTruthy();
    expect(screen.getByTestId("settings-export-pdf-button")).toBeTruthy();
  });

  it("requires typed confirmation before clearing all local data", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-clear-data-button"));

    expect(screen.getByTestId("settings-danger-zone-section")).toBeTruthy();
    expect(screen.getByTestId("settings-clear-data-confirmation-input")).toBeTruthy();
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("clears local data, wipes sync secrets, and returns to onboarding after confirmation", async () => {
    const storage = createStorageMock();
    const syncSecretStore = createSyncSecretStoreMock();

    await syncSecretStore.writeSyncSecrets({
      device: {
        deviceID: "device-1",
        deviceLabel: "Phone",
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

    render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-cycle-section");

    fireEvent.changeText(
      screen.getByTestId("settings-clear-data-confirmation-input"),
      "CLEAR",
    );
    fireEvent.press(screen.getByTestId("settings-clear-data-button"));

    await waitFor(() => expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/onboarding",
          params: expect.objectContaining({
            reset: expect.any(String),
          }),
        }),
      ),
    );
    await expect(syncSecretStore.readSyncSecrets()).resolves.toBeNull();
  });

  it("requires device security before clearing all local data", async () => {
    const storage = createStorageMock();
    mockRequestSensitiveActionChallenge.mockResolvedValue({
      ok: false,
      reason: "unavailable",
    });

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.changeText(
      screen.getByTestId("settings-clear-data-confirmation-input"),
      "CLEAR",
    );
    fireEvent.press(screen.getByTestId("settings-clear-data-button"));

    await waitFor(() =>
      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledTimes(1),
    );
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
