import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultSymptomRecords, type SymptomRecord } from "../models/symptom";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  buildNextDayLogRecordPatch,
  loadDayLogEditorState,
  saveDayLogEditorRecord,
} from "./day-log-editor-service";

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

  it("shows custom symptoms for new entries and keeps selected archived symptoms available", async () => {
    const customSymptom: SymptomRecord = {
      id: "custom_jaw_pain",
      slug: "jaw-pain",
      label: "Jaw pain",
      icon: "🔥",
      color: "#E8799F",
      isArchived: false,
      sortOrder: 999,
      isDefault: false,
    };
    const archivedSymptom: SymptomRecord = {
      ...customSymptom,
      id: "custom_old",
      slug: "old-symptom",
      label: "Old symptom",
      isArchived: true,
      sortOrder: 1000,
    };
    const storage = createStorageMock({
      listSymptomRecords: jest
        .fn()
        .mockResolvedValue([
          ...createDefaultSymptomRecords(),
          customSymptom,
          archivedSymptom,
        ]),
      readDayLogRecord: jest.fn().mockResolvedValue({
        ...createEmptyDayLogRecord("2026-03-17"),
        symptomIDs: ["custom_old", "fatigue"],
      }),
    });

    const state = await loadDayLogEditorState(storage, "2026-03-17");

    expect(state.viewData.options.symptoms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "custom_jaw_pain", label: "Jaw pain" }),
        expect.objectContaining({ value: "custom_old", label: "Old symptom" }),
        expect.objectContaining({ value: "fatigue", label: "Fatigue" }),
      ]),
    );
  });
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
      trackCervicalMucus: false,
      hideSexChip: true,
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
    readDayLogRecord: jest
      .fn()
      .mockImplementation(async (date: string) => createEmptyDayLogRecord(date)),
    ...overrides,
  });
}
