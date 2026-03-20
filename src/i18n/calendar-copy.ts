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
  calendarMeaning: "Calendar meaning",
  calendarMarkers: "Extra markers",
  periodDayYes: "Yes",
  periodDayNo: "No",
  noData: "-",
  legendGuide:
    "Cell color shows the cycle meaning. Dots, dashes, and the heart add saved markers on top of that meaning.",
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
    meaningTitle: "Day meaning",
    markersTitle: "Saved markers",
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
    calendarMeaning: "Что означает день",
    calendarMarkers: "Дополнительные отметки",
    periodDayYes: "Да",
    periodDayNo: "Нет",
    noData: "-",
    legendGuide:
      "Цвет ячейки показывает смысл дня. Точки, штрих и сердечко добавляют поверх него сохранённые отметки.",
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
      meaningTitle: "Смысл дня",
      markersTitle: "Сохранённые отметки",
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
    calendarMeaning: "Qué significa este día",
    calendarMarkers: "Marcadores extra",
    periodDayYes: "Sí",
    periodDayNo: "No",
    noData: "-",
    legendGuide:
      "El color de la celda muestra el significado del día. Los puntos, la raya y el corazón añaden marcadores guardados sobre ese significado.",
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
      meaningTitle: "Significado del día",
      markersTitle: "Marcadores guardados",
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
};

export function getCalendarCopy(language: string | null | undefined) {
  return calendarCopyCatalog[resolveCopyLanguage(language)];
}

export const calendarCopy = calendarCopyEn;
