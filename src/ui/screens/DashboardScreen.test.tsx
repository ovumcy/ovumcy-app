import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createDefaultSymptomRecords } from "../../models/symptom";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
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

function renderDashboard(
  storage: ReturnType<typeof createStorageMock>,
  now = new Date(2026, 2, 17),
  languageOverride: "en" | "ru" = "en",
) {
  return render(
    <AppPreferencesTestProvider languageOverride={languageOverride}>
      <DashboardScreen now={now} storage={storage} />
    </AppPreferencesTestProvider>,
  );
}

describe("DashboardScreen", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it(
    "renders settings-driven dashboard visibility like the web contract",
    async () => {
      renderDashboard(createStorageMock());

      await screen.findByTestId("day-log-save-button");

      expect(screen.queryByTestId("day-log-sex-none")).toBeNull();
      expect(screen.queryByText("Intimacy")).toBeNull();
      expect(screen.getByTestId("day-log-bbt-input")).toBeTruthy();
      expect(screen.getByTestId("day-log-cervical-none")).toBeTruthy();
      expect(screen.getByTestId("dashboard-cycle-hero")).toBeTruthy();
      expect(screen.getByTestId("dashboard-cycle-hero-title").props.children).toBe("Day");
      expect(screen.getByTestId("dashboard-cycle-hero-value").props.children).toBe(
        "8",
      );
      expect(screen.getByTestId("dashboard-cycle-hero-phase-card-period")).toBeTruthy();
      expect(screen.getByTestId("dashboard-cycle-hero-phase-card-follicular")).toBeTruthy();
      expect(screen.getByTestId("dashboard-cycle-hero-phase-card-ovulation")).toBeTruthy();
      expect(screen.getByTestId("dashboard-cycle-hero-phase-card-luteal")).toBeTruthy();
    },
    10000,
  );

  it("switches to facts-only copy when unpredictable mode is enabled", async () => {
    renderDashboard(
      createStorageMock({
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
      }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-prediction-explanation")).toBeTruthy(),
    );
    expect(screen.getByTestId("dashboard-cycle-hero-title").props.children).toBe(
      "Day",
    );
    expect(screen.getByTestId("dashboard-cycle-hero-detail").props.children).toBe(
      "Predictions off",
    );
  });

  it("renders custom symptom options from the shared symptom catalog", async () => {
    renderDashboard(
      createStorageMock({
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
      }),
    );

    await screen.findByTestId("day-log-save-button");
    expect(screen.getByTestId("day-log-more-symptoms-button")).toBeTruthy();

    fireEvent.press(screen.getByTestId("day-log-more-symptoms-button"));

    expect(screen.getByText("Jaw pain")).toBeTruthy();
  });

  it("shows localized builtin symptom labels in the daily log", async () => {
    renderDashboard(
      createStorageMock({
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
          languageOverride: "ru",
          themeOverride: "light",
        }),
        readDayLogRecord: jest.fn().mockResolvedValue({
          date: "2026-03-17",
          isPeriod: false,
          cycleStart: false,
          isUncertain: false,
          flow: "none",
          mood: 0,
          sexActivity: "none",
          bbt: 0,
          cervicalMucus: "none",
          cycleFactorKeys: [],
          symptomIDs: ["cramps"],
          notes: "",
        }),
      }),
      new Date(2026, 2, 17),
      "ru",
    );

    expect(await screen.findByText("Спазмы")).toBeTruthy();
    expect(screen.getByTestId("dashboard-cycle-hero-title").props.children).toBe(
      "День",
    );
  });

  it("shows quick actions and reveals flow controls when period is toggled from the shortcut", async () => {
    renderDashboard(createStorageMock());

    await screen.findByTestId("dashboard-quick-action-period");
    expect(screen.getByTestId("dashboard-quick-actions-title")).toBeTruthy();
    expect(screen.getByTestId("dashboard-manual-cycle-start-button")).toBeTruthy();
    expect(screen.queryByTestId("day-log-flow-none")).toBeNull();

    fireEvent.press(screen.getByTestId("dashboard-quick-action-period"));

    expect(screen.getByTestId("day-log-flow-none")).toBeTruthy();
  });

  it("clears temporary quick action highlight state after the timeout window", async () => {
    renderDashboard(createStorageMock());

    await screen.findByTestId("dashboard-quick-action-mood");
    jest.useFakeTimers();

    const moodAction = screen.getByTestId("dashboard-quick-action-mood");

    fireEvent.press(moodAction);

    expect(screen.getByTestId("dashboard-quick-action-mood").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(screen.getByTestId("dashboard-quick-action-mood").props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("clears an unsaved dashboard draft back to the empty day state", async () => {
    renderDashboard(createStorageMock());

    await screen.findByTestId("dashboard-quick-action-period");

    fireEvent.press(screen.getByTestId("dashboard-quick-action-period"));

    await waitFor(() =>
      expect(screen.getByTestId("day-log-delete-button")).toBeTruthy(),
    );
    expect(screen.getByTestId("day-log-period-toggle").props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );

    fireEvent.press(screen.getByTestId("day-log-delete-button"));

    await waitFor(() =>
      expect(screen.getByTestId("day-log-period-toggle").props.accessibilityState).toEqual(
        expect.objectContaining({ checked: false }),
      ),
    );
    expect(screen.queryByTestId("day-log-flow-none")).toBeNull();
  });
});
