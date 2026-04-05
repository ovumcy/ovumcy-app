import { getStatsCopy } from "../i18n/stats-copy";
import type { DayLogRecord } from "../models/day-log";
import type { TemperatureUnit } from "../models/profile";
import type { StatsCycleHistorySummary } from "../models/stats";
import {
  buildStatsAdvancedFertility,
  type StatsAdvancedFertilitySummary,
} from "./stats-advanced-fertility-service";
import { parseLocalDate } from "./profile-settings-policy";

export type CurrentCycleAdvancedFertilitySummaryViewData = {
  key: "ovulation-confirmation" | "lh-peak" | "thermal-shift";
  title: string;
  signalLabel: string;
  value: string;
  detail: string;
  hint: string;
  tone: "info" | "success";
};

export function buildCurrentCycleAdvancedFertilitySummary(
  history: StatsCycleHistorySummary,
  records: readonly DayLogRecord[],
  currentCycleAnchorDate: string | null,
  temperatureUnit: TemperatureUnit,
  locale = "en",
  options: {
    visibleDate?: string | null;
  } = {},
): CurrentCycleAdvancedFertilitySummaryViewData | null {
  if (!currentCycleAnchorDate) {
    return null;
  }

  if (options.visibleDate && options.visibleDate < currentCycleAnchorDate) {
    return null;
  }

  const summary = buildStatsAdvancedFertility(
    history,
    records,
    currentCycleAnchorDate,
    temperatureUnit,
  );
  if (!summary) {
    return null;
  }

  return buildSummaryViewData(summary, temperatureUnit, locale);
}

function buildSummaryViewData(
  summary: StatsAdvancedFertilitySummary,
  temperatureUnit: TemperatureUnit,
  locale: string,
): CurrentCycleAdvancedFertilitySummaryViewData | null {
  const statsCopy = getStatsCopy(locale);

  if (summary.ovulationConfirmation) {
    return {
      key: "ovulation-confirmation",
      title: statsCopy.advancedFertility.title,
      signalLabel: statsCopy.advancedFertility.ovulationConfirmationTitle,
      value:
        summary.ovulationConfirmation.kind === "confirmed"
          ? statsCopy.advancedFertility.ovulationConfirmationConfirmedValue
          : statsCopy.advancedFertility.ovulationConfirmationBuildingValue,
      detail: statsCopy.advancedFertility.ovulationConfirmationDescription(
        formatDisplayDate(summary.ovulationConfirmation.mucusDate, locale),
        summary.ovulationConfirmation.gapDays,
      ),
      hint:
        summary.ovulationConfirmation.kind === "confirmed"
          ? statsCopy.advancedFertility.ovulationConfirmationConfirmedHint
          : statsCopy.advancedFertility.ovulationConfirmationBuildingHint,
      tone:
        summary.ovulationConfirmation.kind === "confirmed" ? "success" : "info",
    };
  }

  if (summary.lhPeakSignal) {
    return {
      key: "lh-peak",
      title: statsCopy.advancedFertility.title,
      signalLabel: statsCopy.advancedFertility.lhPeakTitle,
      value:
        summary.lhPeakSignal.kind === "aligned"
          ? statsCopy.advancedFertility.lhPeakAlignedValue
          : statsCopy.advancedFertility.lhPeakLoggedValue,
      detail:
        summary.lhPeakSignal.kind === "aligned" &&
        summary.lhPeakSignal.gapDays !== null
          ? statsCopy.advancedFertility.lhPeakAlignedDescription(
              formatDisplayDate(summary.lhPeakSignal.date, locale),
              summary.lhPeakSignal.gapDays,
            )
          : statsCopy.advancedFertility.lhPeakLoggedDescription(
              formatDisplayDate(summary.lhPeakSignal.date, locale),
            ),
      hint:
        summary.lhPeakSignal.kind === "aligned"
          ? statsCopy.advancedFertility.lhPeakAlignedHint
          : statsCopy.advancedFertility.lhPeakLoggedHint,
      tone: summary.lhPeakSignal.kind === "aligned" ? "success" : "info",
    };
  }

  if (summary.thermalShift) {
    const unitLabel =
      temperatureUnit === "f"
        ? statsCopy.bbtUnitFahrenheit
        : statsCopy.bbtUnitCelsius;

    return {
      key: "thermal-shift",
      title: statsCopy.advancedFertility.title,
      signalLabel: statsCopy.advancedFertility.thermalShiftTitle,
      value:
        summary.thermalShift.kind === "confirmed"
          ? statsCopy.advancedFertility.thermalShiftConfirmedValue
          : statsCopy.advancedFertility.thermalShiftBuildingValue,
      detail:
        summary.thermalShift.kind === "confirmed"
          ? statsCopy.advancedFertility.thermalShiftConfirmedDescription(
              summary.thermalShift.rise.toFixed(2),
              unitLabel,
              summary.thermalShift.sampleCount,
            )
          : statsCopy.advancedFertility.thermalShiftBuildingDescription(
              summary.thermalShift.rise.toFixed(2),
              unitLabel,
              summary.thermalShift.sampleCount,
            ),
      hint:
        summary.thermalShift.kind === "confirmed"
          ? statsCopy.advancedFertility.thermalShiftConfirmedHint
          : statsCopy.advancedFertility.thermalShiftBuildingHint,
      tone: summary.thermalShift.kind === "confirmed" ? "success" : "info",
    };
  }

  return null;
}

function formatDisplayDate(value: string, locale: string): string {
  const parsed = parseLocalDate(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(parsed);
}
