import * as React from "react";
import { render, screen } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { StatsScreen } from "./StatsScreen";

const mockUseEffect = React.useEffect;

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
  };
});

function createStorageMock(
  overrides?: Partial<LocalAppStorage>,
): LocalAppStorage {
  return {
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    }),
    writeBootstrapState: jest.fn().mockResolvedValue(undefined),
    readProfileRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-01-17",
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
    writeProfileRecord: jest.fn().mockResolvedValue(undefined),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-01-17",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    writeOnboardingRecord: jest.fn().mockResolvedValue(undefined),
    readDayLogRecord: jest
      .fn()
      .mockImplementation(async (date: string) => createEmptyDayLogRecord(date)),
    writeDayLogRecord: jest.fn().mockResolvedValue(undefined),
    deleteDayLogRecord: jest.fn().mockResolvedValue(undefined),
    listDayLogRecordsInRange: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("StatsScreen", () => {
  it("renders the empty-state hero until two completed cycles exist", async () => {
    render(
      <StatsScreen
        now={new Date(2026, 2, 17)}
        storage={createStorageMock()}
      />,
    );

    await screen.findByText("Keep logging to unlock insights");
    expect(screen.getByTestId("stats-empty-hero")).toBeTruthy();
  });

  it("renders stats cards and factor context from local history", async () => {
    render(
      <StatsScreen
        now={new Date(2026, 2, 17)}
        storage={createStorageMock({
          readProfileRecord: jest.fn().mockResolvedValue({
            lastPeriodStart: "2025-12-10",
            cycleLength: 28,
            periodLength: 5,
            autoPeriodFill: true,
            irregularCycle: true,
            unpredictableCycle: false,
            ageGroup: "",
            usageGoal: "health",
            trackBBT: false,
            temperatureUnit: "c",
            trackCervicalMucus: false,
            hideSexChip: false,
          }),
          listDayLogRecordsInRange: jest.fn().mockResolvedValue([
            {
              ...createEmptyDayLogRecord("2026-01-08"),
              isPeriod: true,
              cycleFactorKeys: ["stress"],
            },
            {
              ...createEmptyDayLogRecord("2026-02-12"),
              isPeriod: true,
              cycleFactorKeys: ["stress", "travel"],
            },
            {
              ...createEmptyDayLogRecord("2026-03-14"),
              isPeriod: true,
              cycleFactorKeys: ["travel"],
            },
            {
              ...createEmptyDayLogRecord("2026-03-16"),
              cycleFactorKeys: ["travel"],
            },
          ]),
        })}
      />,
    );

    await screen.findByText("Prediction reliability");
    expect(screen.getByText("Variable pattern")).toBeTruthy();
    expect(screen.getByText("Recent cycle factors")).toBeTruthy();
  });
});
