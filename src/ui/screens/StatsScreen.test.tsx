import * as React from "react";
import { render, screen } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { StatsScreen } from "./StatsScreen";

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
      languageOverride: "en",
      themeOverride: "light",
    }),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-01-17",
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

describe("StatsScreen", () => {
  it("renders the empty-state hero until two completed cycles exist", async () => {
    render(
      <StatsScreen
        now={new Date(2026, 2, 17)}
        storage={createStorageMock()}
      />,
    );

    await screen.findByTestId("stats-empty-hero");
    expect(screen.getByTestId("stats-empty-hero")).toBeTruthy();
  });

  it("renders stats v2 sections after local history is available", async () => {
    render(
      <StatsScreen
        now={new Date(2026, 2, 17)}
        storage={createStorageMock({
          readProfileRecord: jest.fn().mockResolvedValue({
            lastPeriodStart: "2026-01-17",
            cycleLength: 28,
            periodLength: 5,
            autoPeriodFill: true,
            irregularCycle: true,
            unpredictableCycle: false,
            ageGroup: "",
            usageGoal: "health",
            trackBBT: true,
            temperatureUnit: "c",
            trackCervicalMucus: false,
            hideSexChip: false,
            languageOverride: "en",
            themeOverride: "light",
          }),
          listDayLogRecordsInRange: jest.fn().mockResolvedValue([
            {
              ...createEmptyDayLogRecord("2026-01-17"),
              isPeriod: true,
            },
            {
              ...createEmptyDayLogRecord("2026-01-18"),
              symptomIDs: ["cramps"],
              mood: 2,
            },
            {
              ...createEmptyDayLogRecord("2026-02-14"),
              isPeriod: true,
              cycleFactorKeys: ["stress"],
            },
            {
              ...createEmptyDayLogRecord("2026-02-15"),
              symptomIDs: ["cramps"],
              mood: 4,
              cycleFactorKeys: ["travel"],
            },
            {
              ...createEmptyDayLogRecord("2026-03-14"),
              isPeriod: true,
            },
            {
              ...createEmptyDayLogRecord("2026-03-15"),
              bbt: 36.48,
              symptomIDs: ["headache"],
            },
          ]),
        })}
      />,
    );

    await screen.findByTestId("stats-trend-section");
    expect(screen.getByTestId("stats-trend-section")).toBeTruthy();
    expect(screen.getByTestId("stats-symptom-frequency")).toBeTruthy();
    expect(screen.getByTestId("stats-last-cycle-symptoms")).toBeTruthy();
    expect(screen.getByTestId("stats-phase-mood")).toBeTruthy();
    expect(screen.getByTestId("stats-bbt-trend")).toBeTruthy();
    expect(screen.getByTestId("stats-factor-context")).toBeTruthy();
  });
});
