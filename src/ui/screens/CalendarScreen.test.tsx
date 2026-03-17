import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import { createDefaultSymptomRecords } from "../../models/symptom";
import { createLocalAppStorageMock } from "../../test/create-local-app-storage-mock";
import { CalendarScreen } from "./CalendarScreen";

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

    await screen.findByText("Calendar");

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

    await screen.findByText("Calendar");
    fireEvent.press(screen.getByTestId("calendar-day-2026-03-14"));

    await screen.findByText("Jaw pain");
    expect(screen.getByText("Old symptom")).toBeTruthy();
  });
});
