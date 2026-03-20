import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const appCopyEn = {
  appInfo: {
    name: "Ovumcy",
    tagline: "Local-first cycle tracking for iOS and Android.",
  },
  onboarding: {
    progress: {
      step1: "Step 1 of 2",
      step2: "Step 2 of 2",
    },
    buttons: {
      back: "Back",
      next: "Next",
      finish: "Finish",
    },
    step1: {
      title: "When did your last period start?",
      subtitle: "Choose a date from the last 60 days.",
      field: "Last period start date",
      day1Tip: "Day 1 is the first day of full flow, not spotting.",
      privacy:
        "All your data stays on this device unless you choose sync later. Core tracking does not require an account.",
        today: "Today",
        yesterday: "Yesterday",
        twoDaysAgo: "2 days ago",
        datePlaceholder: "dd.mm.yyyy",
        selectedDate: "Selected date",
    },
    step2: {
      title: "Set up cycle parameters",
      cycleLength: "Typical cycle length",
      daysShort: "d",
      cycleLengthHint:
        "Move the slider to the cycle length you usually see from one period start to the next. A common baseline is about 21-35 days.",
      periodLength: "Period duration",
      periodLengthHint:
        "This is the number of days with actual period flow, not spotting before it starts.",
      errorIncompatible:
        "Period duration is incompatible with cycle length. Menstruation cannot take up almost the whole cycle.",
      warningApproximate:
        "With these values, ovulation cannot be calculated reliably. Prediction will be approximate.",
      infoAdjusted:
        "Period length was adjusted automatically so at least 10 days remain before the next cycle.",
      infoPeriodLong:
        "A duration above 8 days may indicate cycle irregularities; please discuss with a doctor.",
      infoCycleShort:
        "A cycle shorter than 24 days is less common; please discuss with a doctor.",
      autoPeriodFill: "Auto-mark period days",
      autoPeriodFillHint:
        "When enabled, marking the first day auto-fills the next days based on your period length.",
      irregularCycle: "My cycle is usually irregular",
      irregularCycleHint:
        "Turn this on if your cycles vary by more than 7 days. Ovumcy still shows predictions, but they should be read as approximate guidance.",
      ageGroup: "Your age",
      ageGroupHint:
        "Optional. Right now this adds age-related context in Insights only. It does not change cycle calculations.",
      usageGoal: "Why are you using Ovumcy?",
      usageGoalHint:
        "Optional. This changes UI emphasis only, not the prediction algorithm.",
    },
    ageGroup: {
      under20: "Under 20",
      age20to35: "20-35",
      age35plus: "35+",
    },
    usageGoal: {
      avoidPregnancy: "Avoid pregnancy",
      tryingToConceive: "Trying to conceive",
      health: "General cycle tracking",
    },
    errors: {
      dateRequired: "Please select a date.",
      invalidLastPeriodStart: "Please select a valid last period start date.",
      lastPeriodRange: "Choose a date within the last 60 days.",
      generic: "Failed to save onboarding data. Please try again.",
    },
    loading: "Loading your local setup…",
  },
} as const;

type AppCopy = WidenLiteral<typeof appCopyEn>;

const appCopyCatalog: Record<InterfaceLanguage, AppCopy> = {
  en: appCopyEn,
  ru: {
    appInfo: {
      name: "Ovumcy",
      tagline: "Локальный трекер цикла для iOS и Android.",
    },
    onboarding: {
      progress: {
        step1: "Шаг 1 из 2",
        step2: "Шаг 2 из 2",
      },
      buttons: {
        back: "Назад",
        next: "Далее",
        finish: "Завершить",
      },
      step1: {
        title: "Когда началась последняя менструация?",
        subtitle: "Выберите дату за последние 60 дней.",
        field: "Дата начала последней менструации",
        day1Tip: "День 1 — это первый день полноценного кровотечения, а не мажущих выделений.",
        privacy:
          "Все данные остаются на этом устройстве, если позже вы не включите sync. Базовое ведение цикла не требует аккаунта.",
        today: "Сегодня",
        yesterday: "Вчера",
        twoDaysAgo: "2 дня назад",
        datePlaceholder: "дд.мм.гггг",
        selectedDate: "Выбранная дата",
      },
      step2: {
        title: "Настройте параметры цикла",
        cycleLength: "Типичная длина цикла",
        daysShort: "д",
        cycleLengthHint:
          "Передвиньте ползунок к длине цикла, которую вы обычно видите от начала одной менструации до начала следующей. Частый базовый диапазон — около 21-35 дней.",
        periodLength: "Длительность менструации",
        periodLengthHint:
          "Это число дней с полноценным кровотечением, а не с мажущими выделениями до него.",
        errorIncompatible:
          "Длительность менструации несовместима с длиной цикла. Менструация не может занимать почти весь цикл.",
        warningApproximate:
          "С такими значениями овуляцию нельзя вычислить надёжно. Предсказание будет приблизительным.",
        infoAdjusted:
          "Длительность менструации была автоматически скорректирована, чтобы до следующего цикла оставалось минимум 10 дней.",
        infoPeriodLong:
          "Длительность более 8 дней может указывать на нерегулярность цикла; обсудите это с врачом.",
        infoCycleShort:
          "Цикл короче 24 дней встречается реже; обсудите это с врачом.",
        autoPeriodFill: "Автоматически отмечать дни менструации",
        autoPeriodFillHint:
          "Когда опция включена, отметка первого дня автоматически заполнит следующие дни на основе длительности менструации.",
        irregularCycle: "Мой цикл обычно нерегулярный",
        irregularCycleHint:
          "Включите, если ваши циклы отличаются более чем на 7 дней. Ovumcy всё ещё показывает предсказания, но их нужно читать как приблизительный ориентир.",
        ageGroup: "Ваш возраст",
        ageGroupHint:
          "Необязательно. Сейчас это добавляет только возрастной контекст в Insights и не меняет расчёт цикла.",
        usageGoal: "Зачем вы используете Ovumcy?",
        usageGoalHint:
          "Необязательно. Это меняет только акценты интерфейса, а не алгоритм предсказания.",
      },
      ageGroup: {
        under20: "Младше 20",
        age20to35: "20-35",
        age35plus: "35+",
      },
      usageGoal: {
        avoidPregnancy: "Избежать беременности",
        tryingToConceive: "Пытаюсь зачать",
        health: "Общий трекинг цикла",
      },
      errors: {
        dateRequired: "Пожалуйста, выберите дату.",
        invalidLastPeriodStart:
          "Пожалуйста, выберите корректную дату начала последней менструации.",
        lastPeriodRange: "Выберите дату в пределах последних 60 дней.",
        generic: "Не удалось сохранить onboarding-данные. Попробуйте ещё раз.",
      },
      loading: "Загружаем локальную настройку…",
    },
  },
  es: {
    appInfo: {
      name: "Ovumcy",
      tagline: "Seguimiento del ciclo local-first para iOS y Android.",
    },
    onboarding: {
      progress: {
        step1: "Paso 1 de 2",
        step2: "Paso 2 de 2",
      },
      buttons: {
        back: "Atrás",
        next: "Siguiente",
        finish: "Finalizar",
      },
      step1: {
        title: "¿Cuándo empezó tu último período?",
        subtitle: "Elige una fecha de los últimos 60 días.",
        field: "Fecha de inicio del último período",
        day1Tip: "El día 1 es el primer día de flujo completo, no de manchado.",
        privacy:
          "Todos tus datos permanecen en este dispositivo salvo que elijas sync más adelante. El seguimiento básico no requiere cuenta.",
        today: "Hoy",
        yesterday: "Ayer",
        twoDaysAgo: "Hace 2 días",
        datePlaceholder: "dd.mm.aaaa",
        selectedDate: "Fecha seleccionada",
      },
      step2: {
        title: "Configura los parámetros del ciclo",
        cycleLength: "Duración habitual del ciclo",
        daysShort: "d",
        cycleLengthHint:
          "Mueve el control hasta la duración del ciclo que sueles ver desde el inicio de un período hasta el siguiente. Un punto de partida común es entre 21 y 35 días.",
        periodLength: "Duración del período",
        periodLengthHint:
          "Es el número de días con flujo real, no el manchado previo.",
        errorIncompatible:
          "La duración del período es incompatible con la duración del ciclo. La menstruación no puede ocupar casi todo el ciclo.",
        warningApproximate:
          "Con estos valores no se puede calcular la ovulación con fiabilidad. La predicción será aproximada.",
        infoAdjusted:
          "La duración del período se ajustó automáticamente para que queden al menos 10 días antes del siguiente ciclo.",
        infoPeriodLong:
          "Una duración superior a 8 días puede indicar irregularidades; coméntalo con un médico.",
        infoCycleShort:
          "Un ciclo más corto de 24 días es menos común; coméntalo con un médico.",
        autoPeriodFill: "Marcar automáticamente los días del período",
        autoPeriodFillHint:
          "Cuando está activado, marcar el primer día completa automáticamente los días siguientes según la duración del período.",
        irregularCycle: "Mi ciclo suele ser irregular",
        irregularCycleHint:
          "Actívalo si tus ciclos varían más de 7 días. Ovumcy seguirá mostrando predicciones, pero deben leerse como una guía aproximada.",
        ageGroup: "Tu edad",
        ageGroupHint:
          "Opcional. Por ahora esto solo añade contexto relacionado con la edad en Insights. No cambia los cálculos del ciclo.",
        usageGoal: "¿Por qué usas Ovumcy?",
        usageGoalHint:
          "Opcional. Esto solo cambia el énfasis de la interfaz, no el algoritmo de predicción.",
      },
      ageGroup: {
        under20: "Menos de 20",
        age20to35: "20-35",
        age35plus: "35+",
      },
      usageGoal: {
        avoidPregnancy: "Evitar embarazo",
        tryingToConceive: "Intentar concebir",
        health: "Seguimiento general del ciclo",
      },
      errors: {
        dateRequired: "Selecciona una fecha.",
        invalidLastPeriodStart:
          "Selecciona una fecha válida de inicio del último período.",
        lastPeriodRange: "Elige una fecha dentro de los últimos 60 días.",
        generic: "No se pudieron guardar los datos iniciales. Inténtalo de nuevo.",
      },
      loading: "Cargando tu configuración local…",
    },
  },
};

export function getAppInfo(language: string | null | undefined) {
  return appCopyCatalog[resolveCopyLanguage(language)].appInfo;
}

export function getOnboardingCopy(language: string | null | undefined) {
  return appCopyCatalog[resolveCopyLanguage(language)].onboarding;
}

export const appInfo = appCopyEn.appInfo;
export const onboardingCopy = appCopyEn.onboarding;
