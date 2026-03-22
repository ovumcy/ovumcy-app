import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const dashboardCopyEn = {
  cycleDay: "Cycle day",
  nextPeriod: "Next period",
  nextPeriodUnknown: "unknown",
  nextPeriodPrompt: "Enter the start date of your last cycle",
  approximateDatePrefix: "around",
  ovulation: "Ovulation",
  ovulationUnavailable: "Cannot be calculated",
  predictionsOff: "Predictions off",
  predictionsApproximateHint:
    "Irregular cycle mode keeps predictions visible, but they should be read as approximate guidance rather than exact dates.",
  factsOnlyHint:
    "Predictions are off in unpredictable cycle mode. Ovumcy shows recorded facts only.",
  todayEditor: "Today journal",
  quickActionsTitle: "Quick actions",
  quickActions: {
    mood: "Mood",
    period: "Period",
    symptom: "Symptoms",
  },
  periodDay: "Period day",
  symptoms: "Symptoms",
  mood: "Mood",
  cycleFactors: "Cycle factors",
  cycleFactorsHint:
    "Optional context tags for things that may affect cycle timing.",
  intimacy: "Intimacy",
  cervicalMucus: "Cervical mucus",
  cervicalMucusExplainer:
    "Cervical mucus means vaginal discharge. Egg-white mucus usually appears near peak fertility.",
  bbt: "BBT",
  notes: "Notes",
  manualCycleStart: "Mark new cycle start",
  cancelAction: "Cancel",
  manualCycleStartSaved: "Cycle start updated locally.",
  manualCycleStartFailed: "Unable to mark a new cycle start. Please try again.",
  invalidCycleStartDate:
    "A new cycle start can be marked only for past days and no more than 2 days ahead.",
  cycleStartSuggestion:
    "This may be the first day of your period. If so, mark it as a new cycle start.",
  cycleStartReplaceMessage:
    "You already marked a cycle start on %s. Replace it with %s?",
  cycleStartReplaceAccept: "Replace",
  cycleStartReplaceRequired:
    "Confirm replacing the already marked cycle start.",
  cycleStartShortGapMessage:
    "⚠️ Only %s days have passed since the previous cycle. This may not be a new cycle. Previous date: %s.",
  cycleStartShortGapAccept: "Mark anyway",
  cycleStartConfirmationRequired:
    "Confirm marking a cycle start with a short gap.",
  futureCycleStartNotice: "Predictions will be recalculated when that day arrives.",
  implantationWarning:
    "This may be implantation bleeding, not a new cycle. If you are trying to conceive, consider taking a test.",
} as const;

type DashboardCopy = WidenLiteral<typeof dashboardCopyEn>;

const dashboardCopyDe: DashboardCopy = {
  cycleDay: "Zyklustag",
  nextPeriod: "Nächste Periode",
  nextPeriodUnknown: "unbekannt",
  nextPeriodPrompt: "Gib das Startdatum deines letzten Zyklus ein",
  approximateDatePrefix: "etwa",
  ovulation: "Eisprung",
  ovulationUnavailable: "Nicht berechenbar",
  predictionsOff: "Vorhersagen aus",
  predictionsApproximateHint:
    "Im Modus für unregelmäßige Zyklen bleiben Vorhersagen sichtbar, sollten aber als ungefähre Orientierung statt als exakte Daten gelesen werden.",
  factsOnlyHint:
    "Im unvorhersagbaren Zyklusmodus zeigt Ovumcy nur erfasste Fakten an.",
  todayEditor: "Heutiges Journal",
  quickActionsTitle: "Schnellaktionen",
  quickActions: {
    mood: "Stimmung",
    period: "Periode",
    symptom: "Symptome",
  },
  periodDay: "Periodentag",
  symptoms: "Symptome",
  mood: "Stimmung",
  cycleFactors: "Zyklusfaktoren",
  cycleFactorsHint:
    "Optionale Kontext-Tags für Dinge, die den Zykluszeitpunkt beeinflussen können.",
  intimacy: "Intimität",
  cervicalMucus: "Zervixschleim",
  cervicalMucusExplainer:
    "Zervixschleim bedeutet vaginalen Ausfluss. Eiweißartiger Schleim erscheint oft nahe dem Fruchtbarkeitshöhepunkt.",
  bbt: "BBT",
  notes: "Notizen",
  manualCycleStart: "Neuen Zyklusbeginn markieren",
  cancelAction: "Abbrechen",
  manualCycleStartSaved: "Zyklusbeginn lokal aktualisiert.",
  manualCycleStartFailed:
    "Ein neuer Zyklusbeginn konnte nicht markiert werden. Bitte versuche es erneut.",
  invalidCycleStartDate:
    "Ein neuer Zyklusbeginn kann nur für vergangene Tage und höchstens 2 Tage im Voraus markiert werden.",
  cycleStartSuggestion:
    "Das könnte der erste Tag deiner Periode sein. Wenn ja, markiere ihn als neuen Zyklusbeginn.",
  cycleStartReplaceMessage:
    "Du hast bereits einen Zyklusbeginn am %s markiert. Durch %s ersetzen?",
  cycleStartReplaceAccept: "Ersetzen",
  cycleStartReplaceRequired:
    "Bestätige das Ersetzen des bereits markierten Zyklusbeginns.",
  cycleStartShortGapMessage:
    "⚠️ Seit dem vorherigen Zyklus sind erst %s Tage vergangen. Das ist vielleicht kein neuer Zyklus. Vorheriges Datum: %s.",
  cycleStartShortGapAccept: "Trotzdem markieren",
  cycleStartConfirmationRequired:
    "Bestätige das Markieren eines Zyklusbeginns mit kurzem Abstand.",
  futureCycleStartNotice:
    "Die Vorhersagen werden neu berechnet, wenn dieser Tag erreicht ist.",
  implantationWarning:
    "Das könnte eine Einnistungsblutung und kein neuer Zyklus sein. Wenn du schwanger werden möchtest, ziehe einen Test in Betracht.",
};

const dashboardCopyFr: DashboardCopy = {
  cycleDay: "Jour du cycle",
  nextPeriod: "Prochaines règles",
  nextPeriodUnknown: "inconnu",
  nextPeriodPrompt: "Saisis la date de début de ton dernier cycle",
  approximateDatePrefix: "vers",
  ovulation: "Ovulation",
  ovulationUnavailable: "Impossible à calculer",
  predictionsOff: "Prédictions désactivées",
  predictionsApproximateHint:
    "Le mode cycle irrégulier garde les prédictions visibles, mais elles doivent être lues comme une indication approximative et non comme des dates exactes.",
  factsOnlyHint:
    "En mode cycle imprévisible, Ovumcy affiche seulement les faits enregistrés.",
  todayEditor: "Journal d'aujourd'hui",
  quickActionsTitle: "Actions rapides",
  quickActions: {
    mood: "Humeur",
    period: "Règles",
    symptom: "Symptômes",
  },
  periodDay: "Jour de règles",
  symptoms: "Symptômes",
  mood: "Humeur",
  cycleFactors: "Facteurs du cycle",
  cycleFactorsHint:
    "Étiquettes de contexte facultatives pour les éléments qui peuvent influencer le rythme du cycle.",
  intimacy: "Intimité",
  cervicalMucus: "Glaire cervicale",
  cervicalMucusExplainer:
    "La glaire cervicale correspond aux pertes vaginales. Une glaire type blanc d'œuf apparaît souvent près du pic de fertilité.",
  bbt: "TBC",
  notes: "Notes",
  manualCycleStart: "Marquer un nouveau début de cycle",
  cancelAction: "Annuler",
  manualCycleStartSaved: "Début du cycle mis à jour localement.",
  manualCycleStartFailed:
    "Impossible de marquer un nouveau début de cycle. Réessaie.",
  invalidCycleStartDate:
    "Un nouveau début de cycle peut être marqué uniquement pour des jours passés et au maximum 2 jours à l'avance.",
  cycleStartSuggestion:
    "Cela peut être le premier jour de tes règles. Si c'est le cas, marque-le comme nouveau début de cycle.",
  cycleStartReplaceMessage:
    "Tu as déjà marqué un début de cycle le %s. Le remplacer par %s ?",
  cycleStartReplaceAccept: "Remplacer",
  cycleStartReplaceRequired:
    "Confirme le remplacement du début de cycle déjà marqué.",
  cycleStartShortGapMessage:
    "⚠️ Seulement %s jours se sont écoulés depuis le cycle précédent. Ce n'est peut-être pas un nouveau cycle. Date précédente : %s.",
  cycleStartShortGapAccept: "Marquer quand même",
  cycleStartConfirmationRequired:
    "Confirme le marquage d'un début de cycle avec un intervalle court.",
  futureCycleStartNotice:
    "Les prédictions seront recalculées lorsque ce jour arrivera.",
  implantationWarning:
    "Cela peut être un saignement d'implantation et non un nouveau cycle. Si tu essaies de concevoir, pense à faire un test.",
};

const dashboardCopyCatalog: Record<InterfaceLanguage, DashboardCopy> = {
  en: dashboardCopyEn,
  ru: {
    cycleDay: "День цикла",
    nextPeriod: "Следующая менструация",
    nextPeriodUnknown: "неизвестно",
    nextPeriodPrompt: "Введите дату начала последнего цикла",
    approximateDatePrefix: "примерно",
    ovulation: "Овуляция",
    ovulationUnavailable: "Не вычисляется",
    predictionsOff: "Предсказания выключены",
    predictionsApproximateHint:
      "В режиме нерегулярного цикла предсказания остаются видимыми, но их нужно читать как приблизительный ориентир, а не как точные даты.",
    factsOnlyHint:
      "В непредсказуемом режиме Ovumcy показывает только записанные факты.",
    todayEditor: "Сегодняшний журнал",
    quickActionsTitle: "Быстрые действия",
    quickActions: {
      mood: "Настроение",
      period: "Менструация",
      symptom: "Симптомы",
    },
    periodDay: "День менструации",
    symptoms: "Симптомы",
    mood: "Настроение",
    cycleFactors: "Факторы цикла",
    cycleFactorsHint:
      "Необязательные теги-контекст, которые могут влиять на тайминг цикла.",
    intimacy: "Близость",
    cervicalMucus: "Цервикальная слизь",
    cervicalMucusExplainer:
      "Цервикальная слизь означает вагинальные выделения. Выделения как яичный белок обычно появляются ближе к пику фертильности.",
    bbt: "БТТ",
    notes: "Заметки",
    manualCycleStart: "Отметить новое начало цикла",
    cancelAction: "Отмена",
    manualCycleStartSaved: "Начало цикла обновлено локально.",
    manualCycleStartFailed:
      "Не удалось отметить новое начало цикла. Попробуйте ещё раз.",
    invalidCycleStartDate:
      "Новое начало цикла можно отмечать только для прошедших дней и не более чем на 2 дня вперёд.",
    cycleStartSuggestion:
      "Это может быть первый день менструации. Если да, отметьте его как новое начало цикла.",
    cycleStartReplaceMessage:
      "Вы уже отметили начало цикла %s. Заменить его на %s?",
    cycleStartReplaceAccept: "Заменить",
    cycleStartReplaceRequired:
      "Подтвердите замену уже отмеченного начала цикла.",
    cycleStartShortGapMessage:
      "⚠️ С прошлого цикла прошло только %s дней. Возможно, это не новый цикл. Предыдущая дата: %s.",
    cycleStartShortGapAccept: "Отметить всё равно",
    cycleStartConfirmationRequired:
      "Подтвердите отметку начала цикла при коротком интервале.",
    futureCycleStartNotice:
      "Предсказания будут пересчитаны, когда наступит этот день.",
    implantationWarning:
      "Это может быть имплантационное кровотечение, а не новый цикл. Если вы пытаетесь зачать, подумайте о тесте.",
  },
  es: {
    cycleDay: "Día del ciclo",
    nextPeriod: "Próximo período",
    nextPeriodUnknown: "desconocido",
    nextPeriodPrompt: "Introduce la fecha de inicio de tu último ciclo",
    approximateDatePrefix: "aproximadamente",
    ovulation: "Ovulación",
    ovulationUnavailable: "No se puede calcular",
    predictionsOff: "Predicciones desactivadas",
    predictionsApproximateHint:
      "El modo de ciclo irregular mantiene visibles las predicciones, pero deben leerse como una guía aproximada y no como fechas exactas.",
    factsOnlyHint:
      "En el modo de ciclo impredecible, Ovumcy muestra solo hechos registrados.",
    todayEditor: "Registro de hoy",
    quickActionsTitle: "Acciones rápidas",
    quickActions: {
      mood: "Ánimo",
      period: "Período",
      symptom: "Síntomas",
    },
    periodDay: "Día de período",
    symptoms: "Síntomas",
    mood: "Ánimo",
    cycleFactors: "Factores del ciclo",
    cycleFactorsHint:
      "Etiquetas opcionales para cosas que pueden afectar el momento del ciclo.",
    intimacy: "Intimidad",
    cervicalMucus: "Moco cervical",
    cervicalMucusExplainer:
      "Moco cervical significa flujo vaginal. El moco tipo clara de huevo suele aparecer cerca del pico fértil.",
    bbt: "TCB",
    notes: "Notas",
    manualCycleStart: "Marcar nuevo inicio de ciclo",
    cancelAction: "Cancelar",
    manualCycleStartSaved: "Inicio de ciclo actualizado localmente.",
    manualCycleStartFailed:
      "No se pudo marcar un nuevo inicio de ciclo. Inténtalo de nuevo.",
    invalidCycleStartDate:
      "Solo se puede marcar un nuevo inicio de ciclo para días pasados y no más de 2 días hacia adelante.",
    cycleStartSuggestion:
      "Puede ser el primer día de tu período. Si es así, márcalo como un nuevo inicio de ciclo.",
    cycleStartReplaceMessage:
      "Ya marcaste un inicio de ciclo el %s. ¿Reemplazarlo por %s?",
    cycleStartReplaceAccept: "Reemplazar",
    cycleStartReplaceRequired:
      "Confirma el reemplazo del inicio de ciclo ya marcado.",
    cycleStartShortGapMessage:
      "⚠️ Solo han pasado %s días desde el ciclo anterior. Puede que no sea un ciclo nuevo. Fecha anterior: %s.",
    cycleStartShortGapAccept: "Marcar de todos modos",
    cycleStartConfirmationRequired:
      "Confirma marcar un inicio de ciclo con un intervalo corto.",
    futureCycleStartNotice:
      "Las predicciones se recalcularán cuando llegue ese día.",
    implantationWarning:
      "Esto puede ser sangrado de implantación y no un nuevo ciclo. Si buscas embarazo, considera hacerte una prueba.",
  },
  de: dashboardCopyDe,
  fr: dashboardCopyFr,
};

export function getDashboardCopy(language: string | null | undefined) {
  return dashboardCopyCatalog[resolveCopyLanguage(language)];
}

export const dashboardCopy = dashboardCopyEn;
