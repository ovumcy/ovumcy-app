import { buildSettingsViewData } from "../../../services/settings-view-service";
import {
  resolveSettingsExportErrorMessage,
  resolveSettingsImportErrorMessage,
  resolveSettingsSymptomErrorMessage,
} from "./settings-screen-messages";

const viewData = buildSettingsViewData(new Date(2026, 2, 17), "en");

describe("resolveSettingsSymptomErrorMessage", () => {
  it.each([
    ["label_required", () => viewData.symptoms.errors.labelRequired],
    ["label_too_long", () => viewData.symptoms.errors.labelTooLong],
    [
      "label_invalid_characters",
      () => viewData.symptoms.errors.labelInvalidCharacters,
    ],
    ["duplicate_label", () => viewData.symptoms.errors.duplicateLabel],
    ["not_found", () => viewData.symptoms.errors.notFound],
    ["builtin_edit_forbidden", () => viewData.symptoms.errors.notFound],
    // Unmapped/unexpected codes (e.g. icon_too_long, invalid_color, generic)
    // fall back to the generic save-failed copy rather than surfacing a raw
    // error code to the user.
    ["icon_too_long", () => viewData.symptoms.errors.saveFailed],
    ["generic", () => viewData.symptoms.errors.saveFailed],
  ])("maps %s to the expected copy", (errorCode, expected) => {
    expect(resolveSettingsSymptomErrorMessage(errorCode, viewData)).toBe(
      expected(),
    );
  });
});

describe("resolveSettingsExportErrorMessage", () => {
  it.each([
    ["invalid_from_date", () => viewData.export.errors.invalidFromDate],
    ["invalid_to_date", () => viewData.export.errors.invalidToDate],
    ["invalid_range", () => viewData.export.errors.invalidRange],
    ["pdf_locked", () => viewData.export.errors.pdfLocked],
    ["delivery_unavailable", () => viewData.export.errors.deliveryUnavailable],
    ["delivery_failed", () => viewData.export.errors.deliveryFailed],
    ["generic", () => viewData.export.errors.exportFailed],
  ])("maps %s to the expected copy", (errorCode, expected) => {
    expect(resolveSettingsExportErrorMessage(errorCode, viewData)).toBe(
      expected(),
    );
  });
});

describe("resolveSettingsImportErrorMessage", () => {
  it.each([
    ["malformed", () => viewData.import.errors.malformed],
    ["unrecognized_format", () => viewData.import.errors.unrecognizedFormat],
    ["too_large", () => viewData.import.errors.tooLarge],
    ["pick_unavailable", () => viewData.import.errors.pickUnavailable],
    ["read_failed", () => viewData.import.errors.readFailed],
    ["import_failed", () => viewData.import.errors.importFailed],
  ])("maps %s to the expected copy", (errorCode, expected) => {
    expect(resolveSettingsImportErrorMessage(errorCode, viewData)).toBe(
      expected(),
    );
  });
});
