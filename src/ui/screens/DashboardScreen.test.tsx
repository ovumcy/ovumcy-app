import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultSymptomRecords } from "../../models/symptom";
import { loadManagedPremiumFeaturesForCurrentSession } from "../../services/managed-premium-features-service";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { createVolatileWebAppStorage } from "../../storage/local/volatile-web-app-storage";
import { openConfirmation } from "../confirm/open-confirmation";
import { DashboardScreen } from "./DashboardScreen";

const mockUseEffect = React.useEffect;

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
  };
});

jest.mock("../confirm/open-confirmation", () => {
  return {
    openConfirmation: jest.fn(),
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

const mockOpenConfirmation = jest.mocked(openConfirmation);
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
      pregnancyTest: "none" as const,
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
      bbt: 36.31,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      pregnancyTest: "none" as const,
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
      bbt: 36.29,
      cervicalMucus: "eggwhite" as const,
      lhTest: "peak" as const,
      pregnancyTest: "none" as const,
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
      bbt: 36.3,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      pregnancyTest: "none" as const,
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
      bbt: 36.3,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      pregnancyTest: "none" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
    {
      // Sixth flat coverline day: the "3-over-6" detector needs a full 6-day
      // window before the elevated streak.
      date: "2026-04-03",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 36.3,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      pregnancyTest: "none" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
    {
      date: "2026-04-04",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 36.55,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      pregnancyTest: "none" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
    {
      date: "2026-04-05",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 36.56,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      pregnancyTest: "none" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
    {
      date: "2026-04-06",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 36.57,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      pregnancyTest: "none" as const,
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
  beforeEach(() => {
    mockOpenConfirmation.mockReset();
    mockOpenConfirmation.mockResolvedValue(true);
  });

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
      expect(screen.getByTestId("day-log-notes-input")).toBeTruthy();
      expect(screen.getByTestId("day-log-notes-input").props.placeholder).toBe(
        "Anything you want to remember about today.",
      );
      expect(screen.getByTestId("dashboard-cycle-hero")).toBeTruthy();
      expect(
        screen.getByLabelText(
          "Day 8. Follicular. Cycle 28 days. Next period: Apr 7. Ovulation: Mar 23",
        ),
      ).toBeTruthy();
      expect(
        screen.getByTestId("dashboard-cycle-hero-upcoming-ovulation").props.children,
      ).toBe("Ovulation: Mar 23");
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

  it("renders the persistent not-medical-advice prediction disclaimer (web parity)", async () => {
    renderDashboard(createStorageMock());

    const disclaimer = await screen.findByTestId(
      "dashboard-prediction-disclaimer",
    );
    expect(disclaimer.props.children).toBe(
      "These are estimates, not medical advice or a method of contraception.",
    );
  });

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

    renderDashboard(storage, new Date(2026, 3, 6));

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

    // The whole insight card is one composed accessibility label (title,
    // signal, value, detail, hint) so a screen reader announces it as a
    // single phrase instead of five separate stops.
    const detailText = screen.getByTestId(
      "dashboard-advanced-fertility-summary-detail",
    ).props.children;
    expect(
      screen.getByTestId("dashboard-advanced-fertility-summary").props
        .accessibilityLabel,
    ).toBe(
      [
        "Advanced fertility",
        "Ovulation confirmation",
        "Signals aligned",
        detailText,
        "This usually means ovulation likely happened recently and the fertile window may be closing.",
      ].join(". "),
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
    // Medical-safety invariant: unpredictable (facts-only) mode never
    // resurrects an upcoming-ovulation prediction on the dashboard hero.
    expect(
      screen.queryByTestId("dashboard-cycle-hero-upcoming-ovulation"),
    ).toBeNull();
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

  it("shows a success status after marking a manual cycle start", async () => {
    const storage = createStorageMock();

    renderDashboard(storage);

    await screen.findByTestId("dashboard-manual-cycle-start-button");
    fireEvent.press(screen.getByTestId("dashboard-manual-cycle-start-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({ lastPeriodStart: "2026-03-17" }),
      ),
    );
    expect(
      await screen.findByText("Cycle start updated locally."),
    ).toBeTruthy();
  });

  it("cancels a manual cycle start when the owner declines the confirmation prompt", async () => {
    const storage = createStorageMock();

    renderDashboard(storage);

    await screen.findByTestId("dashboard-manual-cycle-start-button");
    mockOpenConfirmation.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId("dashboard-manual-cycle-start-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(1));
    expect(storage.writeProfileRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastPeriodStart: "2026-03-17" }),
    );
  });

  it("shows an error status when marking a manual cycle start fails to persist", async () => {
    const storage = createStorageMock();
    storage.writeProfileRecord = jest.fn().mockRejectedValue(new Error("boom"));

    renderDashboard(storage);

    await screen.findByTestId("dashboard-manual-cycle-start-button");
    fireEvent.press(screen.getByTestId("dashboard-manual-cycle-start-button"));

    expect(
      await screen.findByText(
        "Unable to mark a new cycle start. Please try again.",
      ),
    ).toBeTruthy();
  });

  it("cancels deleting a persisted entry when the owner declines the confirmation prompt", async () => {
    const persistedToday = {
      ...createEmptyDayLogRecord("2026-03-17"),
      mood: 4,
      notes: "Existing note",
    };
    const storage = createStorageMock({
      readDayLogRecord: jest.fn().mockResolvedValue(persistedToday),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([persistedToday]),
    });

    renderDashboard(storage);

    await screen.findByTestId("day-log-delete-button");
    mockOpenConfirmation.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId("day-log-delete-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(1));
    expect(storage.deleteDayLogRecord).not.toHaveBeenCalled();
    // A dismissed confirmation is never the destructive answer — the entry
    // (and its delete action) is still there.
    expect(screen.getByTestId("day-log-delete-button")).toBeTruthy();
  });

  it("shows an error status when deleting a persisted entry fails to persist", async () => {
    const persistedToday = {
      ...createEmptyDayLogRecord("2026-03-17"),
      mood: 4,
      notes: "Existing note",
    };
    const storage = createStorageMock({
      readDayLogRecord: jest.fn().mockResolvedValue(persistedToday),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([persistedToday]),
      deleteDayLogRecord: jest.fn().mockRejectedValue(new Error("boom")),
    });

    renderDashboard(storage);

    await screen.findByTestId("day-log-delete-button");
    fireEvent.press(screen.getByTestId("day-log-delete-button"));

    expect(
      await screen.findByText("Unable to clear this entry. Please try again."),
    ).toBeTruthy();
  });

  it("shows the pregnancy-pause hint and suppresses the upcoming-ovulation prediction, without blocking logging", async () => {
    const storage = createStorageMock({
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        {
          ...createEmptyDayLogRecord("2026-03-11"),
          pregnancyTest: "positive",
        },
      ]),
    });

    renderDashboard(storage);

    await waitFor(() =>
      expect(screen.getByTestId("dashboard-prediction-explanation")).toBeTruthy(),
    );
    expect(
      screen.getByTestId("dashboard-prediction-explanation").props.children,
    ).toBe(
      "Cycle predictions are paused after a positive pregnancy test. Log a new period to resume them.",
    );
    // Medical-safety invariant: a pregnancy pause never resurrects an
    // upcoming-ovulation prediction on the dashboard hero.
    expect(
      screen.queryByTestId("dashboard-cycle-hero-upcoming-ovulation"),
    ).toBeNull();

    // The pause never blocks logging today's entry.
    fireEvent.press(screen.getByTestId("dashboard-quick-action-period"));
    expect(screen.getByTestId("day-log-flow-none")).toBeTruthy();
  });

  it("shows the stale cycle-data state with no phase ring once the predicted cycle is long overdue", async () => {
    const storage = createStorageMock({
      readProfileRecord: jest.fn().mockResolvedValue({
        lastPeriodStart: "2026-01-01",
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
    });

    // 2026-03-15 is 73 raw days past the 2026-01-01 anchor — well past the
    // 28-day cycle length with no new period logged, so the projection
    // reports stale cycle data.
    renderDashboard(storage, new Date(2026, 2, 15));

    await screen.findByTestId("day-log-period-toggle");

    expect(screen.getByTestId("dashboard-cycle-hero-detail").props.children).toBe(
      "Cycle data may be outdated. Log your period when it starts.",
    );
    // An overdue prediction degrades to an explicit "may be outdated" status
    // rather than a falsely precise phase ring.
    expect(screen.queryByTestId("dashboard-cycle-hero-phase-grid")).toBeNull();
    expect(
      screen.queryByTestId("dashboard-cycle-hero-phase-card-period"),
    ).toBeNull();
  });

  it("announces the day-logging surface: headers, named quick actions, and grouped phase cards", async () => {
    const storage = createStorageMock();

    renderDashboard(storage);

    await screen.findByTestId("day-log-period-toggle");

    // Section headings a rotor can jump between.
    expect(
      screen.getByTestId("dashboard-quick-actions-title").props
        .accessibilityRole,
    ).toBe("header");

    // Quick actions are icon+word buttons: the announcement is the word, and
    // the period action reports whether today is already marked.
    const periodAction = screen.getByTestId("dashboard-quick-action-period");
    expect(periodAction.props.accessibilityRole).toBe("button");
    expect(periodAction.props.accessibilityLabel).toBeTruthy();
    expect(periodAction.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );

    // Day-log fields: each option group states which question it answers.
    expect(
      screen.getByTestId("day-log-symptom-group").props.accessibilityLabel,
    ).toBeTruthy();
    expect(
      screen.getByTestId("day-log-mood-group").props.accessibilityRole,
    ).toBe("radiogroup");

    // The cycle-hero phase cards are one fact each (phase plus day range).
    const phaseCard = screen.getByTestId(
      "dashboard-cycle-hero-phase-card-period",
    );
    expect(phaseCard.props.accessibilityLabel).toMatch(/\. /);
    expect(phaseCard.props.accessible).toBe(true);
  });
});
