import type { SettingsViewData } from "../../../services/settings-view-service";

export function resolveSettingsSymptomErrorMessage(
  errorCode: string,
  viewData: SettingsViewData,
) {
  switch (errorCode) {
    case "label_required":
      return viewData.symptoms.errors.labelRequired;
    case "label_too_long":
      return viewData.symptoms.errors.labelTooLong;
    case "label_invalid_characters":
      return viewData.symptoms.errors.labelInvalidCharacters;
    case "duplicate_label":
      return viewData.symptoms.errors.duplicateLabel;
    case "not_found":
    case "builtin_edit_forbidden":
      return viewData.symptoms.errors.notFound;
    default:
      return viewData.symptoms.errors.saveFailed;
  }
}

export function resolveSettingsExportErrorMessage(
  errorCode: string,
  viewData: SettingsViewData,
) {
  switch (errorCode) {
    case "invalid_from_date":
      return viewData.export.errors.invalidFromDate;
    case "invalid_to_date":
      return viewData.export.errors.invalidToDate;
    case "invalid_range":
      return viewData.export.errors.invalidRange;
    case "pdf_locked":
      return viewData.export.errors.pdfLocked;
    case "delivery_unavailable":
      return viewData.export.errors.deliveryUnavailable;
    case "delivery_failed":
      return viewData.export.errors.deliveryFailed;
    default:
      return viewData.export.errors.exportFailed;
  }
}

export function resolveSettingsImportErrorMessage(
  errorCode: string,
  viewData: SettingsViewData,
) {
  switch (errorCode) {
    case "malformed":
      return viewData.import.errors.malformed;
    case "unrecognized_format":
      return viewData.import.errors.unrecognizedFormat;
    case "too_large":
      return viewData.import.errors.tooLarge;
    case "pick_unavailable":
      return viewData.import.errors.pickUnavailable;
    case "read_failed":
      return viewData.import.errors.readFailed;
    default:
      return viewData.import.errors.importFailed;
  }
}
