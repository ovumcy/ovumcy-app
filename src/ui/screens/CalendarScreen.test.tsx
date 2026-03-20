import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultSymptomRecords } from "../../models/symptom";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { CalendarScreen } from "./CalendarScreen";

const mockUseEffect = React.useEffect;

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
  };
});

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

describe("CalendarScreen", () => {
  it("loads a selected day through the shared local repository", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("calendar-prev-button");

    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));

    await waitFor(() =>
      expect(storage.readDayLogRecord).toHaveBeenCalledWith("2026-03-14"),
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

    await screen.findByTestId("calendar-prev-button");
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));

    await screen.findByTestId("calendar-day-panel");
    expect(screen.getByText("Old symptom")).toBeTruthy();

    fireEvent.press(screen.getByTestId("calendar-day-edit-button"));

    await screen.findByTestId("day-log-save-button");
    expect(screen.getByText("Old symptom")).toBeTruthy();
    fireEvent.press(screen.getByTestId("day-log-more-symptoms-button"));
    expect(screen.getByText("Jaw pain")).toBeTruthy();
  });

  it("keeps existing days in summary mode until edit is requested and shows manual cycle start", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("calendar-prev-button");
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));

    await screen.findByTestId("calendar-day-panel");
    expect(screen.getByTestId("calendar-day-edit-button")).toBeTruthy();
    expect(screen.getByTestId("calendar-day-cycle-start-button")).toBeTruthy();
    expect(screen.queryByTestId("day-log-save-button")).toBeNull();
  });

  it("keeps empty days in summary mode until add entry is requested", async () => {
    const storage = createStorageMock();

    render(<CalendarScreen now={new Date(2026, 2, 17)} storage={storage} />);

    await screen.findByTestId("calendar-prev-button");
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-13"));

    await screen.findByTestId("calendar-day-panel");
    expect(screen.getByTestId("calendar-day-add-button")).toBeTruthy();
    expect(screen.getByTestId("calendar-day-cycle-start-button")).toBeTruthy();
    expect(screen.queryByTestId("day-log-save-button")).toBeNull();
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

    await screen.findByTestId("calendar-prev-button");
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
});
