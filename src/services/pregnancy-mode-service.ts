import { getBabyWeekCopy, type BabyWeekNumber } from "../i18n/baby-week-copy";
import { getContractionTimerCopy } from "../i18n/contraction-timer-copy";
import { getPregnancyCopy } from "../i18n/pregnancy-copy";
import { getPregnancyEndCopy } from "../i18n/pregnancy-end-copy";
import { getRedFlagCopy, type RedFlagItemID } from "../i18n/red-flag-copy";
import type { DayLogRecord } from "../models/day-log";
import {
  GESTATION_DAYS,
  KICK_COUNTS_START_WEEK,
  createPregnancyRecord,
  type Chorionicity,
  type EddBasis,
  type FetusCount,
  type ModeOfDelivery,
  type PregnancyEndReason,
  type PregnancyRecord,
} from "../models/pregnancy";
import type { LocalDateISO, ProfileRecord } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  calcEddFromLmp,
  calcGestationalAge,
  resolveCurrentMilestones,
  resolveOutOfWindowReason,
  type PregnancyMilestoneID,
} from "./pregnancy-timeline-service";
import { formatLocalDate, parseLocalDate } from "./profile-settings-policy";

// Pregnancy-mode product logic: starting a pregnancy (with a typed validation
// result), the wizard prefill + live preview, and the pregnancy-dashboard
// view-data. All EDD math delegates to pregnancy-timeline-service — this module
// never re-derives gestational age or re-reads profile.lastPeriodStart once an
// EDD is fixed (ACOG CO700; enforced by the timeline engine).

export type StartPregnancyInput = {
  eddBasis: EddBasis;
  edd?: LocalDateISO;
  lmpDate?: LocalDateISO;
  // Multiples (Y0, education-only; optional, skippable in the wizard). No
  // validation beyond the enums themselves -- the invariant "chorionicity
  // only meaningful once fetusCount >= 2" is enforced canonically by
  // sanitizePregnancyRecord at the storage boundary, same as every other
  // field on this record.
  fetusCount?: FetusCount;
  chorionicity?: Chorionicity;
};

export type StartPregnancyErrorCode =
  | "active_pregnancy_exists"
  | "missing_date"
  | "invalid_date"
  | "out_of_range"
  | "save_failed";

export type StartPregnancyResult =
  | { ok: true; record: PregnancyRecord }
  | { ok: false; errorCode: StartPregnancyErrorCode };

type ResolvedStartEdd =
  | { ok: true; edd: LocalDateISO; lmpDate: LocalDateISO | null }
  | { ok: false; errorCode: "missing_date" | "invalid_date" };

// Resolves the fixed EDD from the chosen basis. For "lmp" the EDD is derived
// via Naegele's rule (calcEddFromLmp) and the LMP is retained on the record;
// for "ultrasound"/"manual" the EDD is taken as entered and no LMP is stored.
function resolveStartEdd(input: StartPregnancyInput): ResolvedStartEdd {
  if (input.eddBasis === "lmp") {
    const lmpDate = input.lmpDate?.trim() ?? "";
    if (lmpDate === "") {
      return { ok: false, errorCode: "missing_date" };
    }
    if (!parseLocalDate(lmpDate)) {
      return { ok: false, errorCode: "invalid_date" };
    }
    return { ok: true, edd: calcEddFromLmp(lmpDate), lmpDate };
  }

  const edd = input.edd?.trim() ?? "";
  if (edd === "") {
    return { ok: false, errorCode: "missing_date" };
  }
  if (!parseLocalDate(edd)) {
    return { ok: false, errorCode: "invalid_date" };
  }
  return { ok: true, edd, lmpDate: null };
}

export async function startPregnancy(
  storage: LocalAppStorage,
  input: StartPregnancyInput,
  now: Date = new Date(),
): Promise<StartPregnancyResult> {
  // Domain invariant: at most one active pregnancy. Check first for a clear
  // error; the storage layer also rejects a concurrent second active record
  // (handled below as save_failed) to close the read-then-write race.
  const existing = await storage.readActivePregnancy();
  if (existing) {
    return { ok: false, errorCode: "active_pregnancy_exists" };
  }

  const resolved = resolveStartEdd(input);
  if (!resolved.ok) {
    return resolved;
  }

  const today = formatLocalDate(now);
  // Sane-window gate reuses the gestational-age engine: a null result means the
  // edd/today pair is outside 0..43 weeks, i.e. not a trackable current
  // pregnancy (future-dated EDD, or more than three weeks past term).
  if (!calcGestationalAge(resolved.edd, today)) {
    return { ok: false, errorCode: "out_of_range" };
  }

  const record = createPregnancyRecord({
    edd: resolved.edd,
    eddBasis: input.eddBasis,
    lmpDate: resolved.lmpDate,
    startedAt: today,
    ...(input.fetusCount !== undefined ? { fetusCount: input.fetusCount } : {}),
    ...(input.chorionicity !== undefined
      ? { chorionicity: input.chorionicity }
      : {}),
  });

  try {
    await storage.writePregnancyRecord(record);
  } catch {
    // writePregnancyRecord rejects a second concurrent active record; a throw
    // here is either that race or a storage failure — both surface as a
    // retryable save_failed rather than a crash.
    return { ok: false, errorCode: "save_failed" };
  }

  return { ok: true, record };
}

export type UpdateEddInput = {
  eddBasis: Exclude<EddBasis, "lmp">;
  edd?: LocalDateISO;
};

export type UpdateEddErrorCode =
  | "no_active_pregnancy"
  | "missing_date"
  | "invalid_date"
  | "out_of_range"
  | "save_failed";

export type UpdateEddResult =
  | { ok: true; record: PregnancyRecord }
  | { ok: false; errorCode: UpdateEddErrorCode };

// Explicit clinician re-dating (ACOG CO700): the one sanctioned path that
// changes an already-fixed EDD after a pregnancy has started -- everything
// else on the record (id/startedAt/lmpDate/status/...) is carried over
// unchanged. LMP basis is deliberately not offered here: re-dating is a
// clinician-dating action (an ultrasound scan or a manually entered
// clinician date), never a recomputation from the owner's own cycle data.
export async function updateEddForActivePregnancy(
  storage: LocalAppStorage,
  input: UpdateEddInput,
  now: Date = new Date(),
): Promise<UpdateEddResult> {
  const active = await storage.readActivePregnancy();
  if (!active) {
    return { ok: false, errorCode: "no_active_pregnancy" };
  }

  // Reuses startPregnancy's own date resolution (its "lmp" branch is
  // unreachable here since UpdateEddInput's basis excludes it) and, below,
  // the identical sane-GA window startPregnancy gates on -- not a second copy
  // of either check.
  const resolved = resolveStartEdd(input);
  if (!resolved.ok) {
    return resolved;
  }

  const today = formatLocalDate(now);
  if (!calcGestationalAge(resolved.edd, today)) {
    return { ok: false, errorCode: "out_of_range" };
  }

  const updated: PregnancyRecord = {
    ...active,
    edd: resolved.edd,
    eddBasis: input.eddBasis,
  };

  try {
    await storage.writePregnancyRecord(updated);
  } catch {
    return { ok: false, errorCode: "save_failed" };
  }

  return { ok: true, record: updated };
}

export type EndPregnancyInput = {
  reason: PregnancyEndReason;
  modeOfDelivery?: ModeOfDelivery;
  endedAt?: LocalDateISO;
};

export type EndPregnancyErrorCode = "no_active_pregnancy" | "save_failed";

export type EndPregnancyResult =
  | { ok: true; record: PregnancyRecord }
  | { ok: false; errorCode: EndPregnancyErrorCode };

// Ends the single active pregnancy: flips the plaintext status to "ended" and
// records the outcome (endedAt / endReason / modeOfDelivery). Those outcome
// fields live ONLY inside the AEAD-encrypted payload — this write goes through
// the same writePregnancyRecord repo as every other pregnancy write, so no new
// plaintext column is introduced (only `status` is plaintext, by design).
// modeOfDelivery is meaningful only for a birth; for loss/other it is forced to
// null so a stale UI selection can never persist an outcome detail that does
// not belong to the reason.
// BIRTH_OPTION_MIN_WEEK (resolveBirthOptionVisible) gates only the UI's
// OFFERING of the birth choice/CTA -- this service function still accepts
// reason "birth" unconditionally regardless of gestational age, so data
// restore/import paths are never rejected or corrupted by that UI-only rule.
export async function endPregnancy(
  storage: LocalAppStorage,
  input: EndPregnancyInput,
  now: Date = new Date(),
): Promise<EndPregnancyResult> {
  const active = await storage.readActivePregnancy();
  if (!active) {
    return { ok: false, errorCode: "no_active_pregnancy" };
  }

  // Default to today; an explicitly-passed endedAt is used only if it parses,
  // so a bad value can never persist a broken date onto the ended record.
  const endedAt =
    input.endedAt && parseLocalDate(input.endedAt)
      ? input.endedAt
      : formatLocalDate(now);
  const modeOfDelivery =
    input.reason === "birth" ? (input.modeOfDelivery ?? null) : null;

  const ended: PregnancyRecord = {
    ...active,
    status: "ended",
    endedAt,
    endReason: input.reason,
    modeOfDelivery,
  };

  try {
    await storage.writePregnancyRecord(ended);
  } catch {
    return { ok: false, errorCode: "save_failed" };
  }

  return { ok: true, record: ended };
}

export type DeletePregnancyDataResult =
  | { ok: true }
  | { ok: false; errorCode: "generic" };

// Hard-delete of the whole pregnancy data class (records + kick/contraction
// sessions). Mirrors clearAllLocalSettingsData's result shape: destructive and
// gated in the UI behind device auth + an explicit confirm dialog. The storage
// method removes only the pregnancy tables, leaving cycle/day-log data intact.
export async function deleteAllPregnancyData(
  storage: LocalAppStorage,
): Promise<DeletePregnancyDataResult> {
  try {
    await storage.deleteAllPregnancyData();
    return { ok: true };
  } catch {
    return { ok: false, errorCode: "generic" };
  }
}

export type PregnancyStartDefaults = {
  defaultLmp: LocalDateISO | null;
  defaultEdd: LocalDateISO | null;
};

// Wizard prefill: the canonical last-period-start seeds the LMP field, and its
// Naegele EDD seeds the ultrasound/manual field so the user starts from a
// sensible estimate rather than a blank form.
export function buildPregnancyStartDefaults(
  profile: ProfileRecord,
): PregnancyStartDefaults {
  const defaultLmp = profile.lastPeriodStart;
  const defaultEdd =
    defaultLmp && parseLocalDate(defaultLmp) ? calcEddFromLmp(defaultLmp) : null;
  return { defaultLmp: defaultLmp ?? null, defaultEdd };
}

export type PregnancyStartPreview = {
  edd: LocalDateISO | null;
  eddLabel: string | null;
  weeks: number | null;
  days: number | null;
  gaLabel: string | null;
};

// Live wizard preview of the resolved EDD + current gestational age for the
// date entered so far. Returns nulls when the date is missing/invalid or the
// resulting EDD is outside the trackable window, letting the screen stay
// presentational (no date parsing on the screen).
export function buildPregnancyStartPreview(
  input: StartPregnancyInput,
  now: Date,
  language: string,
): PregnancyStartPreview {
  const empty: PregnancyStartPreview = {
    edd: null,
    eddLabel: null,
    weeks: null,
    days: null,
    gaLabel: null,
  };

  const resolved = resolveStartEdd(input);
  if (!resolved.ok) {
    return empty;
  }

  const ga = calcGestationalAge(resolved.edd, formatLocalDate(now));
  const copy = getPregnancyCopy(language);
  return {
    edd: resolved.edd,
    eddLabel: formatDisplayDate(resolved.edd, language),
    weeks: ga?.weeks ?? null,
    days: ga?.days ?? null,
    gaLabel: ga ? copy.hero.weekValue(ga.weeks, ga.days) : null,
  };
}

export type PregnancyDashboardHeroViewData = {
  weekValueLabel: string;
  weekCaption: string;
  weeks: number;
  days: number;
  trimester: 1 | 2 | 3;
  trimesterLabel: string;
  edd: LocalDateISO;
  eddValueLabel: string;
  eddCaption: string;
  daysRemaining: number;
  daysRemainingLabel: string;
};

export type PregnancyDashboardMilestoneItem = {
  id: PregnancyMilestoneID;
  title: string;
  body: string;
};

export type PregnancyDashboardMetricItem = {
  label: string;
  value: string;
};

// Red-flag education content (Y1 phase 2) shown, collapsed by default, at the
// bottom of the pregnancy dashboard. This is the STATIC set of item ids that
// belong to the pregnancy context -- never derived from or evaluated against
// logged data (see red-flag-copy.ts's file header for the full tone/scope
// invariant). Order matches the product spec.
const PREGNANCY_RED_FLAG_ITEM_IDS: readonly RedFlagItemID[] = [
  "heavy_bleeding",
  "preeclampsia_signs",
  "severe_vomiting",
  "reduced_movements",
  "waters_early",
  "fever",
];

export type PregnancyDashboardRedFlagItem = {
  id: RedFlagItemID;
  title: string;
  body: string;
};

// "Baby this week" card (Y9, education-only). Per-week fetal size +
// development content, resolved from gaWeeks -- see resolveBabyWeekEntry.
// Always-present shape (mirrors kickTeaser/multiplesCard's own
// always-present-object convention) so the screen stays pure view-data
// branching: `multiplesNote` is the only optional-feeling field, and it is
// `null` rather than an omitted key so the screen never has to distinguish
// "not multiples" from "not yet loaded".
export type PregnancyDashboardBabyWeekViewData = {
  title: string;
  sizeLine: string;
  developmentLine: string;
  multiplesNote: string | null;
};

export type PregnancyDashboardViewData = {
  disclaimer: string;
  hero: PregnancyDashboardHeroViewData;
  babyThisWeek: PregnancyDashboardBabyWeekViewData;
  milestones: {
    title: string;
    emptyLabel: string;
    items: PregnancyDashboardMilestoneItem[];
  };
  kickTeaser: {
    visible: boolean;
    title: string;
    body: string;
  };
  // Multiples content card (Y0, education-only). `visible` mirrors
  // kickTeaser/contractionTimer's shape (always-present object, gated by a
  // boolean) rather than an optional field, so the screen stays pure
  // view-data branching. `body` already includes the monochorionic extra
  // line (mcda/mcma only) pre-joined -- the screen never assembles copy.
  multiplesCard: {
    visible: boolean;
    title: string;
    body: string;
  };
  // Contraction-timer dashboard card (X7). `visible` is always true while in
  // pregnancy dashboard mode (this function only ever runs for an active,
  // trackable pregnancy) -- kept as an explicit field rather than an implicit
  // "always render" for shape-parity with kickTeaser/birthCta, and so a
  // future gate (if one is ever needed) has a single place to land.
  // `prominent` places the card near the top of the screen in trimester III;
  // otherwise it renders in the quieter, lower position alongside kickTeaser.
  contractionTimer: {
    visible: boolean;
    prominent: boolean;
    title: string;
    body: string;
  };
  todayMetrics: {
    title: string;
    emptyLabel: string;
    hasAny: boolean;
    weight: PregnancyDashboardMetricItem | null;
    bloodPressure: PregnancyDashboardMetricItem | null;
  };
  // End-of-pregnancy actions, both decided here so the screen stays
  // presentational. `birthCta` is the prominent happy-path "I gave birth"
  // action surfaced at term (week 37+); `manageCta` is the quiet,
  // always-present link into the manage/loss/other + delete flow.
  birthCta: {
    visible: boolean;
    label: string;
  };
  manageCta: {
    label: string;
  };
  // Collapsed-by-default "when to contact your care team" education section
  // (Y1 phase 2). `items` is already filtered for the current gestational age
  // -- the screen renders it verbatim, no GA math or record reads there.
  redFlags: {
    title: string;
    intro: string;
    expandLabel: string;
    collapseLabel: string;
    items: PregnancyDashboardRedFlagItem[];
  };
};

export function buildPregnancyDashboardViewData(
  record: PregnancyRecord,
  today: LocalDateISO,
  language: string,
  todayLog?: DayLogRecord | null,
): PregnancyDashboardViewData | null {
  const ga = calcGestationalAge(record.edd, today);
  if (!ga) {
    // Out of the trackable window (e.g. a stale record more than three weeks
    // past term). The caller falls back to the cycle dashboard rather than
    // rendering a fabricated week.
    return null;
  }

  const copy = getPregnancyCopy(language);
  const endCopy = getPregnancyEndCopy(language);
  const contractionCopy = getContractionTimerCopy(language);
  const redFlagCopy = getRedFlagCopy(language);
  const babyWeekCopy = getBabyWeekCopy(language);
  const babyWeekEntry = resolveBabyWeekEntry(babyWeekCopy, ga.weeks);
  const daysRemaining = GESTATION_DAYS - ga.gaDays;
  const milestoneItems: PregnancyDashboardMilestoneItem[] = resolveCurrentMilestones(
    record.schedulePreset,
    ga.weeks,
  ).map((window) => ({
    id: window.id,
    title: copy.milestones.items[window.id].title,
    body: copy.milestones.items[window.id].body,
  }));

  // Multiples (Y0, education-only): fetusCount absent/1 == singleton. The
  // monochorionic extra line is appended here (never in the screen) so the
  // presentational layer stays pure view-data branching -- see
  // multiplesCard's own type comment.
  const isMultiples = (record.fetusCount ?? 1) >= 2;
  const isMonochorionic =
    record.chorionicity === "mcda" || record.chorionicity === "mcma";
  const multiplesCardBody = isMonochorionic
    ? `${copy.multiplesCard.body}\n\n${copy.multiplesCard.monoLine}`
    : copy.multiplesCard.body;

  // GA-gated subset of the static id list: reduced_movements only from
  // KICK_COUNTS_START_WEEK (same convention as kickTeaser below), waters_early
  // only before term (37 weeks, the same term boundary birthCta uses below).
  // Every other pregnancy item is always included.
  const redFlagItems: PregnancyDashboardRedFlagItem[] = PREGNANCY_RED_FLAG_ITEM_IDS.filter(
    (id) => {
      switch (id) {
        case "reduced_movements":
          return ga.weeks >= KICK_COUNTS_START_WEEK;
        case "waters_early":
          return ga.weeks < 37;
        default:
          return true;
      }
    },
  ).map((id) => ({
    id,
    title: redFlagCopy.items[id].title,
    body: redFlagCopy.items[id].body,
  }));

  const weight =
    todayLog?.weightKg !== undefined && todayLog.weightKg > 0
      ? {
          label: copy.metrics.weightLabel,
          value: copy.metrics.weightValue(todayLog.weightKg),
        }
      : null;
  const bloodPressure =
    todayLog?.bpSystolic !== undefined &&
    todayLog.bpSystolic > 0 &&
    todayLog?.bpDiastolic !== undefined &&
    todayLog.bpDiastolic > 0
      ? {
          label: copy.metrics.bloodPressureLabel,
          value: copy.metrics.bloodPressureValue(
            todayLog.bpSystolic,
            todayLog.bpDiastolic,
          ),
        }
      : null;

  return {
    disclaimer: copy.disclaimer,
    hero: {
      weekValueLabel: copy.hero.weekValue(ga.weeks, ga.days),
      weekCaption: copy.hero.weekCaption,
      weeks: ga.weeks,
      days: ga.days,
      trimester: ga.trimester,
      trimesterLabel: copy.hero.trimesterLabels[ga.trimester],
      edd: record.edd,
      eddValueLabel: formatDisplayDate(record.edd, language),
      eddCaption: copy.hero.eddCaption,
      daysRemaining,
      daysRemainingLabel: resolveDaysRemainingLabel(copy, daysRemaining),
    },
    babyThisWeek: {
      title: babyWeekCopy.title,
      sizeLine: babyWeekEntry.size,
      developmentLine: babyWeekEntry.development,
      multiplesNote: isMultiples ? babyWeekCopy.multiplesNote : null,
    },
    milestones: {
      title: copy.milestones.title,
      emptyLabel: copy.milestones.emptyLabel,
      items: milestoneItems,
    },
    kickTeaser: {
      visible: ga.weeks >= KICK_COUNTS_START_WEEK,
      title: copy.kickTeaser.title,
      body: copy.kickTeaser.body,
    },
    multiplesCard: {
      visible: isMultiples,
      title: copy.multiplesCard.title,
      body: multiplesCardBody,
    },
    contractionTimer: {
      visible: true,
      prominent: ga.trimester === 3,
      title: contractionCopy.dashboardCard.title,
      body: contractionCopy.dashboardCard.body,
    },
    todayMetrics: {
      title: copy.metrics.title,
      emptyLabel: copy.metrics.emptyLabel,
      hasAny: weight !== null || bloodPressure !== null,
      weight,
      bloodPressure,
    },
    birthCta: {
      // Prominent "I gave birth" surfaced at term (week 37+). The wider
      // trimester-III gate was rejected: from week 28 the CTA would misfire by
      // 2+ months for most users. Preterm births stay fully covered by the
      // always-visible manage link, which offers the birth path at any
      // gestational age. (Decision recorded in the X8 notes.)
      visible: ga.weeks >= 37,
      label: endCopy.dashboard.birthCta,
    },
    manageCta: {
      label: endCopy.dashboard.manageCta,
    },
    redFlags: {
      title: redFlagCopy.section.title,
      intro: redFlagCopy.section.intro,
      expandLabel: redFlagCopy.section.expandLabel,
      collapseLabel: redFlagCopy.section.collapseLabel,
      items: redFlagItems,
    },
  };
}

export type PregnancyStaleCardViewData = {
  title: string;
  body: string;
  ctaLabel: string;
};

// Compact fallback for an active pregnancy record whose gestational age no
// longer resolves (buildPregnancyDashboardViewData returned null) because
// today has drifted well past the due date -- distinct from a malformed/
// future EDD, which keeps the prior silent cycle-mode fallback (returns
// null here too; see pregnancy-timeline-service.resolveOutOfWindowReason and
// this function's sole caller, buildPregnancySection in
// dashboard-view-service.ts). Reuses the existing "manage pregnancy
// tracking" CTA copy/destination rather than minting a second
// near-duplicate label.
export function buildPregnancyStaleCardViewData(
  record: PregnancyRecord,
  today: LocalDateISO,
  language: string,
): PregnancyStaleCardViewData | null {
  if (resolveOutOfWindowReason(record.edd, today) !== "past_window") {
    return null;
  }

  const copy = getPregnancyCopy(language);
  const endCopy = getPregnancyEndCopy(language);
  return {
    title: copy.staleCard.title,
    body: copy.staleCard.body,
    ctaLabel: endCopy.dashboard.manageCta,
  };
}

function resolveDaysRemainingLabel(
  copy: ReturnType<typeof getPregnancyCopy>,
  daysRemaining: number,
): string {
  if (daysRemaining > 1) {
    return copy.hero.daysToGo(daysRemaining);
  }
  if (daysRemaining === 1) {
    return copy.hero.dayToGo;
  }
  if (daysRemaining === 0) {
    return copy.hero.dueToday;
  }
  const overdue = Math.abs(daysRemaining);
  return overdue === 1 ? copy.hero.overdueOne : copy.hero.overdue(overdue);
}

// "Baby this week" (Y9) week-number resolution, kept separate from the copy
// catalog itself (which only owns the text, never the resolution rule -- same
// split as every other i18n catalog in this codebase). 0-3 weeks (before the
// per-week catalog starts at week 4) use the gentler veryEarly entry; 42+
// (past the top of the authored catalog, week 41) reuses week 41's entry
// rather than fabricating a 43rd data point -- growth detail this close to or
// past term is not meaningfully different week to week at this card's level
// of generality. gaWeeks is always a non-negative integer (calcGestationalAge
// floors it), so the two branches below are exhaustive over calcGestationalAge's
// entire sane 0..43-week output range.
function resolveBabyWeekEntry(
  copy: ReturnType<typeof getBabyWeekCopy>,
  gaWeeks: number,
): { size: string; development: string } {
  if (gaWeeks <= 3) {
    return copy.veryEarly;
  }

  const clampedWeek = Math.min(gaWeeks, 41) as BabyWeekNumber;
  return copy.weeks[clampedWeek];
}

function formatDisplayDate(value: LocalDateISO, locale: string): string {
  const parsed = parseLocalDate(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}
