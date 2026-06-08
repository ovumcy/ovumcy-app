import { type PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

import { getDayLogCopy } from "../i18n/day-log-copy";
import { getExportPDFCopy } from "../i18n/export-pdf-copy";
import { resolveCopyLanguage } from "../i18n/runtime";
import type {
  ExportPDFAdvancedFertilityItem,
  ExportPDFCalendarDay,
  ExportPDFCycle,
  ExportPDFCycleDay,
  ExportPDFExtendedReportRow,
  ExportPDFReport,
  ExportPDFShortLutealWarning,
  ExportPDFSummary,
} from "../models/export";
import { hasDayLogData, type DayLogRecord } from "../models/day-log";
import { celsiusDeltaToUnit, celsiusToUnit } from "./temperature-policy";
import type { ProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import { buildCycleHistorySummary } from "./cycle-history-service";
import {
  predictCycleWindow,
  resolveLutealPhase,
} from "./cycle-prediction-policy";
import { loadExportPDFFontBytes, type ExportPDFFontBytes } from "./export-pdf-fonts";
import {
  fontkitRuntime,
  PageSizesRuntime,
  PDFDocumentRuntime,
  rgbRuntime,
} from "./export-pdf-runtime";
import { inferObservedOvulationDate } from "./observed-ovulation-service";
import { parseLocalDate } from "./profile-settings-policy";
import { buildStatsAdvancedFertility } from "./stats-advanced-fertility-service";
import { buildStatsExtendedReports } from "./stats-extended-reports-service";
import { buildShortLutealHint } from "./stats-premium-insights-service";

const MAX_EXPORT_PDF_CYCLES = 6;
const PAGE_WIDTH = PageSizesRuntime.A4[1];
const PAGE_HEIGHT = PageSizesRuntime.A4[0];
const PAGE_MARGIN = 28;
const SECTION_GAP = 16;
const BODY_FONT_SIZE = 10;
const SMALL_FONT_SIZE = 8;
const TABLE_FONT_SIZE = 7.5;
const LINE_HEIGHT = 14;
const MONTH_COLUMNS = 3;
const MONTH_GAP = 10;
const MONTH_HEIGHT = 118;
const MONTH_PADDING = 8;
const MONTH_WEEKDAY_HEIGHT = 10;
const MONTH_DAY_HEIGHT = 13;
const TABLE_ROW_HEIGHT = 16;
const TABLE_HEADER_HEIGHT = 26;
const TABLE_COLUMN_WIDTHS = [70, 46, 42, 56, 56, 58, 60, 84, 50, 156, 108] as const;

const COLOR_TEXT = hexColor("#4B3D31");
const COLOR_MUTED = hexColor("#7F6A57");
const COLOR_BORDER = hexColor("#DCC8B5");
const COLOR_SURFACE = hexColor("#FFFFFF");
const COLOR_PERIOD = hexColor("#C7756D");
const COLOR_LOGGED = hexColor("#E9D0B4");
const COLOR_FERTILE = hexColor("#B8D4C1");
const COLOR_OVULATION = hexColor("#F4D58D");
const COLOR_TENTATIVE_BORDER = hexColor("#959595");
const COLOR_HEADER_FILL = hexColor("#FAF4ED");
const COLOR_BRAND = hexColor("#C0726A");
const COLOR_BRAND_DEEP = hexColor("#9A554E");
const COLOR_ON_BRAND = rgbRuntime(1, 1, 1);
const COLOR_ON_BRAND_MUTED = hexColor("#F4DBD6");
const COLOR_CARD_FILL = hexColor("#FBF6F0");
const COLOR_CALLOUT_FILL = hexColor("#FBEEE9");

const HEADER_BAND_HEIGHT = 72;
const FOOTER_RESERVE = 26;
const CONTENT_BOTTOM = PAGE_MARGIN + FOOTER_RESERVE;
const STAT_CARD_HEIGHT = 54;
const STAT_CARD_GAP = 10;

export type ExportPDFBuildInput = {
  now: Date;
  dayLogs: readonly DayLogRecord[];
  profile: ProfileRecord;
  symptomRecords: readonly SymptomRecord[];
};

type ExportPDFLayoutContext = {
  contentWidth: number;
  cursorY: number;
  doc: PDFDocument;
  fonts: {
    bold: PDFFont;
    regular: PDFFont;
  };
  page: PDFPage;
};

type ExportPDFMonthContext = {
  monthStart: Date;
  daysByDate: Map<string, ExportPDFCalendarDay>;
};

type ExportPDFCycleTableColumn = {
  align?: "left" | "center";
  key:
    | "date"
    | "cycleDay"
    | "period"
    | "flow"
    | "mood"
    | "sex"
    | "bbt"
    | "cervical"
    | "lh"
    | "symptoms"
    | "notes";
  width: number;
};

const TABLE_COLUMNS: readonly ExportPDFCycleTableColumn[] = [
  { key: "date", width: TABLE_COLUMN_WIDTHS[0] },
  { key: "cycleDay", width: TABLE_COLUMN_WIDTHS[1], align: "center" },
  { key: "period", width: TABLE_COLUMN_WIDTHS[2], align: "center" },
  { key: "flow", width: TABLE_COLUMN_WIDTHS[3] },
  { key: "mood", width: TABLE_COLUMN_WIDTHS[4], align: "center" },
  { key: "sex", width: TABLE_COLUMN_WIDTHS[5] },
  { key: "bbt", width: TABLE_COLUMN_WIDTHS[6] },
  { key: "cervical", width: TABLE_COLUMN_WIDTHS[7] },
  { key: "lh", width: TABLE_COLUMN_WIDTHS[8] },
  { key: "symptoms", width: TABLE_COLUMN_WIDTHS[9] },
  { key: "notes", width: TABLE_COLUMN_WIDTHS[10] },
];

export async function buildExportPDFContent(
  input: ExportPDFBuildInput,
  fontBytesLoader: () => Promise<ExportPDFFontBytes> = loadExportPDFFontBytes,
): Promise<Uint8Array> {
  const report = buildExportPDFReport(input);
  return renderExportPDFDocument(report, fontBytesLoader);
}

export function buildExportPDFReport({
  now,
  dayLogs,
  profile,
  symptomRecords,
}: ExportPDFBuildInput): ExportPDFReport {
  const language = resolveCopyLanguage(profile.languageOverride);
  const dayLogLabels = getDayLogCopy(language);
  const sortedDayLogs = [...dayLogs].sort((left, right) => left.date.localeCompare(right.date));
  const history = buildCycleHistorySummary(profile, sortedDayLogs, now);
  const completedCycles = history.completedCycles.slice(-MAX_EXPORT_PDF_CYCLES);
  const symptomLookup = new Map(symptomRecords.map((record) => [record.id, record]));
  const completedCycleEntries = new Set<string>();

  const cycles = completedCycles.map<ExportPDFCycle>((cycle) => {
    const entries = sortedDayLogs
      .filter((record) => record.date >= cycle.startDate && record.date < cycle.nextStartDate)
      .map((record) => {
        completedCycleEntries.add(record.date);
        return buildExportPDFCycleDay(record, cycle.startDate, symptomLookup, dayLogLabels);
      });

    return {
      startDate: cycle.startDate,
      endDate: buildInclusiveCycleEndDate(cycle.nextStartDate),
      cycleLength: cycle.cycleLength,
      periodLength: cycle.periodLength,
      entries,
    };
  });

  const includedLogs =
    cycles.length > 0
      ? sortedDayLogs.filter((record) => completedCycleEntries.has(record.date))
      : sortedDayLogs;

  const calendarMarkers = buildCalendarMarkers(
    completedCycles,
    sortedDayLogs,
    profile.temperatureUnit,
  );
  const pdfCopy = getExportPDFCopy(language);
  const advancedFertilityItems = buildAdvancedFertilityItemsForPDF(
    history,
    sortedDayLogs,
    profile,
    pdfCopy,
  );
  const extendedReports = buildStatsExtendedReports(history);
  const extendedReportRows: ExportPDFExtendedReportRow[] = (
    extendedReports?.rows ?? []
  ).map((row) => ({
    startDate: row.startDate,
    cycleLength: row.cycleLength,
    periodLength: row.periodLength,
    comparison: row.comparisonKind,
  }));
  const shortLutealHint = buildShortLutealHint(history, sortedDayLogs);
  const shortLutealWarning: ExportPDFShortLutealWarning | null = shortLutealHint
    ? {
        averageDays: shortLutealHint.averageDays,
        observationCount: shortLutealHint.observationCount,
      }
    : null;

  return {
    generatedAt: now.toISOString(),
    language,
    summary: buildExportPDFSummary(cycles, includedLogs),
    calendarDays: sortedDayLogs.map((record) => ({
      date: record.date,
      isPeriod: record.isPeriod,
      hasData: hasDayLogData(record),
      isFertile: calendarMarkers.fertileDates.has(record.date),
      isOvulation: calendarMarkers.observedOvulationDates.has(record.date),
      isTentativeOvulation:
        calendarMarkers.tentativeOvulationDates.has(record.date),
    })),
    cycles,
    temperatureUnit: profile.temperatureUnit,
    advancedFertility: advancedFertilityItems,
    extendedReportRows,
    shortLutealWarning,
  };
}

function buildAdvancedFertilityItemsForPDF(
  history: ReturnType<typeof buildCycleHistorySummary>,
  sortedDayLogs: readonly DayLogRecord[],
  profile: ProfileRecord,
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
): ExportPDFAdvancedFertilityItem[] {
  const summary = buildStatsAdvancedFertility(
    history,
    sortedDayLogs,
    history.completedCycles[history.completedCycles.length - 1]?.startDate ?? null,
  );
  if (!summary) {
    return [];
  }

  const items: ExportPDFAdvancedFertilityItem[] = [];
  const unitLabel =
    profile.temperatureUnit === "f"
      ? pdfCopy.advancedFertilityUnitFahrenheit
      : pdfCopy.advancedFertilityUnitCelsius;
  if (summary.thermalShift) {
    items.push({
      key: "thermal-shift",
      title: pdfCopy.advancedFertilityThermalShiftTitle,
      value:
        summary.thermalShift.kind === "confirmed"
          ? pdfCopy.advancedFertilityThermalShiftConfirmedValue
          : pdfCopy.advancedFertilityThermalShiftBuildingValue,
      description: pdfCopy.advancedFertilityThermalShiftDescription(
        celsiusDeltaToUnit(summary.thermalShift.rise, profile.temperatureUnit).toFixed(2),
        unitLabel,
        summary.thermalShift.sampleCount,
      ),
    });
  }
  if (summary.ovulationConfirmation) {
    items.push({
      key: "ovulation-confirmation",
      title: pdfCopy.advancedFertilityOvulationTitle,
      value:
        summary.ovulationConfirmation.kind === "confirmed"
          ? pdfCopy.advancedFertilityOvulationConfirmedValue
          : pdfCopy.advancedFertilityOvulationBuildingValue,
      description: pdfCopy.advancedFertilityOvulationDescription(
        summary.ovulationConfirmation.mucusDate,
        summary.ovulationConfirmation.gapDays,
      ),
    });
  }
  if (summary.lhPeakSignal) {
    items.push({
      key: "lh-peak",
      title: pdfCopy.advancedFertilityLHPeakTitle,
      value:
        summary.lhPeakSignal.kind === "aligned"
          ? pdfCopy.advancedFertilityLHPeakAlignedValue
          : pdfCopy.advancedFertilityLHPeakLoggedValue,
      description: pdfCopy.advancedFertilityLHPeakDescription(
        summary.lhPeakSignal.date,
      ),
    });
  }

  return items;
}

type ExportPDFCalendarMarkers = {
  fertileDates: Set<string>;
  observedOvulationDates: Set<string>;
  tentativeOvulationDates: Set<string>;
};

function buildCalendarMarkers(
  completedCycles: ReturnType<typeof buildCycleHistorySummary>["completedCycles"],
  sortedDayLogs: readonly DayLogRecord[],
  temperatureUnit: ProfileRecord["temperatureUnit"],
): ExportPDFCalendarMarkers {
  const fertileDates = new Set<string>();
  const observedOvulationDates = new Set<string>();
  const tentativeOvulationDates = new Set<string>();

  for (const cycle of completedCycles) {
    const cycleRecords = sortedDayLogs.filter(
      (record) =>
        record.date >= cycle.startDate && record.date < cycle.nextStartDate,
    );
    const observed = inferObservedOvulationDate(
      cycleRecords,
      cycle.startDate,
      cycle.nextStartDate,
    );

    const predicted = predictCycleWindow(
      cycle.startDate,
      cycle.cycleLength,
      resolveLutealPhase(0),
    );

    if (predicted.fertilityStart && predicted.fertilityEnd) {
      const startDate = parseLocalDate(predicted.fertilityStart);
      const endDate = parseLocalDate(predicted.fertilityEnd);
      if (startDate && endDate) {
        for (
          let day = new Date(startDate);
          day <= endDate;
          day.setDate(day.getDate() + 1)
        ) {
          fertileDates.add(formatPDFDateISO(day));
        }
      }
    }

    if (observed) {
      observedOvulationDates.add(observed);
    } else if (predicted.ovulationDate) {
      tentativeOvulationDates.add(predicted.ovulationDate);
    }
  }

  return {
    fertileDates,
    observedOvulationDates,
    tentativeOvulationDates,
  };
}

function formatPDFDateISO(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildExportPDFCycleDay(
  record: DayLogRecord,
  cycleStartDate: string,
  symptomLookup: Map<string, SymptomRecord>,
  dayLogLabels: ReturnType<typeof getDayLogCopy>,
): ExportPDFCycleDay {
  return {
    date: record.date,
    cycleDay: diffLocalDays(cycleStartDate, record.date) + 1,
    isPeriod: record.isPeriod,
    flow: record.isPeriod ? resolveFlowLabel(record.flow, dayLogLabels) : "",
    moodRating: normalizeMood(record.mood),
    sexActivity: resolveSexActivityLabel(record.sexActivity, dayLogLabels),
    bbt: record.bbt > 0 ? record.bbt : 0,
    cervicalMucus: resolveCervicalMucusLabel(record.cervicalMucus, dayLogLabels),
    lhTest: resolveLHTestLabel(record.lhTest, dayLogLabels),
    cycleFactors: resolveCycleFactorLabels(record.cycleFactorKeys, dayLogLabels),
    symptoms: resolveSymptomLabels(record.symptomIDs, symptomLookup),
    notes: record.notes.trim(),
  };
}

function buildExportPDFSummary(
  cycles: readonly ExportPDFCycle[],
  includedLogs: readonly DayLogRecord[],
): ExportPDFSummary {
  const moods = includedLogs
    .map((record) => normalizeMood(record.mood))
    .filter((value) => value > 0);
  const cycleLengths = cycles.map((cycle) => cycle.cycleLength);
  const periodLengths = cycles.map((cycle) => cycle.periodLength);
  const firstLog = includedLogs[0];
  const lastLog = includedLogs[includedLogs.length - 1];

  return {
    loggedDays: includedLogs.length,
    completedCycles: cycles.length,
    averageCycleLength: average(cycleLengths),
    averagePeriodLength: average(periodLengths),
    averageMood: average(moods),
    hasAverageMood: moods.length > 0,
    rangeStart: firstLog?.date ?? "",
    rangeEnd: lastLog?.date ?? "",
  };
}

function drawShortLutealWarningSection(
  layout: ExportPDFLayoutContext,
  warning: ExportPDFReport["shortLutealWarning"],
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  if (!warning) {
    return;
  }
  const description = pdfCopy.shortLutealWarningDescription(
    warning.averageDays,
    warning.observationCount,
  );
  const innerLeft = 16;
  const innerRight = 12;
  const textWidth = layout.contentWidth - innerLeft - innerRight;
  const descLines = wrapText(
    description,
    layout.fonts.regular,
    BODY_FONT_SIZE,
    textWidth,
  );
  const boxHeight = 16 + 6 + descLines.length * LINE_HEIGHT + 10;
  ensurePageSpace(layout, boxHeight + 6);

  const top = layout.cursorY;
  const bottom = top - boxHeight;
  layout.page.drawRectangle({
    x: PAGE_MARGIN,
    y: bottom,
    width: layout.contentWidth,
    height: boxHeight,
    borderColor: COLOR_BRAND,
    borderWidth: 1,
    color: COLOR_CALLOUT_FILL,
  });
  layout.page.drawRectangle({
    x: PAGE_MARGIN,
    y: bottom,
    width: 4,
    height: boxHeight,
    color: COLOR_BRAND,
  });

  drawSingleLineText(layout.page, pdfCopy.shortLutealWarningTitle, {
    x: PAGE_MARGIN + innerLeft,
    y: top - 16,
    maxWidth: textWidth,
    color: COLOR_BRAND_DEEP,
    font: layout.fonts.bold,
    fontSize: BODY_FONT_SIZE + 1,
  });

  let textY = top - 16 - 6 - BODY_FONT_SIZE;
  for (const line of descLines) {
    drawSingleLineText(layout.page, line, {
      x: PAGE_MARGIN + innerLeft,
      y: textY,
      maxWidth: textWidth,
      color: COLOR_TEXT,
      font: layout.fonts.regular,
      fontSize: BODY_FONT_SIZE,
    });
    textY -= LINE_HEIGHT;
  }

  layout.cursorY = bottom - SECTION_GAP + 2;
}

function drawAdvancedFertilitySection(
  layout: ExportPDFLayoutContext,
  items: readonly ExportPDFAdvancedFertilityItem[],
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  layout.cursorY = drawSectionHeading(layout, pdfCopy.advancedFertilityTitle);
  if (items.length === 0) {
    layout.cursorY = drawTextBlock(layout, pdfCopy.advancedFertilityEmpty, {
      color: COLOR_MUTED,
      font: layout.fonts.regular,
      fontSize: BODY_FONT_SIZE,
      lineHeight: LINE_HEIGHT,
    });
    layout.cursorY -= SECTION_GAP - 4;
    return;
  }

  for (const item of items) {
    layout.cursorY = drawTextBlock(layout, `${item.title}: ${item.value}`, {
      color: COLOR_TEXT,
      font: layout.fonts.bold,
      fontSize: BODY_FONT_SIZE,
      lineHeight: LINE_HEIGHT,
    });
    layout.cursorY = drawTextBlock(layout, item.description, {
      color: COLOR_MUTED,
      font: layout.fonts.regular,
      fontSize: BODY_FONT_SIZE,
      lineHeight: LINE_HEIGHT,
    });
  }
  layout.cursorY -= SECTION_GAP - 4;
}

function drawExtendedReportsSection(
  layout: ExportPDFLayoutContext,
  rows: readonly ExportPDFExtendedReportRow[],
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  layout.cursorY = drawSectionHeading(layout, pdfCopy.extendedReportsTitle);
  if (rows.length === 0) {
    layout.cursorY = drawTextBlock(layout, pdfCopy.extendedReportsEmpty, {
      color: COLOR_MUTED,
      font: layout.fonts.regular,
      fontSize: BODY_FONT_SIZE,
      lineHeight: LINE_HEIGHT,
    });
    layout.cursorY -= SECTION_GAP - 4;
    return;
  }

  for (const row of rows) {
    layout.cursorY = drawTextBlock(
      layout,
      pdfCopy.extendedReportsRow(
        row.startDate,
        row.cycleLength,
        row.periodLength,
        row.comparison,
      ),
      {
        color: COLOR_TEXT,
        font: layout.fonts.regular,
        fontSize: BODY_FONT_SIZE,
        lineHeight: LINE_HEIGHT,
      },
    );
  }
  layout.cursorY -= SECTION_GAP - 4;
}

async function renderExportPDFDocument(
  report: ExportPDFReport,
  fontBytesLoader: () => Promise<ExportPDFFontBytes>,
): Promise<Uint8Array> {
  const pdfCopy = getExportPDFCopy(report.language);
  const fontBytes = await fontBytesLoader();
  const doc = await PDFDocumentRuntime.create();
  doc.registerFontkit(fontkitRuntime);

  const [regularFont, boldFont] = await Promise.all([
    doc.embedFont(fontBytes.regular, { subset: true }),
    doc.embedFont(fontBytes.bold, { subset: true }),
  ]);

  const layout = createLayoutContext(doc, regularFont, boldFont);

  drawDocumentHeader(layout, report, pdfCopy);
  drawSummarySection(layout, report.summary, pdfCopy);
  drawShortLutealWarningSection(layout, report.shortLutealWarning, pdfCopy);
  drawAdvancedFertilitySection(layout, report.advancedFertility, pdfCopy);
  drawExtendedReportsSection(layout, report.extendedReportRows, pdfCopy);
  drawCalendarSection(layout, report.calendarDays, report.language, pdfCopy);
  drawCyclesSection(layout, report.cycles, report.temperatureUnit, pdfCopy);

  drawDocumentFooters(doc, regularFont, pdfCopy);
  return doc.save();
}

function drawDocumentFooters(
  doc: PDFDocument,
  font: PDFFont,
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  const pages = doc.getPages();
  const total = pages.length;
  const brand = pdfCopy.documentTitle;
  pages.forEach((page, index) => {
    page.drawRectangle({
      x: PAGE_MARGIN,
      y: PAGE_MARGIN + 4,
      width: PAGE_WIDTH - PAGE_MARGIN * 2,
      height: 0.75,
      color: COLOR_BORDER,
    });
    drawSingleLineText(page, brand, {
      x: PAGE_MARGIN,
      y: PAGE_MARGIN - 8,
      maxWidth: PAGE_WIDTH - PAGE_MARGIN * 2 - 80,
      color: COLOR_MUTED,
      font,
      fontSize: SMALL_FONT_SIZE - 0.5,
    });
    const pageLabel = `${index + 1} / ${total}`;
    const labelWidth = font.widthOfTextAtSize(pageLabel, SMALL_FONT_SIZE - 0.5);
    drawSingleLineText(page, pageLabel, {
      x: PAGE_WIDTH - PAGE_MARGIN - labelWidth,
      y: PAGE_MARGIN - 8,
      maxWidth: labelWidth + 2,
      color: COLOR_MUTED,
      font,
      fontSize: SMALL_FONT_SIZE - 0.5,
    });
  });
}

function createLayoutContext(
  doc: PDFDocument,
  regularFont: PDFFont,
  boldFont: PDFFont,
): ExportPDFLayoutContext {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  return {
    contentWidth: PAGE_WIDTH - PAGE_MARGIN * 2,
    cursorY: PAGE_HEIGHT - PAGE_MARGIN,
    doc,
    fonts: {
      bold: boldFont,
      regular: regularFont,
    },
    page,
  };
}

function drawDocumentHeader(
  layout: ExportPDFLayoutContext,
  report: ExportPDFReport,
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  const page = layout.page;
  const bandBottom = PAGE_HEIGHT - HEADER_BAND_HEIGHT;
  page.drawRectangle({
    x: 0,
    y: bandBottom,
    width: PAGE_WIDTH,
    height: HEADER_BAND_HEIGHT,
    color: COLOR_BRAND,
  });
  page.drawRectangle({
    x: 0,
    y: bandBottom,
    width: PAGE_WIDTH,
    height: 3,
    color: COLOR_BRAND_DEEP,
  });

  drawSingleLineText(page, pdfCopy.documentTitle, {
    x: PAGE_MARGIN,
    y: bandBottom + HEADER_BAND_HEIGHT - 36,
    maxWidth: PAGE_WIDTH - PAGE_MARGIN * 2 - 170,
    color: COLOR_ON_BRAND,
    font: layout.fonts.bold,
    fontSize: 20,
  });
  drawSingleLineText(
    page,
    `${pdfCopy.generatedAtLabel}: ${formatGeneratedAt(report.generatedAt, report.language)}`,
    {
      x: PAGE_MARGIN,
      y: bandBottom + 16,
      maxWidth: PAGE_WIDTH - PAGE_MARGIN * 2 - 170,
      color: COLOR_ON_BRAND_MUTED,
      font: layout.fonts.regular,
      fontSize: SMALL_FONT_SIZE,
    },
  );

  if (report.summary.rangeStart && report.summary.rangeEnd) {
    const rangeText = `${report.summary.rangeStart}  –  ${report.summary.rangeEnd}`;
    const rangeWidth = layout.fonts.regular.widthOfTextAtSize(rangeText, 11);
    drawSingleLineText(page, rangeText, {
      x: PAGE_WIDTH - PAGE_MARGIN - rangeWidth,
      y: bandBottom + HEADER_BAND_HEIGHT - 30,
      maxWidth: rangeWidth + 2,
      color: COLOR_ON_BRAND,
      font: layout.fonts.regular,
      fontSize: 11,
    });
  }

  layout.cursorY = bandBottom - SECTION_GAP;
}

function drawSummarySection(
  layout: ExportPDFLayoutContext,
  summary: ExportPDFSummary,
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  layout.cursorY = drawSectionHeading(layout, pdfCopy.summaryTitle);
  layout.cursorY -= 2;

  const cards: { value: string; label: string }[] = [
    { value: String(summary.loggedDays), label: pdfCopy.summaryLoggedDaysLabel },
    {
      value: String(summary.completedCycles),
      label: pdfCopy.summaryCompletedCyclesLabel,
    },
    ...(summary.averageCycleLength > 0
      ? [
          {
            value: summary.averageCycleLength.toFixed(1),
            label: pdfCopy.summaryAverageCycleLengthLabel,
          },
        ]
      : []),
    ...(summary.averagePeriodLength > 0
      ? [
          {
            value: summary.averagePeriodLength.toFixed(1),
            label: pdfCopy.summaryAveragePeriodLengthLabel,
          },
        ]
      : []),
    ...(summary.hasAverageMood
      ? [
          {
            value: `${summary.averageMood.toFixed(1)} / 5`,
            label: pdfCopy.summaryAverageMoodLabel,
          },
        ]
      : []),
  ];

  drawStatCards(layout, cards);
  layout.cursorY -= SECTION_GAP - 2;
}

function drawStatCards(
  layout: ExportPDFLayoutContext,
  cards: readonly { value: string; label: string }[],
) {
  if (cards.length === 0) {
    return;
  }
  ensurePageSpace(layout, STAT_CARD_HEIGHT + 6);
  const count = cards.length;
  const cardWidth =
    (layout.contentWidth - STAT_CARD_GAP * (count - 1)) / count;
  const top = layout.cursorY;
  const bottom = top - STAT_CARD_HEIGHT;

  cards.forEach((card, index) => {
    const x = PAGE_MARGIN + index * (cardWidth + STAT_CARD_GAP);
    layout.page.drawRectangle({
      x,
      y: bottom,
      width: cardWidth,
      height: STAT_CARD_HEIGHT,
      borderColor: COLOR_BORDER,
      borderWidth: 1,
      color: COLOR_CARD_FILL,
    });
    layout.page.drawRectangle({
      x,
      y: top - 3,
      width: cardWidth,
      height: 3,
      color: COLOR_BRAND,
    });
    drawSingleLineText(layout.page, card.value, {
      x: x + 8,
      y: top - 28,
      maxWidth: cardWidth - 16,
      align: "center",
      color: COLOR_TEXT,
      font: layout.fonts.bold,
      fontSize: 19,
    });

    const labelLines = wrapText(
      card.label,
      layout.fonts.regular,
      SMALL_FONT_SIZE,
      cardWidth - 12,
    ).slice(0, 2);
    let labelY = labelLines.length > 1 ? bottom + 14 : bottom + 11;
    for (const line of labelLines) {
      drawSingleLineText(layout.page, line, {
        x: x + 6,
        y: labelY,
        maxWidth: cardWidth - 12,
        align: "center",
        color: COLOR_MUTED,
        font: layout.fonts.regular,
        fontSize: SMALL_FONT_SIZE,
      });
      labelY -= 9;
    }
  });

  layout.cursorY = bottom - 6;
}

function drawCalendarSection(
  layout: ExportPDFLayoutContext,
  calendarDays: readonly ExportPDFCalendarDay[],
  language: ExportPDFReport["language"],
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  if (calendarDays.length === 0) {
    layout.cursorY = drawSectionHeading(layout, pdfCopy.calendarTitle);
    drawCalendarLegend(layout, pdfCopy);
    layout.cursorY = drawTextBlock(layout, pdfCopy.calendarEmpty, {
      color: COLOR_MUTED,
      font: layout.fonts.regular,
      fontSize: BODY_FONT_SIZE,
      lineHeight: LINE_HEIGHT,
    });
    layout.cursorY -= SECTION_GAP - 4;
    return;
  }

  const monthContexts = buildCalendarMonths(calendarDays);
  const rows = Math.ceil(monthContexts.length / MONTH_COLUMNS);
  const monthsHeight =
    rows * MONTH_HEIGHT + Math.max(0, rows - 1) * MONTH_GAP;
  // Keep the heading, legend and the whole month grid together on one page so
  // the legend never strands at the bottom of a page above an empty gap.
  ensurePageSpace(layout, 24 + 46 + monthsHeight + SECTION_GAP);

  layout.cursorY = drawSectionHeading(layout, pdfCopy.calendarTitle);
  drawCalendarLegend(layout, pdfCopy);

  const monthWidth =
    (layout.contentWidth - MONTH_GAP * (MONTH_COLUMNS - 1)) / MONTH_COLUMNS;
  const topY = layout.cursorY;

  monthContexts.forEach((month, index) => {
    const column = index % MONTH_COLUMNS;
    const row = Math.floor(index / MONTH_COLUMNS);
    const x = PAGE_MARGIN + column * (monthWidth + MONTH_GAP);
    const y = topY - row * (MONTH_HEIGHT + MONTH_GAP);
    drawCalendarMonth(layout, month, x, y, monthWidth, language, pdfCopy);
  });

  layout.cursorY = topY - rows * MONTH_HEIGHT - Math.max(0, rows - 1) * MONTH_GAP - 8;
}

function drawCalendarLegend(
  layout: ExportPDFLayoutContext,
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  const top = layout.cursorY - 6;
  drawLegendItem(layout.page, {
    x: PAGE_MARGIN,
    y: top,
    color: COLOR_PERIOD,
    label: pdfCopy.legendPeriod,
    font: layout.fonts.regular,
  });
  drawLegendItem(layout.page, {
    x: PAGE_MARGIN + 112,
    y: top,
    color: COLOR_FERTILE,
    label: pdfCopy.legendFertileWindow,
    font: layout.fonts.regular,
  });
  drawLegendItem(layout.page, {
    x: PAGE_MARGIN + 240,
    y: top,
    color: COLOR_OVULATION,
    label: pdfCopy.legendOvulation,
    font: layout.fonts.regular,
  });

  const bottomRow = top - 14;
  drawLegendItem(layout.page, {
    x: PAGE_MARGIN,
    y: bottomRow,
    color: COLOR_LOGGED,
    label: pdfCopy.legendLoggedDay,
    font: layout.fonts.regular,
  });
  drawLegendItem(layout.page, {
    x: PAGE_MARGIN + 112,
    y: bottomRow,
    color: COLOR_SURFACE,
    label: pdfCopy.legendTentativeOvulation,
    font: layout.fonts.regular,
    borderColor: COLOR_TENTATIVE_BORDER,
  });
  layout.cursorY = bottomRow - 10;
}

function drawCyclesSection(
  layout: ExportPDFLayoutContext,
  cycles: readonly ExportPDFCycle[],
  temperatureUnit: ExportPDFReport["temperatureUnit"],
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  if (cycles.length === 0) {
    ensurePageSpace(layout, 50);
    layout.cursorY = drawTextBlock(
      layout,
      pdfCopy.cyclesEmpty,
      {
        color: COLOR_MUTED,
        font: layout.fonts.regular,
        fontSize: BODY_FONT_SIZE,
        lineHeight: LINE_HEIGHT,
      },
    );
    return;
  }

  for (const [cycleIndex, cycle] of cycles.entries()) {
    ensurePageSpace(layout, 80);
    layout.cursorY = drawSectionHeading(
      layout,
      pdfCopy.cycleTitle(
        cycleIndex + 1,
        cycle.startDate,
        cycle.endDate,
        cycle.cycleLength,
        cycle.periodLength,
      ),
    );
    drawCycleTableHeader(layout, pdfCopy);

    for (const [rowIndex, entry] of cycle.entries.entries()) {
      ensurePageSpace(layout, TABLE_ROW_HEIGHT + 8);
      if (layout.cursorY - TABLE_ROW_HEIGHT < CONTENT_BOTTOM) {
        createNextPage(layout);
        layout.cursorY = drawSectionHeading(
          layout,
          pdfCopy.cycleContinuationTitle(
            cycleIndex + 1,
            cycle.startDate,
            cycle.endDate,
          ),
        );
        drawCycleTableHeader(layout, pdfCopy);
      }
      drawCycleTableRow(layout, entry, rowIndex, temperatureUnit, pdfCopy);
    }

    layout.cursorY -= SECTION_GAP - 6;
  }
}

function drawCalendarMonth(
  layout: ExportPDFLayoutContext,
  month: ExportPDFMonthContext,
  x: number,
  topY: number,
  width: number,
  language: ExportPDFReport["language"],
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  const page = layout.page;
  const monthBottom = topY - MONTH_HEIGHT;
  page.drawRectangle({
    x,
    y: monthBottom,
    width,
    height: MONTH_HEIGHT,
    borderColor: COLOR_BORDER,
    borderWidth: 1,
    color: COLOR_SURFACE,
  });

  drawSingleLineText(page, formatMonthTitle(month.monthStart, language), {
    x: x + MONTH_PADDING,
    y: topY - MONTH_PADDING - 10,
    maxWidth: width - MONTH_PADDING * 2,
    font: layout.fonts.bold,
    fontSize: 9,
  });

  const weekdayTop = topY - 24;
  const innerWidth = width - MONTH_PADDING * 2;
  const cellWidth = innerWidth / 7;
  pdfCopy.weekdays.forEach((weekday, index) => {
    drawSingleLineText(page, weekday, {
      x: x + MONTH_PADDING + index * cellWidth,
      y: weekdayTop,
      maxWidth: cellWidth,
      align: "center",
      color: COLOR_MUTED,
      font: layout.fonts.regular,
      fontSize: 6,
    });
  });

  const gridStart = startOfCalendarGrid(month.monthStart);
  const gridTop = weekdayTop - MONTH_WEEKDAY_HEIGHT;
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const currentDay = addDays(gridStart, row * 7 + column);
      const currentDate = formatDateISO(currentDay);
      const cellX = x + MONTH_PADDING + column * cellWidth;
      const cellBottom = gridTop - row * MONTH_DAY_HEIGHT - MONTH_DAY_HEIGHT + 1;
      const entry = month.daysByDate.get(currentDate);
      const fillColor = entry?.isPeriod
        ? COLOR_PERIOD
        : entry?.isFertile
          ? COLOR_FERTILE
          : entry?.hasData
            ? COLOR_LOGGED
            : COLOR_SURFACE;
      const isTentative = entry?.isTentativeOvulation === true;
      const textColor =
        entry?.isPeriod === true
          ? rgbRuntime(1, 1, 1)
          : currentDay.getMonth() === month.monthStart.getMonth()
            ? COLOR_TEXT
            : hexColor("#B4AA9E");

      page.drawRectangle({
        x: cellX,
        y: cellBottom,
        width: cellWidth,
        height: MONTH_DAY_HEIGHT - 2,
        borderColor: isTentative ? COLOR_TENTATIVE_BORDER : COLOR_BORDER,
        borderWidth: isTentative ? 1.2 : 0.75,
        color: fillColor,
      });

      if (entry?.isOvulation === true) {
        const radius = 2.2;
        page.drawCircle({
          x: cellX + cellWidth - radius - 1.5,
          y: cellBottom + MONTH_DAY_HEIGHT - radius - 2,
          size: radius,
          color: COLOR_OVULATION,
          borderColor: COLOR_OVULATION,
          borderWidth: 0,
        });
      }

      drawSingleLineText(page, String(currentDay.getDate()), {
        x: cellX,
        y: cellBottom + 3.5,
        maxWidth: cellWidth,
        align: "center",
        color: textColor,
        font: layout.fonts.regular,
        fontSize: 6.5,
      });
    }
  }
}

function drawLegendItem(
  page: PDFPage,
  input: {
    color: RGB;
    font: PDFFont;
    label: string;
    x: number;
    y: number;
    borderColor?: RGB;
  },
) {
  page.drawRectangle({
    x: input.x,
    y: input.y,
    width: 9,
    height: 9,
    borderColor: input.borderColor ?? input.color,
    borderWidth: input.borderColor ? 1.2 : 1,
    color: input.color,
  });
  drawSingleLineText(page, input.label, {
    x: input.x + 14,
    y: input.y + 1,
    maxWidth: 110,
    color: COLOR_TEXT,
    font: input.font,
    fontSize: SMALL_FONT_SIZE,
  });
}

function buildCalendarMonths(
  calendarDays: readonly ExportPDFCalendarDay[],
): ExportPDFMonthContext[] {
  const months = new Map<string, ExportPDFMonthContext>();
  for (const day of calendarDays) {
    const parsed = parseLocalDate(day.date);
    if (!parsed) {
      continue;
    }
    const monthStart = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
    const key = formatMonthKey(monthStart);
    const existing = months.get(key);
    if (existing) {
      existing.daysByDate.set(day.date, day);
      continue;
    }

    months.set(key, {
      monthStart,
      daysByDate: new Map([[day.date, day]]),
    });
  }

  return [...months.values()]
    .sort((left, right) => left.monthStart.getTime() - right.monthStart.getTime())
    .slice(-6);
}

function drawCycleTableHeader(
  layout: ExportPDFLayoutContext,
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  ensurePageSpace(layout, TABLE_HEADER_HEIGHT + 8);
  const topY = layout.cursorY;
  let x = PAGE_MARGIN;
  for (const column of TABLE_COLUMNS) {
    layout.page.drawRectangle({
      x,
      y: topY - TABLE_HEADER_HEIGHT,
      width: column.width,
      height: TABLE_HEADER_HEIGHT,
      borderColor: COLOR_BORDER,
      borderWidth: 1,
      color: COLOR_HEADER_FILL,
    });
    const headerLines = wrapText(
      pdfCopy.tableColumns[column.key],
      layout.fonts.bold,
      TABLE_FONT_SIZE,
      column.width - 8,
    ).slice(0, 2);
    const blockHeight = headerLines.length * 9;
    let lineY =
      topY - (TABLE_HEADER_HEIGHT - blockHeight) / 2 - TABLE_FONT_SIZE + 1;
    for (const line of headerLines) {
      drawSingleLineText(layout.page, line, {
        x: x + 4,
        y: lineY,
        maxWidth: column.width - 8,
        align: column.align ?? "left",
        color: COLOR_TEXT,
        font: layout.fonts.bold,
        fontSize: TABLE_FONT_SIZE,
      });
      lineY -= 9;
    }
    x += column.width;
  }
  layout.cursorY = topY - TABLE_HEADER_HEIGHT;
}

function drawCycleTableRow(
  layout: ExportPDFLayoutContext,
  entry: ExportPDFCycleDay,
  rowIndex: number,
  temperatureUnit: ExportPDFReport["temperatureUnit"],
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
) {
  const topY = layout.cursorY;
  const rowFill = rowIndex % 2 === 1 ? COLOR_CARD_FILL : COLOR_SURFACE;
  let x = PAGE_MARGIN;
  for (const column of TABLE_COLUMNS) {
    layout.page.drawRectangle({
      x,
      y: topY - TABLE_ROW_HEIGHT,
      width: column.width,
      height: TABLE_ROW_HEIGHT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
      color: rowFill,
    });
    drawSingleLineText(
      layout.page,
      resolveCycleTableValue(entry, column.key, temperatureUnit, pdfCopy),
      {
        x: x + 4,
        y: topY - TABLE_ROW_HEIGHT + 4.5,
        maxWidth: column.width - 8,
        align: column.align ?? "left",
        color: COLOR_TEXT,
        font: layout.fonts.regular,
        fontSize: TABLE_FONT_SIZE,
      },
    );
    x += column.width;
  }
  layout.cursorY = topY - TABLE_ROW_HEIGHT;
}

function resolveCycleTableValue(
  entry: ExportPDFCycleDay,
  columnKey: ExportPDFCycleTableColumn["key"],
  temperatureUnit: ExportPDFReport["temperatureUnit"],
  pdfCopy: ReturnType<typeof getExportPDFCopy>,
): string {
  switch (columnKey) {
    case "date":
      return entry.date;
    case "cycleDay":
      return String(entry.cycleDay);
    case "period":
      return entry.isPeriod ? pdfCopy.yes : pdfCopy.no;
    case "flow":
      return entry.flow;
    case "mood":
      return entry.moodRating > 0 ? `${entry.moodRating}/5` : "";
    case "sex":
      return entry.sexActivity;
    case "bbt":
      return entry.bbt > 0
        ? `${celsiusToUnit(entry.bbt, temperatureUnit).toFixed(2)} ${temperatureUnit.toUpperCase()}`
        : "";
    case "cervical":
      return entry.cervicalMucus;
    case "lh":
      return entry.lhTest;
    case "symptoms":
      return entry.symptoms.join(", ");
    case "notes": {
      const factorPrefix =
        entry.cycleFactors.length > 0
          ? `${pdfCopy.cycleFactorsPrefix}: ${entry.cycleFactors.join(", ")}`
          : "";
      if (factorPrefix && entry.notes) {
        return `${factorPrefix} | ${entry.notes}`;
      }
      return factorPrefix || entry.notes;
    }
  }
}

function drawSectionHeading(
  layout: ExportPDFLayoutContext,
  text: string,
): number {
  const afterY = drawTextBlock(layout, text, {
    font: layout.fonts.bold,
    fontSize: 13,
    lineHeight: 17,
  });
  const ruleY = afterY - 3;
  layout.page.drawRectangle({
    x: PAGE_MARGIN,
    y: ruleY,
    width: 30,
    height: 2,
    color: COLOR_BRAND,
  });
  layout.page.drawRectangle({
    x: PAGE_MARGIN + 30,
    y: ruleY + 0.5,
    width: layout.contentWidth - 30,
    height: 1,
    color: COLOR_BORDER,
  });
  return afterY - 8;
}

function drawTextBlock(
  layout: ExportPDFLayoutContext,
  text: string,
  options: {
    color?: RGB;
    font: PDFFont;
    fontSize: number;
    lineHeight: number;
    maxWidth?: number;
  },
): number {
  const lines = wrapText(
    text,
    options.font,
    options.fontSize,
    options.maxWidth ?? layout.contentWidth,
  );
  ensurePageSpace(layout, lines.length * options.lineHeight + 4);

  let nextY = layout.cursorY;
  for (const line of lines) {
    drawSingleLineText(layout.page, line, {
      x: PAGE_MARGIN,
      y: nextY - options.fontSize,
      maxWidth: options.maxWidth ?? layout.contentWidth,
      color: options.color ?? COLOR_TEXT,
      font: options.font,
      fontSize: options.fontSize,
    });
    nextY -= options.lineHeight;
  }

  return nextY;
}

function drawSingleLineText(
  page: PDFPage,
  text: string,
  options: {
    align?: "left" | "center";
    color?: RGB;
    font: PDFFont;
    fontSize: number;
    maxWidth: number;
    x: number;
    y: number;
  },
) {
  const safeText = truncateTextToWidth(text, options.font, options.fontSize, options.maxWidth);
  const textWidth = options.font.widthOfTextAtSize(safeText, options.fontSize);
  const textX =
    options.align === "center"
      ? options.x + Math.max(0, (options.maxWidth - textWidth) / 2)
      : options.x;

  page.drawText(safeText, {
    x: textX,
    y: options.y,
    size: options.fontSize,
    font: options.font,
    color: options.color ?? COLOR_TEXT,
  });
}

function ensurePageSpace(layout: ExportPDFLayoutContext, neededHeight: number) {
  if (layout.cursorY - neededHeight >= CONTENT_BOTTOM) {
    return;
  }

  createNextPage(layout);
}

function createNextPage(layout: ExportPDFLayoutContext) {
  layout.page = layout.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  layout.cursorY = PAGE_HEIGHT - PAGE_MARGIN;
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [""];
  }

  const paragraphs = trimmed.split(/\n+/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = words[0] ?? "";
    for (const word of words.slice(1)) {
      const candidate = `${currentLine} ${word}`;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      lines.push(currentLine);
      currentLine = word;
    }
    lines.push(currentLine);
  }

  return lines;
}

function truncateTextToWidth(
  value: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (font.widthOfTextAtSize(trimmed, fontSize) <= maxWidth) {
    return trimmed;
  }

  const ellipsis = "…";
  let low = 0;
  let high = trimmed.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${trimmed.slice(0, middle)}${ellipsis}`;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return `${trimmed.slice(0, low)}${ellipsis}`;
}

function resolveFlowLabel(
  value: DayLogRecord["flow"],
  dayLogLabels: ReturnType<typeof getDayLogCopy>,
): string {
  return value === "none"
    ? ""
    : (dayLogLabels.options.flow.find((option) => option.value === value)?.label ??
        value);
}

function resolveSexActivityLabel(
  value: DayLogRecord["sexActivity"],
  dayLogLabels: ReturnType<typeof getDayLogCopy>,
): string {
  return value === "none"
    ? ""
    : (dayLogLabels.options.sexActivity.find((option) => option.value === value)?.label ??
        value);
}

function resolveCervicalMucusLabel(
  value: DayLogRecord["cervicalMucus"],
  dayLogLabels: ReturnType<typeof getDayLogCopy>,
): string {
  return value === "none"
    ? ""
    : (dayLogLabels.options.cervicalMucus.find((option) => option.value === value)
        ?.label ?? value);
}

function resolveLHTestLabel(
  value: DayLogRecord["lhTest"],
  dayLogLabels: ReturnType<typeof getDayLogCopy>,
): string {
  return value === "none"
    ? ""
    : (dayLogLabels.options.lhTest.find((option) => option.value === value)?.label ??
        value);
}

function resolveCycleFactorLabels(
  values: readonly DayLogRecord["cycleFactorKeys"][number][],
  dayLogLabels: ReturnType<typeof getDayLogCopy>,
): string[] {
  return values.map((value) => dayLogLabels.options.cycleFactors[value].label);
}

function resolveSymptomLabels(
  symptomIDs: readonly string[],
  symptomLookup: Map<string, SymptomRecord>,
): string[] {
  const labels = symptomIDs
    .map((symptomID) => symptomLookup.get(symptomID)?.label.trim() || "")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return labels;
}

function normalizeMood(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildInclusiveCycleEndDate(nextStartDate: string): string {
  const nextStart = parseLocalDate(nextStartDate);
  if (!nextStart) {
    return nextStartDate;
  }

  return formatDateISO(addDays(nextStart, -1));
}

function diffLocalDays(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end) {
    return 0;
  }
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function startOfCalendarGrid(monthStart: Date): Date {
  return addDays(monthStart, -monthStart.getDay());
}

function formatMonthTitle(value: Date, language: ExportPDFReport["language"]): string {
  return value.toLocaleDateString(language, {
    month: "long",
    year: "numeric",
  });
}

function formatMonthKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateISO(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatGeneratedAt(
  value: string,
  language: ExportPDFReport["language"],
): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function hexColor(value: string): RGB {
  const normalized = value.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  return rgbRuntime(red, green, blue);
}
