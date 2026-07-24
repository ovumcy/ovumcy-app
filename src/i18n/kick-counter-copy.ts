import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

// Kick-counter screen copy. Tone rules mirror pregnancy-copy.ts: education
// only, neutral, no exclamation marks, no thresholds phrased as verdicts. The
// count-to-10 education line is a benchmark description, never a diagnosis --
// it must read identically regardless of how a session actually finishes. en +
// ru are primary; de/fr/es/it are best-effort translations pending a
// native-speaker review before public launch (mirrors pregnancy-copy.ts).

const kickCounterCopyEn = {
  notAccessible: {
    title: "Kick counter",
    body: "The kick counter becomes available once you have an active pregnancy tracked from around week 28.",
  },
  counter: {
    title: "Kick counter",
    subtitle: "Tap the circle each time you feel a movement.",
    educationLine:
      "10 movements within 2 hours is a common benchmark. If you notice fewer movements than usual, contact your midwife or doctor.",
    elapsedLabel: (minutes: number) => `${minutes} min elapsed`,
    startHint: "Tap the circle to start counting movements.",
    finishCta: "Finish session",
    discardCta: "Discard",
    discardConfirm: {
      title: "Discard this session?",
      body: "This count has not been saved yet. Discarding it will not add anything to your history.",
      confirm: "Discard",
      cancel: "Keep counting",
    },
    savedStatus: "Session saved locally.",
    saveFailedStatus: "Unable to save this session. Please try again.",
  },
  history: {
    title: "Recent sessions",
    emptyLabel: "No kick-count sessions yet.",
    deleteLabel: "Delete",
    durationValue: (minutes: number) => `${minutes} min`,
    deleteConfirm: {
      title: "Delete this session?",
      body: "This removes the session from your local history.",
      confirm: "Delete",
      cancel: "Cancel",
    },
    deleteFailedStatus: "Unable to delete this session. Please try again.",
  },
  reminder: {
    label: "Daily reminder",
    hint: "Get a daily local reminder while kick counting is relevant to your pregnancy.",
  },
} as const;

type KickCounterCopy = WidenLiteral<typeof kickCounterCopyEn>;

const kickCounterCopyRu: KickCounterCopy = {
  notAccessible: {
    title: "Счётчик шевелений",
    body: "Счётчик шевелений становится доступен, когда у вас отслеживается активная беременность примерно с 28-й недели.",
  },
  counter: {
    title: "Счётчик шевелений",
    subtitle: "Нажимайте на круг каждый раз, когда чувствуете шевеление.",
    educationLine:
      "10 шевелений за 2 часа — распространённый ориентир. Если шевелений заметно меньше, чем обычно, свяжитесь с акушеркой или врачом.",
    elapsedLabel: (minutes: number) => `Прошло ${minutes} мин`,
    startHint: "Нажмите на круг, чтобы начать подсчёт шевелений.",
    finishCta: "Завершить сессию",
    discardCta: "Отменить",
    discardConfirm: {
      title: "Отменить эту сессию?",
      body: "Этот подсчёт ещё не сохранён. При отмене он не попадёт в историю.",
      confirm: "Отменить",
      cancel: "Продолжить подсчёт",
    },
    savedStatus: "Сессия сохранена локально.",
    saveFailedStatus: "Не удалось сохранить сессию. Попробуйте ещё раз.",
  },
  history: {
    title: "Недавние сессии",
    emptyLabel: "Пока нет сессий подсчёта шевелений.",
    deleteLabel: "Удалить",
    durationValue: (minutes: number) => `${minutes} мин`,
    deleteConfirm: {
      title: "Удалить эту сессию?",
      body: "Сессия будет удалена из локальной истории.",
      confirm: "Удалить",
      cancel: "Отмена",
    },
    deleteFailedStatus: "Не удалось удалить сессию. Попробуйте ещё раз.",
  },
  reminder: {
    label: "Ежедневное напоминание",
    hint: "Получайте ежедневное локальное напоминание, пока подсчёт шевелений актуален для вашей беременности.",
  },
};

const kickCounterCopyDe: KickCounterCopy = {
  notAccessible: {
    title: "Tritt-Zähler",
    body: "Der Tritt-Zähler steht zur Verfügung, sobald eine aktive Schwangerschaft ab etwa Woche 28 erfasst ist.",
  },
  counter: {
    title: "Tritt-Zähler",
    subtitle: "Tippen Sie auf den Kreis, jedes Mal, wenn Sie eine Bewegung spüren.",
    educationLine:
      "10 Bewegungen innerhalb von 2 Stunden sind ein gängiger Richtwert. Wenn Sie weniger Bewegungen als gewöhnlich bemerken, wenden Sie sich an Ihre Hebamme oder Ihren Arzt.",
    elapsedLabel: (minutes: number) => `${minutes} Min. vergangen`,
    startHint: "Tippen Sie auf den Kreis, um mit dem Zählen zu beginnen.",
    finishCta: "Sitzung beenden",
    discardCta: "Verwerfen",
    discardConfirm: {
      title: "Diese Sitzung verwerfen?",
      body: "Diese Zählung wurde noch nicht gespeichert. Beim Verwerfen wird nichts zu Ihrem Verlauf hinzugefügt.",
      confirm: "Verwerfen",
      cancel: "Weiterzählen",
    },
    savedStatus: "Sitzung lokal gespeichert.",
    saveFailedStatus: "Diese Sitzung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
  },
  history: {
    title: "Letzte Sitzungen",
    emptyLabel: "Noch keine Tritt-Zähl-Sitzungen.",
    deleteLabel: "Löschen",
    durationValue: (minutes: number) => `${minutes} Min.`,
    deleteConfirm: {
      title: "Diese Sitzung löschen?",
      body: "Die Sitzung wird aus Ihrem lokalen Verlauf entfernt.",
      confirm: "Löschen",
      cancel: "Abbrechen",
    },
    deleteFailedStatus: "Diese Sitzung konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.",
  },
  reminder: {
    label: "Tägliche Erinnerung",
    hint: "Erhalten Sie eine tägliche lokale Erinnerung, solange das Zählen der Bewegungen für Ihre Schwangerschaft relevant ist.",
  },
};

const kickCounterCopyFr: KickCounterCopy = {
  notAccessible: {
    title: "Compteur de mouvements",
    body: "Le compteur de mouvements est disponible dès qu'une grossesse active est suivie, à partir d'environ la semaine 28.",
  },
  counter: {
    title: "Compteur de mouvements",
    subtitle: "Appuyez sur le cercle chaque fois que vous sentez un mouvement.",
    educationLine:
      "10 mouvements en 2 heures est un repère courant. Si vous remarquez moins de mouvements que d'habitude, contactez votre sage-femme ou votre médecin.",
    elapsedLabel: (minutes: number) => `${minutes} min écoulées`,
    startHint: "Appuyez sur le cercle pour commencer à compter les mouvements.",
    finishCta: "Terminer la séance",
    discardCta: "Abandonner",
    discardConfirm: {
      title: "Abandonner cette séance ?",
      body: "Ce comptage n'a pas encore été enregistré. L'abandonner ne l'ajoutera pas à votre historique.",
      confirm: "Abandonner",
      cancel: "Continuer à compter",
    },
    savedStatus: "Séance enregistrée localement.",
    saveFailedStatus: "Impossible d'enregistrer cette séance. Réessayez.",
  },
  history: {
    title: "Séances récentes",
    emptyLabel: "Aucune séance de comptage de mouvements pour l'instant.",
    deleteLabel: "Supprimer",
    durationValue: (minutes: number) => `${minutes} min`,
    deleteConfirm: {
      title: "Supprimer cette séance ?",
      body: "La séance sera retirée de votre historique local.",
      confirm: "Supprimer",
      cancel: "Annuler",
    },
    deleteFailedStatus: "Impossible de supprimer cette séance. Réessayez.",
  },
  reminder: {
    label: "Rappel quotidien",
    hint: "Recevez un rappel local quotidien tant que le comptage des mouvements est pertinent pour votre grossesse.",
  },
};

const kickCounterCopyEs: KickCounterCopy = {
  notAccessible: {
    title: "Contador de pataditas",
    body: "El contador de pataditas está disponible en cuanto tienes un embarazo activo registrado desde aproximadamente la semana 28.",
  },
  counter: {
    title: "Contador de pataditas",
    subtitle: "Toca el círculo cada vez que sientas un movimiento.",
    educationLine:
      "10 movimientos en 2 horas es un referente habitual. Si notas menos movimientos de lo habitual, contacta a tu matrona o médico.",
    elapsedLabel: (minutes: number) => `${minutes} min transcurridos`,
    startHint: "Toca el círculo para empezar a contar movimientos.",
    finishCta: "Finalizar sesión",
    discardCta: "Descartar",
    discardConfirm: {
      title: "¿Descartar esta sesión?",
      body: "Este conteo aún no se ha guardado. Descartarlo no añadirá nada a tu historial.",
      confirm: "Descartar",
      cancel: "Seguir contando",
    },
    savedStatus: "Sesión guardada localmente.",
    saveFailedStatus: "No se pudo guardar esta sesión. Inténtalo de nuevo.",
  },
  history: {
    title: "Sesiones recientes",
    emptyLabel: "Todavía no hay sesiones de conteo de pataditas.",
    deleteLabel: "Eliminar",
    durationValue: (minutes: number) => `${minutes} min`,
    deleteConfirm: {
      title: "¿Eliminar esta sesión?",
      body: "La sesión se eliminará de tu historial local.",
      confirm: "Eliminar",
      cancel: "Cancelar",
    },
    deleteFailedStatus: "No se pudo eliminar esta sesión. Inténtalo de nuevo.",
  },
  reminder: {
    label: "Recordatorio diario",
    hint: "Recibe un recordatorio local diario mientras el conteo de pataditas sea relevante para tu embarazo.",
  },
};

const kickCounterCopyIt: KickCounterCopy = {
  notAccessible: {
    title: "Contatore dei calci",
    body: "Il contatore dei calci è disponibile non appena hai una gravidanza attiva tracciata da circa la settimana 28.",
  },
  counter: {
    title: "Contatore dei calci",
    subtitle: "Tocca il cerchio ogni volta che senti un movimento.",
    educationLine:
      "10 movimenti in 2 ore è un riferimento comune. Se noti meno movimenti del solito, contatta la tua ostetrica o il tuo medico.",
    elapsedLabel: (minutes: number) => `${minutes} min trascorsi`,
    startHint: "Tocca il cerchio per iniziare a contare i movimenti.",
    finishCta: "Termina sessione",
    discardCta: "Scarta",
    discardConfirm: {
      title: "Scartare questa sessione?",
      body: "Questo conteggio non è stato ancora salvato. Scartandolo non verrà aggiunto nulla alla tua cronologia.",
      confirm: "Scarta",
      cancel: "Continua a contare",
    },
    savedStatus: "Sessione salvata localmente.",
    saveFailedStatus: "Impossibile salvare questa sessione. Riprova.",
  },
  history: {
    title: "Sessioni recenti",
    emptyLabel: "Ancora nessuna sessione di conteggio dei calci.",
    deleteLabel: "Elimina",
    durationValue: (minutes: number) => `${minutes} min`,
    deleteConfirm: {
      title: "Eliminare questa sessione?",
      body: "La sessione verrà rimossa dalla cronologia locale.",
      confirm: "Elimina",
      cancel: "Annulla",
    },
    deleteFailedStatus: "Impossibile eliminare questa sessione. Riprova.",
  },
  reminder: {
    label: "Promemoria giornaliero",
    hint: "Ricevi un promemoria locale giornaliero finché il conteggio dei calci è rilevante per la tua gravidanza.",
  },
};

const kickCounterCopyCatalog: Record<InterfaceLanguage, KickCounterCopy> = {
  en: kickCounterCopyEn,
  ru: kickCounterCopyRu,
  es: kickCounterCopyEs,
  de: kickCounterCopyDe,
  fr: kickCounterCopyFr,
  it: kickCounterCopyIt,
};

export type { KickCounterCopy };

export function getKickCounterCopy(language: string | null | undefined) {
  return kickCounterCopyCatalog[resolveCopyLanguage(language)];
}
