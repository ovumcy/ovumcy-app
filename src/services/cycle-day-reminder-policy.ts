import {
  CYCLE_DAY_REMINDER_LABEL_MAX_LENGTH,
  CYCLE_DAY_REMINDER_MAX_DAY,
  CYCLE_DAY_REMINDER_MAX_RULES,
  CYCLE_DAY_REMINDER_MIN_DAY,
  DEFAULT_CYCLE_DAY_REMINDER_HOUR,
  type CycleDayReminder,
} from "../models/profile";

const RULE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

let ruleIDCounter = 0;

// A rule id is an opaque local handle (list keys, edit/delete targeting). It
// carries no cycle data and is never put in a notification, log or link.
export function createCycleDayReminderID(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `cdr_${globalThis.crypto.randomUUID()}`;
  }

  ruleIDCounter += 1;
  return `cdr_${Date.now().toString(36)}_${ruleIDCounter.toString(36)}`;
}

export function createDefaultCycleDayReminder(
  id: string = createCycleDayReminderID(),
): CycleDayReminder {
  return {
    id,
    cycleDay: CYCLE_DAY_REMINDER_MIN_DAY,
    remindAtHour: DEFAULT_CYCLE_DAY_REMINDER_HOUR,
    label: "",
    showLabel: false,
  };
}

// Control, format, separator and blank-glyph characters (zero-width, bidi
// override such as U+202E, tag characters, Hangul filler, lone surrogates) can
// reorder, hide or blank what the owner reads back, so a label holding one is
// refused whole. Explicit ranges rather than Unicode property escapes keep the
// check identical on every JS engine the app runs on.
function containsControlOrFormatCharacter(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      code === 0xad ||
      code === 0x34f ||
      code === 0x61c ||
      code === 0x115f ||
      code === 0x1160 ||
      code === 0x17b4 ||
      code === 0x17b5 ||
      (code >= 0x180b && code <= 0x180f) ||
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x2028 && code <= 0x202e) ||
      (code >= 0x2060 && code <= 0x2064) ||
      (code >= 0x2066 && code <= 0x206f) ||
      code === 0x2800 ||
      code === 0x3164 ||
      (code >= 0xd800 && code <= 0xdfff) ||
      code === 0xfeff ||
      code === 0xffa0 ||
      (code >= 0xfff9 && code <= 0xfffb) ||
      (code >= 0xe0000 && code <= 0xe007f)
    ) {
      return true;
    }
  }
  return false;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

// Validates one untrusted rule. Returns null (the rule is dropped) for any
// out-of-bounds day or hour, malformed id, or unacceptable label. A label that
// is absent is the empty label; a rule without a label cannot opt into showing
// one. An absent hour takes the default.
export function normalizeCycleDayReminder(value: unknown): CycleDayReminder | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = candidate.id;
  if (typeof id !== "string" || !RULE_ID_PATTERN.test(id)) {
    return null;
  }
  if (
    !isIntegerInRange(
      candidate.cycleDay,
      CYCLE_DAY_REMINDER_MIN_DAY,
      CYCLE_DAY_REMINDER_MAX_DAY,
    )
  ) {
    return null;
  }

  const hour = candidate.remindAtHour ?? DEFAULT_CYCLE_DAY_REMINDER_HOUR;
  if (!isIntegerInRange(hour, 0, 23)) {
    return null;
  }

  const rawLabel = candidate.label ?? "";
  if (typeof rawLabel !== "string") {
    return null;
  }
  const label = rawLabel.trim();
  if (
    Array.from(label).length > CYCLE_DAY_REMINDER_LABEL_MAX_LENGTH ||
    containsControlOrFormatCharacter(label)
  ) {
    return null;
  }

  return {
    id,
    cycleDay: candidate.cycleDay,
    remindAtHour: hour,
    label,
    showLabel: candidate.showLabel === true && label !== "",
  };
}

// Validates an untrusted rule list (import, sync snapshot, stored payload):
// non-lists read as no rules, invalid rules and repeated ids are dropped, and
// only the first CYCLE_DAY_REMINDER_MAX_RULES valid rules are kept.
export function normalizeCycleDayReminders(value: unknown): CycleDayReminder[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const rules: CycleDayReminder[] = [];
  const seenIDs = new Set<string>();
  for (const entry of value) {
    if (rules.length >= CYCLE_DAY_REMINDER_MAX_RULES) {
      break;
    }
    const rule = normalizeCycleDayReminder(entry);
    if (!rule || seenIDs.has(rule.id)) {
      continue;
    }
    seenIDs.add(rule.id);
    rules.push(rule);
  }
  return rules;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

// Editor operations over the draft list. Each result stays inside the rule
// bounds as the owner types, so a draft is always a valid list apart from a
// label's surrounding whitespace, which the save-time normalization trims.
export function addCycleDayReminderRule(
  rules: readonly CycleDayReminder[],
): CycleDayReminder[] {
  if (rules.length >= CYCLE_DAY_REMINDER_MAX_RULES) {
    return [...rules];
  }
  return [...rules, createDefaultCycleDayReminder()];
}

export function removeCycleDayReminderRule(
  rules: readonly CycleDayReminder[],
  id: string,
): CycleDayReminder[] {
  return rules.filter((rule) => rule.id !== id);
}

export function patchCycleDayReminderRule(
  rules: readonly CycleDayReminder[],
  id: string,
  patch: Partial<Omit<CycleDayReminder, "id">>,
): CycleDayReminder[] {
  return rules.map((rule) => {
    if (rule.id !== id) {
      return rule;
    }
    const next = { ...rule, ...patch };
    const label = Array.from(next.label)
      .filter((char) => !containsControlOrFormatCharacter(char))
      .slice(0, CYCLE_DAY_REMINDER_LABEL_MAX_LENGTH)
      .join("");
    return {
      id: rule.id,
      cycleDay: clampInteger(
        next.cycleDay,
        CYCLE_DAY_REMINDER_MIN_DAY,
        CYCLE_DAY_REMINDER_MAX_DAY,
      ),
      remindAtHour: clampInteger(next.remindAtHour, 0, 23),
      label,
      showLabel: next.showLabel && label.trim() !== "",
    };
  });
}

export function areCycleDayRemindersEqual(
  left: readonly CycleDayReminder[],
  right: readonly CycleDayReminder[],
): boolean {
  return (
    left.length === right.length &&
    left.every((rule, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        rule.id === other.id &&
        rule.cycleDay === other.cycleDay &&
        rule.remindAtHour === other.remindAtHour &&
        rule.label === other.label &&
        rule.showLabel === other.showLabel
      );
    })
  );
}
