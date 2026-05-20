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
  legendFertileWindow: "Fertile window",
  legendOvulation: "Ovulation",
  legendTentativeOvulation: "Predicted ovulation",
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
  advancedFertilityTitle: "Advanced fertility signals",
  advancedFertilityEmpty: "No advanced fertility signals from recent cycles.",
  advancedFertilityUnitCelsius: "°C",
  advancedFertilityUnitFahrenheit: "°F",
  advancedFertilityThermalShiftTitle: "BBT thermal shift",
  advancedFertilityThermalShiftConfirmedValue: "Confirmed",
  advancedFertilityThermalShiftBuildingValue: "Building",
  advancedFertilityThermalShiftDescription: (
    rise: string,
    unit: string,
    sampleCount: number,
  ) => `+${rise} ${unit} sustained over ${sampleCount} readings.`,
  advancedFertilityOvulationTitle: "Ovulation confirmation",
  advancedFertilityOvulationConfirmedValue: "Signals aligned",
  advancedFertilityOvulationBuildingValue: "Signals building",
  advancedFertilityOvulationDescription: (mucusDate: string, gapDays: number) =>
    gapDays === 0
      ? `Egg-white mucus and thermal rise both logged on ${mucusDate}.`
      : `Egg-white mucus on ${mucusDate}; thermal rise ${gapDays} d later.`,
  advancedFertilityLHPeakTitle: "LH peak signal",
  advancedFertilityLHPeakAlignedValue: "Peak + thermal rise",
  advancedFertilityLHPeakLoggedValue: "Peak logged",
  advancedFertilityLHPeakDescription: (date: string) =>
    `Peak LH test logged on ${date}.`,
  extendedReportsTitle: "Cycle comparison",
  extendedReportsEmpty: "Not enough completed cycles to compare yet.",
  extendedReportsRow: (
    startDate: string,
    cycleLength: number,
    periodLength: number,
    comparison: "longer" | "shorter" | "variable",
  ) =>
    `${startDate} - cycle ${cycleLength} d, period ${periodLength} d (${
      comparison === "longer"
        ? "longer than usual"
        : comparison === "shorter"
          ? "shorter than usual"
          : "within variable pattern"
    })`,
  shortLutealWarningTitle: "Short luteal phase",
  shortLutealWarningDescription: (averageDays: number, observationCount: number) =>
    `Observed luteal phase averages ${averageDays.toFixed(1)} d across ${observationCount} recent cycles. Typical is 11-14 d. Consider clinical follow-up.`,
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
  legendFertileWindow: "Fruchtbares Fenster",
  legendOvulation: "Eisprung",
  legendTentativeOvulation: "Vermuteter Eisprung",
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
  advancedFertilityTitle: "Erweiterte Fruchtbarkeitssignale",
  advancedFertilityEmpty:
    "Keine erweiterten Fruchtbarkeitssignale aus den letzten Zyklen.",
  advancedFertilityUnitCelsius: "°C",
  advancedFertilityUnitFahrenheit: "°F",
  advancedFertilityThermalShiftTitle: "BBT-Temperaturanstieg",
  advancedFertilityThermalShiftConfirmedValue: "Bestätigt",
  advancedFertilityThermalShiftBuildingValue: "Aufbauend",
  advancedFertilityThermalShiftDescription: (
    rise: string,
    unit: string,
    sampleCount: number,
  ) => `+${rise} ${unit} anhaltend über ${sampleCount} Messungen.`,
  advancedFertilityOvulationTitle: "Eisprungbestätigung",
  advancedFertilityOvulationConfirmedValue: "Signale aufeinander abgestimmt",
  advancedFertilityOvulationBuildingValue: "Signale aufbauend",
  advancedFertilityOvulationDescription: (mucusDate: string, gapDays: number) =>
    gapDays === 0
      ? `Eiweißschleim und Temperaturanstieg am ${mucusDate} erfasst.`
      : `Eiweißschleim am ${mucusDate}; Temperaturanstieg ${gapDays} T. später.`,
  advancedFertilityLHPeakTitle: "LH-Peak-Signal",
  advancedFertilityLHPeakAlignedValue: "Peak + Temperaturanstieg",
  advancedFertilityLHPeakLoggedValue: "Peak erfasst",
  advancedFertilityLHPeakDescription: (date: string) =>
    `Peak-LH-Test am ${date} erfasst.`,
  extendedReportsTitle: "Zyklusvergleich",
  extendedReportsEmpty: "Noch nicht genug abgeschlossene Zyklen zum Vergleich.",
  extendedReportsRow: (
    startDate: string,
    cycleLength: number,
    periodLength: number,
    comparison: "longer" | "shorter" | "variable",
  ) =>
    `${startDate} - Zyklus ${cycleLength} T., Periode ${periodLength} T. (${
      comparison === "longer"
        ? "länger als üblich"
        : comparison === "shorter"
          ? "kürzer als üblich"
          : "innerhalb eines variablen Musters"
    })`,
  shortLutealWarningTitle: "Kurze Lutealphase",
  shortLutealWarningDescription: (averageDays: number, observationCount: number) =>
    `Beobachtete Lutealphase durchschnittlich ${averageDays.toFixed(1)} T. in ${observationCount} aktuellen Zyklen. Typisch sind 11-14 T. Klinische Abklärung empfohlen.`,
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
  legendFertileWindow: "Fenêtre fertile",
  legendOvulation: "Ovulation",
  legendTentativeOvulation: "Ovulation prévue",
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
  advancedFertilityTitle: "Signaux de fertilité avancés",
  advancedFertilityEmpty:
    "Aucun signal de fertilité avancé sur les cycles récents.",
  advancedFertilityUnitCelsius: "°C",
  advancedFertilityUnitFahrenheit: "°F",
  advancedFertilityThermalShiftTitle: "Hausse thermique TBC",
  advancedFertilityThermalShiftConfirmedValue: "Confirmée",
  advancedFertilityThermalShiftBuildingValue: "En construction",
  advancedFertilityThermalShiftDescription: (
    rise: string,
    unit: string,
    sampleCount: number,
  ) => `+${rise} ${unit} maintenue sur ${sampleCount} mesures.`,
  advancedFertilityOvulationTitle: "Confirmation d'ovulation",
  advancedFertilityOvulationConfirmedValue: "Signaux alignés",
  advancedFertilityOvulationBuildingValue: "Signaux en cours",
  advancedFertilityOvulationDescription: (mucusDate: string, gapDays: number) =>
    gapDays === 0
      ? `Glaire blanc d'œuf et hausse thermique le ${mucusDate}.`
      : `Glaire blanc d'œuf le ${mucusDate} ; hausse thermique ${gapDays} j plus tard.`,
  advancedFertilityLHPeakTitle: "Signal pic LH",
  advancedFertilityLHPeakAlignedValue: "Pic + hausse thermique",
  advancedFertilityLHPeakLoggedValue: "Pic enregistré",
  advancedFertilityLHPeakDescription: (date: string) =>
    `Test LH pic enregistré le ${date}.`,
  extendedReportsTitle: "Comparaison des cycles",
  extendedReportsEmpty: "Pas encore assez de cycles complets à comparer.",
  extendedReportsRow: (
    startDate: string,
    cycleLength: number,
    periodLength: number,
    comparison: "longer" | "shorter" | "variable",
  ) =>
    `${startDate} - cycle ${cycleLength} j, règles ${periodLength} j (${
      comparison === "longer"
        ? "plus long que d'habitude"
        : comparison === "shorter"
          ? "plus court que d'habitude"
          : "dans un schéma variable"
    })`,
  shortLutealWarningTitle: "Phase lutéale courte",
  shortLutealWarningDescription: (averageDays: number, observationCount: number) =>
    `Phase lutéale observée en moyenne ${averageDays.toFixed(1)} j sur ${observationCount} cycles récents. Typiquement 11 à 14 j. Suivi clinique recommandé.`,
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
    legendFertileWindow: "Фертильное окно",
    legendOvulation: "Овуляция",
    legendTentativeOvulation: "Предполагаемая овуляция",
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
    advancedFertilityTitle: "Расширенные сигналы фертильности",
    advancedFertilityEmpty:
      "Нет расширенных сигналов фертильности по недавним циклам.",
    advancedFertilityUnitCelsius: "°C",
    advancedFertilityUnitFahrenheit: "°F",
    advancedFertilityThermalShiftTitle: "Тепловой сдвиг БТТ",
    advancedFertilityThermalShiftConfirmedValue: "Подтверждён",
    advancedFertilityThermalShiftBuildingValue: "Формируется",
    advancedFertilityThermalShiftDescription: (
      rise: string,
      unit: string,
      sampleCount: number,
    ) => `+${rise} ${unit} удерживается на ${sampleCount} измерениях.`,
    advancedFertilityOvulationTitle: "Подтверждение овуляции",
    advancedFertilityOvulationConfirmedValue: "Сигналы согласованы",
    advancedFertilityOvulationBuildingValue: "Сигналы собираются",
    advancedFertilityOvulationDescription: (mucusDate: string, gapDays: number) =>
      gapDays === 0
        ? `Слизь как яичный белок и тепловой подъём отмечены ${mucusDate}.`
        : `Слизь как яичный белок ${mucusDate}; тепловой подъём через ${gapDays} д.`,
    advancedFertilityLHPeakTitle: "Сигнал пика ЛГ",
    advancedFertilityLHPeakAlignedValue: "Пик + тепловой подъём",
    advancedFertilityLHPeakLoggedValue: "Пик отмечен",
    advancedFertilityLHPeakDescription: (date: string) =>
      `Пиковый ЛГ-тест отмечен ${date}.`,
    extendedReportsTitle: "Сравнение циклов",
    extendedReportsEmpty: "Завершённых циклов пока недостаточно для сравнения.",
    extendedReportsRow: (
      startDate: string,
      cycleLength: number,
      periodLength: number,
      comparison: "longer" | "shorter" | "variable",
    ) =>
      `${startDate} - цикл ${cycleLength} д., менструация ${periodLength} д. (${
        comparison === "longer"
          ? "длиннее обычного"
          : comparison === "shorter"
            ? "короче обычного"
            : "в пределах вариативного паттерна"
      })`,
    shortLutealWarningTitle: "Короткая лютеиновая фаза",
    shortLutealWarningDescription: (
      averageDays: number,
      observationCount: number,
    ) =>
      `Наблюдаемая лютеиновая фаза в среднем ${averageDays.toFixed(1)} д. в ${observationCount} последних циклах. Типично 11-14 д. Рекомендуется клиническая консультация.`,
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
    legendFertileWindow: "Ventana fértil",
    legendOvulation: "Ovulación",
    legendTentativeOvulation: "Ovulación prevista",
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
    advancedFertilityTitle: "Señales avanzadas de fertilidad",
    advancedFertilityEmpty:
      "No hay señales avanzadas de fertilidad de ciclos recientes.",
    advancedFertilityUnitCelsius: "°C",
    advancedFertilityUnitFahrenheit: "°F",
    advancedFertilityThermalShiftTitle: "Cambio térmico de TCB",
    advancedFertilityThermalShiftConfirmedValue: "Confirmado",
    advancedFertilityThermalShiftBuildingValue: "Formándose",
    advancedFertilityThermalShiftDescription: (
      rise: string,
      unit: string,
      sampleCount: number,
    ) => `+${rise} ${unit} sostenido durante ${sampleCount} lecturas.`,
    advancedFertilityOvulationTitle: "Confirmación de ovulación",
    advancedFertilityOvulationConfirmedValue: "Señales alineadas",
    advancedFertilityOvulationBuildingValue: "Señales formándose",
    advancedFertilityOvulationDescription: (mucusDate: string, gapDays: number) =>
      gapDays === 0
        ? `Moco tipo clara de huevo y subida térmica registrados el ${mucusDate}.`
        : `Moco clara de huevo el ${mucusDate}; subida térmica ${gapDays} d después.`,
    advancedFertilityLHPeakTitle: "Señal de pico de LH",
    advancedFertilityLHPeakAlignedValue: "Pico + subida térmica",
    advancedFertilityLHPeakLoggedValue: "Pico registrado",
    advancedFertilityLHPeakDescription: (date: string) =>
      `Test de LH pico registrado el ${date}.`,
    extendedReportsTitle: "Comparación de ciclos",
    extendedReportsEmpty: "Aún no hay suficientes ciclos completos para comparar.",
    extendedReportsRow: (
      startDate: string,
      cycleLength: number,
      periodLength: number,
      comparison: "longer" | "shorter" | "variable",
    ) =>
      `${startDate} - ciclo ${cycleLength} d, período ${periodLength} d (${
        comparison === "longer"
          ? "más largo de lo habitual"
          : comparison === "shorter"
            ? "más corto de lo habitual"
            : "dentro de un patrón variable"
      })`,
    shortLutealWarningTitle: "Fase lútea corta",
    shortLutealWarningDescription: (
      averageDays: number,
      observationCount: number,
    ) =>
      `Fase lútea observada promedio ${averageDays.toFixed(1)} d en ${observationCount} ciclos recientes. Lo típico son 11-14 d. Se sugiere seguimiento clínico.`,
  },
  de: exportPDFCopyDe,
  fr: exportPDFCopyFr,
};

export function getExportPDFCopy(language: string | null | undefined) {
  return exportPDFCopyCatalog[resolveCopyLanguage(language)];
}

export const exportPDFCopy = exportPDFCopyEn;
