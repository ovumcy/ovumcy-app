import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createDefaultSymptomRecords } from "../../models/symptom";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { DashboardScreen } from "./DashboardScreen";

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
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: true,
      hideSexChip: true,
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
    ...overrides,
  });
}

describe("DashboardScreen", () => {
  it("renders settings-driven dashboard visibility like the web contract", async () => {
    render(
      <DashboardScreen
        now={new Date(2026, 2, 17)}
        storage={createStorageMock()}
      />,
    );

    await screen.findByTestId("day-log-save-button");

    expect(screen.queryByTestId("day-log-sex-none")).toBeNull();
    expect(screen.getByTestId("day-log-bbt-input")).toBeTruthy();
    expect(screen.getByTestId("day-log-cervical-none")).toBeTruthy();
  });

  it("switches to facts-only copy when unpredictable mode is enabled", async () => {
    render(
      <DashboardScreen
        now={new Date(2026, 2, 17)}
        storage={createStorageMock({
          readProfileRecord: jest.fn().mockResolvedValue({
            lastPeriodStart: "2026-03-10",
            cycleLength: 28,
            periodLength: 5,
            autoPeriodFill: true,
            irregularCycle: false,
            unpredictableCycle: true,
            ageGroup: "",
            usageGoal: "health",
            trackBBT: false,
            temperatureUnit: "c",
            trackCervicalMucus: false,
            hideSexChip: false,
            languageOverride: "en",
            themeOverride: "light",
          }),
        })}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-prediction-explanation")).toBeTruthy(),
    );
  });

  it("renders custom symptom options from the shared symptom catalog", async () => {
    render(
      <DashboardScreen
        now={new Date(2026, 2, 17)}
        storage={createStorageMock({
          listSymptomRecords: jest.fn().mockResolvedValue([
            ...createDefaultSymptomRecords(),
            {
              id: "custom_jaw_pain",
              slug: "jaw-pain",
              label: "Jaw pain",
              icon: "🔥",
              color: "#E8799F",
              isArchived: false,
              sortOrder: 999,
              isDefault: false,
            },
          ]),
        })}
      />,
    );

    await screen.findByTestId("day-log-save-button");
    expect(screen.getByText("Jaw pain")).toBeTruthy();
  });

  it("shows quick actions and reveals flow controls when period is toggled from the shortcut", async () => {
    render(
      <DashboardScreen
        now={new Date(2026, 2, 17)}
        storage={createStorageMock()}
      />,
    );

    await screen.findByTestId("dashboard-quick-action-period");
    expect(screen.getByTestId("dashboard-manual-cycle-start-button")).toBeTruthy();
    expect(screen.queryByTestId("day-log-flow-none")).toBeNull();

    fireEvent.press(screen.getByTestId("dashboard-quick-action-period"));

    expect(screen.getByTestId("day-log-flow-none")).toBeTruthy();
  });
});
