import * as React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { getBabyWeekCopy } from "../../i18n/baby-week-copy";
import { getPregnancyCopy } from "../../i18n/pregnancy-copy";
import { getPostpartumCopy } from "../../i18n/postpartum-copy";
import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultSymptomRecords } from "../../models/symptom";
import { createDefaultProfileRecord } from "../../models/profile";
import { createPregnancyRecord } from "../../models/pregnancy";
import { createScreeningResponse } from "../../models/screening";
import {
  createPostpartumRecord,
  type PostpartumRecord,
} from "../../models/postpartum";
import {
  loadManagedPremiumFeaturesForCurrentSession,
} from "../../services/managed-premium-features-service";
import { loadPregnancyModuleOwned } from "../../services/pregnancy-entitlement-service";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { createVolatileWebAppStorage } from "../../storage/local/volatile-web-app-storage";
import { addDays, parseLocalDate } from "../../services/profile-settings-policy";
import { openConfirmation } from "../confirm/open-confirmation";
import { DashboardScreen } from "./DashboardScreen";

const mockUseEffect = React.useEffect;
const mockPush = jest.fn();

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
    useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  };
});

// The cycle-return offer drives its accept flow through a real
// confirm dialog (openConfirmation). Every other flow in this file relies on
// the "no registered listener -> dismiss" fallback (see
// confirmation-bridge.ts), which an unconfigured `jest.fn()` reproduces
// identically (returns undefined, awaited as falsy) -- so mocking the module
// here is safe for the rest of the suite.
jest.mock("../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
}));

const mockOpenConfirmation = jest.mocked(openConfirmation);

jest.mock("../../services/managed-premium-features-service", () => {
  const actual = jest.requireActual(
    "../../services/managed-premium-features-service",
  );
  return {
    ...actual,
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

jest.mock("../../services/pregnancy-entitlement-service", () => ({
  ...jest.requireActual("../../services/pregnancy-entitlement-service"),
  loadPregnancyModuleOwned: jest.fn().mockResolvedValue(false),
}));
const mockLoadPregnancyModuleOwned = jest.mocked(loadPregnancyModuleOwned);

const PREGNANCY_EDD = "2026-10-08";

function pregnancyNowForGaDays(gaDays: number): Date {
  return addDays(parseLocalDate(PREGNANCY_EDD)!, gaDays - 280);
}

function positiveTestRecords(date: string) {
  return [
    {
      date,
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none" as const,
      mood: 0,
      sexActivity: "none" as const,
      bbt: 0,
      cervicalMucus: "none" as const,
      lhTest: "none" as const,
      pregnancyTest: "positive" as const,
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    },
  ];
}

// A logged, explicit cycle-start day (cycle-return offer tests).
// Mirrors positiveTestRecords' full-field shape.
function periodStartDayLogRecord(date: string) {
  return {
    date,
    isPeriod: true,
    cycleStart: true,
    isUncertain: false,
    flow: "medium" as const,
    mood: 0,
    sexActivity: "none" as const,
    bbt: 0,
    cervicalMucus: "none" as const,
    lhTest: "none" as const,
    pregnancyTest: "none" as const,
    cycleFactorKeys: [],
    symptomIDs: [],
    notes: "",
  };
}

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
    mockPush.mockReset();
    mockLoadManagedPremiumFeaturesForCurrentSession.mockReset();
    mockLoadManagedPremiumFeaturesForCurrentSession.mockResolvedValue({
      advancedFertility: false,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: false,
      reminders: false,
    });
    mockLoadPregnancyModuleOwned.mockReset();
    mockLoadPregnancyModuleOwned.mockResolvedValue(false);
    mockOpenConfirmation.mockReset();
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

  it("renders the locked pregnancy entry card as information only, with no subscription route", async () => {
    mockLoadPregnancyModuleOwned.mockResolvedValue(false);
    renderDashboard(
      createStorageMock({
        listDayLogRecordsInRange: jest
          .fn()
          .mockResolvedValue(positiveTestRecords("2026-06-01")),
      }),
      new Date(2026, 5, 1),
    );

    const lock = await screen.findByTestId("dashboard-pregnancy-entry-card-title");
    expect(lock.props.children).toBe(getPregnancyCopy("en").entryCard.lockedTitle);
    expect(
      screen.getByTestId("dashboard-pregnancy-entry-card-description").props
        .children,
    ).toBe(getPregnancyCopy("en").entryCard.lockedBody);

    // The module is a one-time on-device unlock, so the card names it and
    // stops there: no call-to-action, nothing to press, and no navigation to
    // the cloud-subscription surface.
    expect(
      screen.queryByTestId("dashboard-pregnancy-entry-card-cta"),
    ).toBeNull();
    expect(
      screen.getByTestId("dashboard-pregnancy-entry-card").props
        .accessibilityRole,
    ).toBeUndefined();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates to pregnancy setup from the unlocked entry card", async () => {
    mockLoadPregnancyModuleOwned.mockResolvedValue(true);
    renderDashboard(
      createStorageMock({
        listDayLogRecordsInRange: jest
          .fn()
          .mockResolvedValue(positiveTestRecords("2026-06-01")),
      }),
      new Date(2026, 5, 1),
    );

    const cta = await screen.findByTestId("dashboard-pregnancy-entry-card-cta");
    expect(cta).toBeTruthy();

    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith("/pregnancy-start");
  });

  it("renders the pregnancy dashboard hero and disclaimer, suppressing the cycle hero", async () => {
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: PREGNANCY_EDD,
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      }),
      pregnancyNowForGaDays(171),
    );

    await screen.findByTestId("dashboard-pregnancy-mode");
    expect(screen.getByTestId("dashboard-pregnancy-week-value").props.children).toBe(
      "24+3",
    );
    expect(screen.getByTestId("dashboard-pregnancy-disclaimer")).toBeTruthy();
    // Cycle-oriented sections are suppressed via view-data in pregnancy mode.
    expect(screen.queryByTestId("dashboard-cycle-hero")).toBeNull();
    expect(screen.queryByTestId("day-log-period-toggle")).toBeNull();
  });

  describe("baby this week", () => {
    it("renders the card directly below the hero with the current week's size and development content", async () => {
      renderDashboard(
        createStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(
            createPregnancyRecord({
              edd: PREGNANCY_EDD,
              eddBasis: "lmp",
              lmpDate: "2026-01-01",
              startedAt: "2026-03-01",
            }),
          ),
        }),
        // Same fixture as the hero test above: gaDays 171 -> 24+3 -> week 24.
        pregnancyNowForGaDays(171),
      );

      await screen.findByTestId("dashboard-pregnancy-mode");
      const babyWeekCopy = getBabyWeekCopy("en");
      expect(screen.getByTestId("dashboard-pregnancy-baby-week")).toBeTruthy();
      expect(
        screen.getByTestId("dashboard-pregnancy-baby-week-size").props.children,
      ).toBe(babyWeekCopy.weeks[24].size);
      expect(
        screen.getByTestId("dashboard-pregnancy-baby-week-development")
          .props.children,
      ).toBe(babyWeekCopy.weeks[24].development);
      expect(
        screen.queryByTestId("dashboard-pregnancy-baby-week-multiples-note"),
      ).toBeNull();
    });

    it("shows the catalog's multiples note for a twins pregnancy", async () => {
      renderDashboard(
        createStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(
            createPregnancyRecord({
              edd: PREGNANCY_EDD,
              eddBasis: "lmp",
              lmpDate: "2026-01-01",
              startedAt: "2026-03-01",
              fetusCount: 2,
            }),
          ),
        }),
        pregnancyNowForGaDays(171),
      );

      await screen.findByTestId("dashboard-pregnancy-baby-week");
      expect(
        screen.getByTestId("dashboard-pregnancy-baby-week-multiples-note")
          .props.children,
      ).toBe(getBabyWeekCopy("en").multiplesNote);
    });
  });

  describe("multiples: dashboard multiplesCard", () => {
    it("hides the multiples card for a singleton pregnancy", async () => {
      renderDashboard(
        createStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(
            createPregnancyRecord({
              edd: PREGNANCY_EDD,
              eddBasis: "lmp",
              lmpDate: "2026-01-01",
              startedAt: "2026-03-01",
            }),
          ),
        }),
        pregnancyNowForGaDays(171),
      );

      await screen.findByTestId("dashboard-pregnancy-mode");
      expect(
        screen.queryByTestId("dashboard-pregnancy-multiples-card"),
      ).toBeNull();
    });

    it("shows the base multiples card (below the hero) for twins with dcda chorionicity, no monochorionic line", async () => {
      renderDashboard(
        createStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(
            createPregnancyRecord({
              edd: PREGNANCY_EDD,
              eddBasis: "lmp",
              lmpDate: "2026-01-01",
              startedAt: "2026-03-01",
              fetusCount: 2,
              chorionicity: "dcda",
            }),
          ),
        }),
        pregnancyNowForGaDays(171),
      );

      const card = await screen.findByTestId("dashboard-pregnancy-multiples-card");
      expect(card).toBeTruthy();
      expect(screen.queryByText(/every 2 weeks/)).toBeNull();
    });

    it("shows the monochorionic extra line for twins with mcda chorionicity", async () => {
      renderDashboard(
        createStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(
            createPregnancyRecord({
              edd: PREGNANCY_EDD,
              eddBasis: "lmp",
              lmpDate: "2026-01-01",
              startedAt: "2026-03-01",
              fetusCount: 2,
              chorionicity: "mcda",
            }),
          ),
        }),
        pregnancyNowForGaDays(171),
      );

      await screen.findByTestId("dashboard-pregnancy-multiples-card");
      expect(screen.getByText(/every 2 weeks/)).toBeTruthy();
    });
  });

  it("surfaces the 'I gave birth' CTA from week 37 (term) and navigates to the end flow", async () => {
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: PREGNANCY_EDD,
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      }),
      pregnancyNowForGaDays(37 * 7),
    );

    const cta = await screen.findByTestId("dashboard-pregnancy-birth-cta");
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith("/pregnancy-end?reason=birth");
  });

  it("hides the birth CTA before week 37 but always shows the manage link", async () => {
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: PREGNANCY_EDD,
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      }),
      // 36+6 — the last pre-term day; the CTA must still be hidden, and the
      // manage link (the birth path for preterm births) must be present.
      pregnancyNowForGaDays(36 * 7 + 6),
    );

    const link = await screen.findByTestId("dashboard-pregnancy-manage-link");
    expect(screen.queryByTestId("dashboard-pregnancy-birth-cta")).toBeNull();

    fireEvent.press(link);
    expect(mockPush).toHaveBeenCalledWith("/pregnancy-end");
  });

  it("navigates to the kick counter from the kick teaser card at week 28+", async () => {
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: PREGNANCY_EDD,
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      }),
      pregnancyNowForGaDays(28 * 7),
    );

    const teaser = await screen.findByTestId("dashboard-pregnancy-kick-teaser");
    fireEvent.press(teaser);
    expect(mockPush).toHaveBeenCalledWith("/kick-counter");
  });

  it("hides the kick teaser card before week 28", async () => {
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: PREGNANCY_EDD,
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      }),
      pregnancyNowForGaDays(27 * 7 + 6),
    );

    await screen.findByTestId("dashboard-pregnancy-mode");
    expect(screen.queryByTestId("dashboard-pregnancy-kick-teaser")).toBeNull();
  });

  it("renders the contraction-timer card and navigates to it, subdued outside the third trimester", async () => {
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: PREGNANCY_EDD,
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      }),
      pregnancyNowForGaDays(171), // second trimester
    );

    const card = await screen.findByTestId("dashboard-pregnancy-contraction-timer");
    fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith("/contraction-timer");
  });

  it("renders the contraction-timer card prominently from the third trimester", async () => {
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: PREGNANCY_EDD,
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      }),
      pregnancyNowForGaDays(28 * 7), // first trimester-III day
    );

    const card = await screen.findByTestId("dashboard-pregnancy-contraction-timer");
    fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith("/contraction-timer");
  });

  it("shows zero pregnancy traces after an end even while the positive test still pauses predictions", async () => {
    const ended = {
      ...createPregnancyRecord({
        edd: PREGNANCY_EDD,
        eddBasis: "lmp",
        lmpDate: "2026-01-01",
        startedAt: "2026-03-01",
      }),
      status: "ended" as const,
      endedAt: "2026-06-05",
      endReason: "loss" as const,
      modeOfDelivery: null,
    };
    mockLoadPregnancyModuleOwned.mockResolvedValue(true);
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
        listDayLogRecordsInRange: jest
          .fn()
          .mockResolvedValue(positiveTestRecords("2026-06-01")),
        listPregnancyRecords: jest.fn().mockResolvedValue([ended]),
      }),
      new Date(2026, 5, 10),
    );

    // Plain cycle mode renders (prediction disclaimer is a cycle-mode surface)...
    await screen.findByTestId("dashboard-prediction-disclaimer");
    // ...and NONE of the pregnancy surfaces appear — no mode, no re-engagement.
    expect(screen.queryByTestId("dashboard-pregnancy-mode")).toBeNull();
    expect(screen.queryByTestId("dashboard-pregnancy-entry-card")).toBeNull();
    expect(screen.queryByTestId("dashboard-pregnancy-birth-cta")).toBeNull();
    expect(screen.queryByTestId("dashboard-pregnancy-manage-link")).toBeNull();
  });

  it("shows a stale-pregnancy card instead of the pregnancy dashboard when the EDD passed well beyond the trackable window", async () => {
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: PREGNANCY_EDD,
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      }),
      pregnancyNowForGaDays(630), // ~50 weeks past the due date
    );

    expect(await screen.findByTestId("dashboard-pregnancy-stale-card")).toBeTruthy();
    expect(screen.queryByTestId("dashboard-pregnancy-mode")).toBeNull();
    expect(screen.queryByTestId("dashboard-pregnancy-entry-card")).toBeNull();
    // Additive, not a takeover -- cycle sections still render underneath.
    expect(screen.getByTestId("dashboard-cycle-hero")).toBeTruthy();
  });

  it("navigates to manage pregnancy tracking from the stale-pregnancy card's CTA", async () => {
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: PREGNANCY_EDD,
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      }),
      pregnancyNowForGaDays(630),
    );

    const cta = await screen.findByTestId("dashboard-pregnancy-stale-card-cta");
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith("/pregnancy-end");
  });

  it("does not show a stale-pregnancy card for a normal in-window pregnancy", async () => {
    renderDashboard(
      createStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(
          createPregnancyRecord({
            edd: PREGNANCY_EDD,
            eddBasis: "lmp",
            lmpDate: "2026-01-01",
            startedAt: "2026-03-01",
          }),
        ),
      }),
      pregnancyNowForGaDays(171),
    );

    await screen.findByTestId("dashboard-pregnancy-mode");
    expect(screen.queryByTestId("dashboard-pregnancy-stale-card")).toBeNull();
  });

  describe("red flags", () => {
    it("renders the pregnancy red-flags section collapsed by default, expands to show items, and hides reduced_movements before week 28", async () => {
      renderDashboard(
        createStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(
            createPregnancyRecord({
              edd: PREGNANCY_EDD,
              eddBasis: "lmp",
              lmpDate: "2026-01-01",
              startedAt: "2026-03-01",
            }),
          ),
        }),
        pregnancyNowForGaDays(27 * 7 + 6), // 27+6 -- one day before week 28
      );

      const toggle = await screen.findByTestId(
        "dashboard-pregnancy-red-flags-toggle",
      );
      expect(
        screen.queryByTestId("dashboard-pregnancy-red-flags-expanded"),
      ).toBeNull();
      expect(
        screen.getByTestId("dashboard-pregnancy-red-flags-toggle")
          .props.accessibilityState,
      ).toEqual(expect.objectContaining({ expanded: false }));

      fireEvent.press(toggle);

      expect(
        await screen.findByTestId("dashboard-pregnancy-red-flags-expanded"),
      ).toBeTruthy();
      expect(
        screen.getByTestId("dashboard-pregnancy-red-flags-toggle")
          .props.accessibilityState,
      ).toEqual(expect.objectContaining({ expanded: true }));
      expect(
        screen.getByTestId("dashboard-pregnancy-red-flag-heavy_bleeding"),
      ).toBeTruthy();
      expect(
        screen.queryByTestId("dashboard-pregnancy-red-flag-reduced_movements"),
      ).toBeNull();
    });

    it("renders the postpartum red-flags section collapsed by default and expands to show all eight items incl. the psychosis escalation", async () => {
      renderDashboard(
        createStorageMock({
          readActivePostpartum: jest.fn().mockResolvedValue(
            createPostpartumRecord({
              startedAt: "2026-03-03",
              modeOfDelivery: "vaginal",
            }),
          ),
        }),
      );

      const toggle = await screen.findByTestId(
        "dashboard-postpartum-red-flags-toggle",
      );
      expect(
        screen.queryByTestId("dashboard-postpartum-red-flags-expanded"),
      ).toBeNull();

      fireEvent.press(toggle);

      expect(
        await screen.findByTestId("dashboard-postpartum-red-flags-expanded"),
      ).toBeTruthy();
      expect(
        screen.getByTestId("dashboard-postpartum-red-flag-heavy_bleeding_pp"),
      ).toBeTruthy();
      expect(
        screen.getByTestId("dashboard-postpartum-red-flag-mental_health"),
      ).toBeTruthy();
      // the firm-but-calm postpartum-psychosis escalation, after mental_health.
      expect(
        screen.getByTestId("dashboard-postpartum-red-flag-psychosis_signs"),
      ).toBeTruthy();
    });
  });

  describe("postpartum mode", () => {
    // Default dashboard now is 2026-03-17; a birth on 2026-03-03 is 14 days
    // (2+0 weeks) ago -> early phase, well inside the trackable window.
    it("renders the postpartum dashboard above the still-visible cycle sections", async () => {
      renderDashboard(
        createStorageMock({
          readActivePostpartum: jest.fn().mockResolvedValue(
            createPostpartumRecord({
              startedAt: "2026-03-03",
              modeOfDelivery: "vaginal",
            }),
          ),
        }),
      );

      await screen.findByTestId("dashboard-postpartum-mode");
      expect(
        screen.getByTestId("dashboard-postpartum-week-value").props.children,
      ).toBe("2+0");
      expect(screen.getByTestId("dashboard-postpartum-recovery-card")).toBeTruthy();
      expect(screen.getByTestId("dashboard-postpartum-lochia-card")).toBeTruthy();
      expect(screen.getByTestId("dashboard-postpartum-disclaimer")).toBeTruthy();

      // Additive, not a takeover: cycle journal + quick actions stay visible
      // (bleeding/lochia logging matters postpartum). Pregnancy surfaces absent.
      expect(screen.getByTestId("dashboard-cycle-hero")).toBeTruthy();
      expect(screen.getByTestId("dashboard-quick-actions-title")).toBeTruthy();
      expect(screen.queryByTestId("dashboard-pregnancy-mode")).toBeNull();
      expect(screen.queryByTestId("dashboard-pregnancy-entry-card")).toBeNull();
    });

    // Default `now` (2026-03-17) puts this 14 days after the 2026-03-03 birth
    // date, i.e. the early phase. Full phase x mode-of-delivery matrix
    // coverage lives in postpartum-mode-service.test.ts; this
    // pins the mode-of-delivery-aware body reaching the rendered screen.
    it("resolves a mode-of-delivery-aware recovery body for a cesarean birth, but not a vaginal one", async () => {
      renderDashboard(
        createStorageMock({
          readActivePostpartum: jest.fn().mockResolvedValue(
            createPostpartumRecord({
              startedAt: "2026-03-03",
              modeOfDelivery: "cesarean",
            }),
          ),
        }),
      );

      await screen.findByTestId("dashboard-postpartum-mode");
      expect(screen.getByText(/abdominal surgery/)).toBeTruthy();

      screen.unmount();

      renderDashboard(
        createStorageMock({
          readActivePostpartum: jest.fn().mockResolvedValue(
            createPostpartumRecord({
              startedAt: "2026-03-03",
              modeOfDelivery: "vaginal",
            }),
          ),
        }),
      );

      await screen.findByTestId("dashboard-postpartum-mode");
      expect(screen.queryByText(/abdominal surgery/)).toBeNull();
    });

    it("renders an existing postpartum record read-only even when premium has lapsed", async () => {
      // Lapse posture mirrors pregnancy: rendering an existing record never
      // consults the premium gate (reads are never gated). The default mock
      // returns locked; the record must still render, and the unlock selector
      // must not even be called for a rendered record.
      mockLoadPregnancyModuleOwned.mockResolvedValue(false);
      renderDashboard(
        createStorageMock({
          readActivePostpartum: jest.fn().mockResolvedValue(
            createPostpartumRecord({ startedAt: "2026-03-03" }),
          ),
        }),
      );

      await screen.findByTestId("dashboard-postpartum-mode");
      expect(
        mockLoadPregnancyModuleOwned,
      ).not.toHaveBeenCalled();
    });

    it("gives an active pregnancy precedence over a stray active postpartum", async () => {
      renderDashboard(
        createStorageMock({
          readActivePregnancy: jest.fn().mockResolvedValue(
            createPregnancyRecord({
              edd: PREGNANCY_EDD,
              eddBasis: "lmp",
              lmpDate: "2026-01-01",
              startedAt: "2026-03-01",
            }),
          ),
          readActivePostpartum: jest.fn().mockResolvedValue(
            createPostpartumRecord({ startedAt: "2026-03-03" }),
          ),
        }),
        pregnancyNowForGaDays(171),
      );

      await screen.findByTestId("dashboard-pregnancy-mode");
      expect(screen.queryByTestId("dashboard-postpartum-mode")).toBeNull();
    });

    it("shows a stale-postpartum card past the 26-week window and navigates to manage", async () => {
      renderDashboard(
        createStorageMock({
          readActivePostpartum: jest.fn().mockResolvedValue(
            createPostpartumRecord({ startedAt: "2025-06-01" }),
          ),
        }),
      );

      const cta = await screen.findByTestId("dashboard-postpartum-stale-card-cta");
      expect(screen.queryByTestId("dashboard-postpartum-mode")).toBeNull();
      // Additive: cycle sections still render underneath.
      expect(screen.getByTestId("dashboard-cycle-hero")).toBeTruthy();
      fireEvent.press(cta);
      expect(mockPush).toHaveBeenCalledWith("/pregnancy-end");
    });

    it("navigates to manage postpartum tracking from the dashboard manage link", async () => {
      renderDashboard(
        createStorageMock({
          readActivePostpartum: jest.fn().mockResolvedValue(
            createPostpartumRecord({ startedAt: "2026-03-03" }),
          ),
        }),
      );

      const link = await screen.findByTestId("dashboard-postpartum-manage-link");
      fireEvent.press(link);
      expect(mockPush).toHaveBeenCalledWith("/pregnancy-end");
    });

    it("leaves zero postpartum traces once the record has ended (no active postpartum)", async () => {
      // After endPostpartum the record is "ended", so readActivePostpartum
      // resolves null and the dashboard renders plain cycle mode — no
      // postpartum hero, cards, or stale card linger.
      renderDashboard(
        createStorageMock({
          readActivePostpartum: jest.fn().mockResolvedValue(null),
          listPostpartumRecords: jest.fn().mockResolvedValue([
            {
              ...createPostpartumRecord({ startedAt: "2026-03-03" }),
              status: "ended" as const,
              endedAt: "2026-03-17",
              endReason: "manual" as const,
            },
          ]),
        }),
      );

      await screen.findByTestId("dashboard-cycle-hero");
      expect(screen.queryByTestId("dashboard-postpartum-mode")).toBeNull();
      expect(screen.queryByTestId("dashboard-postpartum-stale-card")).toBeNull();
    });
  });

  describe("cycle-return offer & LAM education card", () => {
    // Same birth date used throughout the postpartum-mode describe block
    // above -- 14 days before the default dashboard `now` (2026-03-17), well
    // inside the trackable window.
    function activePostpartumBirth() {
      return createPostpartumRecord({
        startedAt: "2026-03-03",
        modeOfDelivery: "vaginal",
      });
    }

    // createStorageMock's baseline profile carries `lastPeriodStart:
    // "2026-03-10"` for the unrelated cycle-hero fixtures elsewhere in this
    // file -- collectCycleStartDates treats a profile lastPeriodStart as a
    // cycle start too, and 2026-03-10 is itself after this block's birth date
    // (2026-03-03). Neutralizing it here isolates the signal this describe
    // block actually tests: the DAY-LOG history, via listDayLogRecordsInRange.
    function readProfileRecordOverride() {
      return {
        readProfileRecord: jest.fn().mockResolvedValue({
          lastPeriodStart: null,
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
      };
    }

    it("offer visibility matrix: shown with a cycle start after birth, hidden with one only before birth, hidden with no active postpartum", async () => {
      renderDashboard(
        createStorageMock({
          ...readProfileRecordOverride(),
          readActivePostpartum: jest
            .fn()
            .mockResolvedValue(activePostpartumBirth()),
          listDayLogRecordsInRange: jest
            .fn()
            .mockResolvedValue([periodStartDayLogRecord("2026-03-10")]),
        }),
      );
      await screen.findByTestId("dashboard-postpartum-cycle-return-offer");
      screen.unmount();

      renderDashboard(
        createStorageMock({
          ...readProfileRecordOverride(),
          readActivePostpartum: jest
            .fn()
            .mockResolvedValue(activePostpartumBirth()),
          // A pre-pregnancy period, well before the birth -- must not read as
          // a "new" (returning) cycle start.
          listDayLogRecordsInRange: jest
            .fn()
            .mockResolvedValue([periodStartDayLogRecord("2026-01-10")]),
        }),
      );
      await screen.findByTestId("dashboard-postpartum-mode");
      expect(
        screen.queryByTestId("dashboard-postpartum-cycle-return-offer"),
      ).toBeNull();
      screen.unmount();

      renderDashboard(
        createStorageMock({
          ...readProfileRecordOverride(),
          readActivePostpartum: jest.fn().mockResolvedValue(null),
          listDayLogRecordsInRange: jest
            .fn()
            .mockResolvedValue([periodStartDayLogRecord("2026-03-10")]),
        }),
      );
      await screen.findByTestId("dashboard-cycle-hero");
      expect(screen.queryByTestId("dashboard-postpartum-mode")).toBeNull();
      expect(
        screen.queryByTestId("dashboard-postpartum-cycle-return-offer"),
      ).toBeNull();
    });

    it("accept flow: confirms, calls endPostpartum with reason cycle_returned, and leaves zero postpartum traces after", async () => {
      let active: PostpartumRecord | null = activePostpartumBirth();
      const writePostpartumRecord = jest.fn(async (record: PostpartumRecord) => {
        active = record.status === "active" ? record : null;
      });
      mockOpenConfirmation.mockResolvedValue(true);

      renderDashboard(
        createStorageMock({
          ...readProfileRecordOverride(),
          readActivePostpartum: jest.fn(async () => active),
          listDayLogRecordsInRange: jest
            .fn()
            .mockResolvedValue([periodStartDayLogRecord("2026-03-10")]),
          writePostpartumRecord,
        }),
      );

      const acceptButton = await screen.findByTestId(
        "dashboard-postpartum-cycle-return-offer-accept",
      );
      fireEvent.press(acceptButton);

      await waitFor(() =>
        expect(writePostpartumRecord).toHaveBeenCalledTimes(1),
      );
      expect(writePostpartumRecord.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          status: "ended",
          endReason: "cycle_returned",
        }),
      );

      // The confirm dialog mirrors the manage screen's manual end dialog.
      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        expect.stringContaining("Close postpartum tracking?"),
        "Close tracking",
        "Keep tracking",
      );

      await screen.findByTestId("dashboard-cycle-hero");
      expect(screen.queryByTestId("dashboard-postpartum-mode")).toBeNull();
      expect(screen.queryByTestId("dashboard-postpartum-stale-card")).toBeNull();
      expect(
        screen.queryByTestId("dashboard-postpartum-cycle-return-offer"),
      ).toBeNull();
    });

    it("dialog dismissal keeps tracking: the service is not called and postpartum mode stays", async () => {
      mockOpenConfirmation.mockResolvedValue(false);
      const writePostpartumRecord = jest.fn().mockResolvedValue(undefined);

      renderDashboard(
        createStorageMock({
          ...readProfileRecordOverride(),
          readActivePostpartum: jest
            .fn()
            .mockResolvedValue(activePostpartumBirth()),
          listDayLogRecordsInRange: jest
            .fn()
            .mockResolvedValue([periodStartDayLogRecord("2026-03-10")]),
          writePostpartumRecord,
        }),
      );

      const acceptButton = await screen.findByTestId(
        "dashboard-postpartum-cycle-return-offer-accept",
      );
      fireEvent.press(acceptButton);

      await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalled());
      expect(writePostpartumRecord).not.toHaveBeenCalled();
      expect(screen.getByTestId("dashboard-postpartum-mode")).toBeTruthy();
      expect(
        screen.getByTestId("dashboard-postpartum-cycle-return-offer"),
      ).toBeTruthy();
    });

    it('"Keep" dismisses the offer for this screen session only, without calling the service', async () => {
      const writePostpartumRecord = jest.fn().mockResolvedValue(undefined);
      renderDashboard(
        createStorageMock({
          ...readProfileRecordOverride(),
          readActivePostpartum: jest
            .fn()
            .mockResolvedValue(activePostpartumBirth()),
          listDayLogRecordsInRange: jest
            .fn()
            .mockResolvedValue([periodStartDayLogRecord("2026-03-10")]),
          writePostpartumRecord,
        }),
      );

      const keepButton = await screen.findByTestId(
        "dashboard-postpartum-cycle-return-offer-keep",
      );
      fireEvent.press(keepButton);

      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(writePostpartumRecord).not.toHaveBeenCalled();
      expect(
        screen.queryByTestId("dashboard-postpartum-cycle-return-offer"),
      ).toBeNull();
      // "Keep" dismisses only the offer card -- postpartum mode itself stays.
      expect(screen.getByTestId("dashboard-postpartum-mode")).toBeTruthy();
    });

    it("LAM card is present while active with no new cycle start, and absent once a new cycle start exists", async () => {
      renderDashboard(
        createStorageMock({
          ...readProfileRecordOverride(),
          readActivePostpartum: jest
            .fn()
            .mockResolvedValue(activePostpartumBirth()),
        }),
      );
      await screen.findByTestId("dashboard-postpartum-lam-card");
      screen.unmount();

      renderDashboard(
        createStorageMock({
          ...readProfileRecordOverride(),
          readActivePostpartum: jest
            .fn()
            .mockResolvedValue(activePostpartumBirth()),
          listDayLogRecordsInRange: jest
            .fn()
            .mockResolvedValue([periodStartDayLogRecord("2026-03-10")]),
        }),
      );
      await screen.findByTestId("dashboard-postpartum-cycle-return-offer");
      expect(screen.queryByTestId("dashboard-postpartum-lam-card")).toBeNull();
    });

    it("the LAM card body states the three-conditions framing", async () => {
      renderDashboard(
        createStorageMock({
          ...readProfileRecordOverride(),
          readActivePostpartum: jest
            .fn()
            .mockResolvedValue(activePostpartumBirth()),
        }),
      );

      await screen.findByTestId("dashboard-postpartum-lam-card");
      expect(screen.getByText(/no period since birth/)).toBeTruthy();
      expect(screen.getByText(/six months/)).toBeTruthy();
    });
  });

  describe("crisis support", () => {
    it("renders a quiet standing support-resources row that expands in place to the crisis-support card", async () => {
      renderDashboard(
        createStorageMock({
          readActivePostpartum: jest.fn().mockResolvedValue(
            createPostpartumRecord({ startedAt: "2026-03-03" }),
          ),
        }),
      );

      const toggle = await screen.findByTestId(
        "dashboard-postpartum-support-resources-toggle",
      );
      // Collapsed by default (no new route — expand in place).
      expect(
        screen.queryByTestId(
          "dashboard-postpartum-support-resources-expanded",
        ),
      ).toBeNull();

      fireEvent.press(toggle);

      expect(
        await screen.findByTestId(
          "dashboard-postpartum-support-resources-expanded",
        ),
      ).toBeTruthy();
      // The shared crisis-support block + its always-on guidance are revealed.
      expect(
        screen.getByTestId("dashboard-postpartum-crisis-support"),
      ).toBeTruthy();
      expect(
        screen.getByTestId("dashboard-postpartum-crisis-support-guidance"),
      ).toBeTruthy();
    });

    it("keeps the support-resources row available in the read-only lapse posture (never premium-gated)", async () => {
      // Premium is locked (default mock) and the pregnancy/postpartum unlock
      // selector must not even be consulted for a rendered record — yet the
      // crisis-support row must still be present. HARD RULE pin.
      mockLoadPregnancyModuleOwned.mockResolvedValue(false);
      renderDashboard(
        createStorageMock({
          readActivePostpartum: jest.fn().mockResolvedValue(
            createPostpartumRecord({ startedAt: "2026-03-03" }),
          ),
        }),
      );

      await screen.findByTestId("dashboard-postpartum-mode");
      expect(
        screen.getByTestId("dashboard-postpartum-support-resources"),
      ).toBeTruthy();
      expect(
        screen.getByTestId("dashboard-postpartum-support-resources-toggle"),
      ).toBeTruthy();
      expect(
        mockLoadPregnancyModuleOwned,
      ).not.toHaveBeenCalled();
    });

    it("shows a saved crisis contact and persists an inline edit through the profile path", async () => {
      const storage = createStorageMock({
        readActivePostpartum: jest.fn().mockResolvedValue(
          createPostpartumRecord({ startedAt: "2026-03-03" }),
        ),
        readProfileRecord: jest.fn().mockResolvedValue({
          ...createDefaultProfileRecord(),
          lastPeriodStart: "2026-03-10",
          crisisContactName: "Mum",
          crisisContactPhone: "07700 900000",
        }),
      });
      renderDashboard(storage);

      fireEvent.press(
        await screen.findByTestId(
          "dashboard-postpartum-support-resources-toggle",
        ),
      );

      expect(
        await screen.findByText("Your support contact: Mum — 07700 900000"),
      ).toBeTruthy();

      fireEvent.press(
        screen.getByTestId("dashboard-postpartum-crisis-support-edit-button"),
      );
      fireEvent.changeText(
        screen.getByTestId("dashboard-postpartum-crisis-support-name-input"),
        "Aunt Jo",
      );
      fireEvent.changeText(
        screen.getByTestId("dashboard-postpartum-crisis-support-phone-input"),
        "0123 456",
      );
      await act(async () => {
        fireEvent.press(
          screen.getByTestId("dashboard-postpartum-crisis-support-save-button"),
        );
        await Promise.resolve();
      });

      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          crisisContactName: "Aunt Jo",
          crisisContactPhone: "0123 456",
        }),
      );
    });
  });
});

describe("DashboardScreen postpartum action edges", () => {
  it("routes the screening offer and history presses", async () => {
    renderDashboard(
      createStorageMock({
        readActivePostpartum: jest.fn().mockResolvedValue(
          createPostpartumRecord({ startedAt: "2026-06-01" }),
        ),
        // One response 19 days old: the 14-day cadence makes the offer due
        // again AND the "last check-in" history row exists.
        listScreeningResponses: jest.fn().mockResolvedValue([
          createScreeningResponse({
            date: "2026-07-01",
            answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          }),
        ]),
      }),
      new Date("2026-07-20T10:00:00.000Z"),
    );

    fireEvent.press(await screen.findByTestId("dashboard-screening-offer-button"));
    expect(mockPush).toHaveBeenCalledWith("/postpartum-screening");
    fireEvent.press(screen.getByTestId("dashboard-screening-history-link"));
    expect(mockPush).toHaveBeenCalledWith("/postpartum-screening?view=history");
  });

  it("surfaces a failed cycle-return end without closing the offer silently", async () => {
    mockOpenConfirmation.mockResolvedValueOnce(true);
    const storage = createStorageMock({
      readActivePostpartum: jest.fn().mockResolvedValue(
        createPostpartumRecord({ startedAt: "2026-05-01" }),
      ),
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        {
          ...createEmptyDayLogRecord("2026-07-18"),
          cycleStart: true,
          isPeriod: true,
        },
      ]),
      writePostpartumRecord: jest.fn().mockRejectedValue(new Error("busy")),
    });
    renderDashboard(storage, new Date("2026-07-20T10:00:00.000Z"));

    fireEvent.press(
      await screen.findByTestId("dashboard-postpartum-cycle-return-offer-accept"),
    );

    expect(
      await screen.findByText(getPostpartumCopy("en").status.endFailed),
    ).toBeTruthy();
  });
});

