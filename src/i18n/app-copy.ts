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
      day1Tip: "Day 1 is the first day of full flow, not spotting.",
      dismissTip: "Dismiss note",
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
      infoCycleLong:
        "A cycle longer than 45 days is less common; please discuss with a doctor.",
      infoCycleShort:
        "A cycle shorter than 24 days is less common; please discuss with a doctor.",
      autoPeriodFill: "Auto-mark period days",
      autoPeriodFillHint:
        "When enabled, marking the first day auto-fills the next days based on your period length.",
      predictionMode: "How predictable is your cycle?",
      predictionModeHint: "Choose the option that sounds most like you.",
      predictionModeRegular: "Usually regular",
      predictionModeRegularHint: "Show usual predictions.",
      predictionModeIrregular: "Usually irregular",
      predictionModeIrregularHint: "Show approximate dates.",
      predictionModeFactsOnly: "No predictions",
      predictionModeFactsOnlyHint: "Show your records only.",
      ageGroup: "Your age",
      ageGroupHint:
        "Optional. Stored with your profile; predictions use only your own cycle history.",
      usageGoal: "Why are you using Ovumcy?",
      usageGoalHint:
        "Optional. This changes UI emphasis only, not the prediction algorithm.",
    },
    ageGroup: {
      under40: "Under 40",
      age40to45: "40-45",
      age45plus: "45+",
    },
    usageGoal: {
      avoidPregnancy: "Avoid pregnancy",
      tryingToConceive: "Trying to conceive",
      health: "General cycle tracking",
    },
    errors: {
      dateRequired: "Please select a date.",
      dismissError: "Dismiss error",
      invalidLastPeriodStart: "Please select a valid last period start date.",
      lastPeriodRange: "Choose a date within the last 60 days.",
      generic: "Failed to save onboarding data. Please try again.",
    },
    loading: "Loading your local setup…",
  },
} as const;

type AppCopy = WidenLiteral<typeof appCopyEn>;

const appCopyDe: AppCopy = {
  appInfo: {
    name: "Ovumcy",
    tagline: "Lokales Zyklus-Tracking für iOS und Android.",
  },
  onboarding: {
    progress: {
      step1: "Schritt 1 von 2",
      step2: "Schritt 2 von 2",
    },
    buttons: {
      back: "Zurück",
      next: "Weiter",
      finish: "Fertig",
    },
    step1: {
      title: "Wann hat deine letzte Periode begonnen?",
      subtitle: "Wähle ein Datum aus den letzten 60 Tagen.",
      day1Tip: "Tag 1 ist der erste Tag mit voller Blutung, nicht Schmierblutung.",
      dismissTip: "Hinweis schließen",
      today: "Heute",
      yesterday: "Gestern",
      twoDaysAgo: "Vor 2 Tagen",
      datePlaceholder: "tt.mm.jjjj",
      selectedDate: "Ausgewähltes Datum",
    },
    step2: {
      title: "Zyklusparameter einrichten",
      cycleLength: "Übliche Zykluslänge",
      daysShort: "T",
      cycleLengthHint:
        "Stelle den Regler auf die Zykluslänge ein, die du normalerweise vom Beginn einer Periode bis zum Beginn der nächsten siehst. Ein häufiger Ausgangswert liegt bei etwa 21 bis 35 Tagen.",
      periodLength: "Periodendauer",
      periodLengthHint:
        "Das ist die Anzahl der Tage mit echter Blutung, nicht mit Schmierblutung davor.",
      errorIncompatible:
        "Die Periodendauer passt nicht zur Zykluslänge. Die Menstruation kann nicht fast den ganzen Zyklus einnehmen.",
      warningApproximate:
        "Mit diesen Werten lässt sich der Eisprung nicht zuverlässig berechnen. Die Vorhersage wird nur ungefähr sein.",
      infoAdjusted:
        "Die Periodendauer wurde automatisch angepasst, damit mindestens 10 Tage bis zum nächsten Zyklus bleiben.",
      infoPeriodLong:
        "Eine Dauer von mehr als 8 Tagen kann auf Zyklusunregelmäßigkeiten hinweisen. Sprich darüber mit einer Ärztin oder einem Arzt.",
      infoCycleLong:
        "Ein Zyklus von mehr als 45 Tagen ist seltener. Sprich darüber mit einer Ärztin oder einem Arzt.",
      infoCycleShort:
        "Ein Zyklus unter 24 Tagen ist seltener. Sprich darüber mit einer Ärztin oder einem Arzt.",
      autoPeriodFill: "Periodentage automatisch markieren",
      autoPeriodFillHint:
        "Wenn diese Option aktiviert ist, füllt das Markieren des ersten Tages die folgenden Tage automatisch auf Basis deiner Periodendauer aus.",
      predictionMode: "Wie vorhersagbar ist dein Zyklus?",
      predictionModeHint: "Wähle die Option, die am ehesten zu dir passt.",
      predictionModeRegular: "Meist regelmäßig",
      predictionModeRegularHint: "Normale Vorhersagen anzeigen.",
      predictionModeIrregular: "Meist unregelmäßig",
      predictionModeIrregularHint: "Ungefähre Daten anzeigen.",
      predictionModeFactsOnly: "Keine Vorhersagen",
      predictionModeFactsOnlyHint: "Nur deine Einträge anzeigen.",
      ageGroup: "Dein Alter",
      ageGroupHint:
        "Optional. Wird mit Ihrem Profil gespeichert; Vorhersagen verwenden ausschließlich Ihre eigene Zyklushistorie.",
      usageGoal: "Wofür nutzt du Ovumcy?",
      usageGoalHint:
        "Optional. Das verändert nur die Betonung in der Oberfläche, nicht den Vorhersagealgorithmus.",
    },
    ageGroup: {
      under40: "Unter 40",
      age40to45: "40-45",
      age45plus: "45+",
    },
    usageGoal: {
      avoidPregnancy: "Schwangerschaft vermeiden",
      tryingToConceive: "Schwanger werden",
      health: "Allgemeines Zyklus-Tracking",
    },
    errors: {
      dateRequired: "Bitte wähle ein Datum aus.",
      dismissError: "Fehler schließen",
      invalidLastPeriodStart:
        "Bitte wähle ein gültiges Startdatum für deine letzte Periode aus.",
      lastPeriodRange: "Wähle ein Datum innerhalb der letzten 60 Tage aus.",
      generic:
        "Die Onboarding-Daten konnten nicht gespeichert werden. Bitte versuche es erneut.",
    },
    loading: "Deine lokale Einrichtung wird geladen…",
  },
};

const appCopyFr: AppCopy = {
  appInfo: {
    name: "Ovumcy",
    tagline: "Suivi du cycle en local pour iOS et Android.",
  },
  onboarding: {
    progress: {
      step1: "Étape 1 sur 2",
      step2: "Étape 2 sur 2",
    },
    buttons: {
      back: "Retour",
      next: "Suivant",
      finish: "Terminer",
    },
    step1: {
      title: "Quand tes dernières règles ont-elles commencé ?",
      subtitle: "Choisis une date dans les 60 derniers jours.",
      day1Tip: "Le jour 1 est le premier jour de flux abondant, pas de spotting.",
      dismissTip: "Fermer la note",
      today: "Aujourd'hui",
      yesterday: "Hier",
      twoDaysAgo: "Il y a 2 jours",
      datePlaceholder: "jj.mm.aaaa",
      selectedDate: "Date sélectionnée",
    },
    step2: {
      title: "Configurer les paramètres du cycle",
      cycleLength: "Durée habituelle du cycle",
      daysShort: "j",
      cycleLengthHint:
        "Déplace le curseur vers la durée du cycle que tu observes habituellement entre le début d'une période et le début de la suivante. Une base fréquente se situe autour de 21 à 35 jours.",
      periodLength: "Durée des règles",
      periodLengthHint:
        "Il s'agit du nombre de jours avec un vrai flux, pas des légers saignements avant.",
      errorIncompatible:
        "La durée des règles n'est pas compatible avec la durée du cycle. Les règles ne peuvent pas occuper presque tout le cycle.",
      warningApproximate:
        "Avec ces valeurs, l'ovulation ne peut pas être calculée de façon fiable. La prédiction sera approximative.",
      infoAdjusted:
        "La durée des règles a été ajustée automatiquement pour qu'il reste au moins 10 jours avant le cycle suivant.",
      infoPeriodLong:
        "Une durée supérieure à 8 jours peut indiquer des irrégularités du cycle. Parles-en avec un médecin.",
      infoCycleLong:
        "Un cycle de plus de 45 jours est moins courant. Parles-en avec un médecin.",
      infoCycleShort:
        "Un cycle inférieur à 24 jours est moins courant. Parles-en avec un médecin.",
      autoPeriodFill: "Marquer automatiquement les jours de règles",
      autoPeriodFillHint:
        "Quand cette option est activée, marquer le premier jour remplit automatiquement les jours suivants selon la durée de tes règles.",
      predictionMode: "À quel point ton cycle est-il prévisible ?",
      predictionModeHint: "Choisis l'option qui te correspond le mieux.",
      predictionModeRegular: "Plutôt régulier",
      predictionModeRegularHint: "Afficher les prédictions habituelles.",
      predictionModeIrregular: "Plutôt irrégulier",
      predictionModeIrregularHint: "Afficher des dates approximatives.",
      predictionModeFactsOnly: "Pas de prédictions",
      predictionModeFactsOnlyHint: "Afficher seulement tes enregistrements.",
      ageGroup: "Ton âge",
      ageGroupHint:
        "Optionnel. Enregistré avec votre profil ; les prédictions n'utilisent que votre propre historique de cycles.",
      usageGoal: "Pourquoi utilises-tu Ovumcy ?",
      usageGoalHint:
        "Optionnel. Cela change seulement l'accent mis dans l'interface, pas l'algorithme de prédiction.",
    },
    ageGroup: {
      under40: "Moins de 40 ans",
      age40to45: "40-45",
      age45plus: "45+",
    },
    usageGoal: {
      avoidPregnancy: "Éviter une grossesse",
      tryingToConceive: "Essayer de concevoir",
      health: "Suivi général du cycle",
    },
    errors: {
      dateRequired: "Veuillez sélectionner une date.",
      dismissError: "Fermer l'erreur",
      invalidLastPeriodStart:
        "Veuillez sélectionner une date valide de début des dernières règles.",
      lastPeriodRange: "Choisissez une date dans les 60 derniers jours.",
      generic:
        "Impossible d'enregistrer les données de configuration. Réessaie.",
    },
    loading: "Chargement de ta configuration locale…",
  },
};

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
        day1Tip: "День 1 — это первый день полноценного кровотечения, а не мажущих выделений.",
        dismissTip: "Скрыть подсказку",
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
        infoCycleLong:
          "Цикл длиннее 45 дней встречается реже; обсудите это с врачом.",
        infoCycleShort:
          "Цикл короче 24 дней встречается реже; обсудите это с врачом.",
        autoPeriodFill: "Автоматически отмечать дни менструации",
        autoPeriodFillHint:
          "Когда опция включена, отметка первого дня автоматически заполнит следующие дни на основе длительности менструации.",
        predictionMode: "Насколько предсказуем ваш цикл?",
        predictionModeHint: "Выберите вариант, который вам ближе.",
        predictionModeRegular: "Обычно регулярный",
        predictionModeRegularHint: "Показывать обычные предсказания.",
        predictionModeIrregular: "Обычно нерегулярный",
        predictionModeIrregularHint: "Показывать примерные даты.",
        predictionModeFactsOnly: "Без предсказаний",
        predictionModeFactsOnlyHint: "Показывать только ваши записи.",
        ageGroup: "Ваш возраст",
        ageGroupHint:
          "Необязательно. Сохраняется в профиле; прогнозы строятся только по вашей истории циклов.",
        usageGoal: "Зачем вы используете Ovumcy?",
        usageGoalHint:
          "Необязательно. Это меняет только акценты интерфейса, а не алгоритм предсказания.",
      },
      ageGroup: {
        under40: "Младше 40",
        age40to45: "40-45",
        age45plus: "45+",
      },
      usageGoal: {
        avoidPregnancy: "Избежать беременности",
        tryingToConceive: "Пытаюсь зачать",
        health: "Общий трекинг цикла",
      },
      errors: {
        dateRequired: "Пожалуйста, выберите дату.",
        dismissError: "Скрыть ошибку",
        invalidLastPeriodStart:
          "Пожалуйста, выберите корректную дату начала последней менструации.",
        lastPeriodRange: "Выберите дату в пределах последних 60 дней.",
        generic: "Не удалось сохранить введённые данные. Попробуйте ещё раз.",
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
        day1Tip: "El día 1 es el primer día de flujo completo, no de manchado.",
        dismissTip: "Cerrar nota",
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
        infoCycleLong:
          "Un ciclo de más de 45 días es menos común; coméntalo con un médico.",
        infoCycleShort:
          "Un ciclo más corto de 24 días es menos común; coméntalo con un médico.",
        autoPeriodFill: "Marcar automáticamente los días del período",
        autoPeriodFillHint:
          "Cuando está activado, marcar el primer día completa automáticamente los días siguientes según la duración del período.",
        predictionMode: "¿Qué tan predecible es tu ciclo?",
        predictionModeHint: "Elige la opción que más se parece a ti.",
        predictionModeRegular: "Suele ser regular",
        predictionModeRegularHint: "Mostrar predicciones normales.",
        predictionModeIrregular: "Suele ser irregular",
        predictionModeIrregularHint: "Mostrar fechas aproximadas.",
        predictionModeFactsOnly: "Sin predicciones",
        predictionModeFactsOnlyHint: "Mostrar solo tus registros.",
        ageGroup: "Tu edad",
        ageGroupHint:
          "Opcional. Se guarda con tu perfil; las predicciones usan solo tu propio historial de ciclos.",
        usageGoal: "¿Por qué usas Ovumcy?",
        usageGoalHint:
          "Opcional. Esto solo cambia el énfasis de la interfaz, no el algoritmo de predicción.",
      },
      ageGroup: {
        under40: "Menos de 40",
        age40to45: "40-45",
        age45plus: "45+",
      },
      usageGoal: {
        avoidPregnancy: "Evitar embarazo",
        tryingToConceive: "Intentar concebir",
        health: "Seguimiento general del ciclo",
      },
      errors: {
        dateRequired: "Selecciona una fecha.",
        dismissError: "Cerrar error",
        invalidLastPeriodStart:
          "Selecciona una fecha válida de inicio del último período.",
        lastPeriodRange: "Elige una fecha dentro de los últimos 60 días.",
        generic: "No se pudieron guardar los datos iniciales. Inténtalo de nuevo.",
      },
      loading: "Cargando tu configuración local…",
    },
  },
  de: appCopyDe,
  fr: appCopyFr,
};

export function getAppInfo(language: string | null | undefined) {
  return appCopyCatalog[resolveCopyLanguage(language)].appInfo;
}

export function getOnboardingCopy(language: string | null | undefined) {
  return appCopyCatalog[resolveCopyLanguage(language)].onboarding;
}

export const appInfo = appCopyEn.appInfo;
export const onboardingCopy = appCopyEn.onboarding;
