import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import {
  buildLocalExportArtifact,
  loadLocalExportState,
} from "./export-service";

describe("export-service", () => {
  it("loads export state from canonical local day-log summaries", async () => {
    const storage = createStorageMock();

    const result = await loadLocalExportState(storage, new Date(2026, 2, 18));

    expect(result.errorCode).toBeNull();
    expect(result.state).toEqual(
      expect.objectContaining({
        values: {
          preset: "all",
          fromDate: "2026-03-01",
          toDate: "2026-03-18",
        },
        summary: expect.objectContaining({
          totalEntries: 2,
        }),
      }),
    );
  });

  it("builds a JSON backup envelope from profile, symptoms, and day logs", async () => {
    const storage = createStorageMock();
    const loaded = await loadLocalExportState(storage, new Date(2026, 2, 18));
    if (loaded.errorCode) {
      throw new Error(`unexpected export error ${loaded.errorCode}`);
    }

    const result = await buildLocalExportArtifact(
      storage,
      loaded.state,
      "json",
      new Date("2026-03-18T10:00:00.000Z"),
    );

    expect(result).toEqual({
      ok: true,
      state: expect.any(Object),
      artifact: expect.objectContaining({
        filename: "ovumcy-export-2026-03-18.json",
        mimeType: "application/json",
      }),
    });
    if (!result.ok) {
      throw new Error("expected a JSON artifact");
    }
    if (typeof result.artifact.content !== "string") {
      throw new Error("expected JSON export content to stay text");
    }

    const payload = JSON.parse(result.artifact.content);
    expect(payload).toEqual(
      expect.objectContaining({
        app: "ovumcy",
        formatVersion: 1,
        range: {
          fromDate: "2026-03-01",
          toDate: "2026-03-18",
        },
        summary: expect.objectContaining({
          totalEntries: 2,
        }),
        dayLogs: expect.arrayContaining([
          expect.objectContaining({ date: "2026-03-01", notes: "Cycle start" }),
          expect.objectContaining({ date: "2026-03-18", notes: "Jaw pain" }),
        ]),
      }),
    );
  });

  it("serializes a CSV export with mapped builtin symptoms and custom symptoms in Other", async () => {
    const storage = createStorageMock();
    const loaded = await loadLocalExportState(storage, new Date(2026, 2, 18));
    if (loaded.errorCode) {
      throw new Error(`unexpected export error ${loaded.errorCode}`);
    }

    const result = await buildLocalExportArtifact(
      storage,
      loaded.state,
      "csv",
      new Date("2026-03-18T10:00:00.000Z"),
    );

    if (!result.ok) {
      throw new Error("expected a CSV artifact");
    }

    expect(result.artifact.filename).toBe("ovumcy-export-2026-03-18.csv");
    expect(result.artifact.content).toContain("Date,Period,Flow,Mood rating");
    expect(result.artifact.content).toContain("2026-03-18");
    expect(result.artifact.content).toContain("Jaw pain");
    expect(result.artifact.content).toContain("Yes");
  });

  it("builds a PDF artifact through the shared PDF content builder", async () => {
    const storage = createStorageMock();
    const loaded = await loadLocalExportState(storage, new Date(2026, 2, 18));
    if (loaded.errorCode) {
      throw new Error(`unexpected export error ${loaded.errorCode}`);
    }

    const result = await buildLocalExportArtifact(
      storage,
      loaded.state,
      "pdf",
      new Date("2026-03-18T10:00:00.000Z"),
      {
        buildPDFContent: jest
          .fn()
          .mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46])),
      },
    );

    if (!result.ok) {
      throw new Error("expected a PDF artifact");
    }

    expect(result.artifact).toEqual({
      filename: "ovumcy-export-2026-03-18.pdf",
      mimeType: "application/pdf",
      content: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    });
  });
});

function createStorageMock() {
  const defaultSymptoms = createDefaultSymptomRecords();
  const customSymptom = {
    id: "custom_jaw_pain",
    slug: "jaw-pain",
    label: "Jaw pain",
    icon: "🔥",
    color: "#E8799F",
    isArchived: false,
    sortOrder: 999,
    isDefault: false,
  } as const;
  const dayLogs = [
    {
      ...createEmptyDayLogRecord("2026-03-01"),
      isPeriod: true,
      cycleStart: true,
      flow: "medium" as const,
      notes: "Cycle start",
      symptomIDs: ["cramps"],
    },
    {
      ...createEmptyDayLogRecord("2026-03-18"),
      notes: "Jaw pain",
      symptomIDs: ["custom_jaw_pain", "fatigue"],
    },
  ];

  return createLocalAppStorageMock({
    readProfileRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-01",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: true,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
    }),
    listSymptomRecords: jest
      .fn()
      .mockResolvedValue([...defaultSymptoms, customSymptom]),
    listDayLogRecordsInRange: jest.fn().mockResolvedValue(dayLogs),
    readDayLogSummary: jest.fn().mockImplementation(async (from?: string, to?: string) => {
      const filtered = dayLogs.filter((record) => {
        if (from && record.date < from) {
          return false;
        }
        if (to && record.date > to) {
          return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        return {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        };
      }

      const firstRecord = filtered[0];
      const lastRecord = filtered[filtered.length - 1];
      if (!firstRecord || !lastRecord) {
        return {
          totalEntries: 0,
          hasData: false,
          dateFrom: null,
          dateTo: null,
        };
      }

      return {
        totalEntries: filtered.length,
        hasData: true,
        dateFrom: firstRecord.date,
        dateTo: lastRecord.date,
      };
    }),
  });
}
