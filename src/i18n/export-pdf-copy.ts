import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const exportPDFCopyEn = {
  documentTitle: "Ovumcy report for doctor",
  generatedAtLabel: "Generated",
  summaryTitle: "Summary",
  summaryLoggedDaysLabel: "Logged days",
  summaryCompletedCyclesLabel: "Completed cycles",
  summaryAverageCycleLengthLabel: "Average cycle length",
  summaryAveragePeriodLengthLabel: "Average period length",
  summaryAverageMoodLabel: "Average mood",
  summaryRangeLabel: "Range",
  calendarTitle: "Color calendar",
  calendarEmpty: "No recorded days yet.",
  legendPeriod: "Period",
  legendLoggedDay: "Logged day",
  cyclesEmpty: "Not enough completed cycles to build a doctor-focused report yet.",
  cycleTitle: (
    index: number,
    startDate: string,
    endDate: string,
    cycleLength: number,
    periodLength: number,
  ) =>
    `Cycle ${index}: ${startDate} - ${endDate} (len ${cycleLength}, period ${periodLength})`,
  cycleContinuationTitle: (index: number, startDate: string, endDate: string) =>
    `Cycle ${index}: ${startDate} - ${endDate} (continued)`,
  cycleFactorsPrefix: "Cycle factors",
  yes: "Yes",
  no: "No",
  tableColumns: {
    date: "Date",
    cycleDay: "Cycle day",
    period: "Period",
    flow: "Flow",
    mood: "Mood",
    sex: "Sex",
    bbt: "BBT",
    cervical: "Cervical mucus",
    lh: "LH test",
    symptoms: "Symptoms",
    notes: "Notes",
  },
  weekdays: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
} as const;

type ExportPDFCopy = WidenLiteral<typeof exportPDFCopyEn>;

const exportPDFCopyDe: ExportPDFCopy = {
  documentTitle: "Ovumcy-Bericht für Ärzt:innen",
  generatedAtLabel: "Erstellt",
  summaryTitle: "Zusammenfassung",
  summaryLoggedDaysLabel: "Erfasste Tage",
  summaryCompletedCyclesLabel: "Abgeschlossene Zyklen",
  summaryAverageCycleLengthLabel: "Durchschnittliche Zykluslänge",
  summaryAveragePeriodLengthLabel: "Durchschnittliche Periodendauer",
  summaryAverageMoodLabel: "Durchschnittliche Stimmung",
  summaryRangeLabel: "Zeitraum",
  calendarTitle: "Farbkalender",
  calendarEmpty: "Noch keine erfassten Tage.",
  legendPeriod: "Periode",
  legendLoggedDay: "Erfasster Tag",
  cyclesEmpty:
    "Es gibt noch nicht genug abgeschlossene Zyklen für einen arztfreundlichen Bericht.",
  cycleTitle: (
    index: number,
    startDate: string,
    endDate: string,
    cycleLength: number,
    periodLength: number,
  ) =>
    `Zyklus ${index}: ${startDate} - ${endDate} (Länge ${cycleLength}, Periode ${periodLength})`,
  cycleContinuationTitle: (index: number, startDate: string, endDate: string) =>
    `Zyklus ${index}: ${startDate} - ${endDate} (Fortsetzung)`,
  cycleFactorsPrefix: "Zyklusfaktoren",
  yes: "Ja",
  no: "Nein",
  tableColumns: {
    date: "Datum",
    cycleDay: "Zyklustag",
    period: "Periode",
    flow: "Stärke",
    mood: "Stimmung",
    sex: "Sex",
    bbt: "BBT",
    cervical: "Zervixschleim",
    lh: "LH-Test",
    symptoms: "Symptome",
    notes: "Notizen",
  },
  weekdays: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
};

const exportPDFCopyFr: ExportPDFCopy = {
  documentTitle: "Rapport Ovumcy pour le médecin",
  generatedAtLabel: "Généré",
  summaryTitle: "Résumé",
  summaryLoggedDaysLabel: "Jours enregistrés",
  summaryCompletedCyclesLabel: "Cycles terminés",
  summaryAverageCycleLengthLabel: "Durée moyenne du cycle",
  summaryAveragePeriodLengthLabel: "Durée moyenne des règles",
  summaryAverageMoodLabel: "Humeur moyenne",
  summaryRangeLabel: "Plage",
  calendarTitle: "Calendrier en couleurs",
  calendarEmpty: "Aucun jour enregistré pour le moment.",
  legendPeriod: "Règles",
  legendLoggedDay: "Jour enregistré",
  cyclesEmpty:
    "Il n'y a pas encore assez de cycles terminés pour créer un rapport orienté médecin.",
  cycleTitle: (
    index: number,
    startDate: string,
    endDate: string,
    cycleLength: number,
    periodLength: number,
  ) =>
    `Cycle ${index} : ${startDate} - ${endDate} (durée ${cycleLength}, règles ${periodLength})`,
  cycleContinuationTitle: (index: number, startDate: string, endDate: string) =>
    `Cycle ${index} : ${startDate} - ${endDate} (suite)`,
  cycleFactorsPrefix: "Facteurs du cycle",
  yes: "Oui",
  no: "Non",
  tableColumns: {
    date: "Date",
    cycleDay: "Jour du cycle",
    period: "Règles",
    flow: "Flux",
    mood: "Humeur",
    sex: "Sexe",
    bbt: "TBC",
    cervical: "Glaire cervicale",
    lh: "Test LH",
    symptoms: "Symptômes",
    notes: "Notes",
  },
  weekdays: ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"],
};

const exportPDFCopyCatalog: Record<InterfaceLanguage, ExportPDFCopy> = {
  en: exportPDFCopyEn,
  ru: {
    documentTitle: "Отчёт Ovumcy для врача",
    generatedAtLabel: "Создан",
    summaryTitle: "Сводка",
    summaryLoggedDaysLabel: "Записанных дней",
    summaryCompletedCyclesLabel: "Завершённых циклов",
    summaryAverageCycleLengthLabel: "Средняя длина цикла",
    summaryAveragePeriodLengthLabel: "Средняя длительность менструации",
    summaryAverageMoodLabel: "Среднее настроение",
    summaryRangeLabel: "Диапазон",
    calendarTitle: "Цветной календарь",
    calendarEmpty: "Пока нет записанных дней.",
    legendPeriod: "Менструация",
    legendLoggedDay: "Записанный день",
    cyclesEmpty:
      "Пока недостаточно завершённых циклов, чтобы собрать отчёт для врача.",
    cycleTitle: (
      index: number,
      startDate: string,
      endDate: string,
      cycleLength: number,
      periodLength: number,
    ) =>
      `Цикл ${index}: ${startDate} - ${endDate} (длина ${cycleLength}, менструация ${periodLength})`,
    cycleContinuationTitle: (index: number, startDate: string, endDate: string) =>
      `Цикл ${index}: ${startDate} - ${endDate} (продолжение)`,
    cycleFactorsPrefix: "Факторы цикла",
    yes: "Да",
    no: "Нет",
    tableColumns: {
      date: "Дата",
      cycleDay: "День цикла",
      period: "Менстр.",
      flow: "Выделения",
      mood: "Настр.",
      sex: "Секс",
      bbt: "БТТ",
      cervical: "Слизь",
      lh: "LH",
      symptoms: "Симптомы",
      notes: "Заметки",
    },
    weekdays: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  },
  es: {
    documentTitle: "Informe de Ovumcy para el médico",
    generatedAtLabel: "Generado",
    summaryTitle: "Resumen",
    summaryLoggedDaysLabel: "Días registrados",
    summaryCompletedCyclesLabel: "Ciclos completados",
    summaryAverageCycleLengthLabel: "Duración media del ciclo",
    summaryAveragePeriodLengthLabel: "Duración media del período",
    summaryAverageMoodLabel: "Estado de ánimo medio",
    summaryRangeLabel: "Rango",
    calendarTitle: "Calendario en color",
    calendarEmpty: "Todavía no hay días registrados.",
    legendPeriod: "Período",
    legendLoggedDay: "Día registrado",
    cyclesEmpty:
      "Todavía no hay suficientes ciclos completados para crear un informe orientado al médico.",
    cycleTitle: (
      index: number,
      startDate: string,
      endDate: string,
      cycleLength: number,
      periodLength: number,
    ) =>
      `Ciclo ${index}: ${startDate} - ${endDate} (duración ${cycleLength}, período ${periodLength})`,
    cycleContinuationTitle: (index: number, startDate: string, endDate: string) =>
      `Ciclo ${index}: ${startDate} - ${endDate} (continuación)`,
    cycleFactorsPrefix: "Factores del ciclo",
    yes: "Sí",
    no: "No",
    tableColumns: {
      date: "Fecha",
      cycleDay: "Día del ciclo",
      period: "Período",
      flow: "Flujo",
      mood: "Ánimo",
      sex: "Sexo",
      bbt: "TCB",
      cervical: "Moco cervical",
      lh: "Test LH",
      symptoms: "Síntomas",
      notes: "Notas",
    },
    weekdays: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"],
  },
  de: exportPDFCopyDe,
  fr: exportPDFCopyFr,
};

export function getExportPDFCopy(language: string | null | undefined) {
  return exportPDFCopyCatalog[resolveCopyLanguage(language)];
}

export const exportPDFCopy = exportPDFCopyEn;
