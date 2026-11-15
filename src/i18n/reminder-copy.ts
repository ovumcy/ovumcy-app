import { resolveCopyLanguage } from "./runtime";

const reminderCopyEn = {
  notificationTitle: "Ovumcy reminder",
  dailyLogBody: "Open Ovumcy to update today's entry.",
  cycleBody: "Open Ovumcy to review your next cycle dates.",
  cycleDayBody: "You have a cycle day reminder.",
};

const reminderCopyDe = {
  notificationTitle: "Ovumcy-Erinnerung",
  dailyLogBody: "Öffnen Sie Ovumcy, um den heutigen Eintrag zu aktualisieren.",
  cycleBody: "Öffnen Sie Ovumcy, um Ihre nächsten Zyklusdaten zu prüfen.",
  cycleDayBody: "Sie haben eine Zyklustag-Erinnerung.",
};

const reminderCopyFr = {
  notificationTitle: "Rappel Ovumcy",
  dailyLogBody: "Ouvrez Ovumcy pour mettre à jour l’entrée d’aujourd’hui.",
  cycleBody: "Ouvrez Ovumcy pour vérifier vos prochaines dates de cycle.",
  cycleDayBody: "Vous avez un rappel de jour de cycle.",
};

const reminderCopyRu = {
  notificationTitle: "Напоминание Ovumcy",
  dailyLogBody: "Откройте Ovumcy, чтобы обновить сегодняшнюю запись.",
  cycleBody: "Откройте Ovumcy, чтобы проверить ближайшие даты цикла.",
  cycleDayBody: "У вас напоминание на день цикла.",
};

const reminderCopyEs = {
  notificationTitle: "Recordatorio de Ovumcy",
  dailyLogBody: "Abre Ovumcy para actualizar la entrada de hoy.",
  cycleBody: "Abre Ovumcy para revisar tus próximas fechas del ciclo.",
  cycleDayBody: "Tienes un recordatorio de día del ciclo.",
};

const reminderCopyIt = {
  notificationTitle: "Promemoria Ovumcy",
  dailyLogBody: "Apri Ovumcy per aggiornare la voce di oggi.",
  cycleBody: "Apri Ovumcy per rivedere le tue prossime date del ciclo.",
  cycleDayBody: "Hai un promemoria per un giorno del ciclo.",
};

const reminderCopyCatalog = {
  en: reminderCopyEn,
  de: reminderCopyDe,
  fr: reminderCopyFr,
  ru: reminderCopyRu,
  es: reminderCopyEs,
  it: reminderCopyIt,
};

export function getReminderCopy(language: string | null | undefined) {
  return reminderCopyCatalog[resolveCopyLanguage(language)];
}
