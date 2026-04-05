import { resolveCopyLanguage } from "./runtime";

const reminderCopyEn = {
  notificationTitle: "Ovumcy reminder",
  dailyLogBody: "Open Ovumcy to update today's entry.",
  cycleBody: "Open Ovumcy to review your next cycle dates.",
};

const reminderCopyDe = {
  notificationTitle: "Ovumcy-Erinnerung",
  dailyLogBody: "Öffne Ovumcy, um den heutigen Eintrag zu aktualisieren.",
  cycleBody: "Öffne Ovumcy, um deine nächsten Zyklusdaten zu prüfen.",
};

const reminderCopyFr = {
  notificationTitle: "Rappel Ovumcy",
  dailyLogBody: "Ouvre Ovumcy pour mettre à jour l’entrée d’aujourd’hui.",
  cycleBody: "Ouvre Ovumcy pour vérifier tes prochaines dates de cycle.",
};

const reminderCopyRu = {
  notificationTitle: "Напоминание Ovumcy",
  dailyLogBody: "Открой Ovumcy, чтобы обновить сегодняшнюю запись.",
  cycleBody: "Открой Ovumcy, чтобы проверить ближайшие даты цикла.",
};

const reminderCopyEs = {
  notificationTitle: "Recordatorio de Ovumcy",
  dailyLogBody: "Abre Ovumcy para actualizar la entrada de hoy.",
  cycleBody: "Abre Ovumcy para revisar tus próximas fechas del ciclo.",
};

const reminderCopyCatalog = {
  en: reminderCopyEn,
  de: reminderCopyDe,
  fr: reminderCopyFr,
  ru: reminderCopyRu,
  es: reminderCopyEs,
};

export function getReminderCopy(language: string | null | undefined) {
  return reminderCopyCatalog[resolveCopyLanguage(language)];
}

