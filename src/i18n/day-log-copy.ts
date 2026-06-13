import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const dayLogCopyEn = {
  title: "Today journal",
  subtitle:
    "Track what happened today without leaving your local-first cycle context.",
  periodDay: "Period day",
  symptoms: "Symptoms",
  mood: "Mood",
  cycleFactors: "Cycle factors",
  cycleFactorsHint:
    "Optional context tags for things that may affect timing this cycle.",
  flow: "Flow",
  intimacy: "Intimacy",
  cervicalMucus: "Cervical mucus",
  cervicalMucusExplainer:
    "Cervical mucus means vaginal discharge. Egg-white mucus often appears near peak fertility.",
  lhTest: "LH test",
  lhTestHint: "Optional ovulation strip result for today.",
  pregnancyTest: "Pregnancy test",
  pregnancyTestHint:
    "Optional home pregnancy test result. A positive result pauses cycle predictions.",
  bbt: "BBT",
  bbtHint: "Enter a basal body temperature reading for today.",
  notes: "Notes",
  showMoreSymptoms: "More symptoms",
  showFewerSymptoms: "Fewer symptoms",
  notesPlaceholder: "Anything you want to remember about today.",
  saveToday: "Save today",
  updateEntry: "Update entry",
  saveDay: "Save entry",
  saving: "Saving locally...",
  saved: "Entry saved locally.",
  saveFailed: "Unable to save this entry. Please try again.",
  deleteEntry: "Clear entry",
  deleted: "Entry removed locally.",
  deleteFailed: "Unable to clear this entry. Please try again.",
  deletePrompt:
    "Clear this entry for this day? Period, symptoms, mood, flow, and notes will be removed from the local record.",
  deleteHint: "This removes the local record for this day.",
  periodOffHint: "Flow is available when this day is marked as a period day.",
    options: {
      mood: [
      { value: 1, label: "😞", secondaryLabel: "Terrible" },
      { value: 2, label: "🙁", secondaryLabel: "Bad" },
      { value: 3, label: "😌", secondaryLabel: "Okay" },
      { value: 4, label: "🙂", secondaryLabel: "Good" },
      { value: 5, label: "🤩", secondaryLabel: "Great" },
    ],
    flow: [
      { value: "none", label: "None" },
      { value: "spotting", label: "Spotting" },
      { value: "light", label: "Light" },
      { value: "medium", label: "Medium" },
      { value: "heavy", label: "Heavy" },
    ],
    sexActivity: [
      { value: "none", label: "None" },
      { value: "protected", label: "Protected" },
      { value: "unprotected", label: "Unprotected" },
    ],
    cervicalMucus: [
      { value: "none", label: "None" },
      { value: "dry", label: "Dry" },
      { value: "moist", label: "Moist" },
      { value: "creamy", label: "Creamy" },
      { value: "eggwhite", label: "Egg white" },
    ],
    lhTest: [
      { value: "none", label: "None" },
      { value: "negative", label: "Negative" },
      { value: "high", label: "High" },
      { value: "peak", label: "Peak" },
    ],
    pregnancyTest: [
      { value: "none", label: "None" },
      { value: "negative", label: "Negative" },
      { value: "positive", label: "Positive" },
    ],
    cycleFactors: {
      stress: { label: "Stress", icon: "⚡" },
      illness: { label: "Illness", icon: "🤒" },
      travel: { label: "Travel", icon: "✈️" },
      sleep_disruption: { label: "Sleep disruption", icon: "🌙" },
      medication_change: { label: "Medication change", icon: "💊" },
    },
  },
} as const;

type DayLogCopy = WidenLiteral<typeof dayLogCopyEn>;

const dayLogCopyDe: DayLogCopy = {
  title: "Heutiges Journal",
  subtitle:
    "Halten Sie fest, was heute passiert ist, ohne Ihren lokalen Zykluskontext zu verlassen.",
  periodDay: "Periodentag",
  symptoms: "Symptome",
  mood: "Stimmung",
  cycleFactors: "Zyklusfaktoren",
  cycleFactorsHint:
    "Optionale Kontext-Tags für Dinge, die den Rhythmus dieses Zyklus beeinflussen können.",
  flow: "Stärke",
  intimacy: "Intimität",
  cervicalMucus: "Zervixschleim",
  cervicalMucusExplainer:
    "Zervixschleim bedeutet vaginalen Ausfluss. Eiweißartiger Schleim erscheint oft nahe dem Fruchtbarkeitshöhepunkt.",
  lhTest: "LH-Test",
  lhTestHint: "Optionales Ergebnis eines Ovulationstests für heute.",
  pregnancyTest: "Schwangerschaftstest",
  pregnancyTestHint:
    "Optionales Ergebnis eines Heimtests. Bei positivem Ergebnis pausieren die Zyklusvorhersagen.",
  bbt: "BBT",
  bbtHint: "Tragen Sie für heute einen Basaltemperaturwert ein.",
  notes: "Notizen",
  showMoreSymptoms: "Mehr Symptome",
  showFewerSymptoms: "Weniger Symptome",
  notesPlaceholder: "Alles, woran Sie sich heute erinnern möchten.",
  saveToday: "Heute speichern",
  updateEntry: "Eintrag aktualisieren",
  saveDay: "Eintrag speichern",
  saving: "Wird lokal gespeichert...",
  saved: "Eintrag lokal gespeichert.",
  saveFailed: "Dieser Eintrag konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
  deleteEntry: "Eintrag löschen",
  deleted: "Eintrag lokal entfernt.",
  deleteFailed: "Dieser Eintrag konnte nicht gelöscht werden. Bitte versuchen Sie es erneut.",
  deletePrompt:
    "Diesen Eintrag für diesen Tag löschen? Periode, Symptome, Stimmung, Stärke und Notizen werden aus dem lokalen Eintrag entfernt.",
  deleteHint: "Dadurch wird der lokale Eintrag für diesen Tag entfernt.",
  periodOffHint:
    "Die Blutungsstärke ist verfügbar, wenn dieser Tag als Periodentag markiert ist.",
  options: {
    mood: [
      { value: 1, label: "😞", secondaryLabel: "Sehr schlecht" },
      { value: 2, label: "🙁", secondaryLabel: "Schlecht" },
      { value: 3, label: "😌", secondaryLabel: "Okay" },
      { value: 4, label: "🙂", secondaryLabel: "Gut" },
      { value: 5, label: "🤩", secondaryLabel: "Großartig" },
    ],
    flow: [
      { value: "none", label: "Keine" },
      { value: "spotting", label: "Schmierblutung" },
      { value: "light", label: "Leicht" },
      { value: "medium", label: "Mittel" },
      { value: "heavy", label: "Stark" },
    ],
    sexActivity: [
      { value: "none", label: "Keine" },
      { value: "protected", label: "Geschützt" },
      { value: "unprotected", label: "Ungeschützt" },
    ],
    cervicalMucus: [
      { value: "none", label: "Keiner" },
      { value: "dry", label: "Trocken" },
      { value: "moist", label: "Feucht" },
      { value: "creamy", label: "Cremig" },
      { value: "eggwhite", label: "Eiweißartig" },
    ],
    lhTest: [
      { value: "none", label: "Kein Test" },
      { value: "negative", label: "Negativ" },
      { value: "high", label: "Hoch" },
      { value: "peak", label: "Peak" },
    ],
    pregnancyTest: [
      { value: "none", label: "Kein Test" },
      { value: "negative", label: "Negativ" },
      { value: "positive", label: "Positiv" },
    ],
    cycleFactors: {
      stress: { label: "Stress", icon: "⚡" },
      illness: { label: "Krankheit", icon: "🤒" },
      travel: { label: "Reise", icon: "✈️" },
      sleep_disruption: { label: "Schlafstörung", icon: "🌙" },
      medication_change: { label: "Medikamentenwechsel", icon: "💊" },
    },
  },
};

const dayLogCopyFr: DayLogCopy = {
  title: "Journal du jour",
  subtitle:
    "Enregistrez ce qui s'est passé aujourd'hui sans quitter votre contexte de cycle local.",
  periodDay: "Jour de règles",
  symptoms: "Symptômes",
  mood: "Humeur",
  cycleFactors: "Facteurs du cycle",
  cycleFactorsHint:
    "Étiquettes de contexte facultatives pour les éléments qui peuvent influencer le rythme de ce cycle.",
  flow: "Flux",
  intimacy: "Intimité",
  cervicalMucus: "Glaire cervicale",
  cervicalMucusExplainer:
    "La glaire cervicale correspond aux pertes vaginales. Une glaire type blanc d'œuf apparaît souvent près du pic de fertilité.",
  lhTest: "Test LH",
  lhTestHint: "Résultat optionnel de test d'ovulation pour aujourd'hui.",
  pregnancyTest: "Test de grossesse",
  pregnancyTestHint:
    "Résultat optionnel d'un test à domicile. Un résultat positif met en pause les prédictions de cycle.",
  bbt: "TB",
  bbtHint: "Saisissez une température basale pour aujourd'hui.",
  notes: "Notes",
  showMoreSymptoms: "Plus de symptômes",
  showFewerSymptoms: "Moins de symptômes",
  notesPlaceholder: "Tout ce dont vous voulez vous souvenir aujourd'hui.",
  saveToday: "Enregistrer aujourd'hui",
  updateEntry: "Mettre à jour l'entrée",
  saveDay: "Enregistrer l'entrée",
  saving: "Enregistrement local...",
  saved: "Entrée enregistrée localement.",
  saveFailed: "Impossible d'enregistrer cette entrée. Réessayez.",
  deleteEntry: "Effacer l'entrée",
  deleted: "Entrée supprimée localement.",
  deleteFailed: "Impossible d'effacer cette entrée. Réessayez.",
  deletePrompt:
    "Effacer cette entrée pour cette journée ? Les règles, symptômes, humeur, flux et notes seront retirés de l'enregistrement local.",
  deleteHint: "Cela supprime l'enregistrement local pour cette journée.",
  periodOffHint:
    "Le flux est disponible quand cette journée est marquée comme jour de règles.",
  options: {
    mood: [
      { value: 1, label: "😞", secondaryLabel: "Très mal" },
      { value: 2, label: "🙁", secondaryLabel: "Mal" },
      { value: 3, label: "😌", secondaryLabel: "Ça va" },
      { value: 4, label: "🙂", secondaryLabel: "Bien" },
      { value: 5, label: "🤩", secondaryLabel: "Super" },
    ],
    flow: [
      { value: "none", label: "Aucun" },
      { value: "spotting", label: "Spotting" },
      { value: "light", label: "Léger" },
      { value: "medium", label: "Moyen" },
      { value: "heavy", label: "Abondant" },
    ],
    sexActivity: [
      { value: "none", label: "Aucune" },
      { value: "protected", label: "Protégé" },
      { value: "unprotected", label: "Non protégé" },
    ],
    cervicalMucus: [
      { value: "none", label: "Aucune" },
      { value: "dry", label: "Sèche" },
      { value: "moist", label: "Humide" },
      { value: "creamy", label: "Crémeuse" },
      { value: "eggwhite", label: "Blanc d'œuf" },
    ],
    lhTest: [
      { value: "none", label: "Pas de test" },
      { value: "negative", label: "Négatif" },
      { value: "high", label: "Élevé" },
      { value: "peak", label: "Pic" },
    ],
    pregnancyTest: [
      { value: "none", label: "Pas de test" },
      { value: "negative", label: "Négatif" },
      { value: "positive", label: "Positif" },
    ],
    cycleFactors: {
      stress: { label: "Stress", icon: "⚡" },
      illness: { label: "Maladie", icon: "🤒" },
      travel: { label: "Voyage", icon: "✈️" },
      sleep_disruption: { label: "Sommeil perturbé", icon: "🌙" },
      medication_change: { label: "Changement de traitement", icon: "💊" },
    },
  },
};

const dayLogCopyCatalog: Record<InterfaceLanguage, DayLogCopy> = {
  en: dayLogCopyEn,
  ru: {
    title: "Сегодняшний журнал",
    subtitle:
      "Фиксируйте то, что произошло сегодня, не выходя из локального контекста цикла.",
    periodDay: "День менструации",
    symptoms: "Симптомы",
    mood: "Настроение",
    cycleFactors: "Факторы цикла",
    cycleFactorsHint:
      "Необязательные теги-контекст для того, что могло повлиять на тайминг этого цикла.",
    flow: "Интенсивность",
    intimacy: "Близость",
    cervicalMucus: "Цервикальная слизь",
    cervicalMucusExplainer:
      "Цервикальная слизь означает вагинальные выделения. Выделения как яичный белок часто появляются ближе к пику фертильности.",
    lhTest: "LH-тест",
    lhTestHint: "Необязательный результат овуляционного теста за сегодня.",
    pregnancyTest: "Тест на беременность",
    pregnancyTestHint:
      "Необязательный результат домашнего теста. При положительном результате прогнозы цикла приостанавливаются.",
    bbt: "БТТ",
    bbtHint: "Введите сегодняшнее значение базальной температуры тела.",
    notes: "Заметки",
    showMoreSymptoms: "Ещё симптомы",
    showFewerSymptoms: "Свернуть симптомы",
    notesPlaceholder: "Всё, что вы хотите запомнить о сегодняшнем дне.",
    saveToday: "Сохранить сегодня",
    updateEntry: "Обновить запись",
    saveDay: "Сохранить запись",
    saving: "Локальное сохранение...",
    saved: "Запись сохранена локально.",
    saveFailed: "Не удалось сохранить запись. Попробуйте ещё раз.",
    deleteEntry: "Очистить запись",
    deleted: "Запись удалена локально.",
    deleteFailed: "Не удалось очистить запись. Попробуйте ещё раз.",
    deletePrompt:
      "Очистить запись за этот день? Из локальной записи будут удалены менструация, симптомы, настроение, интенсивность и заметки.",
    deleteHint: "Это удаляет локальную запись для этого дня.",
    periodOffHint:
      "Интенсивность доступна, когда этот день отмечен как день менструации.",
    options: {
      mood: [
        { value: 1, label: "😞", secondaryLabel: "Ужасно" },
        { value: 2, label: "🙁", secondaryLabel: "Плохо" },
        { value: 3, label: "😌", secondaryLabel: "Нормально" },
        { value: 4, label: "🙂", secondaryLabel: "Хорошо" },
        { value: 5, label: "🤩", secondaryLabel: "Отлично" },
      ],
      flow: [
        { value: "none", label: "Нет" },
        { value: "spotting", label: "Мажущие" },
        { value: "light", label: "Слабая" },
        { value: "medium", label: "Средняя" },
        { value: "heavy", label: "Сильная" },
      ],
      sexActivity: [
        { value: "none", label: "Нет" },
        { value: "protected", label: "С защитой" },
        { value: "unprotected", label: "Без защиты" },
      ],
      cervicalMucus: [
        { value: "none", label: "Нет" },
        { value: "dry", label: "Сухо" },
        { value: "moist", label: "Влажно" },
        { value: "creamy", label: "Кремообразная" },
        { value: "eggwhite", label: "Как яичный белок" },
      ],
      lhTest: [
        { value: "none", label: "Нет теста" },
        { value: "negative", label: "Отрицательный" },
        { value: "high", label: "Высокий" },
        { value: "peak", label: "Пик" },
      ],
      pregnancyTest: [
        { value: "none", label: "Нет теста" },
        { value: "negative", label: "Отрицательный" },
        { value: "positive", label: "Положительный" },
      ],
      cycleFactors: {
        stress: { label: "Стресс", icon: "⚡" },
        illness: { label: "Болезнь", icon: "🤒" },
        travel: { label: "Поездка", icon: "✈️" },
        sleep_disruption: { label: "Нарушение сна", icon: "🌙" },
        medication_change: { label: "Смена лекарств", icon: "💊" },
      },
    },
  },
  es: {
    title: "Registro de hoy",
    subtitle:
      "Registra lo que ocurrió hoy sin salir de tu contexto local-first del ciclo.",
    periodDay: "Día de período",
    symptoms: "Síntomas",
    mood: "Ánimo",
    cycleFactors: "Factores del ciclo",
    cycleFactorsHint:
      "Etiquetas opcionales para cosas que pueden afectar el momento de este ciclo.",
    flow: "Flujo",
    intimacy: "Intimidad",
    cervicalMucus: "Moco cervical",
    cervicalMucusExplainer:
      "El moco cervical es el flujo vaginal. El moco tipo clara de huevo suele aparecer cerca del pico fértil.",
    lhTest: "Test LH",
    lhTestHint: "Resultado opcional del test de ovulación para hoy.",
    pregnancyTest: "Test de embarazo",
    pregnancyTestHint:
      "Resultado opcional de un test casero. Un resultado positivo pausa las predicciones del ciclo.",
    bbt: "TBC",
    bbtHint: "Introduce una lectura de temperatura basal para hoy.",
    notes: "Notas",
    showMoreSymptoms: "Más síntomas",
    showFewerSymptoms: "Menos síntomas",
    notesPlaceholder: "Cualquier cosa que quieras recordar sobre hoy.",
    saveToday: "Guardar hoy",
    updateEntry: "Actualizar registro",
    saveDay: "Guardar registro",
    saving: "Guardando localmente...",
    saved: "Registro guardado localmente.",
    saveFailed: "No se pudo guardar el registro. Inténtalo de nuevo.",
    deleteEntry: "Borrar registro",
    deleted: "Registro eliminado localmente.",
    deleteFailed: "No se pudo borrar el registro. Inténtalo de nuevo.",
    deletePrompt:
      "¿Borrar este registro de este día? El período, los síntomas, el ánimo, el flujo y las notas se quitarán del registro local.",
    deleteHint: "Esto elimina el registro local de este día.",
    periodOffHint:
      "El flujo está disponible cuando este día está marcado como día de período.",
    options: {
      mood: [
        { value: 1, label: "😞", secondaryLabel: "Muy mal" },
        { value: 2, label: "🙁", secondaryLabel: "Mal" },
        { value: 3, label: "😌", secondaryLabel: "Normal" },
        { value: 4, label: "🙂", secondaryLabel: "Bien" },
        { value: 5, label: "🤩", secondaryLabel: "Genial" },
      ],
      flow: [
        { value: "none", label: "Ninguno" },
        { value: "spotting", label: "Manchado" },
        { value: "light", label: "Ligero" },
        { value: "medium", label: "Medio" },
        { value: "heavy", label: "Abundante" },
      ],
      sexActivity: [
        { value: "none", label: "Ninguna" },
        { value: "protected", label: "Con protección" },
        { value: "unprotected", label: "Sin protección" },
      ],
      cervicalMucus: [
        { value: "none", label: "Ninguno" },
        { value: "dry", label: "Seco" },
        { value: "moist", label: "Húmedo" },
        { value: "creamy", label: "Cremoso" },
        { value: "eggwhite", label: "Clara de huevo" },
      ],
      lhTest: [
        { value: "none", label: "Sin test" },
        { value: "negative", label: "Negativo" },
        { value: "high", label: "Alto" },
        { value: "peak", label: "Pico" },
      ],
      pregnancyTest: [
        { value: "none", label: "Sin test" },
        { value: "negative", label: "Negativo" },
        { value: "positive", label: "Positivo" },
      ],
      cycleFactors: {
        stress: { label: "Estrés", icon: "⚡" },
        illness: { label: "Enfermedad", icon: "🤒" },
        travel: { label: "Viaje", icon: "✈️" },
        sleep_disruption: { label: "Sueño alterado", icon: "🌙" },
        medication_change: { label: "Cambio de medicación", icon: "💊" },
      },
    },
  },
  de: dayLogCopyDe,
  fr: dayLogCopyFr,
};

export function getDayLogCopy(language: string | null | undefined) {
  return dayLogCopyCatalog[resolveCopyLanguage(language)];
}

export const dayLogCopy = dayLogCopyEn;
