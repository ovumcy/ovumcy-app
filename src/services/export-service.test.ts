import { createEmptyDayLogRecord, type DayCycleFactorKey } from "../models/day-log";
import type {
  ContractionSession,
  KickCountSession,
  PregnancyRecord,
} from "../models/pregnancy";
import type { PostpartumRecord } from "../models/postpartum";
import type { ScreeningResponse } from "../models/screening";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildLocalExportArtifact,
  buildExportCSVRows,
  EXPORT_CSV_HEADERS,
  loadLocalExportState,
  serializeExportCSV,
} from "./export-service";

function pregnancyRecordFixture(
  overrides: Partial<PregnancyRecord> = {},
): PregnancyRecord {
  return {
    id: "pregnancy_export_test",
    status: "active",
    edd: "2026-10-01",
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    schedulePreset: "who2016",
    startedAt: "2026-01-01",
    endedAt: null,
    endReason: null,
    modeOfDelivery: null,
    ...overrides,
  };
}

function kickSessionFixture(
  overrides: Partial<KickCountSession> = {},
): KickCountSession {
  return {
    id: "kick_export_test",
    date: "2026-03-18",
    durationMinutes: 20,
    kickCount: 12,
    ...overrides,
  };
}

function contractionSessionFixture(
  overrides: Partial<ContractionSession> = {},
): ContractionSession {
  return {
    id: "contraction_export_test",
    date: "2026-03-18",
    startedAt: "2026-03-18T10:00:00.000Z",
    contractions: [],
    ...overrides,
  };
}

function postpartumRecordFixture(
  overrides: Partial<PostpartumRecord> = {},
): PostpartumRecord {
  return {
    id: "postpartum_export_test",
    status: "active",
    startedAt: "2026-03-10",
    modeOfDelivery: "vaginal",
    endedAt: null,
    endReason: null,
    ...overrides,
  };
}

function screeningResponseFixture(
  overrides: Partial<ScreeningResponse> = {},
): ScreeningResponse {
  return {
    id: "screening_export_test",
    date: "2026-03-12",
    instrument: "epds",
    answers: [1, 0, 2, 1, 0, 1, 0, 2, 1, 0],
    score: 8,
    selfHarmFlag: false,
    ...overrides,
  };
}

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
        formatVersion: 3,
        range: {
          fromDate: "2026-03-01",
          toDate: "2026-03-18",
        },
        summary: expect.objectContaining({
          totalEntries: 2,
        }),
        dayLogs: expect.arrayContaining([
          expect.objectContaining({ date: "2026-03-01", notes: "Cycle start" }),
          expect.objectContaining({
            date: "2026-03-18",
            notes: "Jaw pain",
            lhTest: "peak",
            pregnancyTest: "none",
          }),
        ]),
        // A v3 envelope always carries all five additive collections,
        // even when empty (this fixture has no pregnancy/postpartum/screening).
        pregnancies: [],
        kickSessions: [],
        contractionSessions: [],
        postpartumRecords: [],
        screeningResponses: [],
      }),
    );
  });

  it("includes pregnancy records, kick sessions, and contraction sessions in the v2 JSON envelope", async () => {
    const pregnancy = pregnancyRecordFixture({ id: "p1" });
    const kick = kickSessionFixture({ id: "k1" });
    const contraction = contractionSessionFixture({ id: "c1" });
    const storage = createStorageMock({
      listPregnancyRecords: jest.fn().mockResolvedValue([pregnancy]),
      listKickSessions: jest.fn().mockResolvedValue([kick]),
      listContractionSessions: jest.fn().mockResolvedValue([contraction]),
    });
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
    if (!result.ok || typeof result.artifact.content !== "string") {
      throw new Error("expected a JSON artifact");
    }

    const payload = JSON.parse(result.artifact.content);
    expect(payload.pregnancies).toEqual([pregnancy]);
    expect(payload.kickSessions).toEqual([kick]);
    expect(payload.contractionSessions).toEqual([contraction]);
    // Pregnancy records are episodic, not date-ranged like dayLogs: the
    // fetch takes no from/to arguments at all.
    expect(storage.listPregnancyRecords).toHaveBeenCalledWith();
  });

  it("includes postpartum records (un-ranged) and screening responses (ranged by date) in the v3 JSON envelope", async () => {
    // A postpartum record whose birth date sits OUTSIDE the export window still
    // exports (episodic, un-ranged like pregnancies). A screening response
    // inside the window exports; one outside it is filtered out (ranged like
    // sessions).
    const postpartum = postpartumRecordFixture({ id: "pp1", startedAt: "2025-11-01" });
    const inRangeScreening = screeningResponseFixture({ id: "sc-in", date: "2026-03-10" });
    const outOfRangeScreening = screeningResponseFixture({ id: "sc-out", date: "2020-01-01" });
    const storage = createStorageMock({
      listPostpartumRecords: jest.fn().mockResolvedValue([postpartum]),
      listScreeningResponses: jest
        .fn()
        .mockResolvedValue([inRangeScreening, outOfRangeScreening]),
    });
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
    if (!result.ok || typeof result.artifact.content !== "string") {
      throw new Error("expected a JSON artifact");
    }

    const payload = JSON.parse(result.artifact.content);
    expect(payload.formatVersion).toBe(3);
    // Postpartum: full snapshot regardless of range, fetched with no from/to.
    expect(payload.postpartumRecords).toEqual([postpartum]);
    expect(storage.listPostpartumRecords).toHaveBeenCalledWith();
    // Screening: only the in-range response survives the date filter.
    expect(payload.screeningResponses).toEqual([inRangeScreening]);
  });

  it("does not fetch postpartum or screening collections when building a CSV artifact (JSON-only)", async () => {
    const storage = createStorageMock({
      listPostpartumRecords: jest
        .fn()
        .mockResolvedValue([postpartumRecordFixture()]),
      listScreeningResponses: jest
        .fn()
        .mockResolvedValue([screeningResponseFixture()]),
    });
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
    if (!result.ok || typeof result.artifact.content !== "string") {
      throw new Error("expected a CSV artifact");
    }

    // CSV is unchanged by v3: no postpartum/screening columns, and their repos
    // are never even read for the CSV format.
    expect(storage.listPostpartumRecords).not.toHaveBeenCalled();
    expect(storage.listScreeningResponses).not.toHaveBeenCalled();
    expect(result.artifact.content).not.toContain("Postpartum");
    expect(result.artifact.content).not.toContain("Check-in");
    expect(result.artifact.content).not.toContain("EPDS");
  });

  it("does not fetch pregnancy-mode collections when building a PDF artifact (pregnancy sections out of v1 PDF scope)", async () => {
    const storage = createStorageMock({
      listPregnancyRecords: jest.fn().mockResolvedValue([pregnancyRecordFixture()]),
      listKickSessions: jest.fn().mockResolvedValue([kickSessionFixture()]),
      listContractionSessions: jest
        .fn()
        .mockResolvedValue([contractionSessionFixture()]),
    });
    const loaded = await loadLocalExportState(storage, new Date(2026, 2, 18));
    if (loaded.errorCode) {
      throw new Error(`unexpected export error ${loaded.errorCode}`);
    }

    const result = await buildLocalExportArtifact(
      storage,
      loaded.state,
      "pdf",
      new Date("2026-03-18T10:00:00.000Z"),
      { buildPDFContent: jest.fn().mockResolvedValue(new Uint8Array([0x25])) },
    );

    expect(result.ok).toBe(true);
    expect(storage.listPregnancyRecords).not.toHaveBeenCalled();
    expect(storage.listKickSessions).not.toHaveBeenCalled();
    expect(storage.listContractionSessions).not.toHaveBeenCalled();
  });

  it("never reads the managed billing snapshot, and exports full pregnancy data regardless of premium/plan state", async () => {
    // createLocalAppStorageMock's default readManagedBillingCacheRecord
    // already resolves to a no-active-plan ("locked") snapshot; the point of
    // this test is that buildLocalExportArtifact never even calls it.
    const storage = createStorageMock({
      listPregnancyRecords: jest
        .fn()
        .mockResolvedValue([pregnancyRecordFixture({ id: "p1" })]),
      listKickSessions: jest
        .fn()
        .mockResolvedValue([kickSessionFixture({ id: "k1" })]),
      listContractionSessions: jest
        .fn()
        .mockResolvedValue([contractionSessionFixture({ id: "c1" })]),
    });
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
    if (!result.ok || typeof result.artifact.content !== "string") {
      throw new Error("expected a JSON artifact");
    }

    const payload = JSON.parse(result.artifact.content);
    expect(payload.pregnancies).toHaveLength(1);
    expect(payload.kickSessions).toHaveLength(1);
    expect(payload.contractionSessions).toHaveLength(1);
    expect(storage.readManagedBillingCacheRecord).not.toHaveBeenCalled();
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
    expect(result.artifact.content).toContain("LH test");
    expect(result.artifact.content).toContain("2026-03-18");
    expect(result.artifact.content).toContain("Jaw pain");
    expect(result.artifact.content).toContain("peak");
    expect(result.artifact.content).toContain("Yes");
  });

  it("adds weight, blood pressure, and kick-count columns to the CSV export, blank when absent", async () => {
    const dayLogs = [
      {
        ...createEmptyDayLogRecord("2026-03-05"),
        weightKg: 62.5,
        bpSystolic: 118,
        bpDiastolic: 76,
      },
      // No weight/BP logged, and no kick session on this date either.
      { ...createEmptyDayLogRecord("2026-03-06") },
    ];
    const storage = createStorageMock({
      listDayLogRecordsInRange: jest.fn().mockResolvedValue(dayLogs),
      readDayLogSummary: jest.fn().mockResolvedValue({
        totalEntries: 2,
        hasData: true,
        dateFrom: "2026-03-05",
        dateTo: "2026-03-06",
      }),
      // Two sessions on the same date -- kickCount must be their SUM (5 + 3).
      listKickSessions: jest.fn().mockResolvedValue([
        kickSessionFixture({ id: "k1", date: "2026-03-05", kickCount: 5 }),
        kickSessionFixture({ id: "k2", date: "2026-03-05", kickCount: 3 }),
      ]),
    });
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
    if (!result.ok || typeof result.artifact.content !== "string") {
      throw new Error("expected a CSV artifact");
    }

    const lines: string[] = result.artifact.content.trim().split("\n");
    expect(lines[0]).toContain("Weight (kg),BP systolic (mmHg),BP diastolic (mmHg),Kick count");

    // Fixture rows have no commas/quotes in any field, so a plain split is
    // safe here; check only the last 4 (new) columns of each row.
    const loggedFields = (lines.find((line: string) => line.startsWith("2026-03-05,")) ?? "").split(",");
    const unloggedFields = (lines.find((line: string) => line.startsWith("2026-03-06,")) ?? "").split(",");

    // Two kick sessions on 2026-03-05 (5 + 3) sum to 8.
    expect(loggedFields.slice(-4)).toEqual(["62.5", "118", "76", "8"]);
    expect(unloggedFields.slice(-4)).toEqual(["", "", "", ""]);
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

  // Threads activePregnancy into the PDF content builder as the
  // additive suppressPredictions option (mirrors stats/calendar's X14
  // loadStatsScreenState pattern), so export-pdf-service can drop phantom
  // current-cycle fertility signals while an active pregnancy is tracked.
  it("threads suppressPredictions: true into the PDF content builder when an active pregnancy record exists", async () => {
    const storage = createStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(pregnancyRecordFixture()),
    });
    const loaded = await loadLocalExportState(storage, new Date(2026, 2, 18));
    if (loaded.errorCode) {
      throw new Error(`unexpected export error ${loaded.errorCode}`);
    }

    const buildPDFContent = jest.fn().mockResolvedValue(new Uint8Array([0x25]));
    const result = await buildLocalExportArtifact(
      storage,
      loaded.state,
      "pdf",
      new Date("2026-03-18T10:00:00.000Z"),
      { buildPDFContent },
    );

    expect(result.ok).toBe(true);
    expect(storage.readActivePregnancy).toHaveBeenCalled();
    expect(buildPDFContent).toHaveBeenCalledWith(
      expect.objectContaining({ suppressPredictions: true }),
    );
  });

  it("threads suppressPredictions: false into the PDF content builder when there is no active pregnancy record (regression)", async () => {
    // createLocalAppStorageMock's default readActivePregnancy already
    // resolves null; this pins that the PDF path keeps today's unsuppressed
    // behavior when no pregnancy is being tracked.
    const storage = createStorageMock();
    const loaded = await loadLocalExportState(storage, new Date(2026, 2, 18));
    if (loaded.errorCode) {
      throw new Error(`unexpected export error ${loaded.errorCode}`);
    }

    const buildPDFContent = jest.fn().mockResolvedValue(new Uint8Array([0x25]));
    const result = await buildLocalExportArtifact(
      storage,
      loaded.state,
      "pdf",
      new Date("2026-03-18T10:00:00.000Z"),
      { buildPDFContent },
    );

    expect(result.ok).toBe(true);
    expect(buildPDFContent).toHaveBeenCalledWith(
      expect.objectContaining({ suppressPredictions: false }),
    );
  });

  it("never reads the active-pregnancy record for CSV/JSON exports (PDF-only signal)", async () => {
    const storage = createStorageMock({
      readActivePregnancy: jest.fn().mockResolvedValue(pregnancyRecordFixture()),
    });
    const loaded = await loadLocalExportState(storage, new Date(2026, 2, 18));
    if (loaded.errorCode) {
      throw new Error(`unexpected export error ${loaded.errorCode}`);
    }

    await buildLocalExportArtifact(
      storage,
      loaded.state,
      "csv",
      new Date("2026-03-18T10:00:00.000Z"),
    );
    await buildLocalExportArtifact(
      storage,
      loaded.state,
      "json",
      new Date("2026-03-18T10:00:00.000Z"),
    );

    expect(storage.readActivePregnancy).not.toHaveBeenCalled();
  });
});

describe("CSV completeness: pregnancy test, cycle start, uncertain", () => {
  const range = {
    preset: "all",
    fromDate: "2026-03-01",
    toDate: "2026-03-02",
  } as const;

  it("keeps the ovumcy-web parity columns contiguous, then the app-only metric columns", () => {
    // The web trio must stay in web's order and position (immediately after
    // the shared columns); the pregnancy-mode metrics are app-only and always
    // append AFTER them, so a positional CSV consumer of the shared prefix
    // never shifts.
    expect(EXPORT_CSV_HEADERS.slice(-7)).toEqual([
      "Pregnancy test",
      "Cycle start",
      "Uncertain",
      "Weight (kg)",
      "BP systolic (mmHg)",
      "BP diastolic (mmHg)",
      "Kick count",
    ]);
  });

  it("writes a recorded pregnancy test, cycle start, and uncertainty flag", () => {
    const rows = buildExportCSVRows(
      [
        {
          ...createEmptyDayLogRecord("2026-03-01"),
          isPeriod: true,
          cycleStart: true,
          isUncertain: true,
          pregnancyTest: "positive",
        },
      ],
      [],
      "c",
    );

    expect(rows[0]).toEqual(
      expect.objectContaining({
        pregnancyTest: "positive",
        cycleStart: true,
        isUncertain: true,
      }),
    );

    const csv = serializeExportCSV([...EXPORT_CSV_HEADERS], rows, range);
    const [, dataLine] = csv.trim().split("\n");

    expect(dataLine?.split(",").slice(-7)).toEqual([
      "positive",
      "Yes",
      "Yes",
      // The app-only metric columns stay empty when nothing was recorded.
      "",
      "",
      "",
      "",
    ]);
  });

  it("leaves the three columns empty for a day with nothing recorded", () => {
    const rows = buildExportCSVRows(
      [createEmptyDayLogRecord("2026-03-02")],
      [],
      "c",
    );
    const csv = serializeExportCSV([...EXPORT_CSV_HEADERS], rows, range);
    const [headerLine, dataLine] = csv.trim().split("\n");

    expect(headerLine?.split(",")).toHaveLength(EXPORT_CSV_HEADERS.length);
    expect(dataLine?.split(",")).toHaveLength(EXPORT_CSV_HEADERS.length);
    expect(dataLine?.split(",").slice(-3)).toEqual(["", "", ""]);
  });

  it("keeps a negative result distinguishable from no test at all", () => {
    const rows = buildExportCSVRows(
      [
        {
          ...createEmptyDayLogRecord("2026-03-01"),
          pregnancyTest: "negative",
        },
      ],
      [],
      "c",
    );

    expect(rows[0]?.pregnancyTest).toBe("negative");
  });
});

describe("CSV formula injection neutralization (sanitizeCSVTextCell)", () => {
  it("(a) neutralizes a note starting with an injection formula prefix", () => {
    const dayLogs = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        notes: '=IMPORTDATA("https://x")',
      },
    ];
    const rows = buildExportCSVRows(dayLogs, [], "c");
    const csv = serializeExportCSV(
      ["Date", "Notes"],
      rows,
      { preset: "all", fromDate: "2026-03-01", toDate: "2026-03-01" },
    );

    expect(csv).toContain("'=IMPORTDATA");
    expect(csv).not.toContain(",=IMPORTDATA");
  });

  it("(b) neutralizes a custom symptom label starting with + and a cycle factor starting with @", () => {
    // +extra goes through buildExportCSVRows → otherSymptoms (custom label not in built-in map)
    const customSymptom = {
      id: "custom_plus",
      slug: "plus-symptom",
      label: "+extra",
      icon: "",
      color: "#000000",
      isArchived: false,
      sortOrder: 1,
      isDefault: false,
    } as const;
    const dayLogs = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        symptomIDs: ["custom_plus"],
      },
    ];
    const rows = buildExportCSVRows(dayLogs, [customSymptom], "c");
    // +extra in otherSymptoms → neutralized
    const csvSymptom = serializeExportCSV(
      ["Date", "Other", "Notes"],
      rows,
      { preset: "all", fromDate: "2026-03-01", toDate: "2026-03-01" },
    );
    expect(csvSymptom).toContain("'+extra");

    // @-prefix cycle factor: ExportCSVRow.cycleFactors is string[], so build it directly
    const baseRow = rows[0]!;
    const rowWithAtFactor = [
      {
        ...baseRow,
        cycleFactors: ["@work"],
      },
    ];
    const csvFactor = serializeExportCSV(
      ["Date", "Cycle factors", "Notes"],
      rowWithAtFactor,
      { preset: "all", fromDate: "2026-03-01", toDate: "2026-03-01" },
    );
    expect(csvFactor).toContain("'@work");
  });

  it("(c) does not modify normal text without a dangerous prefix", () => {
    const dayLogs = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        notes: "Feeling good today",
        cycleFactorKeys: ["travel"] as DayCycleFactorKey[],
      },
    ];
    const rows = buildExportCSVRows(dayLogs, [], "c");
    const csv = serializeExportCSV(
      ["Date", "Cycle factors", "Notes"],
      rows,
      { preset: "all", fromDate: "2026-03-01", toDate: "2026-03-01" },
    );

    expect(csv).toContain("Feeling good today");
    expect(csv).toContain("travel");
    expect(csv).not.toContain("'Feeling");
    expect(csv).not.toContain("'travel");
  });

  it("(d) wraps an apostrophe-prefixed value in RFC4180 quotes when it also contains a comma", () => {
    const dayLogs = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        notes: "=SUM(1,2)",
      },
    ];
    const rows = buildExportCSVRows(dayLogs, [], "c");
    const csv = serializeExportCSV(
      ["Date", "Notes"],
      rows,
      { preset: "all", fromDate: "2026-03-01", toDate: "2026-03-01" },
    );

    // After sanitization the value becomes '=SUM(1,2) which contains a comma,
    // so RFC4180 quoting must wrap it: "'=SUM(1,2)"
    expect(csv).toContain('"\'=SUM(1,2)"');
  });
});

function createStorageMock(extra: Partial<LocalAppStorage> = {}) {
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
      lhTest: "peak",
      pregnancyTest: "none",
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
    ...extra,
  });
}
