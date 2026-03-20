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
};

export function getDayLogCopy(language: string | null | undefined) {
  return dayLogCopyCatalog[resolveCopyLanguage(language)];
}

export const dayLogCopy = dayLogCopyEn;
