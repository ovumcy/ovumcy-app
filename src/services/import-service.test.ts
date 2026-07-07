import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords, type SymptomRecord } from "../models/symptom";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import type { ExportBackupEnvelope } from "../models/export";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  importBackupEnvelope,
  parseImportEnvelope,
  restoreFromJSONBackup,
} from "./import-service";

// A stateful in-memory storage so writes are observable through reads, letting
// the merge/skip semantics be asserted round-trip.
function createStatefulStorage(): {
  storage: LocalAppStorage;
  dayLogs: Map<string, DayLogRecord>;
  symptoms: SymptomRecord[];
} {
  const dayLogs = new Map<string, DayLogRecord>();
  const symptoms: SymptomRecord[] = createDefaultSymptomRecords();

  const storage = createLocalAppStorageMock({
    readDayLogRecord: jest.fn(async (date: string) =>
      dayLogs.get(date) ?? createEmptyDayLogRecord(date),
    ),
    writeDayLogRecord: jest.fn(async (record: DayLogRecord) => {
      dayLogs.set(record.date, record);
    }),
    listSymptomRecords: jest.fn(async () => symptoms),
    writeSymptomRecord: jest.fn(async (record: SymptomRecord) => {
      symptoms.push(record);
    }),
  });

  return { storage, dayLogs, symptoms };
}

function envelope(
  overrides: Partial<ExportBackupEnvelope> = {},
): ExportBackupEnvelope {
  return {
    app: "ovumcy",
    formatVersion: 1,
    exportedAt: "2026-03-18T10:00:00.000Z",
    preset: "all",
    range: { fromDate: null, toDate: null },
    summary: { totalEntries: 0, hasData: false, dateFrom: null, dateTo: null },
    profile: createDefaultProfileRecord(),
    symptoms: [],
    dayLogs: [],
    ...overrides,
  } as ExportBackupEnvelope;
}

function dayLog(date: string, overrides: Partial<DayLogRecord> = {}): DayLogRecord {
  return { ...createEmptyDayLogRecord(date), ...overrides, date };
}

describe("import-service parse", () => {
  it("rejects non-JSON as malformed", () => {
    expect(parseImportEnvelope("{not json")).toEqual({
      ok: false,
      errorCode: "malformed",
    });
  });

  it("rejects a JSON payload that is not an object", () => {
    expect(parseImportEnvelope("[]")).toEqual({
      ok: false,
      errorCode: "malformed",
    });
    expect(parseImportEnvelope("42")).toEqual({
      ok: false,
      errorCode: "malformed",
    });
  });

  it("rejects a foreign or wrong-version envelope", () => {
    expect(
      parseImportEnvelope(JSON.stringify({ app: "other", formatVersion: 1 })),
    ).toEqual({ ok: false, errorCode: "unrecognized_format" });
    expect(
      parseImportEnvelope(JSON.stringify({ app: "ovumcy", formatVersion: 2 })),
    ).toEqual({ ok: false, errorCode: "unrecognized_format" });
  });

  it("rejects an oversized payload", () => {
    const huge = {
      app: "ovumcy",
      formatVersion: 1,
      dayLogs: new Array(20001).fill({ date: "2026-01-01" }),
    };
    expect(parseImportEnvelope(JSON.stringify(huge))).toEqual({
      ok: false,
      errorCode: "too_large",
    });
  });

  it("accepts a well-formed envelope and defaults missing collections", () => {
    const result = parseImportEnvelope(
      JSON.stringify({ app: "ovumcy", formatVersion: 1 }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.dayLogs).toEqual([]);
      expect(result.envelope.symptoms).toEqual([]);
    }
  });
});

describe("import-service apply (additive merge)", () => {
  it("imports day logs onto empty dates", async () => {
    const { storage, dayLogs } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        dayLogs: [
          dayLog("2026-03-10", { isPeriod: true, flow: "medium" }),
          dayLog("2026-03-12", { mood: 4, notes: "ok" }),
        ],
      }),
    );

    expect(outcome).toMatchObject({
      dayLogsAdded: 2,
      dayLogsSkipped: 0,
      dayLogsRejected: 0,
    });
    expect(dayLogs.get("2026-03-10")).toMatchObject({
      isPeriod: true,
      flow: "medium",
    });
    expect(dayLogs.get("2026-03-12")).toMatchObject({ mood: 4, notes: "ok" });
  });

  it("never overwrites a date that already has data", async () => {
    const { storage, dayLogs } = createStatefulStorage();
    dayLogs.set(
      "2026-03-10",
      dayLog("2026-03-10", { notes: "original, keep me" }),
    );

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        dayLogs: [dayLog("2026-03-10", { notes: "incoming, drop me" })],
      }),
    );

    expect(outcome).toMatchObject({ dayLogsAdded: 0, dayLogsSkipped: 1 });
    expect(dayLogs.get("2026-03-10")?.notes).toBe("original, keep me");
  });

  it("rejects records with an unparseable date and keeps going", async () => {
    const { storage, dayLogs } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        dayLogs: [
          dayLog("not-a-date", { notes: "bad" }),
          dayLog("2026-13-40", { notes: "also bad" }),
          dayLog("2026-03-15", { mood: 2 }),
        ],
      }),
    );

    expect(outcome).toMatchObject({ dayLogsAdded: 1, dayLogsRejected: 2 });
    expect(dayLogs.has("2026-03-15")).toBe(true);
  });

  it("collapses unknown enum values to neutral defaults rather than failing", async () => {
    const { storage, dayLogs } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        dayLogs: [
          dayLog("2026-03-16", {
            // Deliberately invalid enum values.
            flow: "torrential" as never,
            cervicalMucus: "unknown" as never,
            mood: 3,
          }),
        ],
      }),
    );

    expect(outcome).toMatchObject({ dayLogsAdded: 1 });
    const stored = dayLogs.get("2026-03-16");
    expect(stored?.cervicalMucus).toBe("none");
    // flow is only kept when isPeriod; here it stays neutral.
    expect(stored?.flow).toBe("none");
    expect(stored?.mood).toBe(3);
  });

  it("imports new custom symptoms and skips ones that already exist", async () => {
    const { storage, symptoms } = createStatefulStorage();
    const before = symptoms.length;

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        symptoms: [
          {
            id: "custom_a",
            slug: "jaw-pain",
            label: "Jaw pain",
            icon: "🔥",
            color: "#E8799F",
            isArchived: false,
            sortOrder: 900,
            isDefault: false,
          },
          {
            // Built-in: must not be duplicated.
            id: "cramps",
            slug: "cramps",
            label: "Cramps",
            icon: "🩸",
            color: "#E8799F",
            isArchived: false,
            sortOrder: 0,
            isDefault: true,
          },
        ],
      }),
    );

    expect(outcome.symptomsAdded).toBe(1);
    expect(symptoms.length).toBe(before + 1);
    expect(symptoms.some((record) => record.label === "Jaw pain")).toBe(true);
  });
});

describe("restoreFromJSONBackup orchestration", () => {
  it("parses then applies in one call", async () => {
    const { storage, dayLogs } = createStatefulStorage();
    const raw = JSON.stringify(
      envelope({ dayLogs: [dayLog("2026-03-20", { mood: 5 })] }),
    );

    const result = await restoreFromJSONBackup(storage, raw);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome.dayLogsAdded).toBe(1);
    }
    expect(dayLogs.has("2026-03-20")).toBe(true);
  });

  it("surfaces a parse error without touching storage", async () => {
    const { storage, dayLogs } = createStatefulStorage();

    const result = await restoreFromJSONBackup(storage, "{broken");

    expect(result).toEqual({ ok: false, errorCode: "malformed" });
    expect(dayLogs.size).toBe(0);
  });
});
