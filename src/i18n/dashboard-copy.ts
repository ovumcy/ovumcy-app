import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const dashboardCopyEn = {
  cycleDay: "Cycle day",
  nextPeriod: "Next period",
  nextPeriodUnknown: "unknown",
  nextPeriodNeedsCycles: "3 cycles are needed for a reliable range",
  nextPeriodPrompt: "Enter the start date of your last cycle",
  ovulation: "Ovulation",
  ovulationNeedsCycles:
    "3 completed cycles are needed before Ovumcy shows an ovulation range",
  ovulationUnavailable: "Cannot be calculated",
  predictionsOff: "Predictions off",
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
  intimacyHiddenHint: "This section is hidden in settings.",
  sexSettingsHint: "You can hide this section in settings.",
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

const dashboardCopyCatalog: Record<InterfaceLanguage, DashboardCopy> = {
  en: dashboardCopyEn,
  ru: {
    cycleDay: "День цикла",
    nextPeriod: "Следующая менструация",
    nextPeriodUnknown: "неизвестно",
    nextPeriodNeedsCycles: "Для надёжного диапазона нужно 3 цикла",
    nextPeriodPrompt: "Введите дату начала последнего цикла",
    ovulation: "Овуляция",
    ovulationNeedsCycles:
      "Нужно 3 завершённых цикла, прежде чем Ovumcy покажет диапазон овуляции",
    ovulationUnavailable: "Не вычисляется",
    predictionsOff: "Предсказания выключены",
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
    intimacyHiddenHint: "Этот раздел скрыт в настройках.",
    sexSettingsHint: "Этот раздел можно скрыть в настройках.",
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
    nextPeriodNeedsCycles: "Se necesitan 3 ciclos para un rango fiable",
    nextPeriodPrompt: "Introduce la fecha de inicio de tu último ciclo",
    ovulation: "Ovulación",
    ovulationNeedsCycles:
      "Se necesitan 3 ciclos completos antes de que Ovumcy muestre un rango de ovulación",
    ovulationUnavailable: "No se puede calcular",
    predictionsOff: "Predicciones desactivadas",
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
    intimacyHiddenHint: "Esta sección está oculta en ajustes.",
    sexSettingsHint: "Puedes ocultar esta sección en ajustes.",
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
};

export function getDashboardCopy(language: string | null | undefined) {
  return dashboardCopyCatalog[resolveCopyLanguage(language)];
}

export const dashboardCopy = dashboardCopyEn;
