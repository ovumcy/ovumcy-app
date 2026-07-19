import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { PDFDocument } from "pdf-lib";

import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultSymptomRecords } from "../models/symptom";
import { getExportPDFCopy } from "../i18n/export-pdf-copy";
import { buildExportPDFContent, buildExportPDFReport } from "./export-pdf-service";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

// Shared font-byte loader for the PDF-render tests below: reads the real
// embedded fonts once (matching the existing "renders a binary PDF document"
// test's approach) and caches the promise so multiple tests in this file
// don't re-read the font files from disk.
let sharedTestFontBytesPromise: Promise<{
  regular: Uint8Array;
  bold: Uint8Array;
}> | null = null;
function loadSharedTestFontBytes() {
  sharedTestFontBytesPromise ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/DejaVuSansCondensed.ttf")),
    readFile(join(process.cwd(), "assets/fonts/DejaVuSansCondensed-Bold.ttf")),
  ]).then(([regular, bold]) => ({
    regular: new Uint8Array(regular),
    bold: new Uint8Array(bold),
  }));
  return sharedTestFontBytesPromise;
}

// A four-cycle history (three completed + one open) engineered to exercise
// the report's optional signal sections in one coherent, deterministic
// fixture: a sustained 8-point BBT thermal shift plus a near egg-white
// reading in the open cycle (advanced-fertility thermal-shift +
// ovulation-confirmation items), three short-luteal completed cycles (the
// short-luteal warning), an egg-white-only completed cycle (the observed-
// ovulation calendar marker), a long note paired with cycle factors (table
// truncation), and a stray unparseable date (defensive calendar handling).
const RICH_HISTORY_PROFILE = {
  lastPeriodStart: "2026-04-26",
  cycleLength: 28,
  periodLength: 5,
  autoPeriodFill: true,
  irregularCycle: false,
  unpredictableCycle: false,
  ageGroup: "",
  usageGoal: "health",
  trackBBT: true,
  temperatureUnit: "f",
  trackCervicalMucus: true,
  hideSexChip: false,
  languageOverride: "en",
  themeOverride: null,
} as const;

function buildRichExportHistoryDayLogs(): DayLogRecord[] {
  const longClinicalNote =
    "Persistent cramping and mood swings reported during the follow-up consultation. ".repeat(
      4,
    );

  return [
    // Cycle 1: 2026-02-01 -> 2026-03-01 (completed, 28 days, luteal 9 days).
    {
      ...createEmptyDayLogRecord("2026-02-01"),
      cycleStart: true,
      isPeriod: true,
      flow: "medium",
    },
    {
      ...createEmptyDayLogRecord("2026-02-12"),
      cycleFactorKeys: ["stress", "travel"],
      notes: longClinicalNote,
      // A BBT reading inside a *completed* cycle's own entries (distinct
      // from the current-cycle thermal-shift points below) exercises the
      // per-row BBT display in the cycle table.
      bbt: 36.4,
    },
    { ...createEmptyDayLogRecord("2026-02-18"), cervicalMucus: "eggwhite" },
    { ...createEmptyDayLogRecord("2026-02-20"), lhTest: "peak" },
    // Cycle 2: 2026-03-01 -> 2026-03-29 (completed, 28 days, luteal 9 days).
    {
      ...createEmptyDayLogRecord("2026-03-01"),
      cycleStart: true,
      isPeriod: true,
      flow: "medium",
    },
    { ...createEmptyDayLogRecord("2026-03-20"), lhTest: "peak" },
    // Cycle 3: 2026-03-29 -> 2026-04-26 (completed, 28 days, luteal 9 days).
    {
      ...createEmptyDayLogRecord("2026-03-29"),
      cycleStart: true,
      isPeriod: true,
      flow: "medium",
    },
    { ...createEmptyDayLogRecord("2026-04-17"), lhTest: "peak" },
    // Current/open cycle from 2026-04-26 with an 8-point sustained BBT
    // thermal shift (5-day baseline 36.20C, 3-day streak >= 36.40C).
    {
      ...createEmptyDayLogRecord("2026-04-26"),
      cycleStart: true,
      isPeriod: true,
      flow: "medium",
      bbt: 36.2,
    },
    { ...createEmptyDayLogRecord("2026-04-27"), bbt: 36.2 },
    { ...createEmptyDayLogRecord("2026-04-28"), bbt: 36.2 },
    // An LH peak 2 days before the thermal-shift day (within the 4-day
    // alignment window) upgrades the LH-peak signal from "logged" to
    // "aligned".
    { ...createEmptyDayLogRecord("2026-04-29"), bbt: 36.2, lhTest: "peak" },
    {
      ...createEmptyDayLogRecord("2026-04-30"),
      bbt: 36.2,
      cervicalMucus: "eggwhite",
    },
    { ...createEmptyDayLogRecord("2026-05-01"), bbt: 36.55 },
    { ...createEmptyDayLogRecord("2026-05-02"), bbt: 36.55 },
    { ...createEmptyDayLogRecord("2026-05-03"), bbt: 36.6 },
    // Stray corrupted-sync row: an unparseable date must not crash report
    // assembly or PDF rendering, and must not appear in any cycle's table.
    { ...createEmptyDayLogRecord("not-a-date"), notes: "corrupted sync row" },
  ];
}

function buildLongCycleDayLogs(): DayLogRecord[] {
  const cycleStart = parseLocalDate("2026-09-01");
  if (!cycleStart) {
    throw new Error("invalid fixture date");
  }

  const days: DayLogRecord[] = [];
  for (let offset = 0; offset < 40; offset += 1) {
    const date = formatLocalDate(addDays(cycleStart, offset));
    days.push({
      ...createEmptyDayLogRecord(date),
      cycleStart: offset === 0,
      isPeriod: offset < 5,
      flow: offset < 5 ? "medium" : "none",
      mood: offset % 5 === 0 ? 3 : 0,
    });
  }
  // The next cycle's start (40 days later) closes cycle 1, so all 40 logged
  // days above become table rows that must overflow onto a second page.
  days.push({
    ...createEmptyDayLogRecord(formatLocalDate(addDays(cycleStart, 40))),
    cycleStart: true,
    isPeriod: true,
    flow: "medium",
  });
  return days;
}

describe("export-pdf-service", () => {
  it("builds a doctor-facing PDF report from completed cycles and logged days", () => {
    const symptoms = createDefaultSymptomRecords();
    const jawPain = {
      id: "jaw_pain",
      slug: "jaw-pain",
      label: "Jaw pain",
      icon: "🔥",
      color: "#E8799F",
      isArchived: false,
      sortOrder: 999,
      isDefault: false,
    } as const;

    const report = buildExportPDFReport({
      now: new Date("2026-03-18T10:00:00.000Z"),
      profile: {
        lastPeriodStart: "2026-02-01",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: true,
        temperatureUnit: "c",
        trackCervicalMucus: true,
        hideSexChip: false,
        languageOverride: "ru",
        themeOverride: null,
      },
      symptomRecords: [...symptoms, jawPain],
      dayLogs: [
        {
          ...createEmptyDayLogRecord("2026-02-01"),
          isPeriod: true,
          cycleStart: true,
          flow: "medium",
          mood: 3,
          notes: "Cycle start",
          symptomIDs: ["cramps"],
        },
        {
          ...createEmptyDayLogRecord("2026-02-02"),
          isPeriod: true,
          flow: "light",
          notes: "Second day",
        },
        {
          ...createEmptyDayLogRecord("2026-02-03"),
          mood: 4,
          sexActivity: "protected",
          lhTest: "peak",
          pregnancyTest: "none",
          symptomIDs: ["jaw_pain"],
          notes: "Felt better",
        },
        {
          ...createEmptyDayLogRecord("2026-03-01"),
          isPeriod: true,
          cycleStart: true,
          flow: "heavy",
          mood: 2,
          cycleFactorKeys: ["stress"],
          symptomIDs: ["cramps", "jaw_pain"],
          notes: "Second cycle",
        },
      ],
    });

    expect(report.language).toBe("ru");
    expect(report.summary).toEqual({
      loggedDays: 3,
      completedCycles: 1,
      averageCycleLength: 28,
      averagePeriodLength: 2,
      averageMood: 3.5,
      hasAverageMood: true,
      rangeStart: "2026-02-01",
      rangeEnd: "2026-02-03",
    });
    expect(report.calendarDays).toEqual([
      expect.objectContaining({ date: "2026-02-01", isPeriod: true, hasData: true }),
      expect.objectContaining({ date: "2026-02-02", isPeriod: true, hasData: true }),
      expect.objectContaining({ date: "2026-02-03", isPeriod: false, hasData: true }),
      expect.objectContaining({ date: "2026-03-01", isPeriod: true, hasData: true }),
    ]);
    expect(report.cycles).toEqual([
      {
        startDate: "2026-02-01",
        endDate: "2026-02-28",
        cycleLength: 28,
        periodLength: 2,
        entries: [
          expect.objectContaining({
            date: "2026-02-01",
            cycleDay: 1,
            flow: "Средняя",
            symptoms: ["Cramps"],
          }),
          expect.objectContaining({
            date: "2026-02-02",
            cycleDay: 2,
            flow: "Слабая",
          }),
          expect.objectContaining({
            date: "2026-02-03",
            cycleDay: 3,
            lhTest: "Пик",
            sexActivity: "С защитой",
            symptoms: ["Jaw pain"],
          }),
        ],
      },
    ]);
  });

  it("degrades gracefully to empty optional sections when there is no day-log history", () => {
    const report = buildExportPDFReport({
      now: new Date("2026-03-18T10:00:00.000Z"),
      profile: {
        lastPeriodStart: null,
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
        themeOverride: null,
      },
      symptomRecords: [],
      dayLogs: [],
    });

    expect(report.cycles).toEqual([]);
    expect(report.calendarDays).toEqual([]);
    expect(report.advancedFertility).toEqual([]);
    expect(report.extendedReportRows).toEqual([]);
    expect(report.shortLutealWarning).toBeNull();
    expect(report.summary).toEqual({
      loggedDays: 0,
      completedCycles: 0,
      averageCycleLength: 0,
      averagePeriodLength: 0,
      averageMood: 0,
      hasAverageMood: false,
      rangeStart: "",
      rangeEnd: "",
    });
  });

  it("renders a binary PDF document with embedded fonts", async () => {
    const symptoms = createDefaultSymptomRecords();
    const [regularFont, boldFont] = await Promise.all([
      readFile(join(process.cwd(), "assets/fonts/DejaVuSansCondensed.ttf")),
      readFile(join(process.cwd(), "assets/fonts/DejaVuSansCondensed-Bold.ttf")),
    ]);

    const content = await buildExportPDFContent(
      {
        now: new Date("2026-03-18T10:00:00.000Z"),
        profile: {
          lastPeriodStart: "2026-02-01",
          cycleLength: 28,
          periodLength: 5,
          autoPeriodFill: true,
          irregularCycle: false,
          unpredictableCycle: false,
          ageGroup: "",
          usageGoal: "health",
          trackBBT: true,
          temperatureUnit: "c",
          trackCervicalMucus: true,
          hideSexChip: false,
          languageOverride: "ru",
          themeOverride: null,
        },
        symptomRecords: symptoms,
        dayLogs: [
          {
            ...createEmptyDayLogRecord("2026-02-01"),
            isPeriod: true,
            cycleStart: true,
            flow: "medium",
            notes: "Cycle start",
            symptomIDs: ["cramps"],
          },
          {
            ...createEmptyDayLogRecord("2026-03-01"),
            isPeriod: true,
            cycleStart: true,
            flow: "heavy",
            notes: "Second cycle",
            symptomIDs: ["headache"],
          },
        ],
      },
      async () => ({
        regular: new Uint8Array(regularFont),
        bold: new Uint8Array(boldFont),
      }),
    );

    expect(Buffer.from(content).subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(content.byteLength).toBeGreaterThan(1000);
  });

  it("exposes the logged-period-length footnote in all supported locales", () => {
    for (const locale of ["en", "ru", "de", "fr", "es", "it"] as const) {
      const copy = getExportPDFCopy(locale);
      expect(typeof copy.summaryLoggedPeriodLengthFootnote).toBe("string");
      expect(copy.summaryLoggedPeriodLengthFootnote.length).toBeGreaterThan(0);
    }
  });

  it("exposes the fertile-window assumption footnote in all supported locales", () => {
    for (const locale of ["en", "ru", "de", "fr", "es", "it"] as const) {
      const copy = getExportPDFCopy(locale);
      expect(typeof copy.fertileWindowAssumptionFootnote).toBe("string");
      expect(copy.fertileWindowAssumptionFootnote.length).toBeGreaterThan(0);
    }
  });

  it("summary section label no longer calls it 'Average period length' (honesty relabel)", () => {
    for (const locale of ["en", "ru", "de", "fr", "es", "it"] as const) {
      const copy = getExportPDFCopy(locale);
      // Label should reference logged/recorded days, not a bare average
      expect(copy.summaryAveragePeriodLengthLabel).not.toBe("Average period length");
    }
  });

  it("calendar title includes last-6-months qualifier in all supported locales", () => {
    const copy = getExportPDFCopy("en");
    expect(copy.calendarTitle).toContain("6 months");
  });

  it("advanced fertility section title references the live current cycle", () => {
    const copy = getExportPDFCopy("en");
    expect(copy.advancedFertilityTitle).toContain("current cycle");
  });

  it("ovulation title uses signal-based framing, not confirmation framing", () => {
    const copy = getExportPDFCopy("en");
    expect(copy.advancedFertilityOvulationTitle).toBe("Estimated ovulation (signal-based)");
    expect(copy.advancedFertilityOvulationTitle).not.toContain("confirmation");
  });

  it("short luteal warning is non-directive in all supported locales", () => {
    const directives: Record<string, string> = {
      en: "Consider clinical follow-up",
      de: "Klinische Abklärung empfohlen",
      fr: "Suivi clinique recommandé",
      ru: "Рекомендуется клиническая консультация",
      es: "Se sugiere seguimiento clínico",
      it: "Si consiglia un consulto clinico",
    };
    for (const locale of ["en", "ru", "de", "fr", "es", "it"] as const) {
      const copy = getExportPDFCopy(locale);
      const desc = copy.shortLutealWarningDescription(10.5, 3);
      expect(desc).not.toContain(directives[locale]);
    }
  });

  it("Spanish BBT abbreviation uses TBC not TCB", () => {
    const copy = getExportPDFCopy("es");
    expect(copy.tableColumns.bbt).toBe("TBC");
    expect(copy.advancedFertilityThermalShiftTitle).toContain("TBC");
    expect(copy.tableColumns.bbt).not.toBe("TCB");
  });

  it("surfaces a confirmed thermal-shift and ovulation-confirmation signal, extended-report comparisons, and an observed-ovulation calendar marker from a multi-cycle history", () => {
    const pdfCopy = getExportPDFCopy("en");
    const report = buildExportPDFReport({
      now: new Date("2026-05-15T10:00:00.000Z"),
      profile: RICH_HISTORY_PROFILE,
      symptomRecords: createDefaultSymptomRecords(),
      dayLogs: buildRichExportHistoryDayLogs(),
    });

    // Thermal shift: `toThermalShiftSummary` always emits "confirmed" (the
    // "building" tier is unreachable dead code per its own source comment),
    // so asserting the confirmed-value copy also proves that branch, not the
    // permanently-unreachable "building" alternative.
    expect(report.advancedFertility).toContainEqual(
      expect.objectContaining({
        key: "thermal-shift",
        value: pdfCopy.advancedFertilityThermalShiftConfirmedValue,
      }),
    );
    expect(report.advancedFertility).toContainEqual({
      key: "ovulation-confirmation",
      title: pdfCopy.advancedFertilityOvulationTitle,
      value: pdfCopy.advancedFertilityOvulationConfirmedValue,
      description: pdfCopy.advancedFertilityOvulationDescription("2026-04-30", 1),
    });
    // The LH peak on 2026-04-29 sits 2 days before the thermal-shift day
    // (within the 4-day alignment window), upgrading the signal to
    // "aligned" instead of the bare "logged" tier.
    expect(report.advancedFertility).toContainEqual({
      key: "lh-peak",
      title: pdfCopy.advancedFertilityLHPeakTitle,
      value: pdfCopy.advancedFertilityLHPeakAlignedValue,
      description: pdfCopy.advancedFertilityLHPeakDescription("2026-04-29"),
    });

    expect(report.extendedReportRows).toHaveLength(3);
    expect(report.extendedReportRows[0]).toEqual(
      expect.objectContaining({ startDate: "2026-03-29", cycleLength: 28 }),
    );

    // All three completed cycles have a 9-day luteal phase (< the 10-day
    // short-luteal threshold), so the warning fires with all 3 observations.
    expect(report.shortLutealWarning).toEqual({ averageDays: 9, observationCount: 3 });

    const observedDay = report.calendarDays.find((day) => day.date === "2026-02-18");
    expect(observedDay).toEqual(
      expect.objectContaining({ isOvulation: true, isTentativeOvulation: false }),
    );

    // A stray unparseable date must not crash report assembly, and must not
    // be attributed to any completed cycle.
    expect(report.calendarDays.some((day) => day.date === "not-a-date")).toBe(true);
    expect(
      report.cycles.some((cycle) =>
        cycle.entries.some((entry) => entry.date === "not-a-date"),
      ),
    ).toBe(false);
  });

  it("sorts multiple symptom labels and falls back to the raw stored value for a day-log option that is not in the label catalog", () => {
    // Simulates legacy or corrupted data (an option value from a removed
    // catalog entry) reaching the export layer: it must degrade to the raw
    // value rather than crash or silently drop the field.
    const report = buildExportPDFReport({
      now: new Date("2026-08-05T10:00:00.000Z"),
      profile: {
        lastPeriodStart: "2026-07-29",
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
        themeOverride: null,
      },
      symptomRecords: createDefaultSymptomRecords(),
      dayLogs: [
        {
          ...createEmptyDayLogRecord("2026-07-01"),
          cycleStart: true,
          isPeriod: true,
          flow: "medium",
        },
        {
          // Kept within 5 days of the cycle-start period cluster above so it
          // merges into cycle 1 instead of being auto-promoted into its own
          // implicit cycle start (buildObservedPeriodClusters's >=5-day gap
          // heuristic) — this entry exists only to exercise the option
          // label fallback, not to be a cycle boundary itself.
          ...createEmptyDayLogRecord("2026-07-03"),
          isPeriod: true,
          flow: "unknown_legacy_flow" as DayLogRecord["flow"],
          sexActivity: "unknown_legacy_sex" as DayLogRecord["sexActivity"],
          cervicalMucus: "unknown_legacy_cm" as DayLogRecord["cervicalMucus"],
          lhTest: "unknown_legacy_lh" as DayLogRecord["lhTest"],
          // "deleted_symptom" has no matching entry in symptomRecords (e.g. a
          // custom symptom the owner later removed) — it must be dropped
          // silently rather than surfacing as an empty/undefined label.
          symptomIDs: ["headache", "cramps", "deleted_symptom"],
        },
        {
          ...createEmptyDayLogRecord("2026-07-05"),
          // isPeriod true with flow left at its "none" default: the flow
          // column must render blank, not fall through to the option-catalog
          // lookup (which is only reached for a non-"none" flow value).
          isPeriod: true,
        },
        {
          ...createEmptyDayLogRecord("2026-07-29"),
          cycleStart: true,
          isPeriod: true,
          flow: "medium",
        },
      ],
    });

    const entry = report.cycles[0]?.entries.find((day) => day.date === "2026-07-03");
    expect(entry).toEqual(
      expect.objectContaining({
        flow: "unknown_legacy_flow",
        sexActivity: "unknown_legacy_sex",
        cervicalMucus: "unknown_legacy_cm",
        lhTest: "unknown_legacy_lh",
        symptoms: ["Cramps", "Headache"],
      }),
    );

    const blankFlowEntry = report.cycles[0]?.entries.find(
      (day) => day.date === "2026-07-05",
    );
    expect(blankFlowEntry).toEqual(expect.objectContaining({ isPeriod: true, flow: "" }));
  });

  it("computes no fertile-window or tentative-ovulation calendar markers for a completed cycle shorter than the minimum predictable length", () => {
    // predictCycleWindow (cycle-prediction-policy.ts) returns an empty,
    // non-calculable window below MIN_CYCLE_LENGTH (15 days). A raw day-log
    // history is not clamped to that minimum the way profile settings are,
    // so an unusually short completed cycle can still reach the calendar-
    // marker step here; it must degrade to "no markers" rather than throw.
    const report = buildExportPDFReport({
      now: new Date("2026-01-20T10:00:00.000Z"),
      profile: {
        lastPeriodStart: "2026-01-11",
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
        themeOverride: null,
      },
      symptomRecords: [],
      dayLogs: [
        {
          ...createEmptyDayLogRecord("2026-01-01"),
          cycleStart: true,
          isPeriod: true,
          flow: "medium",
        },
        // 10 days later: a completed cycle length of 10, below the
        // 15-day floor calcOvulationDay requires to predict anything.
        {
          ...createEmptyDayLogRecord("2026-01-11"),
          cycleStart: true,
          isPeriod: true,
          flow: "medium",
        },
      ],
    });

    expect(report.cycles).toEqual([
      expect.objectContaining({ startDate: "2026-01-01", cycleLength: 10 }),
    ]);
    const day = report.calendarDays.find((entry) => entry.date === "2026-01-01");
    expect(day).toEqual(
      expect.objectContaining({
        isFertile: false,
        isOvulation: false,
        isTentativeOvulation: false,
      }),
    );
  });

  it("renders the populated advanced-fertility, extended-report, and short-luteal sections, truncates a long note with a cycle-factor prefix, and skips a day log with an unparseable date", async () => {
    const content = await buildExportPDFContent(
      {
        now: new Date("2026-05-15T10:00:00.000Z"),
        profile: RICH_HISTORY_PROFILE,
        symptomRecords: createDefaultSymptomRecords(),
        dayLogs: buildRichExportHistoryDayLogs(),
      },
      loadSharedTestFontBytes,
    );

    expect(Buffer.from(content).subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(content.byteLength).toBeGreaterThan(1000);

    const reloaded = await PDFDocument.load(content);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("renders the empty-state calendar and cycles sections on a single page when there is no day-log history", async () => {
    const content = await buildExportPDFContent(
      {
        now: new Date("2026-05-15T10:00:00.000Z"),
        profile: {
          lastPeriodStart: null,
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
          themeOverride: null,
        },
        symptomRecords: [],
        dayLogs: [],
      },
      loadSharedTestFontBytes,
    );

    expect(Buffer.from(content).subarray(0, 4).toString("utf8")).toBe("%PDF");
    const reloaded = await PDFDocument.load(content);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it("paginates a single cycle's table across multiple pages when it has more logged days than fit on one page", async () => {
    const content = await buildExportPDFContent(
      {
        now: new Date("2026-10-20T10:00:00.000Z"),
        profile: {
          lastPeriodStart: "2026-10-11",
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
          themeOverride: null,
        },
        symptomRecords: [],
        dayLogs: buildLongCycleDayLogs(),
      },
      loadSharedTestFontBytes,
    );

    const reloaded = await PDFDocument.load(content);
    expect(reloaded.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
