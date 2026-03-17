export const MAX_CUSTOM_SYMPTOM_NAME_LENGTH = 40;
export const DEFAULT_CUSTOM_SYMPTOM_ICON = "✨";
export const DEFAULT_CUSTOM_SYMPTOM_COLOR = "#E8799F";

export const SYMPTOM_ICON_CATALOG = [
  "✨",
  "🔥",
  "💧",
  "⚡",
  "🌙",
  "🤕",
  "🌀",
  "🍫",
] as const;

export const HIDDEN_BUILTIN_ENTRY_PICKER_SYMPTOM_IDS = new Set([
  "mood_swings",
  "fatigue",
  "irritability",
  "insomnia",
]);

export type SymptomID = string;

export type SymptomRecord = {
  id: SymptomID;
  slug: string;
  label: string;
  icon: string;
  color: string;
  isArchived: boolean;
  sortOrder: number;
  isDefault: boolean;
};

type BuiltinSymptomDefinition = {
  id: string;
  label: string;
  icon: string;
  color: string;
};

export const BUILTIN_SYMPTOM_DEFINITIONS: readonly BuiltinSymptomDefinition[] = [
  { id: "cramps", label: "Cramps", icon: "🩸", color: "#FF4444" },
  { id: "headache", label: "Headache", icon: "🤕", color: "#FFA500" },
  { id: "mood_swings", label: "Mood swings", icon: "😢", color: "#9B59B6" },
  { id: "bloating", label: "Bloating", icon: "🎈", color: "#3498DB" },
  { id: "fatigue", label: "Fatigue", icon: "😴", color: "#95A5A6" },
  {
    id: "breast_tenderness",
    label: "Breast tenderness",
    icon: "💔",
    color: "#E91E63",
  },
  { id: "acne", label: "Acne", icon: "🔴", color: "#E74C3C" },
  { id: "back_pain", label: "Back pain", icon: "🦴", color: "#8E6E53" },
  { id: "nausea", label: "Nausea", icon: "🤢", color: "#7CB342" },
  { id: "spotting", label: "Spotting", icon: "🩹", color: "#C55A7A" },
  {
    id: "irritability",
    label: "Irritability",
    icon: "😤",
    color: "#FF7043",
  },
  { id: "insomnia", label: "Insomnia", icon: "🌙", color: "#5C6BC0" },
  {
    id: "food_cravings",
    label: "Food cravings",
    icon: "🍫",
    color: "#A1887F",
  },
  { id: "diarrhea", label: "Diarrhea", icon: "🚽", color: "#26A69A" },
  {
    id: "constipation",
    label: "Constipation",
    icon: "🪨",
    color: "#8D6E63",
  },
  { id: "swelling", label: "Swelling", icon: "💧", color: "#64B5F6" },
] as const;

export function createBuiltinSymptomRecords(): SymptomRecord[] {
  return BUILTIN_SYMPTOM_DEFINITIONS.map((definition, index) => ({
    id: definition.id,
    slug: definition.id,
    label: definition.label,
    icon: definition.icon,
    color: definition.color,
    isArchived: false,
    sortOrder: index,
    isDefault: true,
  }));
}

export function createDefaultSymptomRecords(): SymptomRecord[] {
  return createBuiltinSymptomRecords();
}
