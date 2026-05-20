import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultSymptomRecords } from "../../models/symptom";
import { loadManagedPremiumFeaturesForCurrentSession } from "../../services/managed-premium-features-service";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { createVolatileWebAppStorage } from "../../storage/local/volatile-web-app-storage";
import { openConfirmation } from "../confirm/open-confirmation";
import { CalendarScreen } from "./CalendarScreen";

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
      bbt: 36.32,
      cervicalMucus: "eggwhite" as const,
      lhTest: "peak" as const,
      pregnancyTest: "none" as const,
    },
    {
      ...createEmptyDayLogRecord("2026-03-31"),
      bbt: 36.34,
    },
    {
      ...createEmptyDayLogRecord("2026-04-01"),
      bbt: 36.57,
    },
    {
      ...createEmptyDayLogRecord("2026-04-02"),
      bbt: 36.6,
    },
    {
      ...createEmptyDayLogRecord("2026-04-03"),
      bbt: 36.63,
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

  it("moves the selected-day panel to the new month anchor when month navigation changes", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await waitForCalendarReady();

    fireEvent.press(screen.getByTestId("calendar-prev-button"));

    await waitFor(() =>
      expect(storage.readDayLogRecord).toHaveBeenCalledWith("2026-02-01"),
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

    render(<CalendarScreen now={new Date(2026, 3, 3)} storage={storage} />);

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
  });
});
