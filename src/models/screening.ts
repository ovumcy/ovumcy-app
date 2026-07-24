import type { LocalDateISO } from "./profile";

// EPDS mood-screening domain model. Mental-health screening answers are a
// DISTINCT sensitive data class, handled more strictly than the rest of the
// health data: the full answer vector and the derived score live ONLY in the
// encrypted payload at the storage boundary — the sole plaintext is the
// completion `day` (for history ordering and the repeat-cadence query). A score
// is a screening SIGNAL, never a diagnosis; nothing in this model renders a
// verdict.
//
// Instrument: Edinburgh Postnatal Depression Scale (EPDS), Cox J.L., Holden
// J.M., Sagovsky R. (1987), British Journal of Psychiatry 150, 568-570. Ten
// items, each scored 0-3, total 0-30. Item 10 (index 9) asks about thoughts of
// self-harm — ANY non-zero answer there raises selfHarmFlag regardless of the
// total. The published EPDS wording is reproducible with attribution; the item
// text itself lives in the i18n copy catalog, not here (this layer is
// transport-free numbers only).

// Single-member instrument union today, kept as a proper catalog (not a bare
// string literal type) so a second instrument can be added later without
// changing any call-site shape — mirrors pregnancy.ts's
// PREGNANCY_SCHEDULE_PRESET_VALUES.
export const SCREENING_INSTRUMENT_VALUES = ["epds"] as const;
export type ScreeningInstrument = (typeof SCREENING_INSTRUMENT_VALUES)[number];

// --- EPDS structural constants ---------------------------------------------

export const EPDS_ITEM_COUNT = 10;
export const EPDS_MIN_ANSWER = 0;
export const EPDS_MAX_ANSWER = 3;
// Minimum total is trivially 0; the maximum (30) is referenced by the result
// caption + tests.
export const EPDS_MAX_SCORE = 30;
// Item 10 (the self-harm question) as a zero-based index into `answers`.
export const EPDS_SELF_HARM_ITEM_INDEX = 9;

// Minimum days between screenings before the dashboard re-offers one. This is a
// gentle cadence floor so the offer is not nagging, NOT a clinical re-screen
// interval. The visibility logic that consumes it lives in screening-service.ts.
export const SCREENING_REPEAT_MIN_DAYS = 14;

// --- Record ------------------------------------------------------------------

export type ScreeningResponse = {
  id: string;
  // Completion day. The ONLY field mirrored to a plaintext column, and only for
  // history ordering + the repeat-cadence query; the answers/score never are.
  date: LocalDateISO;
  instrument: ScreeningInstrument;
  // Exactly EPDS_ITEM_COUNT integers, each in EPDS_MIN_ANSWER..EPDS_MAX_ANSWER.
  answers: number[];
  // Derived (sum of answers, 0-30). Stored for history integrity even though it
  // is derivable — but recomputed on read; see sanitizeScreeningResponse.
  score: number;
  // Derived: answers[EPDS_SELF_HARM_ITEM_INDEX] > 0.
  selfHarmFlag: boolean;
};

// --- Factory -----------------------------------------------------------------

export type CreateScreeningResponseInput = {
  date: LocalDateISO;
  answers: number[];
  instrument?: ScreeningInstrument;
};

// Computes score + selfHarmFlag from answers and REJECTS invalid shapes by
// throwing. The questionnaire wizard guarantees ten valid answers before it can
// finish, so an invalid shape reaching here is a programming error that must
// fail loudly rather than silently persist a partial or garbage screening (a
// falsely-reassuring mental-health record is exactly the failure mode to avoid).
export function createScreeningResponse(
  input: CreateScreeningResponseInput,
): ScreeningResponse {
  const instrument = input.instrument ?? "epds";
  if (!SCREENING_INSTRUMENT_VALUES.includes(instrument)) {
    throw new Error("createScreeningResponse: unknown instrument");
  }
  if (typeof input.date !== "string" || !isValidLocalDateISO(input.date)) {
    throw new Error("createScreeningResponse: invalid completion date");
  }
  const answers = normalizeAnswers(input.answers);
  if (!answers) {
    throw new Error(
      "createScreeningResponse: answers must be 10 integers in 0-3",
    );
  }
  return {
    id: createScreeningResponseID(),
    date: input.date,
    instrument,
    answers,
    score: sumAnswers(answers),
    selfHarmFlag: resolveSelfHarmFlag(answers),
  };
}

let screeningResponseIDCounter = 0;

function createScreeningResponseID(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `screening_${globalThis.crypto.randomUUID()}`;
  }

  screeningResponseIDCounter += 1;
  return `screening_${Date.now().toString(36)}_${screeningResponseIDCounter.toString(36)}`;
}

// --- Sanitize (read / sync-restore / import validation) --------------------
//
// Contract mirrors sanitizePostpartumRecord: id/instrument/date/answers must be
// structurally valid or the whole record is rejected (null) — there is no
// "fall back to a default answer", because a fabricated screening answer is
// exactly the kind of silent data-loss/data-forgery this class must never do.
//
// The one deliberate difference: score and selfHarmFlag are ALWAYS RECOMPUTED
// from the (validated) answers and any stored values are discarded. History
// integrity beats stored-value trust — a row whose stored score/flag disagrees
// with its answers (a drifted older write, or a tampered database file) must
// never surface a falsely-reassuring number. The answers are the source of
// truth; score/selfHarmFlag are a cache, corrected here.
export function sanitizeScreeningResponse(
  value: unknown,
): ScreeningResponse | null {
  if (!isRecordObject(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (id === "") {
    return null;
  }

  const instrument = value.instrument as ScreeningInstrument;
  if (!SCREENING_INSTRUMENT_VALUES.includes(instrument)) {
    return null;
  }

  const date = typeof value.date === "string" ? value.date : "";
  if (!isValidLocalDateISO(date)) {
    return null;
  }

  const answers = normalizeAnswers(value.answers);
  if (!answers) {
    return null;
  }

  return {
    id,
    date,
    instrument,
    answers,
    score: sumAnswers(answers),
    selfHarmFlag: resolveSelfHarmFlag(answers),
  };
}

// --- Internal helpers --------------------------------------------------------

// Validates and copies the answer vector: exactly EPDS_ITEM_COUNT entries, each
// an integer in [EPDS_MIN_ANSWER, EPDS_MAX_ANSWER]. Wrong length, non-integer,
// or out-of-range → null (reject the whole record). Returns a fresh array so a
// sanitized record never aliases untrusted input.
function normalizeAnswers(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length !== EPDS_ITEM_COUNT) {
    return null;
  }

  const result: number[] = [];
  for (const raw of value) {
    if (
      typeof raw !== "number" ||
      !Number.isInteger(raw) ||
      raw < EPDS_MIN_ANSWER ||
      raw > EPDS_MAX_ANSWER
    ) {
      return null;
    }
    result.push(raw);
  }

  return result;
}

function sumAnswers(answers: readonly number[]): number {
  return answers.reduce((total, value) => total + value, 0);
}

// `?? 0` only to satisfy noUncheckedIndexedAccess — normalizeAnswers guarantees
// the index exists before this is ever reached.
function resolveSelfHarmFlag(answers: readonly number[]): boolean {
  return (answers[EPDS_SELF_HARM_ITEM_INDEX] ?? 0) > 0;
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Minimal LocalDateISO shape + calendar-validity check, self-contained here
// because src/models must not depend on src/services (architecture layering).
// Mirrors sanitizePostpartumRecord's isValidLocalDateISO exactly (regex shape +
// Y/M/D roundtrip through the Date constructor, rejecting e.g. 2026-02-30).
function isValidLocalDateISO(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month &&
    parsed.getDate() === day
  );
}
