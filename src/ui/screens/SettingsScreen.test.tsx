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
import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultProfileRecord } from "../../models/profile";
import type { LocalReminderScheduler } from "../../services/local-reminder-scheduler-contract";
import { createSettingsStorageMock } from "../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../test/create-sync-secret-store-mock";
import { openConfirmation, openLeaveConfirmation } from "../confirm/open-confirmation";
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
  const tabsParentNavigation = {
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
    getParent: () => undefined,
    navigate: (
      name: string,
      params?: Record<string, unknown> | undefined,
    ) => mockParentNavigate(name, params),
  };

  const nearestParentNavigation = {
    addListener: () => jest.fn(),
    getState: () => ({
      index: 0,
      routes: [
        { key: "settings-stack-key", name: "settings", params: undefined },
        { key: "backup-sync-stack-key", name: "backup-sync", params: undefined },
      ],
    }),
    getParent: () => tabsParentNavigation,
    navigate: jest.fn(),
  };

  return {
    useNavigation: () => ({
      dispatch: mockDispatch,
      getParent: () => nearestParentNavigation,
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
    mockOpenLeaveConfirmation.mockReset();
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
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

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
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

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
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

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
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

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
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          trackBBT: true,
        }),
      ),
    );
  });

  it("persists the hide-notes privacy toggle through settings", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-toggle-hide-notes"));
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          hideNotes: true,
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
    mockOpenLeaveConfirmation.mockResolvedValue("accept");

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
    expect(screen.getByTestId("settings-reminders-section")).toBeTruthy();
    expect(screen.getByTestId("settings-reminders-lock")).toBeTruthy();
    expect(screen.getByTestId("settings-interface-section")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-summary-card")).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-section")).toBeNull();
    expect(screen.getByTestId("settings-export-section")).toBeTruthy();
    expect(screen.getByTestId("settings-danger-zone-section")).toBeTruthy();
    expect(screen.getByTestId("settings-save-all-button")).toBeTruthy();
    expect(screen.queryByTestId("settings-save-cycle-button")).toBeNull();
    expect(screen.queryByTestId("settings-save-tracking-button")).toBeNull();
    expect(screen.queryByTestId("settings-save-interface-button")).toBeNull();
    expect(screen.getByTestId("settings-export-pdf-button")).toBeTruthy();
    expect(screen.getByTestId("settings-export-pdf-lock")).toBeTruthy();
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
    const syncSecretStore = createSyncSecretStoreMock({
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
    const buildPDFContent = jest
      .fn()
      .mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    const exportDeliveryClient = {
      deliver: jest.fn().mockResolvedValue({ ok: true }),
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
            premium_features: {
              doctor_pdf: true,
              advanced_insights: true,
              reminders: false,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ) as typeof fetch;

    render(
      <SettingsScreen
        exportDeliveryClient={exportDeliveryClient}
        exportServiceDependencies={{ buildPDFContent }}
        now={new Date(2026, 2, 17)}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-cycle-section");
    expect(screen.queryByTestId("settings-export-pdf-lock")).toBeNull();

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

  it("saves managed reminder settings and syncs the local device schedule", async () => {
    const storage = createSettingsStorageMock();
    const reminderScheduler: LocalReminderScheduler = {
      sync: jest.fn().mockResolvedValue("scheduled"),
    };
    const syncSecretStore = createSyncSecretStoreMock({
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
        new Response(
          JSON.stringify({
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
            premium_features: {
              doctor_pdf: false,
              advanced_insights: false,
              reminders: true,
            },
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
            premium_features: {
              doctor_pdf: false,
              advanced_insights: false,
              reminders: true,
            },
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
            enabled: false,
            schedules: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ) as typeof fetch;

    render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        reminderScheduler={reminderScheduler}
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-reminders-section");
    expect(screen.queryByTestId("settings-reminders-lock")).toBeNull();

    fireEvent.press(screen.getByTestId("settings-toggle-reminder-daily-log"));
    fireEvent.changeText(screen.getByTestId("settings-reminder-time-input"), "21:30");
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          dailyLogReminderEnabled: true,
          reminderTime: "21:30",
        }),
      ),
    );
    await waitFor(() =>
      expect(reminderScheduler.sync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "daily_log",
            trigger: {
              type: "daily",
              hour: 21,
              minute: 30,
            },
          }),
        ]),
      ),
    );
    expect(screen.getByTestId("settings-reminders-status-banner")).toBeTruthy();
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

  it("opens a web date input for the last period start and saves the typed date", async () => {
    const storage = createSettingsStorageMock();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-cycle-date-field-button"));

    const dateInput = await screen.findByTestId("settings-cycle-date-input");
    fireEvent.changeText(dateInput, "20260312");

    await waitFor(() =>
      expect(screen.getByTestId("settings-cycle-date-input").props.value).toBe(
        "2026-03-12",
      ),
    );

    fireEvent.press(screen.getByTestId("settings-cycle-date-confirm-button"));
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          lastPeriodStart: "2026-03-12",
        }),
      ),
    );
  });

  it("saves cycle changes before leaving settings when the general guard accepts saving", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("accept");

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
    mockOpenLeaveConfirmation.mockResolvedValue("accept");

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
    mockOpenLeaveConfirmation.mockResolvedValue("accept");

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
    mockOpenLeaveConfirmation.mockResolvedValue("reject");

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

  it("stays in settings and keeps changes when the leave guard is dismissed", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("dismiss");

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-interface-theme-dark"));

    expect(preventRemoveCallback).toEqual(expect.any(Function));

    await act(async () => {
      preventRemoveCallback?.({ data: { action: { type: "NAVIGATE" } } });
    });

    await waitFor(() => expect(mockOpenLeaveConfirmation).toHaveBeenCalled());
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("settings-interface-theme-dark").props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));
  });

  it("confirms unsaved changes before the Android hardware back exits settings", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("reject");

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
      expect(mockOpenLeaveConfirmation).toHaveBeenCalledWith(
        expect.any(String),
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
        expect.stringMatching(/^\/onboarding\?reset=\d+$/),
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

  function importEnvelopeJSON(overrides: Record<string, unknown> = {}) {
    return JSON.stringify({
      app: "ovumcy",
      formatVersion: 1,
      exportedAt: "2026-03-01T10:00:00.000Z",
      preset: "all",
      range: { fromDate: null, toDate: null },
      summary: {
        totalEntries: 2,
        hasData: true,
        dateFrom: "2026-03-01",
        dateTo: "2026-03-02",
      },
      profile: { lastPeriodStart: "2026-01-05", cycleLength: 30 },
      symptoms: [],
      dayLogs: [
        { date: "2026-03-01", isPeriod: true, flow: "medium" },
        { date: "2026-03-02", mood: 4 },
      ],
      ...overrides,
    });
  }

  function createImportPickerMock(content: string) {
    return {
      pick: jest.fn().mockResolvedValue({ status: "picked", content }),
    };
  }

  it("runs the two-phase import: preview shows counts and nothing is written until confirm", async () => {
    const storage = createSettingsStorageMock({
      readDayLogRecord: jest.fn().mockImplementation(async (date: string) =>
        date === "2026-03-01"
          ? { ...createEmptyDayLogRecord(date), notes: "existing entry" }
          : createEmptyDayLogRecord(date),
      ),
    });
    const importFilePickerClient = createImportPickerMock(importEnvelopeJSON());

    render(
      <SettingsScreen
        importFilePickerClient={importFilePickerClient}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-import-section");
    fireEvent.press(screen.getByTestId("settings-import-pick-button"));

    await screen.findByTestId("settings-import-preview");
    expect(screen.getByText("New days to add: 1")).toBeTruthy();
    expect(
      screen.getByText("Days already on this device (kept unchanged): 1"),
    ).toBeTruthy();
    expect(screen.getByText("Your current settings stay unchanged.")).toBeTruthy();
    // Two-phase contract: the preview is a dry run.
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("settings-import-confirm-button"));

    await screen.findByTestId("settings-import-status-banner");
    expect(
      screen.getByText("Restored 1 days (1 already present, 0 ignored)."),
    ).toBeTruthy();
    expect(storage.writeDayLogRecord).toHaveBeenCalledTimes(1);
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-03-02", mood: 4 }),
    );
    // Configured device: the backup profile must never replace user settings.
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
    expect(screen.queryByTestId("settings-import-preview")).toBeNull();
  });

  it("cancels a previewed import without writing anything", async () => {
    const storage = createSettingsStorageMock();
    const importFilePickerClient = createImportPickerMock(importEnvelopeJSON());

    render(
      <SettingsScreen
        importFilePickerClient={importFilePickerClient}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-import-section");
    fireEvent.press(screen.getByTestId("settings-import-pick-button"));
    await screen.findByTestId("settings-import-preview");

    fireEvent.press(screen.getByTestId("settings-import-cancel-button"));

    await waitFor(() =>
      expect(screen.queryByTestId("settings-import-preview")).toBeNull(),
    );
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
    expect(storage.writeSymptomRecord).not.toHaveBeenCalled();
  });

  it("maps a malformed file to its localized message", async () => {
    const storage = createSettingsStorageMock();
    const importFilePickerClient = createImportPickerMock("{not json");

    render(
      <SettingsScreen
        importFilePickerClient={importFilePickerClient}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-import-section");
    fireEvent.press(screen.getByTestId("settings-import-pick-button"));

    await screen.findByTestId("settings-import-error-banner");
    expect(
      screen.getByText(
        "This file can't be read as a backup. Choose an unmodified JSON export created by Ovumcy.",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("settings-import-preview")).toBeNull();
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();
  });

  it("maps a foreign export file to the unrecognized-format message", async () => {
    const storage = createSettingsStorageMock();
    const importFilePickerClient = createImportPickerMock(
      JSON.stringify({ app: "other", formatVersion: 1 }),
    );

    render(
      <SettingsScreen
        importFilePickerClient={importFilePickerClient}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-import-section");
    fireEvent.press(screen.getByTestId("settings-import-pick-button"));

    await screen.findByTestId("settings-import-error-banner");
    expect(
      screen.getByText("This file isn't a valid Ovumcy export."),
    ).toBeTruthy();
  });

  it("maps an oversized pick to the too-large message", async () => {
    const storage = createSettingsStorageMock();
    const importFilePickerClient = {
      pick: jest
        .fn()
        .mockResolvedValue({ status: "failed", errorCode: "too_large" }),
    };

    render(
      <SettingsScreen
        importFilePickerClient={importFilePickerClient}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-import-section");
    fireEvent.press(screen.getByTestId("settings-import-pick-button"));

    await screen.findByTestId("settings-import-error-banner");
    expect(
      screen.getByText("That file is too large to import."),
    ).toBeTruthy();
  });

  it("stays quiet when the picker is dismissed", async () => {
    const storage = createSettingsStorageMock();
    const importFilePickerClient = {
      pick: jest.fn().mockResolvedValue({ status: "cancelled" }),
    };

    render(
      <SettingsScreen
        importFilePickerClient={importFilePickerClient}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-import-section");
    fireEvent.press(screen.getByTestId("settings-import-pick-button"));

    await waitFor(() =>
      expect(importFilePickerClient.pick).toHaveBeenCalledTimes(1),
    );
    expect(screen.queryByTestId("settings-import-error-banner")).toBeNull();
    expect(screen.queryByTestId("settings-import-status-banner")).toBeNull();
    expect(screen.queryByTestId("settings-import-preview")).toBeNull();
  });

  it("restores the backup profile on a pristine device and reports it", async () => {
    const storage = createSettingsStorageMock({
      readProfileRecord: jest
        .fn()
        .mockResolvedValue(createDefaultProfileRecord()),
    });
    const importFilePickerClient = createImportPickerMock(
      importEnvelopeJSON({
        profile: {
          ...createDefaultProfileRecord(),
          lastPeriodStart: "2026-01-05",
          cycleLength: 31,
        },
      }),
    );

    render(
      <SettingsScreen
        importFilePickerClient={importFilePickerClient}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-import-section");
    fireEvent.press(screen.getByTestId("settings-import-pick-button"));

    await screen.findByTestId("settings-import-preview");
    expect(
      screen.getByText(
        "Cycle settings from the backup will be applied — this device still has the default settings.",
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("settings-import-confirm-button"));

    await screen.findByTestId("settings-import-status-banner");
    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPeriodStart: "2026-01-05",
        cycleLength: 31,
      }),
    );
    expect(
      screen.getByText(
        "Restored 2 days (0 already present, 0 ignored). Cycle settings were restored from the backup.",
      ),
    ).toBeTruthy();
  });
});
