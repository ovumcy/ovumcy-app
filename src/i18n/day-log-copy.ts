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
  bbt: "BBT",
  bbtHint: "Enter a basal body temperature reading for today.",
  notes: "Notes",
  addNote: "Add note",
  editNote: "Edit note",
  hideNote: "Hide note",
  showMoreSymptoms: "More symptoms",
  showFewerSymptoms: "Fewer symptoms",
  notesPlaceholder: "Anything you want to remember about today.",
  saveToday: "Save today",
  updateEntry: "Update entry",
  saveDay: "Save day",
  saved: "Entry saved locally.",
  saveFailed: "Unable to save this entry. Please try again.",
  deleteEntry: "Clear entry",
  deleted: "Entry removed locally.",
  deleteFailed: "Unable to clear this entry. Please try again.",
  deleteHint: "This removes the local record for this day.",
  periodOffHint: "Flow is available when this day is marked as a period day.",
    options: {
      mood: [
      { value: 1, label: "😞", secondaryLabel: "1/5" },
      { value: 2, label: "🙂", secondaryLabel: "2/5" },
      { value: 3, label: "😌", secondaryLabel: "3/5" },
      { value: 4, label: "😊", secondaryLabel: "4/5" },
      { value: 5, label: "🤩", secondaryLabel: "5/5" },
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
    "Halte fest, was heute passiert ist, ohne deinen lokalen Zykluskontext zu verlassen.",
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
  bbt: "BBT",
  bbtHint: "Trage für heute einen Basaltemperaturwert ein.",
  notes: "Notizen",
  addNote: "Notiz hinzufügen",
  editNote: "Notiz bearbeiten",
  hideNote: "Notiz ausblenden",
  showMoreSymptoms: "Mehr Symptome",
  showFewerSymptoms: "Weniger Symptome",
  notesPlaceholder: "Alles, woran du dich heute erinnern möchtest.",
  saveToday: "Heute speichern",
  updateEntry: "Eintrag aktualisieren",
  saveDay: "Tag speichern",
  saved: "Eintrag lokal gespeichert.",
  saveFailed: "Dieser Eintrag konnte nicht gespeichert werden. Bitte versuche es erneut.",
  deleteEntry: "Eintrag löschen",
  deleted: "Eintrag lokal entfernt.",
  deleteFailed: "Dieser Eintrag konnte nicht gelöscht werden. Bitte versuche es erneut.",
  deleteHint: "Dadurch wird der lokale Eintrag für diesen Tag entfernt.",
  periodOffHint:
    "Die Blutungsstärke ist verfügbar, wenn dieser Tag als Periodentag markiert ist.",
  options: {
    mood: dayLogCopyEn.options.mood,
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
    "Enregistre ce qui s'est passé aujourd'hui sans quitter ton contexte de cycle local.",
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
  bbt: "TBC",
  bbtHint: "Saisis une température basale pour aujourd'hui.",
  notes: "Notes",
  addNote: "Ajouter une note",
  editNote: "Modifier la note",
  hideNote: "Masquer la note",
  showMoreSymptoms: "Plus de symptômes",
  showFewerSymptoms: "Moins de symptômes",
  notesPlaceholder: "Tout ce dont tu veux te souvenir aujourd'hui.",
  saveToday: "Enregistrer aujourd'hui",
  updateEntry: "Mettre à jour l'entrée",
  saveDay: "Enregistrer la journée",
  saved: "Entrée enregistrée localement.",
  saveFailed: "Impossible d'enregistrer cette entrée. Réessaie.",
  deleteEntry: "Effacer l'entrée",
  deleted: "Entrée supprimée localement.",
  deleteFailed: "Impossible d'effacer cette entrée. Réessaie.",
  deleteHint: "Cela supprime l'enregistrement local pour cette journée.",
  periodOffHint:
    "Le flux est disponible quand cette journée est marquée comme jour de règles.",
  options: {
    mood: dayLogCopyEn.options.mood,
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
      { value: "dry", label: "Sec" },
      { value: "moist", label: "Humide" },
      { value: "creamy", label: "Crémeux" },
      { value: "eggwhite", label: "Blanc d'œuf" },
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
    bbt: "БТТ",
    bbtHint: "Введите сегодняшнее значение базальной температуры тела.",
    notes: "Заметки",
    addNote: "Добавить заметку",
    editNote: "Изменить заметку",
    hideNote: "Скрыть заметку",
    showMoreSymptoms: "Ещё симптомы",
    showFewerSymptoms: "Свернуть симптомы",
    notesPlaceholder: "Всё, что вы хотите запомнить о сегодняшнем дне.",
    saveToday: "Сохранить сегодня",
    updateEntry: "Обновить запись",
    saveDay: "Сохранить день",
    saved: "Запись сохранена локально.",
    saveFailed: "Не удалось сохранить запись. Попробуйте ещё раз.",
    deleteEntry: "Очистить запись",
    deleted: "Запись удалена локально.",
    deleteFailed: "Не удалось очистить запись. Попробуйте ещё раз.",
    deleteHint: "Это удаляет локальную запись для этого дня.",
    periodOffHint:
      "Интенсивность доступна, когда этот день отмечен как день менструации.",
    options: {
      mood: dayLogCopyEn.options.mood,
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
    bbt: "TCB",
    bbtHint: "Introduce una lectura de temperatura basal para hoy.",
    notes: "Notas",
    addNote: "Añadir nota",
    editNote: "Editar nota",
    hideNote: "Ocultar nota",
    showMoreSymptoms: "Más síntomas",
    showFewerSymptoms: "Menos síntomas",
    notesPlaceholder: "Cualquier cosa que quieras recordar sobre hoy.",
    saveToday: "Guardar hoy",
    updateEntry: "Actualizar registro",
    saveDay: "Guardar día",
    saved: "Registro guardado localmente.",
    saveFailed: "No se pudo guardar el registro. Inténtalo de nuevo.",
    deleteEntry: "Borrar registro",
    deleted: "Registro eliminado localmente.",
    deleteFailed: "No se pudo borrar el registro. Inténtalo de nuevo.",
    deleteHint: "Esto elimina el registro local de este día.",
    periodOffHint:
      "El flujo está disponible cuando este día está marcado como día de período.",
    options: {
      mood: dayLogCopyEn.options.mood,
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
