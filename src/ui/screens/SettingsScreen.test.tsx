import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { SettingsScreen } from "./SettingsScreen";

const mockUseEffect = React.useEffect;
const mockReplace = jest.fn();

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

  it("renders the app-equivalent interface, account, export, and danger sections", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    expect(screen.getByTestId("settings-cycle-section")).toBeTruthy();
    expect(screen.getByTestId("settings-symptoms-section")).toBeTruthy();
    expect(screen.getByTestId("settings-tracking-section")).toBeTruthy();
    expect(screen.getByTestId("settings-interface-section")).toBeTruthy();
    expect(screen.getByTestId("settings-account-section")).toBeTruthy();
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

  it("clears local data and returns to onboarding after confirmation", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("settings-cycle-section");

    fireEvent.changeText(
      screen.getByTestId("settings-clear-data-confirmation-input"),
      "CLEAR",
    );
    fireEvent.press(screen.getByTestId("settings-clear-data-button"));

    await waitFor(() => expect(storage.clearAllLocalData).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding"));
  });
});
