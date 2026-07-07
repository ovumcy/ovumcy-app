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
    "This may be implantation bleeding, not a new cycle. If you are trying to conceive, consider taking a test.",
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
    "Das könnte eine Einnistungsblutung und kein neuer Zyklus sein. Wenn Sie schwanger werden möchten, ziehen Sie einen Test in Betracht.",
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
    "Cela peut être un saignement d'implantation et non un nouveau cycle. Si vous essayez de concevoir, pensez à faire un test.",
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
      "Это может быть имплантационное кровотечение, а не новый цикл. Если вы пытаетесь зачать, подумайте о тесте.",
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
      "Esto puede ser sangrado de implantación y no un nuevo ciclo. Si buscas embarazo, considera hacerte una prueba.",
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
      "Potrebbe trattarsi di sanguinamento da impianto, non di un nuovo ciclo. Se stai cercando una gravidanza, considera di fare un test.",
  },
  de: dashboardCopyDe,
  fr: dashboardCopyFr,
};

export function getDashboardCopy(language: string | null | undefined) {
  return dashboardCopyCatalog[resolveCopyLanguage(language)];
}
