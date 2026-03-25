import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { BackHandler, Platform } from "react-native";

import { requestSensitiveActionChallenge } from "../../security/sensitive-action-auth";
import { createSettingsStorageMock } from "../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../test/create-sync-secret-store-mock";
import { openConfirmation } from "../confirm/open-confirmation";
import { SettingsScreen } from "./SettingsScreen";

const mockUseEffect = React.useEffect;
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockDispatch = jest.fn();
const mockParentNavigate = jest.fn();
let preventRemoveCallback:
  | ((options: { data: { action: { type: string } } }) => void)
  | null = null;
let tabPressCallback:
  | ((event: {
      preventDefault: () => void;
      target?: string;
    }) => void)
  | null = null;
let hardwareBackPressCallback: (() => boolean | null | undefined) | null = null;
let addBackHandlerListenerSpy: jest.SpiedFunction<typeof BackHandler.addEventListener>;
let exitAppSpy: jest.SpiedFunction<typeof BackHandler.exitApp>;
const originalPlatformOS = Platform.OS;

jest.setTimeout(15000);

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
    }),
  };
});

jest.mock("@react-navigation/native", () => {
  return {
    useNavigation: () => ({
      dispatch: mockDispatch,
      getParent: () => ({
        addListener: (
          eventName: string,
          callback: (event: {
            preventDefault: () => void;
            target?: string;
          }) => void,
        ) => {
          if (eventName === "tabPress") {
            tabPressCallback = callback;
          }
          return jest.fn();
        },
        getState: () => ({
          index: 3,
          routes: [
            { key: "dashboard-key", name: "dashboard", params: undefined },
            { key: "calendar-key", name: "calendar", params: undefined },
            { key: "stats-key", name: "stats", params: undefined },
            { key: "settings-key", name: "settings", params: undefined },
          ],
        }),
        navigate: mockParentNavigate,
      }),
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

describe("SettingsScreen", () => {
  beforeEach(() => {
    if (!global.requestAnimationFrame) {
      global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      }) as typeof requestAnimationFrame;
    }

    preventRemoveCallback = null;
    tabPressCallback = null;
    mockDispatch.mockReset();
    mockParentNavigate.mockReset();
    mockOpenConfirmation.mockReset();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockRequestSensitiveActionChallenge.mockReset();
    mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    hardwareBackPressCallback = null;
    addBackHandlerListenerSpy = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((eventName, callback) => {
        if (eventName === "hardwareBackPress") {
          hardwareBackPressCallback = callback;
        }

        return {
          remove: jest.fn(() => {
            if (eventName === "hardwareBackPress") {
              hardwareBackPressCallback = null;
            }
          }),
        };
      });
    exitAppSpy = jest.spyOn(BackHandler, "exitApp").mockImplementation(jest.fn());
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
    addBackHandlerListenerSpy.mockRestore();
    exitAppSpy.mockRestore();
  });

  it("saves cycle settings through the canonical profile repository", async () => {
    const storage = createSettingsStorageMock();

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

  it("maps the prediction-mode selector to the persisted cycle flags", async () => {
    const storage = createSettingsStorageMock();

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

  it("saves tracking settings with the chosen temperature unit", async () => {
    const storage = createSettingsStorageMock();

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

  it("saves screenshot protection through interface settings", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-toggle-screen-capture-protection"));
    fireEvent.press(screen.getByTestId("settings-save-interface-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          screenCaptureProtectionEnabled: false,
        }),
      ),
    );
  });

  it("toggles tracking cards through the shared binary toggle control", async () => {
    const storage = createSettingsStorageMock();

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
    const storage = createSettingsStorageMock();

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

  it("opens the dedicated backup and sync screen from the summary card", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-sync-summary-card");

    fireEvent.press(screen.getByTestId("settings-open-backup-sync-button"));

    expect(mockPush).toHaveBeenCalledWith("/backup-sync");
  });

  it("saves pending settings before opening backup and sync", async () => {
    const storage = createSettingsStorageMock();
    mockOpenConfirmation.mockResolvedValue(true);

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      35,
    );
    fireEvent.press(screen.getByTestId("settings-open-backup-sync-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          cycleLength: 35,
        }),
      ),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/backup-sync"));
  });

  it("renders the app-equivalent interface, backup summary, export, and danger sections", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    expect(screen.getByTestId("settings-cycle-section")).toBeTruthy();
    expect(screen.getByTestId("settings-symptoms-section")).toBeTruthy();
    expect(screen.getByTestId("settings-tracking-section")).toBeTruthy();
    expect(screen.getByTestId("settings-interface-section")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-summary-card")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-section")).toBeNull();
    expect(screen.getByTestId("settings-export-section")).toBeTruthy();
    expect(screen.getByTestId("settings-danger-zone-section")).toBeTruthy();
    expect(screen.getByTestId("settings-export-pdf-button")).toBeTruthy();
  });

  it("prepares a JSON export through the settings flow and hands it to the delivery client", async () => {
    const storage = createSettingsStorageMock();
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
    const storage = createSettingsStorageMock();
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
    const storage = createSettingsStorageMock();

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

  it("saves cycle changes before leaving settings when the general guard accepts saving", async () => {
    const storage = createSettingsStorageMock();
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
    const storage = createSettingsStorageMock();
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

  it("saves pending settings before switching tabs", async () => {
    const storage = createSettingsStorageMock();
    mockOpenConfirmation.mockResolvedValue(true);

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      35,
    );

    expect(tabPressCallback).toEqual(expect.any(Function));

    await act(async () => {
      tabPressCallback?.({
        preventDefault: jest.fn(),
        target: "calendar-key",
      });
    });

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          cycleLength: 35,
        }),
      ),
    );
    await waitFor(() =>
      expect(mockParentNavigate).toHaveBeenCalledWith("calendar", undefined),
    );
  });

  it("discards interface preview changes when leaving settings without saving", async () => {
    const storage = createSettingsStorageMock();
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

  it("confirms unsaved changes before the Android hardware back exits settings", async () => {
    const storage = createSettingsStorageMock();
    mockOpenConfirmation.mockResolvedValue(false);

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      35,
    );

    expect(hardwareBackPressCallback).toEqual(expect.any(Function));

    await act(async () => {
      hardwareBackPressCallback?.();
    });

    await waitFor(() =>
      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
      ),
    );
    await waitFor(() => expect(exitAppSpy).toHaveBeenCalledTimes(1));
    expect(storage.writeProfileRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({
        cycleLength: 35,
      }),
    );
  });

  it("requires typed confirmation before clearing all local data", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-clear-data-button"));

    expect(screen.getByTestId("settings-danger-zone-section")).toBeTruthy();
    expect(screen.getByTestId("settings-clear-data-confirmation-input")).toBeTruthy();
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("clears local data, wipes sync secrets, and returns to onboarding after confirmation", async () => {
    const storage = createSettingsStorageMock();
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
      managedAuthSessionToken: null,
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
    const storage = createSettingsStorageMock();
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
