import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultSymptomRecords } from "../models/symptom";
import { getExportPDFCopy } from "../i18n/export-pdf-copy";
import { buildExportPDFContent, buildExportPDFReport } from "./export-pdf-service";

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
});
