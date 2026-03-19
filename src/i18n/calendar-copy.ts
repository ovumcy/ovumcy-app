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
  periodDayYes: "Yes",
  periodDayNo: "No",
  noData: "-",
  legend: {
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
    periodDayYes: "Да",
    periodDayNo: "Нет",
    noData: "-",
    legend: {
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
    periodDayYes: "Sí",
    periodDayNo: "No",
    noData: "-",
    legend: {
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
