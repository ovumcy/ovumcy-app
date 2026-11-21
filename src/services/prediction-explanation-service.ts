import { getDashboardCopy } from "../i18n/dashboard-copy";
import type { ProfileRecord } from "../models/profile";
import type { StatsCycleProjection } from "../models/stats";

export type PredictionExplanationKind =
  | "approximate"
  | "facts_only"
  | "pregnancy_paused"
  | "variable_ranges";

// Which explanation applies, independent of locale; null when none does.
export function resolvePredictionExplanationKind(
  profile: ProfileRecord,
  projection: StatsCycleProjection,
): PredictionExplanationKind | null {
  if (projection.isPregnancyPaused) {
    return "pregnancy_paused";
  }

  if (profile.unpredictableCycle) {
    return "facts_only";
  }

  if (!projection.cycleAnchorDate) {
    return null;
  }

  if (projection.isPredictionStale) {
    return null;
  }

  if (profile.irregularCycle) {
    return "approximate";
  }

  if (
    projection.nextPeriodWindowStartDate &&
    projection.nextPeriodWindowEndDate &&
    projection.nextPeriodWindowStartDate !== projection.nextPeriodWindowEndDate
  ) {
    return "variable_ranges";
  }

  return null;
}

export function buildPredictionExplanationText(
  kind: Exclude<PredictionExplanationKind, "pregnancy_paused"> | null,
  locale = "en",
): string {
  const dashboardCopy = getDashboardCopy(locale);

  switch (kind) {
    case "facts_only":
      return dashboardCopy.factsOnlyHint;
    case "approximate":
      return dashboardCopy.predictionsApproximateHint;
    case "variable_ranges":
      return dashboardCopy.predictionVariableRangesHint;
    default:
      return "";
  }
}

export function buildPredictionExplanation(
  profile: ProfileRecord,
  projection: StatsCycleProjection,
  locale = "en",
): string {
  const kind = resolvePredictionExplanationKind(profile, projection);
  if (kind === "pregnancy_paused") {
    return getDashboardCopy(locale).pregnancyPausedHint;
  }
  return buildPredictionExplanationText(kind, locale);
}
