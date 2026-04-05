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
  emptyActionLabel: "Log today to speed this up",
  completedCyclesProgress: (count: number) => `Cycle ${count} of 2 completed`,
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
  mucusFertilityTitle: "High fertility",
  mucusFertilityValue: "Mucus signal",
  mucusFertilityDescription: (date: string) =>
    `Egg-white mucus was logged on ${date}.`,
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
  advancedInsights: {
    title: "Advanced insights",
    subtitle: "Premium patterns derived only from your recent local cycle history.",
    weightedAverageTitle: "Weighted average",
    weightedAverageDescription: (count: number) =>
      `Recent cycles are weighted toward your last ${count} completed cycles.`,
    patternDriftTitle: "Pattern drift",
    patternDriftStableValue: "Stable rhythm",
    patternDriftDriftingValue: "Drifting",
    patternDriftStrongValue: "Strong drift",
    patternDriftStableDescription: (recent: number, baseline: number) =>
      `Recent average ${recent.toFixed(1)} d vs baseline ${baseline.toFixed(1)} d.`,
    patternDriftDescription: (
      delta: number,
      recent: number,
      baseline: number,
    ) =>
      `Recent average ${recent.toFixed(1)} d vs baseline ${baseline.toFixed(1)} d (${delta > 0 ? "+" : ""}${delta.toFixed(1)} d).`,
    anomalousCycleTitle: "Anomalous cycle",
    anomalousCycleLongerValue: "Longer than usual",
    anomalousCycleShorterValue: "Shorter than usual",
    anomalousCycleDescription: (
      cycleLength: number,
      baselineLength: number,
      deltaDays: number,
    ) =>
      `Last completed cycle ${cycleLength} d vs expected ${baselineLength.toFixed(1)} d (${deltaDays > 0 ? "+" : ""}${deltaDays.toFixed(1)} d).`,
    daysValue: (value: string) => `${value} d`,
  },
  advancedFertility: {
    title: "Advanced fertility",
    subtitle:
      "Premium fertility signals derived from your local BBT and cervical mucus history.",
    observedLutealTitle: "Observed luteal phase",
    observedLutealDescription: (count: number, value: string) =>
      `Signal-derived average from ${count} recent cycles: ${value} d.`,
    signalCoverageTitle: "Signal coverage",
    signalCoverageValue: (count: number, total: number) => `${count}/${total} cycles`,
    signalCoverageDescription: (count: number, total: number) =>
      `Fertile-quality mucus or a thermal rise appeared in ${count} of your last ${total} completed cycles.`,
    thermalShiftTitle: "Thermal shift",
    thermalShiftConfirmedValue: "Confirmed",
    thermalShiftBuildingValue: "Building",
    thermalShiftConfirmedDescription: (
      rise: string,
      unit: string,
      count: number,
    ) => `Current cycle shows a sustained +${rise} ${unit} rise across ${count} readings.`,
    thermalShiftBuildingDescription: (
      rise: string,
      unit: string,
      count: number,
    ) => `A possible +${rise} ${unit} rise is forming across ${count} readings.`,
    daysValue: (value: string) => `${value} d`,
  },
  personalForecasts: {
    title: "Personal forecasts",
    subtitle:
      "Premium hints about what your repeated symptom timing may suggest next.",
    aroundNowValue: "Around now",
    inDaysValue: (days: number) => (days === 1 ? "In 1 day" : `In ${days} days`),
    inDayRangeValue: (start: number, end: number) => `In ${start}-${end} days`,
    descriptionSingle: (day: number) => `Usually around cycle day ${day}.`,
    descriptionRange: (start: number, end: number) =>
      `Usually around cycle days ${start}-${end}.`,
  },
  extendedReports: {
    title: "Extended reports",
    subtitle: "Compare recent completed cycles side by side.",
    summary: (count: number, minDays: number, maxDays: number) =>
      `Showing ${count} completed cycles. Range ${minDays}-${maxDays} d.`,
    rowTitle: (date: string) => `Started ${date}`,
    cycleLengthLabel: (days: number) => `Cycle ${days} d`,
    periodLengthLabel: (days: number) => `Period ${days} d`,
    comparisonLabels: {
      longer: "Longer than your usual pattern",
      shorter: "Shorter than your usual pattern",
      variable: "Within a variable pattern",
    },
  },
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
  emptyActionLabel: "Heute eintragen, damit es schneller geht",
  completedCyclesProgress: (count: number) => `Zyklus ${count} von 2 abgeschlossen`,
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
  mucusFertilityTitle: "Hohe Fruchtbarkeit",
  mucusFertilityValue: "Schleim-Signal",
  mucusFertilityDescription: (date: string) =>
    `Eiweißartiger Schleim wurde am ${date} erfasst.`,
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
  advancedInsights: {
    title: "Erweiterte Analysen",
    subtitle: "Premium-Muster nur aus deinem lokalen Zyklusverlauf der letzten Zyklen.",
    weightedAverageTitle: "Gewichteter Durchschnitt",
    weightedAverageDescription: (count: number) =>
      `Neuere Zyklen zählen stärker, basierend auf den letzten ${count} abgeschlossenen Zyklen.`,
    patternDriftTitle: "Musterdrift",
    patternDriftStableValue: "Stabiler Rhythmus",
    patternDriftDriftingValue: "Leichte Drift",
    patternDriftStrongValue: "Starke Drift",
    patternDriftStableDescription: (recent: number, baseline: number) =>
      `Jüngster Durchschnitt ${recent.toFixed(1)} T. gegenüber Basis ${baseline.toFixed(1)} T.`,
    patternDriftDescription: (
      delta: number,
      recent: number,
      baseline: number,
    ) =>
      `Jüngster Durchschnitt ${recent.toFixed(1)} T. gegenüber Basis ${baseline.toFixed(1)} T. (${delta > 0 ? "+" : ""}${delta.toFixed(1)} T.).`,
    anomalousCycleTitle: "Auffälliger Zyklus",
    anomalousCycleLongerValue: "Länger als üblich",
    anomalousCycleShorterValue: "Kürzer als üblich",
    anomalousCycleDescription: (
      cycleLength: number,
      baselineLength: number,
      deltaDays: number,
    ) =>
      `Letzter abgeschlossener Zyklus ${cycleLength} T. statt erwarteter ${baselineLength.toFixed(1)} T. (${deltaDays > 0 ? "+" : ""}${deltaDays.toFixed(1)} T.).`,
    daysValue: (value: string) => `${value} T.`,
  },
  advancedFertility: {
    title: "Erweiterte Fruchtbarkeit",
    subtitle:
      "Premium-Fruchtbarkeitssignale aus deinem lokalen BBT- und Zervixschleim-Verlauf.",
    observedLutealTitle: "Beobachtete Lutealphase",
    observedLutealDescription: (count: number, value: string) =>
      `Signalbasierter Durchschnitt aus ${count} letzten Zyklen: ${value} T.`,
    signalCoverageTitle: "Signalabdeckung",
    signalCoverageValue: (count: number, total: number) => `${count}/${total} Zyklen`,
    signalCoverageDescription: (count: number, total: number) =>
      `Fruchtbarer Schleim oder ein Temperaturanstieg erschien in ${count} deiner letzten ${total} abgeschlossenen Zyklen.`,
    thermalShiftTitle: "Temperaturanstieg",
    thermalShiftConfirmedValue: "Bestätigt",
    thermalShiftBuildingValue: "Im Aufbau",
    thermalShiftConfirmedDescription: (
      rise: string,
      unit: string,
      count: number,
    ) => `Der aktuelle Zyklus zeigt einen stabilen Anstieg von +${rise} ${unit} über ${count} Messungen.`,
    thermalShiftBuildingDescription: (
      rise: string,
      unit: string,
      count: number,
    ) => `Ein möglicher Anstieg von +${rise} ${unit} zeichnet sich über ${count} Messungen ab.`,
    daysValue: (value: string) => `${value} T.`,
  },
  personalForecasts: {
    title: "Persönliche Vorhersagen",
    subtitle:
      "Premium-Hinweise dazu, was dein wiederkehrendes Symptom-Timing als Nächstes andeutet.",
    aroundNowValue: "Etwa jetzt",
    inDaysValue: (days: number) => (days === 1 ? "In 1 Tag" : `In ${days} Tagen`),
    inDayRangeValue: (start: number, end: number) => `In ${start}-${end} Tagen`,
    descriptionSingle: (day: number) => `Meist um Zyklustag ${day}.`,
    descriptionRange: (start: number, end: number) =>
      `Meist um die Zyklustage ${start}-${end}.`,
  },
  extendedReports: {
    title: "Erweiterte Berichte",
    subtitle: "Vergleiche deine letzten abgeschlossenen Zyklen nebeneinander.",
    summary: (count: number, minDays: number, maxDays: number) =>
      `${count} abgeschlossene Zyklen. Bereich ${minDays}-${maxDays} T.`,
    rowTitle: (date: string) => `Beginn ${date}`,
    cycleLengthLabel: (days: number) => `Zyklus ${days} T.`,
    periodLengthLabel: (days: number) => `Periode ${days} T.`,
    comparisonLabels: {
      longer: "Länger als dein übliches Muster",
      shorter: "Kürzer als dein übliches Muster",
      variable: "Innerhalb eines variablen Musters",
    },
  },
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
  emptyActionLabel: "Noter aujourd'hui pour aller plus vite",
  completedCyclesProgress: (count: number) => `Cycle ${count} sur 2 terminé`,
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
  mucusFertilityTitle: "Fertilité élevée",
  mucusFertilityValue: "Signal de glaire",
  mucusFertilityDescription: (date: string) =>
    `Une glaire type blanc d'œuf a été enregistrée le ${date}.`,
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
  advancedInsights: {
    title: "Analyses avancées",
    subtitle: "Schémas premium calculés uniquement à partir de ton historique local récent.",
    weightedAverageTitle: "Moyenne pondérée",
    weightedAverageDescription: (count: number) =>
      `Les cycles récents comptent davantage sur les ${count} derniers cycles terminés.`,
    patternDriftTitle: "Dérive du schéma",
    patternDriftStableValue: "Rythme stable",
    patternDriftDriftingValue: "Dérive légère",
    patternDriftStrongValue: "Dérive marquée",
    patternDriftStableDescription: (recent: number, baseline: number) =>
      `Moyenne récente ${recent.toFixed(1)} j contre base ${baseline.toFixed(1)} j.`,
    patternDriftDescription: (
      delta: number,
      recent: number,
      baseline: number,
    ) =>
      `Moyenne récente ${recent.toFixed(1)} j contre base ${baseline.toFixed(1)} j (${delta > 0 ? "+" : ""}${delta.toFixed(1)} j).`,
    anomalousCycleTitle: "Cycle inhabituel",
    anomalousCycleLongerValue: "Plus long que d'habitude",
    anomalousCycleShorterValue: "Plus court que d'habitude",
    anomalousCycleDescription: (
      cycleLength: number,
      baselineLength: number,
      deltaDays: number,
    ) =>
      `Dernier cycle terminé ${cycleLength} j au lieu de ${baselineLength.toFixed(1)} j attendus (${deltaDays > 0 ? "+" : ""}${deltaDays.toFixed(1)} j).`,
    daysValue: (value: string) => `${value} j`,
  },
  advancedFertility: {
    title: "Fertilité avancée",
    subtitle:
      "Signaux premium de fertilité issus de ton historique local de TBC et de glaire cervicale.",
    observedLutealTitle: "Phase lutéale observée",
    observedLutealDescription: (count: number, value: string) =>
      `Moyenne dérivée du signal sur ${count} cycles récents : ${value} j.`,
    signalCoverageTitle: "Couverture des signaux",
    signalCoverageValue: (count: number, total: number) => `${count}/${total} cycles`,
    signalCoverageDescription: (count: number, total: number) =>
      `Une glaire fertile ou une hausse thermique est apparue dans ${count} de tes ${total} derniers cycles terminés.`,
    thermalShiftTitle: "Hausse thermique",
    thermalShiftConfirmedValue: "Confirmée",
    thermalShiftBuildingValue: "En cours",
    thermalShiftConfirmedDescription: (
      rise: string,
      unit: string,
      count: number,
    ) => `Le cycle actuel montre une hausse stable de +${rise} ${unit} sur ${count} mesures.`,
    thermalShiftBuildingDescription: (
      rise: string,
      unit: string,
      count: number,
    ) => `Une possible hausse de +${rise} ${unit} se forme sur ${count} mesures.`,
    daysValue: (value: string) => `${value} j`,
  },
  personalForecasts: {
    title: "Prévisions personnelles",
    subtitle:
      "Indices premium sur ce que le timing répété de tes symptômes peut annoncer ensuite.",
    aroundNowValue: "Autour de maintenant",
    inDaysValue: (days: number) => (days === 1 ? "Dans 1 jour" : `Dans ${days} jours`),
    inDayRangeValue: (start: number, end: number) => `Dans ${start}-${end} jours`,
    descriptionSingle: (day: number) =>
      `Habituellement vers le jour ${day} du cycle.`,
    descriptionRange: (start: number, end: number) =>
      `Habituellement vers les jours ${start}-${end} du cycle.`,
  },
  extendedReports: {
    title: "Rapports étendus",
    subtitle: "Compare tes derniers cycles terminés côte à côte.",
    summary: (count: number, minDays: number, maxDays: number) =>
      `${count} cycles terminés. Plage ${minDays}-${maxDays} j.`,
    rowTitle: (date: string) => `Début ${date}`,
    cycleLengthLabel: (days: number) => `Cycle ${days} j`,
    periodLengthLabel: (days: number) => `Règles ${days} j`,
    comparisonLabels: {
      longer: "Plus long que ton schéma habituel",
      shorter: "Plus court que ton schéma habituel",
      variable: "Dans un schéma variable",
    },
  },
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
    emptyActionLabel: "Записать сегодня, чтобы открыть быстрее",
    completedCyclesProgress: (count: number) => `Завершён цикл ${count} из 2`,
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
    mucusFertilityTitle: "Высокая фертильность",
    mucusFertilityValue: "Сигнал по слизи",
    mucusFertilityDescription: (date: string) =>
      `Слизь как яичный белок была отмечена ${date}.`,
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
    advancedInsights: {
      title: "Продвинутые инсайты",
      subtitle: "Премиум-паттерны, рассчитанные только по вашей недавней локальной истории циклов.",
      weightedAverageTitle: "Взвешенное среднее",
      weightedAverageDescription: (count: number) =>
        `Последние ${count} завершённых циклов имеют больший вес.`,
      patternDriftTitle: "Дрейф паттерна",
      patternDriftStableValue: "Стабильный ритм",
      patternDriftDriftingValue: "Есть дрейф",
      patternDriftStrongValue: "Сильный дрейф",
      patternDriftStableDescription: (recent: number, baseline: number) =>
        `Недавнее среднее ${recent.toFixed(1)} д. против базового ${baseline.toFixed(1)} д.`,
      patternDriftDescription: (
        delta: number,
        recent: number,
        baseline: number,
      ) =>
        `Недавнее среднее ${recent.toFixed(1)} д. против базового ${baseline.toFixed(1)} д. (${delta > 0 ? "+" : ""}${delta.toFixed(1)} д.).`,
      anomalousCycleTitle: "Аномальный цикл",
      anomalousCycleLongerValue: "Длиннее обычного",
      anomalousCycleShorterValue: "Короче обычного",
    anomalousCycleDescription: (
      cycleLength: number,
      baselineLength: number,
      deltaDays: number,
    ) =>
      `Последний завершённый цикл ${cycleLength} д. вместо ожидаемых ${baselineLength.toFixed(1)} д. (${deltaDays > 0 ? "+" : ""}${deltaDays.toFixed(1)} д.).`,
    daysValue: (value: string) => `${value} д.`,
  },
    advancedFertility: {
      title: "Продвинутая фертильность",
      subtitle:
        "Премиальные сигналы фертильности на основе локальной истории БТТ и цервикальной слизи.",
      observedLutealTitle: "Наблюдаемая лютеиновая фаза",
      observedLutealDescription: (count: number, value: string) =>
        `Среднее по сигналам за последние ${count} циклов: ${value} д.`,
      signalCoverageTitle: "Покрытие сигналами",
      signalCoverageValue: (count: number, total: number) => `${count}/${total} циклов`,
      signalCoverageDescription: (count: number, total: number) =>
        `Фертильная слизь или температурный подъём были в ${count} из последних ${total} завершённых циклов.`,
      thermalShiftTitle: "Температурный подъём",
      thermalShiftConfirmedValue: "Подтверждён",
      thermalShiftBuildingValue: "Формируется",
      thermalShiftConfirmedDescription: (
        rise: string,
        unit: string,
        count: number,
      ) => `Текущий цикл показывает устойчивый подъём на +${rise} ${unit} по ${count} измерениям.`,
      thermalShiftBuildingDescription: (
        rise: string,
        unit: string,
        count: number,
      ) => `В текущем цикле формируется возможный подъём на +${rise} ${unit} по ${count} измерениям.`,
      daysValue: (value: string) => `${value} д.`,
    },
    personalForecasts: {
      title: "Личные прогнозы",
      subtitle:
        "Премиальные подсказки о том, что дальше может подсказывать повторяющийся тайминг симптомов.",
      aroundNowValue: "Примерно сейчас",
      inDaysValue: (days: number) => (days === 1 ? "Через 1 день" : `Через ${days} д.`),
      inDayRangeValue: (start: number, end: number) => `Через ${start}-${end} д.`,
      descriptionSingle: (day: number) => `Обычно около ${day}-го дня цикла.`,
      descriptionRange: (start: number, end: number) =>
        `Обычно около ${start}-${end}-го дней цикла.`,
    },
    extendedReports: {
      title: "Расширенные отчёты",
      subtitle: "Сравнение последних завершённых циклов рядом.",
      summary: (count: number, minDays: number, maxDays: number) =>
        `${count} завершённых циклов. Диапазон ${minDays}-${maxDays} д.`,
      rowTitle: (date: string) => `Начало ${date}`,
      cycleLengthLabel: (days: number) => `Цикл ${days} д.`,
      periodLengthLabel: (days: number) => `Менструация ${days} д.`,
      comparisonLabels: {
        longer: "Длиннее вашего обычного паттерна",
        shorter: "Короче вашего обычного паттерна",
        variable: "В пределах вариативного паттерна",
      },
    },
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
    emptyActionLabel: "Registrar hoy para desbloquear antes",
    completedCyclesProgress: (count: number) => `Ciclo ${count} de 2 completado`,
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
    mucusFertilityTitle: "Alta fertilidad",
    mucusFertilityValue: "Señal por moco",
    mucusFertilityDescription: (date: string) =>
      `Se registró moco tipo clara de huevo el ${date}.`,
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
    advancedInsights: {
      title: "Insights avanzados",
      subtitle: "Patrones premium calculados solo a partir de tu historial local reciente.",
      weightedAverageTitle: "Promedio ponderado",
      weightedAverageDescription: (count: number) =>
        `Los ciclos recientes pesan más, basándose en los últimos ${count} ciclos completados.`,
      patternDriftTitle: "Deriva del patrón",
      patternDriftStableValue: "Ritmo estable",
      patternDriftDriftingValue: "Con deriva",
      patternDriftStrongValue: "Deriva fuerte",
      patternDriftStableDescription: (recent: number, baseline: number) =>
        `Promedio reciente ${recent.toFixed(1)} d frente a base ${baseline.toFixed(1)} d.`,
      patternDriftDescription: (
        delta: number,
        recent: number,
        baseline: number,
      ) =>
        `Promedio reciente ${recent.toFixed(1)} d frente a base ${baseline.toFixed(1)} d (${delta > 0 ? "+" : ""}${delta.toFixed(1)} d).`,
      anomalousCycleTitle: "Ciclo anómalo",
      anomalousCycleLongerValue: "Más largo de lo normal",
      anomalousCycleShorterValue: "Más corto de lo normal",
    anomalousCycleDescription: (
      cycleLength: number,
      baselineLength: number,
      deltaDays: number,
    ) =>
      `Último ciclo completo ${cycleLength} d frente a ${baselineLength.toFixed(1)} d esperados (${deltaDays > 0 ? "+" : ""}${deltaDays.toFixed(1)} d).`,
    daysValue: (value: string) => `${value} d`,
  },
    advancedFertility: {
      title: "Fertilidad avanzada",
      subtitle:
        "Señales premium de fertilidad a partir de tu historial local de TCB y moco cervical.",
      observedLutealTitle: "Fase lútea observada",
      observedLutealDescription: (count: number, value: string) =>
        `Promedio derivado de señales en ${count} ciclos recientes: ${value} d.`,
      signalCoverageTitle: "Cobertura de señales",
      signalCoverageValue: (count: number, total: number) => `${count}/${total} ciclos`,
      signalCoverageDescription: (count: number, total: number) =>
        `Moco fértil o aumento térmico apareció en ${count} de tus últimos ${total} ciclos completados.`,
      thermalShiftTitle: "Aumento térmico",
      thermalShiftConfirmedValue: "Confirmado",
      thermalShiftBuildingValue: "En curso",
      thermalShiftConfirmedDescription: (
        rise: string,
        unit: string,
        count: number,
      ) => `El ciclo actual muestra un aumento estable de +${rise} ${unit} en ${count} mediciones.`,
      thermalShiftBuildingDescription: (
        rise: string,
        unit: string,
        count: number,
      ) => `Se está formando un posible aumento de +${rise} ${unit} en ${count} mediciones.`,
      daysValue: (value: string) => `${value} d`,
    },
    personalForecasts: {
      title: "Pronósticos personales",
      subtitle:
        "Pistas premium sobre lo que puede venir según el momento repetido de tus síntomas.",
      aroundNowValue: "Por ahora",
      inDaysValue: (days: number) => (days === 1 ? "En 1 día" : `En ${days} días`),
      inDayRangeValue: (start: number, end: number) => `En ${start}-${end} días`,
      descriptionSingle: (day: number) =>
        `Suele aparecer alrededor del día ${day} del ciclo.`,
      descriptionRange: (start: number, end: number) =>
        `Suele aparecer alrededor de los días ${start}-${end} del ciclo.`,
    },
    extendedReports: {
      title: "Informes ampliados",
      subtitle: "Compara tus ciclos completos recientes lado a lado.",
      summary: (count: number, minDays: number, maxDays: number) =>
        `${count} ciclos completos. Rango ${minDays}-${maxDays} d.`,
      rowTitle: (date: string) => `Inicio ${date}`,
      cycleLengthLabel: (days: number) => `Ciclo ${days} d`,
      periodLengthLabel: (days: number) => `Período ${days} d`,
      comparisonLabels: {
        longer: "Más largo que tu patrón habitual",
        shorter: "Más corto que tu patrón habitual",
        variable: "Dentro de un patrón variable",
      },
    },
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
