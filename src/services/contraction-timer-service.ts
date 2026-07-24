import { getContractionTimerCopy } from "../i18n/contraction-timer-copy";
import { getPregnancyEndCopy } from "../i18n/pregnancy-end-copy";
import {
  CONTRACTION_511_MAX_INTERVAL_MINUTES,
  CONTRACTION_511_MIN_DURATION_SECONDS,
  CONTRACTION_511_MIN_WINDOW_MINUTES,
  MAX_CONTRACTION_SESSION_SPAN_HOURS,
  MAX_CONTRACTIONS_PER_SESSION,
  sanitizeContractionSession,
  type ContractionEntry,
  type ContractionSession,
  type PregnancyRecord,
} from "../models/pregnancy";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  calcGestationalAge,
  resolveBirthOptionVisible,
  type GestationalAge,
} from "./pregnancy-timeline-service";
import { formatLocalDate } from "./profile-settings-policy";

// Contraction-timer session lifecycle + derived 5-1-1 math + the contraction-
// timer screen's view-data (GA-aware education + the
// week-20 birth-option gate). Mirrors kick-counter-service.ts's structure and
// tone rules closely: education only, neutral, no exclamation marks. The
// 5-1-1 detection is SURFACING ONLY -- matches511Pattern() drives which of
// two renderings of the APPLICABLE education line the screen shows (calmer
// vs visually elevated; which line is "applicable" is a separate,
// GA-dependent choice, see resolveEducationVariant below); nothing here
// raises an alarm, schedules a notification, or renders a "go to hospital
// now" verdict. See SECURITY.md's medical-safety invariant.
//
// Unlike kick-counter (which persists only once, on Finish), a labor session
// can run for hours and app kills are likely, so every COMPLETED contraction
// is upserted individually via storage.writeContractionSession -- a kill ever
// loses at most the single in-flight (not-yet-stopped) contraction, which was
// never persisted in the first place.
//
// All elapsed-time math below runs on epoch milliseconds (`Date.parse`/
// `Date#getTime()` of the ISO datetime fields), never calendar-day helpers --
// this is wall-clock elapsed time (contractions are timed to the second), and
// epoch-ms diffs are DST-safe by construction (no local calendar arithmetic).

// A killed/restarted app (or a screen re-open after leaving the app) resumes
// today's latest session when its last activity is within this many minutes;
// otherwise a fresh session starts. 2 hours: long enough to survive a short
// break (walking, a car ride to the hospital) without silently stitching
// together two genuinely separate labors/false-labor episodes days apart.
export const CONTRACTION_RESUME_WINDOW_MINUTES = 120;

// --- Session lifecycle -------------------------------------------------------

function createContractionSessionID(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `contraction_${globalThis.crypto.randomUUID()}`;
  }

  contractionSessionIDCounter += 1;
  return `contraction_${Date.now().toString(36)}_${contractionSessionIDCounter.toString(36)}`;
}
let contractionSessionIDCounter = 0;

// A brand-new, empty, NOT-YET-PERSISTED session draft. Nothing is written to
// storage until its first contraction completes (stopContraction) -- an
// app kill before that point loses nothing, because nothing was ever saved.
export function createContractionSession(startedAt: Date): ContractionSession {
  return {
    id: createContractionSessionID(),
    date: formatLocalDate(startedAt),
    startedAt: startedAt.toISOString(),
    contractions: [],
  };
}

function sessionLastActivityMs(session: ContractionSession): number {
  let latestMs = new Date(session.startedAt).getTime();
  for (const entry of session.contractions) {
    const entryMs = new Date(entry.startedAt).getTime();
    if (entryMs > latestMs) {
      latestMs = entryMs;
    }
  }
  return latestMs;
}

function pickMostRecentSession(
  sessions: readonly ContractionSession[],
): ContractionSession | null {
  if (sessions.length === 0) {
    return null;
  }

  return sessions.reduce((latest, candidate) =>
    sessionLastActivityMs(candidate) > sessionLastActivityMs(latest) ? candidate : latest,
  );
}

// Pure resume/create decision, isolated from the storage read so the 2-hour
// boundary is directly unit-testable with plain fixture arrays. "Last
// activity" is the session's own startedAt when it has no contractions yet,
// else the latest contraction's startedAt -- both compared to `now` in epoch
// milliseconds. The boundary is inclusive: exactly 120 minutes still resumes;
// any amount over starts fresh.
export function resolveResumableSession(
  sessions: readonly ContractionSession[],
  now: Date,
): ContractionSession | null {
  const latest = pickMostRecentSession(sessions);
  if (!latest) {
    return null;
  }

  const elapsedMinutes = (now.getTime() - sessionLastActivityMs(latest)) / 60_000;
  return elapsedMinutes <= CONTRACTION_RESUME_WINDOW_MINUTES ? latest : null;
}

// On-open entry point: continues the latest persisted session when its last
// activity is within CONTRACTION_RESUME_WINDOW_MINUTES, else returns a fresh
// (not-yet-persisted) one. Reads the full session list rather than a
// date-bounded slice -- a labor session's own model bound already caps it at
// MAX_CONTRACTION_SESSION_SPAN_HOURS (24h), and this screen is opened at most
// a handful of times ever per pregnancy, so an unbounded local read is simple
// and cheap rather than a premature date-range optimization.
export async function resumeOrCreateSession(
  storage: LocalAppStorage,
  now: Date = new Date(),
): Promise<ContractionSession> {
  const sessions = await storage.listContractionSessions();
  return resolveResumableSession(sessions, now) ?? createContractionSession(now);
}

// Pure: begin timing a contraction. The in-progress "which instant did the
// current contraction start" is screen-local state (never persisted on its
// own, mirroring kick-counter's un-persisted "started" tap) -- this just
// centralizes the ISO-string representation so the screen and
// stopContraction agree on its shape.
export function startContraction(now: Date): string {
  return now.toISOString();
}

// A session accepts one more contraction when it is both under the count
// cap and the new contraction's start falls within the session's 24h span.
// Both bounds also exist inside sanitizeContractionSession, but that
// function *silently drops* whatever doesn't fit (slice(0, 500) keeps the
// FIRST 500 raw entries and filters entries outside the time window) -- if
// we always appended to the existing session and let the sanitizer clean up
// afterward, hitting either limit would silently discard the just-completed
// contraction instead of the caller ever finding out. Checking here lets
// stopContraction roll the just-completed contraction into a brand-new
// session instead of losing it.
function sessionAcceptsContraction(
  session: ContractionSession,
  contractionStartedAt: Date,
): boolean {
  if (session.contractions.length >= MAX_CONTRACTIONS_PER_SESSION) {
    return false;
  }

  const sessionStartMs = new Date(session.startedAt).getTime();
  const maxEntryMs = sessionStartMs + MAX_CONTRACTION_SESSION_SPAN_HOURS * 60 * 60 * 1000;
  return contractionStartedAt.getTime() <= maxEntryMs;
}

export type StopContractionResult =
  | { ok: true; session: ContractionSession; rolledOver: boolean }
  | { ok: false; errorCode: "save_failed" };

// Ends the in-progress contraction: computes its whole-second duration
// (clamped into the model's 5-600s bound by sanitizeContractionSession),
// appends it to `session` (or, if `session` is already at a model bound --
// see sessionAcceptsContraction -- to a brand-new session instead, so the
// limit is honored by cleanly starting the next session rather than
// dropping data; `rolledOver` tells the caller this happened), and upserts
// the WHOLE resulting session via storage.writeContractionSession.
export async function stopContraction(
  storage: LocalAppStorage,
  session: ContractionSession,
  activeContractionStartedAt: string,
  now: Date = new Date(),
): Promise<StopContractionResult> {
  const contractionStartedAt = new Date(activeContractionStartedAt);
  const durationSeconds = Math.max(
    0,
    Math.round((now.getTime() - contractionStartedAt.getTime()) / 1000),
  );

  const rolledOver = !sessionAcceptsContraction(session, contractionStartedAt);
  const targetSession = rolledOver ? createContractionSession(contractionStartedAt) : session;

  const entry: ContractionEntry = {
    startedAt: contractionStartedAt.toISOString(),
    durationSeconds,
  };
  const candidate = {
    ...targetSession,
    contractions: [...targetSession.contractions, entry],
  };

  // candidate is always well-formed here (id/date/startedAt all constructed
  // above, contractions is a plain array), so sanitized === null is
  // unreachable in practice -- narrowed defensively rather than asserted
  // past, mirroring finishKickCountSession's identical comment.
  const sanitized = sanitizeContractionSession(candidate);
  if (!sanitized) {
    return { ok: false, errorCode: "save_failed" };
  }

  try {
    await storage.writeContractionSession(sanitized);
  } catch {
    return { ok: false, errorCode: "save_failed" };
  }

  return { ok: true, session: sanitized, rolledOver };
}

type ServiceResult = { ok: true } | { ok: false; errorCode: "generic" };

async function deleteSessionRecord(
  storage: LocalAppStorage,
  id: string,
): Promise<ServiceResult> {
  try {
    await storage.deleteContractionSession(id);
    return { ok: true };
  } catch {
    return { ok: false, errorCode: "generic" };
  }
}

// Discards the CURRENT (active) session shown on the timer screen. A session
// with zero completed contractions was never written to storage (see
// createContractionSession), so there is nothing to delete -- discarding it
// is a no-op success. A session with >=1 completed contraction has been
// upserted per-contraction and must be explicitly removed.
export async function discardSession(
  storage: LocalAppStorage,
  session: ContractionSession,
): Promise<ServiceResult> {
  if (session.contractions.length === 0) {
    return { ok: true };
  }
  return deleteSessionRecord(storage, session.id);
}

// Deletes one PAST session row from the history list below the active
// session. Distinct name from storage.deleteContractionSession (the storage
// method this delegates to) so both can be imported side by side without
// aliasing, mirroring kick-counter-service.ts's deleteKickCountSession vs.
// storage.deleteKickSession naming split.
export async function deleteContractionHistorySession(
  storage: LocalAppStorage,
  id: string,
): Promise<ServiceResult> {
  return deleteSessionRecord(storage, id);
}

// --- Derived metrics (pure) --------------------------------------------------

function sortedContractions(session: ContractionSession): ContractionEntry[] {
  return [...session.contractions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
}

export type ContractionIntervalRow = {
  startedAt: string;
  durationSeconds: number;
  // Start-to-start gap since the PREVIOUS contraction, in whole seconds; null
  // for the chronologically first contraction in the session (no previous).
  intervalSeconds: number | null;
};

// Chronological (oldest-first) rows with each entry's start-to-start
// interval since the one before it. Pure function over the session alone --
// no `now` involved, since every gap here is between two already-completed
// contractions.
export function computeContractionIntervals(
  session: ContractionSession,
): ContractionIntervalRow[] {
  const sorted = sortedContractions(session);
  return sorted.map((entry, index) => {
    if (index === 0) {
      return { startedAt: entry.startedAt, durationSeconds: entry.durationSeconds, intervalSeconds: null };
    }
    const previous = sorted[index - 1]!;
    const intervalSeconds = Math.round(
      (new Date(entry.startedAt).getTime() - new Date(previous.startedAt).getTime()) / 1000,
    );
    return { startedAt: entry.startedAt, durationSeconds: entry.durationSeconds, intervalSeconds };
  });
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export type ContractionWindowSummary = {
  count: number;
  averageIntervalSeconds: number | null;
  averageDurationSeconds: number | null;
  windowMinutes: number;
};

// Rolling-window summary over the trailing `windowMinutes` (default the
// CONTRACTION_511_MIN_WINDOW_MINUTES constant, 60): count of contractions
// whose startedAt falls in (now - windowMinutes, now], their average
// duration, and the average start-to-start interval computed FRESH between
// consecutive contractions *within that windowed subset* -- not reusing
// computeContractionIntervals's whole-session gaps, which could otherwise
// pull in one stale gap back to a contraction just outside the window.
export function computeWindowSummary(
  session: ContractionSession,
  now: Date,
  windowMinutes: number = CONTRACTION_511_MIN_WINDOW_MINUTES,
): ContractionWindowSummary {
  const nowMs = now.getTime();
  const windowStartMs = nowMs - windowMinutes * 60_000;
  const windowed = sortedContractions(session).filter((entry) => {
    const entryMs = new Date(entry.startedAt).getTime();
    return entryMs > windowStartMs && entryMs <= nowMs;
  });

  const intervals: number[] = [];
  for (let i = 1; i < windowed.length; i += 1) {
    intervals.push(
      Math.round(
        (new Date(windowed[i]!.startedAt).getTime() -
          new Date(windowed[i - 1]!.startedAt).getTime()) /
          1000,
      ),
    );
  }

  return {
    count: windowed.length,
    averageDurationSeconds: average(windowed.map((entry) => entry.durationSeconds)),
    averageIntervalSeconds: average(intervals),
    windowMinutes,
  };
}

// The 5-1-1 pattern-match rule, as implemented (documented here in full,
// pinned by contraction-timer-service.test.ts's boundary matrix):
//
// 1. Fewer than 2 contractions in the session -> never matches (no interval
//    exists to evaluate "5 minutes apart" against).
// 2. The rule reflects a CURRENTLY ongoing pattern, not stale history: if
//    it has already been more than CONTRACTION_511_MAX_INTERVAL_MINUTES (5)
//    since the latest contraction started, or the latest contraction itself
//    lasted under CONTRACTION_511_MIN_DURATION_SECONDS (60s), the pattern
//    does not (currently) match, regardless of what came before.
// 3. Otherwise, walk backward from the latest contraction, extending a
//    qualifying streak while each consecutive start-to-start gap is
//    <=5 minutes AND the OLDER contraction of that pair lasted >=60s. The
//    streak breaks at the first disqualifying gap/duration, or at the start
//    of the session's data.
// 4. The pattern matches only if that streak's span (latest contraction's
//    startedAt minus the streak's earliest contraction's startedAt) is
//    >=CONTRACTION_511_MIN_WINDOW_MINUTES (60) minutes.
//
// Step 4 is deliberately the ONLY count-like gate: there is no separate
// hardcoded "minimum N contractions" constant. "Consecutive intervals cover
// the span" already forces a minimum count as a side effect of steps 3+4
// (e.g. covering a full 60-minute span with every gap <=5 min needs at
// least 13 contractions) -- adding a second, independent count threshold on
// top would risk the two disagreeing at the edges.
export function matches511Pattern(session: ContractionSession, now: Date): boolean {
  const sorted = sortedContractions(session);
  if (sorted.length < 2) {
    return false;
  }

  const latest = sorted[sorted.length - 1]!;
  const sinceLatestMinutes = (now.getTime() - new Date(latest.startedAt).getTime()) / 60_000;
  if (
    sinceLatestMinutes > CONTRACTION_511_MAX_INTERVAL_MINUTES ||
    latest.durationSeconds < CONTRACTION_511_MIN_DURATION_SECONDS
  ) {
    return false;
  }

  let streakStartIndex = sorted.length - 1;
  for (let i = sorted.length - 1; i > 0; i -= 1) {
    const current = sorted[i]!;
    const previous = sorted[i - 1]!;
    const gapMinutes =
      (new Date(current.startedAt).getTime() - new Date(previous.startedAt).getTime()) / 60_000;

    if (
      gapMinutes > CONTRACTION_511_MAX_INTERVAL_MINUTES ||
      previous.durationSeconds < CONTRACTION_511_MIN_DURATION_SECONDS
    ) {
      break;
    }
    streakStartIndex = i - 1;
  }

  const streakSpanMinutes =
    (new Date(latest.startedAt).getTime() - new Date(sorted[streakStartIndex]!.startedAt).getTime()) /
    60_000;

  return streakSpanMinutes >= CONTRACTION_511_MIN_WINDOW_MINUTES;
}

// mm:ss, locale-agnostic (digits + colon only, no translated unit words) --
// used for every duration/interval value in the view-data, so
// contraction-timer-copy.ts does not need a whole extra formatter dimension.
export function formatMinSecLabel(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDisplayDate(value: string, locale: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function formatDisplayTime(value: string, locale: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

// --- GA-aware education -------------------------------------------------

export type ContractionEducationVariant = "routine_511" | "preterm";

// Which contraction-education line the screen shows. Before term (week 37),
// regular contractions can be a sign of preterm labour -- an urgent-care cue,
// not routine timing practice -- so the routine 5-1-1 framing is medically
// wrong there. GA unknown (no active pregnancy, or a GA that does not
// currently resolve, e.g. a stale record past MAX_GESTATIONAL_AGE_DAYS)
// defaults to the routine variant: there is no specific gestational age to
// warrant the preterm notice. Surfacing only -- this never gates the timer
// itself (see ContractionTimerViewData.accessible), only which of the two
// education lines is shown.
export function resolveEducationVariant(
  ga: GestationalAge | null,
): ContractionEducationVariant {
  return ga !== null && ga.weeks < 37 ? "preterm" : "routine_511";
}

// --- View-data ---------------------------------------------------------------

export type ContractionTimerRow = {
  id: string;
  timeLabel: string;
  durationLabel: string;
  intervalLabel: string;
};

export type ContractionTimerWindowSummaryViewData = {
  title: string;
  hasData: boolean;
  countLabel: string;
  averageIntervalCaption: string;
  averageIntervalLabel: string;
  averageDurationCaption: string;
  averageDurationLabel: string;
  emptyLabel: string;
};

export type ContractionTimerViewData = {
  // Active pregnancy at ANY gestational age -- labor can be preterm, so
  // (unlike the kick counter) there is no week gate.
  accessible: boolean;
  rowsTitle: string;
  rowsColumnCaption: string;
  rows: ContractionTimerRow[];
  emptyRowsLabel: string;
  windowSummary: ContractionTimerWindowSummaryViewData;
  // Always present; the same words regardless of educationProminent for a
  // given educationVariant -- only the screen's presentation (calmer vs.
  // visually elevated) differs by that flag. Never an alarm, never a
  // notification, never a verdict.
  educationLine: string;
  // Which line educationLine resolves to (see resolveEducationVariant). The
  // screen does not branch on this itself -- it is exposed for direct
  // testability of the GA-aware selection at the view-data boundary.
  educationVariant: ContractionEducationVariant;
  educationProminent: boolean;
  // The birth-recording hand-off. `visible` follows the same
  // BIRTH_OPTION_MIN_WEEK gate as the pregnancy-end choice screen (see
  // resolveBirthOptionVisible) -- below week 20 the product's loss taxonomy
  // treats the outcome as loss, not birth. The TIMER ITSELF stays fully
  // accessible at any gestational age regardless of this flag (see
  // `accessible` above); only this CTA's offering is gated.
  birthCta: { label: string; visible: boolean };
};

export function buildContractionTimerViewData(
  activePregnancy: PregnancyRecord | null,
  session: ContractionSession,
  now: Date,
  language: string,
): ContractionTimerViewData {
  const copy = getContractionTimerCopy(language);
  const endCopy = getPregnancyEndCopy(language);
  const activeRecord =
    activePregnancy && activePregnancy.status === "active" ? activePregnancy : null;
  const accessible = activeRecord !== null;
  const today = formatLocalDate(now);
  const ga = activeRecord ? calcGestationalAge(activeRecord.edd, today) : null;
  const educationVariant = resolveEducationVariant(ga);
  const birthCtaVisible = activeRecord ? resolveBirthOptionVisible(activeRecord.edd, today) : true;

  const rows: ContractionTimerRow[] = computeContractionIntervals(session)
    .slice()
    .reverse()
    .map((row) => ({
      id: row.startedAt,
      timeLabel: formatDisplayTime(row.startedAt, language),
      durationLabel: formatMinSecLabel(row.durationSeconds),
      intervalLabel:
        row.intervalSeconds === null
          ? copy.counter.firstContractionLabel
          : formatMinSecLabel(row.intervalSeconds),
    }));

  const window = computeWindowSummary(session, now);
  const hasWindowData = window.count > 0;

  return {
    accessible,
    rowsTitle: copy.rows.title,
    rowsColumnCaption: copy.rows.columnCaption,
    rows,
    emptyRowsLabel: copy.counter.emptyRowsLabel,
    windowSummary: {
      title: copy.windowSummary.title,
      hasData: hasWindowData,
      countLabel: copy.windowSummary.countLabel(window.count),
      averageIntervalCaption: copy.windowSummary.averageIntervalCaption,
      averageIntervalLabel:
        window.averageIntervalSeconds === null
          ? copy.windowSummary.emptyLabel
          : formatMinSecLabel(window.averageIntervalSeconds),
      averageDurationCaption: copy.windowSummary.averageDurationCaption,
      averageDurationLabel:
        window.averageDurationSeconds === null
          ? copy.windowSummary.emptyLabel
          : formatMinSecLabel(window.averageDurationSeconds),
      emptyLabel: copy.windowSummary.emptyLabel,
    },
    educationLine:
      educationVariant === "preterm"
        ? copy.counter.educationLinePreterm
        : copy.counter.educationLine,
    educationVariant,
    educationProminent: matches511Pattern(session, now),
    birthCta: { label: endCopy.dashboard.birthCta, visible: birthCtaVisible },
  };
}

export type ContractionSessionHistoryRow = {
  id: string;
  dateLabel: string;
  startTimeLabel: string;
  contractionCountLabel: string;
};

export type ContractionSessionHistoryViewData = {
  title: string;
  emptyLabel: string;
  deleteLabel: string;
  rows: ContractionSessionHistoryRow[];
};

// History of PAST sessions (everything except the currently-active one),
// newest first. Takes the raw session list + the active session's id rather
// than requiring the caller to pre-filter, mirroring
// buildKickCounterViewData's "hand in the raw list, let the builder shape
// it" convention.
export function buildContractionSessionHistoryViewData(
  sessions: readonly ContractionSession[],
  activeSessionId: string | null,
  language: string,
): ContractionSessionHistoryViewData {
  const copy = getContractionTimerCopy(language);

  const rows: ContractionSessionHistoryRow[] = sessions
    .filter((session) => session.id !== activeSessionId)
    .slice()
    .sort((a, b) => (a.startedAt > b.startedAt ? -1 : 1))
    .map((session) => ({
      id: session.id,
      dateLabel: formatDisplayDate(session.date, language),
      startTimeLabel: formatDisplayTime(session.startedAt, language),
      contractionCountLabel: copy.history.countValue(session.contractions.length),
    }));

  return {
    title: copy.history.title,
    emptyLabel: copy.history.emptyLabel,
    deleteLabel: copy.history.deleteLabel,
    rows,
  };
}
