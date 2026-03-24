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

const statsCopyDe: StatsCopy = {
  title: "Einblicke",
  subtitle:
    "Sieh, wie sich Zykluslänge, Phasen und erfasste Faktoren im Laufe der Zeit verändern.",
  noData: "-",
  dataNotice:
    "Es gibt noch wenige Daten. Das Bild wird klarer, je mehr Zyklen du erfasst.",
  emptyTitle: "Erfasse weiter, um Einblicke freizuschalten",
  emptyBodyZero:
    "Schließe 2 Zyklen ab, um Einblicke freizuschalten. Beginne damit, den ersten Tag deiner nächsten Periode einzugeben.",
  emptyBodyOne:
    "Du hast 1 abgeschlossenen Zyklus. Schließe noch einen ab, um Einblicke freizuschalten.",
  emptyProgressHint:
    "Vorhersagen werden nach mindestens 2 abgeschlossenen Zyklen klarer.",
  completedCyclesProgress: (count: number) => `Abgeschlossene Zyklen: ${count} / 2`,
  irregularNotice: (minDays: number, maxDays: number) =>
    `Deine Zyklen schwanken zwischen ${minDays} und ${maxDays} Tagen. Das ist ein unregelmäßiger Rhythmus. Vorhersagen sind nur ungefähr.`,
  irregularRecommendation:
    "Erwäge, den Modus für unregelmäßige Zyklen in den Einstellungen zu aktivieren.",
  ageVariabilityHint:
    "Nach 35 nimmt die Zyklusvariabilität auf natürliche Weise zu.",
  lastCycleLength: "Länge des letzten Zyklus",
  lastPeriodLength: "Periodendauer",
  currentPhase: "Aktuelle Phase",
  predictionReliability: "Zuverlässigkeit der Vorhersage",
  factsOnlyTitle: "Nur Fakten",
  factsOnlyValue: "Vorhersagen aus",
  factsOnlyHint:
    "In diesem Modus konzentriert sich die Seite auf deinen erfassten Verlauf statt auf Schätzungen.",
  cycleLengthCard: "Zykluslänge",
  cycleRange: "Bereich",
  averageLabel: "Durchschnitt",
  medianLabel: "Median",
  cycleRangeSummary: (minDays: number, maxDays: number) =>
    `Deine Zyklen: ${minDays} bis ${maxDays} Tage`,
  factorContextTitle: "Jüngste Zyklusfaktoren",
  factorContextWindow: (days: number) =>
    `In den letzten ${days} Tagen erfasst.`,
  factorContextHint:
    "Diese Tags können Kontext geben, wenn sich der Zyklus weniger konstant anfühlt, beweisen aber keine medizinische Ursache.",
  factorPatternLabels: {
    longer: "Faktoren, die häufiger in längeren Zyklen vorkommen",
    shorter: "Faktoren, die häufiger in kürzeren Zyklen vorkommen",
    variable: "Faktoren, die in variablen Zyklen vorkommen",
  },
  factorRecentCyclesTitle: "Kontext der letzten Zyklen",
  factorCycleLength: (days: number) => `${days}-Tage-Zyklus`,
  factorCycleDates: (start: string, end: string) => `${start} bis ${end}`,
  factorCycleKinds: {
    longer: "Länger als dein üblicher Median",
    shorter: "Kürzer als dein üblicher Median",
    variable: "Innerhalb eines variablen Musters",
  },
  cycleTrend: "Zyklustrend",
  recentCycles: "Letzte Zyklen",
  noCycleData: "Es gibt noch keinen abgeschlossenen Zyklusverlauf.",
  chartActualLabel: "Tatsächlich",
  chartAverageLabel: "Durchschnitt",
  symptomFrequency: "Symptomhäufigkeit",
  noSymptomData: "Es gibt noch keinen erfassten Symptomverlauf.",
  lastCycleSymptomsTitle: "Symptome im letzten Zyklus",
  lastCycleSymptomsSubtitle:
    "Was in deinem letzten abgeschlossenen Zyklus am häufigsten aufgetreten ist.",
  noCycleSymptomData:
    "Im letzten abgeschlossenen Zyklus gibt es noch keine Symptomdaten.",
  symptomPatternsTitle: "Symptommuster",
  symptomPatternsSubtitle:
    "Muster aus wiederkehrendem Symptom-Timing über abgeschlossene Zyklen hinweg.",
  symptomPatternDay: (day: number) => `Meist um den ${day}. Zyklustag`,
  symptomPatternDays: (start: number, end: number) =>
    `Meist um die Zyklustage ${start} bis ${end}`,
  phaseMoodTitle: "Stimmung nach Phase",
  phaseMoodSubtitle:
    "Durchschnittlich erfasste Stimmung über deine Zyklusphasen hinweg.",
  phaseMoodEmpty: "Für diese Phase gibt es noch keine Stimmungseinträge.",
  phaseMoodCount: (count: number) => `${count} erfasste Tage`,
  phaseSymptomsTitle: "Symptome nach Phase",
  phaseSymptomsSubtitle:
    "Die Symptome, die du in jeder Phase am häufigsten erfasst hast.",
  phaseSymptomsEmpty:
    "Für diese Phase gibt es noch kein wiederkehrendes Symptommuster.",
  phaseSymptomsDays: (count: number) => `${count} erfasste Tage in dieser Phase`,
  bbtTitle: "BBT-Trend",
  bbtUnitCelsius: "°C",
  bbtUnitFahrenheit: "°F",
  bbtCaption:
    "BBT erscheint nur, wenn du sie erfasst. Die Werte bleiben lokal und werden nur für den aktuellen Zyklus angezeigt.",
  reliabilityLabels: {
    early: "Frühe Schätzung",
    building: "Muster entsteht",
    stable: "Stabileres Muster",
    variable: "Variables Muster",
  },
  reliabilitySample: (count: number) =>
    `Basierend auf ${count} abgeschlossenen Zyklen.`,
  reliabilitySampleRecent: (count: number) =>
    `Basierend auf den letzten ${count} abgeschlossenen Zyklen.`,
  reliabilityHint:
    "Mehr abgeschlossene Zyklen machen den vorhergesagten Bereich stabiler.",
  reliabilityHintVariable:
    "Vorhersagen können stärker schwanken, wenn sich die Zykluslänge von Zyklus zu Zyklus verändert.",
  phaseLabels: {
    unknown: "Unbekannt",
    menstrual: "Menstruell",
    follicular: "Follikulär",
    fertile: "Fruchtbar",
    ovulation: "Eisprung",
    luteal: "Luteal",
  },
  phaseIcons: statsCopyEn.phaseIcons,
};

const statsCopyFr: StatsCopy = {
  title: "Analyses",
  subtitle:
    "Observe comment la durée du cycle, les phases et les facteurs enregistrés évoluent au fil du temps.",
  noData: "-",
  dataNotice:
    "Les données sont encore limitées. La vue d'ensemble sera plus nette à mesure que tu enregistres plus de cycles.",
  emptyTitle: "Continue à enregistrer pour débloquer les analyses",
  emptyBodyZero:
    "Complète 2 cycles pour débloquer les analyses. Commence par saisir le premier jour de tes prochaines règles.",
  emptyBodyOne:
    "Tu as 1 cycle terminé. Termine-en un autre pour débloquer les analyses.",
  emptyProgressHint:
    "Les prédictions deviennent plus claires après au moins 2 cycles terminés.",
  completedCyclesProgress: (count: number) => `Cycles terminés : ${count} / 2`,
  irregularNotice: (minDays: number, maxDays: number) =>
    `Tes cycles varient entre ${minDays} et ${maxDays} jours. C'est un rythme irrégulier. Les prédictions restent approximatives.`,
  irregularRecommendation:
    "Pense à activer le mode cycle irrégulier dans les réglages.",
  ageVariabilityHint:
    "Après 35 ans, la variabilité du cycle augmente naturellement.",
  lastCycleLength: "Durée du dernier cycle",
  lastPeriodLength: "Durée des règles",
  currentPhase: "Phase actuelle",
  predictionReliability: "Fiabilité de la prédiction",
  factsOnlyTitle: "Seulement les faits",
  factsOnlyValue: "Prédictions désactivées",
  factsOnlyHint:
    "Ce mode garde la page centrée sur l'historique enregistré plutôt que sur des estimations.",
  cycleLengthCard: "Durée du cycle",
  cycleRange: "Plage",
  averageLabel: "Moyenne",
  medianLabel: "Médiane",
  cycleRangeSummary: (minDays: number, maxDays: number) =>
    `Tes cycles : de ${minDays} à ${maxDays} jours`,
  factorContextTitle: "Facteurs récents du cycle",
  factorContextWindow: (days: number) =>
    `Enregistrés au cours des ${days} derniers jours.`,
  factorContextHint:
    "Ces étiquettes peuvent apporter du contexte quand le rythme semble moins régulier, mais elles ne prouvent pas une cause médicale.",
  factorPatternLabels: {
    longer: "Facteurs vus plus souvent dans les cycles plus longs",
    shorter: "Facteurs vus plus souvent dans les cycles plus courts",
    variable: "Facteurs vus dans des cycles variables",
  },
  factorRecentCyclesTitle: "Contexte des cycles récents",
  factorCycleLength: (days: number) => `Cycle de ${days} jours`,
  factorCycleDates: (start: string, end: string) => `${start} à ${end}`,
  factorCycleKinds: {
    longer: "Plus long que ta médiane habituelle",
    shorter: "Plus court que ta médiane habituelle",
    variable: "Dans un schéma variable",
  },
  cycleTrend: "Tendance du cycle",
  recentCycles: "Cycles récents",
  noCycleData: "Pas encore d'historique de cycles terminés.",
  chartActualLabel: "Réel",
  chartAverageLabel: "Moyenne",
  symptomFrequency: "Fréquence des symptômes",
  noSymptomData: "Pas encore d'historique de symptômes enregistrés.",
  lastCycleSymptomsTitle: "Symptômes du dernier cycle",
  lastCycleSymptomsSubtitle:
    "Ce qui est apparu le plus souvent dans ton dernier cycle terminé.",
  noCycleSymptomData:
    "Pas encore de données de symptômes dans le dernier cycle terminé.",
  symptomPatternsTitle: "Schémas des symptômes",
  symptomPatternsSubtitle:
    "Schémas issus du moment récurrent des symptômes à travers les cycles terminés.",
  symptomPatternDay: (day: number) =>
    `Habituellement autour du jour ${day} du cycle`,
  symptomPatternDays: (start: number, end: number) =>
    `Habituellement autour des jours ${start} à ${end} du cycle`,
  phaseMoodTitle: "Humeur selon la phase",
  phaseMoodSubtitle:
    "Humeur moyenne enregistrée selon les phases de ton cycle.",
  phaseMoodEmpty: "Aucune entrée d'humeur pour cette phase pour le moment.",
  phaseMoodCount: (count: number) => `${count} jours enregistrés`,
  phaseSymptomsTitle: "Symptômes selon la phase",
  phaseSymptomsSubtitle:
    "Les symptômes que tu as le plus souvent enregistrés dans chaque phase.",
  phaseSymptomsEmpty:
    "Pas encore de schéma répété de symptômes dans cette phase.",
  phaseSymptomsDays: (count: number) =>
    `${count} jours enregistrés dans cette phase`,
  bbtTitle: "Tendance TBC",
  bbtUnitCelsius: "°C",
  bbtUnitFahrenheit: "°F",
  bbtCaption:
    "La TBC apparaît seulement quand tu la suis. Les mesures restent locales et ne sont affichées que pour le cycle en cours.",
  reliabilityLabels: {
    early: "Estimation précoce",
    building: "Schéma en cours",
    stable: "Schéma plus stable",
    variable: "Schéma variable",
  },
  reliabilitySample: (count: number) =>
    `Basé sur ${count} cycles terminés.`,
  reliabilitySampleRecent: (count: number) =>
    `Basé sur les ${count} derniers cycles terminés.`,
  reliabilityHint:
    "Plus il y a de cycles terminés, plus la plage prédite devient stable.",
  reliabilityHintVariable:
    "Les prédictions peuvent varier davantage quand la durée du cycle change d'un cycle à l'autre.",
  phaseLabels: {
    unknown: "Inconnue",
    menstrual: "Menstruelle",
    follicular: "Folliculaire",
    fertile: "Fertile",
    ovulation: "Ovulation",
    luteal: "Lutéale",
  },
  phaseIcons: statsCopyEn.phaseIcons,
};

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
  de: statsCopyDe,
  fr: statsCopyFr,
};

export function getStatsCopy(language: string | null | undefined) {
  return statsCopyCatalog[resolveCopyLanguage(language)];
}

export const statsCopy = statsCopyEn;
