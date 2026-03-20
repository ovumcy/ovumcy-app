import type {
  ExportDataSummary,
  ExportDateBounds,
  ExportPreset,
  ExportRangeValues,
} from "../models/export";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

export type ExportValidationErrorCode =
  | "invalid_from_date"
  | "invalid_to_date"
  | "invalid_range";

const PRESET_WINDOW_VALUES: readonly ExportPreset[] = ["all", "30", "90", "365"];

export function sanitizeExportDateInput(raw: string): string {
  const digits = String(raw).replace(/\D+/g, "").slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function createEmptyExportSummary(): ExportDataSummary {
  return {
    totalEntries: 0,
    hasData: false,
    dateFrom: null,
    dateTo: null,
  };
}

export function resolveExportBounds(
  summary: ExportDataSummary,
  now: Date,
): ExportDateBounds {
  if (!summary.hasData || !summary.dateFrom) {
    return {
      minDate: null,
      maxDate: null,
    };
  }

  const today = formatLocalDate(toLocalDay(now));
  const latestAvailable = summary.dateTo ?? summary.dateFrom;

  return {
    minDate: summary.dateFrom,
    maxDate: latestAvailable > today ? latestAvailable : today,
  };
}

export function createDefaultExportRangeValues(
  summary: ExportDataSummary,
  now: Date,
): ExportRangeValues {
  const bounds = resolveExportBounds(summary, now);
  if (!bounds.minDate || !bounds.maxDate) {
    return {
      preset: "all",
      fromDate: "",
      toDate: "",
    };
  }

  return {
    preset: "all",
    fromDate: bounds.minDate,
    toDate: bounds.maxDate,
  };
}

export function applyExportPreset(
  preset: ExportPreset,
  bounds: ExportDateBounds,
  now: Date,
): ExportRangeValues {
  if (!bounds.minDate || !bounds.maxDate) {
    return {
      preset,
      fromDate: "",
      toDate: "",
    };
  }

  if (preset === "custom") {
    return {
      preset,
      fromDate: bounds.minDate,
      toDate: bounds.maxDate,
    };
  }

  if (preset === "all") {
    return {
      preset,
      fromDate: bounds.minDate,
      toDate: bounds.maxDate,
    };
  }

  const days = Number(preset);
  if (!Number.isFinite(days) || days < 1) {
    return {
      preset: "custom",
      fromDate: bounds.minDate,
      toDate: bounds.maxDate,
    };
  }

  const upperBound = resolveEffectivePresetUpperBound(bounds, now);
  const upperDate = parseLocalDate(upperBound);
  if (!upperDate) {
    return {
      preset: "custom",
      fromDate: bounds.minDate,
      toDate: bounds.maxDate,
    };
  }

  const lowerDate = addDays(upperDate, -days + 1);
  const clampedLower = clampDateToBounds(formatLocalDate(lowerDate), bounds);

  return {
    preset,
    fromDate: clampedLower ?? bounds.minDate,
    toDate: upperBound,
  };
}

export function resolveExportPresetSelection(
  values: ExportRangeValues,
  bounds: ExportDateBounds,
  now: Date,
): ExportPreset {
  for (const preset of PRESET_WINDOW_VALUES) {
    const presetRange = applyExportPreset(preset, bounds, now);
    if (
      presetRange.fromDate === values.fromDate &&
      presetRange.toDate === values.toDate
    ) {
      return preset;
    }
  }

  return "custom";
}

export function validateExportRangeValues(
  values: ExportRangeValues,
  bounds: ExportDateBounds,
): { ok: true; fromDate: string; toDate: string } | {
  ok: false;
  errorCode: ExportValidationErrorCode;
} {
  const normalizedFrom = String(values.fromDate || "").trim();
  const normalizedTo = String(values.toDate || "").trim();

  const parsedFrom = parseLocalDate(normalizedFrom);
  if (!parsedFrom || formatLocalDate(parsedFrom) !== normalizedFrom) {
    return {
      ok: false,
      errorCode: "invalid_from_date",
    };
  }

  const parsedTo = parseLocalDate(normalizedTo);
  if (!parsedTo || formatLocalDate(parsedTo) !== normalizedTo) {
    return {
      ok: false,
      errorCode: "invalid_to_date",
    };
  }

  if (!isDateWithinBounds(normalizedFrom, bounds)) {
    return {
      ok: false,
      errorCode: "invalid_from_date",
    };
  }
  if (!isDateWithinBounds(normalizedTo, bounds)) {
    return {
      ok: false,
      errorCode: "invalid_to_date",
    };
  }

  if (normalizedTo < normalizedFrom) {
    return {
      ok: false,
      errorCode: "invalid_range",
    };
  }

  return {
    ok: true,
    fromDate: normalizedFrom,
    toDate: normalizedTo,
  };
}

export function clampDateToBounds(
  rawDate: string,
  bounds: ExportDateBounds,
): string | null {
  if (!rawDate) {
    return null;
  }

  const parsed = parseLocalDate(rawDate);
  if (!parsed || formatLocalDate(parsed) !== rawDate) {
    return null;
  }

  if (bounds.minDate && rawDate < bounds.minDate) {
    return bounds.minDate;
  }
  if (bounds.maxDate && rawDate > bounds.maxDate) {
    return bounds.maxDate;
  }

  return rawDate;
}

function resolveEffectivePresetUpperBound(
  bounds: ExportDateBounds,
  now: Date,
): string {
  if (!bounds.maxDate) {
    return formatLocalDate(toLocalDay(now));
  }

  const today = formatLocalDate(toLocalDay(now));
  return bounds.maxDate < today ? bounds.maxDate : today;
}

function toLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isDateWithinBounds(
  rawDate: string,
  bounds: ExportDateBounds,
): boolean {
  if (!rawDate) {
    return false;
  }
  if (bounds.minDate && rawDate < bounds.minDate) {
    return false;
  }
  if (bounds.maxDate && rawDate > bounds.maxDate) {
    return false;
  }

  return true;
}
