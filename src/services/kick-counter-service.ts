import { getKickCounterCopy } from "../i18n/kick-counter-copy";
import {
  KICK_COUNTS_START_WEEK,
  sanitizeKickCountSession,
  type KickCountSession,
  type PregnancyRecord,
} from "../models/pregnancy";
import type { LocalDateISO } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { calcGestationalAge } from "./pregnancy-timeline-service";
import { formatLocalDate, parseLocalDate } from "./profile-settings-policy";

// Kick-count session lifecycle + the kick-counter screen's view-data (X6).
// An in-progress session (start time, taps) is screen-local state -- this
// module only persists on finish, via `finishKickCountSession`. The
// "count to 10" movements-in-2-hours convention is presented as a progress
// benchmark only, never a verdict: a session that finishes at 3 kicks renders
// the exact same neutral education line as one that finishes at 15. Nothing
// here auto-flags, auto-alerts, or diagnoses a low count -- see the
// education-only tone rule in pregnancy-copy.ts and SECURITY.md's
// medical-safety invariant.
export const KICK_COUNT_TARGET = 10;

export type FinishKickCountSessionInput = {
  startedAt: Date;
  kickCount: number;
};

export type FinishKickCountSessionResult =
  | { ok: true; session: KickCountSession }
  | { ok: false; errorCode: "save_failed" };

// Persists a finished session: duration is the whole-minute elapsed time
// (clamped into the model's bounds by sanitizeKickCountSession), kickCount is
// the raw tap count from screen state (also clamped there). Completing at 10
// taps is only a UI convention (KICK_COUNT_TARGET) -- this function accepts
// any non-negative count, early or past 10, up to the model max.
export async function finishKickCountSession(
  storage: LocalAppStorage,
  input: FinishKickCountSessionInput,
  now: Date = new Date(),
): Promise<FinishKickCountSessionResult> {
  const elapsedMinutes = Math.round(
    (now.getTime() - input.startedAt.getTime()) / 60000,
  );

  // sanitizeKickCountSession clamps durationMinutes/kickCount into the model
  // bounds (src/models/pregnancy.ts) and only rejects a malformed id/date --
  // both constructed here and always well-formed, so a null result is
  // unreachable in practice; narrowed defensively rather than asserted past.
  const session = sanitizeKickCountSession({
    id: createKickSessionID(),
    date: formatLocalDate(input.startedAt),
    durationMinutes: elapsedMinutes,
    kickCount: input.kickCount,
  });
  if (!session) {
    return { ok: false, errorCode: "save_failed" };
  }

  try {
    await storage.writeKickSession(session);
  } catch {
    return { ok: false, errorCode: "save_failed" };
  }

  return { ok: true, session };
}

export type DeleteKickCountSessionResult =
  | { ok: true }
  | { ok: false; errorCode: "generic" };

export async function deleteKickCountSession(
  storage: LocalAppStorage,
  id: string,
): Promise<DeleteKickCountSessionResult> {
  try {
    await storage.deleteKickSession(id);
    return { ok: true };
  } catch {
    return { ok: false, errorCode: "generic" };
  }
}

export type KickCounterHistoryRow = {
  id: string;
  dateLabel: string;
  kickCount: number;
  durationLabel: string;
};

export type KickCounterViewData = {
  // active && gaWeeks >= KICK_COUNTS_START_WEEK. False for no pregnancy, an
  // ended pregnancy, or a gestational age outside the trackable window.
  accessible: boolean;
  educationLine: string;
  history: {
    title: string;
    emptyLabel: string;
    deleteLabel: string;
    rows: KickCounterHistoryRow[];
  };
};

export function buildKickCounterViewData(
  activePregnancy: PregnancyRecord | null,
  today: LocalDateISO,
  sessions: readonly KickCountSession[],
  language: string,
): KickCounterViewData {
  const copy = getKickCounterCopy(language);
  const ga =
    activePregnancy && activePregnancy.status === "active"
      ? calcGestationalAge(activePregnancy.edd, today)
      : null;
  const accessible = ga !== null && ga.weeks >= KICK_COUNTS_START_WEEK;

  const rows: KickCounterHistoryRow[] = [...sessions]
    .sort(compareSessionsNewestFirst)
    .map((session) => ({
      id: session.id,
      dateLabel: formatDisplayDate(session.date, language),
      kickCount: session.kickCount,
      durationLabel: copy.history.durationValue(session.durationMinutes),
    }));

  return {
    accessible,
    educationLine: copy.counter.educationLine,
    history: {
      title: copy.history.title,
      emptyLabel: copy.history.emptyLabel,
      deleteLabel: copy.history.deleteLabel,
      rows,
    },
  };
}

// Newest first by date; same-day sessions are ordered by id only for a
// stable, deterministic result -- KickCountSession has no time-of-day field,
// so same-day entries cannot be ordered by when they actually happened.
function compareSessionsNewestFirst(
  a: KickCountSession,
  b: KickCountSession,
): number {
  if (a.date !== b.date) {
    return a.date > b.date ? -1 : 1;
  }
  return b.id.localeCompare(a.id);
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

let kickSessionIDCounter = 0;

function createKickSessionID(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `kick_${globalThis.crypto.randomUUID()}`;
  }

  kickSessionIDCounter += 1;
  return `kick_${Date.now().toString(36)}_${kickSessionIDCounter.toString(36)}`;
}
