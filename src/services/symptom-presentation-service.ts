import { getBuiltinSymptomLabel } from "../i18n/symptom-copy";
import {
  getBuiltinSymptomDefinition,
  type SymptomID,
  type SymptomRecord,
} from "../models/symptom";
import { buildEntryPickerSymptoms } from "./symptom-policy";

export function getSymptomDisplayLabel(
  record: SymptomRecord,
  locale = "en",
): string {
  if (!record.isDefault) {
    return record.label;
  }

  const builtinDefinition = getBuiltinSymptomDefinition(record.id);
  if (!builtinDefinition) {
    return record.label;
  }

  return getBuiltinSymptomLabel(locale, builtinDefinition.id);
}

export function localizeSymptomRecords(
  records: readonly SymptomRecord[],
  locale = "en",
): SymptomRecord[] {
  return records.map((record) => ({
    ...record,
    label: getSymptomDisplayLabel(record, locale),
  }));
}

export function buildLocalizedEntryPickerSymptoms(
  records: readonly SymptomRecord[],
  selectedIDs: readonly SymptomID[],
  locale = "en",
) {
  return buildEntryPickerSymptoms(records, selectedIDs).map((record) => ({
    value: record.id,
    label: getSymptomDisplayLabel(record, locale),
    icon: record.icon,
  }));
}
