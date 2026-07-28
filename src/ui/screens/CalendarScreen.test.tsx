import * as React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Dimensions } from "react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import { createPregnancyRecord } from "../../models/pregnancy";
import { createDefaultSymptomRecords } from "../../models/symptom";
import { loadManagedPremiumFeaturesForCurrentSession } from "../../services/managed-premium-features-service";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { createVolatileWebAppStorage } from "../../storage/local/volatile-web-app-storage";
import { openConfirmation } from "../confirm/open-confirmation";
import { CalendarScreen } from "./CalendarScreen";

const mockUseEffect = React.useEffect;
const mockUseState = React.useState;
// Every mounted useFocusEffect registers its focus counter here, so a test can
// re-focus the whole screen at once (simulateScreenRefocus below).
const mockFocusCounters = new Set<React.Dispatch<React.SetStateAction<number>>>();

jest.mock("expo-router", () => {
  return {
    // Test double for expo-router's useFocusEffect on the two axes this screen
    // depends on: the effect runs on mount and again whenever its callback
    // identity changes, and a fresh focus re-runs it (cleanup first) even when
    // the callback is unchanged.
    useFocusEffect: (effect: () => void | (() => void)) => {
      const [focusCount, setFocusCount] = mockUseState(0);
      mockUseEffect(() => {
        mockFocusCounters.add(setFocusCount);
        return () => {
          mockFocusCounters.delete(setFocusCount);
        };
      }, []);
      mockUseEffect(effect, [effect, focusCount]);
    },
  };
});

async function simulateScreenRefocus() {
  await act(async () => {
    for (const setFocusCount of mockFocusCounters) {
      setFocusCount((current) => current + 1);
    }
  });
}

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

function createStorageMock() {
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
      languageOverride: "en",
      themeOverride: "light",
      dismissedCalendarPredictionNoticeKey: null,
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
    readDayLogRecord: jest.fn().mockImplementation(async (date: string) => {
      if (date === "2026-03-14") {
        return {
          ...createEmptyDayLogRecord(date),
          mood: 4,
        };
      }

      return createEmptyDayLogRecord(date);
    }),
    listDayLogRecordsInRange: jest.fn().mockResolvedValue([
      {
        ...createEmptyDayLogRecord("2026-03-14"),
        mood: 4,
      },
    ]),
  });
}

async function waitForCalendarReady() {
  await waitFor(
    () => expect(screen.getByTestId("calendar-prev-button")).toBeTruthy(),
    {
      timeout: 5000,
    },
  );
}

async function waitForSelectedDayPanel(dateLabel: string) {
  await waitFor(() => expect(screen.getByText(dateLabel)).toBeTruthy(), {
    timeout: 5000,
  });
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
    languageOverride: "en",
    themeOverride: "light",
    dismissedCalendarPredictionNoticeKey: null,
  });

  // Coverline window 03-29..04-03 stays flat; the sustained "3-over-6" streak
  // starts on 04-04, so the canonical detector anchors the shift after the full
  // 6-day coverline window (ovulation 2026-04-03).
  const records = [
    {
      ...createEmptyDayLogRecord("2026-03-29"),
      isPeriod: true,
      cycleStart: true,
      flow: "medium" as const,
      bbt: 36.3,
    },
    {
      ...createEmptyDayLogRecord("2026-03-30"),
      bbt: 36.31,
    },
    {
      ...createEmptyDayLogRecord("2026-03-31"),
      bbt: 36.29,
      cervicalMucus: "eggwhite" as const,
      lhTest: "peak" as const,
      pregnancyTest: "none" as const,
    },
    {
      ...createEmptyDayLogRecord("2026-04-01"),
      bbt: 36.3,
    },
    {
      ...createEmptyDayLogRecord("2026-04-02"),
      bbt: 36.3,
    },
    {
      ...createEmptyDayLogRecord("2026-04-03"),
      bbt: 36.3,
    },
    {
      ...createEmptyDayLogRecord("2026-04-04"),
      bbt: 36.55,
    },
    {
      ...createEmptyDayLogRecord("2026-04-05"),
      bbt: 36.56,
    },
    {
      ...createEmptyDayLogRecord("2026-04-06"),
      bbt: 36.57,
    },
  ];

  for (const record of records) {
    await storage.writeDayLogRecord(record);
  }

  return storage;
}

describe("CalendarScreen", () => {
  beforeEach(() => {
    mockOpenConfirmation.mockReset();
    mockOpenConfirmation.mockResolvedValue(true);
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

  it("loads a selected day through the shared local repository", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();

    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));

    await waitFor(() =>
      expect(storage.readDayLogRecord).toHaveBeenCalledWith("2026-03-14"),
    );
  });

  it("renders the persistent not-medical-advice prediction disclaimer (web parity)", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    const disclaimer = await screen.findByTestId(
      "calendar-prediction-disclaimer",
    );
    expect(disclaimer.props.children).toBe(
      "These are estimates, not medical advice or a method of contraception.",
    );
  });

  it("moves the selected-day panel to the new month anchor when month navigation changes", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();

    fireEvent.press(screen.getByTestId("calendar-prev-button"));

    await waitFor(() =>
      expect(storage.readDayLogRecord).toHaveBeenCalledWith("2026-02-01"),
    );
  });

  it("reads managed billing on focus only, never when the selection changes", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    expect(
      mockLoadManagedPremiumFeaturesForCurrentSession,
    ).toHaveBeenCalledTimes(1);

    // Picking a day re-derives the view from local storage only.
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));
    await waitFor(() =>
      expect(storage.readDayLogRecord).toHaveBeenCalledWith("2026-03-14"),
    );
    expect(
      mockLoadManagedPremiumFeaturesForCurrentSession,
    ).toHaveBeenCalledTimes(1);

    // Month navigation moves the anchor day, which is the same local path.
    fireEvent.press(screen.getByTestId("calendar-prev-button"));
    await waitFor(() =>
      expect(storage.readDayLogRecord).toHaveBeenCalledWith("2026-02-01"),
    );
    expect(
      mockLoadManagedPremiumFeaturesForCurrentSession,
    ).toHaveBeenCalledTimes(1);

    // Returning to the screen is what the focus effect exists for: the managed
    // read runs again and the local view is rebuilt behind it.
    const localReadsBeforeRefocus = jest.mocked(storage.listDayLogRecordsInRange)
      .mock.calls.length;
    await simulateScreenRefocus();

    await waitFor(() =>
      expect(
        mockLoadManagedPremiumFeaturesForCurrentSession,
      ).toHaveBeenCalledTimes(2),
    );
    await waitFor(() =>
      expect(
        jest.mocked(storage.listDayLogRecordsInRange).mock.calls.length,
      ).toBeGreaterThan(localReadsBeforeRefocus),
    );
  });

  it("shows calendar legend as grouped day styles and marker samples", async () => {
    const storage = createStorageMock();
    storage.readProfileRecord = jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-14",
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
    storage.listDayLogRecordsInRange = jest.fn().mockResolvedValue([
      {
        ...createEmptyDayLogRecord("2026-01-17"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-02-14"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-14"),
        isPeriod: true,
      },
    ]);

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();

    expect(screen.queryByTestId("calendar-state-badge-2026-03-24")).toBeNull();
    expect(screen.getByText(/Logged period|Отмеченная менструация/)).toBeTruthy();
    expect(
      screen.getByText(/Predicted period|Предсказанная менструация/),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/Fertility may be starting|Фертильность может начинаться/)
        .length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Higher fertility|Более высокая фертильность/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ovulation day|День овуляции/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText(/Logged entry|Есть запись/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Intimacy logged|Отмечена близость/).length).toBeGreaterThan(
      0,
    );
  });

  it("shows custom symptoms in the selected-day editor and keeps archived selected symptoms visible", async () => {
    const storage = createStorageMock();
    storage.readDayLogRecord = jest.fn().mockImplementation(async (date: string) => {
      if (date === "2026-03-14") {
        return {
          ...createEmptyDayLogRecord(date),
          symptomIDs: ["custom_old"],
        };
      }

      return createEmptyDayLogRecord(date);
    });
    storage.listSymptomRecords = jest.fn().mockResolvedValue([
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
      {
        id: "custom_old",
        slug: "old-symptom",
        label: "Old symptom",
        icon: "🌀",
        color: "#E8799F",
        isArchived: true,
        sortOrder: 1000,
        isDefault: false,
      },
    ]);

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));

    await waitForSelectedDayPanel("Sat, Mar 14");
    await waitFor(
      () => expect(screen.getByTestId("calendar-day-edit-button")).toBeTruthy(),
      { timeout: 3000 },
    );
    fireEvent.press(screen.getByTestId("calendar-day-edit-button"));

    await screen.findByTestId("day-log-period-toggle");
    await waitFor(() => expect(screen.getByText("Old symptom")).toBeTruthy(), {
      timeout: 3000,
    });
    fireEvent.press(screen.getByTestId("day-log-more-symptoms-button"));
    expect(screen.getByText("Jaw pain")).toBeTruthy();
  });

  it("keeps existing days in summary mode until edit is requested and shows manual cycle start", async () => {
    const storage = createStorageMock();
    storage.readDayLogRecord = jest.fn().mockImplementation(async (date: string) => {
      if (date === "2026-03-14") {
        return {
          ...createEmptyDayLogRecord(date),
          mood: 4,
        };
      }

      return createEmptyDayLogRecord(date);
    });

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));

    await waitForSelectedDayPanel("Sat, Mar 14");
    await waitFor(
      () => expect(screen.getByTestId("calendar-day-edit-button")).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(screen.getByTestId("calendar-day-edit-button")).toBeTruthy();
    expect(screen.getByTestId("calendar-day-cycle-start-button")).toBeTruthy();
    expect(screen.queryByTestId("day-log-save-button")).toBeNull();
  });

  it("opens empty days directly in edit mode", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-13"));

    await screen.findByTestId("day-log-period-toggle");
    expect(screen.getByTestId("calendar-day-cycle-start-button")).toBeTruthy();
    expect(screen.queryByTestId("calendar-day-add-button")).toBeNull();
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

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={createStorageMock()} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-13"));

    await screen.findByTestId("day-log-period-toggle");

    expect(screen.getByTestId("day-log-lh-none")).toBeTruthy();
    expect(screen.getByTestId("day-log-lh-peak")).toBeTruthy();
  });

  it("shows a premium advanced fertility summary for current-cycle days when entitlement is active", async () => {
    mockLoadManagedPremiumFeaturesForCurrentSession.mockResolvedValue({
      advancedFertility: true,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: false,
      reminders: false,
    });

    const storage = await createAdvancedFertilityStorage();

    render(<CalendarScreen now={new Date(2026, 3, 6)} storage={storage} />);

    await screen.findByTestId("calendar-advanced-fertility-summary");

    expect(screen.getByTestId("calendar-advanced-fertility-summary-title").props.children).toBe(
      "Advanced fertility",
    );
    expect(screen.getByTestId("calendar-advanced-fertility-summary-label").props.children).toBe(
      "Ovulation confirmation",
    );
    expect(screen.getByTestId("calendar-advanced-fertility-summary-value").props.children).toBe(
      "Signals aligned",
    );
    expect(screen.getByTestId("calendar-advanced-fertility-summary-hint").props.children).toBe(
      "This usually means ovulation likely happened recently and the fertile window may be closing.",
    );

    // The whole insight card is one composed accessibility label (title,
    // signal, value, detail, hint) so a screen reader announces it as a
    // single phrase instead of five separate stops.
    const detailText = screen.getByTestId(
      "calendar-advanced-fertility-summary-detail",
    ).props.children;
    expect(
      screen.getByTestId("calendar-advanced-fertility-summary").props
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

  it("shows an approximate prediction notice when irregular cycle mode is enabled", async () => {
    const storage = createStorageMock();
    storage.readProfileRecord = jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-10",
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
      languageOverride: "en",
      themeOverride: "light",
      dismissedCalendarPredictionNoticeKey: null,
    });

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    expect(screen.getByTestId("calendar-prediction-mode-banner")).toBeTruthy();
    expect(
      screen.getByText(/approximate guidance|приблизительный ориентир|guía aproximada/i),
    ).toBeTruthy();
  });

  it("dismisses the prediction notice and persists that preference", async () => {
    const storage = createStorageMock();
    storage.readProfileRecord = jest.fn().mockResolvedValue({
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
      dismissedCalendarPredictionNoticeKey: null,
    });

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("calendar-prediction-mode-banner");
    fireEvent.press(screen.getByTestId("calendar-prediction-mode-banner-dismiss"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          dismissedCalendarPredictionNoticeKey:
            "calendar_unpredictable_prediction_notice_v1",
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("calendar-prediction-mode-banner")).toBeNull(),
    );
  });

  it("shows the pregnancy-paused notice and keeps its dismissal session-only", async () => {
    const storage = createStorageMock();
    storage.readActivePregnancy = jest.fn().mockResolvedValue(
      createPregnancyRecord({
        edd: "2026-12-01",
        eddBasis: "lmp",
        lmpDate: "2026-02-24",
        startedAt: "2026-02-24",
      }),
    );

    const firstMount = render(
      <CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />,
    );

    await screen.findByTestId("calendar-prediction-mode-banner");
    expect(
      screen.getByText(
        /Pregnancy tracking is active|Отслеживание беременности активно|El seguimiento del embarazo está activo/i,
      ),
    ).toBeTruthy();

    fireEvent.press(
      screen.getByTestId("calendar-prediction-mode-banner-dismiss"),
    );

    await waitFor(() =>
      expect(screen.queryByTestId("calendar-prediction-mode-banner")).toBeNull(),
    );
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();

    // Session-only by contract: a fresh mount surfaces the notice again while
    // the pregnancy is still active.
    firstMount.unmount();
    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);
    await screen.findByTestId("calendar-prediction-mode-banner");
  });

  it("autosaves a new period entry and keeps the editor open", async () => {
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

    render(
      <CalendarScreen
        autosaveDebounceMs={1}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-13"));
    await screen.findByTestId("day-log-period-toggle");
    fireEvent.press(screen.getByTestId("day-log-period-toggle"));

    await waitFor(() =>
      expect(screen.getByTestId("day-log-status-banner")).toBeTruthy(),
    );
    expect(screen.queryByTestId("calendar-day-panel")).toBeNull();
    expect(await storage.readDayLogRecord("2026-03-13")).toEqual(
      expect.objectContaining({
        date: "2026-03-13",
        isPeriod: true,
      }),
    );
    expect(await storage.readDayLogRecord("2026-03-14")).toEqual(
      expect.objectContaining({
        date: "2026-03-14",
        isPeriod: true,
      }),
    );
  });

  it("autosaves empty-day edits without leaving edit mode", async () => {
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

    render(
      <CalendarScreen
        autosaveDebounceMs={1}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-13"));
    await screen.findByTestId("day-log-period-toggle");
    fireEvent.press(screen.getByTestId("day-log-period-toggle"));

    await waitFor(() =>
      expect(screen.getByTestId("day-log-status-banner")).toBeTruthy(),
    );
    expect(screen.getByTestId("day-log-period-toggle").props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
    expect(await storage.readDayLogRecord("2026-03-13")).toEqual(
      expect.objectContaining({
        date: "2026-03-13",
        isPeriod: true,
      }),
    );
  });

  it("flushes a pending empty-day draft before switching to another day", async () => {
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
    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-03-14"),
      mood: 4,
    });

    render(
      <CalendarScreen
        autosaveDebounceMs={1000}
        now={new Date(2026, 2, 17)}
        storage={storage}
      />,
    );

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-13"));
    await screen.findByTestId("day-log-period-toggle");
    fireEvent.press(screen.getByTestId("day-log-period-toggle"));
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));

    await waitFor(
      () => expect(screen.getByTestId("calendar-day-edit-button")).toBeTruthy(),
      { timeout: 3000 },
    );
    await waitFor(async () =>
      expect(await storage.readDayLogRecord("2026-03-13")).toEqual(
        expect.objectContaining({
          date: "2026-03-13",
          isPeriod: true,
        }),
      ),
    );
  });

  it("deletes an existing entry and returns to the empty-day summary", async () => {
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
    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-03-14"),
      mood: 4,
      notes: "Needs follow-up",
    });

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));
    await waitForSelectedDayPanel("Sat, Mar 14");
    await waitFor(() =>
      expect(screen.getByTestId("calendar-day-edit-button")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("calendar-day-edit-button"));
    await screen.findByTestId("day-log-delete-button");
    fireEvent.press(screen.getByTestId("day-log-delete-button"));

    await waitFor(
      () => expect(screen.getByTestId("calendar-day-add-button")).toBeTruthy(),
      { timeout: 3000 },
    );
    expect(screen.queryByTestId("day-log-save-button")).toBeNull();
    expect(await storage.readDayLogRecord("2026-03-14")).toEqual(
      createEmptyDayLogRecord("2026-03-14"),
    );

    // The add button (view mode, no entry) reopens the editor directly.
    fireEvent.press(screen.getByTestId("calendar-day-add-button"));
    await screen.findByTestId("day-log-period-toggle");
  });

  it("cancels an edit without discarding the persisted entry", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));
    await waitForSelectedDayPanel("Sat, Mar 14");
    await waitFor(() =>
      expect(screen.getByTestId("calendar-day-edit-button")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("calendar-day-edit-button"));
    await screen.findByTestId("day-log-cancel-button");

    fireEvent.press(screen.getByTestId("day-log-cancel-button"));

    // Back to the read-only summary; the entry itself was never touched.
    await waitFor(() =>
      expect(screen.getByTestId("calendar-day-edit-button")).toBeTruthy(),
    );
    expect(storage.deleteDayLogRecord).not.toHaveBeenCalled();
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();
  });

  it("navigates forward a month then back to today via the today shortcut", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-next-button"));

    await waitFor(() =>
      expect(storage.readDayLogRecord).toHaveBeenCalledWith("2026-04-01"),
    );

    fireEvent.press(screen.getByTestId("calendar-today-button"));

    await waitFor(() =>
      expect(storage.readDayLogRecord).toHaveBeenCalledWith("2026-03-17"),
    );
  });

  it("cancels deleting a persisted entry when the owner declines the confirmation prompt", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));
    await waitForSelectedDayPanel("Sat, Mar 14");
    await waitFor(() =>
      expect(screen.getByTestId("calendar-day-edit-button")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("calendar-day-edit-button"));
    await screen.findByTestId("day-log-delete-button");

    mockOpenConfirmation.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId("day-log-delete-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(1));
    expect(storage.deleteDayLogRecord).not.toHaveBeenCalled();
    // Still editing the untouched entry — a dismissed confirmation keeps the
    // owner exactly where they were, never the destructive answer.
    expect(screen.getByTestId("day-log-delete-button")).toBeTruthy();
  });

  it("shows an error status when deleting an entry fails to persist", async () => {
    const storage = createStorageMock();
    storage.deleteDayLogRecord = jest.fn().mockRejectedValue(new Error("boom"));

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));
    await waitForSelectedDayPanel("Sat, Mar 14");
    await waitFor(() =>
      expect(screen.getByTestId("calendar-day-edit-button")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("calendar-day-edit-button"));
    await screen.findByTestId("day-log-delete-button");
    fireEvent.press(screen.getByTestId("day-log-delete-button"));

    expect(
      await screen.findByText("Unable to clear this entry. Please try again."),
    ).toBeTruthy();
  });

  it("shows a success status after marking a manual cycle start", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));
    await waitForSelectedDayPanel("Sat, Mar 14");
    await waitFor(() =>
      expect(screen.getByTestId("calendar-day-cycle-start-button")).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId("calendar-day-cycle-start-button"));

    await waitFor(() =>
      expect(storage.writeProfileRecord).toHaveBeenCalledWith(
        expect.objectContaining({ lastPeriodStart: "2026-03-14" }),
      ),
    );
    expect(
      await screen.findByText("Cycle start updated locally."),
    ).toBeTruthy();
  });

  it("cancels a manual cycle start when the owner declines the confirmation prompt", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));
    await waitForSelectedDayPanel("Sat, Mar 14");
    await waitFor(() =>
      expect(screen.getByTestId("calendar-day-cycle-start-button")).toBeTruthy(),
    );

    mockOpenConfirmation.mockResolvedValueOnce(false);
    fireEvent.press(screen.getByTestId("calendar-day-cycle-start-button"));

    await waitFor(() => expect(mockOpenConfirmation).toHaveBeenCalledTimes(1));
    expect(storage.writeProfileRecord).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastPeriodStart: "2026-03-14" }),
    );
  });

  it("shows an error status when marking a manual cycle start fails to persist", async () => {
    const storage = createStorageMock();
    storage.writeProfileRecord = jest.fn().mockRejectedValue(new Error("boom"));

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));
    await waitForSelectedDayPanel("Sat, Mar 14");
    await waitFor(() =>
      expect(screen.getByTestId("calendar-day-cycle-start-button")).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId("calendar-day-cycle-start-button"));

    expect(
      await screen.findByText(
        "Unable to mark a new cycle start. Please try again.",
      ),
    ).toBeTruthy();
  });

  it("suppresses predicted, fertile, and ovulation markers after a positive pregnancy test, while keeping the medical disclaimer", async () => {
    const storage = createStorageMock();
    storage.listDayLogRecordsInRange = jest.fn().mockResolvedValue([
      {
        ...createEmptyDayLogRecord("2026-03-11"),
        pregnancyTest: "positive",
      },
    ]);

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();

    // Without the pause this profile (last period 2026-03-10, 28-day cycle)
    // predicts ovulation around 2026-03-23 with a fertile window and
    // predicted-period days painted on the grid; a positive pregnancy test
    // must blank all of that instead of showing a stale prediction.
    // Scoped to the day buttons: the legend now carries an accessible name for
    // every state it explains, and the legend listing "Ovulation day" as a key
    // is not the same claim as a grid cell being painted with it.
    expect(
      screen.queryByRole("button", { name: /Ovulation day/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Predicted period/ }),
    ).toBeNull();
    expect(
      await screen.findByTestId("calendar-prediction-disclaimer"),
    ).toBeTruthy();
  });

  it("announces every actionable calendar control with a role, a name, and its state", async () => {
    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={createStorageMock()} />);

    await waitForCalendarReady();

    // The month title is the screen heading; month navigation and the day
    // cells are buttons, and the selected day says so.
    expect(screen.getAllByRole("header").length).toBeGreaterThan(0);
    expect(screen.getByTestId("calendar-prev-button").props.accessibilityRole).toBe(
      "button",
    );
    expect(screen.getByTestId("calendar-next-button").props.accessibilityRole).toBe(
      "button",
    );

    const selectedDay = screen.getByTestId("calendar-day-2026-03-17");
    expect(selectedDay.props.accessibilityRole).toBe("button");
    expect(selectedDay.props.accessibilityLabel).toBeTruthy();
    expect(selectedDay.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );

    // The legend explains the colour language of the grid, so each swatch is
    // announced with the state it stands for rather than as a bare box.
    expect(screen.getByLabelText("Logged period")).toBeTruthy();
    expect(screen.getByLabelText("Logged entry")).toBeTruthy();
  });

  it("reports the calendar-key toggle state on the narrow phone layout", async () => {
    // Under 430pt the month grid wins over an always-on legend, so the key
    // collapses behind a toggle. A collapsed disclosure that never says it is
    // collapsed leaves a screen-reader user unaware the key exists.
    jest.spyOn(Dimensions, "get").mockReturnValue({
      fontScale: 1,
      height: 844,
      scale: 3,
      width: 390,
    });

    try {
      render(
        <CalendarScreen now={new Date(2026, 2, 17)} storage={createStorageMock()} />,
      );

      await waitForCalendarReady();

      const toggle = screen.getByTestId("calendar-legend-toggle");
      expect(toggle.props.accessibilityRole).toBe("button");
      expect(toggle.props.accessibilityLabel).toBe("Show calendar key");
      expect(toggle.props.accessibilityState).toEqual(
        expect.objectContaining({ expanded: false }),
      );
      expect(screen.queryByTestId("calendar-legend-expanded")).toBeNull();

      fireEvent.press(toggle);

      const expandedToggle = screen.getByTestId("calendar-legend-toggle");
      expect(expandedToggle.props.accessibilityLabel).toBe("Hide calendar key");
      expect(expandedToggle.props.accessibilityState).toEqual(
        expect.objectContaining({ expanded: true }),
      );
      expect(screen.getByTestId("calendar-legend-expanded")).toBeTruthy();
    } finally {
      jest.restoreAllMocks();
    }
  });
});
