import { getDashboardCopy } from "../i18n/dashboard-copy";
import { getPregnancyCopy } from "../i18n/pregnancy-copy";
import { getStatsCopy } from "../i18n/stats-copy";
import type { DayLogRecord } from "../models/day-log";
import type { PregnancyRecord } from "../models/pregnancy";
import type { PostpartumRecord } from "../models/postpartum";
import type { ScreeningResponse } from "../models/screening";
import type { ProfileRecord } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { loadPregnancyModuleOwned } from "./pregnancy-entitlement-service";
import {
  buildPregnancyDashboardViewData,
  buildPregnancyStaleCardViewData,
  type PregnancyDashboardViewData,
  type PregnancyStaleCardViewData,
} from "./pregnancy-mode-service";
import {
  buildPostpartumDashboardViewData,
  buildPostpartumStaleCardViewData,
  type PostpartumDashboardViewData,
  type PostpartumStaleCardViewData,
} from "./postpartum-mode-service";
import {
  buildDayLogEditorViewData,
  type DayLogEditorViewData,
} from "./day-log-editor-service";
import {
  buildCycleHistorySummary,
  buildCurrentCycleProjection,
  collectCycleStartDates,
} from "./cycle-history-service";
import { calcOvulationDay, predictCycleWindow } from "./cycle-prediction-policy";
import { buildPredictionExplanation } from "./prediction-explanation-service";
import { filterKnownSymptomIDs } from "./symptom-policy";
import {
  diffLocalDays,
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";
import {
  buildCurrentCycleAdvancedFertilitySummary,
  type CurrentCycleAdvancedFertilitySummaryViewData,
} from "./current-cycle-advanced-fertility-summary-service";

type DashboardCycleHeroPhaseKey =
  | "period"
  | "follicular"
  | "ovulation"
  | "luteal";

export type DashboardCycleHeroViewData = {
  state: "regular" | "approximate" | "facts_only" | "unknown" | "stale";
  title: string;
  value: string;
  detail: string;
  caption: string;
  // Web parity (dashboard.html:122, DisplayOvulationDate): the upcoming-ovulation
  // line the dashboard shows next to the next-period caption. Precomputed and
  // formatted here (never parsed by UI) — null hides the element entirely.
  // `projection.upcomingOvulationDate` is null/undefined on every
  // non-predictable path (pregnancy pause, unpredictable-cycle mode, no
  // resolvable anchor, or an uncalculable window) — see the doc comment on
  // that field in src/models/stats.ts — so hiding on that one falsy check is
  // sufficient and needs no separate gating here.
  upcomingOvulationLabel: string | null;
  progressPercent: number | null;
  currentTone: DashboardCycleHeroPhaseKey | "neutral";
  phaseSegments: {
    key: DashboardCycleHeroPhaseKey;
    startPercent: number;
    endPercent: number;
    tone: DashboardCycleHeroPhaseKey;
  }[];
  phaseCards: {
    key: DashboardCycleHeroPhaseKey;
    label: string;
    rangeLabel: string;
    tone: DashboardCycleHeroPhaseKey;
    active: boolean;
  }[];
};

// Additive pregnancy-mode discriminant. `mode` is a presentational switch
// only — absent/"cycle" renders the existing dashboard unchanged; "pregnancy"
// renders `pregnancyDashboard` instead of the cycle-oriented sections. The
// entry card appears in cycle mode when the pregnancy pause is active and no
// pregnancy record exists yet. All branching is decided here, never on screens.
export type PregnancyEntryCardViewData = {
  variant: "start_pregnancy" | "premium_locked";
  eyebrowLabel: string;
  title: string;
  description: string;
  ctaLabel: string;
};

export type DashboardViewData = {
  // "pregnancy" REPLACES the cycle surface; "postpartum" is ADDITIVE (the
  // postpartum cards render above the still-visible cycle journal/quick
  // actions, since bleeding/lochia logging matters postpartum). Absent/"cycle"
  // renders the existing dashboard unchanged.
  mode?: "cycle" | "pregnancy" | "postpartum";
  pregnancyEntryCard?: PregnancyEntryCardViewData;
  pregnancyDashboard?: PregnancyDashboardViewData;
  // Postpartum-mode view-data. Present only when an active postpartum
  // record renders and no active pregnancy takes precedence — see
  // buildPregnancySection.
  postpartumDashboard?: PostpartumDashboardViewData;
  // Compact card for an active postpartum record past the trackable window
  // (birth date > ~6 months ago). Cycle mode stays "cycle" alongside it,
  // mirroring the pregnancy staleCard.
  postpartumStaleCard?: PostpartumStaleCardViewData;
  // Compact card for an active pregnancy record stuck outside the trackable
  // GA window (today far past the due date) -- see buildPregnancySection.
  // Cycle mode ("mode" stays "cycle") renders normally alongside it.
  staleCard?: PregnancyStaleCardViewData;
  cycleHero: DashboardCycleHeroViewData;
  predictionExplanation: string;
  // Web parity (dashboard.html data-dashboard-prediction-disclaimer): a
  // persistent "estimates, not medical advice or contraception" disclaimer near
  // the prediction surfaces. Always present on the dashboard, which is the
  // owner's own-device surface (web gates on {{if .IsOwner}}; the partner shared
  // view is a separate screen and never reuses this view-data).
  predictionDisclaimer: string;
  advancedFertilitySummary?: CurrentCycleAdvancedFertilitySummaryViewData;
  quickActionsTitle: string;
  quickActions: {
    period: string;
    mood: string;
    symptom: string;
  };
  journal: {
    title: string;
    dateLabel: string;
  };
  // Contextual day-save confirmation shown after the today-journal autosaves,
  // ported from ovumcy-web's day-feedback policy. Computed for today from the
  // canonical projection (pregnancy pause included) — see resolveDaySaveMessage.
  daySaveMessage: string;
};

export type DaySaveMessageKey =
  | "pregnancy_paused"
  | "self_care"
  | "fertile"
  | "neutral";

const DAY_SAVE_SELF_CARE_MAX_CYCLE_DAY = 3;

// Port of ovumcy-web's resolveDaySaveMessageKey (day_feedback_policy.go): the
// contextual save-confirmation message key. Priority: a positive-pregnancy pause
// wins over everything, then unpredictable-cycle mode stays neutral, then the
// first three cycle days offer a self-care nudge, then the fertile window, else
// neutral. The pregnancy pause is resolved once in buildCurrentCycleProjection
// and only READ here — never re-derived in the screen (SECURITY.md medical
// safety: every prediction surface honors the pause through the projection).
export function resolveDaySaveMessageKey(
  day: string,
  profile: ProfileRecord,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
): DaySaveMessageKey {
  if (projection.isPregnancyPaused) {
    return "pregnancy_paused";
  }
  if (profile.unpredictableCycle) {
    return "neutral";
  }
  if (projection.cycleAnchorDate) {
    const cycleDay = diffLocalDays(projection.cycleAnchorDate, day) + 1;
    if (cycleDay >= 1 && cycleDay <= DAY_SAVE_SELF_CARE_MAX_CYCLE_DAY) {
      return "self_care";
    }
    const window = predictCycleWindow(
      projection.cycleAnchorDate,
      projection.predictionCycleLength,
      projection.lutealPhase,
    );
    if (
      window.fertilityStart &&
      window.fertilityEnd &&
      day >= window.fertilityStart &&
      day <= window.fertilityEnd
    ) {
      return "fertile";
    }
  }
  return "neutral";
}

export function resolveDaySaveMessage(
  day: string,
  profile: ProfileRecord,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  locale = "en",
): string {
  const dashboardCopy = getDashboardCopy(locale);
  switch (resolveDaySaveMessageKey(day, profile, projection)) {
    case "pregnancy_paused":
      return dashboardCopy.saveMessagePregnancyPaused;
    case "self_care":
      return dashboardCopy.saveMessageSelfCare;
    case "fertile":
      return dashboardCopy.saveMessageFertile;
    default:
      return dashboardCopy.saveMessageNeutral;
  }
}

export type LoadedDashboardState = {
  historyRecords: DayLogRecord[];
  profile: ProfileRecord;
  todayEntry: DayLogRecord;
  viewData: DashboardViewData;
  editorViewData: DayLogEditorViewData;
};

export async function loadDashboardScreenState(
  storage: LocalAppStorage,
  now: Date,
  locale = "en",
  options: {
    showLHTests?: boolean;
  } = {},
  deps: {
    loadPregnancyModuleOwned?: () => Promise<boolean>;
  } = {},
): Promise<LoadedDashboardState> {
  const today = formatLocalDate(now);
  const rangeStart = formatLocalDate(
    new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()),
  );
  const [
    profile,
    todayEntry,
    historyRecords,
    symptomRecords,
    activePregnancy,
    activePostpartum,
  ] = await Promise.all([
    storage.readProfileRecord(),
    storage.readDayLogRecord(today),
    storage.listDayLogRecordsInRange(rangeStart, today),
    storage.listSymptomRecords(),
    storage.readActivePregnancy(),
    storage.readActivePostpartum(),
  ]);
  // Screening responses are read ONLY when a postpartum record is active — the
  // only surface that consumes them today — so a plain cycle-mode or pregnancy
  // load never touches the most sensitive data class (privacy-minimal).
  const screeningResponses: ScreeningResponse[] = activePostpartum
    ? await storage.listScreeningResponses()
    : [];
  const filteredTodayEntry: DayLogRecord = {
    ...todayEntry,
    symptomIDs: filterKnownSymptomIDs(symptomRecords, todayEntry.symptomIDs),
  };
  const history = buildCycleHistorySummary(profile, historyRecords, now);
  // Pregnancy metrics (weightKg/bpSystolic/bpDiastolic) reuse the
  // activePregnancy read this function already performs for the pregnancy
  // dashboard below -- no second storage call, mirroring how showLHTests
  // threads a premium flag that also isn't part of ProfileRecord.
  const editorPremiumOptions = {
    ...(options.showLHTests === true ? { showLHTests: true as const } : {}),
    ...(activePregnancy ? { showPregnancyMetrics: true as const } : {}),
  };

  // Pregnancy-module ownership is consulted ONLY when the pregnancy pause is
  // active and there is no pregnancy record yet — the sole state where the
  // entry card's locked/unlocked split matters. A plain cycle-mode load never
  // makes this check, and an existing record renders from local data (reading
  // logged data never re-checks ownership; see pregnancy-entitlement-service's
  // scope policy). The projection computed here for the short-circuit is
  // threaded into buildDashboardViewData so it is not recomputed.
  let pregnancyModeUnlocked = false;
  let projection: ReturnType<typeof buildCurrentCycleProjection> | undefined;
  let endedPregnancyRecords: PregnancyRecord[] = [];
  // An active postpartum record suppresses the pregnancy entry card entirely:
  // the owner is postpartum, so re-offering "start pregnancy" is wrong, and
  // rendering an existing postpartum record never re-checks the plan (reads
  // are never premium-gated — the lapse posture mirrors pregnancy).
  if (!activePregnancy && !activePostpartum) {
    projection = buildCurrentCycleProjection(profile, history, historyRecords, now);
    if (projection.isPregnancyPaused) {
      const loadUnlock = deps.loadPregnancyModuleOwned ?? loadPregnancyModuleOwned;
      // Both extra reads run ONLY in the paused-with-no-active-record state:
      // the pregnancy-record list drives the post-end entry-card suppression
      // and the ownership check splits locked/unlocked. A plain cycle-mode
      // load makes neither call.
      const [records, unlocked] = await Promise.all([
        storage.listPregnancyRecords(),
        loadUnlock(),
      ]);
      endedPregnancyRecords = records.filter(
        (record) => record.status === "ended",
      );
      pregnancyModeUnlocked = unlocked;
    }
  }

  return {
    historyRecords,
    profile,
    todayEntry: filteredTodayEntry,
    viewData: buildDashboardViewData(
      profile,
      historyRecords,
      history,
      now,
      locale,
      {
        showAdvancedFertilitySummary: options.showLHTests === true,
        activePregnancy,
        activePostpartum,
        screeningResponses,
        pregnancyModeUnlocked,
        endedPregnancyRecords,
        ...(projection ? { projection } : {}),
      },
    ),
    editorViewData: buildDayLogEditorViewData(
      profile,
      today,
      symptomRecords,
      filteredTodayEntry.symptomIDs,
      locale,
      editorPremiumOptions,
      {
        historyRecords,
        now,
      },
    ),
  };
}

export function buildDashboardViewData(
  profile: ProfileRecord,
  historyRecords: DayLogRecord[],
  history: ReturnType<typeof buildCycleHistorySummary>,
  now: Date,
  locale = "en",
  options: {
    showAdvancedFertilitySummary?: boolean;
    activePregnancy?: PregnancyRecord | null;
    activePostpartum?: PostpartumRecord | null;
    // Screening responses for the postpartum dashboard's offer/history surfacing
    //. Consumed only in the active-postpartum branch of buildPregnancySection.
    screeningResponses?: readonly ScreeningResponse[];
    pregnancyModeUnlocked?: boolean;
    projection?: ReturnType<typeof buildCurrentCycleProjection>;
    // Ended pregnancy records, used only to suppress the "start pregnancy"
    // entry card after a pregnancy has concluded (see buildPregnancySection).
    endedPregnancyRecords?: PregnancyRecord[];
  } = {},
): DashboardViewData {
  const dashboardCopy = getDashboardCopy(locale);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayValue = formatLocalDate(now);
  const projectedCycle =
    options.projection ??
    buildCurrentCycleProjection(profile, history, historyRecords, now);
  const todayLog =
    historyRecords.find((record) => record.date === todayValue) ?? null;
  const activePostpartumRecord = options.activePostpartum ?? null;
  // Cycle-return detection: a day-log cycle start dated AFTER the
  // postpartum birth date suggests cycles are returning. Computed HERE, where
  // profile/historyRecords already live (no new storage read) -- only when a
  // postpartum record is active, mirroring how screeningResponses is read
  // only in that same state. cycle-history-service.collectCycleStartDates
  // stays the SOLE owner of "what counts as a cycle start" (period clusters,
  // uncertain-day handling, profile.lastPeriodStart) -- never reimplemented
  // here; the result is threaded into the postpartum view-data builder, which
  // never reads day-log history itself.
  const hasNewCycleStart =
    activePostpartumRecord !== null &&
    collectCycleStartDates(profile, historyRecords, todayValue).some(
      (startDate) => startDate > activePostpartumRecord.startedAt,
    );
  const pregnancySection = buildPregnancySection(
    projectedCycle,
    options.activePregnancy ?? null,
    activePostpartumRecord,
    options.endedPregnancyRecords ?? [],
    options.pregnancyModeUnlocked ?? false,
    todayValue,
    todayLog,
    locale,
    options.screeningResponses ?? [],
    hasNewCycleStart,
  );
  const advancedFertilitySummary =
    options.showAdvancedFertilitySummary === true
      ? buildCurrentCycleAdvancedFertilitySummary(
          history,
          historyRecords,
          projectedCycle.cycleAnchorDate,
          profile.temperatureUnit,
          locale,
        )
      : null;

  return {
    mode: pregnancySection.mode,
    ...(pregnancySection.pregnancyEntryCard
      ? { pregnancyEntryCard: pregnancySection.pregnancyEntryCard }
      : {}),
    ...(pregnancySection.pregnancyDashboard
      ? { pregnancyDashboard: pregnancySection.pregnancyDashboard }
      : {}),
    ...(pregnancySection.postpartumDashboard
      ? { postpartumDashboard: pregnancySection.postpartumDashboard }
      : {}),
    ...(pregnancySection.postpartumStaleCard
      ? { postpartumStaleCard: pregnancySection.postpartumStaleCard }
      : {}),
    ...(pregnancySection.staleCard ? { staleCard: pregnancySection.staleCard } : {}),
    cycleHero: buildDashboardCycleHero(profile, projectedCycle, history, locale),
    predictionExplanation: buildPredictionExplanation(profile, projectedCycle, locale),
    predictionDisclaimer: dashboardCopy.predictionDisclaimer,
    ...(advancedFertilitySummary ? { advancedFertilitySummary } : {}),
    quickActionsTitle: dashboardCopy.quickActionsTitle,
    quickActions: {
      period: dashboardCopy.quickActions.period,
      mood: dashboardCopy.quickActions.mood,
      symptom: dashboardCopy.quickActions.symptom,
    },
    journal: {
      title: dashboardCopy.todayEditor,
      dateLabel: new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(today),
    },
    daySaveMessage: resolveDaySaveMessage(
      formatLocalDate(now),
      profile,
      projectedCycle,
      locale,
    ),
  };
}

// The single pregnancy/postpartum-mode branching point (architecture
// invariant: screens never branch on domain state). Precedence: an active,
// trackable pregnancy wins and produces the pregnancy dashboard; then an active
// postpartum record produces the (additive) postpartum dashboard; otherwise,
// when predictions are paused by a positive test and neither record exists, an
// entry card invites pregnancy setup (locked vs unlocked from the managed
// gate); otherwise nothing is added and the dashboard stays in plain cycle
// mode. An active pregnancy takes precedence over a stray active postpartum by
// being checked first.
function buildPregnancySection(
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  activePregnancy: PregnancyRecord | null,
  activePostpartum: PostpartumRecord | null,
  endedPregnancyRecords: PregnancyRecord[],
  pregnancyModeUnlocked: boolean,
  todayValue: string,
  todayLog: DayLogRecord | null,
  locale: string,
  screeningResponses: readonly ScreeningResponse[],
  // Cycle-return detection, computed by the caller -- see
  // buildDashboardViewData. Consumed only in the active-postpartum branch
  // below.
  hasNewCycleStart: boolean,
): {
  mode: "cycle" | "pregnancy" | "postpartum";
  pregnancyEntryCard?: PregnancyEntryCardViewData;
  pregnancyDashboard?: PregnancyDashboardViewData;
  postpartumDashboard?: PostpartumDashboardViewData;
  postpartumStaleCard?: PostpartumStaleCardViewData;
  staleCard?: PregnancyStaleCardViewData;
} {
  if (activePregnancy) {
    const pregnancyDashboard = buildPregnancyDashboardViewData(
      activePregnancy,
      todayValue,
      locale,
      todayLog,
    );
    if (pregnancyDashboard) {
      return { mode: "pregnancy", pregnancyDashboard };
    }

    // GA is null (outside the trackable window). A stale/past-window record
    // (today well past the due date) gets a compact fallback card instead of
    // silently vanishing; a malformed/future EDD (defensive) keeps the prior
    // silent cycle-mode fallback with no entry card — a pregnancy record
    // already exists, so re-offering "start pregnancy" would be wrong, but a
    // bogus date does not warrant a confident claim either. See
    // buildPregnancyStaleCardViewData.
    const staleCard = buildPregnancyStaleCardViewData(activePregnancy, todayValue, locale);
    return staleCard ? { mode: "cycle", staleCard } : { mode: "cycle" };
  }

  // Postpartum branch, beside the pregnancy one. Reads only the local
  // record — rendering an existing record is never premium-gated (lapse
  // posture mirrors pregnancy). A trackable record produces postpartum mode; a
  // past-window record gets a review/close card; a malformed/future birth date
  // falls back silently to cycle mode.
  if (activePostpartum) {
    const postpartumDashboard = buildPostpartumDashboardViewData(
      activePostpartum,
      todayValue,
      locale,
      screeningResponses,
      hasNewCycleStart,
    );
    if (postpartumDashboard) {
      return { mode: "postpartum", postpartumDashboard };
    }

    const postpartumStaleCard = buildPostpartumStaleCardViewData(
      activePostpartum,
      todayValue,
      locale,
    );
    return postpartumStaleCard
      ? { mode: "cycle", postpartumStaleCard }
      : { mode: "cycle" };
  }

  if (projection.isPregnancyPaused) {
    // Post-end suppression: resolvePregnancyPause still reports paused
    // because the positive test remains newer than every cycle start until the
    // next period is logged. But if that positive already belongs to a
    // pregnancy that has been concluded, re-offering "start pregnancy tracking"
    // would be wrong — and, after a loss, harmful. Suppress the entry card when
    // any ENDED record's endedAt is on/after the paused positive-test date. A
    // positive test dated AFTER the latest concluded pregnancy is a genuinely
    // new event and still shows the card. (Prediction-pause behaviour itself is
    // untouched — cycle-history-service is the sole owner of the pause.)
    const pregnancyTestDate = projection.pregnancyTestDate;
    const concludedForThisTest =
      pregnancyTestDate !== null &&
      endedPregnancyRecords.some(
        (record) =>
          record.endedAt !== null && record.endedAt >= pregnancyTestDate,
      );
    if (concludedForThisTest) {
      return { mode: "cycle" };
    }

    const pregnancyCopy = getPregnancyCopy(locale);
    return {
      mode: "cycle",
      pregnancyEntryCard: pregnancyModeUnlocked
        ? {
            variant: "start_pregnancy",
            eyebrowLabel: pregnancyCopy.entryCard.eyebrow,
            title: pregnancyCopy.entryCard.unlockedTitle,
            description: pregnancyCopy.entryCard.unlockedBody,
            ctaLabel: pregnancyCopy.entryCard.unlockedCta,
          }
        : {
            variant: "premium_locked",
            eyebrowLabel: pregnancyCopy.entryCard.eyebrow,
            title: pregnancyCopy.entryCard.lockedTitle,
            description: pregnancyCopy.entryCard.lockedBody,
            ctaLabel: pregnancyCopy.entryCard.lockedCta,
          },
    };
  }

  return { mode: "cycle" };
}

function buildDashboardCycleHero(
  profile: ProfileRecord,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  history: ReturnType<typeof buildCycleHistorySummary>,
  locale: string,
): DashboardCycleHeroViewData {
  const dashboardCopy = getDashboardCopy(locale);
  const statsCopy = getStatsCopy(locale);
  const cycleDayValue =
    projection.currentCycleDay !== null
      ? String(projection.currentCycleDay)
      : statsCopy.phaseLabels.unknown;
  const heroTitle = dashboardCopy.cycleHeroDayLabel;
  const upcomingOvulationLabel = buildDashboardUpcomingOvulationLabel(
    projection,
    dashboardCopy,
    locale,
  );

  if (projection.isPredictionStale) {
    // Web parity (canRenderDashboardCycleHero=false when CycleDataStale): the
    // segmented hero is suppressed in favour of the text-first surface, but
    // predictions are NOT blanked. We surface the rolled-forward cycle day and a
    // conservative "log your period" hint, plus the rolled-forward next-period
    // date in approximate wording — mirroring web's dashboard-stale status line.
    const staleDayValue =
      projection.currentCycleDay !== null
        ? String(projection.currentCycleDay)
        : statsCopy.phaseLabels.unknown;
    const staleCaption = projection.nextPeriodDate
      ? `${dashboardCopy.nextPeriod}: ${dashboardCopy.approximateDatePrefix} ${formatDisplayDate(
          projection.nextPeriodDate,
          locale,
        )}`
      : `${dashboardCopy.nextPeriod}: ${dashboardCopy.nextPeriodUnknown}`;
    return {
      state: "stale",
      title: heroTitle,
      value: staleDayValue,
      detail: dashboardCopy.cycleHeroStale,
      caption: staleCaption,
      upcomingOvulationLabel,
      progressPercent: null,
      currentTone: "neutral",
      phaseSegments: [],
      phaseCards: [],
    };
  }

  if (profile.unpredictableCycle) {
    return {
      state: "facts_only",
      title: heroTitle,
      value: cycleDayValue,
      detail: dashboardCopy.cycleHeroFactsOnly,
      caption: "",
      upcomingOvulationLabel,
      progressPercent: null,
      currentTone: "neutral",
      phaseSegments: [],
      phaseCards: [],
    };
  }

  if (!projection.cycleAnchorDate || projection.currentCycleDay === null) {
    return {
      state: "unknown",
      title: heroTitle,
      value: statsCopy.phaseLabels.unknown,
      detail: dashboardCopy.cycleHeroWaiting,
      caption: dashboardCopy.nextPeriodPrompt,
      upcomingOvulationLabel,
      progressPercent: null,
      currentTone: "neutral",
      phaseSegments: [],
      phaseCards: [],
    };
  }

  if (profile.irregularCycle && !history.hasReliableTrend) {
    // Web parity: DisplayNextPeriodNeedsData (irregular && completedCycleCount<3)
    // forces canRenderDashboardCycleHero=false, so the segmented ring is
    // suppressed entirely. The text-first surface shows the cycle day plus the
    // approximate next-period date with the needs-more-cycles note as the
    // primary status — not an "approximate" ring in a falsely confident shape.
    return {
      state: "approximate",
      title: heroTitle,
      value: cycleDayValue,
      detail: dashboardCopy.cycleHeroApproximate,
      caption: buildDashboardCycleHeroCaption(profile, projection, history, locale),
      upcomingOvulationLabel,
      progressPercent: null,
      currentTone: "neutral",
      phaseSegments: [],
      phaseCards: [],
    };
  }

  const cyclePhases = buildDashboardCycleHeroPhases(profile, projection, locale);
  const currentTone = resolveDashboardCycleHeroCurrentTone(
    cyclePhases,
    projection.currentCycleDay,
  );
  return {
    state: profile.irregularCycle ? "approximate" : "regular",
    title: heroTitle,
    value: cycleDayValue,
    detail: profile.irregularCycle
      ? dashboardCopy.cycleHeroApproximate
      : dashboardCopy.cycleHeroRegular(projection.predictionCycleLength),
    caption: buildDashboardCycleHeroCaption(profile, projection, history, locale),
    upcomingOvulationLabel,
    progressPercent: resolveDashboardCycleHeroProgressPercent(projection),
    currentTone,
    phaseSegments: cyclePhases.map((phase) => ({
      key: phase.key,
      startPercent: phase.startPercent,
      endPercent: phase.endPercent,
      tone: phase.key,
    })),
    phaseCards: cyclePhases.map((phase) => ({
      key: phase.key,
      label: phase.label,
      rangeLabel: phase.rangeLabel,
      tone: phase.key,
      active: phase.key === currentTone,
    })),
  };
}

function buildDashboardCycleHeroCaption(
  profile: ProfileRecord,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  history: ReturnType<typeof buildCycleHistorySummary>,
  locale: string,
): string {
  const dashboardCopy = getDashboardCopy(locale);
  const rangeLabel = buildDashboardCycleHeroDateRange(projection, locale);

  if (rangeLabel) {
    return `${dashboardCopy.nextPeriod}: ${rangeLabel}`;
  }

  if (!projection.nextPeriodDate) {
    return "";
  }

  const nextPeriodValue = profile.irregularCycle
    ? `${dashboardCopy.approximateDatePrefix} ${formatDisplayDate(
        projection.nextPeriodDate,
        locale,
      )}`
    : formatDisplayDate(projection.nextPeriodDate, locale);

  const suffix =
    profile.irregularCycle && !history.hasReliableTrend
      ? ` · ${dashboardCopy.nextPeriodNeedsMoreCycles}`
      : "";

  return `${dashboardCopy.nextPeriod}: ${nextPeriodValue}${suffix}`;
}

function buildDashboardUpcomingOvulationLabel(
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  dashboardCopy: ReturnType<typeof getDashboardCopy>,
  locale: string,
): string | null {
  // Web DashboardOvulationRange: an irregular cycle with a reliable trend shows
  // the ovulation as an explicit range instead of a single (false-precision) day.
  if (
    projection.upcomingOvulationWindowStartDate &&
    projection.upcomingOvulationWindowEndDate
  ) {
    return `${dashboardCopy.ovulation}: ${dashboardCopy.ovulationRange(
      formatDisplayDate(projection.upcomingOvulationWindowStartDate, locale),
      formatDisplayDate(projection.upcomingOvulationWindowEndDate, locale),
    )}`;
  }

  // Web dashboardNeedsOvulationData: too few cycles for a trustworthy ovulation
  // date, so surface the needs-more-cycles note rather than a concrete day.
  if (projection.upcomingOvulationNeedsMoreCycles) {
    return `${dashboardCopy.ovulation}: ${dashboardCopy.ovulationNeedsMoreCycles}`;
  }

  if (!projection.upcomingOvulationDate) {
    return null;
  }

  // Web DisplayOvulationExact: a short-cycle luteal clamp makes the date only
  // approximate, so append the "(approximate)" qualifier.
  const suffix =
    projection.upcomingOvulationExact === false
      ? ` ${dashboardCopy.ovulationApproximate}`
      : "";

  return `${dashboardCopy.ovulation}: ${formatDisplayDate(
    projection.upcomingOvulationDate,
    locale,
  )}${suffix}`;
}

function buildDashboardCycleHeroDateRange(
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  locale: string,
): string | null {
  const startDate = projection.nextPeriodWindowStartDate;
  const endDate = projection.nextPeriodWindowEndDate;

  if (!startDate || !endDate) {
    return null;
  }

  if (startDate === endDate) {
    return null;
  }

  return formatDisplayDateRange(startDate, endDate, locale);
}

function resolveDashboardCycleHeroProgressPercent(
  projection: ReturnType<typeof buildCurrentCycleProjection>,
): number | null {
  if (projection.currentCycleDay === null) {
    return null;
  }

  const denominator = Math.max(projection.predictionCycleLength, 1);
  const normalized = (projection.currentCycleDay - 1) / denominator;

  return clampPercent(normalized);
}

function buildDashboardCycleHeroPhases(
  profile: ProfileRecord,
  projection: ReturnType<typeof buildCurrentCycleProjection>,
  locale: string,
): {
  key: DashboardCycleHeroPhaseKey;
  label: string;
  rangeLabel: string;
  startDay: number;
  endDay: number;
  startPercent: number;
  endPercent: number;
}[] {
  const dashboardCopy = getDashboardCopy(locale);
  const cycleLength = projection.predictionCycleLength;
  const { day: ovulationDay } = calcOvulationDay(
    cycleLength,
    projection.lutealPhase,
  );
  if (!ovulationDay) {
    return [];
  }

  // Web parity (dashboard_cycle_hero.go:54): the menstrual phase card spans the
  // rolling predictedPeriodLength(stats.AveragePeriodLength), not the configured
  // period length. The projection computes it once; the ?? fallback only guards
  // hand-built projection literals.
  const periodLength = projection.projectedPeriodLength ?? profile.periodLength;

  const phaseRanges: {
    key: DashboardCycleHeroPhaseKey;
    label: string;
    startDay: number;
    endDay: number;
  }[] = [
    {
      key: "period",
      label: dashboardCopy.cycleHeroPhaseCards.period,
      startDay: 1,
      endDay: Math.min(periodLength, cycleLength),
    },
    {
      key: "follicular",
      label: dashboardCopy.cycleHeroPhaseCards.follicular,
      startDay: Math.min(periodLength + 1, cycleLength),
      endDay: Math.max(ovulationDay - 1, 0),
    },
    {
      key: "ovulation",
      label: dashboardCopy.cycleHeroPhaseCards.ovulation,
      startDay: ovulationDay,
      endDay: ovulationDay,
    },
    {
      key: "luteal",
      label: dashboardCopy.cycleHeroPhaseCards.luteal,
      startDay: Math.min(ovulationDay + 1, cycleLength),
      endDay: cycleLength,
    },
  ];

  return phaseRanges
    .filter((phase) => phase.startDay >= 1 && phase.endDay >= phase.startDay)
    .map((phase) => ({
      key: phase.key,
      label: phase.label,
      rangeLabel: dashboardCopy.cycleHeroDayRange(phase.startDay, phase.endDay),
      startDay: phase.startDay,
      endDay: phase.endDay,
      startPercent: clampPercent((phase.startDay - 1) / cycleLength),
      endPercent: clampPercent(phase.endDay / cycleLength),
    }));
}

function resolveDashboardCycleHeroCurrentTone(
  phases: {
    key: DashboardCycleHeroPhaseKey;
    startDay: number;
    endDay: number;
  }[],
  currentCycleDay: number | null,
): DashboardCycleHeroViewData["currentTone"] {
  if (currentCycleDay === null) {
    return "neutral";
  }

  const activePhase = phases.find(
    (phase) =>
      currentCycleDay >= phase.startDay && currentCycleDay <= phase.endDay,
  );

  return activePhase?.key ?? "neutral";
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

function formatDisplayDateRange(
  startValue: string,
  endValue: string,
  locale: string,
): string {
  return `${formatDisplayDate(startValue, locale)} - ${formatDisplayDate(
    endValue,
    locale,
  )}`;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }

  return value;
}
