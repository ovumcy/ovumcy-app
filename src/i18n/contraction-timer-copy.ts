import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

// Contraction-timer screen + dashboard-card copy. Tone
// rules mirror kick-counter-copy.ts and pregnancy-copy.ts: education only,
// neutral, no exclamation marks, no thresholds phrased as verdicts. Both
// `educationLine` (>=week 37 / GA unknown) and `educationLinePreterm` (active
// pregnancy, <week 37) are SURFACING ONLY -- each is worded identically
// regardless of whether it renders in its calm or visually-elevated
// presentation (never an alarm, never a "go to the hospital now" verdict);
// see SECURITY.md's medical-safety invariant. en + ru are primary; de/fr/es/it
// are best-effort translations pending a native-speaker review before public
// launch (mirrors every prior pregnancy-mode catalog).

const contractionTimerCopyEn = {
  notAccessible: {
    title: "Contraction timer",
    body: "The contraction timer becomes available once you have an active pregnancy tracked in Ovumcy.",
  },
  counter: {
    title: "Contraction timer",
    subtitle: "Tap the button to time each contraction from start to end.",
    startLabel: "Contraction started",
    stopLabel: "Contraction ended",
    idleHint: "Tap the button when your next contraction starts.",
    elapsedLabel: (formatted: string) => `Elapsed ${formatted}`,
    finishCta: "Finish session",
    discardCta: "Discard session",
    discardConfirm: {
      title: "Discard this session?",
      body: "This removes every contraction saved in the current session from your local history.",
      confirm: "Discard",
      cancel: "Keep session",
    },
    discardFailedStatus: "Unable to discard this session. Please try again.",
    saveFailedStatus: "Unable to save this contraction. Please try again.",
    emptyRowsLabel: "No contractions logged in this session yet.",
    firstContractionLabel: "—",
    educationLine:
      "A common guideline: contractions about every 5 minutes, lasting about 1 minute, for at least 1 hour. If this matches what you're seeing — contact your midwife, doctor, or maternity unit.",
    // GA-aware variant: shown instead of educationLine before week 37,
    // when regular contractions can be a sign of preterm labour rather than
    // routine timing practice. Same tone rules -- calm, no exclamation marks,
    // surfacing not alarm.
    educationLinePreterm:
      "Regular contractions before week 37 can be a sign of preterm labour. If your contractions keep coming or get stronger — contact your midwife, doctor, or maternity unit promptly.",
  },
  windowSummary: {
    title: "Last 60 minutes",
    countLabel: (count: number) => `Contractions: ${count}`,
    averageIntervalCaption: "Average interval",
    averageDurationCaption: "Average duration",
    emptyLabel: "Not enough data yet in this window.",
  },
  rows: {
    title: "This session",
    columnCaption: "Start time · Duration · Interval",
  },
  history: {
    title: "Past sessions",
    emptyLabel: "No past contraction sessions yet.",
    deleteLabel: "Delete",
    countValue: (count: number) => `Contractions: ${count}`,
    deleteConfirm: {
      title: "Delete this session?",
      body: "This removes the session from your local history.",
      confirm: "Delete",
      cancel: "Cancel",
    },
    deleteFailedStatus: "Unable to delete this session. Please try again.",
  },
  dashboardCard: {
    title: "Contraction timer",
    body: "Time your contractions from start to end, and watch how they change. Tap to open the contraction timer.",
  },
} as const;

type ContractionTimerCopy = WidenLiteral<typeof contractionTimerCopyEn>;

const contractionTimerCopyRu: ContractionTimerCopy = {
  notAccessible: {
    title: "Счётчик схваток",
    body: "Счётчик схваток становится доступен, когда у вас отслеживается активная беременность в Ovumcy.",
  },
  counter: {
    title: "Счётчик схваток",
    subtitle: "Нажимайте на кнопку, чтобы засекать каждую схватку от начала до конца.",
    startLabel: "Схватка началась",
    stopLabel: "Схватка закончилась",
    idleHint: "Нажмите на кнопку, когда начнётся следующая схватка.",
    elapsedLabel: (formatted: string) => `Прошло ${formatted}`,
    finishCta: "Завершить сессию",
    discardCta: "Отменить сессию",
    discardConfirm: {
      title: "Отменить эту сессию?",
      body: "Все схватки, сохранённые в текущей сессии, будут удалены из локальной истории.",
      confirm: "Отменить",
      cancel: "Сохранить сессию",
    },
    discardFailedStatus: "Не удалось отменить сессию. Попробуйте ещё раз.",
    saveFailedStatus: "Не удалось сохранить эту схватку. Попробуйте ещё раз.",
    emptyRowsLabel: "В этой сессии пока нет схваток.",
    firstContractionLabel: "—",
    educationLine:
      "Распространённый ориентир: схватки происходят примерно каждые 5 минут, длятся около 1 минуты, и это продолжается не менее 1 часа. Если это похоже на то, что вы наблюдаете, — свяжитесь с акушеркой, врачом или родильным отделением.",
    educationLinePreterm:
      "Регулярные схватки до 37-й недели могут быть признаком преждевременных родов. Если схватки продолжаются или усиливаются — как можно скорее свяжитесь с акушеркой, врачом или родильным отделением.",
  },
  windowSummary: {
    title: "Последние 60 минут",
    countLabel: (count: number) => `Схваток: ${count}`,
    averageIntervalCaption: "Средний интервал",
    averageDurationCaption: "Средняя продолжительность",
    emptyLabel: "Пока недостаточно данных за этот период.",
  },
  rows: {
    title: "Эта сессия",
    columnCaption: "Начало · Длительность · Интервал",
  },
  history: {
    title: "Прошлые сессии",
    emptyLabel: "Пока нет прошлых сессий схваток.",
    deleteLabel: "Удалить",
    countValue: (count: number) => `Схваток: ${count}`,
    deleteConfirm: {
      title: "Удалить эту сессию?",
      body: "Сессия будет удалена из локальной истории.",
      confirm: "Удалить",
      cancel: "Отмена",
    },
    deleteFailedStatus: "Не удалось удалить сессию. Попробуйте ещё раз.",
  },
  dashboardCard: {
    title: "Счётчик схваток",
    body: "Засекайте начало и конец каждой схватки и наблюдайте, как они меняются. Нажмите, чтобы открыть счётчик схваток.",
  },
};

const contractionTimerCopyDe: ContractionTimerCopy = {
  notAccessible: {
    title: "Wehen-Timer",
    body: "Der Wehen-Timer steht zur Verfügung, sobald eine aktive Schwangerschaft in Ovumcy erfasst ist.",
  },
  counter: {
    title: "Wehen-Timer",
    subtitle: "Tippen Sie auf die Schaltfläche, um jede Wehe von Anfang bis Ende zu erfassen.",
    startLabel: "Wehe hat begonnen",
    stopLabel: "Wehe ist vorbei",
    idleHint: "Tippen Sie auf die Schaltfläche, wenn die nächste Wehe beginnt.",
    elapsedLabel: (formatted: string) => `Verstrichen: ${formatted}`,
    finishCta: "Sitzung beenden",
    discardCta: "Sitzung verwerfen",
    discardConfirm: {
      title: "Diese Sitzung verwerfen?",
      body: "Alle in der aktuellen Sitzung gespeicherten Wehen werden aus Ihrem lokalen Verlauf entfernt.",
      confirm: "Verwerfen",
      cancel: "Sitzung behalten",
    },
    discardFailedStatus: "Diese Sitzung konnte nicht verworfen werden. Bitte versuchen Sie es erneut.",
    saveFailedStatus: "Diese Wehe konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
    emptyRowsLabel: "In dieser Sitzung sind noch keine Wehen erfasst.",
    firstContractionLabel: "—",
    educationLine:
      "Ein gängiger Richtwert: Wehen etwa alle 5 Minuten, die jeweils etwa 1 Minute dauern, über mindestens 1 Stunde. Wenn das zutrifft, wenden Sie sich an Ihre Hebamme, Ihren Arzt oder den Kreißsaal.",
    educationLinePreterm:
      "Regelmäßige Wehen vor der 37. Woche können ein Anzeichen für eine Frühgeburt sein. Wenn Ihre Wehen anhalten oder stärker werden, wenden Sie sich zeitnah an Ihre Hebamme, Ihren Arzt oder den Kreißsaal.",
  },
  windowSummary: {
    title: "Letzte 60 Minuten",
    countLabel: (count: number) => `Wehen: ${count}`,
    averageIntervalCaption: "Durchschnittliches Intervall",
    averageDurationCaption: "Durchschnittliche Dauer",
    emptyLabel: "Noch nicht genug Daten in diesem Zeitraum.",
  },
  rows: {
    title: "Diese Sitzung",
    columnCaption: "Beginn · Dauer · Intervall",
  },
  history: {
    title: "Frühere Sitzungen",
    emptyLabel: "Noch keine früheren Wehen-Sitzungen.",
    deleteLabel: "Löschen",
    countValue: (count: number) => `Wehen: ${count}`,
    deleteConfirm: {
      title: "Diese Sitzung löschen?",
      body: "Die Sitzung wird aus Ihrem lokalen Verlauf entfernt.",
      confirm: "Löschen",
      cancel: "Abbrechen",
    },
    deleteFailedStatus: "Diese Sitzung konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.",
  },
  dashboardCard: {
    title: "Wehen-Timer",
    body: "Erfassen Sie Anfang und Ende jeder Wehe und beobachten Sie, wie sie sich verändern. Tippen Sie, um den Wehen-Timer zu öffnen.",
  },
};

const contractionTimerCopyFr: ContractionTimerCopy = {
  notAccessible: {
    title: "Chronomètre des contractions",
    body: "Le chronomètre des contractions est disponible dès qu'une grossesse active est suivie dans Ovumcy.",
  },
  counter: {
    title: "Chronomètre des contractions",
    subtitle: "Appuyez sur le bouton pour chronométrer chaque contraction du début à la fin.",
    startLabel: "La contraction a commencé",
    stopLabel: "La contraction est terminée",
    idleHint: "Appuyez sur le bouton au début de votre prochaine contraction.",
    elapsedLabel: (formatted: string) => `Écoulé : ${formatted}`,
    finishCta: "Terminer la séance",
    discardCta: "Abandonner la séance",
    discardConfirm: {
      title: "Abandonner cette séance ?",
      body: "Toutes les contractions enregistrées dans la séance en cours seront retirées de votre historique local.",
      confirm: "Abandonner",
      cancel: "Garder la séance",
    },
    discardFailedStatus: "Impossible d'abandonner cette séance. Réessayez.",
    saveFailedStatus: "Impossible d'enregistrer cette contraction. Réessayez.",
    emptyRowsLabel: "Aucune contraction enregistrée dans cette séance pour l'instant.",
    firstContractionLabel: "—",
    educationLine:
      "Un repère courant : des contractions environ toutes les 5 minutes, durant environ 1 minute, pendant au moins 1 heure. Si cela correspond à ce que vous observez, contactez votre sage-femme, votre médecin ou votre unité de maternité.",
    educationLinePreterm:
      "Des contractions régulières avant la semaine 37 peuvent être un signe de travail prématuré. Si vos contractions continuent ou s'intensifient, contactez rapidement votre sage-femme, votre médecin ou votre unité de maternité.",
  },
  windowSummary: {
    title: "60 dernières minutes",
    countLabel: (count: number) => `Contractions : ${count}`,
    averageIntervalCaption: "Intervalle moyen",
    averageDurationCaption: "Durée moyenne",
    emptyLabel: "Pas encore assez de données sur cette période.",
  },
  rows: {
    title: "Cette séance",
    columnCaption: "Début · Durée · Intervalle",
  },
  history: {
    title: "Séances précédentes",
    emptyLabel: "Aucune séance de contractions précédente pour l'instant.",
    deleteLabel: "Supprimer",
    countValue: (count: number) => `Contractions : ${count}`,
    deleteConfirm: {
      title: "Supprimer cette séance ?",
      body: "La séance sera retirée de votre historique local.",
      confirm: "Supprimer",
      cancel: "Annuler",
    },
    deleteFailedStatus: "Impossible de supprimer cette séance. Réessayez.",
  },
  dashboardCard: {
    title: "Chronomètre des contractions",
    body: "Chronométrez le début et la fin de chaque contraction et observez leur évolution. Appuyez pour ouvrir le chronomètre des contractions.",
  },
};

const contractionTimerCopyEs: ContractionTimerCopy = {
  notAccessible: {
    title: "Cronómetro de contracciones",
    body: "El cronómetro de contracciones está disponible en cuanto tienes un embarazo activo registrado en Ovumcy.",
  },
  counter: {
    title: "Cronómetro de contracciones",
    subtitle: "Toca el botón para cronometrar cada contracción de principio a fin.",
    startLabel: "La contracción ha empezado",
    stopLabel: "La contracción ha terminado",
    idleHint: "Toca el botón cuando empiece tu próxima contracción.",
    elapsedLabel: (formatted: string) => `Transcurrido: ${formatted}`,
    finishCta: "Finalizar sesión",
    discardCta: "Descartar sesión",
    discardConfirm: {
      title: "¿Descartar esta sesión?",
      body: "Se eliminarán de tu historial local todas las contracciones guardadas en la sesión actual.",
      confirm: "Descartar",
      cancel: "Mantener sesión",
    },
    discardFailedStatus: "No se pudo descartar esta sesión. Inténtalo de nuevo.",
    saveFailedStatus: "No se pudo guardar esta contracción. Inténtalo de nuevo.",
    emptyRowsLabel: "Todavía no hay contracciones registradas en esta sesión.",
    firstContractionLabel: "—",
    educationLine:
      "Un referente habitual: contracciones cada 5 minutos aproximadamente, de una duración de alrededor de 1 minuto, durante al menos 1 hora. Si esto coincide con lo que estás notando, contacta a tu matrona, tu médico o tu unidad de maternidad.",
    educationLinePreterm:
      "Las contracciones regulares antes de la semana 37 pueden ser un signo de parto prematuro. Si tus contracciones continúan o se intensifican, contacta cuanto antes a tu matrona, tu médico o tu unidad de maternidad.",
  },
  windowSummary: {
    title: "Últimos 60 minutos",
    countLabel: (count: number) => `Contracciones: ${count}`,
    averageIntervalCaption: "Intervalo medio",
    averageDurationCaption: "Duración media",
    emptyLabel: "Todavía no hay suficientes datos en este periodo.",
  },
  rows: {
    title: "Esta sesión",
    columnCaption: "Inicio · Duración · Intervalo",
  },
  history: {
    title: "Sesiones anteriores",
    emptyLabel: "Todavía no hay sesiones de contracciones anteriores.",
    deleteLabel: "Eliminar",
    countValue: (count: number) => `Contracciones: ${count}`,
    deleteConfirm: {
      title: "¿Eliminar esta sesión?",
      body: "La sesión se eliminará de tu historial local.",
      confirm: "Eliminar",
      cancel: "Cancelar",
    },
    deleteFailedStatus: "No se pudo eliminar esta sesión. Inténtalo de nuevo.",
  },
  dashboardCard: {
    title: "Cronómetro de contracciones",
    body: "Cronometra el inicio y el final de cada contracción y observa cómo cambian. Toca para abrir el cronómetro de contracciones.",
  },
};

const contractionTimerCopyIt: ContractionTimerCopy = {
  notAccessible: {
    title: "Cronometro delle contrazioni",
    body: "Il cronometro delle contrazioni è disponibile non appena hai una gravidanza attiva tracciata in Ovumcy.",
  },
  counter: {
    title: "Cronometro delle contrazioni",
    subtitle: "Tocca il pulsante per cronometrare ogni contrazione dall'inizio alla fine.",
    startLabel: "La contrazione è iniziata",
    stopLabel: "La contrazione è finita",
    idleHint: "Tocca il pulsante quando inizia la prossima contrazione.",
    elapsedLabel: (formatted: string) => `Trascorso: ${formatted}`,
    finishCta: "Termina sessione",
    discardCta: "Scarta sessione",
    discardConfirm: {
      title: "Scartare questa sessione?",
      body: "Tutte le contrazioni salvate nella sessione corrente verranno rimosse dalla cronologia locale.",
      confirm: "Scarta",
      cancel: "Mantieni sessione",
    },
    discardFailedStatus: "Impossibile scartare questa sessione. Riprova.",
    saveFailedStatus: "Impossibile salvare questa contrazione. Riprova.",
    emptyRowsLabel: "Ancora nessuna contrazione registrata in questa sessione.",
    firstContractionLabel: "—",
    educationLine:
      "Un riferimento comune: contrazioni ogni circa 5 minuti, della durata di circa 1 minuto, per almeno 1 ora. Se corrisponde a quello che stai osservando, contatta la tua ostetrica, il tuo medico o il reparto maternità.",
    educationLinePreterm:
      "Contrazioni regolari prima della settimana 37 possono essere un segno di travaglio pretermine. Se le contrazioni continuano o si intensificano, contatta tempestivamente la tua ostetrica, il tuo medico o il reparto maternità.",
  },
  windowSummary: {
    title: "Ultimi 60 minuti",
    countLabel: (count: number) => `Contrazioni: ${count}`,
    averageIntervalCaption: "Intervallo medio",
    averageDurationCaption: "Durata media",
    emptyLabel: "Non ci sono ancora abbastanza dati in questo periodo.",
  },
  rows: {
    title: "Questa sessione",
    columnCaption: "Inizio · Durata · Intervallo",
  },
  history: {
    title: "Sessioni precedenti",
    emptyLabel: "Ancora nessuna sessione di contrazioni precedente.",
    deleteLabel: "Elimina",
    countValue: (count: number) => `Contrazioni: ${count}`,
    deleteConfirm: {
      title: "Eliminare questa sessione?",
      body: "La sessione verrà rimossa dalla cronologia locale.",
      confirm: "Elimina",
      cancel: "Annulla",
    },
    deleteFailedStatus: "Impossibile eliminare questa sessione. Riprova.",
  },
  dashboardCard: {
    title: "Cronometro delle contrazioni",
    body: "Cronometra l'inizio e la fine di ogni contrazione e osserva come cambiano. Tocca per aprire il cronometro delle contrazioni.",
  },
};

const contractionTimerCopyCatalog: Record<InterfaceLanguage, ContractionTimerCopy> = {
  en: contractionTimerCopyEn,
  ru: contractionTimerCopyRu,
  es: contractionTimerCopyEs,
  de: contractionTimerCopyDe,
  fr: contractionTimerCopyFr,
  it: contractionTimerCopyIt,
};

export type { ContractionTimerCopy };

export function getContractionTimerCopy(language: string | null | undefined) {
  return contractionTimerCopyCatalog[resolveCopyLanguage(language)];
}
