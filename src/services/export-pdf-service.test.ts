import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultSymptomRecords } from "../models/symptom";
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
        languageOverride: null,
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
      { date: "2026-02-01", isPeriod: true, hasData: true },
      { date: "2026-02-02", isPeriod: true, hasData: true },
      { date: "2026-02-03", isPeriod: false, hasData: true },
      { date: "2026-03-01", isPeriod: true, hasData: true },
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
            flow: "Medium",
            symptoms: ["Cramps"],
          }),
          expect.objectContaining({
            date: "2026-02-02",
            cycleDay: 2,
            flow: "Light",
          }),
          expect.objectContaining({
            date: "2026-02-03",
            cycleDay: 3,
            sexActivity: "Protected",
            symptoms: ["Jaw pain"],
          }),
        ],
      },
    ]);
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
          languageOverride: null,
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
});
