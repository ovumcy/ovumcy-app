import { createEmptyDayLogRecord } from "../models/day-log";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildNextDayLogRecordPatch,
  loadDayLogEditorState,
  saveDayLogEditorRecord,
} from "./day-log-editor-service";

function createStorageMock(overrides?: Partial<LocalAppStorage>): LocalAppStorage {
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
      trackBBT: true,
      temperatureUnit: "f",
      trackCervicalMucus: false,
      hideSexChip: true,
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
    readDayLogRecord: jest
      .fn()
      .mockImplementation(async (date: string) => createEmptyDayLogRecord(date)),
    writeDayLogRecord: jest.fn().mockResolvedValue(undefined),
    deleteDayLogRecord: jest.fn().mockResolvedValue(undefined),
    listDayLogRecordsInRange: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("day-log-editor-service", () => {
  it("loads visibility and unit-aware hints from the canonical profile", async () => {
    const state = await loadDayLogEditorState(
      createStorageMock(),
      "2026-03-17",
    );

    expect(state.viewData.visibility).toEqual({
      showSexActivity: false,
      showBBT: true,
      showCervicalMucus: false,
    });
    expect(state.viewData.labels.bbtHint).toContain("°F");
  });

  it("normalizes day log patches before persisting", async () => {
    const storage = createStorageMock();
    const record = buildNextDayLogRecordPatch(createEmptyDayLogRecord("2026-03-17"), {
      isPeriod: false,
      flow: "heavy",
      notes: "  note  ",
    });

    const result = await saveDayLogEditorRecord(storage, record);

    expect(result).toEqual({
      ok: true,
      record: expect.objectContaining({
        isPeriod: false,
        flow: "none",
        notes: "note",
      }),
    });
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: "none",
        notes: "note",
      }),
    );
  });
});
