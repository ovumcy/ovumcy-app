import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const calendarCopyEn = {
  title: "Calendar",
  prev: "Prev",
  next: "Next",
  today: "Today",
  dayEditorTitle: "Day details",
  dayEditorSubtitle: "Daily log",
  noEntry: "No entry for this day yet.",
  addEntry: "Add entry",
  editEntry: "Edit entry",
  cancelEdit: "Cancel",
  futureEntryWarning:
    "This is a future date. Entries logged in advance may affect prediction accuracy.",
  dismissNotice: "Dismiss notice",
  predictionModeIrregular:
    "Irregular cycle mode is on. Ovumcy still shows predictions here, but they should be read as approximate guidance rather than exact dates.",
  predictionModeUnpredictable:
    "Facts-only mode is on. Calendar predictions are off, so this screen shows recorded facts and saved markers only.",
  calendarMeaning: "What this day means",
  calendarMarkers: "Extra markers",
  periodDayYes: "Yes",
  periodDayNo: "No",
  noData: "-",
  legendGuide:
    "The cell style shows the day type. Saved markers appear inside the cell.",
  stateHints: {
    neutral: "No recorded or predicted event is attached to this day yet.",
    recordedPeriod:
      "You marked this as a factual period day, so predictions recalculate around it.",
    predictedPeriod:
      "This lighter range is predicted from your cycle settings and recorded history.",
    lowProbability:
      "This is the early part of the predicted fertile window.",
    fertilityEdge: "This day sits inside the likely fertile window.",
    fertilityPeak:
      "This day sits inside the highest-likelihood part of the fertile window.",
    ovulation: "This is the predicted ovulation day based on the current cycle model.",
    ovulationTentative:
      "This is a possible ovulation day without temperature confirmation.",
    loggedEntry: "You already saved a local entry for this day.",
  },
  legend: {
    meaningTitle: "Day styles",
    markersTitle: "Your markers",
    showLegend: "Show calendar key",
    hideLegend: "Hide calendar key",
    recordedPeriod: "Logged period",
    predictedPeriod: "Predicted period",
    lowProbability: "Fertility may be starting",
    fertilityEdge: "Higher fertility",
    fertilityPeak: "Peak fertility",
    ovulation: "Ovulation day",
    ovulationTentative: "Possible ovulation day",
    loggedEntry: "Logged entry",
    sexLogged: "Intimacy logged",
    today: "Today",
  },
} as const;

type CalendarCopy = WidenLiteral<typeof calendarCopyEn>;

const calendarCopyDe: CalendarCopy = {
  title: "Kalender",
  prev: "Zurück",
  next: "Weiter",
  today: "Heute",
  dayEditorTitle: "Tagesdetails",
  dayEditorSubtitle: "Tagesprotokoll",
  noEntry: "Für diesen Tag gibt es noch keinen Eintrag.",
  addEntry: "Eintrag hinzufügen",
  editEntry: "Eintrag bearbeiten",
  cancelEdit: "Abbrechen",
  futureEntryWarning:
    "Dies ist ein zukünftiges Datum. Vorab eingetragene Daten können die Vorhersagegenauigkeit beeinflussen.",
  dismissNotice: "Hinweis schließen",
  predictionModeIrregular:
    "Der Modus für unregelmäßige Zyklen ist aktiv. Ovumcy zeigt hier weiterhin Vorhersagen an, aber sie sollten als ungefähre Orientierung und nicht als exakte Daten gelesen werden.",
  predictionModeUnpredictable:
    "Der Modus „Nur Fakten“ ist aktiv. Kalender-Vorhersagen sind ausgeschaltet, daher zeigt dieser Bildschirm nur erfasste Fakten und gespeicherte Marker.",
  calendarMeaning: "Was dieser Tag bedeutet",
  calendarMarkers: "Zusätzliche Marker",
  periodDayYes: "Ja",
  periodDayNo: "Nein",
  noData: "-",
  legendGuide:
    "Der Zellstil zeigt den Tagestyp. Gespeicherte Marker erscheinen innerhalb der Zelle.",
  stateHints: {
    neutral: "Diesem Tag ist noch kein erfasstes oder vorhergesagtes Ereignis zugeordnet.",
    recordedPeriod:
      "Sie haben diesen Tag als tatsächlichen Periodentag markiert. Die Vorhersagen werden darum neu berechnet.",
    predictedPeriod:
      "Dieser hellere Bereich wird aus Ihren Zykluseinstellungen und Ihrem Verlauf vorhergesagt.",
    lowProbability:
      "Dies ist der frühe Teil des vorhergesagten fruchtbaren Fensters.",
    fertilityEdge: "Dieser Tag liegt im wahrscheinlichen fruchtbaren Fenster.",
    fertilityPeak:
      "Dieser Tag liegt im Teil des fruchtbaren Fensters mit der höchsten Wahrscheinlichkeit.",
    ovulation:
      "Dies ist der vorhergesagte Eisprungtag auf Basis des aktuellen Zyklusmodells.",
    ovulationTentative:
      "Dies ist ein möglicher Eisprungtag ohne Temperaturbestätigung.",
    loggedEntry: "Für diesen Tag ist bereits ein lokaler Eintrag gespeichert.",
  },
  legend: {
    meaningTitle: "Tagesstile",
    markersTitle: "Ihre Marker",
    showLegend: "Kalenderhilfe anzeigen",
    hideLegend: "Kalenderhilfe ausblenden",
    recordedPeriod: "Erfasste Periode",
    predictedPeriod: "Vorhergesagte Periode",
    lowProbability: "Fruchtbarkeit beginnt vielleicht",
    fertilityEdge: "Höhere Fruchtbarkeit",
    fertilityPeak: "Höchste Fruchtbarkeit",
    ovulation: "Eisprungtag",
    ovulationTentative: "Möglicher Eisprungtag",
    loggedEntry: "Eintrag gespeichert",
    sexLogged: "Intimität erfasst",
    today: "Heute",
  },
};

const calendarCopyFr: CalendarCopy = {
  title: "Calendrier",
  prev: "Préc.",
  next: "Suiv.",
  today: "Aujourd'hui",
  dayEditorTitle: "Détails du jour",
  dayEditorSubtitle: "Journal quotidien",
  noEntry: "Il n'y a pas encore d'entrée pour ce jour.",
  addEntry: "Ajouter une entrée",
  editEntry: "Modifier l'entrée",
  cancelEdit: "Annuler",
  futureEntryWarning:
    "Cette date est dans le futur. Les entrées ajoutées à l'avance peuvent affecter la précision des prédictions.",
  dismissNotice: "Fermer l'avis",
  predictionModeIrregular:
    "Le mode cycle irrégulier est activé. Ovumcy affiche encore des prédictions ici, mais elles doivent être lues comme une indication approximative et non comme des dates exactes.",
  predictionModeUnpredictable:
    "Le mode « Seulement les faits » est activé. Les prédictions du calendrier sont désactivées, donc cet écran n'affiche que les faits enregistrés et les marqueurs sauvegardés.",
  calendarMeaning: "Ce que signifie ce jour",
  calendarMarkers: "Marqueurs supplémentaires",
  periodDayYes: "Oui",
  periodDayNo: "Non",
  noData: "-",
  legendGuide:
    "Le style de la case montre le type de jour. Les marqueurs enregistrés apparaissent dans la case.",
  stateHints: {
    neutral:
      "Aucun événement enregistré ou prédit n'est encore associé à cette journée.",
    recordedPeriod:
      "Vous avez marqué ce jour comme un vrai jour de règles. Les prédictions sont recalculées autour de lui.",
    predictedPeriod:
      "Cette zone plus claire est prédite à partir de vos réglages de cycle et de votre historique.",
    lowProbability:
      "C'est le début de la fenêtre fertile prédite.",
    fertilityEdge:
      "Cette journée se situe dans la fenêtre fertile la plus probable.",
    fertilityPeak:
      "Cette journée se situe dans la partie la plus probable de la fenêtre fertile.",
    ovulation:
      "C'est le jour d'ovulation prédit selon le modèle actuel du cycle.",
    ovulationTentative:
      "C'est un jour d'ovulation possible sans confirmation thermique.",
    loggedEntry: "Vous avez déjà enregistré une entrée locale pour cette journée.",
  },
  legend: {
    meaningTitle: "Styles de jour",
    markersTitle: "Vos marqueurs",
    showLegend: "Afficher l'aide du calendrier",
    hideLegend: "Masquer l'aide du calendrier",
    recordedPeriod: "Règles enregistrées",
    predictedPeriod: "Règles prévues",
    lowProbability: "La fertilité peut commencer",
    fertilityEdge: "Fertilité plus élevée",
    fertilityPeak: "Pic de fertilité",
    ovulation: "Jour d'ovulation",
    ovulationTentative: "Jour d'ovulation possible",
    loggedEntry: "Entrée enregistrée",
    sexLogged: "Intimité enregistrée",
    today: "Aujourd'hui",
  },
};

const calendarCopyCatalog: Record<InterfaceLanguage, CalendarCopy> = {
  en: calendarCopyEn,
  ru: {
    title: "Календарь",
    prev: "Назад",
    next: "Вперёд",
    today: "Сегодня",
    dayEditorTitle: "Детали дня",
    dayEditorSubtitle: "Дневная запись",
    noEntry: "Для этого дня записи пока нет.",
    addEntry: "Добавить запись",
    editEntry: "Изменить запись",
    cancelEdit: "Отмена",
    futureEntryWarning:
      "Это будущая дата. Записи, добавленные заранее, могут повлиять на точность предсказаний.",
    dismissNotice: "Скрыть уведомление",
    predictionModeIrregular:
      "Включён режим нерегулярного цикла. Ovumcy всё ещё показывает предсказания, но здесь их нужно читать как приблизительный ориентир, а не как точные даты.",
    predictionModeUnpredictable:
      "Включён режим «Только факты». Предсказания в календаре выключены, поэтому экран показывает только записанные факты и сохранённые отметки.",
    calendarMeaning: "Что означает этот день",
    calendarMarkers: "Дополнительные отметки",
    periodDayYes: "Да",
    periodDayNo: "Нет",
    noData: "-",
    legendGuide:
      "Стиль ячейки показывает тип дня. Сохранённые отметки появляются внутри ячейки.",
    stateHints: {
      neutral: "Для этого дня пока нет ни записи, ни предсказанного события.",
      recordedPeriod:
        "Вы отметили этот день вручную как день менструации, поэтому предсказания пересчитываются вокруг него.",
      predictedPeriod:
        "Этот более светлый диапазон предсказан по настройкам цикла и вашей истории.",
      lowProbability:
        "Это ранняя часть предсказанного фертильного окна.",
      fertilityEdge: "Этот день находится внутри вероятного фертильного окна.",
      fertilityPeak:
        "Этот день находится в части фертильного окна с самой высокой вероятностью.",
      ovulation: "Это предсказанный день овуляции по текущей модели цикла.",
      ovulationTentative:
        "Это возможный день овуляции без подтверждения по температуре.",
      loggedEntry: "Для этого дня уже сохранена локальная запись.",
    },
    legend: {
      meaningTitle: "Стили дней",
      markersTitle: "Ваши отметки",
      showLegend: "Показать подсказку",
      hideLegend: "Скрыть подсказку",
      recordedPeriod: "Отмеченная менструация",
      predictedPeriod: "Предсказанная менструация",
      lowProbability: "Фертильность может начинаться",
      fertilityEdge: "Более высокая фертильность",
      fertilityPeak: "Пик фертильности",
      ovulation: "День овуляции",
      ovulationTentative: "Возможный день овуляции",
      loggedEntry: "Есть запись",
      sexLogged: "Отмечена близость",
      today: "Сегодня",
    },
  },
  es: {
    title: "Calendario",
    prev: "Anterior",
    next: "Siguiente",
    today: "Hoy",
    dayEditorTitle: "Detalles del día",
    dayEditorSubtitle: "Registro diario",
    noEntry: "Todavía no hay registro para este día.",
    addEntry: "Añadir registro",
    editEntry: "Editar registro",
    cancelEdit: "Cancelar",
    futureEntryWarning:
      "Esta es una fecha futura. Las entradas registradas por adelantado pueden afectar a la precisión de las predicciones.",
    dismissNotice: "Cerrar aviso",
    predictionModeIrregular:
      "El modo de ciclo irregular está activo. Ovumcy seguirá mostrando predicciones aquí, pero deben leerse como una guía aproximada y no como fechas exactas.",
    predictionModeUnpredictable:
      "El modo «Solo hechos» está activo. Las predicciones del calendario están desactivadas, así que esta pantalla muestra solo hechos registrados y marcadores guardados.",
    calendarMeaning: "Qué significa este día",
    calendarMarkers: "Marcadores extra",
    periodDayYes: "Sí",
    periodDayNo: "No",
    noData: "-",
    legendGuide:
      "El estilo de la celda muestra el tipo de día. Los marcadores guardados aparecen dentro de la celda.",
    stateHints: {
      neutral: "Todavía no hay un evento registrado ni previsto para este día.",
      recordedPeriod:
        "Marcaste este día manualmente como período, así que las predicciones se recalculan alrededor de él.",
      predictedPeriod:
        "Este rango más claro se predice a partir de tus ajustes del ciclo y del historial guardado.",
      lowProbability:
        "Esta es la parte inicial de la ventana fértil prevista.",
      fertilityEdge: "Este día está dentro de la parte probable de la ventana fértil.",
      fertilityPeak:
        "Este día está dentro de la parte con mayor probabilidad de la ventana fértil.",
      ovulation:
        "Este es el día de ovulación previsto según el modelo actual del ciclo.",
      ovulationTentative:
        "Este es un posible día de ovulación sin confirmación térmica.",
      loggedEntry: "Ya guardaste un registro local para este día.",
    },
    legend: {
      meaningTitle: "Estilos de día",
      markersTitle: "Tus marcadores",
      showLegend: "Mostrar la leyenda",
      hideLegend: "Ocultar la leyenda",
      recordedPeriod: "Período registrado",
      predictedPeriod: "Período previsto",
      lowProbability: "La fertilidad puede estar empezando",
      fertilityEdge: "Mayor fertilidad",
      fertilityPeak: "Pico fértil",
      ovulation: "Día de ovulación",
      ovulationTentative: "Posible día de ovulación",
      loggedEntry: "Registro guardado",
      sexLogged: "Intimidad registrada",
      today: "Hoy",
    },
  },
  de: calendarCopyDe,
  fr: calendarCopyFr,
};

export function getCalendarCopy(language: string | null | undefined) {
  return calendarCopyCatalog[resolveCopyLanguage(language)];
}
