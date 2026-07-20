import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { PDFDocument, PDFPage } from "pdf-lib";

import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import type { InterfaceLanguage } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";

import type { ExportPDFFontBytes } from "./export-pdf-fonts";
import { buildExportPDFContent } from "./export-pdf-service";

/**
 * Hermetic, offline doctor-PDF regression.
 *
 * The former "PDF visual sweep" (in e2e/web-smoke.spec.ts) rasterised the PDF
 * through a PDF.js build fetched from a public CDN and only *captured* a
 * screenshot — it asserted nothing, needed the network, and skipped Italian.
 *
 * This suite instead exercises the real render pipeline (`buildExportPDFContent`
 * → pdf-lib → subset-embedded DejaVu fonts) for every selectable locale and
 * compares a deterministic *structural* signature — the ordered list of every
 * text run actually drawn onto the pages, plus the page count — against a
 * committed baseline. A layout, pagination, translation, or data-shaping
 * regression flips at least one text run and fails the diff. No CDN, no browser,
 * no randomness: the fixture uses a fixed clock and the committed fonts, so the
 * drawn text is identical run-to-run.
 *
 * Regenerate the baselines after an intentional PDF change:
 *   OVUMCY_PDF_BASELINE_UPDATE=1 npx jest export-pdf-service.regression
 * Review the JSON diff like any other source change before committing it.
 */

const LOCALES: readonly InterfaceLanguage[] = [
  "en",
  "ru",
  "de",
  "fr",
  "es",
  "it",
];

const BASELINE_DIR = join(__dirname, "__fixtures__", "export-pdf-regression");
const shouldUpdateBaselines = process.env.OVUMCY_PDF_BASELINE_UPDATE === "1";

type PDFStructuralSignature = {
  locale: InterfaceLanguage;
  pageCount: number;
  textRuns: string[];
};

function buildScenarioInput(locale: InterfaceLanguage) {
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
    languageOverride: locale,
  };

  return {
    // Fixed instant → deterministic "generated at" header and history window.
    now: new Date(2026, 4, 24),
    dayLogs,
    profile,
    symptomRecords: createDefaultSymptomRecords(),
  };
}

let cachedFontBytes: ExportPDFFontBytes | null = null;

async function loadFontBytes(): Promise<ExportPDFFontBytes> {
  if (!cachedFontBytes) {
    const [regular, bold] = await Promise.all([
      readFile(join(process.cwd(), "assets/fonts/DejaVuSansCondensed.ttf")),
      readFile(join(process.cwd(), "assets/fonts/DejaVuSansCondensed-Bold.ttf")),
    ]);
    cachedFontBytes = {
      regular: new Uint8Array(regular),
      bold: new Uint8Array(bold),
    };
  }
  return cachedFontBytes;
}

async function buildSignature(
  locale: InterfaceLanguage,
): Promise<PDFStructuralSignature> {
  const drawSpy = jest.spyOn(PDFPage.prototype, "drawText");
  let pdfBytes: Uint8Array;
  let textRuns: string[];
  try {
    pdfBytes = await buildExportPDFContent(
      buildScenarioInput(locale),
      loadFontBytes,
    );
    // Every text glyph in the PDF flows through PDFPage.drawText; the first
    // positional argument is the already-truncated string that lands on the
    // page. Read the calls before mockRestore() clears them.
    textRuns = drawSpy.mock.calls.map((call) => String(call[0]));
  } finally {
    drawSpy.mockRestore();
  }

  const loaded = await PDFDocument.load(pdfBytes);

  return { locale, pageCount: loaded.getPageCount(), textRuns };
}

describe("export-pdf-service locale regression", () => {
  jest.setTimeout(60000);

  it.each(LOCALES)(
    "renders the doctor PDF matching the committed structural baseline for %s",
    async (locale) => {
      const signature = await buildSignature(locale);
      const baselinePath = join(BASELINE_DIR, `${locale}.json`);

      if (shouldUpdateBaselines) {
        mkdirSync(BASELINE_DIR, { recursive: true });
        writeFileSync(
          baselinePath,
          `${JSON.stringify(signature, null, 2)}\n`,
          "utf8",
        );
        return;
      }

      expect(existsSync(baselinePath)).toBe(true);
      const baseline = JSON.parse(
        readFileSync(baselinePath, "utf8"),
      ) as PDFStructuralSignature;

      expect(signature).toEqual(baseline);
      // Guard against a silently empty render passing a stale/empty baseline.
      expect(signature.textRuns.length).toBeGreaterThan(80);
      expect(signature.pageCount).toBeGreaterThanOrEqual(2);
    },
  );
});
