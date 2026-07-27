import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

const dashboardCopyEn = {
  cycleDay: "Cycle day",
  nextPeriod: "Next period",
  nextPeriodUnknown: "unknown",
  nextPeriodPrompt: "Enter the start date of your last cycle",
  nextPeriodNeedsMoreCycles: "3 cycles are needed for a reliable range",
  approximateDatePrefix: "around",
  ovulation: "Ovulation",
  ovulationUnavailable: "Cannot be calculated",
  ovulationRange: (startLabel: string, endLabel: string) =>
    `${startLabel} — ${endLabel}`,
  ovulationNeedsMoreCycles:
    "3 completed cycles are needed before an ovulation range can be shown",
  ovulationApproximate: "(approximate)",
  predictionsOff: "Predictions off",
  predictionsApproximateHint:
    "Irregular cycle mode keeps predictions visible, but they should be read as approximate guidance rather than exact dates.",
  predictionVariableRangesHint:
    "Your cycle length varies, so the next period is shown as a range rather than a single day.",
  factsOnlyHint:
    "Predictions are off in unpredictable cycle mode. Ovumcy shows recorded facts only.",
  pregnancyPausedHint:
    "Cycle predictions are paused after a positive pregnancy test. Log a new period to resume them.",
  predictionDisclaimer:
    "These are estimates, not medical advice or a method of contraception.",
  cycleHeroDayLabel: "Day",
  cycleHeroRegular: (days: number) => `Cycle ${days} days`,
  cycleHeroApproximate: "Approximate cycle",
  cycleHeroFactsOnly: "Predictions off",
  cycleHeroWaiting: "Add a cycle start",
  cycleHeroStale: "Cycle data may be outdated. Log your period when it starts.",
  cycleHeroPhaseCards: {
    period: "Period",
    follicular: "Follicular",
    ovulation: "Ovulation",
    luteal: "Luteal",
  },
  cycleHeroDayRange: (startDay: number, endDay: number) =>
    startDay === endDay ? `Day ${startDay}` : `Days ${startDay}-${endDay}`,
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
  saveMessageSelfCare: "Saved. Take care of yourself today 🌸",
  saveMessageFertile: "Saved. You are in your fertile window right now.",
  saveMessageNeutral: "Saved.",
  saveMessagePregnancyPaused:
    "Saved. Cycle predictions are paused after a positive pregnancy test. If you experience bleeding, pain, or dizziness, seek medical care promptly.",
  saveMessagePregnancyActive:
    "Saved. Cycle predictions are paused while a pregnancy is tracked. If you experience bleeding, pain, or dizziness, seek medical care promptly.",
  manualCycleStartFailed: "Unable to mark a new cycle start. Please try again.",
  invalidCycleStartDate:
    "A new cycle start can be marked only for today or past days.",
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
    "This early bleeding may not be the start of a new cycle — timing alone cannot tell. If you are trying to conceive, consider taking a test. If it comes with pain, dizziness, or heavy flow, seek medical advice promptly.",
} as const;

type DashboardCopy = WidenLiteral<typeof dashboardCopyEn>;

const dashboardCopyDe: DashboardCopy = {
  cycleDay: "Zyklustag",
  nextPeriod: "Nächste Periode",
  nextPeriodUnknown: "unbekannt",
  nextPeriodPrompt: "Geben Sie das Startdatum Ihres letzten Zyklus ein",
  nextPeriodNeedsMoreCycles:
    "Für einen verlässlichen Bereich werden 3 Zyklen benötigt",
  approximateDatePrefix: "etwa",
  ovulation: "Eisprung",
  ovulationUnavailable: "Nicht berechenbar",
  ovulationRange: (startLabel: string, endLabel: string) =>
    `${startLabel} — ${endLabel}`,
  ovulationNeedsMoreCycles:
    "3 abgeschlossene Zyklen sind nötig, bevor ein Eisprung-Bereich angezeigt werden kann",
  ovulationApproximate: "(ungefähr)",
  predictionsOff: "Vorhersagen aus",
  predictionsApproximateHint:
    "Im Modus für unregelmäßige Zyklen bleiben Vorhersagen sichtbar, sollten aber als ungefähre Orientierung statt als exakte Daten gelesen werden.",
  predictionVariableRangesHint:
    "Ihre Zykluslänge schwankt, daher wird die nächste Periode als Zeitraum statt als einzelner Tag angezeigt.",
  factsOnlyHint:
    "Im unvorhersagbaren Zyklusmodus zeigt Ovumcy nur erfasste Fakten an.",
  pregnancyPausedHint:
    "Nach einem positiven Schwangerschaftstest pausieren die Zyklusvorhersagen. Erfassen Sie eine neue Periode, um sie fortzusetzen.",
  predictionDisclaimer:
    "Dies sind Schätzungen, keine medizinische Beratung und keine Verhütungsmethode.",
  cycleHeroDayLabel: "Tag",
  cycleHeroRegular: (days: number) => `Zyklus ${days} Tage`,
  cycleHeroApproximate: "Ungefährer Zyklus",
  cycleHeroFactsOnly: "Vorhersagen aus",
  cycleHeroWaiting: "Zyklusbeginn ergänzen",
  cycleHeroStale:
    "Zyklusdaten könnten veraltet sein. Erfassen Sie Ihre Periode, sobald sie beginnt.",
  cycleHeroPhaseCards: {
    period: "Periode",
    follicular: "Follikelphase",
    ovulation: "Eisprung",
    luteal: "Lutealphase",
  },
  cycleHeroDayRange: (startDay: number, endDay: number) =>
    startDay === endDay ? `T. ${startDay}` : `T. ${startDay}-${endDay}`,
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
  saveMessageSelfCare: "Gespeichert. Achten Sie heute gut auf sich 🌸",
  saveMessageFertile: "Gespeichert. Sie befinden sich gerade in Ihrem fruchtbaren Fenster.",
  saveMessageNeutral: "Gespeichert.",
  saveMessagePregnancyPaused:
    "Gespeichert. Nach einem positiven Schwangerschaftstest sind die Zyklusvorhersagen pausiert. Bei Blutungen, Schmerzen oder Schwindel suchen Sie umgehend ärztliche Hilfe.",
  saveMessagePregnancyActive:
    "Gespeichert. Solange eine Schwangerschaft verfolgt wird, sind die Zyklusvorhersagen pausiert. Bei Blutungen, Schmerzen oder Schwindel suchen Sie umgehend ärztliche Hilfe.",
  manualCycleStartFailed:
    "Ein neuer Zyklusbeginn konnte nicht markiert werden. Bitte versuchen Sie es erneut.",
  invalidCycleStartDate:
    "Ein neuer Zyklusbeginn kann nur für heute oder vergangene Tage markiert werden.",
  cycleStartSuggestion:
    "Das könnte der erste Tag Ihrer Periode sein. Wenn ja, markieren Sie ihn als neuen Zyklusbeginn.",
  cycleStartReplaceMessage:
    "Sie haben bereits einen Zyklusbeginn am %s markiert. Durch %s ersetzen?",
  cycleStartReplaceAccept: "Ersetzen",
  cycleStartReplaceRequired:
    "Bestätigen Sie das Ersetzen des bereits markierten Zyklusbeginns.",
  cycleStartShortGapMessage:
    "⚠️ Seit dem vorherigen Zyklus sind erst %s Tage vergangen. Das ist vielleicht kein neuer Zyklus. Vorheriges Datum: %s.",
  cycleStartShortGapAccept: "Trotzdem markieren",
  cycleStartConfirmationRequired:
    "Bestätigen Sie das Markieren eines Zyklusbeginns mit kurzem Abstand.",
  futureCycleStartNotice:
    "Die Vorhersagen werden neu berechnet, wenn dieser Tag erreicht ist.",
  implantationWarning:
    "Diese frühe Blutung ist möglicherweise nicht der Beginn eines neuen Zyklus — allein am Zeitpunkt lässt sich das nicht erkennen. Wenn Sie schwanger werden möchten, ziehen Sie einen Test in Betracht. Bei Schmerzen, Schwindel oder starker Blutung suchen Sie umgehend ärztlichen Rat.",
};

const dashboardCopyFr: DashboardCopy = {
  cycleDay: "Jour du cycle",
  nextPeriod: "Prochaines règles",
  nextPeriodUnknown: "inconnu",
  nextPeriodPrompt: "Saisissez la date de début de votre dernier cycle",
  nextPeriodNeedsMoreCycles:
    "3 cycles sont nécessaires pour obtenir une plage fiable",
  approximateDatePrefix: "vers",
  ovulation: "Ovulation",
  ovulationUnavailable: "Impossible à calculer",
  ovulationRange: (startLabel: string, endLabel: string) =>
    `${startLabel} — ${endLabel}`,
  ovulationNeedsMoreCycles:
    "3 cycles terminés sont nécessaires avant d'afficher une plage d'ovulation",
  ovulationApproximate: "(approximatif)",
  predictionsOff: "Prédictions désactivées",
  predictionsApproximateHint:
    "Le mode cycle irrégulier garde les prédictions visibles, mais elles doivent être lues comme une indication approximative et non comme des dates exactes.",
  predictionVariableRangesHint:
    "La longueur de votre cycle varie, donc vos prochaines règles sont affichées sous forme de plage plutôt qu'une date unique.",
  factsOnlyHint:
    "En mode cycle imprévisible, Ovumcy affiche seulement les faits enregistrés.",
  pregnancyPausedHint:
    "Les prédictions de cycle sont en pause après un test de grossesse positif. Enregistrez de nouvelles règles pour les reprendre.",
  predictionDisclaimer:
    "Ce sont des estimations, pas un avis médical ni une méthode de contraception.",
  cycleHeroDayLabel: "Jour",
  cycleHeroRegular: (days: number) => `Cycle de ${days} jours`,
  cycleHeroApproximate: "Cycle approximatif",
  cycleHeroFactsOnly: "Prédictions désactivées",
  cycleHeroWaiting: "Ajoutez un début de cycle",
  cycleHeroStale:
    "Les données du cycle peuvent être obsolètes. Enregistrez vos règles dès qu'elles commencent.",
  cycleHeroPhaseCards: {
    period: "Règles",
    follicular: "Phase folliculaire",
    ovulation: "Ovulation",
    luteal: "Phase lutéale",
  },
  cycleHeroDayRange: (startDay: number, endDay: number) =>
    startDay === endDay ? `j. ${startDay}` : `j. ${startDay}-${endDay}`,
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
  bbt: "TB",
  notes: "Notes",
  manualCycleStart: "Marquer un nouveau début de cycle",
  cancelAction: "Annuler",
  manualCycleStartSaved: "Début du cycle mis à jour localement.",
  saveMessageSelfCare: "Enregistré. Prenez soin de vous aujourd'hui 🌸",
  saveMessageFertile: "Enregistré. Vous êtes actuellement dans votre fenêtre fertile.",
  saveMessageNeutral: "Enregistré.",
  saveMessagePregnancyPaused:
    "Enregistré. Après un test de grossesse positif, les prédictions de cycle sont en pause. En cas de saignement, de douleur ou de vertiges, consultez rapidement un médecin.",
  saveMessagePregnancyActive:
    "Enregistré. Pendant le suivi d'une grossesse, les prédictions de cycle sont en pause. En cas de saignement, de douleur ou de vertiges, consultez rapidement un médecin.",
  manualCycleStartFailed:
    "Impossible de marquer un nouveau début de cycle. Réessayez.",
  invalidCycleStartDate:
    "Un nouveau début de cycle peut être marqué uniquement pour aujourd'hui ou des jours passés.",
  cycleStartSuggestion:
    "Cela peut être le premier jour de vos règles. Si c'est le cas, marquez-le comme nouveau début de cycle.",
  cycleStartReplaceMessage:
    "Vous avez déjà marqué un début de cycle le %s. Le remplacer par %s ?",
  cycleStartReplaceAccept: "Remplacer",
  cycleStartReplaceRequired:
    "Confirmez le remplacement du début de cycle déjà marqué.",
  cycleStartShortGapMessage:
    "⚠️ Seulement %s jours se sont écoulés depuis le cycle précédent. Ce n'est peut-être pas un nouveau cycle. Date précédente : %s.",
  cycleStartShortGapAccept: "Marquer quand même",
  cycleStartConfirmationRequired:
    "Confirmez le marquage d'un début de cycle avec un intervalle court.",
  futureCycleStartNotice:
    "Les prédictions seront recalculées lorsque ce jour arrivera.",
  implantationWarning:
    "Ce saignement précoce n'est peut-être pas le début d'un nouveau cycle — le calendrier seul ne permet pas de le savoir. Si vous essayez de concevoir, pensez à faire un test. S'il s'accompagne de douleurs, de vertiges ou d'un flux abondant, consultez rapidement un médecin.",
};

const dashboardCopyCatalog: Record<InterfaceLanguage, DashboardCopy> = {
  en: dashboardCopyEn,
  ru: {
    cycleDay: "День цикла",
    nextPeriod: "Следующая менструация",
    nextPeriodUnknown: "неизвестно",
    nextPeriodPrompt: "Введите дату начала последнего цикла",
    nextPeriodNeedsMoreCycles: "нужно 3 цикла для точного диапазона",
    approximateDatePrefix: "примерно",
    ovulation: "Овуляция",
    ovulationUnavailable: "Не вычисляется",
    ovulationRange: (startLabel: string, endLabel: string) =>
      `${startLabel} — ${endLabel}`,
    ovulationNeedsMoreCycles:
      "нужно 3 завершённых цикла, чтобы показать диапазон овуляции",
    ovulationApproximate: "(приблизительно)",
    predictionsOff: "Прогнозы выключены",
    predictionsApproximateHint:
      "В режиме нерегулярного цикла прогнозы остаются видимыми, но их нужно читать как приблизительный ориентир, а не как точные даты.",
    predictionVariableRangesHint:
      "Длина цикла колеблется, поэтому следующая менструация показана диапазоном, а не одним днём.",
    factsOnlyHint:
      "В непредсказуемом режиме Ovumcy показывает только записанные факты.",
    pregnancyPausedHint:
      "Прогнозы цикла приостановлены после положительного теста на беременность. Отметьте начало новых месячных, чтобы возобновить их.",
    predictionDisclaimer:
      "Это оценки, а не медицинский совет и не метод контрацепции.",
    cycleHeroDayLabel: "День",
    cycleHeroRegular: (days: number) => `${days}-дневный цикл`,
    cycleHeroApproximate: "Примерный цикл",
    cycleHeroFactsOnly: "Прогнозы выключены",
    cycleHeroWaiting: "Добавьте начало цикла",
    cycleHeroStale:
      "Данные цикла могут быть устаревшими. Отметьте начало новых месячных, когда они начнутся.",
    cycleHeroPhaseCards: {
      period: "Месячные",
      follicular: "Фолликулярная",
      ovulation: "Овуляция",
      luteal: "Лютеиновая",
    },
    cycleHeroDayRange: (startDay: number, endDay: number) =>
      startDay === endDay ? `д. ${startDay}` : `д. ${startDay}-${endDay}`,
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
    saveMessageSelfCare: "Сохранено. Позаботьтесь о себе сегодня 🌸",
    saveMessageFertile: "Сохранено. Сейчас фертильный период.",
    saveMessageNeutral: "Сохранено.",
    saveMessagePregnancyPaused:
      "Сохранено. После положительного теста на беременность прогнозы цикла приостановлены. При кровотечении, боли или головокружении обратитесь к врачу без промедления.",
    saveMessagePregnancyActive:
      "Сохранено. Пока отслеживается беременность, прогнозы цикла приостановлены. При кровотечении, боли или головокружении обратитесь к врачу без промедления.",
    manualCycleStartFailed:
      "Не удалось отметить новое начало цикла. Попробуйте ещё раз.",
    invalidCycleStartDate:
      "Новое начало цикла можно отмечать только на сегодня или прошедшие дни.",
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
      "Прогнозы будут пересчитаны, когда наступит этот день.",
    implantationWarning:
      "Это раннее кровотечение может не быть началом нового цикла — по одним срокам определить нельзя. Если Вы планируете беременность, рекомендуем сделать тест. При боли, головокружении или обильном кровотечении обратитесь к врачу без промедления.",
  },
  es: {
    cycleDay: "Día del ciclo",
    nextPeriod: "Próximo período",
    nextPeriodUnknown: "desconocido",
    nextPeriodPrompt: "Introduce la fecha de inicio de tu último ciclo",
    nextPeriodNeedsMoreCycles: "se necesitan 3 ciclos para un rango fiable",
    approximateDatePrefix: "aproximadamente",
    ovulation: "Ovulación",
    ovulationUnavailable: "No se puede calcular",
    ovulationRange: (startLabel: string, endLabel: string) =>
      `${startLabel} — ${endLabel}`,
    ovulationNeedsMoreCycles:
      "se necesitan 3 ciclos completos antes de mostrar un rango de ovulación",
    ovulationApproximate: "(aproximada)",
    predictionsOff: "Predicciones desactivadas",
    predictionsApproximateHint:
      "El modo de ciclo irregular mantiene visibles las predicciones, pero deben leerse como una guía aproximada y no como fechas exactas.",
    predictionVariableRangesHint:
      "La duración de tu ciclo varía, así que tu próxima regla se muestra como un rango en lugar de un solo día.",
    factsOnlyHint:
      "En el modo de ciclo impredecible, Ovumcy muestra solo hechos registrados.",
    pregnancyPausedHint:
      "Las predicciones del ciclo están en pausa tras un test de embarazo positivo. Registra una nueva regla para reanudarlas.",
    predictionDisclaimer:
      "Son estimaciones, no consejo médico ni un método anticonceptivo.",
    cycleHeroDayLabel: "Día",
    cycleHeroRegular: (days: number) => `Ciclo de ${days} días`,
    cycleHeroApproximate: "Ciclo aproximado",
    cycleHeroFactsOnly: "Predicciones desactivadas",
    cycleHeroWaiting: "Añade un inicio de ciclo",
    cycleHeroStale:
      "Los datos del ciclo pueden estar desactualizados. Registra tu período cuando empiece.",
    cycleHeroPhaseCards: {
      period: "Período",
      follicular: "Folicular",
      ovulation: "Ovulación",
      luteal: "Lútea",
    },
    cycleHeroDayRange: (startDay: number, endDay: number) =>
      startDay === endDay ? `d. ${startDay}` : `d. ${startDay}-${endDay}`,
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
    bbt: "TBC",
    notes: "Notas",
    manualCycleStart: "Marcar nuevo inicio de ciclo",
    cancelAction: "Cancelar",
    manualCycleStartSaved: "Inicio de ciclo actualizado localmente.",
    saveMessageSelfCare: "Guardado. Cuídate hoy 🌸",
    saveMessageFertile: "Guardado. Ahora estás en tu ventana fértil.",
    saveMessageNeutral: "Guardado.",
    saveMessagePregnancyPaused:
      "Guardado. Tras una prueba de embarazo positiva, las predicciones del ciclo quedan en pausa. Si tienes sangrado, dolor o mareo, busca atención médica cuanto antes.",
    saveMessagePregnancyActive:
      "Guardado. Mientras se hace seguimiento de un embarazo, las predicciones del ciclo quedan en pausa. Si tienes sangrado, dolor o mareo, busca atención médica cuanto antes.",
    manualCycleStartFailed:
      "No se pudo marcar un nuevo inicio de ciclo. Inténtalo de nuevo.",
    invalidCycleStartDate:
      "Solo se puede marcar un nuevo inicio de ciclo para hoy o para días pasados.",
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
      "Este sangrado temprano puede no ser el inicio de un nuevo ciclo — solo por las fechas no se puede saber. Si buscas embarazo, considera hacerte una prueba. Si va acompañado de dolor, mareo o sangrado abundante, busca atención médica cuanto antes.",
  },
  it: {
    cycleDay: "Giorno del ciclo",
    nextPeriod: "Prossimo ciclo",
    nextPeriodUnknown: "sconosciuto",
    nextPeriodPrompt: "Inserisci la data di inizio del tuo ultimo ciclo",
    nextPeriodNeedsMoreCycles:
      "servono 3 cicli per un intervallo affidabile",
    approximateDatePrefix: "intorno al",
    ovulation: "Ovulazione",
    ovulationUnavailable: "Non può essere calcolata",
    ovulationRange: (startLabel: string, endLabel: string) =>
      `${startLabel} — ${endLabel}`,
    ovulationNeedsMoreCycles:
      "servono 3 cicli completati prima di mostrare un intervallo di ovulazione",
    ovulationApproximate: "(approssimativo)",
    predictionsOff: "Previsioni disattivate",
    predictionsApproximateHint:
      "La modalità ciclo irregolare mantiene visibili le previsioni, ma vanno lette come un'indicazione approssimativa e non come date esatte.",
    predictionVariableRangesHint:
      "La lunghezza del tuo ciclo varia, quindi il prossimo ciclo è mostrato come intervallo anziché come un singolo giorno.",
    factsOnlyHint:
      "In modalità ciclo imprevedibile le previsioni sono disattivate. Ovumcy mostra solo i fatti registrati.",
    pregnancyPausedHint:
      "Le previsioni del ciclo sono sospese dopo un test di gravidanza positivo. Registra un nuovo ciclo per riattivarle.",
    predictionDisclaimer:
      "Queste sono stime, non consigli medici né un metodo contraccettivo.",
    cycleHeroDayLabel: "Giorno",
    cycleHeroRegular: (days: number) => `Ciclo di ${days} giorni`,
    cycleHeroApproximate: "Ciclo approssimativo",
    cycleHeroFactsOnly: "Previsioni disattivate",
    cycleHeroWaiting: "Aggiungi un inizio del ciclo",
    cycleHeroStale:
      "I dati del ciclo potrebbero essere obsoleti. Registra il ciclo quando inizia.",
    cycleHeroPhaseCards: {
      period: "Ciclo",
      follicular: "Follicolare",
      ovulation: "Ovulazione",
      luteal: "Luteale",
    },
    cycleHeroDayRange: (startDay: number, endDay: number) =>
      startDay === endDay ? `g. ${startDay}` : `g. ${startDay}-${endDay}`,
    todayEditor: "Diario di oggi",
    quickActionsTitle: "Azioni rapide",
    quickActions: {
      mood: "Umore",
      period: "Ciclo",
      symptom: "Sintomi",
    },
    periodDay: "Giorno di ciclo",
    symptoms: "Sintomi",
    mood: "Umore",
    cycleFactors: "Fattori del ciclo",
    cycleFactorsHint:
      "Tag di contesto facoltativi per elementi che possono influenzare il timing del ciclo.",
    intimacy: "Intimità",
    cervicalMucus: "Muco cervicale",
    cervicalMucusExplainer:
      "Il muco cervicale indica le perdite vaginali. Il muco a consistenza di albume d'uovo di solito appare vicino al picco di fertilità.",
    bbt: "BBT",
    notes: "Note",
    manualCycleStart: "Segna inizio nuovo ciclo",
    cancelAction: "Annulla",
    manualCycleStartSaved: "Inizio ciclo aggiornato localmente.",
    saveMessageSelfCare: "Salvato. Prenditi cura di te oggi 🌸",
    saveMessageFertile: "Salvato. Sei nella tua finestra fertile in questo momento.",
    saveMessageNeutral: "Salvato.",
    saveMessagePregnancyPaused:
      "Salvato. Dopo un test di gravidanza positivo, le previsioni del ciclo sono in pausa. In caso di sanguinamento, dolore o vertigini, rivolgiti subito a un medico.",
    saveMessagePregnancyActive:
      "Salvato. Mentre è in corso il monitoraggio di una gravidanza, le previsioni del ciclo sono in pausa. In caso di sanguinamento, dolore o vertigini, rivolgiti subito a un medico.",
    manualCycleStartFailed:
      "Impossibile segnare un nuovo inizio ciclo. Riprova.",
    invalidCycleStartDate:
      "Un nuovo inizio ciclo può essere segnato solo per oggi o per giorni passati.",
    cycleStartSuggestion:
      "Questo potrebbe essere il primo giorno del tuo ciclo. Se lo è, segnalo come nuovo inizio ciclo.",
    cycleStartReplaceMessage:
      "Hai già segnato un inizio ciclo il %s. Sostituirlo con %s?",
    cycleStartReplaceAccept: "Sostituisci",
    cycleStartReplaceRequired:
      "Conferma la sostituzione dell'inizio ciclo già segnato.",
    cycleStartShortGapMessage:
      "⚠️ Sono passati solo %s giorni dal ciclo precedente. Potrebbe non trattarsi di un nuovo ciclo. Data precedente: %s.",
    cycleStartShortGapAccept: "Segna comunque",
    cycleStartConfirmationRequired:
      "Conferma la marcatura di un inizio ciclo con un intervallo breve.",
    futureCycleStartNotice:
      "Le previsioni saranno ricalcolate quando quel giorno arriverà.",
    implantationWarning:
      "Questo sanguinamento precoce potrebbe non essere l'inizio di un nuovo ciclo — dai soli tempi non si può stabilire. Se stai cercando una gravidanza, considera di fare un test. Se è accompagnato da dolore, vertigini o flusso abbondante, rivolgiti subito a un medico.",
  },
  de: dashboardCopyDe,
  fr: dashboardCopyFr,
};

export function getDashboardCopy(language: string | null | undefined) {
  return dashboardCopyCatalog[resolveCopyLanguage(language)];
}
