import {
  normalizeInterfaceLanguage,
  type InterfaceLanguage,
} from "../models/profile";

export const APP_LANGUAGE_LABELS: Record<InterfaceLanguage, string> = {
  en: "English",
  ru: "Русский",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  it: "Italiano",
};

export function resolveCopyLanguage(
  value: string | null | undefined,
): InterfaceLanguage {
  if (!value) {
    return "en";
  }

  const normalized = normalizeInterfaceLanguage(resolveLanguageTag(value));
  return normalized ?? "en";
}

export function resolveDeviceLanguage(): InterfaceLanguage {
  try {
    return resolveCopyLanguage(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return "en";
  }
}

// Effective UI language: an explicit override always wins; with no override the
// device locale decides, and an unsupported device locale falls back to English.
export function resolveEffectiveLanguage(
  languageOverride: InterfaceLanguage | null | undefined,
): InterfaceLanguage {
  return languageOverride ? resolveCopyLanguage(languageOverride) : resolveDeviceLanguage();
}

function resolveLanguageTag(value: string): string {
  const normalized = String(value).trim().toLowerCase().replaceAll("_", "-");
  const separatorIndex = normalized.indexOf("-");

  return separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : normalized;
}
