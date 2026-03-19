import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const statsCopyEn = {
  title: "Insights",
  subtitle: "See how your cycle length, phases, and recorded factors change over time.",
  noData: "-",
  dataNotice: "Data is still limited. The picture will sharpen as you log more cycles.",
  emptyTitle: "Keep logging to unlock insights",
  emptyBodyZero:
    "Complete 2 cycles to unlock insights. Start by entering the first day of your next period.",
  emptyBodyOne:
    "You have 1 completed cycle. Complete one more cycle to unlock insights.",
  emptyProgressHint: "Predictions become clearer after at least 2 completed cycles.",
  completedCyclesProgress: (count: number) => `Completed cycles: ${count} / 2`,
  irregularNotice: (minDays: number, maxDays: number) =>
    `Your cycles vary from ${minDays} to ${maxDays} days. This is an irregular rhythm. Predictions are approximate.`,
  irregularRecommendation: "Consider enabling irregular cycle mode in settings.",
  ageVariabilityHint: "After 35, cycle variability naturally increases.",
  lastCycleLength: "Last cycle length",
  lastPeriodLength: "Period length",
  currentPhase: "Current phase",
  predictionReliability: "Prediction reliability",
  factsOnlyTitle: "Facts only",
  factsOnlyValue: "Predictions off",
  factsOnlyHint:
    "This mode keeps the page focused on logged history rather than estimates.",
  cycleLengthCard: "Cycle length",
  cycleRange: "Range",
  averageLabel: "Average",
  medianLabel: "Median",
  cycleRangeSummary: (minDays: number, maxDays: number) =>
    `Your cycles: ${minDays} to ${maxDays} days`,
  factorContextTitle: "Recent cycle factors",
  factorContextWindow: (days: number) => `Logged in the last ${days} days.`,
  factorContextHint:
    "These tags can add context when timing feels less consistent, but they do not prove a medical cause.",
  factorPatternLabels: {
    longer: "Factors seen more often in longer cycles",
    shorter: "Factors seen more often in shorter cycles",
    variable: "Factors seen across variable cycles",
  },
  factorRecentCyclesTitle: "Recent cycle context",
  factorCycleLength: (days: number) => `${days}-day cycle`,
  factorCycleDates: (start: string, end: string) => `${start} to ${end}`,
  factorCycleKinds: {
    longer: "Longer than your usual median",
    shorter: "Shorter than your usual median",
    variable: "Within a variable pattern",
  },
  cycleTrend: "Cycle trend",
  recentCycles: "Recent cycles",
  noCycleData: "No completed cycle history yet.",
  chartActualLabel: "Actual",
  chartAverageLabel: "Average",
  symptomFrequency: "Symptom frequency",
  noSymptomData: "No logged symptom history yet.",
  lastCycleSymptomsTitle: "Last cycle symptoms",
  lastCycleSymptomsSubtitle: "What showed up most often in your last completed cycle.",
  noCycleSymptomData: "No symptom data in the last completed cycle yet.",
  symptomPatternsTitle: "Symptom patterns",
  symptomPatternsSubtitle: "Patterns from repeated symptom timing across completed cycles.",
  symptomPatternDay: (day: number) => `Usually around cycle day ${day}`,
  symptomPatternDays: (start: number, end: number) =>
    `Usually around cycle days ${start} to ${end}`,
  phaseMoodTitle: "Phase moods",
  phaseMoodSubtitle: "Average logged mood across your recorded cycle phases.",
  phaseMoodEmpty: "No mood entries in this phase yet.",
  phaseMoodCount: (count: number) => `${count} logged days`,
  phaseSymptomsTitle: "Phase symptoms",
  phaseSymptomsSubtitle: "The symptoms you logged most often in each phase.",
  phaseSymptomsEmpty: "No repeated symptom pattern in this phase yet.",
  phaseSymptomsDays: (count: number) => `${count} logged days in this phase`,
  bbtTitle: "BBT trend",
  bbtUnitCelsius: "°C",
  bbtUnitFahrenheit: "°F",
  bbtCaption:
    "BBT appears only when you track it. Readings stay local and are shown for the current cycle only.",
  reliabilityLabels: {
    early: "Early estimate",
    building: "Building pattern",
    stable: "More stable pattern",
    variable: "Variable pattern",
  },
  reliabilitySample: (count: number) => `Based on ${count} completed cycles.`,
  reliabilitySampleRecent: (count: number) =>
    `Based on the last ${count} completed cycles.`,
  reliabilityHint:
    "More completed cycles make the predicted range steadier.",
  reliabilityHintVariable:
    "Predictions may vary more when cycle length changes from cycle to cycle.",
  phaseLabels: {
    unknown: "Unknown",
    menstrual: "Menstrual",
    follicular: "Follicular",
    fertile: "Fertile",
    ovulation: "Ovulation",
    luteal: "Luteal",
  },
  phaseIcons: {
    unknown: "◌",
    menstrual: "🩸",
    follicular: "🌱",
    fertile: "✨",
    ovulation: "◉",
    luteal: "🌙",
  },
} as const;

type StatsCopy = WidenLiteral<typeof statsCopyEn>;

const statsCopyCatalog: Record<InterfaceLanguage, StatsCopy> = {
  en: statsCopyEn,
  ru: {
    title: "Инсайты",
    subtitle: "Смотрите, как со временем меняются длина цикла, фазы и записанные факторы.",
    noData: "-",
    dataNotice: "Данных пока мало. Картина станет точнее по мере записи новых циклов.",
    emptyTitle: "Продолжайте записи, чтобы открыть инсайты",
    emptyBodyZero:
      "Завершите 2 цикла, чтобы открыть инсайты. Начните с ввода первого дня следующей менструации.",
    emptyBodyOne:
      "У вас есть 1 завершённый цикл. Завершите ещё один, чтобы открыть инсайты.",
    emptyProgressHint: "Предсказания становятся точнее как минимум после 2 завершённых циклов.",
    completedCyclesProgress: (count: number) => `Завершённые циклы: ${count} / 2`,
    irregularNotice: (minDays: number, maxDays: number) =>
      `Ваши циклы варьируются от ${minDays} до ${maxDays} дней. Это нерегулярный ритм. Предсказания приблизительны.`,
    irregularRecommendation: "Подумайте о включении режима нерегулярного цикла в настройках.",
    ageVariabilityHint: "После 35 естественная вариативность цикла увеличивается.",
    lastCycleLength: "Длина последнего цикла",
    lastPeriodLength: "Длительность менструации",
    currentPhase: "Текущая фаза",
    predictionReliability: "Надёжность предсказания",
    factsOnlyTitle: "Только факты",
    factsOnlyValue: "Предсказания выключены",
    factsOnlyHint:
      "Этот режим держит страницу сфокусированной на записанной истории, а не на оценках.",
    cycleLengthCard: "Длина цикла",
    cycleRange: "Диапазон",
    averageLabel: "Среднее",
    medianLabel: "Медиана",
    cycleRangeSummary: (minDays: number, maxDays: number) =>
      `Ваши циклы: от ${minDays} до ${maxDays} дней`,
    factorContextTitle: "Недавние факторы цикла",
    factorContextWindow: (days: number) => `Отмечено за последние ${days} дней.`,
    factorContextHint:
      "Эти теги добавляют контекст, когда тайминг кажется менее стабильным, но не доказывают медицинскую причину.",
    factorPatternLabels: {
      longer: "Факторы, чаще встречающиеся в более длинных циклах",
      shorter: "Факторы, чаще встречающиеся в более коротких циклах",
      variable: "Факторы, встречающиеся при вариативных циклах",
    },
    factorRecentCyclesTitle: "Контекст последних циклов",
    factorCycleLength: (days: number) => `Цикл ${days} дней`,
    factorCycleDates: (start: string, end: string) => `${start} — ${end}`,
    factorCycleKinds: {
      longer: "Длиннее вашей обычной медианы",
      shorter: "Короче вашей обычной медианы",
      variable: "В пределах вариативного паттерна",
    },
    cycleTrend: "Тренд цикла",
    recentCycles: "Последние циклы",
    noCycleData: "Пока нет истории завершённых циклов.",
    chartActualLabel: "Факт",
    chartAverageLabel: "Среднее",
    symptomFrequency: "Частота симптомов",
    noSymptomData: "Пока нет истории записанных симптомов.",
    lastCycleSymptomsTitle: "Симптомы последнего цикла",
    lastCycleSymptomsSubtitle: "Что чаще всего встречалось в вашем последнем завершённом цикле.",
    noCycleSymptomData: "В последнем завершённом цикле пока нет данных о симптомах.",
    symptomPatternsTitle: "Паттерны симптомов",
    symptomPatternsSubtitle: "Паттерны из повторяющегося тайминга симптомов в завершённых циклах.",
    symptomPatternDay: (day: number) => `Обычно около ${day}-го дня цикла`,
    symptomPatternDays: (start: number, end: number) =>
      `Обычно около ${start}-${end}-го дней цикла`,
    phaseMoodTitle: "Настроение по фазам",
    phaseMoodSubtitle: "Среднее записанное настроение по фазам цикла.",
    phaseMoodEmpty: "Для этой фазы пока нет записей настроения.",
    phaseMoodCount: (count: number) => `${count} записанных дней`,
    phaseSymptomsTitle: "Симптомы по фазам",
    phaseSymptomsSubtitle: "Симптомы, которые вы чаще всего отмечали в каждой фазе.",
    phaseSymptomsEmpty: "Для этой фазы пока нет повторяющегося паттерна симптомов.",
    phaseSymptomsDays: (count: number) => `${count} записанных дней в этой фазе`,
    bbtTitle: "Тренд БТТ",
    bbtUnitCelsius: "°C",
    bbtUnitFahrenheit: "°F",
    bbtCaption:
      "БТТ появляется только когда вы её отслеживаете. Показания остаются локальными и показываются только для текущего цикла.",
    reliabilityLabels: {
      early: "Ранняя оценка",
      building: "Паттерн формируется",
      stable: "Более стабильный паттерн",
      variable: "Вариативный паттерн",
    },
    reliabilitySample: (count: number) => `Основано на ${count} завершённых циклах.`,
    reliabilitySampleRecent: (count: number) =>
      `Основано на последних ${count} завершённых циклах.`,
    reliabilityHint:
      "Чем больше завершённых циклов, тем стабильнее становится предсказанный диапазон.",
    reliabilityHintVariable:
      "Предсказания могут сильнее колебаться, когда длина цикла меняется от цикла к циклу.",
    phaseLabels: {
      unknown: "Неизвестно",
      menstrual: "Менструальная",
      follicular: "Фолликулярная",
      fertile: "Фертильная",
      ovulation: "Овуляция",
      luteal: "Лютеиновая",
    },
    phaseIcons: statsCopyEn.phaseIcons,
  },
  es: {
    title: "Insights",
    subtitle: "Observa cómo cambian con el tiempo la duración del ciclo, las fases y los factores registrados.",
    noData: "-",
    dataNotice: "Todavía hay pocos datos. La imagen será más clara a medida que registres más ciclos.",
    emptyTitle: "Sigue registrando para desbloquear insights",
    emptyBodyZero:
      "Completa 2 ciclos para desbloquear insights. Empieza introduciendo el primer día de tu próximo período.",
    emptyBodyOne:
      "Tienes 1 ciclo completado. Completa uno más para desbloquear insights.",
    emptyProgressHint: "Las predicciones se vuelven más claras tras al menos 2 ciclos completos.",
    completedCyclesProgress: (count: number) => `Ciclos completados: ${count} / 2`,
    irregularNotice: (minDays: number, maxDays: number) =>
      `Tus ciclos varían entre ${minDays} y ${maxDays} días. Es un ritmo irregular. Las predicciones son aproximadas.`,
    irregularRecommendation: "Considera activar el modo de ciclo irregular en ajustes.",
    ageVariabilityHint: "Después de los 35, la variabilidad del ciclo aumenta de forma natural.",
    lastCycleLength: "Duración del último ciclo",
    lastPeriodLength: "Duración del período",
    currentPhase: "Fase actual",
    predictionReliability: "Fiabilidad de la predicción",
    factsOnlyTitle: "Solo hechos",
    factsOnlyValue: "Predicciones desactivadas",
    factsOnlyHint:
      "Este modo mantiene la página centrada en el historial registrado y no en estimaciones.",
    cycleLengthCard: "Duración del ciclo",
    cycleRange: "Rango",
    averageLabel: "Promedio",
    medianLabel: "Mediana",
    cycleRangeSummary: (minDays: number, maxDays: number) =>
      `Tus ciclos: de ${minDays} a ${maxDays} días`,
    factorContextTitle: "Factores recientes del ciclo",
    factorContextWindow: (days: number) => `Registrado en los últimos ${days} días.`,
    factorContextHint:
      "Estas etiquetas pueden añadir contexto cuando el ritmo es menos constante, pero no prueban una causa médica.",
    factorPatternLabels: {
      longer: "Factores vistos más a menudo en ciclos más largos",
      shorter: "Factores vistos más a menudo en ciclos más cortos",
      variable: "Factores vistos en ciclos variables",
    },
    factorRecentCyclesTitle: "Contexto de ciclos recientes",
    factorCycleLength: (days: number) => `Ciclo de ${days} días`,
    factorCycleDates: (start: string, end: string) => `${start} a ${end}`,
    factorCycleKinds: {
      longer: "Más largo que tu mediana habitual",
      shorter: "Más corto que tu mediana habitual",
      variable: "Dentro de un patrón variable",
    },
    cycleTrend: "Tendencia del ciclo",
    recentCycles: "Ciclos recientes",
    noCycleData: "Todavía no hay historial de ciclos completos.",
    chartActualLabel: "Real",
    chartAverageLabel: "Promedio",
    symptomFrequency: "Frecuencia de síntomas",
    noSymptomData: "Todavía no hay historial de síntomas registrados.",
    lastCycleSymptomsTitle: "Síntomas del último ciclo",
    lastCycleSymptomsSubtitle: "Lo que apareció con más frecuencia en tu último ciclo completo.",
    noCycleSymptomData: "Todavía no hay datos de síntomas en el último ciclo completo.",
    symptomPatternsTitle: "Patrones de síntomas",
    symptomPatternsSubtitle: "Patrones a partir del momento repetido de los síntomas en ciclos completos.",
    symptomPatternDay: (day: number) => `Normalmente alrededor del día ${day} del ciclo`,
    symptomPatternDays: (start: number, end: number) =>
      `Normalmente alrededor de los días ${start} a ${end} del ciclo`,
    phaseMoodTitle: "Ánimo por fases",
    phaseMoodSubtitle: "Promedio de ánimo registrado en las fases del ciclo.",
    phaseMoodEmpty: "Todavía no hay entradas de ánimo en esta fase.",
    phaseMoodCount: (count: number) => `${count} días registrados`,
    phaseSymptomsTitle: "Síntomas por fases",
    phaseSymptomsSubtitle: "Los síntomas que registraste con más frecuencia en cada fase.",
    phaseSymptomsEmpty: "Todavía no hay un patrón repetido de síntomas en esta fase.",
    phaseSymptomsDays: (count: number) => `${count} días registrados en esta fase`,
    bbtTitle: "Tendencia de TCB",
    bbtUnitCelsius: "°C",
    bbtUnitFahrenheit: "°F",
    bbtCaption:
      "La TCB aparece solo cuando la registras. Las lecturas siguen siendo locales y se muestran solo para el ciclo actual.",
    reliabilityLabels: {
      early: "Estimación temprana",
      building: "Patrón en construcción",
      stable: "Patrón más estable",
      variable: "Patrón variable",
    },
    reliabilitySample: (count: number) => `Basado en ${count} ciclos completos.`,
    reliabilitySampleRecent: (count: number) =>
      `Basado en los últimos ${count} ciclos completos.`,
    reliabilityHint:
      "Cuantos más ciclos completos haya, más estable será el rango previsto.",
    reliabilityHintVariable:
      "Las predicciones pueden variar más cuando la duración del ciclo cambia de un ciclo a otro.",
    phaseLabels: {
      unknown: "Desconocida",
      menstrual: "Menstrual",
      follicular: "Folicular",
      fertile: "Fértil",
      ovulation: "Ovulación",
      luteal: "Lútea",
    },
    phaseIcons: statsCopyEn.phaseIcons,
  },
};

export function getStatsCopy(language: string | null | undefined) {
  return statsCopyCatalog[resolveCopyLanguage(language)];
}

export const statsCopy = statsCopyEn;
