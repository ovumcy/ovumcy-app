import { getDashboardCopy } from "../i18n/dashboard-copy";
import type { PregnancyRecord } from "../models/pregnancy";
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

// True when the paused projection's positive test belongs to an ended
// pregnancy: an ended record's endedAt on/after that test date (a postpartum
// record passes its birth date as endedAt). A positive test dated after the
// latest ended pregnancy is a new event. Only the pause's wording reads this;
// the pause itself stays owned by cycle-history-service.
export function isPausedTestConcluded(
  projection: StatsCycleProjection,
  endedPregnancies: readonly Pick<PregnancyRecord, "endedAt">[],
): boolean {
  const pregnancyTestDate = projection.pregnancyTestDate;
  return (
    pregnancyTestDate !== null &&
    endedPregnancies.some(
      (record) => record.endedAt !== null && record.endedAt >= pregnancyTestDate,
    )
  );
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
