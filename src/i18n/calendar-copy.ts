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
  dismissNotice: "Dismiss notice",
  predictionModeIrregular:
    "Irregular cycle mode is on. Ovumcy still shows predictions here, but they should be read as approximate guidance rather than exact dates.",
  predictionModeUnpredictable:
    "Unpredictable cycle mode is on. Calendar predictions are off, so this screen shows recorded facts and saved markers only.",
  calendarMeaning: "What the color shows",
  calendarMarkers: "Extra markers",
  periodDayYes: "Yes",
  periodDayNo: "No",
  noData: "-",
  legendGuide:
    "Color shows the day type. Dots, dashes, and the heart show your saved markers.",
  stateHints: {
    neutral: "No recorded or predicted event is attached to this day yet.",
    recordedPeriod:
      "You marked this as a factual period day, so predictions recalculate around it.",
    predictedPeriod:
      "This lighter range is predicted from your cycle settings and recorded history.",
    lowProbability:
      "This sits near the predicted fertile window, but with lower probability than the peak days.",
    fertilityEdge: "This day sits on the edge of the predicted fertile window.",
    fertilityPeak: "This day is inside the highest-fertility part of the predicted window.",
    ovulation: "This is the predicted ovulation day based on the current cycle model.",
    ovulationTentative:
      "This is an estimated ovulation day without temperature confirmation.",
    loggedEntry: "You already saved a local entry for this day.",
  },
  legend: {
    meaningTitle: "By color",
    markersTitle: "Your markers",
    recordedPeriod: "Recorded period",
    predictedPeriod: "Predicted period",
    lowProbability: "Low probability",
    fertilityEdge: "Fertility edge",
    fertilityPeak: "Peak fertility",
    ovulation: "Ovulation",
    ovulationTentative: "Estimated ovulation, no thermal shift",
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
  dismissNotice: "Hinweis schließen",
  predictionModeIrregular:
    "Der Modus für unregelmäßige Zyklen ist aktiv. Ovumcy zeigt hier weiterhin Vorhersagen an, aber sie sollten als ungefähre Orientierung und nicht als exakte Daten gelesen werden.",
  predictionModeUnpredictable:
    "Der unvorhersagbare Zyklusmodus ist aktiv. Kalender-Vorhersagen sind ausgeschaltet, daher zeigt dieser Bildschirm nur erfasste Fakten und gespeicherte Marker.",
  calendarMeaning: "Was die Farbe zeigt",
  calendarMarkers: "Zusätzliche Marker",
  periodDayYes: "Ja",
  periodDayNo: "Nein",
  noData: "-",
  legendGuide:
    "Die Farbe zeigt den Tagestyp. Punkte, Striche und das Herz zeigen deine gespeicherten Marker.",
  stateHints: {
    neutral: "Diesem Tag ist noch kein erfasstes oder vorhergesagtes Ereignis zugeordnet.",
    recordedPeriod:
      "Du hast diesen Tag als tatsächlichen Periodentag markiert. Die Vorhersagen werden darum neu berechnet.",
    predictedPeriod:
      "Dieser hellere Bereich wird aus deinen Zykluseinstellungen und deinem Verlauf vorhergesagt.",
    lowProbability:
      "Dieser Tag liegt in der Nähe des vorhergesagten fruchtbaren Fensters, aber mit geringerer Wahrscheinlichkeit als die Spitzentage.",
    fertilityEdge:
      "Dieser Tag liegt am Rand des vorhergesagten fruchtbaren Fensters.",
    fertilityPeak:
      "Dieser Tag liegt im fruchtbarsten Teil des vorhergesagten Fensters.",
    ovulation:
      "Dies ist der vorhergesagte Eisprungtag auf Basis des aktuellen Zyklusmodells.",
    ovulationTentative:
      "Dies ist ein geschätzter Eisprungtag ohne Temperaturbestätigung.",
    loggedEntry: "Für diesen Tag ist bereits ein lokaler Eintrag gespeichert.",
  },
  legend: {
    meaningTitle: "Nach Farbe",
    markersTitle: "Deine Marker",
    recordedPeriod: "Erfasste Periode",
    predictedPeriod: "Vorhergesagte Periode",
    lowProbability: "Niedrige Wahrscheinlichkeit",
    fertilityEdge: "Rand des fruchtbaren Fensters",
    fertilityPeak: "Höchste Fruchtbarkeit",
    ovulation: "Eisprung",
    ovulationTentative: "Geschätzter Eisprung ohne Temperaturanstieg",
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
  dismissNotice: "Fermer l'avis",
  predictionModeIrregular:
    "Le mode cycle irrégulier est activé. Ovumcy affiche encore des prédictions ici, mais elles doivent être lues comme une indication approximative et non comme des dates exactes.",
  predictionModeUnpredictable:
    "Le mode cycle imprévisible est activé. Les prédictions du calendrier sont désactivées, donc cet écran n'affiche que les faits enregistrés et les marqueurs sauvegardés.",
  calendarMeaning: "Ce que montre la couleur",
  calendarMarkers: "Marqueurs supplémentaires",
  periodDayYes: "Oui",
  periodDayNo: "Non",
  noData: "-",
  legendGuide:
    "La couleur montre le type de journée. Les points, les tirets et le cœur montrent tes marqueurs enregistrés.",
  stateHints: {
    neutral:
      "Aucun événement enregistré ou prédit n'est encore associé à cette journée.",
    recordedPeriod:
      "Tu as marqué ce jour comme un vrai jour de règles. Les prédictions sont recalculées autour de lui.",
    predictedPeriod:
      "Cette zone plus claire est prédite à partir de tes réglages de cycle et de ton historique.",
    lowProbability:
      "Cette journée se situe près de la fenêtre fertile prédite, mais avec une probabilité plus faible que les jours de pic.",
    fertilityEdge:
      "Cette journée se situe au bord de la fenêtre fertile prédite.",
    fertilityPeak:
      "Cette journée se situe dans la partie la plus fertile de la fenêtre prédite.",
    ovulation:
      "C'est le jour d'ovulation prédit selon le modèle actuel du cycle.",
    ovulationTentative:
      "C'est un jour d'ovulation estimé sans confirmation thermique.",
    loggedEntry: "Tu as déjà enregistré une entrée locale pour cette journée.",
  },
  legend: {
    meaningTitle: "Par couleur",
    markersTitle: "Tes marqueurs",
    recordedPeriod: "Règles enregistrées",
    predictedPeriod: "Règles prévues",
    lowProbability: "Probabilité faible",
    fertilityEdge: "Bord fertile",
    fertilityPeak: "Pic de fertilité",
    ovulation: "Ovulation",
    ovulationTentative: "Ovulation estimée sans décalage thermique",
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
    dismissNotice: "Скрыть уведомление",
    predictionModeIrregular:
      "Включён режим нерегулярного цикла. Ovumcy всё ещё показывает предсказания, но здесь их нужно читать как приблизительный ориентир, а не как точные даты.",
    predictionModeUnpredictable:
      "Включён непредсказуемый режим цикла. Предсказания в календаре выключены, поэтому экран показывает только записанные факты и сохранённые отметки.",
    calendarMeaning: "Что показывает цвет",
    calendarMarkers: "Дополнительные отметки",
    periodDayYes: "Да",
    periodDayNo: "Нет",
    noData: "-",
    legendGuide:
      "Цвет показывает тип дня. Точка, штрих и сердечко — ваши сохранённые отметки.",
    stateHints: {
      neutral: "Для этого дня пока нет ни записи, ни предсказанного события.",
      recordedPeriod:
        "Вы отметили этот день вручную как день менструации, поэтому предсказания пересчитываются вокруг него.",
      predictedPeriod:
        "Этот более светлый диапазон предсказан по настройкам цикла и вашей истории.",
      lowProbability:
        "День находится рядом с предсказанным фертильным окном, но вероятность ниже, чем у пиковых дней.",
      fertilityEdge: "Этот день находится на краю предсказанного фертильного окна.",
      fertilityPeak: "Этот день входит в самую фертильную часть предсказанного окна.",
      ovulation: "Это предсказанный день овуляции по текущей модели цикла.",
      ovulationTentative:
        "Это предполагаемый день овуляции без подтверждения по температуре.",
      loggedEntry: "Для этого дня уже сохранена локальная запись.",
    },
    legend: {
      meaningTitle: "По цвету",
      markersTitle: "Ваши отметки",
      recordedPeriod: "Отмеченная менструация",
      predictedPeriod: "Предсказанная менструация",
      lowProbability: "Низкая вероятность",
      fertilityEdge: "Край фертильного окна",
      fertilityPeak: "Пик фертильности",
      ovulation: "Овуляция",
      ovulationTentative: "Предполагаемая овуляция без термосдвига",
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
    dismissNotice: "Cerrar aviso",
    predictionModeIrregular:
      "El modo de ciclo irregular está activo. Ovumcy seguirá mostrando predicciones aquí, pero deben leerse como una guía aproximada y no como fechas exactas.",
    predictionModeUnpredictable:
      "El modo de ciclo impredecible está activo. Las predicciones del calendario están desactivadas, así que esta pantalla muestra solo hechos registrados y marcadores guardados.",
    calendarMeaning: "Qué muestra el color",
    calendarMarkers: "Marcadores extra",
    periodDayYes: "Sí",
    periodDayNo: "No",
    noData: "-",
    legendGuide:
      "El color muestra el tipo de día. Los puntos, la raya y el corazón muestran tus marcadores guardados.",
    stateHints: {
      neutral: "Todavía no hay un evento registrado ni previsto para este día.",
      recordedPeriod:
        "Marcaste este día manualmente como período, así que las predicciones se recalculan alrededor de él.",
      predictedPeriod:
        "Este rango más claro se predice a partir de tus ajustes del ciclo y del historial guardado.",
      lowProbability:
        "Este día queda cerca de la ventana fértil prevista, pero con menor probabilidad que los días pico.",
      fertilityEdge: "Este día está en el borde de la ventana fértil prevista.",
      fertilityPeak: "Este día cae en la parte más fértil de la ventana prevista.",
      ovulation:
        "Este es el día de ovulación previsto según el modelo actual del ciclo.",
      ovulationTentative:
        "Este es un día de ovulación estimado sin confirmación térmica.",
      loggedEntry: "Ya guardaste un registro local para este día.",
    },
    legend: {
      meaningTitle: "Por color",
      markersTitle: "Tus marcadores",
      recordedPeriod: "Período registrado",
      predictedPeriod: "Período previsto",
      lowProbability: "Probabilidad baja",
      fertilityEdge: "Borde fértil",
      fertilityPeak: "Pico fértil",
      ovulation: "Ovulación",
      ovulationTentative: "Ovulación estimada sin cambio térmico",
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

export const calendarCopy = calendarCopyEn;
