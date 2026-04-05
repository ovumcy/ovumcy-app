import { STATS_SYMPTOM_PATTERN_LIMIT, type StatsSymptomPattern } from "../models/stats";

export type StatsPersonalForecast = {
  dayEnd: number;
  dayStart: number;
  id: string;
  icon: string;
  label: string;
  offsetEnd: number;
  offsetStart: number;
};

const PERSONAL_FORECAST_LIMIT = Math.min(3, STATS_SYMPTOM_PATTERN_LIMIT);

export function buildStatsPersonalForecasts(
  symptomPatterns: readonly StatsSymptomPattern[],
  currentCycleDay: number | null,
): StatsPersonalForecast[] {
  if (currentCycleDay === null) {
    return [];
  }

  return symptomPatterns
    .map((pattern) => ({
      dayEnd: pattern.dayEnd,
      dayStart: pattern.dayStart,
      id: pattern.id,
      icon: pattern.icon,
      label: pattern.label,
      offsetEnd: pattern.dayEnd - currentCycleDay,
      offsetStart: pattern.dayStart - currentCycleDay,
      occurrenceCount: pattern.occurrenceCount,
    }))
    .filter((pattern) => pattern.offsetEnd >= 0)
    .sort((left, right) => {
      const leftDistance = Math.max(left.offsetStart, 0);
      const rightDistance = Math.max(right.offsetStart, 0);
      if (leftDistance === rightDistance) {
        if (left.occurrenceCount === right.occurrenceCount) {
          return left.label.localeCompare(right.label);
        }
        return right.occurrenceCount - left.occurrenceCount;
      }
      return leftDistance - rightDistance;
    })
    .slice(0, PERSONAL_FORECAST_LIMIT)
    .map(({ occurrenceCount: _occurrenceCount, ...pattern }) => pattern);
}
