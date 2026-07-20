import { getDayLogCopy } from "../i18n/day-log-copy";
import { createEmptyDayLogRecord, type DayFlow, type DayLogRecord } from "../models/day-log";
import { createDefaultSymptomRecords, type SymptomRecord } from "../models/symptom";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  buildNextDayLogRecordPatch,
  loadDayLogEditorState,
  resolveBleedingSafetyHint,
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
      showLHTest: false,
      showNotes: true,
      showCycleFactors: true,
    });
    expect(state.viewData.labels.bbtHint).toContain("°F");
  });

  it("shows LH test controls only when advanced fertility premium is enabled", async () => {
    const state = await loadDayLogEditorState(
      createStorageMock(),
      "2026-03-17",
      "en",
      {
        showLHTests: true,
      },
    );

    expect(state.viewData.visibility.showLHTest).toBe(true);
    expect(state.viewData.options.lhTest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "negative", label: "Negative" }),
        expect.objectContaining({ value: "high", label: "High" }),
        expect.objectContaining({ value: "peak", label: "Peak" }),
      ]),
    );
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

  it("auto-fills the remaining period window when the first day is newly marked", async () => {
    const storage = createStorageMock({
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([]),
    });
    const record = buildNextDayLogRecordPatch(createEmptyDayLogRecord("2026-03-17"), {
      isPeriod: true,
    });

    const result = await saveDayLogEditorRecord(storage, record);

    expect(result).toEqual({
      ok: true,
      record: expect.objectContaining({
        date: "2026-03-17",
        isPeriod: true,
      }),
    });
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-18",
        isPeriod: true,
      }),
    );
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-21",
        isPeriod: true,
      }),
    );
  });

  it("does not auto-fill when the previous day is already a period day", async () => {
    const storage = createStorageMock({
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        {
          ...createEmptyDayLogRecord("2026-03-16"),
          isPeriod: true,
        },
      ]),
    });
    const record = buildNextDayLogRecordPatch(createEmptyDayLogRecord("2026-03-17"), {
      isPeriod: true,
    });

    await saveDayLogEditorRecord(storage, record);

    expect(storage.writeDayLogRecord).toHaveBeenCalledTimes(1);
    expect(storage.writeDayLogRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-03-17",
        isPeriod: true,
      }),
    );
  });

  it("clears bare auto-filled neighbors when toggling the anchor period day off", async () => {
    const storage = createStorageMock({
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        { ...createEmptyDayLogRecord("2026-03-16") },
        { ...createEmptyDayLogRecord("2026-03-17"), isPeriod: true },
        { ...createEmptyDayLogRecord("2026-03-18"), isPeriod: true },
        { ...createEmptyDayLogRecord("2026-03-19"), isPeriod: true },
        { ...createEmptyDayLogRecord("2026-03-20"), isPeriod: true },
        { ...createEmptyDayLogRecord("2026-03-21"), isPeriod: true },
      ]),
    });
    const record = buildNextDayLogRecordPatch(createEmptyDayLogRecord("2026-03-17"), {
      isPeriod: false,
    });

    await saveDayLogEditorRecord(storage, record);

    const writes = (storage.writeDayLogRecord as jest.Mock).mock.calls.map(
      ([written]) => ({ date: written.date, isPeriod: written.isPeriod }),
    );
    expect(writes).toEqual(
      expect.arrayContaining([
        { date: "2026-03-17", isPeriod: false },
        { date: "2026-03-18", isPeriod: false },
        { date: "2026-03-19", isPeriod: false },
        { date: "2026-03-20", isPeriod: false },
        { date: "2026-03-21", isPeriod: false },
      ]),
    );
  });

  it("preserves manual entries when clearing the anchor period day", async () => {
    const storage = createStorageMock({
      listDayLogRecordsInRange: jest.fn().mockResolvedValue([
        { ...createEmptyDayLogRecord("2026-03-16") },
        { ...createEmptyDayLogRecord("2026-03-17"), isPeriod: true },
        { ...createEmptyDayLogRecord("2026-03-18"), isPeriod: true },
        {
          ...createEmptyDayLogRecord("2026-03-19"),
          isPeriod: true,
          flow: "heavy",
        },
        { ...createEmptyDayLogRecord("2026-03-20"), isPeriod: true },
      ]),
    });
    const record = buildNextDayLogRecordPatch(createEmptyDayLogRecord("2026-03-17"), {
      isPeriod: false,
    });

    await saveDayLogEditorRecord(storage, record);

    const writes = (storage.writeDayLogRecord as jest.Mock).mock.calls.map(
      ([written]) => ({ date: written.date, isPeriod: written.isPeriod }),
    );
    expect(writes).toEqual(
      expect.arrayContaining([
        { date: "2026-03-17", isPeriod: false },
        { date: "2026-03-18", isPeriod: false },
      ]),
    );
    expect(writes).not.toEqual(
      expect.arrayContaining([{ date: "2026-03-19", isPeriod: false }]),
    );
    expect(writes).not.toEqual(
      expect.arrayContaining([{ date: "2026-03-20", isPeriod: false }]),
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

    const state = await loadDayLogEditorState(storage, "2026-03-17", "ru");

    expect(state.viewData.options.symptoms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "custom_jaw_pain", label: "Jaw pain" }),
        expect.objectContaining({ value: "custom_old", label: "Old symptom" }),
        expect.objectContaining({ value: "fatigue", label: "Усталость" }),
      ]),
    );
  });
});

describe("resolveBleedingSafetyHint", () => {
  function periodDay(date: string, flow: DayFlow): DayLogRecord {
    return { ...createEmptyDayLogRecord(date), isPeriod: true, flow };
  }

  it("stays silent on a non-period day regardless of flow history", () => {
    const history = [
      periodDay("2026-03-15", "heavy"),
      periodDay("2026-03-16", "heavy"),
    ];
    const record = createEmptyDayLogRecord("2026-03-17");

    expect(resolveBleedingSafetyHint(record, history)).toBeNull();
  });

  it("stays silent for a short heavy run below the sustained threshold", () => {
    const history = [periodDay("2026-03-16", "heavy")];
    const record = periodDay("2026-03-17", "heavy");

    // Only two consecutive heavy days, and a two-day bleeding run — neither the
    // sustained-heavy (>=3 days) nor the prolonged (>7 days) pattern.
    expect(resolveBleedingSafetyHint(record, history)).toBeNull();
  });

  it("surfaces the hint after several consecutive heavy-flow days", () => {
    const history = [
      periodDay("2026-03-15", "heavy"),
      periodDay("2026-03-16", "heavy"),
    ];
    const record = periodDay("2026-03-17", "heavy");

    expect(resolveBleedingSafetyHint(record, history)).toBe(
      getDayLogCopy("en").bleedingSafetyHint,
    );
  });

  it("surfaces the hint for prolonged bleeding even at a lighter flow", () => {
    const history = [
      periodDay("2026-03-10", "light"),
      periodDay("2026-03-11", "light"),
      periodDay("2026-03-12", "light"),
      periodDay("2026-03-13", "light"),
      periodDay("2026-03-14", "light"),
      periodDay("2026-03-15", "light"),
      periodDay("2026-03-16", "light"),
    ];
    const record = periodDay("2026-03-17", "light");

    // Eighth consecutive bleeding day — longer than ACOG's ~7-day guidance.
    expect(resolveBleedingSafetyHint(record, history)).toBe(
      getDayLogCopy("en").bleedingSafetyHint,
    );
  });

  it("uses the live record's flow over any persisted copy for the same day", () => {
    const history = [
      periodDay("2026-03-15", "heavy"),
      periodDay("2026-03-16", "heavy"),
      // Persisted copy of today still says "light"; the live edit wins.
      periodDay("2026-03-17", "light"),
    ];
    const liveRecord = periodDay("2026-03-17", "heavy");

    expect(resolveBleedingSafetyHint(liveRecord, history)).toBe(
      getDayLogCopy("en").bleedingSafetyHint,
    );
  });

  it("localizes the hint through the day-log copy catalog", () => {
    const history = [
      periodDay("2026-03-15", "heavy"),
      periodDay("2026-03-16", "heavy"),
    ];
    const record = periodDay("2026-03-17", "heavy");

    expect(resolveBleedingSafetyHint(record, history, "ru")).toBe(
      getDayLogCopy("ru").bleedingSafetyHint,
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
      hideNotes: false,
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
