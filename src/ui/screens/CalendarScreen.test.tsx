import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { createEmptyDayLogRecord } from "../../models/day-log";
import type { LocalAppStorage } from "../../storage/local/storage-contract";
import { CalendarScreen } from "./CalendarScreen";

function createStorageMock(): LocalAppStorage {
  return {
    readBootstrapState: jest.fn().mockResolvedValue({
      hasCompletedOnboarding: true,
      profileVersion: 2,
    }),
    writeBootstrapState: jest.fn().mockResolvedValue(undefined),
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
    writeProfileRecord: jest.fn().mockResolvedValue(undefined),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    writeOnboardingRecord: jest.fn().mockResolvedValue(undefined),
    readDayLogRecord: jest.fn().mockImplementation(async (date: string) => {
      if (date === "2026-03-14") {
        return {
          ...createEmptyDayLogRecord(date),
          mood: 4,
        };
      }

      return createEmptyDayLogRecord(date);
    }),
    writeDayLogRecord: jest.fn().mockResolvedValue(undefined),
    deleteDayLogRecord: jest.fn().mockResolvedValue(undefined),
    listDayLogRecordsInRange: jest.fn().mockResolvedValue([
      {
        ...createEmptyDayLogRecord("2026-03-14"),
        mood: 4,
      },
    ]),
  };
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
});
