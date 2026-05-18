import type { DayLogRecord } from "../models/day-log";
import type { LocalDateISO, TemperatureUnit } from "../models/profile";

const MIN_BBT_POINTS_FOR_OVULATION = 5;
const BBT_BASELINE_WINDOW = 5;
const BBT_SHIFT_STREAK_LENGTH = 3;
const BBT_SHIFT_THRESHOLD_CELSIUS = 0.2;
const BBT_SHIFT_THRESHOLD_FAHRENHEIT = 0.35;

export function inferBBTOvulationDate(
  records: readonly DayLogRecord[],
  cycleStartDate: LocalDateISO,
  cycleEndDate: LocalDateISO,
  temperatureUnit: TemperatureUnit,
): LocalDateISO | null {
  const points = records
    .filter(
      (record) =>
        record.bbt > 0 &&
        record.date >= cycleStartDate &&
        record.date < cycleEndDate,
    )
    .sort((left, right) => left.date.localeCompare(right.date));

  if (points.length < MIN_BBT_POINTS_FOR_OVULATION) {
    return null;
  }

  const baselineTotal = points
    .slice(0, BBT_BASELINE_WINDOW)
    .reduce((sum, point) => sum + point.bbt, 0);
  const baseline = baselineTotal / BBT_BASELINE_WINDOW;
  const threshold =
    baseline +
    (temperatureUnit === "f"
      ? BBT_SHIFT_THRESHOLD_FAHRENHEIT
      : BBT_SHIFT_THRESHOLD_CELSIUS);

  let streak = 0;
  for (let index = BBT_BASELINE_WINDOW; index < points.length; index += 1) {
    const point = points[index];
    if (!point) {
      continue;
    }
    if (point.bbt >= threshold) {
      streak += 1;
    } else {
      streak = 0;
    }
    if (streak >= BBT_SHIFT_STREAK_LENGTH) {
      return points[index - 2]?.date ?? null;
    }
  }

  return null;
}

export function inferEggWhiteOvulationDate(
  records: readonly DayLogRecord[],
  cycleStartDate: LocalDateISO,
  cycleEndDate: LocalDateISO,
): LocalDateISO | null {
  const eggwhite = records
    .filter(
      (record) =>
        record.cervicalMucus === "eggwhite" &&
        record.date >= cycleStartDate &&
        record.date < cycleEndDate,
    )
    .sort((left, right) => left.date.localeCompare(right.date));

  return eggwhite[eggwhite.length - 1]?.date ?? null;
}

export function inferObservedOvulationDate(
  records: readonly DayLogRecord[],
  cycleStartDate: LocalDateISO,
  cycleEndDate: LocalDateISO,
  temperatureUnit: TemperatureUnit,
): LocalDateISO | null {
  const bbtDate = inferBBTOvulationDate(
    records,
    cycleStartDate,
    cycleEndDate,
    temperatureUnit,
  );
  if (bbtDate) {
    return bbtDate;
  }
  return inferEggWhiteOvulationDate(records, cycleStartDate, cycleEndDate);
}
