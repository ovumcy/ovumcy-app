import {
  buildCrisisSupportViewData,
  type CrisisSupportViewData,
} from "../i18n/crisis-copy";
import { getScreeningCopy } from "../i18n/screening-copy";
import type { PostpartumRecord } from "../models/postpartum";
import type { LocalDateISO } from "../models/profile";
import {
  EPDS_SELF_HARM_ITEM_INDEX,
  SCREENING_REPEAT_MIN_DAYS,
  type ScreeningResponse,
} from "../models/screening";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { diffLocalDays, parseLocalDate } from "./profile-settings-policy";

// EPDS mood-screening product logic (Y3): the dashboard offer cadence, the
// questionnaire view-data (published items paired with the instrument's scoring
// key), scoring + banding, and the neutral per-band result copy incl. the
// item-10 urgent-support override. All view-data assembly lives here so the
// screens stay presentational (architecture invariant). Scores are screening
// SIGNALS, never diagnoses — this module never renders a verdict.

// Common-practice EPDS bands: >=10 "worth discussing with a clinician",
// >=13 "commonly prompts further assessment". Encoded as thresholds only; the
// wording per band lives in screening-copy.ts. These are not diagnostic
// cut-offs — they select which supportive, non-alarming message to show.
export const EPDS_ELEVATED_THRESHOLD = 10;
export const EPDS_HIGH_THRESHOLD = 13;

export type ScreeningBand = "lower" | "elevated" | "high";

// The 0-3 score each DISPLAYED option carries, in the same order as the option
// labels in screening-copy.ts. Some published EPDS items list their options
// ascending (0->3), others descending (3->0); this is the instrument's scoring
// key, so it is structure (here), not text (copy). Index i lines up with
// copy.items[i].options.
const EPDS_OPTION_SCORES: readonly (readonly [
  number,
  number,
  number,
  number,
])[] = [
  [0, 1, 2, 3],
  [0, 1, 2, 3],
  [3, 2, 1, 0],
  [0, 1, 2, 3],
  [3, 2, 1, 0],
  [3, 2, 1, 0],
  [3, 2, 1, 0],
  [3, 2, 1, 0],
  [3, 2, 1, 0],
  [3, 2, 1, 0],
];

// --- Scoring ----------------------------------------------------------------

export type ScreeningScore = {
  score: number;
  selfHarmFlag: boolean;
  band: ScreeningBand;
};

export function scoreScreening(answers: readonly number[]): ScreeningScore {
  const score = answers.reduce((total, value) => total + value, 0);
  const selfHarmFlag = (answers[EPDS_SELF_HARM_ITEM_INDEX] ?? 0) > 0;
  return { score, selfHarmFlag, band: resolveScreeningBand(score) };
}

export function resolveScreeningBand(score: number): ScreeningBand {
  if (score >= EPDS_HIGH_THRESHOLD) {
    return "high";
  }
  if (score >= EPDS_ELEVATED_THRESHOLD) {
    return "elevated";
  }
  return "lower";
}

// --- Dashboard offer --------------------------------------------------------

export type ScreeningOfferViewData = {
  visible: boolean;
  title: string;
  body: string;
  ctaLabel: string;
};

// The postpartum-dashboard offer card. Visible when there is an ACTIVE
// postpartum record AND (no screening yet OR the most recent one is at least
// SCREENING_REPEAT_MIN_DAYS old). The offer is surfaced ONLY in active
// postpartum for now — mood screening has no cycle/pregnancy entry point yet.
//
// Dismissal is deliberately NOT modeled here: the screen keeps a "dismissed
// this session" flag in local state only, with no persistence, so the card
// reappears on the next visit. That is an intentional gentle-persistent nudge
// for a sensitive but easy-to-avoid check-in — the service always reports the
// cadence-truthful `visible`, and the screen may choose to hide it for the
// current session.
export function buildScreeningOfferViewData(
  postpartumRecord: PostpartumRecord | null,
  responses: readonly ScreeningResponse[],
  today: LocalDateISO,
  language: string,
): ScreeningOfferViewData {
  const copy = getScreeningCopy(language);
  const base = {
    title: copy.offer.title,
    body: copy.offer.body,
    ctaLabel: copy.offer.ctaLabel,
  };

  if (!postpartumRecord || postpartumRecord.status !== "active") {
    return { visible: false, ...base };
  }

  return { visible: isScreeningDue(responses, today), ...base };
}

function isScreeningDue(
  responses: readonly ScreeningResponse[],
  today: LocalDateISO,
): boolean {
  if (!parseLocalDate(today)) {
    // A malformed "today" cannot be reasoned about; fail closed to not-due
    // rather than nudging on bad input.
    return false;
  }

  const latest = resolveLatestResponse(responses);
  if (!latest) {
    // No screening on record yet -> the first offer is always due.
    return true;
  }

  const daysSince = diffLocalDays(latest.date, today);
  return daysSince >= SCREENING_REPEAT_MIN_DAYS;
}

function resolveLatestResponse(
  responses: readonly ScreeningResponse[],
): ScreeningResponse | null {
  let latest: ScreeningResponse | null = null;
  for (const response of responses) {
    if (!parseLocalDate(response.date)) {
      continue;
    }
    if (!latest || response.date.localeCompare(latest.date) > 0) {
      latest = response;
    }
  }
  return latest;
}

// --- Questionnaire ----------------------------------------------------------

export type ScreeningQuestionOption = {
  label: string;
  // The 0-3 EPDS score this option contributes; what the wizard records into
  // answers[index]. Never shown to the owner.
  value: number;
};

export type ScreeningQuestionViewData = {
  index: number;
  question: string;
  options: ScreeningQuestionOption[];
};

export type ScreeningQuestionnaireViewData = {
  intro: {
    title: string;
    body: string;
    instruction: string;
    privacyNote: string;
    attribution: string;
    startCta: string;
  };
  flow: {
    progress: (current: number, total: number) => string;
    next: string;
    back: string;
  };
  questions: ScreeningQuestionViewData[];
  disclaimer: string;
};

export function buildScreeningQuestionnaireViewData(
  language: string,
): ScreeningQuestionnaireViewData {
  const copy = getScreeningCopy(language);

  const questions: ScreeningQuestionViewData[] = copy.items.map(
    (item, index) => {
      const scores = EPDS_OPTION_SCORES[index] ?? [0, 1, 2, 3];
      return {
        index,
        question: item.question,
        options: item.options.map((label, optionIndex) => ({
          label,
          value: scores[optionIndex] ?? 0,
        })),
      };
    },
  );

  return {
    intro: {
      title: copy.intro.title,
      body: copy.intro.body,
      instruction: copy.intro.instruction,
      privacyNote: copy.intro.privacyNote,
      attribution: copy.intro.attribution,
      startCta: copy.intro.startCta,
    },
    flow: {
      progress: copy.flow.progress,
      next: copy.flow.next,
      back: copy.flow.back,
    },
    questions,
    disclaimer: copy.disclaimer,
  };
}

// --- Result -----------------------------------------------------------------

export type ScreeningResultViewData = {
  title: string;
  scoreCaption: string;
  band: ScreeningBand;
  bandTitle: string;
  bandBody: string;
  // Present ONLY when the self-harm flag is raised (item 10 > 0), regardless of
  // the total/band. The screen renders the shared CrisisSupportCard above the
  // band copy — calm and visually distinct, overriding the band message's
  // prominence — carrying the fixed guidance plus the owner's personal support
  // contact (Y4 phase 2 upgraded Y3's interim inline urgent-support block). It
  // is NEVER premium-gated. Null when the flag is clear.
  crisisSupport: CrisisSupportViewData | null;
  disclaimer: string;
  doneCta: string;
  // Message the screen surfaces only if the finish-time persist failed. The
  // result (incl. any urgent-support guidance) is always shown regardless of
  // persistence — safety guidance must not depend on a successful write.
  saveError: string;
};

export function buildScreeningResultViewData(
  result: ScreeningScore,
  language: string,
  // The owner's personal crisis contact, threaded from the profile by the
  // screen. Defaults to empty so callers that do not surface a contact still get
  // the fixed guidance. NEVER premium-gated — the crisis block is built purely
  // from copy + the local profile, no billing read.
  crisisContact: { name: string; phone: string } = { name: "", phone: "" },
): ScreeningResultViewData {
  const copy = getScreeningCopy(language);
  const band = copy.bands[result.band];

  return {
    title: copy.result.title,
    scoreCaption: copy.result.scoreCaption(result.score),
    band: result.band,
    bandTitle: band.title,
    bandBody: band.body,
    crisisSupport: result.selfHarmFlag
      ? buildCrisisSupportViewData(language, crisisContact.name, crisisContact.phone)
      : null,
    disclaimer: copy.result.disclaimer,
    doneCta: copy.result.doneCta,
    saveError: copy.result.saveError,
  };
}

// --- History (date + score only — answers never surface) --------------------

export type ScreeningHistoryRowViewData = {
  id: string;
  date: LocalDateISO;
  score: number;
  label: string;
};

export type ScreeningHistoryViewData = {
  title: string;
  empty: string;
  hasEntries: boolean;
  rows: ScreeningHistoryRowViewData[];
  backCta: string;
};

// The full history list. Deliberately surfaces DATE + SCORE only — the per-item
// answers never appear in any history UI (a past self-harm answer must not be
// re-exposed in a casual list view).
export function buildScreeningHistoryViewData(
  responses: readonly ScreeningResponse[],
  language: string,
): ScreeningHistoryViewData {
  const copy = getScreeningCopy(language);

  const rows: ScreeningHistoryRowViewData[] = [...responses]
    .filter((response) => parseLocalDate(response.date) !== null)
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((response) => ({
      id: response.id,
      date: response.date,
      score: response.score,
      label: copy.history.rowLabel(response.date, response.score),
    }));

  return {
    title: copy.history.title,
    empty: copy.history.empty,
    hasEntries: rows.length > 0,
    rows,
    backCta: copy.history.backCta,
  };
}

export type ScreeningHistorySummaryViewData = {
  // Dashboard row when at least one response exists ("Last check-in: {date},
  // score {n}"), navigating to the history list. Date + score only.
  label: string;
  openCtaLabel: string;
};

export function buildScreeningHistorySummaryViewData(
  responses: readonly ScreeningResponse[],
  language: string,
): ScreeningHistorySummaryViewData | null {
  const latest = resolveLatestResponse(responses);
  if (!latest) {
    return null;
  }

  const copy = getScreeningCopy(language);
  return {
    label: copy.history.lastCheckInLabel(latest.date, latest.score),
    openCtaLabel: copy.history.openCta,
  };
}

// --- Delete (hard delete of the screening data class) -----------------------

export type DeleteScreeningDataResult =
  | { ok: true }
  | { ok: false; errorCode: "generic" };

// Hard-delete of the whole screening data class. Mirrors
// postpartum-mode-service.deleteAllPostpartumData's result shape: destructive
// and gated in the UI behind device auth + an explicit confirm dialog. The
// storage method removes ONLY screening_responses — mental-health screening is
// a SEPARATE sensitive class, never deleted as a side effect of the postpartum
// (or any other) delete.
export async function deleteAllScreeningData(
  storage: LocalAppStorage,
): Promise<DeleteScreeningDataResult> {
  try {
    await storage.deleteAllScreeningData();
    return { ok: true };
  } catch {
    return { ok: false, errorCode: "generic" };
  }
}
