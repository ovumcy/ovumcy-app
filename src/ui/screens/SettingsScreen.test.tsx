import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { SettingsScreen } from "./SettingsScreen";

const mockUseEffect = React.useEffect;

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
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
    ...overrides,
  });
}

describe("SettingsScreen", () => {
  it("saves cycle settings through the canonical profile repository", async () => {
    const storage = createStorageMock();

    render(<SettingsScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByText("Settings");

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

    await screen.findByText("Settings");

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

    await screen.findByText("Settings");

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

    await screen.findByText("Settings");

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
});
