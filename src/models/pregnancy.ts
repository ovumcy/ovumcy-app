import type { LocalDateISO } from "./profile";

// --- Enums (const arrays + literal unions, mirroring day-log.ts) -----------

export const PREGNANCY_STATUS_VALUES = ["active", "ended"] as const;
export type PregnancyStatus = (typeof PREGNANCY_STATUS_VALUES)[number];

export const EDD_BASIS_VALUES = ["lmp", "ultrasound", "manual"] as const;
export type EddBasis = (typeof EDD_BASIS_VALUES)[number];

export const PREGNANCY_END_REASON_VALUES = ["birth", "loss", "other"] as const;
export type PregnancyEndReason = (typeof PREGNANCY_END_REASON_VALUES)[number];

export const MODE_OF_DELIVERY_VALUES = ["vaginal", "cesarean"] as const;
export type ModeOfDelivery = (typeof MODE_OF_DELIVERY_VALUES)[number];

// Multiples (education-only). 1 = singleton (also the absent default), 2 =
// twins, 3 = "three or more" (triplets+; this product does not track an exact
// higher-order count). Chorionicity is a WHO2016-scan-era descriptive fact,
// not a diagnosis, and is only ever meaningful once fetusCount >= 2.
export const FETUS_COUNT_VALUES = [1, 2, 3] as const;
export type FetusCount = (typeof FETUS_COUNT_VALUES)[number];

export const CHORIONICITY_VALUES = ["dcda", "mcda", "mcma", "unknown"] as const;
export type Chorionicity = (typeof CHORIONICITY_VALUES)[number];

// Single member today; kept as a proper catalog (not a bare string literal
// type) so a second regional milestone schedule can be added later without
// changing the shape of any call site.
export const PREGNANCY_SCHEDULE_PRESET_VALUES = ["who2016"] as const;
export type PregnancySchedulePreset =
  (typeof PREGNANCY_SCHEDULE_PRESET_VALUES)[number];

// --- Records -----------------------------------------------------------------

export type PregnancyRecord = {
  id: string;
  status: PregnancyStatus;
  edd: LocalDateISO;
  eddBasis: EddBasis;
  lmpDate: LocalDateISO | null;
  schedulePreset: PregnancySchedulePreset;
  startedAt: LocalDateISO;
  endedAt: LocalDateISO | null;
  endReason: PregnancyEndReason | null;
  modeOfDelivery: ModeOfDelivery | null;
  // Multiples (education-only). Absent means singleton (== 1). Multiples
  // change monitoring cadence and typical birth timing clinically, but this
  // product never issues clinical verdicts, so EDD/gestational-age math stays
  // exactly the same for any fetusCount -- only dashboard/wizard CONTENT
  // adapts. chorionicity is only meaningful once fetusCount >= 2; sanitize
  // drops it whenever fetusCount is absent or 1 (see sanitizePregnancyRecord).
  fetusCount?: FetusCount;
  chorionicity?: Chorionicity;
};

export type KickCountSession = {
  id: string;
  date: LocalDateISO;
  durationMinutes: number;
  kickCount: number;
};

export type ContractionEntry = {
  startedAt: string; // ISO datetime (contractions are timed to the second, unlike LocalDateISO).
  durationSeconds: number;
};

export type ContractionSession = {
  id: string;
  date: LocalDateISO;
  startedAt: string; // ISO datetime
  contractions: ContractionEntry[];
};

// --- Constants -----------------------------------------------------------------

// Naegele's rule: a full-term pregnancy is 280 days (40 weeks) from LMP.
export const GESTATION_DAYS = 280;

// Content/scheduling anchor for when daily kick counting is typically
// introduced -- not a diagnostic claim.
export const KICK_COUNTS_START_WEEK = 28;

// Trimester I: weeks 0-13, II: 14-27, III: 28+. Two boundaries fully encode
// the three ranges.
export const TRIMESTER_1_MAX_WEEK = 13;
export const TRIMESTER_2_MAX_WEEK = 27;

// Below this week the product's pregnancy-loss taxonomy (medical reference)
// treats an ended pregnancy as loss, not birth/stillbirth -- offering an "I
// gave birth" label before week 20 invites mislabeled sensitive outcome data.
// This gates only the UI's offering of the birth choice/CTA (pregnancy-end
// choice screen, contraction-timer birth CTA); the endPregnancy service
// function still accepts reason "birth" unconditionally so data restore/
// import paths are never rejected or corrupted by this UI-only rule.
export const BIRTH_OPTION_MIN_WEEK = 20;

// 5-1-1 rule parameters (contractions ~5 minutes apart, lasting ~1 minute
// each, sustained for ~1 hour) for a future labor-contraction-pattern
// service. Declared beside the other pregnancy constants; not yet consumed
// by any function in this layer.
export const CONTRACTION_511_MAX_INTERVAL_MINUTES = 5;
export const CONTRACTION_511_MIN_DURATION_SECONDS = 60;
export const CONTRACTION_511_MIN_WINDOW_MINUTES = 60;

export const MIN_KICK_COUNT = 0;
export const MAX_KICK_COUNT = 99;
export const MIN_KICK_COUNT_SESSION_DURATION_MINUTES = 1;
export const MAX_KICK_COUNT_SESSION_DURATION_MINUTES = 180;

export const MIN_CONTRACTION_DURATION_SECONDS = 5;
export const MAX_CONTRACTION_DURATION_SECONDS = 600;
export const MAX_CONTRACTION_SESSION_SPAN_HOURS = 24;
export const MAX_CONTRACTIONS_PER_SESSION = 500;

// --- Factories -----------------------------------------------------------------

export type CreatePregnancyRecordInput = {
  edd: LocalDateISO;
  eddBasis: EddBasis;
  lmpDate?: LocalDateISO | null;
  startedAt: LocalDateISO;
  schedulePreset?: PregnancySchedulePreset;
  fetusCount?: FetusCount;
  chorionicity?: Chorionicity;
};

export function createPregnancyRecord(
  input: CreatePregnancyRecordInput,
): PregnancyRecord {
  return {
    id: createPregnancyRecordID(),
    status: "active",
    edd: input.edd,
    eddBasis: input.eddBasis,
    lmpDate: input.lmpDate ?? null,
    schedulePreset: input.schedulePreset ?? "who2016",
    startedAt: input.startedAt,
    endedAt: null,
    endReason: null,
    modeOfDelivery: null,
    // Passed through as given -- the caller (startPregnancy) decides what to
    // collect; the invariant "chorionicity only when fetusCount >= 2" is
    // enforced canonically by sanitizePregnancyRecord at the storage
    // boundary, not re-derived here. exactOptionalPropertyTypes forbids
    // assigning `undefined` to an optional key, so absent fields are omitted
    // via conditional spread rather than set to undefined.
    ...(input.fetusCount !== undefined ? { fetusCount: input.fetusCount } : {}),
    ...(input.chorionicity !== undefined
      ? { chorionicity: input.chorionicity }
      : {}),
  };
}

// Domain invariant: at most one PregnancyRecord may have status "active" at a
// time. This pure model only exposes the read helper; enforcing the
// invariant on write (reject or supersede a second concurrent active record)
// is a service/storage-layer concern for a later task.
export function hasActivePregnancy(records: readonly PregnancyRecord[]): boolean {
  return records.some((record) => record.status === "active");
}

let pregnancyRecordIDCounter = 0;

function createPregnancyRecordID(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `pregnancy_${globalThis.crypto.randomUUID()}`;
  }

  pregnancyRecordIDCounter += 1;
  return `pregnancy_${Date.now().toString(36)}_${pregnancyRecordIDCounter.toString(36)}`;
}

// --- Sanitize (sync-restore / import validation) --------------------------
//
// Contract (mirrors the spirit of day-log-policy.ts's sanitizeDayLogRecord,
// extended for untrusted `unknown` input the way import-service.ts's
// sanitizeImportedProfileRecord validates a raw envelope):
//   - Fields that anchor a record's identity or meaning (id, status, edd,
//     eddBasis, schedulePreset, startedAt; id/date/startedAt on the session
//     types) must be structurally valid, or the whole record/entry is
//     rejected (null, or dropped from its containing array).
//   - Fields typed `X | null` in the model (lmpDate, endedAt, endReason,
//     modeOfDelivery) fall back to their own `null` value when invalid --
//     null is already a legal value of the field, so this never fabricates
//     data outside the field's own domain.
//   - Bounded numeric fields (kickCount, durationMinutes, durationSeconds)
//     clamp into their documented range, mirroring
//     profile-settings-policy.ts's clampCycleLength/clampReminderLeadDays
//     ("a numeric preference, not a security input" -- never rejected).

export function sanitizePregnancyRecord(value: unknown): PregnancyRecord | null {
  if (!isRecordObject(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (id === "") {
    return null;
  }

  const status = value.status as PregnancyStatus;
  if (!PREGNANCY_STATUS_VALUES.includes(status)) {
    return null;
  }

  const edd = typeof value.edd === "string" ? value.edd : "";
  if (!isValidLocalDateISO(edd)) {
    return null;
  }

  const eddBasis = value.eddBasis as EddBasis;
  if (!EDD_BASIS_VALUES.includes(eddBasis)) {
    return null;
  }

  const schedulePreset = value.schedulePreset as PregnancySchedulePreset;
  if (!PREGNANCY_SCHEDULE_PRESET_VALUES.includes(schedulePreset)) {
    return null;
  }

  const startedAt = typeof value.startedAt === "string" ? value.startedAt : "";
  if (!isValidLocalDateISO(startedAt)) {
    return null;
  }

  // fetusCount invalid/absent -> absent (never invented). chorionicity is
  // dropped whenever the SANITIZED fetusCount is absent or 1 (singleton) --
  // it is only meaningful for twins+ -- regardless of what a stale/tampered
  // payload carries in the chorionicity field itself.
  const fetusCount = sanitizeFetusCount(value.fetusCount);
  const chorionicity =
    fetusCount !== undefined && fetusCount >= 2
      ? sanitizeChorionicity(value.chorionicity)
      : undefined;

  return {
    id,
    status,
    edd,
    eddBasis,
    lmpDate: sanitizeNullableLocalDateISO(value.lmpDate),
    schedulePreset,
    startedAt,
    endedAt: sanitizeNullableLocalDateISO(value.endedAt),
    endReason: sanitizeNullableEndReason(value.endReason),
    modeOfDelivery: sanitizeNullableModeOfDelivery(value.modeOfDelivery),
    ...(fetusCount !== undefined ? { fetusCount } : {}),
    ...(chorionicity !== undefined ? { chorionicity } : {}),
  };
}

export function sanitizeKickCountSession(value: unknown): KickCountSession | null {
  if (!isRecordObject(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (id === "") {
    return null;
  }

  const date = typeof value.date === "string" ? value.date : "";
  if (!isValidLocalDateISO(date)) {
    return null;
  }

  return {
    id,
    date,
    durationMinutes: clampBoundedInt(
      value.durationMinutes,
      MIN_KICK_COUNT_SESSION_DURATION_MINUTES,
      MAX_KICK_COUNT_SESSION_DURATION_MINUTES,
    ),
    kickCount: clampBoundedInt(value.kickCount, MIN_KICK_COUNT, MAX_KICK_COUNT),
  };
}

export function sanitizeContractionSession(
  value: unknown,
): ContractionSession | null {
  if (!isRecordObject(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (id === "") {
    return null;
  }

  const date = typeof value.date === "string" ? value.date : "";
  if (!isValidLocalDateISO(date)) {
    return null;
  }

  const startedAt = typeof value.startedAt === "string" ? value.startedAt : "";
  if (!isValidISODateTime(startedAt)) {
    return null;
  }

  const sessionStartMs = new Date(startedAt).getTime();
  const maxEntryMs =
    sessionStartMs + MAX_CONTRACTION_SESSION_SPAN_HOURS * 60 * 60 * 1000;

  // Bound the raw input before per-entry validation (not just the accepted
  // output) so a hostile/oversized array can't force unbounded work --
  // mirrors import-service.ts's MAX_IMPORT_DAY_LOGS guardrail philosophy.
  const rawContractions = Array.isArray(value.contractions)
    ? value.contractions.slice(0, MAX_CONTRACTIONS_PER_SESSION)
    : [];

  const contractions: ContractionEntry[] = [];
  for (const rawEntry of rawContractions) {
    const entry = sanitizeContractionEntry(rawEntry);
    if (!entry) {
      continue;
    }

    const entryMs = new Date(entry.startedAt).getTime();
    if (entryMs < sessionStartMs || entryMs > maxEntryMs) {
      continue;
    }

    contractions.push(entry);
  }

  return { id, date, startedAt, contractions };
}

function sanitizeContractionEntry(value: unknown): ContractionEntry | null {
  if (!isRecordObject(value)) {
    return null;
  }

  const startedAt = typeof value.startedAt === "string" ? value.startedAt : "";
  if (!isValidISODateTime(startedAt)) {
    return null;
  }

  return {
    startedAt,
    durationSeconds: clampBoundedInt(
      value.durationSeconds,
      MIN_CONTRACTION_DURATION_SECONDS,
      MAX_CONTRACTION_DURATION_SECONDS,
    ),
  };
}

// --- Internal validation helpers --------------------------------------------

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeNullableLocalDateISO(value: unknown): LocalDateISO | null {
  return typeof value === "string" && isValidLocalDateISO(value) ? value : null;
}

function sanitizeNullableEndReason(value: unknown): PregnancyEndReason | null {
  const reason = value as PregnancyEndReason;
  return PREGNANCY_END_REASON_VALUES.includes(reason) ? reason : null;
}

function sanitizeNullableModeOfDelivery(value: unknown): ModeOfDelivery | null {
  const mode = value as ModeOfDelivery;
  return MODE_OF_DELIVERY_VALUES.includes(mode) ? mode : null;
}

function sanitizeFetusCount(value: unknown): FetusCount | undefined {
  const count = value as FetusCount;
  return FETUS_COUNT_VALUES.includes(count) ? count : undefined;
}

function sanitizeChorionicity(value: unknown): Chorionicity | undefined {
  const chorionicity = value as Chorionicity;
  return CHORIONICITY_VALUES.includes(chorionicity) ? chorionicity : undefined;
}

function clampBoundedInt(value: unknown, minValue: number, maxValue: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return minValue;
  }

  return Math.max(minValue, Math.min(maxValue, Math.round(numeric)));
}

// Minimal LocalDateISO shape + calendar-validity check, self-contained here
// because src/models must not depend on src/services (architecture.md
// layering: app -> services -> storage -> models). Mirrors the validity
// technique in services/profile-settings-policy.ts's parseLocalDate (regex
// shape + Y/M/D roundtrip through the Date constructor, rejecting e.g.
// 2026-02-30) without importing it or returning a Date.
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

// Same self-containment reasoning as isValidLocalDateISO, for the full
// ISO-8601 datetime strings used by contraction timestamps.
function isValidISODateTime(value: string): boolean {
  const shapeOk =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.test(value);
  if (!shapeOk) {
    return false;
  }

  return !Number.isNaN(new Date(value).getTime());
}
