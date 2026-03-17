import {
  BUILTIN_SYMPTOM_DEFINITIONS,
  createBuiltinSymptomRecords,
  DEFAULT_CUSTOM_SYMPTOM_COLOR,
  DEFAULT_CUSTOM_SYMPTOM_ICON,
  HIDDEN_BUILTIN_ENTRY_PICKER_SYMPTOM_IDS,
  MAX_CUSTOM_SYMPTOM_NAME_LENGTH,
  type SymptomID,
  type SymptomRecord,
} from "../models/symptom";

export type SymptomDraftValues = {
  label: string;
  icon: string;
  color?: string;
};

export type SymptomValidationErrorCode =
  | "label_required"
  | "label_too_long"
  | "label_invalid_characters"
  | "invalid_color"
  | "duplicate_label"
  | "builtin_edit_forbidden"
  | "not_found";

const HEX_SYMPTOM_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

let customSymptomCounter = 0;

export function createDefaultSymptomDraft(): SymptomDraftValues {
  return {
    label: "",
    icon: DEFAULT_CUSTOM_SYMPTOM_ICON,
  };
}

export function createDefaultSymptomRecords(): SymptomRecord[] {
  return createBuiltinSymptomRecords();
}

export function normalizeSymptomLabelKey(raw: string): string {
  return normalizeSymptomSpacing(raw).toLocaleLowerCase("en");
}

export function sanitizeSymptomDraftLabel(raw: string): string {
  return normalizeSymptomSpacing(raw);
}

export function sortSymptomRecords(records: readonly SymptomRecord[]): SymptomRecord[] {
  const builtinOrder = new Map(
    BUILTIN_SYMPTOM_DEFINITIONS.map((definition, index) => [definition.id, index]),
  );

  return [...records].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    if (left.isDefault && right.isDefault) {
      return (builtinOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (builtinOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER);
    }

    const leftLabel = normalizeSymptomLabelKey(left.label);
    const rightLabel = normalizeSymptomLabelKey(right.label);
    if (leftLabel === rightLabel) {
      return left.sortOrder - right.sortOrder;
    }

    return leftLabel.localeCompare(rightLabel, "en");
  });
}

export function splitCustomSymptoms(records: readonly SymptomRecord[]) {
  const active: SymptomRecord[] = [];
  const archived: SymptomRecord[] = [];

  for (const record of sortSymptomRecords(records)) {
    if (record.isDefault) {
      continue;
    }

    if (record.isArchived) {
      archived.push(record);
      continue;
    }

    active.push(record);
  }

  return {
    active,
    archived,
  };
}

export function buildEntryPickerSymptoms(
  records: readonly SymptomRecord[],
  selectedIDs: readonly SymptomID[],
): SymptomRecord[] {
  const selected = new Set(selectedIDs);
  const visible: SymptomRecord[] = [];

  for (const record of sortSymptomRecords(records)) {
    const isSelected = selected.has(record.id);
    if (record.isDefault && HIDDEN_BUILTIN_ENTRY_PICKER_SYMPTOM_IDS.has(record.id) && !isSelected) {
      continue;
    }
    if (record.isArchived && !isSelected) {
      continue;
    }

    visible.push(record);
  }

  return visible;
}

export function normalizeDayLogSymptomIDs(values: readonly string[]): SymptomID[] {
  const selected = new Set<SymptomID>();
  const normalized: SymptomID[] = [];

  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!value || selected.has(value)) {
      continue;
    }

    selected.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function filterKnownSymptomIDs(
  records: readonly SymptomRecord[],
  values: readonly string[],
): SymptomID[] {
  const known = new Set(records.map((record) => record.id));
  return normalizeDayLogSymptomIDs(values).filter((value) => known.has(value));
}

export function createCustomSymptomRecord(
  records: readonly SymptomRecord[],
  draft: SymptomDraftValues,
): { ok: true; record: SymptomRecord } | { ok: false; errorCode: SymptomValidationErrorCode } {
  const labelResult = normalizeSymptomLabelInput(draft.label);
  if (!labelResult.ok) {
    return labelResult;
  }

  if (!isSymptomLabelAvailable(records, labelResult.value)) {
    return {
      ok: false,
      errorCode: "duplicate_label",
    };
  }

  const colorResult = resolveSymptomColorInput(
    draft.color ?? "",
    DEFAULT_CUSTOM_SYMPTOM_COLOR,
  );
  if (!colorResult.ok) {
    return colorResult;
  }

  const sortOrder = records.reduce(
    (maximum, record) => Math.max(maximum, record.sortOrder),
    -1,
  ) + 1;

  return {
    ok: true,
    record: {
      id: createCustomSymptomID(),
      slug: createCustomSymptomSlug(labelResult.value),
      label: labelResult.value,
      icon: normalizeSymptomIconInput(draft.icon),
      color: colorResult.value,
      isArchived: false,
      sortOrder,
      isDefault: false,
    },
  };
}

export function updateCustomSymptomRecord(
  records: readonly SymptomRecord[],
  recordID: SymptomID,
  draft: SymptomDraftValues,
): { ok: true; record: SymptomRecord } | { ok: false; errorCode: SymptomValidationErrorCode } {
  const currentRecord = records.find((record) => record.id === recordID);
  if (!currentRecord) {
    return {
      ok: false,
      errorCode: "not_found",
    };
  }
  if (currentRecord.isDefault) {
    return {
      ok: false,
      errorCode: "builtin_edit_forbidden",
    };
  }

  const labelResult = normalizeSymptomLabelInput(draft.label);
  if (!labelResult.ok) {
    return labelResult;
  }

  if (!isSymptomLabelAvailable(records, labelResult.value, recordID)) {
    return {
      ok: false,
      errorCode: "duplicate_label",
    };
  }

  const colorResult = resolveSymptomColorInput(draft.color ?? "", currentRecord.color);
  if (!colorResult.ok) {
    return colorResult;
  }

  return {
    ok: true,
    record: {
      ...currentRecord,
      label: labelResult.value,
      icon: normalizeSymptomIconInput(draft.icon),
      color: colorResult.value,
    },
  };
}

export function archiveCustomSymptomRecord(
  records: readonly SymptomRecord[],
  recordID: SymptomID,
): { ok: true; record: SymptomRecord } | { ok: false; errorCode: SymptomValidationErrorCode } {
  const currentRecord = records.find((record) => record.id === recordID);
  if (!currentRecord) {
    return {
      ok: false,
      errorCode: "not_found",
    };
  }
  if (currentRecord.isDefault) {
    return {
      ok: false,
      errorCode: "builtin_edit_forbidden",
    };
  }
  if (currentRecord.isArchived) {
    return {
      ok: true,
      record: currentRecord,
    };
  }

  return {
    ok: true,
    record: {
      ...currentRecord,
      isArchived: true,
    },
  };
}

export function restoreCustomSymptomRecord(
  records: readonly SymptomRecord[],
  recordID: SymptomID,
): { ok: true; record: SymptomRecord } | { ok: false; errorCode: SymptomValidationErrorCode } {
  const currentRecord = records.find((record) => record.id === recordID);
  if (!currentRecord) {
    return {
      ok: false,
      errorCode: "not_found",
    };
  }
  if (currentRecord.isDefault) {
    return {
      ok: false,
      errorCode: "builtin_edit_forbidden",
    };
  }
  if (!currentRecord.isArchived) {
    return {
      ok: true,
      record: currentRecord,
    };
  }
  if (!isSymptomLabelAvailable(records, currentRecord.label, currentRecord.id)) {
    return {
      ok: false,
      errorCode: "duplicate_label",
    };
  }

  return {
    ok: true,
    record: {
      ...currentRecord,
      isArchived: false,
    },
  };
}

export function normalizeSymptomLabelInput(
  raw: string,
): { ok: true; value: string } | { ok: false; errorCode: SymptomValidationErrorCode } {
  const label = normalizeSymptomSpacing(raw);

  if (label === "") {
    return {
      ok: false,
      errorCode: "label_required",
    };
  }

  if ([...label].length > MAX_CUSTOM_SYMPTOM_NAME_LENGTH) {
    return {
      ok: false,
      errorCode: "label_too_long",
    };
  }

  if (containsInvalidPlainTextLabelRune(label)) {
    return {
      ok: false,
      errorCode: "label_invalid_characters",
    };
  }

  return {
    ok: true,
    value: label,
  };
}

export function normalizeSymptomIconInput(raw: string): string {
  const normalized = raw.trim();
  return normalized === "" ? DEFAULT_CUSTOM_SYMPTOM_ICON : normalized;
}

export function resolveSymptomColorInput(
  raw: string,
  fallback: string,
): { ok: true; value: string } | { ok: false; errorCode: SymptomValidationErrorCode } {
  const normalized = raw.trim().toUpperCase();
  const candidate =
    normalized === ""
      ? (fallback.trim().toUpperCase() || DEFAULT_CUSTOM_SYMPTOM_COLOR)
      : normalized;

  if (!HEX_SYMPTOM_COLOR_PATTERN.test(candidate)) {
    return {
      ok: false,
      errorCode: "invalid_color",
    };
  }

  return {
    ok: true,
    value: candidate,
  };
}

function containsInvalidPlainTextLabelRune(value: string): boolean {
  for (const rune of value) {
    if (rune < " " || rune === "<" || rune === ">") {
      return true;
    }
  }

  return false;
}

function normalizeSymptomSpacing(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function isSymptomLabelAvailable(
  records: readonly SymptomRecord[],
  label: string,
  excludeID?: SymptomID,
): boolean {
  const targetKey = normalizeSymptomLabelKey(label);

  for (const record of records) {
    if (excludeID && record.id === excludeID) {
      continue;
    }
    if (normalizeSymptomLabelKey(record.label) === targetKey) {
      return false;
    }
  }

  return true;
}

function createCustomSymptomSlug(label: string): string {
  const base = normalizeSymptomLabelKey(label)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base !== "") {
    return base;
  }

  return "custom-symptom";
}

function createCustomSymptomID(): SymptomID {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `custom_${globalThis.crypto.randomUUID()}`;
  }

  customSymptomCounter += 1;
  return `custom_${Date.now().toString(36)}_${customSymptomCounter.toString(36)}`;
}
