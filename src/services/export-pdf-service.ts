import { type PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

import { dayLogCopy } from "../i18n/day-log-copy";
import type {
  ExportPDFCalendarDay,
  ExportPDFCycle,
  ExportPDFCycleDay,
  ExportPDFReport,
  ExportPDFSummary,
} from "../models/export";
import { hasDayLogData, type DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import { buildCycleHistorySummary } from "./cycle-history-service";
import { loadExportPDFFontBytes, type ExportPDFFontBytes } from "./export-pdf-fonts";
import {
  fontkitRuntime,
  PageSizesRuntime,
  PDFDocumentRuntime,
  rgbRuntime,
} from "./export-pdf-runtime";
import { parseLocalDate } from "./profile-settings-policy";

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
const TABLE_HEADER_HEIGHT = 18;
const TABLE_COLUMN_WIDTHS = [52, 38, 34, 42, 34, 40, 42, 56, 124, 122] as const;

const COLOR_TEXT = hexColor("#4B3D31");
const COLOR_MUTED = hexColor("#7F6A57");
const COLOR_BORDER = hexColor("#DCC8B5");
const COLOR_SURFACE = hexColor("#FFFFFF");
const COLOR_PERIOD = hexColor("#C7756D");
const COLOR_LOGGED = hexColor("#E9D0B4");
const COLOR_HEADER_FILL = hexColor("#FAF4ED");

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
    | "symptoms"
    | "notes";
  label: string;
  width: number;
};

const TABLE_COLUMNS: readonly ExportPDFCycleTableColumn[] = [
  { key: "date", label: "Date", width: TABLE_COLUMN_WIDTHS[0] },
  { key: "cycleDay", label: "Cycle day", width: TABLE_COLUMN_WIDTHS[1], align: "center" },
  { key: "period", label: "Period", width: TABLE_COLUMN_WIDTHS[2], align: "center" },
  { key: "flow", label: "Flow", width: TABLE_COLUMN_WIDTHS[3] },
  { key: "mood", label: "Mood", width: TABLE_COLUMN_WIDTHS[4], align: "center" },
  { key: "sex", label: "Sex", width: TABLE_COLUMN_WIDTHS[5] },
  { key: "bbt", label: "BBT", width: TABLE_COLUMN_WIDTHS[6] },
  { key: "cervical", label: "Cervical mucus", width: TABLE_COLUMN_WIDTHS[7] },
  { key: "symptoms", label: "Symptoms", width: TABLE_COLUMN_WIDTHS[8] },
  { key: "notes", label: "Notes", width: TABLE_COLUMN_WIDTHS[9] },
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
        return buildExportPDFCycleDay(record, cycle.startDate, symptomLookup);
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

  return {
    generatedAt: now.toISOString(),
    summary: buildExportPDFSummary(cycles, includedLogs),
    calendarDays: sortedDayLogs.map((record) => ({
      date: record.date,
      isPeriod: record.isPeriod,
      hasData: hasDayLogData(record),
    })),
    cycles,
    temperatureUnit: profile.temperatureUnit,
  };
}

function buildExportPDFCycleDay(
  record: DayLogRecord,
  cycleStartDate: string,
  symptomLookup: Map<string, SymptomRecord>,
): ExportPDFCycleDay {
  return {
    date: record.date,
    cycleDay: diffLocalDays(cycleStartDate, record.date) + 1,
    isPeriod: record.isPeriod,
    flow: record.isPeriod ? resolveFlowLabel(record.flow) : "",
    moodRating: normalizeMood(record.mood),
    sexActivity: resolveSexActivityLabel(record.sexActivity),
    bbt: record.bbt > 0 ? record.bbt : 0,
    cervicalMucus: resolveCervicalMucusLabel(record.cervicalMucus),
    cycleFactors: resolveCycleFactorLabels(record.cycleFactorKeys),
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

async function renderExportPDFDocument(
  report: ExportPDFReport,
  fontBytesLoader: () => Promise<ExportPDFFontBytes>,
): Promise<Uint8Array> {
  const fontBytes = await fontBytesLoader();
  const doc = await PDFDocumentRuntime.create();
  doc.registerFontkit(fontkitRuntime);

  const [regularFont, boldFont] = await Promise.all([
    doc.embedFont(fontBytes.regular, { subset: true }),
    doc.embedFont(fontBytes.bold, { subset: true }),
  ]);

  const layout = createLayoutContext(doc, regularFont, boldFont);

  drawDocumentHeader(layout, report);
  drawSummarySection(layout, report.summary);
  drawCalendarSection(layout, report.calendarDays);
  drawCyclesSection(layout, report.cycles, report.temperatureUnit);

  return doc.save();
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
) {
  layout.cursorY = drawTextBlock(layout, "Ovumcy report for doctor", {
    font: layout.fonts.bold,
    fontSize: 18,
    lineHeight: 22,
  });
  layout.cursorY = drawTextBlock(
    layout,
    `Generated: ${formatGeneratedAt(report.generatedAt)}`,
    {
      color: COLOR_MUTED,
      font: layout.fonts.regular,
      fontSize: SMALL_FONT_SIZE,
      lineHeight: 12,
    },
  );
  layout.cursorY -= SECTION_GAP - 6;
}

function drawSummarySection(
  layout: ExportPDFLayoutContext,
  summary: ExportPDFSummary,
) {
  layout.cursorY = drawSectionHeading(layout, "Summary");

  const lines = [
    `Logged days: ${summary.loggedDays}`,
    `Completed cycles: ${summary.completedCycles}`,
    ...(summary.averageCycleLength > 0
      ? [`Average cycle length: ${summary.averageCycleLength.toFixed(1)}`]
      : []),
    ...(summary.averagePeriodLength > 0
      ? [`Average period length: ${summary.averagePeriodLength.toFixed(1)}`]
      : []),
    ...(summary.hasAverageMood
      ? [`Average mood: ${summary.averageMood.toFixed(1)} / 5`]
      : []),
    ...(summary.rangeStart && summary.rangeEnd
      ? [`Range: ${summary.rangeStart} - ${summary.rangeEnd}`]
      : []),
  ];

  for (const line of lines) {
    layout.cursorY = drawTextBlock(layout, line, {
      color: COLOR_TEXT,
      font: layout.fonts.regular,
      fontSize: BODY_FONT_SIZE,
      lineHeight: LINE_HEIGHT,
    });
  }
  layout.cursorY -= SECTION_GAP - 4;
}

function drawCalendarSection(
  layout: ExportPDFLayoutContext,
  calendarDays: readonly ExportPDFCalendarDay[],
) {
  layout.cursorY = drawSectionHeading(layout, "Color calendar");
  drawCalendarLegend(layout);

  if (calendarDays.length === 0) {
    layout.cursorY = drawTextBlock(layout, "No recorded days yet.", {
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
  const neededHeight =
    rows * MONTH_HEIGHT + Math.max(0, rows - 1) * MONTH_GAP + SECTION_GAP;
  ensurePageSpace(layout, neededHeight);

  const monthWidth =
    (layout.contentWidth - MONTH_GAP * (MONTH_COLUMNS - 1)) / MONTH_COLUMNS;
  const topY = layout.cursorY;

  monthContexts.forEach((month, index) => {
    const column = index % MONTH_COLUMNS;
    const row = Math.floor(index / MONTH_COLUMNS);
    const x = PAGE_MARGIN + column * (monthWidth + MONTH_GAP);
    const y = topY - row * (MONTH_HEIGHT + MONTH_GAP);
    drawCalendarMonth(layout, month, x, y, monthWidth);
  });

  layout.cursorY = topY - rows * MONTH_HEIGHT - Math.max(0, rows - 1) * MONTH_GAP - 8;
}

function drawCalendarLegend(layout: ExportPDFLayoutContext) {
  const top = layout.cursorY - 6;
  drawLegendItem(layout.page, {
    x: PAGE_MARGIN,
    y: top,
    color: COLOR_PERIOD,
    label: "Period",
    font: layout.fonts.regular,
  });
  drawLegendItem(layout.page, {
    x: PAGE_MARGIN + 112,
    y: top,
    color: COLOR_LOGGED,
    label: "Logged day",
    font: layout.fonts.regular,
  });
  layout.cursorY = top - 10;
}

function drawCyclesSection(
  layout: ExportPDFLayoutContext,
  cycles: readonly ExportPDFCycle[],
  temperatureUnit: ExportPDFReport["temperatureUnit"],
) {
  if (cycles.length === 0) {
    ensurePageSpace(layout, 50);
    layout.cursorY = drawTextBlock(
      layout,
      "Not enough completed cycles to build a doctor-focused report yet.",
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
      `Cycle ${cycleIndex + 1}: ${cycle.startDate} - ${cycle.endDate} (len ${cycle.cycleLength}, period ${cycle.periodLength})`,
    );
    drawCycleTableHeader(layout);

    for (const entry of cycle.entries) {
      ensurePageSpace(layout, TABLE_ROW_HEIGHT + 8);
      if (layout.cursorY - TABLE_ROW_HEIGHT < PAGE_MARGIN) {
        createNextPage(layout);
        layout.cursorY = drawSectionHeading(
          layout,
          `Cycle ${cycleIndex + 1}: ${cycle.startDate} - ${cycle.endDate} (continued)`,
        );
        drawCycleTableHeader(layout);
      }
      drawCycleTableRow(layout, entry, temperatureUnit);
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

  drawSingleLineText(page, formatMonthTitle(month.monthStart), {
    x: x + MONTH_PADDING,
    y: topY - MONTH_PADDING - 10,
    maxWidth: width - MONTH_PADDING * 2,
    font: layout.fonts.bold,
    fontSize: 9,
  });

  const weekdayTop = topY - 24;
  const innerWidth = width - MONTH_PADDING * 2;
  const cellWidth = innerWidth / 7;
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  weekdays.forEach((weekday, index) => {
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
        : entry?.hasData
          ? COLOR_LOGGED
          : COLOR_SURFACE;
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
        borderColor: COLOR_BORDER,
        borderWidth: 0.75,
        color: fillColor,
      });

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
  },
) {
  page.drawRectangle({
    x: input.x,
    y: input.y,
    width: 9,
    height: 9,
    borderColor: input.color,
    borderWidth: 1,
    color: input.color,
  });
  drawSingleLineText(page, input.label, {
    x: input.x + 14,
    y: input.y + 1,
    maxWidth: 80,
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

function drawCycleTableHeader(layout: ExportPDFLayoutContext) {
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
    drawSingleLineText(layout.page, column.label, {
      x: x + 4,
      y: topY - TABLE_HEADER_HEIGHT + 5,
      maxWidth: column.width - 8,
      align: column.align ?? "left",
      color: COLOR_TEXT,
      font: layout.fonts.bold,
      fontSize: TABLE_FONT_SIZE,
    });
    x += column.width;
  }
  layout.cursorY = topY - TABLE_HEADER_HEIGHT;
}

function drawCycleTableRow(
  layout: ExportPDFLayoutContext,
  entry: ExportPDFCycleDay,
  temperatureUnit: ExportPDFReport["temperatureUnit"],
) {
  const topY = layout.cursorY;
  let x = PAGE_MARGIN;
  for (const column of TABLE_COLUMNS) {
    layout.page.drawRectangle({
      x,
      y: topY - TABLE_ROW_HEIGHT,
      width: column.width,
      height: TABLE_ROW_HEIGHT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.75,
      color: COLOR_SURFACE,
    });
    drawSingleLineText(layout.page, resolveCycleTableValue(entry, column.key, temperatureUnit), {
      x: x + 4,
      y: topY - TABLE_ROW_HEIGHT + 4.5,
      maxWidth: column.width - 8,
      align: column.align ?? "left",
      color: COLOR_TEXT,
      font: layout.fonts.regular,
      fontSize: TABLE_FONT_SIZE,
    });
    x += column.width;
  }
  layout.cursorY = topY - TABLE_ROW_HEIGHT;
}

function resolveCycleTableValue(
  entry: ExportPDFCycleDay,
  columnKey: ExportPDFCycleTableColumn["key"],
  temperatureUnit: ExportPDFReport["temperatureUnit"],
): string {
  switch (columnKey) {
    case "date":
      return entry.date;
    case "cycleDay":
      return String(entry.cycleDay);
    case "period":
      return entry.isPeriod ? "Yes" : "No";
    case "flow":
      return entry.flow;
    case "mood":
      return entry.moodRating > 0 ? `${entry.moodRating}/5` : "";
    case "sex":
      return entry.sexActivity;
    case "bbt":
      return entry.bbt > 0 ? `${entry.bbt.toFixed(2)} ${temperatureUnit.toUpperCase()}` : "";
    case "cervical":
      return entry.cervicalMucus;
    case "symptoms":
      return entry.symptoms.join(", ");
    case "notes": {
      const factorPrefix =
        entry.cycleFactors.length > 0
          ? `Cycle factors: ${entry.cycleFactors.join(", ")}`
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
  return drawTextBlock(layout, text, {
    font: layout.fonts.bold,
    fontSize: 12,
    lineHeight: 16,
  });
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
  if (layout.cursorY - neededHeight >= PAGE_MARGIN) {
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

function resolveFlowLabel(value: DayLogRecord["flow"]): string {
  return value === "none"
    ? ""
    : (dayLogCopy.options.flow.find((option) => option.value === value)?.label ?? value);
}

function resolveSexActivityLabel(value: DayLogRecord["sexActivity"]): string {
  return value === "none"
    ? ""
    : (dayLogCopy.options.sexActivity.find((option) => option.value === value)?.label ?? value);
}

function resolveCervicalMucusLabel(
  value: DayLogRecord["cervicalMucus"],
): string {
  return value === "none"
    ? ""
    : (dayLogCopy.options.cervicalMucus.find((option) => option.value === value)?.label ??
        value);
}

function resolveCycleFactorLabels(
  values: readonly DayLogRecord["cycleFactorKeys"][number][],
): string[] {
  return values.map((value) => dayLogCopy.options.cycleFactors[value].label);
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

function formatMonthTitle(value: Date): string {
  return value.toLocaleDateString("en-US", {
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

function formatGeneratedAt(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
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
