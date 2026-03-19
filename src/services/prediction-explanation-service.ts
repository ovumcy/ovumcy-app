import { getDashboardCopy } from "../i18n/dashboard-copy";
import type { ProfileRecord } from "../models/profile";
import type { StatsCycleProjection } from "../models/stats";

export function buildPredictionExplanation(
  profile: ProfileRecord,
  projection: StatsCycleProjection,
  locale = "en",
): string {
  const dashboardCopy = getDashboardCopy(locale);

  if (profile.unpredictableCycle) {
    return dashboardCopy.factsOnlyHint;
  }

  if (!profile.lastPeriodStart) {
    return "";
  }

  if (profile.irregularCycle) {
    return "";
  }

  if (!projection.ovulationDate) {
    return "";
  }

  return "";
}
