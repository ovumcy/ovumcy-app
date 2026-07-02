import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const errorCopyEn = {
  title: "Something went wrong",
  description:
    "The app ran into a problem and couldn't continue. Your local data is safe on this device.",
  retryAction: "Try again",
  detailsLabel: "Details",
} as const;

type ErrorCopy = WidenLiteral<typeof errorCopyEn>;

const errorCopyDe: ErrorCopy = {
  title: "Etwas ist schiefgelaufen",
  description:
    "Die App ist auf ein Problem gestoßen und konnte nicht fortfahren. Ihre lokalen Daten sind auf diesem Gerät sicher.",
  retryAction: "Erneut versuchen",
  detailsLabel: "Details",
};

const errorCopyFr: ErrorCopy = {
  title: "Un problème est survenu",
  description:
    "L'application a rencontré un problème et n'a pas pu continuer. Vos données locales sont en sécurité sur cet appareil.",
  retryAction: "Réessayer",
  detailsLabel: "Détails",
};

const errorCopyCatalog: Record<InterfaceLanguage, ErrorCopy> = {
  en: errorCopyEn,
  ru: {
    title: "Что-то пошло не так",
    description:
      "В приложении произошла ошибка, и продолжить не удалось. Ваши локальные данные в безопасности на этом устройстве.",
    retryAction: "Повторить попытку",
    detailsLabel: "Подробности",
  },
  es: {
    title: "Algo salió mal",
    description:
      "La aplicación encontró un problema y no pudo continuar. Tus datos locales están a salvo en este dispositivo.",
    retryAction: "Reintentar",
    detailsLabel: "Detalles",
  },
  de: errorCopyDe,
  fr: errorCopyFr,
};

export function getErrorCopy(language: string | null | undefined) {
  return errorCopyCatalog[resolveCopyLanguage(language)];
}
