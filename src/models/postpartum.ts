import {
  MODE_OF_DELIVERY_VALUES,
  type ModeOfDelivery,
} from "./pregnancy";
import type { LocalDateISO } from "./profile";

// Postpartum-mode domain model. Mirrors pregnancy.ts's structure: a
// const-array enum + literal union, a factory, a read-only one-active helper,
// and a sanitize contract for the sync-restore / import path. Postpartum
// outcome data (birth date, mode of delivery) is the SAME sensitivity class as
// pregnancy outcome data — sensitive fields live only in the encrypted payload
// at the storage boundary; only the coarse `status` is ever plaintext.

// --- Enums (const arrays + literal unions, mirroring pregnancy.ts) ----------

export const POSTPARTUM_STATUS_VALUES = ["active", "ended"] as const;
export type PostpartumStatus = (typeof POSTPARTUM_STATUS_VALUES)[number];

// How postpartum tracking ended. "cycle_returned" = a new period was logged
// (recovery folds back into the cycle); "manual" = the owner ended tracking
// herself. Loss never reaches this model at all (domain rule B8: a pregnancy
// loss is NEVER offered postpartum tracking), so there is no loss end-reason.
export const POSTPARTUM_END_REASON_VALUES = ["cycle_returned", "manual"] as const;
export type PostpartumEndReason = (typeof POSTPARTUM_END_REASON_VALUES)[number];

// --- Records -----------------------------------------------------------------

export type PostpartumRecord = {
  id: string;
  status: PostpartumStatus;
  // The birth date. Copied from the source pregnancy record's endedAt when
  // postpartum tracking starts (see startPostpartumFromBirth). All recovery-
  // phase / week-since-birth math reads only this field.
  startedAt: LocalDateISO;
  // Copied from the source pregnancy record at creation; null when the birth
  // record carried no mode (the owner chose "prefer not to say"). Only ever
  // adds ONE education line to the recovery card — never a clinical verdict.
  modeOfDelivery: ModeOfDelivery | null;
  endedAt: LocalDateISO | null;
  endReason: PostpartumEndReason | null;
};

// --- Constants -----------------------------------------------------------------

// Recovery-phase anchors (content, not clinical stages). The dashboard maps a
// week-since-birth count onto three phases — early 0-2w, core 2-6w, extended
// 6w+ — used only to select which neutral education body the recovery card
// shows. These are boundaries for warm, general copy, never diagnostic
// milestones or personalized advice. The boundary is inclusive on the lower
// phase (weeks <= MAX), mirroring pregnancy-timeline-service.resolveTrimester:
// week 2 is still "early", week 6 is still "core", week 7 is "extended".
export const EARLY_WEEKS_MAX = 2;
export const CORE_RECOVERY_WEEKS_MAX = 6;

// --- Factories -----------------------------------------------------------------

export type CreatePostpartumRecordInput = {
  startedAt: LocalDateISO;
  modeOfDelivery?: ModeOfDelivery | null;
};

export function createPostpartumRecord(
  input: CreatePostpartumRecordInput,
): PostpartumRecord {
  return {
    id: createPostpartumRecordID(),
    status: "active",
    startedAt: input.startedAt,
    modeOfDelivery: input.modeOfDelivery ?? null,
    endedAt: null,
    endReason: null,
  };
}

// Domain invariant: at most one PostpartumRecord may have status "active" at a
// time (mirrors hasActivePregnancy). This pure model only exposes the read
// helper; enforcing the invariant on write — reject a second concurrent active
// record — is a service/storage-layer concern.
export function hasActivePostpartum(
  records: readonly PostpartumRecord[],
): boolean {
  return records.some((record) => record.status === "active");
}

let postpartumRecordIDCounter = 0;

function createPostpartumRecordID(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `postpartum_${globalThis.crypto.randomUUID()}`;
  }

  postpartumRecordIDCounter += 1;
  return `postpartum_${Date.now().toString(36)}_${postpartumRecordIDCounter.toString(36)}`;
}

// --- Sanitize (sync-restore / import validation) --------------------------
//
// Same contract as sanitizePregnancyRecord: fields that anchor a record's
// identity or meaning (id, status, startedAt) must be structurally valid or
// the whole record is rejected (null); fields typed `X | null` in the model
// (modeOfDelivery, endedAt, endReason) fall back to their own null value when
// invalid — null is already a legal value, so this never fabricates data
// outside the field's own domain.

export function sanitizePostpartumRecord(
  value: unknown,
): PostpartumRecord | null {
  if (!isRecordObject(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (id === "") {
    return null;
  }

  const status = value.status as PostpartumStatus;
  if (!POSTPARTUM_STATUS_VALUES.includes(status)) {
    return null;
  }

  const startedAt = typeof value.startedAt === "string" ? value.startedAt : "";
  if (!isValidLocalDateISO(startedAt)) {
    return null;
  }

  return {
    id,
    status,
    startedAt,
    modeOfDelivery: sanitizeNullableModeOfDelivery(value.modeOfDelivery),
    endedAt: sanitizeNullableLocalDateISO(value.endedAt),
    endReason: sanitizeNullableEndReason(value.endReason),
  };
}

// --- Internal validation helpers --------------------------------------------

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeNullableLocalDateISO(value: unknown): LocalDateISO | null {
  return typeof value === "string" && isValidLocalDateISO(value) ? value : null;
}

function sanitizeNullableModeOfDelivery(value: unknown): ModeOfDelivery | null {
  const mode = value as ModeOfDelivery;
  return MODE_OF_DELIVERY_VALUES.includes(mode) ? mode : null;
}

function sanitizeNullableEndReason(value: unknown): PostpartumEndReason | null {
  const reason = value as PostpartumEndReason;
  return POSTPARTUM_END_REASON_VALUES.includes(reason) ? reason : null;
}

// Minimal LocalDateISO shape + calendar-validity check, self-contained here
// because src/models must not depend on src/services (architecture layering).
// Mirrors sanitizePregnancyRecord's own isValidLocalDateISO exactly (regex
// shape + Y/M/D roundtrip through the Date constructor, rejecting e.g.
// 2026-02-30).
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
