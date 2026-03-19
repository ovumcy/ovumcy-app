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

    expect(screen.getByText("This section is hidden in settings.")).toBeTruthy();
    expect(
      screen.getByText("Enter a basal body temperature reading for today. °F."),
    ).toBeTruthy();
    expect(screen.getByText("Cervical mucus")).toBeTruthy();
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
          }),
        })}
      />,
    );

    await waitFor(() => expect(screen.getByText("Predictions off")).toBeTruthy());
    expect(
      screen.getByText(
        "Predictions are off in unpredictable cycle mode. Ovumcy shows recorded facts only.",
      ),
    ).toBeTruthy();
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
    expect(screen.queryByText("Flow")).toBeNull();

    fireEvent.press(screen.getByTestId("dashboard-quick-action-period"));

    expect(screen.getByText("Flow")).toBeTruthy();
  });
});
