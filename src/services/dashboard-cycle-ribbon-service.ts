import { getDashboardCopy } from "../i18n/dashboard-copy";
import { hasDayLogData, type DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import type {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
} from "./cycle-history-service";
import { calcOvulationDay } from "./cycle-prediction-policy";
import { addDays, diffLocalDays, formatLocalDate } from "./profile-settings-policy";

// Web dashboard_cycle_hero.go: the axis is capped so a long start window cannot
// shrink every cell to a hairline.
export const CYCLE_RIBBON_MAX_AXIS_DAYS = 60;
// Below this distance from today, day 1 and the last day lose their scale
// number so it cannot collide with today's.
const CYCLE_RIBBON_SCALE_LABEL_GAP = 3;

export type CycleRibbonPhase =
  | "menstrual"
  | "follicular"
  | "ovulation"
  | "luteal"
  | "withheld"
  | "beyond";

type InCyclePhase = Exclude<CycleRibbonPhase, "beyond">;

export type CycleRibbonCellFlags = {
  phase: CycleRibbonPhase;
  isPredictedFlow: boolean;
  isFertile: boolean;
  isFertilePeak: boolean;
  isStartWindow: boolean;
  isLogged: boolean;
};

export type CycleRibbonDayViewData = CycleRibbonCellFlags & {
  day: number;
  isToday: boolean;
  showScaleLabel: boolean;
};

export type CycleRibbonLegendItemViewData = {
  key: string;
  label: string;
  swatches: CycleRibbonCellFlags[];
};

export type DashboardCycleRibbonViewData = {
  // The ribbon in words (web data-cycle-ribbon-summary): today's day and
  // phase, then every span the legend names.
  accessibilityLabel: string;
  todayLabel: string;
  todayDay: number;
  todayMarkerAlign: "start" | "center" | "end";
  days: CycleRibbonDayViewData[];
  legendLabel: string;
  legend: CycleRibbonLegendItemViewData[];
  truncatedNote: string | null;
};

type DayRange = { startDay: number; endDay: number };

export type BuildDashboardCycleRibbonInput = {
  profile: ProfileRecord;
  projection: ReturnType<typeof buildCurrentCycleProjection>;
  history: ReturnType<typeof buildCycleHistorySummary>;
  records: readonly DayLogRecord[];
  today: Date;
  locale: string;
  // Active pregnancy record OR the day-log pause (SECURITY.md suppression
  // matrix) — see buildDashboardViewData.
  suppressPredictions: boolean;
  postpartumAwaitingCycle: boolean;
};

// Web canRenderDashboardCycleHero: the ribbon draws only the running cycle it
// can place every phase of. Fertility suppression keeps it, with the phases
// past the menstrual span withheld.
export function buildDashboardCycleRibbon({
  profile,
  projection,
  history,
  records,
  today,
  locale,
  suppressPredictions,
  postpartumAwaitingCycle,
}: BuildDashboardCycleRibbonInput): DashboardCycleRibbonViewData | null {
  if (
    suppressPredictions ||
    postpartumAwaitingCycle ||
    projection.isPregnancyPaused ||
    projection.isPredictionStale ||
    projection.cycleDayLooksLong === true ||
    projection.awaitingIrregularHistory ||
    projection.upcomingOvulationNeedsMoreCycles === true ||
    profile.unpredictableCycle ||
    (profile.irregularCycle && !history.hasReliableTrend)
  ) {
    return null;
  }

  const currentDay = projection.currentCycleDay;
  const cycleLength = projection.predictionCycleLength;
  if (
    !projection.cycleAnchorDate ||
    currentDay === null ||
    cycleLength <= 0 ||
    currentDay < 1 ||
    currentDay > cycleLength
  ) {
    return null;
  }

  const periodLength = projection.projectedPeriodLength ?? profile.periodLength;
  if (periodLength < 1 || periodLength >= cycleLength) {
    return null;
  }

  const { day: ovulationDay } = calcOvulationDay(cycleLength, projection.lutealPhase);
  if (ovulationDay === null || ovulationDay <= periodLength + 1 || ovulationDay > cycleLength) {
    return null;
  }

  const fertilitySuppressed = projection.fertilitySuppressed;
  const cycleStart = addDays(today, -(currentDay - 1));
  const cycleStartValue = formatLocalDate(cycleStart);
  const fertile: DayRange | null = fertilitySuppressed
    ? null
    : { startDay: Math.max(1, ovulationDay - 5), endDay: ovulationDay };
  const startWindow = resolveStartWindow(projection, cycleStartValue);
  const uncappedAxisDays = Math.max(cycleLength, startWindow?.endDay ?? 0);
  const axisDays = Math.min(uncappedAxisDays, CYCLE_RIBBON_MAX_AXIS_DAYS);
  const loggedDays = collectLoggedCycleDays(records, cycleStartValue, formatLocalDate(today));

  const days: CycleRibbonDayViewData[] = [];
  for (let day = 1; day <= axisDays; day += 1) {
    const isToday = day === currentDay;
    days.push({
      day,
      phase: resolvePhase(day, cycleLength, periodLength, ovulationDay, fertilitySuppressed),
      isToday,
      isPredictedFlow: day > currentDay && day <= periodLength,
      isFertile: fertile !== null && day >= fertile.startDay && day <= fertile.endDay,
      isFertilePeak: fertile !== null && day === ovulationDay,
      isStartWindow:
        startWindow !== null && day >= startWindow.startDay && day <= startWindow.endDay,
      isLogged: loggedDays.has(day),
      showScaleLabel: resolveShowScaleLabel(day, currentDay, axisDays),
    });
  }

  const copy = getDashboardCopy(locale).cycleRibbon;
  const phaseLabel = (phase: InCyclePhase) => copy.phases[phase];
  const fertileRange = spanOf(days, (day) => day.isFertile);
  const predictedFlowRange = spanOf(days, (day) => day.isPredictedFlow);
  const startWindowRange = spanOf(days, (day) => day.isStartWindow);
  const formatRange = (range: DayRange) =>
    range.startDay === range.endDay
      ? copy.daySingle(range.startDay)
      : copy.daysRange(range.startDay, range.endDay);
  const todayPhase = resolveInCyclePhase(
    currentDay,
    periodLength,
    ovulationDay,
    fertilitySuppressed,
  );

  const summaryParts = [copy.summary(currentDay, cycleLength, phaseLabel(todayPhase))];
  if (fertileRange) {
    summaryParts.push(`${copy.fertile}${copy.colon} ${formatRange(fertileRange)}`);
  }
  if (predictedFlowRange) {
    summaryParts.push(`${copy.predictedPeriod}${copy.colon} ${formatRange(predictedFlowRange)}`);
  }
  if (startWindowRange) {
    summaryParts.push(`${copy.startWindow}${copy.colon} ${formatRange(startWindowRange)}`);
  }

  const legend: CycleRibbonLegendItemViewData[] = distinctPhases(days).map((phase) => ({
    key: `phase-${phase}`,
    label: phaseLabel(phase),
    swatches: [swatch(phase)],
  }));
  if (fertileRange) {
    legend.push({
      key: "fertile",
      label: copy.fertile,
      swatches: [{ ...swatch("beyond"), isFertile: true }],
    });
  }
  if (predictedFlowRange) {
    legend.push({
      key: "predicted-flow",
      label: copy.predictedPeriod,
      swatches: [{ ...swatch("menstrual"), isPredictedFlow: true }],
    });
  }
  if (startWindowRange) {
    legend.push({
      key: "start-window",
      label: copy.startWindow,
      swatches: startWindowPhases(days).map((phase) => ({
        ...swatch(phase),
        isStartWindow: true,
      })),
    });
  }
  if (days.some((day) => day.isLogged)) {
    legend.push({
      key: "logged",
      label: copy.logged,
      swatches: [{ ...swatch("beyond"), isLogged: true }],
    });
  }

  return {
    accessibilityLabel: summaryParts.join(" "),
    todayLabel: copy.today,
    todayDay: currentDay,
    todayMarkerAlign:
      currentDay <= CYCLE_RIBBON_SCALE_LABEL_GAP
        ? "start"
        : currentDay > axisDays - CYCLE_RIBBON_SCALE_LABEL_GAP
          ? "end"
          : "center",
    days,
    legendLabel: copy.legendLabel,
    legend,
    truncatedNote:
      uncappedAxisDays > CYCLE_RIBBON_MAX_AXIS_DAYS ? copy.truncated(axisDays) : null,
  };
}

function resolvePhase(
  day: number,
  cycleLength: number,
  periodLength: number,
  ovulationDay: number,
  fertilitySuppressed: boolean,
): CycleRibbonPhase {
  return day > cycleLength
    ? "beyond"
    : resolveInCyclePhase(day, periodLength, ovulationDay, fertilitySuppressed);
}

function resolveInCyclePhase(
  day: number,
  periodLength: number,
  ovulationDay: number,
  fertilitySuppressed: boolean,
): InCyclePhase {
  if (day <= periodLength) {
    return "menstrual";
  }
  if (fertilitySuppressed) {
    return "withheld";
  }
  if (day < ovulationDay) {
    return "follicular";
  }
  return day === ovulationDay ? "ovulation" : "luteal";
}

// Web DisplayNextPeriodUseRange: only a real range (two different days) is a
// start window; a single next-period date paints none.
function resolveStartWindow(
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  cycleStartValue: string,
): DayRange | null {
  const startDate = projection.nextPeriodWindowStartDate;
  const endDate = projection.nextPeriodWindowEndDate;
  if (!startDate || !endDate || startDate === endDate) {
    return null;
  }
  const startDay = Math.max(1, diffLocalDays(cycleStartValue, startDate) + 1);
  const endDay = diffLocalDays(cycleStartValue, endDate) + 1;
  return endDay >= startDay ? { startDay, endDay } : null;
}

function collectLoggedCycleDays(
  records: readonly DayLogRecord[],
  cycleStartValue: string,
  todayValue: string,
): Set<number> {
  const logged = new Set<number>();
  for (const record of records) {
    if (record.date < cycleStartValue || record.date > todayValue || !hasDayLogData(record)) {
      continue;
    }
    logged.add(diffLocalDays(cycleStartValue, record.date) + 1);
  }
  return logged;
}

function resolveShowScaleLabel(day: number, currentDay: number, axisDays: number): boolean {
  if (day === currentDay) {
    return true;
  }
  if (day !== 1 && day !== axisDays) {
    return false;
  }
  return currentDay > axisDays || Math.abs(day - currentDay) >= CYCLE_RIBBON_SCALE_LABEL_GAP;
}

function spanOf(
  days: readonly CycleRibbonDayViewData[],
  predicate: (day: CycleRibbonDayViewData) => boolean,
): DayRange | null {
  const matching = days.filter(predicate);
  const first = matching[0];
  const last = matching[matching.length - 1];
  return first && last ? { startDay: first.day, endDay: last.day } : null;
}

function distinctPhases(days: readonly CycleRibbonDayViewData[]): InCyclePhase[] {
  const phases: InCyclePhase[] = [];
  for (const day of days) {
    if (day.phase !== "beyond" && !phases.includes(day.phase)) {
      phases.push(day.phase);
    }
  }
  return phases;
}

function startWindowPhases(days: readonly CycleRibbonDayViewData[]): CycleRibbonPhase[] {
  const phases: CycleRibbonPhase[] = [];
  for (const day of days) {
    if (day.isStartWindow && phases[phases.length - 1] !== day.phase) {
      phases.push(day.phase);
    }
  }
  return phases;
}

function swatch(phase: CycleRibbonPhase): CycleRibbonCellFlags {
  return {
    phase,
    isPredictedFlow: false,
    isFertile: false,
    isFertilePeak: false,
    isStartWindow: false,
    isLogged: false,
  };
}
