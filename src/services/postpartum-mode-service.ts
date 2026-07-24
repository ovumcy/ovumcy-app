import { getCrisisCopy } from "../i18n/crisis-copy";
import { getPostpartumCopy } from "../i18n/postpartum-copy";
import { getRedFlagCopy, type RedFlagItemID } from "../i18n/red-flag-copy";
import {
  CORE_RECOVERY_WEEKS_MAX,
  EARLY_WEEKS_MAX,
  createPostpartumRecord,
  type PostpartumEndReason,
  type PostpartumRecord,
} from "../models/postpartum";
import {
  hasActivePregnancy,
  type ModeOfDelivery,
  type PregnancyRecord,
} from "../models/pregnancy";
import type { LocalDateISO } from "../models/profile";
import type { ScreeningResponse } from "../models/screening";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  buildScreeningHistorySummaryViewData,
  buildScreeningOfferViewData,
  type ScreeningHistorySummaryViewData,
  type ScreeningOfferViewData,
} from "./screening-service";
import {
  diffLocalDays,
  formatLocalDate,
  parseLocalDate,
} from "./profile-settings-policy";

// Postpartum-mode product logic (Y2): starting postpartum from a just-ended
// birth, ending it, and the postpartum-dashboard view-data. All week-since-
// birth math reads only the record's own `startedAt` (the birth date). This
// module never re-derives cycle predictions or touches the pregnancy pause —
// cycle-history-service stays the sole owner of that. Y6 phase 2 adds the
// cycle-return offer (auto-detected "cycle_returned" end path) and the LAM
// education card; both key off a `hasNewCycleStart` flag computed upstream in
// dashboard-view-service -- this module still never reads day-log history.

// Upper bound of the trackable postpartum window: 26 weeks (~6 months) since
// birth. Beyond it the record is treated as stale (a review/close card),
// mirroring pregnancy-timeline-service's MAX_GESTATIONAL_AGE_DAYS out-of-window
// handling rather than silently vanishing.
export const POSTPARTUM_TRACKABLE_WEEKS_MAX = 26;

// How recent an ended-birth pregnancy must be for the manage screen to still
// offer a delayed "Start postpartum tracking" (so someone who declined the
// after-birth offer can change her mind). Only gates the UI offer's
// visibility; the service itself is window-agnostic, mirroring how
// endPregnancy accepts a birth unconditionally.
export const POSTPARTUM_DELAYED_START_MAX_WEEKS = 8;

// --- Start / end / delete --------------------------------------------------

export type StartPostpartumErrorCode =
  | "active_pregnancy_exists"
  | "active_postpartum_exists"
  | "no_birth_pregnancy"
  | "save_failed";

export type StartPostpartumResult =
  | { ok: true; record: PostpartumRecord }
  | { ok: false; errorCode: StartPostpartumErrorCode };

// Starts postpartum tracking from the MOST RECENT ended pregnancy whose end
// reason was "birth": startedAt is copied from that pregnancy's endedAt (the
// birth date) and modeOfDelivery is copied across. Typed errors for the three
// preconditions — an active pregnancy still exists, a postpartum is already
// active, or there is no ended-birth pregnancy to derive from. Loss/other
// pregnancies are NEVER a source here (domain rule B8: no cheerful
// re-engagement after a loss).
export async function startPostpartumFromBirth(
  storage: LocalAppStorage,
  options: { now?: Date } = {},
): Promise<StartPostpartumResult> {
  const now = options.now ?? new Date();

  // An active pregnancy takes precedence over postpartum everywhere (documented
  // in dashboard-view-service); starting postpartum while one is active would
  // be incoherent, so reject it first.
  const pregnancyRecords = await storage.listPregnancyRecords();
  if (hasActivePregnancy(pregnancyRecords)) {
    return { ok: false, errorCode: "active_pregnancy_exists" };
  }

  const existingPostpartum = await storage.readActivePostpartum();
  if (existingPostpartum) {
    return { ok: false, errorCode: "active_postpartum_exists" };
  }

  const birthPregnancy = resolveMostRecentEndedBirth(pregnancyRecords);
  if (!birthPregnancy) {
    return { ok: false, errorCode: "no_birth_pregnancy" };
  }

  // endedAt is set for every real birth record (endPregnancy always sets it);
  // the fallback to today is defensive for a degenerate record whose date is
  // missing, and is the only use of `now` here.
  const startedAt = birthPregnancy.endedAt ?? formatLocalDate(now);
  const record = createPostpartumRecord({
    startedAt,
    modeOfDelivery: birthPregnancy.modeOfDelivery,
  });

  try {
    await storage.writePostpartumRecord(record);
  } catch {
    // writePostpartumRecord rejects a second concurrent active record; a throw
    // here is either that race or a storage failure — both surface as a
    // retryable save_failed rather than a crash.
    return { ok: false, errorCode: "save_failed" };
  }

  return { ok: true, record };
}

export type EndPostpartumInput = {
  reason: PostpartumEndReason;
  endedAt?: LocalDateISO;
};

export type EndPostpartumErrorCode = "no_active_postpartum" | "save_failed";

export type EndPostpartumResult =
  | { ok: true; record: PostpartumRecord }
  | { ok: false; errorCode: EndPostpartumErrorCode };

// Ends the single active postpartum: flips the plaintext status to "ended" and
// records endedAt / endReason. The write goes through the same
// writePostpartumRecord repo as every other write, so no new plaintext column
// is introduced (only `status` is plaintext, by design).
export async function endPostpartum(
  storage: LocalAppStorage,
  input: EndPostpartumInput,
  now: Date = new Date(),
): Promise<EndPostpartumResult> {
  const active = await storage.readActivePostpartum();
  if (!active) {
    return { ok: false, errorCode: "no_active_postpartum" };
  }

  const endedAt =
    input.endedAt && parseLocalDate(input.endedAt)
      ? input.endedAt
      : formatLocalDate(now);

  const ended: PostpartumRecord = {
    ...active,
    status: "ended",
    endedAt,
    endReason: input.reason,
  };

  try {
    await storage.writePostpartumRecord(ended);
  } catch {
    return { ok: false, errorCode: "save_failed" };
  }

  return { ok: true, record: ended };
}

export type DeletePostpartumDataResult =
  | { ok: true }
  | { ok: false; errorCode: "generic" };

// Hard-delete of the whole postpartum data class. Mirrors
// deleteAllPregnancyData's result shape: destructive and gated in the UI
// behind device auth + an explicit confirm dialog. The storage method removes
// only postpartum_records, leaving cycle/day-log AND pregnancy data intact.
export async function deleteAllPostpartumData(
  storage: LocalAppStorage,
): Promise<DeletePostpartumDataResult> {
  try {
    await storage.deleteAllPostpartumData();
    return { ok: true };
  } catch {
    return { ok: false, errorCode: "generic" };
  }
}

// Whether a recent ended-birth pregnancy exists within the delayed-start
// window, used ONLY to decide the manage screen's delayed "Start postpartum
// tracking" offer visibility (paired with the premium gate + no-active checks
// in the screen). Pure, so it can be unit-tested independently.
export function hasRecentEndedBirthPregnancy(
  records: readonly PregnancyRecord[],
  today: LocalDateISO,
): boolean {
  if (!parseLocalDate(today)) {
    return false;
  }
  return records.some((record) => {
    if (
      record.status !== "ended" ||
      record.endReason !== "birth" ||
      record.endedAt === null ||
      !parseLocalDate(record.endedAt)
    ) {
      return false;
    }
    const daysSince = diffLocalDays(record.endedAt, today);
    return daysSince >= 0 && daysSince <= POSTPARTUM_DELAYED_START_MAX_WEEKS * 7;
  });
}

function resolveMostRecentEndedBirth(
  records: readonly PregnancyRecord[],
): PregnancyRecord | null {
  const births = records.filter(
    (record) => record.status === "ended" && record.endReason === "birth",
  );
  if (births.length === 0) {
    return null;
  }
  // Most recent by endedAt (ISO YYYY-MM-DD sorts lexicographically). A missing
  // endedAt sorts last so a dated birth is always preferred over a degenerate
  // undated one.
  return (
    [...births].sort((left, right) =>
      (right.endedAt ?? "").localeCompare(left.endedAt ?? ""),
    )[0] ?? null
  );
}

// --- Dashboard view-data ---------------------------------------------------

export type PostpartumPhase = "early" | "core" | "extended";

export type PostpartumDashboardHeroViewData = {
  weeksLabel: string;
  weekCaption: string;
  weeks: number;
  days: number;
  phase: PostpartumPhase;
  phaseLabel: string;
};

export type PostpartumDashboardCardViewData = {
  title: string;
  body: string;
};

// Red-flag education content (Y1 phase 2) shown, collapsed by default, at the
// bottom of the postpartum dashboard. This is the STATIC set of item ids that
// belong to the postpartum context -- never derived from or evaluated against
// logged data (see red-flag-copy.ts's file header for the full tone/scope
// invariant). No gestational-age concept applies postpartum, so unlike
// pregnancy's list this one is never filtered. Order matches the product
// spec; mental_health stays gentle, psychosis_signs is the firm-but-calm
// escalation after it (Y4), and the dedicated crisis-support block is reached
// via the standing support-resources row (see supportResources view-data).
const POSTPARTUM_RED_FLAG_ITEM_IDS: readonly RedFlagItemID[] = [
  "heavy_bleeding_pp",
  "bleeding_returns",
  "vte_signs",
  "fever_pp",
  "breast_symptoms",
  "preeclampsia_pp",
  "mental_health",
  // Firm-but-calm postpartum-psychosis escalation (Y4), placed right after the
  // gentle mental_health item. Postpartum-only; never in the pregnancy list.
  "psychosis_signs",
];

export type PostpartumDashboardRedFlagItem = {
  id: RedFlagItemID;
  title: string;
  body: string;
};

// Cycle-return offer (Y6 phase 2): a gentle dashboard nudge once the day-log
// history shows a cycle start dated AFTER the postpartum birth date.
// `visible` mirrors the `hasNewCycleStart` input verbatim -- detection itself
// lives in dashboard-view-service (the sole reader of day-log history for
// this purpose, via cycle-history-service.collectCycleStartDates); this
// module never reads day-log history. Accepting the offer ends postpartum
// tracking with reason "cycle_returned" through the same endPostpartum used
// by the manage screen's manual end; `confirmDialog` mirrors that manage-
// screen end dialog's two-button, dismissal-keeps-tracking contract (see
// postpartum-copy.ts's manage.endDialog and PregnancyEndScreen.handleEndPostpartum).
export type PostpartumCycleReturnOfferViewData = {
  visible: boolean;
  title: string;
  body: string;
  acceptCtaLabel: string;
  keepCtaLabel: string;
  confirmDialog: {
    title: string;
    body: string;
    confirmLabel: string;
    cancelLabel: string;
  };
};

export type PostpartumDashboardViewData = {
  disclaimer: string;
  hero: PostpartumDashboardHeroViewData;
  recoveryCard: PostpartumDashboardCardViewData;
  lochiaCard: PostpartumDashboardCardViewData;
  // Cycle-return offer (Y6 phase 2). See PostpartumCycleReturnOfferViewData.
  cycleReturnOffer: PostpartumCycleReturnOfferViewData;
  // LAM (lactational amenorrhea method) education card (Y6 phase 2): compact,
  // always present while postpartum is active AND no new cycle start yet.
  // Once cycleReturnOffer.visible flips true (same hasNewCycleStart input)
  // this card is superseded by the offer -- null rather than rendering stale
  // education alongside it. Commonly-discussed education only, never framed
  // as endorsing or configuring a contraception method (SECURITY.md medical-
  // safety invariant) -- no feeding-data field backs this card anywhere in
  // the app; deferred, out of scope here.
  lamCard: PostpartumDashboardCardViewData | null;
  manageCta: { label: string };
  // Collapsed-by-default "when to contact your care team" education section
  // (Y1 phase 2), same shared section copy as the pregnancy dashboard's.
  redFlags: {
    title: string;
    intro: string;
    expandLabel: string;
    collapseLabel: string;
    items: PostpartumDashboardRedFlagItem[];
  };
  // EPDS mood-screening surfacing (Y3), built from the screening responses
  // threaded in by the dashboard container. `screeningOffer.visible` drives the
  // gentle offer card (cadence-truthful; the screen owns session-local
  // dismissal). `screeningHistory` is the "Last check-in" row when at least one
  // response exists (date + score only). The screening logic itself lives in
  // screening-service; this only carries the assembled view-data onto the
  // dashboard so the screen stays presentational.
  screeningOffer: ScreeningOfferViewData;
  screeningHistory: ScreeningHistorySummaryViewData | null;
  // Standing "Support resources" row (Y4), a quiet toggle near the manage link
  // that expands in place (RedFlagsCard precedent) to reveal the CrisisSupportCard
  // plus the mental_health red-flag body as context. This carries ONLY the row
  // labels + context copy; the CrisisSupportCard's own view-data (which needs
  // the owner's personal contact from the profile) is built by the dashboard
  // container, keeping the crisis contact off this postpartum view-data. NEVER
  // premium-gated: this row renders whenever the postpartum dashboard renders,
  // including read-only lapse states.
  supportResources: {
    rowLabel: string;
    expandLabel: string;
    collapseLabel: string;
    contextBody: string;
  };
};

// Maps a week-since-birth count onto the three content phases. Inclusive lower
// boundary, mirroring pregnancy-timeline-service.resolveTrimester: week 2 is
// still "early", week 6 is still "core", week 7 is "extended".
export function resolvePostpartumPhase(weeks: number): PostpartumPhase {
  if (weeks <= EARLY_WEEKS_MAX) {
    return "early";
  }
  if (weeks <= CORE_RECOVERY_WEEKS_MAX) {
    return "core";
  }
  return "extended";
}

export function buildPostpartumDashboardViewData(
  record: PostpartumRecord,
  today: LocalDateISO,
  language: string,
  // Screening responses threaded in by the dashboard container. Defaults to
  // none so the recovery-card contract is unchanged for callers that do not
  // surface screening; with no responses the offer is simply "due" (first
  // check-in) and there is no history row.
  screeningResponses: readonly ScreeningResponse[] = [],
  // Cycle-return detection (Y6 phase 2): whether the day-log history contains
  // a cycle start dated AFTER this record's birth date (record.startedAt).
  // Computed by dashboard-view-service (via cycle-history-service, the sole
  // owner of "what counts as a cycle start") and threaded in -- this module
  // never reads day-log history itself. Defaults to false so existing callers
  // keep today's cycleReturnOffer-hidden / lamCard-shown contract. Drives
  // BOTH the cycle-return offer's visibility and the LAM card's presence.
  hasNewCycleStart: boolean = false,
): PostpartumDashboardViewData | null {
  const weeksSince = resolveWeeksSinceBirth(record.startedAt, today);
  if (weeksSince === null || weeksSince.weeks > POSTPARTUM_TRACKABLE_WEEKS_MAX) {
    // Out of the trackable window (future/malformed birth date, or past the
    // 26-week window). buildPostpartumStaleCardViewData handles the stale case;
    // the caller falls back to plain cycle mode otherwise.
    return null;
  }

  const copy = getPostpartumCopy(language);
  const redFlagCopy = getRedFlagCopy(language);
  const crisisCopy = getCrisisCopy(language);
  const phase = resolvePostpartumPhase(weeksSince.weeks);
  const redFlagItems: PostpartumDashboardRedFlagItem[] =
    POSTPARTUM_RED_FLAG_ITEM_IDS.map((id) => ({
      id,
      title: redFlagCopy.items[id].title,
      body: redFlagCopy.items[id].body,
    }));

  return {
    disclaimer: copy.disclaimer,
    hero: {
      weeksLabel: copy.hero.weekValue(weeksSince.weeks, weeksSince.days),
      weekCaption: copy.hero.weekCaption,
      weeks: weeksSince.weeks,
      days: weeksSince.days,
      phase,
      phaseLabel: copy.hero.phaseLabels[phase],
    },
    recoveryCard: {
      title: copy.recovery.title,
      body: resolveRecoveryBody(copy, phase, record.modeOfDelivery),
    },
    lochiaCard: {
      title: copy.lochia.title,
      body: copy.lochia.body,
    },
    cycleReturnOffer: buildPostpartumCycleReturnOfferViewData(
      hasNewCycleStart,
      language,
    ),
    lamCard: hasNewCycleStart
      ? null
      : { title: copy.lam.title, body: copy.lam.body },
    manageCta: { label: copy.dashboard.manageCta },
    redFlags: {
      title: redFlagCopy.section.title,
      intro: redFlagCopy.section.intro,
      expandLabel: redFlagCopy.section.expandLabel,
      collapseLabel: redFlagCopy.section.collapseLabel,
      items: redFlagItems,
    },
    screeningOffer: buildScreeningOfferViewData(
      record,
      screeningResponses,
      today,
      language,
    ),
    screeningHistory: buildScreeningHistorySummaryViewData(
      screeningResponses,
      language,
    ),
    supportResources: {
      rowLabel: crisisCopy.supportResources.rowLabel,
      expandLabel: crisisCopy.supportResources.expandLabel,
      collapseLabel: crisisCopy.supportResources.collapseLabel,
      // The gentle mental_health red-flag body doubles as the standing context
      // shown alongside the crisis block.
      contextBody: redFlagCopy.items.mental_health.body,
    },
  };
}

// Assembles the cycle-return offer card's view-data from copy + the already-
// decided `hasNewCycleStart` flag. Pure and standalone (no record/date
// reads) so it is directly unit-testable; see PostpartumCycleReturnOfferViewData
// for the visibility/accept/keep/confirm contract.
export function buildPostpartumCycleReturnOfferViewData(
  hasNewCycleStart: boolean,
  language: string,
): PostpartumCycleReturnOfferViewData {
  const copy = getPostpartumCopy(language);
  return {
    visible: hasNewCycleStart,
    title: copy.cycleReturnOffer.title,
    body: copy.cycleReturnOffer.body,
    acceptCtaLabel: copy.cycleReturnOffer.acceptCta,
    keepCtaLabel: copy.cycleReturnOffer.keepCta,
    confirmDialog: {
      title: copy.cycleReturnOffer.confirmDialog.title,
      body: copy.cycleReturnOffer.confirmDialog.body,
      confirmLabel: copy.cycleReturnOffer.confirmDialog.confirm,
      cancelLabel: copy.cycleReturnOffer.confirmDialog.cancel,
    },
  };
}

export type PostpartumStaleCardViewData = {
  title: string;
  body: string;
  ctaLabel: string;
};

// Compact fallback for an active postpartum record whose birth date has drifted
// past the trackable window (more than POSTPARTUM_TRACKABLE_WEEKS_MAX weeks).
// A future/malformed startedAt keeps the silent cycle-mode fallback (returns
// null), mirroring buildPregnancyStaleCardViewData's past_window-only rule.
export function buildPostpartumStaleCardViewData(
  record: PostpartumRecord,
  today: LocalDateISO,
  language: string,
): PostpartumStaleCardViewData | null {
  const weeksSince = resolveWeeksSinceBirth(record.startedAt, today);
  if (weeksSince === null || weeksSince.weeks <= POSTPARTUM_TRACKABLE_WEEKS_MAX) {
    return null;
  }

  const copy = getPostpartumCopy(language);
  return {
    title: copy.staleCard.title,
    body: copy.staleCard.body,
    ctaLabel: copy.dashboard.manageCta,
  };
}

function resolveRecoveryBody(
  copy: ReturnType<typeof getPostpartumCopy>,
  phase: PostpartumPhase,
  modeOfDelivery: ModeOfDelivery | null,
): string {
  // Phase x mode-of-delivery matrix (Y5 phase 2): nine bodies per locale,
  // read from postpartum-copy.ts's recovery.bodies[phase][mode]. A
  // null/unknown mode of delivery (owner declined to say, or the source
  // birth record carried none) falls back to "neutral".
  return copy.recovery.bodies[phase][modeOfDelivery ?? "neutral"];
}

// Whole weeks + trailing days since the birth date, or null when either date
// is malformed or the birth date is in the future (defensive). Guards
// parseLocalDate explicitly because diffLocalDays returns 0 for invalid input,
// which would otherwise read as "0 days since birth".
function resolveWeeksSinceBirth(
  startedAt: LocalDateISO,
  today: LocalDateISO,
): { weeks: number; days: number } | null {
  if (!parseLocalDate(startedAt) || !parseLocalDate(today)) {
    return null;
  }
  const daysSince = diffLocalDays(startedAt, today);
  if (daysSince < 0) {
    return null;
  }
  return { weeks: Math.floor(daysSince / 7), days: daysSince % 7 };
}
