import type { InterfaceLanguage } from "../models/profile";
import { resolveCopyLanguage } from "./runtime";

type StatusBannerCopy = {
  dismissAction: string;
  tones: {
    success: string;
    error: string;
    info: string;
  };
};

const statusBannerCopyCatalog: Record<InterfaceLanguage, StatusBannerCopy> = {
  en: {
    dismissAction: "Dismiss",
    tones: {
      success: "Done",
      error: "Error",
      info: "Info",
    },
  },
  de: {
    dismissAction: "Schließen",
    tones: {
      success: "Fertig",
      error: "Fehler",
      info: "Hinweis",
    },
  },
  fr: {
    dismissAction: "Fermer",
    tones: {
      success: "Terminé",
      error: "Erreur",
      info: "Info",
    },
  },
  ru: {
    dismissAction: "Закрыть",
    tones: {
      success: "Готово",
      error: "Ошибка",
      info: "Инфо",
    },
  },
  es: {
    dismissAction: "Cerrar",
    tones: {
      success: "Listo",
      error: "Error",
      info: "Info",
    },
  },
};

export function getStatusBannerCopy(language: string | null | undefined) {
  return statusBannerCopyCatalog[resolveCopyLanguage(language)];
}
