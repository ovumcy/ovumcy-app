import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { DashboardScreen } from "./DashboardScreen";

const mockUseEffect = React.useEffect;

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
  };
});

function createStorageMock(overrides?: Partial<LocalAppStorage>): LocalAppStorage {
  return {
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    }),
    writeBootstrapState: jest.fn().mockResolvedValue(undefined),
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
    writeProfileRecord: jest.fn().mockResolvedValue(undefined),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    writeOnboardingRecord: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("DashboardScreen", () => {
  it("renders settings-driven dashboard visibility like the web contract", async () => {
    render(
      <DashboardScreen
        now={new Date(2026, 2, 17)}
        storage={createStorageMock()}
      />,
    );

    await screen.findByText("Cycle snapshot");

    expect(screen.getByText("This section is hidden in settings.")).toBeTruthy();
    expect(screen.getByText("Visible in °F.")).toBeTruthy();
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
});
