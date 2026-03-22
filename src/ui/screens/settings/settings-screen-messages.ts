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
    case "delivery_unavailable":
      return viewData.export.errors.deliveryUnavailable;
    case "delivery_failed":
      return viewData.export.errors.deliveryFailed;
    default:
      return viewData.export.errors.exportFailed;
  }
}
