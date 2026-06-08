import type { InterfaceLanguage } from "../models/profile";
import type { SubscriptionCountdownCopy } from "../services/subscription-countdown-service";
import { resolveCopyLanguage } from "./runtime";

// Russian needs three plural forms for "day": 1 день, 2–4 дня, 5–20 дней,
// repeating every hundred (21 день, 22 дня, 25 дней). Counts here are always
// whole and >= 1, so the zero case never reaches this helper.
function ruDayWord(days: number): string {
  const mod100 = days % 100;
  const mod10 = days % 10;
  if (mod10 === 1 && mod100 !== 11) {
    return "день";
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "дня";
  }
  return "дней";
}

const subscriptionCopyEn: SubscriptionCountdownCopy = {
  trial: (days) => `Free trial — ${days} ${days === 1 ? "day" : "days"} left`,
  active: (days) =>
    `Premium active — renews in ${days} ${days === 1 ? "day" : "days"}`,
  canceling: (days) =>
    `Premium ends in ${days} ${days === 1 ? "day" : "days"}`,
  ended: "Premium plan ended",
};

const subscriptionCopyDe: SubscriptionCountdownCopy = {
  trial: (days) => `Testphase — noch ${days} ${days === 1 ? "Tag" : "Tage"}`,
  active: (days) =>
    `Premium aktiv — Verlängerung in ${days} ${days === 1 ? "Tag" : "Tagen"}`,
  canceling: (days) =>
    `Premium endet in ${days} ${days === 1 ? "Tag" : "Tagen"}`,
  ended: "Premium-Abo beendet",
};

const subscriptionCopyFr: SubscriptionCountdownCopy = {
  trial: (days) =>
    `Essai gratuit — ${days} ${days === 1 ? "jour" : "jours"} restant${
      days === 1 ? "" : "s"
    }`,
  active: (days) =>
    `Premium actif — renouvellement dans ${days} ${days === 1 ? "jour" : "jours"}`,
  canceling: (days) =>
    `Premium se termine dans ${days} ${days === 1 ? "jour" : "jours"}`,
  ended: "Forfait Premium terminé",
};

const subscriptionCopyRu: SubscriptionCountdownCopy = {
  trial: (days) => `Пробный период — осталось ${days} ${ruDayWord(days)}`,
  active: (days) => `Премиум активен — продление через ${days} ${ruDayWord(days)}`,
  canceling: (days) => `Премиум закончится через ${days} ${ruDayWord(days)}`,
  ended: "Премиум-план завершён",
};

const subscriptionCopyEs: SubscriptionCountdownCopy = {
  trial: (days) =>
    `Prueba gratis — ${days === 1 ? "queda" : "quedan"} ${days} ${
      days === 1 ? "día" : "días"
    }`,
  active: (days) => `Premium activo — se renueva en ${days} ${days === 1 ? "día" : "días"}`,
  canceling: (days) => `Premium termina en ${days} ${days === 1 ? "día" : "días"}`,
  ended: "Plan Premium finalizado",
};

const subscriptionCopyCatalog: Record<InterfaceLanguage, SubscriptionCountdownCopy> = {
  en: subscriptionCopyEn,
  ru: subscriptionCopyRu,
  es: subscriptionCopyEs,
  de: subscriptionCopyDe,
  fr: subscriptionCopyFr,
};

export function getSubscriptionCopy(
  language: string | null | undefined,
): SubscriptionCountdownCopy {
  return subscriptionCopyCatalog[resolveCopyLanguage(language)];
}
