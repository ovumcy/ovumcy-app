import type { InterfaceLanguage } from "../models/profile";
import type { PregnancyMilestoneID } from "../services/pregnancy-timeline-service";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

// Warm, neutral pregnancy-mode copy. Tone rules (SECURITY.md medical-safety
// invariant): education only, never diagnoses or outcome promises,
// no exclamation marks, milestone windows phrased as "commonly offered" rather
// than prescriptive. Milestone bodies map 1:1 to the WHO2016 milestone ids from
// pregnancy-timeline-service. en + ru are primary; de/fr/es/it are best-effort
// translations pending a native-speaker review before public launch.

type PregnancyMilestoneCopy = Record<
  PregnancyMilestoneID,
  { title: string; body: string }
>;

const pregnancyCopyEn = {
  entryCard: {
    eyebrow: "Pregnancy mode",
    unlockedTitle: "Track your pregnancy week by week",
    unlockedBody:
      "Switch to a pregnancy view with your estimated due date, a week-by-week timeline, and space to note weight and blood pressure. Your cycle history stays saved.",
    unlockedCta: "Set up pregnancy mode",
    lockedTitle: "Pregnancy mode is a one-time unlock",
    lockedBody:
      "Pregnancy mode is unlocked with a single purchase — no subscription needed. Everything you have already logged stays available on this device either way.",
    lockedCta: "Unlock pregnancy mode",
  },
  wizard: {
    title: "Set up pregnancy mode",
    subtitle:
      "We will estimate your due date from the date you choose. You can update it later from Manage pregnancy tracking if your clinician's dating differs.",
    basisStepTitle: "How would you like to set your due date?",
    basisOptions: {
      lmpLabel: "From my last period",
      lmpHint:
        "We will estimate the due date from the first day of your last period.",
      ultrasoundLabel: "From an ultrasound",
      ultrasoundHint: "Enter the estimated due date from a dating scan.",
      manualLabel: "Enter a due date",
      manualHint: "Enter an estimated due date you already have.",
    },
    dateStepTitle: "Enter your date",
    lmpDateLabel: "First day of your last period",
    eddDateLabel: "Estimated due date",
    datePlaceholder: "YYYY-MM-DD",
    previewTitle: "Preview",
    previewEddLabel: "Estimated due date",
    previewGaLabel: "Today that would put you at",
    previewEmpty: "Enter a date to see the estimate.",
    confirmStepTitle: "Confirm and start",
    confirmBasisLabel: "Based on",
    confirmBasisValue: {
      lmp: "Last period",
      ultrasound: "Ultrasound",
      manual: "Due date entered",
    },
    confirmEddLabel: "Estimated due date",
    confirmGaLabel: "Current week",
    // Multiples (education-only). Optional and skippable: the confirm
    // step's summary rows above cover the required fields; these two
    // questions are additive and never block Start. "One" always resolves to
    // an absent fetusCount (identical to never answering), so chorionicity
    // only opens once Twins/Triplets is chosen.
    multiplesQuestion: "How many babies?",
    multiplesOptions: {
      one: "One",
      twins: "Twins",
      tripletsPlus: "Triplets or more",
    },
    chorionicityQuestion: "Do you know the chorionicity?",
    chorionicityExplainer:
      "This is usually determined at the 11-14 week scan.",
    chorionicityOptions: {
      dcda: "DCDA (each baby has its own placenta)",
      mcda: "MCDA (shared placenta, separate sacs)",
      mcma: "MCMA (shared placenta and sac)",
      unknown: "I don't know",
    },
    backCta: "Back",
    nextCta: "Continue",
    confirmCta: "Start pregnancy mode",
    cancelCta: "Cancel",
    validation: {
      activeExists: "You already have an active pregnancy in Ovumcy.",
      missingDate: "Enter a date to continue.",
      invalidDate: "Enter a valid date as YYYY-MM-DD.",
      outOfRange:
        "That date is outside the range Ovumcy can track. Please check it and try again.",
      saveFailed: "We couldn't save this just now. Please try again.",
    },
  },
  hero: {
    eyebrow: "Pregnancy",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "weeks + days",
    trimesterLabels: {
      1: "First trimester",
      2: "Second trimester",
      3: "Third trimester",
    },
    eddCaption: "Estimated due date",
    daysToGo: (days: number) => `${days} days to go`,
    dayToGo: "1 day to go",
    dueToday: "Your due date is today",
    overdue: (days: number) => `${days} days past your due date`,
    overdueOne: "1 day past your due date",
  },
  milestones: {
    title: "Around this time",
    emptyLabel:
      "No common checkpoints fall in this week. Your care team will guide your schedule.",
    items: {
      nipt: {
        title: "Cell-free DNA screening (NIPT)",
        body: "A blood test some people are offered from about week 10 to screen for common chromosomal conditions.",
      },
      nt_scan: {
        title: "Nuchal translucency scan",
        body: "An ultrasound commonly offered around weeks 11-14 that includes the nuchal translucency measurement.",
      },
      anatomy_scan: {
        title: "Anatomy scan",
        body: "A detailed ultrasound commonly offered around weeks 18-22 to look at how the baby is growing.",
      },
      gdm_screen: {
        title: "Gestational diabetes screening",
        body: "Screening for gestational diabetes is commonly offered around weeks 24-28.",
      },
      anti_d: {
        title: "Anti-D, if Rh-negative",
        body: "If your blood type is Rh-negative, an anti-D injection is commonly offered around week 28. Your clinician will confirm.",
      },
      tdap: {
        title: "Whooping cough (Tdap) vaccine",
        body: "A Tdap vaccine is commonly offered in the late second or third trimester.",
      },
      gbs: {
        title: "Group B strep swab",
        body: "A group B strep swab is commonly offered around weeks 35-37.",
      },
      kick_counts_start: {
        title: "Noticing movements",
        body: "Many people start paying attention to daily movement patterns from around week 28.",
      },
      birth_prep: {
        title: "Preparing for labor",
        body: "Signs that labor may be starting, the 5-1-1 contraction guideline in Ovumcy's contraction timer, and when your care team told you to call or come in are all commonly discussed around this time.",
      },
    } satisfies PregnancyMilestoneCopy,
  },
  kickTeaser: {
    title: "Counting movements",
    body: "From around this week many people begin noticing daily movement patterns. Tap to open the kick counter.",
  },
  // Multiples content card (education-only). Shown on the dashboard when
  // the active record's fetusCount >= 2 -- see buildPregnancyDashboardViewData.
  // Neutral, no clinical verdicts: monitoring cadence and typical birth
  // timing are described as general patterns, not predictions for this
  // pregnancy. monoLine is appended only for monochorionic (mcda/mcma)
  // chorionicity; dcda/unknown/absent show the base body only.
  multiplesCard: {
    title: "More than one baby",
    body: "Twin and multiple pregnancies are usually monitored more closely, and often arrive earlier than the estimated due date. Your care team will guide the timing that's right for you.",
    monoLine:
      "Monochorionic twins (sharing one placenta) are commonly offered ultrasounds about every 2 weeks from around week 16.",
  },
  // Compact dashboard fallback for an active pregnancy record whose
  // estimated due date has drifted well past the trackable window -- see
  // buildPregnancyStaleCardViewData. ctaLabel is not part of this catalog; it
  // reuses pregnancy-end-copy's existing "manage pregnancy tracking" label.
  staleCard: {
    title: "Your pregnancy tracking",
    body: "Your estimated due date has passed a while ago. Review your pregnancy tracking to finish or update it.",
  },
  metrics: {
    title: "Today's measurements",
    emptyLabel: "No weight or blood pressure logged today.",
    weightLabel: "Weight",
    weightValue: (kilograms: number) => `${kilograms} kg`,
    bloodPressureLabel: "Blood pressure",
    bloodPressureValue: (systolic: number, diastolic: number) =>
      `${systolic}/${diastolic} mmHg`,
  },
  disclaimer:
    "These are general estimates, not medical advice. Timing and checkpoints vary from person to person. Talk to your doctor or midwife about your care and any concerns.",
} as const;

type PregnancyCopy = WidenLiteral<typeof pregnancyCopyEn>;

const pregnancyCopyRu: PregnancyCopy = {
  entryCard: {
    eyebrow: "Режим беременности",
    unlockedTitle: "Следите за беременностью неделя за неделей",
    unlockedBody:
      "Переключитесь на режим беременности с предполагаемой датой родов, понедельной шкалой и полем для веса и давления. История цикла сохраняется.",
    unlockedCta: "Настроить режим беременности",
    lockedTitle: "Режим беременности — разовая разблокировка",
    lockedBody:
      "Режим беременности разблокируется разовой покупкой — подписка не нужна. Всё, что уже записано, в любом случае остаётся доступным на этом устройстве.",
    lockedCta: "Разблокировать режим беременности",
  },
  wizard: {
    title: "Настройка режима беременности",
    subtitle:
      "Мы оценим дату родов по выбранной дате. Позже вы сможете изменить её в разделе «Управление отслеживанием беременности», если срок по данным врача будет отличаться.",
    basisStepTitle: "Как задать предполагаемую дату родов?",
    basisOptions: {
      lmpLabel: "По последней менструации",
      lmpHint:
        "Мы оценим дату родов по первому дню вашей последней менструации.",
      ultrasoundLabel: "По УЗИ",
      ultrasoundHint: "Введите предполагаемую дату родов по результатам УЗИ.",
      manualLabel: "Ввести дату родов",
      manualHint: "Введите предполагаемую дату родов, которая у вас уже есть.",
    },
    dateStepTitle: "Введите дату",
    lmpDateLabel: "Первый день последней менструации",
    eddDateLabel: "Предполагаемая дата родов",
    datePlaceholder: "ГГГГ-ММ-ДД",
    previewTitle: "Предпросмотр",
    previewEddLabel: "Предполагаемая дата родов",
    previewGaLabel: "На сегодня это соответствует сроку",
    previewEmpty: "Введите дату, чтобы увидеть оценку.",
    confirmStepTitle: "Подтверждение и начало",
    confirmBasisLabel: "На основе",
    confirmBasisValue: {
      lmp: "Последняя менструация",
      ultrasound: "УЗИ",
      manual: "Введённая дата родов",
    },
    confirmEddLabel: "Предполагаемая дата родов",
    confirmGaLabel: "Текущая неделя",
    multiplesQuestion: "Сколько малышей вы ждёте?",
    multiplesOptions: {
      one: "Один",
      twins: "Двойня",
      tripletsPlus: "Тройня и более",
    },
    chorionicityQuestion: "Известен ли тип хориальности?",
    chorionicityExplainer: "Обычно это определяют на УЗИ на 11-14-й неделе.",
    chorionicityOptions: {
      dcda: "ДХДА (у каждого малыша своя плацента)",
      mcda: "МХДА (общая плацента, отдельные плодные мешки)",
      mcma: "МХМА (общая плацента и общий плодный мешок)",
      unknown: "Не знаю",
    },
    backCta: "Назад",
    nextCta: "Продолжить",
    confirmCta: "Запустить режим беременности",
    cancelCta: "Отмена",
    validation: {
      activeExists: "У вас уже есть активная беременность в Ovumcy.",
      missingDate: "Введите дату, чтобы продолжить.",
      invalidDate: "Введите корректную дату в формате ГГГГ-ММ-ДД.",
      outOfRange:
        "Эта дата вне диапазона, который Ovumcy может отслеживать. Проверьте её и попробуйте снова.",
      saveFailed: "Не удалось сохранить сейчас. Попробуйте ещё раз.",
    },
  },
  hero: {
    eyebrow: "Беременность",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "недели + дни",
    trimesterLabels: {
      1: "Первый триместр",
      2: "Второй триместр",
      3: "Третий триместр",
    },
    eddCaption: "Предполагаемая дата родов",
    daysToGo: (days: number) => `осталось дней: ${days}`,
    dayToGo: "остался 1 день",
    dueToday: "Предполагаемая дата родов — сегодня",
    overdue: (days: number) => `дней после предполагаемой даты родов: ${days}`,
    overdueOne: "1 день после предполагаемой даты родов",
  },
  milestones: {
    title: "Примерно в это время",
    emptyLabel:
      "На этой неделе нет типовых контрольных точек. Ваш врач подскажет график.",
    items: {
      nipt: {
        title: "Неинвазивный пренатальный тест (НИПТ)",
        body: "Анализ крови, который иногда предлагают примерно с 10-й недели для скрининга частых хромосомных состояний.",
      },
      nt_scan: {
        title: "УЗИ воротникового пространства",
        body: "УЗИ, которое обычно предлагают примерно на 11-14-й неделях и которое включает измерение воротникового пространства.",
      },
      anatomy_scan: {
        title: "Скрининговое УЗИ анатомии",
        body: "Подробное УЗИ, которое обычно предлагают примерно на 18-22-й неделях, чтобы посмотреть, как растёт малыш.",
      },
      gdm_screen: {
        title: "Скрининг гестационного диабета",
        body: "Скрининг гестационного диабета обычно предлагают примерно на 24-28-й неделях.",
      },
      anti_d: {
        title: "Анти-D при отрицательном резусе",
        body: "Если у вас отрицательный резус-фактор, инъекцию анти-D обычно предлагают примерно на 28-й неделе. Врач это подтвердит.",
      },
      tdap: {
        title: "Прививка от коклюша (Tdap)",
        body: "Прививку Tdap обычно предлагают в конце второго или в третьем триместре.",
      },
      gbs: {
        title: "Мазок на стрептококк группы B",
        body: "Мазок на стрептококк группы B обычно предлагают примерно на 35-37-й неделях.",
      },
      kick_counts_start: {
        title: "Наблюдение за шевелениями",
        body: "Многие начинают следить за ежедневными шевелениями примерно с 28-й недели.",
      },
      birth_prep: {
        title: "Подготовка к родам",
        body: "Примерно в это время часто обсуждают признаки начала родов, ориентир «5-1-1» для схваток в счётчике схваток Ovumcy и то, когда врач просил вас приехать или позвонить.",
      },
    },
  },
  kickTeaser: {
    title: "Подсчёт шевелений",
    body: "Примерно с этой недели многие начинают замечать ежедневные шевеления. Нажмите, чтобы открыть счётчик шевелений.",
  },
  multiplesCard: {
    title: "Больше одного малыша",
    body: "Многоплодную беременность обычно наблюдают чаще, а роды нередко случаются раньше предполагаемой даты родов. Врач подскажет сроки, подходящие именно вам.",
    monoLine:
      "При монохориальной двойне (общая плацента) обычно предлагают УЗИ примерно раз в 2 недели начиная примерно с 16-й недели.",
  },
  staleCard: {
    title: "Отслеживание беременности",
    body: "Предполагаемая дата родов уже давно прошла. Просмотрите отслеживание беременности, чтобы завершить его или обновить данные.",
  },
  metrics: {
    title: "Сегодняшние измерения",
    emptyLabel: "Сегодня вес и давление не записаны.",
    weightLabel: "Вес",
    weightValue: (kilograms: number) => `${kilograms} кг`,
    bloodPressureLabel: "Давление",
    bloodPressureValue: (systolic: number, diastolic: number) =>
      `${systolic}/${diastolic} мм рт. ст.`,
  },
  disclaimer:
    "Это общие оценки, а не медицинский совет. Сроки и контрольные точки индивидуальны. Обсуждайте наблюдение и любые вопросы с врачом или акушеркой.",
};

const pregnancyCopyDe: PregnancyCopy = {
  entryCard: {
    eyebrow: "Schwangerschaftsmodus",
    unlockedTitle: "Verfolgen Sie Ihre Schwangerschaft Woche für Woche",
    unlockedBody:
      "Wechseln Sie zu einer Schwangerschaftsansicht mit errechnetem Termin, einer wöchentlichen Zeitleiste und Platz für Gewicht und Blutdruck. Ihr Zyklusverlauf bleibt gespeichert.",
    unlockedCta: "Schwangerschaftsmodus einrichten",
    lockedTitle: "Der Schwangerschaftsmodus ist eine einmalige Freischaltung",
    lockedBody:
      "Der Schwangerschaftsmodus wird mit einem einmaligen Kauf freigeschaltet — ohne Abo. Alles, was Sie bereits erfasst haben, bleibt so oder so auf diesem Gerät verfügbar.",
    lockedCta: "Schwangerschaftsmodus freischalten",
  },
  wizard: {
    title: "Schwangerschaftsmodus einrichten",
    subtitle:
      "Wir schätzen den Termin anhand des gewählten Datums. Sie können ihn später über »Schwangerschafts-Tracking verwalten« aktualisieren, falls die Datierung Ihrer Ärztin oder Ihres Arztes davon abweicht.",
    basisStepTitle: "Wie möchten Sie den errechneten Termin festlegen?",
    basisOptions: {
      lmpLabel: "Nach meiner letzten Periode",
      lmpHint:
        "Wir schätzen den Termin ab dem ersten Tag Ihrer letzten Periode.",
      ultrasoundLabel: "Nach einem Ultraschall",
      ultrasoundHint: "Geben Sie den errechneten Termin aus einer Datierungs-Ultraschalluntersuchung ein.",
      manualLabel: "Termin eingeben",
      manualHint: "Geben Sie einen errechneten Termin ein, den Sie bereits haben.",
    },
    dateStepTitle: "Datum eingeben",
    lmpDateLabel: "Erster Tag Ihrer letzten Periode",
    eddDateLabel: "Errechneter Termin",
    datePlaceholder: "JJJJ-MM-TT",
    previewTitle: "Vorschau",
    previewEddLabel: "Errechneter Termin",
    previewGaLabel: "Heute entspräche das",
    previewEmpty: "Geben Sie ein Datum ein, um die Schätzung zu sehen.",
    confirmStepTitle: "Bestätigen und starten",
    confirmBasisLabel: "Basierend auf",
    confirmBasisValue: {
      lmp: "Letzte Periode",
      ultrasound: "Ultraschall",
      manual: "Eingegebener Termin",
    },
    confirmEddLabel: "Errechneter Termin",
    confirmGaLabel: "Aktuelle Woche",
    multiplesQuestion: "Wie viele Babys erwarten Sie?",
    multiplesOptions: {
      one: "Eins",
      twins: "Zwillinge",
      tripletsPlus: "Drillinge oder mehr",
    },
    chorionicityQuestion: "Kennen Sie die Chorionizität?",
    chorionicityExplainer:
      "Das wird üblicherweise beim Ultraschall in Woche 11-14 festgestellt.",
    chorionicityOptions: {
      dcda: "DCDA (jedes Baby hat eine eigene Plazenta)",
      mcda: "MCDA (gemeinsame Plazenta, getrennte Fruchtblasen)",
      mcma: "MCMA (gemeinsame Plazenta und Fruchtblase)",
      unknown: "Ich weiß es nicht",
    },
    backCta: "Zurück",
    nextCta: "Weiter",
    confirmCta: "Schwangerschaftsmodus starten",
    cancelCta: "Abbrechen",
    validation: {
      activeExists: "Sie haben bereits eine aktive Schwangerschaft in Ovumcy.",
      missingDate: "Geben Sie ein Datum ein, um fortzufahren.",
      invalidDate: "Geben Sie ein gültiges Datum als JJJJ-MM-TT ein.",
      outOfRange:
        "Dieses Datum liegt außerhalb des Bereichs, den Ovumcy erfassen kann. Bitte prüfen Sie es und versuchen Sie es erneut.",
      saveFailed: "Wir konnten das gerade nicht speichern. Bitte erneut versuchen.",
    },
  },
  hero: {
    eyebrow: "Schwangerschaft",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "Wochen + Tage",
    trimesterLabels: {
      1: "Erstes Trimester",
      2: "Zweites Trimester",
      3: "Drittes Trimester",
    },
    eddCaption: "Errechneter Termin",
    daysToGo: (days: number) => `noch ${days} Tage`,
    dayToGo: "noch 1 Tag",
    dueToday: "Ihr errechneter Termin ist heute",
    overdue: (days: number) => `${days} Tage über dem errechneten Termin`,
    overdueOne: "1 Tag über dem errechneten Termin",
  },
  milestones: {
    title: "Um diese Zeit",
    emptyLabel:
      "In dieser Woche fallen keine gängigen Kontrolltermine an. Ihr Behandlungsteam begleitet Ihren Zeitplan.",
    items: {
      nipt: {
        title: "Zellfreier DNA-Test (NIPT)",
        body: "Ein Bluttest, der manchen ab etwa Woche 10 angeboten wird, um auf häufige chromosomale Besonderheiten zu screenen.",
      },
      nt_scan: {
        title: "Nackentransparenz-Ultraschall",
        body: "Ein Ultraschall, der üblicherweise um die Wochen 11-14 angeboten wird und die Messung der Nackentransparenz umfasst.",
      },
      anatomy_scan: {
        title: "Organ-Ultraschall",
        body: "Ein detaillierter Ultraschall, der üblicherweise um die Wochen 18-22 angeboten wird, um die Entwicklung des Babys zu betrachten.",
      },
      gdm_screen: {
        title: "Screening auf Schwangerschaftsdiabetes",
        body: "Das Screening auf Schwangerschaftsdiabetes wird üblicherweise um die Wochen 24-28 angeboten.",
      },
      anti_d: {
        title: "Anti-D bei Rhesus-negativ",
        body: "Wenn Ihre Blutgruppe Rhesus-negativ ist, wird eine Anti-D-Spritze üblicherweise um Woche 28 angeboten. Ihr Behandlungsteam bestätigt das.",
      },
      tdap: {
        title: "Keuchhusten-Impfung (Tdap)",
        body: "Eine Tdap-Impfung wird üblicherweise im späten zweiten oder im dritten Trimester angeboten.",
      },
      gbs: {
        title: "Abstrich auf B-Streptokokken",
        body: "Ein Abstrich auf B-Streptokokken wird üblicherweise um die Wochen 35-37 angeboten.",
      },
      kick_counts_start: {
        title: "Bewegungen wahrnehmen",
        body: "Viele beginnen ab etwa Woche 28, auf tägliche Bewegungsmuster zu achten.",
      },
      birth_prep: {
        title: "Vorbereitung auf die Geburt",
        body: "Anzeichen, dass die Geburt beginnen könnte, die 5-1-1-Faustregel für Wehen im Wehen-Timer von Ovumcy und der Zeitpunkt, zu dem Ihr Behandlungsteam Ihnen gesagt hat, anzurufen oder zu kommen, werden um diese Zeit häufig besprochen.",
      },
    },
  },
  kickTeaser: {
    title: "Bewegungen zählen",
    body: "Ab etwa dieser Woche beginnen viele, tägliche Bewegungsmuster zu bemerken. Tippen Sie, um den Tritt-Zähler zu öffnen.",
  },
  multiplesCard: {
    title: "Mehr als ein Baby",
    body: "Zwillings- und Mehrlingsschwangerschaften werden meist engmaschiger überwacht und enden häufig früher als der errechnete Termin. Ihr Behandlungsteam bespricht mit Ihnen den passenden Zeitpunkt.",
    monoLine:
      "Bei monochorialen Zwillingen (gemeinsame Plazenta) wird üblicherweise etwa ab Woche 16 alle 2 Wochen ein Ultraschall angeboten.",
  },
  staleCard: {
    title: "Ihr Schwangerschafts-Tracking",
    body: "Ihr errechneter Termin liegt schon eine Weile zurück. Prüfen Sie Ihr Schwangerschafts-Tracking, um es abzuschließen oder zu aktualisieren.",
  },
  metrics: {
    title: "Heutige Messwerte",
    emptyLabel: "Heute kein Gewicht und kein Blutdruck erfasst.",
    weightLabel: "Gewicht",
    weightValue: (kilograms: number) => `${kilograms} kg`,
    bloodPressureLabel: "Blutdruck",
    bloodPressureValue: (systolic: number, diastolic: number) =>
      `${systolic}/${diastolic} mmHg`,
  },
  disclaimer:
    "Dies sind allgemeine Schätzungen, keine medizinische Beratung. Zeitpunkte und Kontrolltermine sind individuell verschieden. Besprechen Sie Ihre Betreuung und alle Fragen mit Ihrer Ärztin, Ihrem Arzt oder Ihrer Hebamme.",
};

const pregnancyCopyFr: PregnancyCopy = {
  entryCard: {
    eyebrow: "Mode grossesse",
    unlockedTitle: "Suivez votre grossesse semaine après semaine",
    unlockedBody:
      "Passez à une vue grossesse avec votre date prévue d'accouchement, une chronologie semaine par semaine et un espace pour noter le poids et la tension. Votre historique de cycle reste enregistré.",
    unlockedCta: "Configurer le mode grossesse",
    lockedTitle: "Le mode grossesse est un déblocage unique",
    lockedBody:
      "Le mode grossesse se débloque en un seul achat — sans abonnement. Tout ce que vous avez déjà enregistré reste disponible sur cet appareil dans tous les cas.",
    lockedCta: "Débloquer le mode grossesse",
  },
  wizard: {
    title: "Configurer le mode grossesse",
    subtitle:
      "Nous estimerons votre date d'accouchement à partir de la date choisie. Vous pourrez la mettre à jour plus tard depuis « Gérer le suivi de grossesse » si la datation de votre praticien diffère.",
    basisStepTitle: "Comment souhaitez-vous définir la date prévue ?",
    basisOptions: {
      lmpLabel: "À partir de mes dernières règles",
      lmpHint:
        "Nous estimerons la date prévue à partir du premier jour de vos dernières règles.",
      ultrasoundLabel: "À partir d'une échographie",
      ultrasoundHint: "Saisissez la date prévue issue d'une échographie de datation.",
      manualLabel: "Saisir une date prévue",
      manualHint: "Saisissez une date prévue d'accouchement que vous avez déjà.",
    },
    dateStepTitle: "Saisissez votre date",
    lmpDateLabel: "Premier jour de vos dernières règles",
    eddDateLabel: "Date prévue d'accouchement",
    datePlaceholder: "AAAA-MM-JJ",
    previewTitle: "Aperçu",
    previewEddLabel: "Date prévue d'accouchement",
    previewGaLabel: "Aujourd'hui, cela vous situerait à",
    previewEmpty: "Saisissez une date pour voir l'estimation.",
    confirmStepTitle: "Confirmer et démarrer",
    confirmBasisLabel: "Basé sur",
    confirmBasisValue: {
      lmp: "Dernières règles",
      ultrasound: "Échographie",
      manual: "Date saisie",
    },
    confirmEddLabel: "Date prévue d'accouchement",
    confirmGaLabel: "Semaine actuelle",
    multiplesQuestion: "Combien de bébés attendez-vous ?",
    multiplesOptions: {
      one: "Un",
      twins: "Des jumeaux",
      tripletsPlus: "Des triplés ou plus",
    },
    chorionicityQuestion: "Connaissez-vous la chorionicité ?",
    chorionicityExplainer:
      "Cela est généralement déterminé lors de l'échographie des semaines 11-14.",
    chorionicityOptions: {
      dcda: "DCDA (chaque bébé a son propre placenta)",
      mcda: "MCDA (placenta commun, poches séparées)",
      mcma: "MCMA (placenta et poche communs)",
      unknown: "Je ne sais pas",
    },
    backCta: "Retour",
    nextCta: "Continuer",
    confirmCta: "Démarrer le mode grossesse",
    cancelCta: "Annuler",
    validation: {
      activeExists: "Vous avez déjà une grossesse active dans Ovumcy.",
      missingDate: "Saisissez une date pour continuer.",
      invalidDate: "Saisissez une date valide au format AAAA-MM-JJ.",
      outOfRange:
        "Cette date est hors de la plage qu'Ovumcy peut suivre. Veuillez la vérifier et réessayer.",
      saveFailed: "Nous n'avons pas pu enregistrer pour le moment. Réessayez.",
    },
  },
  hero: {
    eyebrow: "Grossesse",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "semaines + jours",
    trimesterLabels: {
      1: "Premier trimestre",
      2: "Deuxième trimestre",
      3: "Troisième trimestre",
    },
    eddCaption: "Date prévue d'accouchement",
    daysToGo: (days: number) => `${days} jours restants`,
    dayToGo: "1 jour restant",
    dueToday: "Votre date prévue est aujourd'hui",
    overdue: (days: number) => `${days} jours après la date prévue`,
    overdueOne: "1 jour après la date prévue",
  },
  milestones: {
    title: "À peu près à ce moment",
    emptyLabel:
      "Aucun rendez-vous courant ne tombe cette semaine. Votre équipe soignante guidera votre calendrier.",
    items: {
      nipt: {
        title: "Dépistage ADN libre circulant (DPNI)",
        body: "Une prise de sang parfois proposée à partir d'environ la semaine 10 pour dépister des anomalies chromosomiques fréquentes.",
      },
      nt_scan: {
        title: "Échographie de la clarté nucale",
        body: "Une échographie couramment proposée vers les semaines 11-14, incluant la mesure de la clarté nucale.",
      },
      anatomy_scan: {
        title: "Échographie morphologique",
        body: "Une échographie détaillée couramment proposée vers les semaines 18-22 pour observer le développement du bébé.",
      },
      gdm_screen: {
        title: "Dépistage du diabète gestationnel",
        body: "Le dépistage du diabète gestationnel est couramment proposé vers les semaines 24-28.",
      },
      anti_d: {
        title: "Anti-D si rhésus négatif",
        body: "Si votre groupe sanguin est rhésus négatif, une injection anti-D est couramment proposée vers la semaine 28. Votre praticien le confirmera.",
      },
      tdap: {
        title: "Vaccin coqueluche (Tdap)",
        body: "Un vaccin Tdap est couramment proposé à la fin du deuxième ou au troisième trimestre.",
      },
      gbs: {
        title: "Prélèvement streptocoque B",
        body: "Un prélèvement du streptocoque B est couramment proposé vers les semaines 35-37.",
      },
      kick_counts_start: {
        title: "Remarquer les mouvements",
        body: "Beaucoup commencent à observer les mouvements quotidiens à partir d'environ la semaine 28.",
      },
      birth_prep: {
        title: "Se préparer à l'accouchement",
        body: "Les signes que le travail pourrait commencer, le repère « 5-1-1 » pour les contractions dans le chronomètre de contractions d'Ovumcy, et le moment où votre équipe soignante vous a dit d'appeler ou de venir sont couramment abordés à peu près à ce moment.",
      },
    },
  },
  kickTeaser: {
    title: "Compter les mouvements",
    body: "À partir d'environ cette semaine, beaucoup commencent à remarquer des mouvements quotidiens. Appuyez pour ouvrir le compteur de mouvements.",
  },
  multiplesCard: {
    title: "Plus d'un bébé",
    body: "Les grossesses gémellaires et multiples sont généralement suivies de plus près, et l'accouchement a souvent lieu avant la date prévue. Votre équipe soignante vous guidera sur le moment qui vous convient.",
    monoLine:
      "Pour les jumeaux monochoriaux (un seul placenta), une échographie est couramment proposée environ toutes les 2 semaines à partir d'environ la semaine 16.",
  },
  staleCard: {
    title: "Votre suivi de grossesse",
    body: "Votre date prévue d'accouchement est dépassée depuis un moment. Consultez votre suivi de grossesse pour le terminer ou le mettre à jour.",
  },
  metrics: {
    title: "Mesures du jour",
    emptyLabel: "Aucun poids ni tension enregistré aujourd'hui.",
    weightLabel: "Poids",
    weightValue: (kilograms: number) => `${kilograms} kg`,
    bloodPressureLabel: "Tension artérielle",
    bloodPressureValue: (systolic: number, diastolic: number) =>
      `${systolic}/${diastolic} mmHg`,
  },
  disclaimer:
    "Ce sont des estimations générales, pas un avis médical. Les délais et les rendez-vous varient d'une personne à l'autre. Parlez de votre suivi et de toute préoccupation à votre médecin ou sage-femme.",
};

const pregnancyCopyEs: PregnancyCopy = {
  entryCard: {
    eyebrow: "Modo embarazo",
    unlockedTitle: "Sigue tu embarazo semana a semana",
    unlockedBody:
      "Cambia a una vista de embarazo con tu fecha probable de parto, una línea de tiempo semana a semana y espacio para anotar el peso y la tensión. Tu historial de ciclo se mantiene guardado.",
    unlockedCta: "Configurar el modo embarazo",
    lockedTitle: "El modo embarazo es un desbloqueo único",
    lockedBody:
      "El modo embarazo se desbloquea con una sola compra — sin suscripción. Todo lo que ya registraste sigue disponible en este dispositivo de todos modos.",
    lockedCta: "Desbloquear el modo embarazo",
  },
  wizard: {
    title: "Configurar el modo embarazo",
    subtitle:
      "Estimaremos tu fecha de parto a partir de la fecha que elijas. Podrás actualizarla más adelante desde «Gestionar el seguimiento del embarazo» si la datación de tu profesional difiere.",
    basisStepTitle: "¿Cómo quieres definir la fecha probable de parto?",
    basisOptions: {
      lmpLabel: "A partir de mi última regla",
      lmpHint:
        "Estimaremos la fecha de parto a partir del primer día de tu última regla.",
      ultrasoundLabel: "A partir de una ecografía",
      ultrasoundHint: "Introduce la fecha de parto de una ecografía de datación.",
      manualLabel: "Introducir una fecha de parto",
      manualHint: "Introduce una fecha probable de parto que ya tengas.",
    },
    dateStepTitle: "Introduce tu fecha",
    lmpDateLabel: "Primer día de tu última regla",
    eddDateLabel: "Fecha probable de parto",
    datePlaceholder: "AAAA-MM-DD",
    previewTitle: "Vista previa",
    previewEddLabel: "Fecha probable de parto",
    previewGaLabel: "Hoy eso te situaría en",
    previewEmpty: "Introduce una fecha para ver la estimación.",
    confirmStepTitle: "Confirmar y empezar",
    confirmBasisLabel: "Según",
    confirmBasisValue: {
      lmp: "Última regla",
      ultrasound: "Ecografía",
      manual: "Fecha introducida",
    },
    confirmEddLabel: "Fecha probable de parto",
    confirmGaLabel: "Semana actual",
    multiplesQuestion: "¿Cuántos bebés esperas?",
    multiplesOptions: {
      one: "Uno",
      twins: "Mellizos o gemelos",
      tripletsPlus: "Trillizos o más",
    },
    chorionicityQuestion: "¿Conoces la corionicidad?",
    chorionicityExplainer:
      "Esto suele determinarse en la ecografía de las semanas 11-14.",
    chorionicityOptions: {
      dcda: "DCDA (cada bebé tiene su propia placenta)",
      mcda: "MCDA (placenta compartida, bolsas separadas)",
      mcma: "MCMA (placenta y bolsa compartidas)",
      unknown: "No lo sé",
    },
    backCta: "Atrás",
    nextCta: "Continuar",
    confirmCta: "Iniciar el modo embarazo",
    cancelCta: "Cancelar",
    validation: {
      activeExists: "Ya tienes un embarazo activo en Ovumcy.",
      missingDate: "Introduce una fecha para continuar.",
      invalidDate: "Introduce una fecha válida como AAAA-MM-DD.",
      outOfRange:
        "Esa fecha está fuera del rango que Ovumcy puede seguir. Compruébala e inténtalo de nuevo.",
      saveFailed: "No pudimos guardarlo ahora mismo. Inténtalo de nuevo.",
    },
  },
  hero: {
    eyebrow: "Embarazo",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "semanas + días",
    trimesterLabels: {
      1: "Primer trimestre",
      2: "Segundo trimestre",
      3: "Tercer trimestre",
    },
    eddCaption: "Fecha probable de parto",
    daysToGo: (days: number) => `faltan ${days} días`,
    dayToGo: "falta 1 día",
    dueToday: "Tu fecha probable de parto es hoy",
    overdue: (days: number) => `${days} días desde la fecha probable de parto`,
    overdueOne: "1 día desde la fecha probable de parto",
  },
  milestones: {
    title: "Alrededor de este momento",
    emptyLabel:
      "Esta semana no hay controles habituales. Tu equipo de salud te guiará el calendario.",
    items: {
      nipt: {
        title: "Cribado de ADN libre (NIPT)",
        body: "Un análisis de sangre que a veces se ofrece desde la semana 10 aproximadamente para cribar condiciones cromosómicas frecuentes.",
      },
      nt_scan: {
        title: "Ecografía de translucencia nucal",
        body: "Una ecografía que se suele ofrecer hacia las semanas 11-14 e incluye la medición de la translucencia nucal.",
      },
      anatomy_scan: {
        title: "Ecografía morfológica",
        body: "Una ecografía detallada que se suele ofrecer hacia las semanas 18-22 para observar cómo crece el bebé.",
      },
      gdm_screen: {
        title: "Cribado de diabetes gestacional",
        body: "El cribado de diabetes gestacional se suele ofrecer hacia las semanas 24-28.",
      },
      anti_d: {
        title: "Anti-D si el Rh es negativo",
        body: "Si tu grupo sanguíneo es Rh negativo, se suele ofrecer una inyección anti-D hacia la semana 28. Tu profesional lo confirmará.",
      },
      tdap: {
        title: "Vacuna de la tos ferina (Tdap)",
        body: "La vacuna Tdap se suele ofrecer al final del segundo o en el tercer trimestre.",
      },
      gbs: {
        title: "Muestra de estreptococo del grupo B",
        body: "La muestra de estreptococo del grupo B se suele ofrecer hacia las semanas 35-37.",
      },
      kick_counts_start: {
        title: "Notar los movimientos",
        body: "Muchas personas empiezan a fijarse en los movimientos diarios desde la semana 28 aproximadamente.",
      },
      birth_prep: {
        title: "Preparándote para el parto",
        body: "Las señales de que el parto podría estar empezando, la pauta «5-1-1» para las contracciones en el cronómetro de contracciones de Ovumcy, y el momento en que tu equipo de salud te dijo que llamaras o acudieras son temas que se suelen comentar por esta época.",
      },
    },
  },
  kickTeaser: {
    title: "Contar movimientos",
    body: "A partir de esta semana aproximadamente, muchas personas empiezan a notar movimientos diarios. Toca para abrir el contador de pataditas.",
  },
  multiplesCard: {
    title: "Más de un bebé",
    body: "Los embarazos gemelares y múltiples suelen controlarse más de cerca, y el parto llega a menudo antes de la fecha probable de parto. Tu equipo de salud te guiará sobre el momento adecuado para ti.",
    monoLine:
      "En los gemelos monocoriales (una sola placenta) se suelen ofrecer ecografías aproximadamente cada 2 semanas desde alrededor de la semana 16.",
  },
  staleCard: {
    title: "Tu seguimiento del embarazo",
    body: "Tu fecha probable de parto pasó hace un tiempo. Revisa tu seguimiento del embarazo para finalizarlo o actualizarlo.",
  },
  metrics: {
    title: "Mediciones de hoy",
    emptyLabel: "Hoy no se registró peso ni tensión.",
    weightLabel: "Peso",
    weightValue: (kilograms: number) => `${kilograms} kg`,
    bloodPressureLabel: "Tensión arterial",
    bloodPressureValue: (systolic: number, diastolic: number) =>
      `${systolic}/${diastolic} mmHg`,
  },
  disclaimer:
    "Estas son estimaciones generales, no consejo médico. Los tiempos y los controles varían de una persona a otra. Habla con tu médico o matrona sobre tu seguimiento y cualquier preocupación.",
};

const pregnancyCopyIt: PregnancyCopy = {
  entryCard: {
    eyebrow: "Modalità gravidanza",
    unlockedTitle: "Segui la tua gravidanza settimana per settimana",
    unlockedBody:
      "Passa a una vista gravidanza con la data presunta del parto, una linea temporale settimana per settimana e uno spazio per annotare peso e pressione. La cronologia del ciclo resta salvata.",
    unlockedCta: "Configura la modalità gravidanza",
    lockedTitle: "La modalità gravidanza è uno sblocco una tantum",
    lockedBody:
      "La modalità gravidanza si sblocca con un unico acquisto — nessun abbonamento necessario. Tutto ciò che hai già registrato resta comunque disponibile su questo dispositivo.",
    lockedCta: "Sblocca la modalità gravidanza",
  },
  wizard: {
    title: "Configura la modalità gravidanza",
    subtitle:
      "Stimeremo la data del parto in base alla data scelta. Potrai aggiornarla più avanti da «Gestisci il monitoraggio della gravidanza» se la datazione del tuo medico risulta diversa.",
    basisStepTitle: "Come vuoi impostare la data presunta del parto?",
    basisOptions: {
      lmpLabel: "Dalla mia ultima mestruazione",
      lmpHint:
        "Stimeremo la data del parto dal primo giorno della tua ultima mestruazione.",
      ultrasoundLabel: "Da un'ecografia",
      ultrasoundHint: "Inserisci la data presunta da un'ecografia di datazione.",
      manualLabel: "Inserisci una data del parto",
      manualHint: "Inserisci una data presunta del parto che hai già.",
    },
    dateStepTitle: "Inserisci la tua data",
    lmpDateLabel: "Primo giorno della tua ultima mestruazione",
    eddDateLabel: "Data presunta del parto",
    datePlaceholder: "AAAA-MM-GG",
    previewTitle: "Anteprima",
    previewEddLabel: "Data presunta del parto",
    previewGaLabel: "Oggi corrisponderebbe a",
    previewEmpty: "Inserisci una data per vedere la stima.",
    confirmStepTitle: "Conferma e inizia",
    confirmBasisLabel: "In base a",
    confirmBasisValue: {
      lmp: "Ultima mestruazione",
      ultrasound: "Ecografia",
      manual: "Data inserita",
    },
    confirmEddLabel: "Data presunta del parto",
    confirmGaLabel: "Settimana attuale",
    multiplesQuestion: "Quanti bambini aspetti?",
    multiplesOptions: {
      one: "Uno",
      twins: "Gemelli",
      tripletsPlus: "Trigemini o più",
    },
    chorionicityQuestion: "Conosci la corionicità?",
    chorionicityExplainer:
      "Di solito viene stabilita con l'ecografia delle settimane 11-14.",
    chorionicityOptions: {
      dcda: "DCDA (ogni bambino ha la propria placenta)",
      mcda: "MCDA (placenta condivisa, sacchi separati)",
      mcma: "MCMA (placenta e sacco condivisi)",
      unknown: "Non lo so",
    },
    backCta: "Indietro",
    nextCta: "Continua",
    confirmCta: "Avvia la modalità gravidanza",
    cancelCta: "Annulla",
    validation: {
      activeExists: "Hai già una gravidanza attiva in Ovumcy.",
      missingDate: "Inserisci una data per continuare.",
      invalidDate: "Inserisci una data valida nel formato AAAA-MM-GG.",
      outOfRange:
        "Questa data è fuori dall'intervallo che Ovumcy può seguire. Controllala e riprova.",
      saveFailed: "Non siamo riusciti a salvare adesso. Riprova.",
    },
  },
  hero: {
    eyebrow: "Gravidanza",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "settimane + giorni",
    trimesterLabels: {
      1: "Primo trimestre",
      2: "Secondo trimestre",
      3: "Terzo trimestre",
    },
    eddCaption: "Data presunta del parto",
    daysToGo: (days: number) => `mancano ${days} giorni`,
    dayToGo: "manca 1 giorno",
    dueToday: "La data presunta del parto è oggi",
    overdue: (days: number) => `${days} giorni oltre la data presunta`,
    overdueOne: "1 giorno oltre la data presunta",
  },
  milestones: {
    title: "In questo periodo",
    emptyLabel:
      "Questa settimana non ci sono controlli comuni. Il tuo team di cura ti guiderà nel calendario.",
    items: {
      nipt: {
        title: "Test del DNA fetale (NIPT)",
        body: "Un esame del sangue talvolta proposto da circa la settimana 10 per lo screening di condizioni cromosomiche comuni.",
      },
      nt_scan: {
        title: "Ecografia della translucenza nucale",
        body: "Un'ecografia comunemente proposta intorno alle settimane 11-14 che include la misura della translucenza nucale.",
      },
      anatomy_scan: {
        title: "Ecografia morfologica",
        body: "Un'ecografia dettagliata comunemente proposta intorno alle settimane 18-22 per osservare come cresce il bambino.",
      },
      gdm_screen: {
        title: "Screening del diabete gestazionale",
        body: "Lo screening del diabete gestazionale è comunemente proposto intorno alle settimane 24-28.",
      },
      anti_d: {
        title: "Anti-D se Rh negativo",
        body: "Se il tuo gruppo sanguigno è Rh negativo, un'iniezione di anti-D è comunemente proposta intorno alla settimana 28. Il tuo medico lo confermerà.",
      },
      tdap: {
        title: "Vaccino contro la pertosse (Tdap)",
        body: "Il vaccino Tdap è comunemente proposto nel tardo secondo o nel terzo trimestre.",
      },
      gbs: {
        title: "Tampone per streptococco di gruppo B",
        body: "Il tampone per lo streptococco di gruppo B è comunemente proposto intorno alle settimane 35-37.",
      },
      kick_counts_start: {
        title: "Notare i movimenti",
        body: "Molte persone iniziano a osservare i movimenti quotidiani da circa la settimana 28.",
      },
      birth_prep: {
        title: "Prepararsi al parto",
        body: "I segnali che il travaglio potrebbe iniziare, il criterio «5-1-1» per le contrazioni nel cronometro delle contrazioni di Ovumcy, e il momento in cui il tuo team di cura ti ha detto di chiamare o venire in ospedale sono argomenti comunemente trattati intorno a questo periodo.",
      },
    },
  },
  kickTeaser: {
    title: "Contare i movimenti",
    body: "Da circa questa settimana molte persone iniziano a notare i movimenti quotidiani. Tocca per aprire il contatore dei calci.",
  },
  multiplesCard: {
    title: "Più di un bambino",
    body: "Le gravidanze gemellari e multiple sono di solito monitorate più da vicino, e il parto arriva spesso prima della data presunta. Il tuo team di cura ti guiderà sui tempi più adatti a te.",
    monoLine:
      "Per i gemelli monocoriali (una sola placenta) si offre di solito un'ecografia circa ogni 2 settimane a partire da circa la settimana 16.",
  },
  staleCard: {
    title: "Il tuo monitoraggio della gravidanza",
    body: "La tua data presunta del parto è passata da un po'. Controlla il monitoraggio della gravidanza per completarlo o aggiornarlo.",
  },
  metrics: {
    title: "Misurazioni di oggi",
    emptyLabel: "Oggi nessun peso o pressione registrati.",
    weightLabel: "Peso",
    weightValue: (kilograms: number) => `${kilograms} kg`,
    bloodPressureLabel: "Pressione",
    bloodPressureValue: (systolic: number, diastolic: number) =>
      `${systolic}/${diastolic} mmHg`,
  },
  disclaimer:
    "Queste sono stime generali, non un consiglio medico. Tempi e controlli variano da persona a persona. Parla del tuo percorso e di qualsiasi dubbio con il tuo medico o la tua ostetrica.",
};

const pregnancyCopyCatalog: Record<InterfaceLanguage, PregnancyCopy> = {
  en: pregnancyCopyEn,
  ru: pregnancyCopyRu,
  es: pregnancyCopyEs,
  de: pregnancyCopyDe,
  fr: pregnancyCopyFr,
  it: pregnancyCopyIt,
};

export type { PregnancyCopy };

export function getPregnancyCopy(language: string | null | undefined) {
  return pregnancyCopyCatalog[resolveCopyLanguage(language)];
}
