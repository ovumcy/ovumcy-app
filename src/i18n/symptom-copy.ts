import type { InterfaceLanguage } from "../models/profile";
import type { BuiltinSymptomID } from "../models/symptom";
import { resolveCopyLanguage } from "./runtime";

type BuiltinSymptomCopy = Record<BuiltinSymptomID, string>;

const builtinSymptomCopyEn: BuiltinSymptomCopy = {
  cramps: "Cramps",
  headache: "Headache",
  mood_swings: "Mood swings",
  bloating: "Bloating",
  fatigue: "Fatigue",
  breast_tenderness: "Breast tenderness",
  acne: "Acne",
  back_pain: "Back pain",
  nausea: "Nausea",
  spotting: "Spotting",
  irritability: "Irritability",
  insomnia: "Insomnia",
  food_cravings: "Food cravings",
  diarrhea: "Diarrhea",
  constipation: "Constipation",
  swelling: "Swelling",
};

const builtinSymptomCopyDe: BuiltinSymptomCopy = {
  cramps: "Krämpfe",
  headache: "Kopfschmerzen",
  mood_swings: "Stimmungsschwankungen",
  bloating: "Blähungen",
  fatigue: "Erschöpfung",
  breast_tenderness: "Brustspannen",
  acne: "Akne",
  back_pain: "Rückenschmerzen",
  nausea: "Übelkeit",
  spotting: "Schmierblutung",
  irritability: "Reizbarkeit",
  insomnia: "Schlaflosigkeit",
  food_cravings: "Heißhunger",
  diarrhea: "Durchfall",
  constipation: "Verstopfung",
  swelling: "Schwellungen",
};

const builtinSymptomCopyFr: BuiltinSymptomCopy = {
  cramps: "Crampes",
  headache: "Maux de tête",
  mood_swings: "Sautes d'humeur",
  bloating: "Ballonnements",
  fatigue: "Fatigue",
  breast_tenderness: "Sensibilité des seins",
  acne: "Acné",
  back_pain: "Mal de dos",
  nausea: "Nausée",
  spotting: "Spotting",
  irritability: "Irritabilité",
  insomnia: "Insomnie",
  food_cravings: "Envies alimentaires",
  diarrhea: "Diarrhée",
  constipation: "Constipation",
  swelling: "Gonflement",
};

const builtinSymptomCopyRu: BuiltinSymptomCopy = {
  cramps: "Спазмы",
  headache: "Головная боль",
  mood_swings: "Перепады настроения",
  bloating: "Вздутие",
  fatigue: "Усталость",
  breast_tenderness: "Чувствительность груди",
  acne: "Акне",
  back_pain: "Боль в спине",
  nausea: "Тошнота",
  spotting: "Мажущие выделения",
  irritability: "Раздражительность",
  insomnia: "Бессонница",
  food_cravings: "Тяга к еде",
  diarrhea: "Диарея",
  constipation: "Запор",
  swelling: "Отёчность",
};

const builtinSymptomCopyEs: BuiltinSymptomCopy = {
  cramps: "Cólicos",
  headache: "Dolor de cabeza",
  mood_swings: "Cambios de humor",
  bloating: "Hinchazón",
  fatigue: "Fatiga",
  breast_tenderness: "Sensibilidad en los senos",
  acne: "Acné",
  back_pain: "Dolor de espalda",
  nausea: "Náuseas",
  spotting: "Manchado",
  irritability: "Irritabilidad",
  insomnia: "Insomnio",
  food_cravings: "Antojos",
  diarrhea: "Diarrea",
  constipation: "Estreñimiento",
  swelling: "Hinchazón por líquidos",
};

const builtinSymptomCopyIt: BuiltinSymptomCopy = {
  cramps: "Crampi",
  headache: "Mal di testa",
  mood_swings: "Sbalzi d'umore",
  bloating: "Gonfiore",
  fatigue: "Affaticamento",
  breast_tenderness: "Dolore al seno",
  acne: "Acne",
  back_pain: "Mal di schiena",
  nausea: "Nausea",
  spotting: "Perdite",
  irritability: "Irritabilità",
  insomnia: "Insonnia",
  food_cravings: "Desiderio di cibo",
  diarrhea: "Diarrea",
  constipation: "Stitichezza",
  swelling: "Gonfiore da ritenzione",
};

const builtinSymptomCatalog: Record<InterfaceLanguage, BuiltinSymptomCopy> = {
  en: builtinSymptomCopyEn,
  ru: builtinSymptomCopyRu,
  es: builtinSymptomCopyEs,
  de: builtinSymptomCopyDe,
  fr: builtinSymptomCopyFr,
  it: builtinSymptomCopyIt,
};

const builtinSymptomReservedLabelKeys = new Set(
  Object.values(builtinSymptomCatalog).flatMap((copy) =>
    Object.values(copy).map((label) => label.trim().toLocaleLowerCase("en")),
  ),
);

export function getBuiltinSymptomLabel(
  language: string | null | undefined,
  symptomID: BuiltinSymptomID,
): string {
  const copy = builtinSymptomCatalog[resolveCopyLanguage(language)] ?? builtinSymptomCopyEn;
  return copy[symptomID] ?? builtinSymptomCopyEn[symptomID]!;
}

export function isBuiltinSymptomReservedLabel(label: string) {
  return builtinSymptomReservedLabelKeys.has(label.trim().toLocaleLowerCase("en"));
}
