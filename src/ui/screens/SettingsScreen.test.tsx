import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Platform } from "react-native";

import { requestSensitiveActionChallenge } from "../../security/sensitive-action-auth";
import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultProfileRecord } from "../../models/profile";
import * as importService from "../../services/import-service";
import type { LocalReminderScheduler } from "../../services/local-reminder-scheduler-contract";
import { createSettingsStorageMock } from "../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../test/create-sync-secret-store-mock";
import { openConfirmation, openLeaveConfirmation } from "../confirm/open-confirmation";
import { SettingsScreen } from "./SettingsScreen";

const mockUseEffect = React.useEffect;
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
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
const originalPlatformOS = Platform.OS;

jest.setTimeout(15000);

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
    useRouter: () => ({
      back: mockBack,
      canGoBack: mockCanGoBack,
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
    mockBack.mockReset();
    mockCanGoBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
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

  it("saves cycle settings through the canonical profile repository", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="tracking" storage={storage} />);

    await screen.findByTestId("settings-tracking-section");

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="interface" storage={storage} />);

    await screen.findByTestId("settings-interface-section");

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

  it("persists a first-day-of-week change through Save all", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="interface" storage={storage} />);

    await screen.findByTestId("settings-interface-section");

    fireEvent.press(
      screen.getByTestId("settings-interface-first-day-of-week-1"),
    );
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          firstDayOfWeek: 1,
        }),
      ),
    );
  });

  it("toggles tracking cards through the shared binary toggle control", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="tracking" storage={storage} />);

    await screen.findByTestId("settings-tracking-section");

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="tracking" storage={storage} />);

    await screen.findByTestId("settings-tracking-section");

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="symptoms" storage={storage} />);

    await screen.findByTestId("settings-symptoms-section");

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="hub" storage={storage} />);

    await screen.findByTestId("settings-sync-summary-card");

    fireEvent.press(screen.getByTestId("settings-open-backup-sync-button"));

    expect(mockPush).toHaveBeenCalledWith("/backup-sync");
  });

  it("opens the privacy notice from the settings privacy card", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="hub" storage={storage} />);

    await screen.findByTestId("settings-privacy-card");

    fireEvent.press(screen.getByTestId("settings-open-privacy-notice-button"));

    expect(mockPush).toHaveBeenCalledWith("/privacy");
  });

  it("saves pending settings before opening backup and sync", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("accept");

    render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        section="reminders"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-reminders-section");

    fireEvent.press(screen.getByTestId("settings-toggle-reminder-daily-log"));
    fireEvent.press(screen.getByTestId("settings-reminders-lock"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          dailyLogReminderEnabled: true,
        }),
      ),
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/backup-sync"));
  });

  it("keeps the hub a summary and navigation surface without inline section editors", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="hub" storage={storage} />);

    await screen.findByTestId("settings-hub-open-cycle");

    expect(screen.getByTestId("settings-hub-open-symptoms")).toBeTruthy();
    expect(screen.getByTestId("settings-hub-open-tracking")).toBeTruthy();
    expect(screen.getByTestId("settings-hub-open-reminders")).toBeTruthy();
    expect(screen.getByTestId("settings-hub-open-interface")).toBeTruthy();
    expect(screen.getByTestId("settings-hub-open-data")).toBeTruthy();
    expect(screen.getByTestId("settings-hub-open-danger")).toBeTruthy();
    expect(screen.getByTestId("settings-sync-summary-card")).toBeTruthy();
    expect(
      screen.getByTestId("settings-sync-summary-details").props.accessibilityLabel,
    ).toBe("Destination. Ovumcy Cloud. Last sync. Not synced yet.");
    expect(screen.getByTestId("settings-privacy-card")).toBeTruthy();
    // Section editors and the pending-save action all moved to the section
    // routes; the hub itself has nothing to edit or save.
    expect(screen.queryByTestId("settings-cycle-section")).toBeNull();
    expect(screen.queryByTestId("settings-symptoms-section")).toBeNull();
    expect(screen.queryByTestId("settings-tracking-section")).toBeNull();
    expect(screen.queryByTestId("settings-reminders-section")).toBeNull();
    expect(screen.queryByTestId("settings-interface-section")).toBeNull();
    expect(screen.queryByTestId("settings-export-section")).toBeNull();
    expect(screen.queryByTestId("settings-import-section")).toBeNull();
    expect(screen.queryByTestId("settings-danger-zone-section")).toBeNull();
    expect(screen.queryByTestId("settings-save-all-button")).toBeNull();
    expect(screen.queryByTestId("settings-sync-section")).toBeNull();
    expect(screen.queryByTestId("settings-section-back-button")).toBeNull();
  });

  it("pushes each section route from its hub navigation row", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="hub" storage={storage} />);

    await screen.findByTestId("settings-hub-open-cycle");

    const expectedHrefBySection = {
      cycle: "/settings/cycle",
      symptoms: "/settings/symptoms",
      tracking: "/settings/tracking",
      reminders: "/settings/reminders",
      interface: "/settings/interface",
      data: "/settings/data",
      danger: "/settings/danger",
    } as const;

    for (const [sectionKey, expectedHref] of Object.entries(
      expectedHrefBySection,
    )) {
      mockPush.mockClear();
      fireEvent.press(screen.getByTestId(`settings-hub-open-${sectionKey}`));
      await waitFor(() => expect(mockPush).toHaveBeenCalledWith(expectedHref));
    }
  });

  it.each([
    ["cycle", "settings-cycle-section"],
    ["symptoms", "settings-symptoms-section"],
    ["tracking", "settings-tracking-section"],
    ["reminders", "settings-reminders-section"],
    ["interface", "settings-interface-section"],
    ["data", "settings-export-section"],
    ["danger", "settings-danger-zone-section"],
  ] as const)(
    "renders the extracted %s section on its own route with a back action and no hub rows",
    async (section, sentinelTestID) => {
      const storage = createSettingsStorageMock();

      render(
        <SettingsScreen
          now={new Date(2026, 2, 17)}
          section={section}
          storage={storage}
        />,
      );

      await screen.findByTestId(sentinelTestID);

      expect(screen.getByTestId("settings-section-back-button")).toBeTruthy();
      expect(screen.queryByTestId("settings-hub-open-cycle")).toBeNull();
      expect(screen.queryByTestId("settings-sync-summary-card")).toBeNull();
      expect(screen.queryByTestId("settings-privacy-card")).toBeNull();
    },
  );

  it("keeps the section-level premium and control details after the move", async () => {
    const storage = createSettingsStorageMock();

    const remindersRender = render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        section="reminders"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-reminders-section");
    expect(screen.getByTestId("settings-reminders-lock")).toBeTruthy();
    expect(screen.getByTestId("settings-reminder-lead-days-slider")).toBeTruthy();

    remindersRender.unmount();
    render(
      <SettingsScreen now={new Date(2026, 2, 17)} section="data" storage={storage} />,
    );

    await screen.findByTestId("settings-export-section");
    expect(screen.getByTestId("settings-import-section")).toBeTruthy();
    expect(screen.getByTestId("settings-export-pdf-button")).toBeTruthy();
    expect(screen.getByTestId("settings-export-pdf-lock")).toBeTruthy();
  });

  it("returns to the settings hub from the section back action", async () => {
    const storage = createSettingsStorageMock();
    mockCanGoBack.mockReturnValue(true);

    render(
      <SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />,
    );

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-section-back-button"));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("falls back to the hub route when a deep-linked section has no history to pop", async () => {
    const storage = createSettingsStorageMock();
    mockCanGoBack.mockReturnValue(false);

    render(
      <SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />,
    );

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-section-back-button"));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
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
        section="data"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-export-section");

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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
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
      // Settings probes the session again to bind the entitlement-token gate;
      // a non-session payload keeps the gate inert so doctorPDF is read from
      // the billing snapshot boolean (still unlocked here).
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
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
        section="data"
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-export-section");
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

  it("schedules local device reminders for a free user while email delivery stays locked", async () => {
    const storage = createSettingsStorageMock();
    const reminderScheduler: LocalReminderScheduler = {
      sync: jest.fn().mockResolvedValue("scheduled"),
    };

    render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        reminderScheduler={reminderScheduler}
        section="reminders"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-reminders-section");
    // No managed session: the email-delivery block stays premium-locked...
    expect(screen.getByTestId("settings-reminders-lock")).toBeTruthy();

    // ...but the local device controls are Free-tier: enabling a reminder
    // and saving must reach the platform scheduler with real plans.
    fireEvent.press(screen.getByTestId("settings-toggle-reminder-daily-log"));
    fireEvent(
      screen.getByTestId("settings-reminder-lead-days-slider"),
      "valueChange",
      5,
    );
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          dailyLogReminderEnabled: true,
          reminderLeadDays: 5,
        }),
      ),
    );
    await waitFor(() =>
      expect(reminderScheduler.sync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "daily_log",
          }),
        ]),
      ),
    );
    expect(screen.getByTestId("settings-reminders-status-banner")).toBeTruthy();
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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
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
      // Settings probes the session again to bind the entitlement-token gate;
      // a non-session payload keeps the gate inert so snapshot features stand.
      .mockResolvedValueOnce(
        new Response(JSON.stringify({}), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
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
        section="reminders"
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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="data" storage={storage} />);

    await screen.findByTestId("settings-export-section");

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="interface" storage={storage} />);

    await screen.findByTestId("settings-interface-section");

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

  it("persists the system theme option when selected from settings", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("accept");

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="interface" storage={storage} />);

    await screen.findByTestId("settings-interface-section");

    fireEvent.press(screen.getByTestId("settings-interface-theme-system"));

    expect(
      screen.getByTestId("settings-interface-theme-system").props
        .accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));

    expect(preventRemoveCallback).toEqual(expect.any(Function));

    await act(async () => {
      preventRemoveCallback?.({ data: { action: { type: "NAVIGATE" } } });
    });

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          themeOverride: "system",
        }),
      ),
    );
  });

  it("saves pending settings before switching tabs", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("accept");

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="interface" storage={storage} />);

    await screen.findByTestId("settings-interface-section");

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

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="interface" storage={storage} />);

    await screen.findByTestId("settings-interface-section");

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

  it("confirms unsaved changes when the Android hardware back pops a section (route removal)", async () => {
    // With the route-level split, dirty state only exists on pushed section
    // screens, so the Android hardware back is a stack pop intercepted by
    // usePreventRemove — the same guard as any other route removal.
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("reject");

    render(
      <SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />,
    );

    await screen.findByTestId("settings-cycle-section");

    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      35,
    );

    expect(preventRemoveCallback).toEqual(expect.any(Function));

    await act(async () => {
      preventRemoveCallback?.({ data: { action: { type: "GO_BACK" } } });
    });

    await waitFor(() =>
      expect(mockOpenLeaveConfirmation).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      ),
    );
    await waitFor(() =>
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "GO_BACK" }),
      ),
    );
    expect(storage.writeProfileRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({
        cycleLength: 35,
      }),
    );
  });

  it("requires typed confirmation before clearing all local data", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="danger" storage={storage} />);

    await screen.findByTestId("settings-danger-zone-section");

    fireEvent.press(screen.getByTestId("settings-clear-data-button"));

    expect(screen.getByTestId("settings-danger-zone-section")).toBeTruthy();
    const confirmationInput = screen.getByTestId(
      "settings-clear-data-confirmation-input",
    );
    expect(confirmationInput).toBeTruthy();
    // The confirmation field is announced via the visible label (screen readers
    // do not auto-associate a sibling <Text> with a TextInput).
    expect(confirmationInput.props.accessibilityLabel).toBeTruthy();
    expect(
      screen.getByText(confirmationInput.props.accessibilityLabel),
    ).toBeTruthy();
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
      managedAuthSessionExpiresAt: null,
      managedRefreshToken: null,
      managedRefreshTokenExpiresAt: null,
    });

    render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        section="danger"
        storage={storage}
        syncSecretStore={syncSecretStore}
      />,
    );

    await screen.findByTestId("settings-danger-zone-section");

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

  it.each([
    [
      "unavailable",
      "Set up a device passcode or biometrics before clearing local data.",
    ],
    [
      "failed",
      "Unable to confirm device security right now. Please try again.",
    ],
  ] as const)(
    "blocks clearing local data when device security reports %s",
    async (reason, expectedMessage) => {
      const storage = createSettingsStorageMock();
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason,
      });

      render(<SettingsScreen now={new Date(2026, 2, 17)} section="danger" storage={storage} />);

      await screen.findByTestId("settings-danger-zone-section");

      fireEvent.changeText(
        screen.getByTestId("settings-clear-data-confirmation-input"),
        "CLEAR",
      );
      fireEvent.press(screen.getByTestId("settings-clear-data-button"));

      await screen.findByTestId("settings-danger-error-banner");
      expect(screen.getByText(expectedMessage)).toBeTruthy();
      expect(storage.clearAllLocalData).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    },
  );

  it("silently aborts (no error banner) when the device-auth prompt is simply cancelled", async () => {
    const storage = createSettingsStorageMock();
    mockRequestSensitiveActionChallenge.mockResolvedValue({
      ok: false,
      reason: "cancelled",
    });

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="danger" storage={storage} />);

    await screen.findByTestId("settings-danger-zone-section");

    fireEvent.changeText(
      screen.getByTestId("settings-clear-data-confirmation-input"),
      "CLEAR",
    );
    fireEvent.press(screen.getByTestId("settings-clear-data-button"));

    await waitFor(() =>
      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledTimes(1),
    );
    // A user-dismissed prompt is not an error worth alarming over — unlike
    // "unavailable"/"failed", it maps to no banner at all.
    expect(screen.queryByTestId("settings-danger-error-banner")).toBeNull();
    expect(storage.clearAllLocalData).not.toHaveBeenCalled();
  });

  it("reports a failure and stops when the storage wipe itself throws", async () => {
    const storage = createSettingsStorageMock({
      clearAllLocalData: jest.fn().mockRejectedValue(new Error("disk error")),
    });

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="danger" storage={storage} />);

    await screen.findByTestId("settings-danger-zone-section");

    fireEvent.changeText(
      screen.getByTestId("settings-clear-data-confirmation-input"),
      "CLEAR",
    );
    fireEvent.press(screen.getByTestId("settings-clear-data-button"));

    await screen.findByTestId("settings-danger-error-banner");
    expect(
      screen.getByText("Unable to clear local data right now. Please try again."),
    ).toBeTruthy();
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
        section="data"
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
        section="data"
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
        section="data"
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
        section="data"
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
        section="data"
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
        section="data"
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
        section="data"
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

  it("maps a picker rejection to the generic restore-failed message", async () => {
    const storage = createSettingsStorageMock();
    const importFilePickerClient = {
      pick: jest.fn().mockRejectedValue(new Error("boom")),
    };

    render(
      <SettingsScreen
        importFilePickerClient={importFilePickerClient}
        now={new Date(2026, 2, 17)}
        section="data"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-import-section");
    fireEvent.press(screen.getByTestId("settings-import-pick-button"));

    await screen.findByTestId("settings-import-error-banner");
    expect(screen.getByText("Restore failed. Please try again.")).toBeTruthy();
    expect(screen.queryByTestId("settings-import-preview")).toBeNull();
  });

  it("announces the whole import preview as one summary, including the nothing-new line", async () => {
    // Every day in the backup is already on this device, so the preview adds
    // its "nothing new" line. The summary of what confirm is about to apply is
    // announced as one element, so it is heard whole before the write.
    const storage = createSettingsStorageMock({
      readDayLogRecord: jest.fn().mockImplementation(async (date: string) => ({
        ...createEmptyDayLogRecord(date),
        notes: "existing entry",
      })),
    });
    const importFilePickerClient = createImportPickerMock(importEnvelopeJSON());

    render(
      <SettingsScreen
        importFilePickerClient={importFilePickerClient}
        now={new Date(2026, 2, 17)}
        section="data"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-import-section");
    fireEvent.press(screen.getByTestId("settings-import-pick-button"));

    await screen.findByTestId("settings-import-preview");
    expect(
      screen.getByText("Everything in this backup is already on this device."),
    ).toBeTruthy();
    // One element, one summary — and no doubled full stop where a line already
    // ends in one.
    expect(
      screen.getByLabelText(
        "Ready to restore. Backup created: Mar 1, 2026, 11:00 AM. " +
          "Backup range: 2026-03-01 to 2026-03-02. Entries in backup: 2. " +
          "New days to add: 0. " +
          "Days already on this device (kept unchanged): 2. " +
          "Your current settings stay unchanged. " +
          "Everything in this backup is already on this device.",
      ),
    ).toBeTruthy();
  });

  it("keeps the preview visible and reports restore-failed when applying a confirmed import throws", async () => {
    const storage = createSettingsStorageMock();
    const importFilePickerClient = createImportPickerMock(importEnvelopeJSON());
    const importBackupEnvelopeSpy = jest
      .spyOn(importService, "importBackupEnvelope")
      .mockRejectedValue(new Error("boom"));

    render(
      <SettingsScreen
        importFilePickerClient={importFilePickerClient}
        now={new Date(2026, 2, 17)}
        section="data"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-import-section");
    fireEvent.press(screen.getByTestId("settings-import-pick-button"));
    await screen.findByTestId("settings-import-preview");

    fireEvent.press(screen.getByTestId("settings-import-confirm-button"));

    await screen.findByTestId("settings-import-error-banner");
    expect(screen.getByText("Restore failed. Please try again.")).toBeTruthy();
    // Unlike a successful confirm, a thrown exception leaves the preview in
    // place (only the success path clears it) so the user can retry.
    expect(screen.getByTestId("settings-import-preview")).toBeTruthy();
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();

    importBackupEnvelopeSpy.mockRestore();
  });

  it("saves the selected age-group and usage-goal choices", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-age-group-under_40"));
    fireEvent.press(screen.getByTestId("settings-usage-goal-avoid_pregnancy"));
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          ageGroup: "under_40",
          usageGoal: "avoid_pregnancy",
        }),
      ),
    );
  });

  it("saves the auto-period-fill toggle and the period-length slider", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-toggle-auto-period-fill"));
    fireEvent(
      screen.getByTestId("settings-period-length-slider"),
      "valueChange",
      7,
    );
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({ autoPeriodFill: false, periodLength: 7 }),
      ),
    );
  });

  it("clears the last period start date", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-cycle-clear-date-button"));
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({ lastPeriodStart: null }),
      ),
    );
  });

  it("announces the native cycle date controls as buttons for screen readers", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    // Native variant (Platform.OS defaults to android in this suite): the date
    // field opener and the nested clear control must both expose a button role.
    expect(
      screen.getByTestId("settings-cycle-date-field-button").props.accessibilityRole,
    ).toBe("button");
    expect(
      screen.getByTestId("settings-cycle-clear-date-button").props.accessibilityRole,
    ).toBe("button");
  });

  it("announces the web fallback cycle date controls as buttons for screen readers", async () => {
    const storage = createSettingsStorageMock();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    // Web fallback variant renders focusable Pressables in place of a native
    // date picker; both the change-date and clear-date controls must expose a
    // button role so screen readers announce them as buttons.
    expect(
      screen.getByTestId("settings-cycle-date-field-button").props.accessibilityRole,
    ).toBe("button");
    expect(
      screen.getByTestId("settings-cycle-clear-date-button").props.accessibilityRole,
    ).toBe("button");
  });

  it("opens the native cycle date picker, ignores a dismiss, then confirms a new date", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-cycle-date-field-button"));
    await screen.findByTestId("mock-date-picker");

    await act(async () => {
      fireEvent(
        screen.getByTestId("mock-date-picker"),
        "onChange",
        { type: "dismissed" },
        undefined,
      );
    });
    expect(screen.queryByTestId("mock-date-picker")).toBeNull();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId("settings-cycle-date-field-button"));
    await act(async () => {
      fireEvent(
        screen.getByTestId("mock-date-picker"),
        "onChange",
        { type: "set" },
        new Date(2026, 2, 12),
      );
    });
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({ lastPeriodStart: "2026-03-12" }),
      ),
    );
  });

  it("cancels the web date input without changing the saved date", async () => {
    const storage = createSettingsStorageMock();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-cycle-date-field-button"));
    const dateInput = await screen.findByTestId("settings-cycle-date-input");
    fireEvent.changeText(dateInput, "20260312");
    await waitFor(() =>
      expect(screen.getByTestId("settings-cycle-date-input").props.value).toBe(
        "2026-03-12",
      ),
    );

    fireEvent.press(screen.getByTestId("settings-cycle-date-cancel-button"));

    expect(screen.queryByTestId("settings-cycle-date-input")).toBeNull();

    // Reopening shows the still-persisted original date, proving the typed
    // draft was discarded rather than carried over.
    fireEvent.press(screen.getByTestId("settings-cycle-date-field-button"));
    expect(screen.getByTestId("settings-cycle-date-input").props.value).toBe(
      "2026-03-10",
    );
  });

  it("shows an inline error for an out-of-bounds typed date instead of saving it", async () => {
    const storage = createSettingsStorageMock();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.press(screen.getByTestId("settings-cycle-date-field-button"));
    const dateInput = await screen.findByTestId("settings-cycle-date-input");
    fireEvent.changeText(dateInput, "20260401");
    await waitFor(() =>
      expect(screen.getByTestId("settings-cycle-date-input").props.value).toBe(
        "2026-04-01",
      ),
    );

    fireEvent.press(screen.getByTestId("settings-cycle-date-confirm-button"));

    await screen.findByTestId("settings-cycle-error-banner");
    expect(
      screen.getByText(
        "Please enter a valid last period start date that is not in the future.",
      ),
    ).toBeTruthy();
    // The picker stays open so the user can correct the typed value.
    expect(screen.getByTestId("settings-cycle-date-input")).toBeTruthy();
    expect(storage.writeProfileRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastPeriodStart: "2026-04-01" }),
    );
  });

  it("blocks saving and shows the incompatibility banner for an impossible cycle/period combination", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    // A 15-day cycle cannot contain a 14-day period.
    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      15,
    );
    fireEvent(
      screen.getByTestId("settings-period-length-slider"),
      "valueChange",
      14,
    );

    await screen.findByTestId("settings-cycle-error-banner");
    expect(
      screen.getByText(
        "Period duration is incompatible with cycle length. Menstruation cannot take up almost the whole cycle.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByTestId("settings-save-all-button").props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
  });

  it("shows the long-cycle informational hint without blocking the save", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    // 50 days is over the 45-day "less common" guidance threshold but still
    // comfortably compatible with the default 5-day period.
    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      50,
    );

    expect(
      screen.getByText(
        "A cycle longer than 45 days is less common; please discuss with a doctor.",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("settings-cycle-error-banner")).toBeNull();

    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({ cycleLength: 50 }),
      ),
    );
  });

  it("prepares a CSV export through the settings flow and hands it to the delivery client", async () => {
    const storage = createSettingsStorageMock();
    const exportDeliveryClient = {
      deliver: jest.fn().mockResolvedValue({ ok: true }),
    };

    render(
      <SettingsScreen
        exportDeliveryClient={exportDeliveryClient}
        now={new Date(2026, 2, 17)}
        section="data"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-export-section");

    fireEvent.press(screen.getByTestId("settings-export-csv-button"));

    await waitFor(() =>
      expect(exportDeliveryClient.deliver).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "ovumcy-export-2026-03-17.csv",
          mimeType: "text/csv",
        }),
      ),
    );
  });

  it("closes the native export date picker without changing the range when dismissed or given no value", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="data" storage={storage} />);

    await screen.findByTestId("settings-export-section");
    const originalFromValue = screen.getByTestId("settings-export-from-value")
      .props.children;

    fireEvent.press(screen.getByTestId("settings-export-from-button"));
    await act(async () => {
      fireEvent(
        screen.getByTestId("settings-export-date-picker"),
        "onChange",
        { type: "dismissed" },
        undefined,
      );
    });
    expect(screen.queryByTestId("settings-export-date-picker")).toBeNull();
    expect(
      screen.getByTestId("settings-export-from-value").props.children,
    ).toBe(originalFromValue);

    fireEvent.press(screen.getByTestId("settings-export-from-button"));
    await act(async () => {
      fireEvent(
        screen.getByTestId("settings-export-date-picker"),
        "onChange",
        { type: "set" },
        undefined,
      );
    });
    expect(screen.queryByTestId("settings-export-date-picker")).toBeNull();
    expect(
      screen.getByTestId("settings-export-from-value").props.children,
    ).toBe(originalFromValue);

    // The "to" button opens the same picker through its own independent
    // press handler (onExportToDatePress).
    const originalToValue = screen.getByTestId("settings-export-to-value")
      .props.children;
    fireEvent.press(screen.getByTestId("settings-export-to-button"));
    await act(async () => {
      fireEvent(
        screen.getByTestId("settings-export-date-picker"),
        "onChange",
        { type: "dismissed" },
        undefined,
      );
    });
    expect(screen.queryByTestId("settings-export-date-picker")).toBeNull();
    expect(
      screen.getByTestId("settings-export-to-value").props.children,
    ).toBe(originalToValue);
  });

  it("refreshes the export range when a preset is selected", async () => {
    // Recorded data spans over a year so the "30 days" preset resolves to a
    // narrower window than "All time" instead of collapsing back to it.
    const storage = createSettingsStorageMock({
      readDayLogSummary: jest.fn().mockResolvedValue({
        totalEntries: 40,
        hasData: true,
        dateFrom: "2024-01-01",
        dateTo: "2026-03-15",
      }),
    });

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="data" storage={storage} />);

    await screen.findByTestId("settings-export-section");
    expect(
      screen.getByTestId("settings-export-preset-all").props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));

    await act(async () => {
      fireEvent.press(screen.getByTestId("settings-export-preset-30"));
    });

    expect(
      screen.getByTestId("settings-export-preset-30").props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));
    expect(
      screen.getByTestId("settings-export-preset-all").props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: false }));
  });

  it("refreshes the export range from free-text input only once the typed date is complete", async () => {
    const storage = createSettingsStorageMock();
    Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="data" storage={storage} />);

    await screen.findByTestId("settings-export-section");
    // The default range (from existing data) starts fully populated.
    expect(screen.getByTestId("settings-export-from-input").props.value).toBe(
      "2026-03-10",
    );
    const readDayLogSummaryMock = storage.readDayLogSummary as jest.Mock;
    const baselineCalls = readDayLogSummaryMock.mock.calls.length;

    // A partial re-type (still mid-edit, digit-by-digit) sanitizes to fewer
    // than 10 characters — hasCompleteExportDates must hold off the refresh.
    fireEvent.changeText(
      screen.getByTestId("settings-export-from-input"),
      "202603",
    );
    expect(screen.getByTestId("settings-export-from-input").props.value).toBe(
      "2026-03",
    );
    expect(readDayLogSummaryMock.mock.calls.length).toBe(baselineCalls);

    await act(async () => {
      fireEvent.changeText(
        screen.getByTestId("settings-export-from-input"),
        "20260301",
      );
    });

    await waitFor(() =>
      expect(readDayLogSummaryMock.mock.calls.length).toBeGreaterThan(
        baselineCalls,
      ),
    );
    expect(screen.getByTestId("settings-export-from-input").props.value).toBe(
      "2026-03-01",
    );

    // The "to" field is gated by the identical hasCompleteExportDates check
    // on its own independent handler (onExportToDateChange).
    const callsAfterFrom = readDayLogSummaryMock.mock.calls.length;
    fireEvent.changeText(
      screen.getByTestId("settings-export-to-input"),
      "202603",
    );
    expect(screen.getByTestId("settings-export-to-input").props.value).toBe(
      "2026-03",
    );
    expect(readDayLogSummaryMock.mock.calls.length).toBe(callsAfterFrom);

    await act(async () => {
      fireEvent.changeText(
        screen.getByTestId("settings-export-to-input"),
        "20260317",
      );
    });

    await waitFor(() =>
      expect(readDayLogSummaryMock.mock.calls.length).toBeGreaterThan(
        callsAfterFrom,
      ),
    );
    expect(screen.getByTestId("settings-export-to-input").props.value).toBe(
      "2026-03-17",
    );
  });

  it("opens backup and sync from either premium-lock CTA (reminders email, export PDF)", async () => {
    const storage = createSettingsStorageMock();

    const remindersRender = render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        section="reminders"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-reminders-lock");

    fireEvent.press(screen.getByTestId("settings-reminders-lock"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/backup-sync"));

    remindersRender.unmount();
    mockPush.mockClear();
    render(
      <SettingsScreen now={new Date(2026, 2, 17)} section="data" storage={storage} />,
    );

    await screen.findByTestId("settings-export-pdf-lock");

    fireEvent.press(screen.getByTestId("settings-export-pdf-lock"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/backup-sync"));
  });

  it("saves the remaining tracking toggles (sex-chip visibility, cycle factors, historical phases, cervical mucus)", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="tracking" storage={storage} />);

    await screen.findByTestId("settings-tracking-section");

    fireEvent.press(screen.getByTestId("settings-toggle-hide-sex-chip"));
    fireEvent.press(screen.getByTestId("settings-toggle-hide-cycle-factors"));
    fireEvent.press(screen.getByTestId("settings-toggle-show-historical-phases"));
    fireEvent.press(screen.getByTestId("settings-toggle-track-cervical-mucus"));
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          hideSexChip: true,
          hideCycleFactors: true,
          showHistoricalPhases: true,
          trackCervicalMucus: true,
        }),
      ),
    );
  });

  it("saves the upcoming-period, fertile-window, and managed email-delivery reminder toggles", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="reminders" storage={storage} />);

    await screen.findByTestId("settings-reminders-section");

    fireEvent.press(screen.getByTestId("settings-toggle-reminder-upcoming-period"));
    fireEvent.press(screen.getByTestId("settings-toggle-reminder-fertile-window"));
    fireEvent.press(screen.getByTestId("settings-toggle-reminder-email-delivery"));
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          upcomingPeriodReminderEnabled: true,
          fertileWindowReminderEnabled: true,
          managedReminderEmailsEnabled: true,
        }),
      ),
    );
  });

  it("saves the selected interface language", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="interface" storage={storage} />);

    await screen.findByTestId("settings-interface-section");

    fireEvent.press(screen.getByTestId("settings-interface-language-de"));
    fireEvent.press(screen.getByTestId("settings-save-all-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({ languageOverride: "de" }),
      ),
    );
  });

  it("applies the selected first day of week to the interface picker", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="interface" storage={storage} />);

    await screen.findByTestId("settings-interface-section");

    // Default is Sunday (0); selecting Monday (1) runs the interface
    // first-day-of-week handler and re-selects the picker on the new value.
    fireEvent.press(screen.getByTestId("settings-interface-first-day-of-week-1"));

    expect(
      screen.getByTestId("settings-interface-first-day-of-week-1").props
        .accessibilityState,
    ).toEqual(expect.objectContaining({ checked: true }));
    expect(
      screen.getByTestId("settings-interface-first-day-of-week-0").props
        .accessibilityState,
    ).toEqual(expect.objectContaining({ checked: false }));
  });

  it("updates an existing custom symptom's label", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="symptoms" storage={storage} />);

    await screen.findByTestId("settings-symptoms-section");

    fireEvent.changeText(
      screen.getByTestId("settings-symptom-create-name-input"),
      "Jaw pain",
    );
    fireEvent.press(screen.getByTestId("settings-symptom-create-action-button"));

    await waitFor(() =>
      expect(storage.writeSymptomRecord).toHaveBeenCalledWith(
        expect.objectContaining({ label: "Jaw pain" }),
      ),
    );
    const createdRecord = (storage.writeSymptomRecord as jest.Mock).mock
      .calls[0][0];
    (storage.writeSymptomRecord as jest.Mock).mockClear();

    fireEvent.changeText(
      screen.getByTestId(`settings-symptom-${createdRecord.id}-name-input`),
      "Jaw tension",
    );
    fireEvent.press(
      screen.getByTestId(`settings-symptom-${createdRecord.id}-action-button`),
    );

    await waitFor(() =>
      expect(storage.writeSymptomRecord).toHaveBeenCalledWith(
        expect.objectContaining({ id: createdRecord.id, label: "Jaw tension" }),
      ),
    );
    expect(
      screen.getByTestId(`settings-symptom-${createdRecord.id}-status-banner`),
    ).toBeTruthy();
  });

  it("restores a previously archived custom symptom", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="symptoms" storage={storage} />);

    await screen.findByTestId("settings-symptoms-section");

    fireEvent.changeText(
      screen.getByTestId("settings-symptom-create-name-input"),
      "Jaw pain",
    );
    fireEvent.press(screen.getByTestId("settings-symptom-create-action-button"));
    await waitFor(() => expect(storage.writeSymptomRecord).toHaveBeenCalled());
    const createdRecord = (storage.writeSymptomRecord as jest.Mock).mock
      .calls[0][0];

    fireEvent.press(
      screen.getByTestId(`settings-symptom-archive-${createdRecord.id}`),
    );
    await waitFor(() =>
      expect(storage.writeSymptomRecord).toHaveBeenCalledWith(
        expect.objectContaining({ id: createdRecord.id, isArchived: true }),
      ),
    );

    fireEvent.press(
      screen.getByTestId(`settings-symptom-restore-${createdRecord.id}`),
    );

    await waitFor(() =>
      expect(storage.writeSymptomRecord).toHaveBeenCalledWith(
        expect.objectContaining({ id: createdRecord.id, isArchived: false }),
      ),
    );
  });

  it("never renders a built-in symptom as an editable/archivable row", async () => {
    // Built-ins are filtered out of both the active and archived lists by
    // settings-view-service's splitCustomSymptoms (record.isDefault is
    // skipped entirely), so there is no update/archive control to press —
    // the service-layer builtin_edit_forbidden guard this relies on is
    // covered directly in settings-screen-symptom-actions.test.ts.
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="symptoms" storage={storage} />);

    await screen.findByTestId("settings-symptoms-section");

    expect(
      screen.queryByTestId("settings-symptom-cramps-action-button"),
    ).toBeNull();
    expect(screen.queryByTestId("settings-symptom-archive-cramps")).toBeNull();
  });

  it("discards changes and stays on settings when the tab-switch guard is dismissed", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("dismiss");

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      35,
    );

    expect(tabPressCallback).toEqual(expect.any(Function));

    await act(async () => {
      tabPressCallback?.({ preventDefault: jest.fn(), target: "calendar-key" });
    });

    await waitFor(() => expect(mockOpenLeaveConfirmation).toHaveBeenCalled());
    expect(mockParentNavigate).not.toHaveBeenCalled();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
    expect(screen.getByTestId("settings-cycle-length-slider").props.value).toBe(
      35,
    );
  });

  it("discards changes when the tab-switch guard rejects saving, then switches tabs", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("reject");

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      35,
    );

    await act(async () => {
      tabPressCallback?.({ preventDefault: jest.fn(), target: "calendar-key" });
    });

    await waitFor(() =>
      expect(mockParentNavigate).toHaveBeenCalledWith("calendar", undefined),
    );
    expect(storage.writeProfileRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ cycleLength: 35 }),
    );
  });

  it("keeps changes on the section when the route-removal guard is dismissed (Android back)", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("dismiss");

    render(
      <SettingsScreen now={new Date(2026, 2, 17)} section="cycle" storage={storage} />,
    );

    await screen.findByTestId("settings-cycle-section");

    fireEvent(
      screen.getByTestId("settings-cycle-length-slider"),
      "valueChange",
      35,
    );

    expect(preventRemoveCallback).toEqual(expect.any(Function));

    await act(async () => {
      preventRemoveCallback?.({ data: { action: { type: "GO_BACK" } } });
    });

    await waitFor(() => expect(mockOpenLeaveConfirmation).toHaveBeenCalled());
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
    expect(screen.getByTestId("settings-cycle-length-slider").props.value).toBe(
      35,
    );
  });

  it("stays on the section and keeps changes when the backup-sync guard is dismissed", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("dismiss");

    render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        section="reminders"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-reminders-section");

    fireEvent.press(screen.getByTestId("settings-toggle-reminder-daily-log"));
    fireEvent.press(screen.getByTestId("settings-reminders-lock"));

    await waitFor(() => expect(mockOpenLeaveConfirmation).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
  });

  it("names every hub navigation row so a screen reader hears its destination", async () => {
    const storage = createSettingsStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} section="hub" storage={storage} />);

    await screen.findByTestId("settings-hub-open-cycle");

    for (const testID of [
      "settings-hub-open-cycle",
      "settings-hub-open-symptoms",
      "settings-hub-open-tracking",
      "settings-hub-open-reminders",
      "settings-hub-open-interface",
      "settings-hub-open-data",
      "settings-hub-open-danger",
    ]) {
      const row = screen.getByTestId(testID);
      expect(row.props.accessibilityRole).toBe("button");
      expect(row.props.accessibilityLabel).toBeTruthy();
    }

    // The hub title is the screen heading a rotor jumps to.
    expect(screen.getAllByRole("header").length).toBeGreaterThan(0);
  });

  it("names the interface choice groups so each radio says what it changes", async () => {
    const storage = createSettingsStorageMock();

    render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        section="interface"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-interface-section");

    for (const [testID, label] of [
      ["settings-interface-language-group", "Language"],
      ["settings-interface-theme-group", "Theme"],
      ["settings-interface-first-day-of-week-group", "First day of the week"],
    ] as const) {
      const group = screen.getByTestId(testID);
      expect(group.props.accessibilityRole).toBe("radiogroup");
      expect(group.props.accessibilityLabel).toBe(label);
    }
  });

  it("discards changes when the backup-sync guard rejects saving, then navigates", async () => {
    const storage = createSettingsStorageMock();
    mockOpenLeaveConfirmation.mockResolvedValue("reject");

    render(
      <SettingsScreen
        now={new Date(2026, 2, 17)}
        section="reminders"
        storage={storage}
      />,
    );

    await screen.findByTestId("settings-reminders-section");

    fireEvent.press(screen.getByTestId("settings-toggle-reminder-daily-log"));
    fireEvent.press(screen.getByTestId("settings-reminders-lock"));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/backup-sync"));
    expect(storage.writeProfileRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ dailyLogReminderEnabled: true }),
    );
  });
});
