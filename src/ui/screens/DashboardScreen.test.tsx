import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createDefaultSymptomRecords } from "../../models/symptom";
import { loadManagedPremiumFeaturesForCurrentSession } from "../../services/managed-premium-features-service";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { createVolatileWebAppStorage } from "../../storage/local/volatile-web-app-storage";
import { DashboardScreen } from "./DashboardScreen";

const mockUseEffect = React.useEffect;

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
  };
});

jest.mock("../../services/managed-premium-features-service", () => {
  return {
    loadManagedPremiumFeaturesForCurrentSession: jest.fn().mockResolvedValue({
      advancedFertility: false,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: false,
      reminders: false,
    }),
  };
});

const mockLoadManagedPremiumFeaturesForCurrentSession = jest.mocked(
  loadManagedPremiumFeaturesForCurrentSession,
);

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
  autosaveDebounceMs?: number,
) {
  return render(
    <AppPreferencesTestProvider languageOverride={languageOverride}>
      <DashboardScreen
        now={now}
        storage={storage}
        {...(autosaveDebounceMs !== undefined
          ? { autosaveDebounceMs }
          : {})}
      />
    </AppPreferencesTestProvider>,
  );
}

async function createAdvancedFertilityStorage() {
  const storage = createVolatileWebAppStorage();
  await storage.writeProfileRecord({
    lastPeriodStart: "2026-03-29",
    cycleLength: 29,
    periodLength: 5,
    autoPeriodFill: true,
    irregularCycle: false,
    unpredictableCycle: false,
    ageGroup: "",
    usageGoal: "trying_to_conceive",
    trackBBT: true,
    temperatureUnit: "c",
    trackCervicalMucus: true,
    hideSexChip: false,
    hideNotes: false,
    languageOverride: "en",
    themeOverride: "light",
    dismissedCalendarPredictionNoticeKey: null,
  });

  const records = [
    {
      date: "2026-03-29",
      isPeriod: true,
      cycleStart: true,
      isUncertain: false,
      flow: "medium" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 36.3,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
    {
      date: "2026-03-30",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 36.32,
      cervicalMucus: "eggwhite" as const,
      lhTest: "peak" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
    {
      date: "2026-03-31",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 36.34,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
    {
      date: "2026-04-01",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 36.57,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
    {
      date: "2026-04-02",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 36.6,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
    {
      date: "2026-04-03",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 36.63,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
  ];

  for (const record of records) {
    await storage.writeDayLogRecord(record);
  }

  return storage;
}

describe("DashboardScreen", () => {
  afterEach(() => {
    jest.useRealTimers();
    mockLoadManagedPremiumFeaturesForCurrentSession.mockReset();
    mockLoadManagedPremiumFeaturesForCurrentSession.mockResolvedValue({
      advancedFertility: false,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: false,
      reminders: false,
    });
  });

  it(
    "renders settings-driven dashboard visibility like the web contract",
    async () => {
      renderDashboard(createStorageMock());

      await screen.findByTestId("day-log-period-toggle");

      expect(screen.queryByTestId("day-log-sex-none")).toBeNull();
      expect(screen.queryByText("Intimacy")).toBeNull();
      expect(screen.getByTestId("day-log-bbt-input")).toBeTruthy();
      expect(screen.getByTestId("day-log-cervical-none")).toBeTruthy();
      expect(screen.getByTestId("day-log-notes-toggle")).toBeTruthy();
      expect(screen.getByTestId("day-log-notes-toggle").props.accessibilityRole).toBe(
        "button",
      );
      expect(
        screen.getByTestId("day-log-notes-toggle").props.accessibilityState,
      ).toEqual(expect.objectContaining({ expanded: false }));
      expect(screen.getByTestId("dashboard-cycle-hero")).toBeTruthy();
      expect(
        screen.getByLabelText("Day 8. Follicular. Cycle 28 days. Next period: Apr 7"),
      ).toBeTruthy();
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

  it("hides notes from the daily editor when the privacy toggle is enabled", async () => {
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
          hideNotes: true,
          languageOverride: "en",
          themeOverride: "light",
        }),
      }),
    );

    await screen.findByTestId("day-log-period-toggle");

    expect(screen.queryByTestId("day-log-notes-toggle")).toBeNull();
    expect(screen.queryByTestId("day-log-notes-input")).toBeNull();
  });

  it("shows LH test controls when the managed advanced fertility entitlement is active", async () => {
    mockLoadManagedPremiumFeaturesForCurrentSession.mockResolvedValue({
      advancedFertility: true,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: false,
      reminders: false,
    });

    renderDashboard(createStorageMock());

    await screen.findByTestId("day-log-period-toggle");

    expect(screen.getByTestId("day-log-lh-none")).toBeTruthy();
    expect(screen.getByTestId("day-log-lh-peak")).toBeTruthy();
  });

  it("shows a premium advanced fertility summary when aligned current-cycle signals exist", async () => {
    mockLoadManagedPremiumFeaturesForCurrentSession.mockResolvedValue({
      advancedFertility: true,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: false,
      reminders: false,
    });

    const storage = await createAdvancedFertilityStorage();

    renderDashboard(storage, new Date(2026, 3, 3));

    await screen.findByTestId("dashboard-advanced-fertility-summary");

    expect(screen.getByTestId("dashboard-advanced-fertility-summary-title").props.children).toBe(
      "Advanced fertility",
    );
    expect(screen.getByTestId("dashboard-advanced-fertility-summary-label").props.children).toBe(
      "Ovulation confirmation",
    );
    expect(screen.getByTestId("dashboard-advanced-fertility-summary-value").props.children).toBe(
      "Signals aligned",
    );
    expect(screen.getByTestId("dashboard-advanced-fertility-summary-hint").props.children).toBe(
      "This usually means ovulation likely happened recently and the fertile window may be closing.",
    );
  });

  it("keeps the advanced fertility summary locked without the premium entitlement", async () => {
    const storage = await createAdvancedFertilityStorage();

    renderDashboard(storage, new Date(2026, 3, 3));

    await screen.findByTestId("day-log-period-toggle");

    expect(screen.queryByTestId("dashboard-advanced-fertility-summary")).toBeNull();
  });

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

    await screen.findByTestId("day-log-period-toggle");
    expect(screen.getByTestId("day-log-more-symptoms-button")).toBeTruthy();
    expect(
      screen.getByTestId("day-log-more-symptoms-button").props.accessibilityRole,
    ).toBe("button");
    expect(
      screen.getByTestId("day-log-more-symptoms-button").props.accessibilityState,
    ).toEqual(expect.objectContaining({ expanded: false }));

    fireEvent.press(screen.getByTestId("day-log-more-symptoms-button"));

    expect(screen.getByText("Jaw pain")).toBeTruthy();
    expect(
      screen.getByTestId("day-log-more-symptoms-button").props.accessibilityState,
    ).toEqual(expect.objectContaining({ expanded: true }));
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

  it("auto-fills the next period days after autosaving a newly marked first day", async () => {
    const storage = createVolatileWebAppStorage();
    await storage.writeProfileRecord({
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
      dismissedCalendarPredictionNoticeKey: null,
    });

    renderDashboard(storage, new Date(2026, 2, 17), "en", 1);

    await screen.findByTestId("day-log-period-toggle");

    fireEvent.press(screen.getByTestId("dashboard-quick-action-period"));

    await waitFor(() =>
      expect(screen.getByTestId("day-log-status-banner")).toBeTruthy(),
    );
    expect(await storage.readDayLogRecord("2026-03-18")).toEqual(
      expect.objectContaining({
        date: "2026-03-18",
        isPeriod: true,
      }),
    );
  });

  it("autosaves day-log edits after the debounce window", async () => {
    const storage = createVolatileWebAppStorage();
    await storage.writeProfileRecord({
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
      dismissedCalendarPredictionNoticeKey: null,
    });

    renderDashboard(storage, new Date(2026, 2, 17), "en", 1);

    await screen.findByTestId("day-log-period-toggle");
    fireEvent.press(screen.getByTestId("dashboard-quick-action-period"));
    expect(screen.queryByTestId("day-log-save-button")).toBeNull();

    await waitFor(() =>
      expect(screen.getByTestId("day-log-status-banner")).toBeTruthy(),
    );
    expect(await storage.readDayLogRecord("2026-03-17")).toEqual(
      expect.objectContaining({
        date: "2026-03-17",
        isPeriod: true,
      }),
    );
  });

  it("flushes pending day-log edits when leaving the screen before debounce ends", async () => {
    const storage = createVolatileWebAppStorage();
    await storage.writeProfileRecord({
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
      dismissedCalendarPredictionNoticeKey: null,
    });

    const view = renderDashboard(storage, new Date(2026, 2, 17), "en", 1000);

    await screen.findByTestId("day-log-period-toggle");
    fireEvent.press(screen.getByTestId("dashboard-quick-action-period"));

    view.unmount();

    await waitFor(async () =>
      expect(await storage.readDayLogRecord("2026-03-17")).toEqual(
        expect.objectContaining({
          date: "2026-03-17",
          isPeriod: true,
        }),
      ),
    );
  });
});
