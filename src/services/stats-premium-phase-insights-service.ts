import type {
  StatsPhase,
  StatsPhaseMoodInsight,
  StatsPhaseSymptomInsight,
  StatsPhaseSymptomInsightItem,
} from "../models/stats";

const MIN_MOOD_CONTRAST_DELTA = 0.6;
const MIN_SYMPTOM_PEAK_PERCENTAGE = 30;
const MIN_SYMPTOM_PEAK_DAYS = 2;

export type StatsPhaseMoodContrastInsight = {
  bestAverageMood: number;
  bestPhase: StatsPhase;
  deltaMood: number;
  worstAverageMood: number;
  worstPhase: StatsPhase;
};

export type StatsPhaseSymptomPeakInsight = {
  percentage: number;
  phase: StatsPhase;
  symptom: StatsPhaseSymptomInsightItem;
  totalDays: number;
};

export type StatsPremiumPhaseInsightsSummary = {
  moodContrast: StatsPhaseMoodContrastInsight | null;
  symptomPeak: StatsPhaseSymptomPeakInsight | null;
};

export function buildStatsPremiumPhaseInsights(
  moodInsights: readonly StatsPhaseMoodInsight[],
  symptomInsights: readonly StatsPhaseSymptomInsight[],
): StatsPremiumPhaseInsightsSummary {
  return {
    moodContrast: buildPhaseMoodContrastInsight(moodInsights),
    symptomPeak: buildPhaseSymptomPeakInsight(symptomInsights),
  };
}

function buildPhaseMoodContrastInsight(
  moodInsights: readonly StatsPhaseMoodInsight[],
): StatsPhaseMoodContrastInsight | null {
  const populated = moodInsights.filter((insight) => insight.hasData);
  if (populated.length < 2) {
    return null;
  }

  const sorted = [...populated].sort(
    (left, right) => left.averageMood - right.averageMood,
  );
  const worst = sorted[0];
  const best = sorted[sorted.length - 1];
  if (!best || !worst || best.phase === worst.phase) {
    return null;
  }

  const deltaMood = best.averageMood - worst.averageMood;
  if (deltaMood < MIN_MOOD_CONTRAST_DELTA) {
    return null;
  }

  return {
    bestAverageMood: best.averageMood,
    bestPhase: best.phase,
    deltaMood,
    worstAverageMood: worst.averageMood,
    worstPhase: worst.phase,
  };
}

function buildPhaseSymptomPeakInsight(
  symptomInsights: readonly StatsPhaseSymptomInsight[],
): StatsPhaseSymptomPeakInsight | null {
  const candidates = symptomInsights
    .filter((insight) => insight.hasData && insight.totalDays >= MIN_SYMPTOM_PEAK_DAYS)
    .map((insight) => {
      const strongestSymptom = [...insight.items].sort((left, right) => {
        if (left.percentage === right.percentage) {
          if (left.count === right.count) {
            return left.label.localeCompare(right.label);
          }
          return right.count - left.count;
        }
        return right.percentage - left.percentage;
      })[0];

      if (!strongestSymptom) {
        return null;
      }

      return {
        percentage: strongestSymptom.percentage,
        phase: insight.phase,
        symptom: strongestSymptom,
        totalDays: insight.totalDays,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .filter((candidate) => candidate.percentage >= MIN_SYMPTOM_PEAK_PERCENTAGE)
    .sort((left, right) => {
      if (left.percentage === right.percentage) {
        if (left.symptom.count === right.symptom.count) {
          return left.phase.localeCompare(right.phase);
        }
        return right.symptom.count - left.symptom.count;
      }
      return right.percentage - left.percentage;
    });

  return candidates[0] ?? null;
}
