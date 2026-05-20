import { mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import { buildExportPDFContent } from "./export-pdf-service";

// One-off visualisation harness. Always runs but only writes when the env
// variable is set so it does not pollute CI machines.
describe("export-pdf-service sample PDF", () => {
  const shouldEmit = process.env.OVUMCY_PDF_SAMPLE === "1";

  it("renders a sample doctor PDF showing the new colored calendar and premium sections", async () => {
    if (!shouldEmit) {
      return;
    }
    jest.setTimeout(60000);
    const periodRecord = (
      date: string,
      overrides: Partial<ReturnType<typeof createEmptyDayLogRecord>> = {},
    ) => ({
      ...createEmptyDayLogRecord(date),
      isPeriod: true as const,
      cycleStart: true as const,
      flow: "medium" as const,
      ...overrides,
    });

    const dayLogs = [
      periodRecord("2025-12-01"),
      {
        ...createEmptyDayLogRecord("2025-12-20"),
        cervicalMucus: "eggwhite" as const,
      },
      periodRecord("2025-12-26"),
      {
        ...createEmptyDayLogRecord("2026-01-15"),
        cervicalMucus: "eggwhite" as const,
        lhTest: "peak" as const,
        bbt: 36.45,
      },
      { ...createEmptyDayLogRecord("2026-01-16"), bbt: 36.65 },
      { ...createEmptyDayLogRecord("2026-01-17"), bbt: 36.7 },
      periodRecord("2026-01-20"),
      {
        ...createEmptyDayLogRecord("2026-02-09"),
        cervicalMucus: "eggwhite" as const,
        lhTest: "peak" as const,
        bbt: 36.4,
      },
      { ...createEmptyDayLogRecord("2026-02-10"), bbt: 36.6 },
      { ...createEmptyDayLogRecord("2026-02-11"), bbt: 36.65 },
      periodRecord("2026-02-14"),
      {
        ...createEmptyDayLogRecord("2026-03-05"),
        cervicalMucus: "eggwhite" as const,
        lhTest: "peak" as const,
        bbt: 36.42,
      },
      { ...createEmptyDayLogRecord("2026-03-06"), bbt: 36.62 },
      { ...createEmptyDayLogRecord("2026-03-07"), bbt: 36.68 },
      periodRecord("2026-03-10"),
      periodRecord("2026-04-07"),
      periodRecord("2026-04-20"),
    ];

    const profile = {
      ...createDefaultProfileRecord(),
      trackBBT: true,
      trackCervicalMucus: true,
      lastPeriodStart: "2026-04-20",
    };

    const [regularFont, boldFont] = await Promise.all([
      readFile(join(process.cwd(), "assets/fonts/DejaVuSansCondensed.ttf")),
      readFile(join(process.cwd(), "assets/fonts/DejaVuSansCondensed-Bold.ttf")),
    ]);

    const pdfBytes = await buildExportPDFContent(
      {
        now: new Date(2026, 4, 24),
        dayLogs,
        profile,
        symptomRecords: createDefaultSymptomRecords(),
      },
      async () => ({
        regular: new Uint8Array(regularFont),
        bold: new Uint8Array(boldFont),
      }),
    );

    const outDir = join(process.cwd(), "e2e", "screenshots");
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "sample-doctor.pdf");
    writeFileSync(outPath, pdfBytes);
    expect(pdfBytes.length).toBeGreaterThan(1000);
  });
});
