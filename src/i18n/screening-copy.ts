import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

// EPDS mood-screening copy — the MOST sensitive copy surface in the app.
// Tone rules (SECURITY.md medical-safety invariant, applied more strictly here):
// this is a screening check-in, NEVER a diagnosis, verdict, or instruction;
// calm, warm, non-alarming; no exclamation marks anywhere. The result bands and
// the urgent-support block are supportive signals, not clinical statements.
//
// Instrument: Edinburgh Postnatal Depression Scale (EPDS), Cox J.L., Holden
// J.M., Sagovsky R. (1987), British Journal of Psychiatry 150, 568-570. The
// EPDS is reproducible with author/title/source attribution and unmodified
// wording — `en` uses the published wording verbatim, and `attribution` is
// surfaced on the intro step.
//
// ============================ LAUNCH GATE ==================================
// Validated EPDS translations are LANGUAGE-SPECIFIC and are separate validated
// instruments, not free translations. The ru/de/fr/es/it item + option strings
// below are PLACEHOLDERS (best-effort, faithful to the English) and MUST be
// replaced with the officially validated EPDS translation for each locale
// before public launch. Only `en` carries the published wording.

// ===========================================================================

const screeningCopyEn = {
  // Dashboard offer card. Deliberately gentle-persistent: dismiss is
  // screen-session-local only, so it reappears next visit (see
  // screening-service.buildScreeningOfferViewData).
  offer: {
    title: "A gentle check-in on how you are feeling",
    body: "A short, private set of questions about the past week. It is a check-in you can do at your own pace, not a test.",
    ctaLabel: "Start the check-in",
  },
  intro: {
    title: "How you have been feeling",
    body: "These 10 questions ask how you have felt over the past 7 days. It is a well-known check-in used after birth, not a diagnosis. There are no right or wrong answers.",
    instruction:
      "For each question, choose the answer that comes closest to how you have felt in the past 7 days.",
    privacyNote: "Your answers stay on this device, encrypted.",
    attribution:
      "Edinburgh Postnatal Depression Scale (EPDS): Cox, J.L., Holden, J.M. and Sagovsky, R. (1987), British Journal of Psychiatry 150, 568-570.",
    startCta: "Begin",
  },
  flow: {
    progress: (current: number, total: number) =>
      `Question ${current} of ${total}`,
    next: "Next",
    back: "Back",
  },
  // The 10 published EPDS items. Options are listed in the published DISPLAY
  // order; the 0-3 score for each option is paired in the service
  // (EPDS_OPTION_SCORES), so this catalog stays text-only.
  items: [
    {
      question: "I have been able to laugh and see the funny side of things",
      options: [
        "As much as I always could",
        "Not quite so much now",
        "Definitely not so much now",
        "Not at all",
      ],
    },
    {
      question: "I have looked forward with enjoyment to things",
      options: [
        "As much as I ever did",
        "Rather less than I used to",
        "Definitely less than I used to",
        "Hardly at all",
      ],
    },
    {
      question: "I have blamed myself unnecessarily when things went wrong",
      options: [
        "Yes, most of the time",
        "Yes, some of the time",
        "Not very often",
        "No, never",
      ],
    },
    {
      question: "I have been anxious or worried for no good reason",
      options: [
        "No, not at all",
        "Hardly ever",
        "Yes, sometimes",
        "Yes, very often",
      ],
    },
    {
      question: "I have felt scared or panicky for no very good reason",
      options: [
        "Yes, quite a lot",
        "Yes, sometimes",
        "No, not much",
        "No, not at all",
      ],
    },
    {
      question: "Things have been getting on top of me",
      options: [
        "Yes, most of the time I have not been able to cope at all",
        "Yes, sometimes I have not been coping as well as usual",
        "No, most of the time I have coped quite well",
        "No, I have been coping as well as ever",
      ],
    },
    {
      question: "I have been so unhappy that I have had difficulty sleeping",
      options: [
        "Yes, most of the time",
        "Yes, sometimes",
        "Not very often",
        "No, not at all",
      ],
    },
    {
      question: "I have felt sad or miserable",
      options: [
        "Yes, most of the time",
        "Yes, quite often",
        "Not very often",
        "No, not at all",
      ],
    },
    {
      question: "I have been so unhappy that I have been crying",
      options: [
        "Yes, most of the time",
        "Yes, quite often",
        "Only occasionally",
        "No, never",
      ],
    },
    {
      question: "The thought of harming myself has occurred to me",
      options: ["Yes, quite often", "Sometimes", "Hardly ever", "Never"],
    },
  ],
  result: {
    title: "Your check-in",
    // A neutral, non-numeric-forward summary line. The number is shown small;
    // the band body carries the message.
    scoreCaption: (score: number) => `Total ${score} of 30`,
    disclaimer:
      "This is a screening check-in, not a diagnosis. Only a clinician can assess how you are feeling. It can help to keep track of how these answers change over time.",
    doneCta: "Done",
    saveError:
      "We could not save this check-in, so it will not appear in your history. You can try again later.",
  },
  // Neutral per-band result copy. Bands are >=10 (elevated) and >=13 (high);
  // below 10 is lower. Same calm register across all three — "high" is only
  // slightly firmer, never alarming.
  bands: {
    lower: {
      title: "Thanks for checking in",
      body: "Your answers do not suggest anything urgent. Keep checking in with yourself, and reach out to your care team any time something is on your mind.",
    },
    elevated: {
      title: "It may help to talk this through",
      body: "Many people with answers in this range find it helpful to talk it through with their midwife, doctor, or health visitor.",
    },
    high: {
      title: "Sharing this with your care team could help",
      body: "We would encourage you to share these answers with your care team soon. Support is available, and you do not have to manage this on your own.",
    },
  },
  // Item-10 override block. Rendered inline, visually distinct but calm (not a
  // red alarm). A richer crisis-support surface with a personal contact is the
  // NEXT task; this is the interim inline block.
  urgentSupport: {
    title: "You deserve support right now",
    body: "Some of your answers suggest you may be having thoughts of harming yourself. You deserve support right now — please contact your care team, or emergency services if you are in immediate danger.",
  },
  history: {
    title: "Your check-ins",
    empty: "You have no saved check-ins yet.",
    // Answers never surface in history — date + score only.
    rowLabel: (date: string, score: number) => `${date} — score ${score} of 30`,
    // Dashboard row when at least one response exists.
    lastCheckInLabel: (date: string, score: number) =>
      `Last check-in: ${date}, score ${score}`,
    openCta: "See past check-ins",
    backCta: "Back",
  },
  // Delete row + dialog on the manage screen. Same device-auth + confirm shape
  // as the postpartum delete, but a SEPARATE row for a separate sensitive class
  // (screening data is never deleted as a side effect of deleting postpartum
  // data — explicit consent per class).
  delete: {
    cta: "Delete check-in data",
    title: "Delete check-in data",
    body: "This permanently removes every saved check-in from this device. Your cycle history, day logs, pregnancy, and postpartum data are not affected. This cannot be undone.",
    deviceAuthPrompt: "Confirm it is you to delete your check-in data",
    dialog: {
      title: "Delete all check-in data?",
      body: "This permanently deletes every saved check-in on this device. This cannot be undone.",
      confirm: "Delete",
      cancel: "Cancel",
    },
    status: {
      deviceAuthUnavailable:
        "Device authentication is not available, so this cannot continue.",
      deviceAuthFailed: "We could not verify it is you. Please try again.",
      failed: "We could not delete this just now. Please try again.",
    },
  },
  // Shared safety line shown under the questionnaire and result.
  disclaimer:
    "This check-in is a general screening tool, not medical advice or a diagnosis. If you are worried about how you feel, contact your doctor, midwife, or health visitor.",
} as const;

type ScreeningCopy = WidenLiteral<typeof screeningCopyEn>;

// NOTE (launch gate): every non-en item/option block below is a PLACEHOLDER
// translation, not the validated EPDS instrument for that locale. Replace per
// locale before launch.

const screeningCopyRu: ScreeningCopy = {
  offer: {
    title: "Мягкая проверка того, как вы себя чувствуете",
    body: "Короткий, приватный набор вопросов о прошедшей неделе. Это проверка в вашем темпе, а не тест.",
    ctaLabel: "Начать проверку",
  },
  intro: {
    title: "Как вы себя чувствовали",
    body: "Эти 10 вопросов о том, как вы себя чувствовали последние 7 дней. Это известная проверка, которую используют после родов, а не диагноз. Здесь нет правильных или неправильных ответов.",
    instruction:
      "Для каждого вопроса выберите ответ, который ближе всего к тому, как вы чувствовали себя последние 7 дней.",
    privacyNote: "Ваши ответы остаются на этом устройстве, в зашифрованном виде.",
    attribution:
      "Эдинбургская шкала послеродовой депрессии (EPDS): Cox, J.L., Holden, J.M. и Sagovsky, R. (1987), British Journal of Psychiatry 150, 568-570.",
    startCta: "Начать",
  },
  flow: {
    progress: (current: number, total: number) =>
      `Вопрос ${current} из ${total}`,
    next: "Далее",
    back: "Назад",
  },
  items: [
    {
      question: "Я могла смеяться и видеть смешную сторону вещей",
      options: [
        "Так же, как всегда",
        "Сейчас не совсем так",
        "Определённо намного меньше",
        "Совсем нет",
      ],
    },
    {
      question: "Я с радостью ждала предстоящих событий",
      options: [
        "Так же, как всегда",
        "Немного меньше, чем раньше",
        "Определённо меньше, чем раньше",
        "Почти совсем нет",
      ],
    },
    {
      question: "Я без причины винила себя, когда что-то шло не так",
      options: [
        "Да, почти всё время",
        "Да, иногда",
        "Не очень часто",
        "Нет, никогда",
      ],
    },
    {
      question: "Я тревожилась или беспокоилась без веской причины",
      options: [
        "Нет, совсем нет",
        "Почти никогда",
        "Да, иногда",
        "Да, очень часто",
      ],
    },
    {
      question: "Я чувствовала страх или панику без особой причины",
      options: [
        "Да, довольно часто",
        "Да, иногда",
        "Нет, не очень",
        "Нет, совсем нет",
      ],
    },
    {
      question: "Всё стало для меня непосильным",
      options: [
        "Да, почти всё время я совсем не справлялась",
        "Да, иногда я справлялась хуже обычного",
        "Нет, почти всё время я справлялась неплохо",
        "Нет, я справлялась так же хорошо, как всегда",
      ],
    },
    {
      question: "Мне было так плохо, что было трудно спать",
      options: [
        "Да, почти всё время",
        "Да, иногда",
        "Не очень часто",
        "Нет, совсем нет",
      ],
    },
    {
      question: "Я чувствовала грусть или подавленность",
      options: [
        "Да, почти всё время",
        "Да, довольно часто",
        "Не очень часто",
        "Нет, совсем нет",
      ],
    },
    {
      question: "Мне было так плохо, что я плакала",
      options: [
        "Да, почти всё время",
        "Да, довольно часто",
        "Только изредка",
        "Нет, никогда",
      ],
    },
    {
      question: "Мне приходила мысль причинить себе вред",
      options: ["Да, довольно часто", "Иногда", "Почти никогда", "Никогда"],
    },
  ],
  result: {
    title: "Ваша проверка",
    scoreCaption: (score: number) => `Всего ${score} из 30`,
    disclaimer:
      "Это скрининговая проверка, а не диагноз. Оценить ваше состояние может только специалист. Полезно отслеживать, как эти ответы меняются со временем.",
    doneCta: "Готово",
    saveError:
      "Не удалось сохранить эту проверку, поэтому она не появится в истории. Можно попробовать позже.",
  },
  bands: {
    lower: {
      title: "Спасибо, что уделили время",
      body: "Ваши ответы не указывают на что-то срочное. Продолжайте прислушиваться к себе и обращайтесь к своим врачам всякий раз, когда что-то вас беспокоит.",
    },
    elevated: {
      title: "Возможно, стоит это обсудить",
      body: "Многим с ответами в этом диапазоне помогает обсудить это со своей акушеркой, врачом или патронажной сестрой.",
    },
    high: {
      title: "Поделиться этим с врачами может помочь",
      body: "Мы советуем поделиться этими ответами со своими врачами в ближайшее время. Поддержка доступна, и вам не нужно справляться с этим в одиночку.",
    },
  },
  urgentSupport: {
    title: "Вы заслуживаете поддержки прямо сейчас",
    body: "Некоторые из ваших ответов говорят о том, что у вас могут быть мысли причинить себе вред. Вы заслуживаете поддержки прямо сейчас — пожалуйста, свяжитесь со своими врачами или экстренными службами, если вам угрожает непосредственная опасность.",
  },
  history: {
    title: "Ваши проверки",
    empty: "У вас пока нет сохранённых проверок.",
    rowLabel: (date: string, score: number) => `${date} — балл ${score} из 30`,
    lastCheckInLabel: (date: string, score: number) =>
      `Последняя проверка: ${date}, балл ${score}`,
    openCta: "Смотреть прошлые проверки",
    backCta: "Назад",
  },
  delete: {
    cta: "Удалить данные проверок",
    title: "Удалить данные проверок",
    body: "Это безвозвратно удалит все сохранённые проверки с этого устройства. История цикла, дневник дней, данные о беременности и послеродовом периоде не затрагиваются. Отменить нельзя.",
    deviceAuthPrompt: "Подтвердите, что это вы, чтобы удалить данные проверок",
    dialog: {
      title: "Удалить все данные проверок?",
      body: "Это безвозвратно удалит все сохранённые проверки на этом устройстве. Отменить нельзя.",
      confirm: "Удалить",
      cancel: "Отмена",
    },
    status: {
      deviceAuthUnavailable:
        "Аутентификация устройства недоступна, поэтому действие нельзя продолжить.",
      deviceAuthFailed: "Не удалось подтвердить, что это вы. Попробуйте снова.",
      failed: "Не удалось удалить сейчас. Попробуйте снова.",
    },
  },
  disclaimer:
    "Эта проверка — общий скрининговый инструмент, а не медицинский совет или диагноз. Если вас беспокоит ваше состояние, обратитесь к врачу, акушерке или патронажной сестре.",
};

const screeningCopyDe: ScreeningCopy = {
  offer: {
    title: "Ein sanftes Innehalten, wie es Ihnen geht",
    body: "Eine kurze, private Reihe von Fragen zur vergangenen Woche. Ein Innehalten in Ihrem eigenen Tempo, kein Test.",
    ctaLabel: "Innehalten starten",
  },
  intro: {
    title: "Wie Sie sich gefühlt haben",
    body: "Diese 10 Fragen betreffen, wie Sie sich in den letzten 7 Tagen gefühlt haben. Es ist ein bekanntes Innehalten nach der Geburt, keine Diagnose. Es gibt keine richtigen oder falschen Antworten.",
    instruction:
      "Wählen Sie bei jeder Frage die Antwort, die dem am nächsten kommt, wie Sie sich in den letzten 7 Tagen gefühlt haben.",
    privacyNote: "Ihre Antworten bleiben verschlüsselt auf diesem Gerät.",
    attribution:
      "Edinburgh-Postnatal-Depressionsskala (EPDS): Cox, J.L., Holden, J.M. und Sagovsky, R. (1987), British Journal of Psychiatry 150, 568-570.",
    startCta: "Beginnen",
  },
  flow: {
    progress: (current: number, total: number) =>
      `Frage ${current} von ${total}`,
    next: "Weiter",
    back: "Zurück",
  },
  items: [
    {
      question: "Ich konnte lachen und die lustige Seite der Dinge sehen",
      options: [
        "So viel wie immer",
        "Jetzt nicht mehr ganz so viel",
        "Definitiv nicht mehr so viel",
        "Überhaupt nicht",
      ],
    },
    {
      question: "Ich habe mich mit Freude auf Dinge gefreut",
      options: [
        "So viel wie immer",
        "Eher weniger als früher",
        "Definitiv weniger als früher",
        "Kaum noch",
      ],
    },
    {
      question: "Ich habe mir unnötig Vorwürfe gemacht, wenn etwas schiefging",
      options: [
        "Ja, die meiste Zeit",
        "Ja, manchmal",
        "Nicht sehr oft",
        "Nein, nie",
      ],
    },
    {
      question: "Ich war ängstlich oder besorgt ohne guten Grund",
      options: [
        "Nein, überhaupt nicht",
        "Kaum jemals",
        "Ja, manchmal",
        "Ja, sehr oft",
      ],
    },
    {
      question: "Ich hatte Angst oder geriet in Panik ohne guten Grund",
      options: [
        "Ja, ziemlich oft",
        "Ja, manchmal",
        "Nein, nicht sehr",
        "Nein, überhaupt nicht",
      ],
    },
    {
      question: "Die Dinge sind mir über den Kopf gewachsen",
      options: [
        "Ja, die meiste Zeit konnte ich überhaupt nicht zurechtkommen",
        "Ja, manchmal kam ich nicht so gut zurecht wie sonst",
        "Nein, die meiste Zeit kam ich recht gut zurecht",
        "Nein, ich kam so gut zurecht wie immer",
      ],
    },
    {
      question: "Ich war so unglücklich, dass ich schlecht schlafen konnte",
      options: [
        "Ja, die meiste Zeit",
        "Ja, manchmal",
        "Nicht sehr oft",
        "Nein, überhaupt nicht",
      ],
    },
    {
      question: "Ich habe mich traurig oder elend gefühlt",
      options: [
        "Ja, die meiste Zeit",
        "Ja, ziemlich oft",
        "Nicht sehr oft",
        "Nein, überhaupt nicht",
      ],
    },
    {
      question: "Ich war so unglücklich, dass ich geweint habe",
      options: [
        "Ja, die meiste Zeit",
        "Ja, ziemlich oft",
        "Nur gelegentlich",
        "Nein, nie",
      ],
    },
    {
      question: "Der Gedanke, mir etwas anzutun, ist mir gekommen",
      options: ["Ja, ziemlich oft", "Manchmal", "Kaum jemals", "Nie"],
    },
  ],
  result: {
    title: "Ihr Innehalten",
    scoreCaption: (score: number) => `Insgesamt ${score} von 30`,
    disclaimer:
      "Dies ist ein Screening-Innehalten, keine Diagnose. Nur eine Fachperson kann einschätzen, wie es Ihnen geht. Es kann helfen, zu verfolgen, wie sich diese Antworten mit der Zeit verändern.",
    doneCta: "Fertig",
    saveError:
      "Wir konnten dieses Innehalten nicht speichern, daher erscheint es nicht in Ihrem Verlauf. Sie können es später erneut versuchen.",
  },
  bands: {
    lower: {
      title: "Danke, dass Sie innegehalten haben",
      body: "Ihre Antworten deuten auf nichts Dringendes hin. Bleiben Sie mit sich in Kontakt und wenden Sie sich jederzeit an Ihr Behandlungsteam, wenn Ihnen etwas auf dem Herzen liegt.",
    },
    elevated: {
      title: "Es kann helfen, darüber zu sprechen",
      body: "Viele mit Antworten in diesem Bereich finden es hilfreich, mit ihrer Hebamme, Ärztin oder ihrem Arzt darüber zu sprechen.",
    },
    high: {
      title: "Dies mit Ihrem Behandlungsteam zu teilen, kann helfen",
      body: "Wir möchten Sie ermutigen, diese Antworten bald mit Ihrem Behandlungsteam zu teilen. Unterstützung ist verfügbar, und Sie müssen das nicht allein bewältigen.",
    },
  },
  urgentSupport: {
    title: "Sie verdienen jetzt Unterstützung",
    body: "Einige Ihrer Antworten deuten darauf hin, dass Sie vielleicht Gedanken haben, sich etwas anzutun. Sie verdienen jetzt Unterstützung — bitte wenden Sie sich an Ihr Behandlungsteam oder an den Notdienst, wenn Sie in unmittelbarer Gefahr sind.",
  },
  history: {
    title: "Ihre Momente des Innehaltens",
    empty: "Sie haben noch keine gespeicherten Einträge.",
    rowLabel: (date: string, score: number) => `${date} — Wert ${score} von 30`,
    lastCheckInLabel: (date: string, score: number) =>
      `Letztes Innehalten: ${date}, Wert ${score}`,
    openCta: "Frühere Einträge ansehen",
    backCta: "Zurück",
  },
  delete: {
    cta: "Check-in-Daten löschen",
    title: "Check-in-Daten löschen",
    body: "Damit werden alle gespeicherten Einträge dauerhaft von diesem Gerät entfernt. Ihr Zyklusverlauf, Ihre Tageseinträge, Ihre Schwangerschafts- und Wochenbettdaten sind nicht betroffen. Das kann nicht rückgängig gemacht werden.",
    deviceAuthPrompt:
      "Bestätigen Sie, dass Sie es sind, um Ihre Check-in-Daten zu löschen",
    dialog: {
      title: "Alle Check-in-Daten löschen?",
      body: "Damit werden alle gespeicherten Einträge auf diesem Gerät dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.",
      confirm: "Löschen",
      cancel: "Abbrechen",
    },
    status: {
      deviceAuthUnavailable:
        "Die Geräteauthentifizierung ist nicht verfügbar, daher kann dies nicht fortgesetzt werden.",
      deviceAuthFailed:
        "Wir konnten nicht bestätigen, dass Sie es sind. Bitte versuchen Sie es erneut.",
      failed:
        "Wir konnten das gerade nicht löschen. Bitte versuchen Sie es erneut.",
    },
  },
  disclaimer:
    "Dieses Innehalten ist ein allgemeines Screening-Instrument, keine medizinische Beratung oder Diagnose. Wenn Sie sich Sorgen um Ihr Befinden machen, wenden Sie sich an Ihre Ärztin, Ihren Arzt, Ihre Hebamme oder Ihre Nachsorgehebamme.",
};

const screeningCopyFr: ScreeningCopy = {
  offer: {
    title: "Un point tout en douceur sur comment vous allez",
    body: "Un court ensemble de questions privées sur la semaine passée. Un point à votre rythme, pas un test.",
    ctaLabel: "Commencer le point",
  },
  intro: {
    title: "Comment vous vous êtes sentie",
    body: "Ces 10 questions portent sur comment vous vous êtes sentie ces 7 derniers jours. C'est un point connu utilisé après la naissance, pas un diagnostic. Il n'y a pas de bonnes ni de mauvaises réponses.",
    instruction:
      "Pour chaque question, choisissez la réponse qui correspond le mieux à ce que vous avez ressenti ces 7 derniers jours.",
    privacyNote: "Vos réponses restent sur cet appareil, chiffrées.",
    attribution:
      "Échelle de dépression postnatale d'Édimbourg (EPDS) : Cox, J.L., Holden, J.M. et Sagovsky, R. (1987), British Journal of Psychiatry 150, 568-570.",
    startCta: "Commencer",
  },
  flow: {
    progress: (current: number, total: number) =>
      `Question ${current} sur ${total}`,
    next: "Suivant",
    back: "Précédent",
  },
  items: [
    {
      question: "J'ai pu rire et voir le bon côté des choses",
      options: [
        "Autant que d'habitude",
        "Pas tout à fait autant maintenant",
        "Vraiment beaucoup moins maintenant",
        "Pas du tout",
      ],
    },
    {
      question: "Je me suis réjouie à l'idée de faire des choses",
      options: [
        "Autant que d'habitude",
        "Plutôt moins qu'avant",
        "Vraiment moins qu'avant",
        "Presque pas du tout",
      ],
    },
    {
      question: "Je me suis reproché sans raison des choses qui allaient mal",
      options: [
        "Oui, la plupart du temps",
        "Oui, parfois",
        "Pas très souvent",
        "Non, jamais",
      ],
    },
    {
      question: "J'ai été anxieuse ou inquiète sans bonne raison",
      options: [
        "Non, pas du tout",
        "Presque jamais",
        "Oui, parfois",
        "Oui, très souvent",
      ],
    },
    {
      question: "J'ai eu peur ou j'ai paniqué sans très bonne raison",
      options: [
        "Oui, assez souvent",
        "Oui, parfois",
        "Non, pas beaucoup",
        "Non, pas du tout",
      ],
    },
    {
      question: "Les choses ont eu tendance à me dépasser",
      options: [
        "Oui, la plupart du temps je n'ai pas du tout réussi à faire face",
        "Oui, parfois je n'ai pas fait face aussi bien que d'habitude",
        "Non, la plupart du temps j'ai plutôt bien fait face",
        "Non, j'ai fait face aussi bien que d'habitude",
      ],
    },
    {
      question: "J'ai été si malheureuse que j'ai eu du mal à dormir",
      options: [
        "Oui, la plupart du temps",
        "Oui, parfois",
        "Pas très souvent",
        "Non, pas du tout",
      ],
    },
    {
      question: "Je me suis sentie triste ou malheureuse",
      options: [
        "Oui, la plupart du temps",
        "Oui, assez souvent",
        "Pas très souvent",
        "Non, pas du tout",
      ],
    },
    {
      question: "J'ai été si malheureuse que j'ai pleuré",
      options: [
        "Oui, la plupart du temps",
        "Oui, assez souvent",
        "Seulement de temps en temps",
        "Non, jamais",
      ],
    },
    {
      question: "L'idée de me faire du mal m'est venue à l'esprit",
      options: ["Oui, assez souvent", "Parfois", "Presque jamais", "Jamais"],
    },
  ],
  result: {
    title: "Votre point",
    scoreCaption: (score: number) => `Total ${score} sur 30`,
    disclaimer:
      "Ceci est un point de dépistage, pas un diagnostic. Seul un professionnel peut évaluer comment vous allez. Il peut être utile de suivre l'évolution de ces réponses au fil du temps.",
    doneCta: "Terminé",
    saveError:
      "Nous n'avons pas pu enregistrer ce point, il n'apparaîtra donc pas dans votre historique. Vous pouvez réessayer plus tard.",
  },
  bands: {
    lower: {
      title: "Merci d'avoir pris ce moment",
      body: "Vos réponses ne suggèrent rien d'urgent. Continuez à prendre de vos nouvelles et contactez votre équipe soignante dès que quelque chose vous préoccupe.",
    },
    elevated: {
      title: "En parler pourrait aider",
      body: "Beaucoup de personnes avec des réponses dans cette plage trouvent utile d'en parler avec leur sage-femme, leur médecin ou leur professionnel de santé.",
    },
    high: {
      title: "Partager cela avec votre équipe soignante pourrait aider",
      body: "Nous vous encourageons à partager ces réponses avec votre équipe soignante bientôt. Un soutien existe, et vous n'avez pas à gérer cela seule.",
    },
  },
  urgentSupport: {
    title: "Vous méritez du soutien dès maintenant",
    body: "Certaines de vos réponses suggèrent que vous pourriez avoir des pensées de vous faire du mal. Vous méritez du soutien dès maintenant — veuillez contacter votre équipe soignante, ou les services d'urgence si vous êtes en danger immédiat.",
  },
  history: {
    title: "Vos points",
    empty: "Vous n'avez pas encore de point enregistré.",
    rowLabel: (date: string, score: number) => `${date} — score ${score} sur 30`,
    lastCheckInLabel: (date: string, score: number) =>
      `Dernier point : ${date}, score ${score}`,
    openCta: "Voir les points passés",
    backCta: "Retour",
  },
  delete: {
    cta: "Supprimer les données des points",
    title: "Supprimer les données des points",
    body: "Cela supprime définitivement tous les points enregistrés de cet appareil. Votre historique de cycle, vos journaux quotidiens, vos données de grossesse et de post-partum ne sont pas affectés. Cette action est irréversible.",
    deviceAuthPrompt:
      "Confirmez votre identité pour supprimer les données de vos points",
    dialog: {
      title: "Supprimer toutes les données des points ?",
      body: "Cela supprime définitivement tous les points enregistrés sur cet appareil. Cette action est irréversible.",
      confirm: "Supprimer",
      cancel: "Annuler",
    },
    status: {
      deviceAuthUnavailable:
        "L'authentification de l'appareil n'est pas disponible, cette action ne peut pas continuer.",
      deviceAuthFailed:
        "Nous n'avons pas pu vérifier votre identité. Veuillez réessayer.",
      failed:
        "Nous n'avons pas pu supprimer pour le moment. Veuillez réessayer.",
    },
  },
  disclaimer:
    "Ce point est un outil de dépistage général, pas un avis médical ni un diagnostic. Si vous êtes inquiète de la façon dont vous vous sentez, contactez votre médecin, votre sage-femme ou votre professionnel de santé.",
};

const screeningCopyEs: ScreeningCopy = {
  offer: {
    title: "Una pausa amable sobre cómo te sientes",
    body: "Un conjunto breve y privado de preguntas sobre la última semana. Una pausa a tu ritmo, no una prueba.",
    ctaLabel: "Empezar la pausa",
  },
  intro: {
    title: "Cómo te has sentido",
    body: "Estas 10 preguntas tratan sobre cómo te has sentido durante los últimos 7 días. Es una pausa conocida que se usa tras el parto, no un diagnóstico. No hay respuestas correctas ni incorrectas.",
    instruction:
      "En cada pregunta, elige la respuesta que más se acerque a cómo te has sentido en los últimos 7 días.",
    privacyNote: "Tus respuestas se quedan en este dispositivo, cifradas.",
    attribution:
      "Escala de Depresión Posnatal de Edimburgo (EPDS): Cox, J.L., Holden, J.M. y Sagovsky, R. (1987), British Journal of Psychiatry 150, 568-570.",
    startCta: "Empezar",
  },
  flow: {
    progress: (current: number, total: number) =>
      `Pregunta ${current} de ${total}`,
    next: "Siguiente",
    back: "Atrás",
  },
  items: [
    {
      question: "He sido capaz de reír y ver el lado divertido de las cosas",
      options: [
        "Tanto como siempre",
        "Ahora no tanto",
        "Sin duda mucho menos ahora",
        "En absoluto",
      ],
    },
    {
      question: "He mirado las cosas por venir con ilusión",
      options: [
        "Tanto como siempre",
        "Algo menos que antes",
        "Sin duda menos que antes",
        "Casi nada",
      ],
    },
    {
      question: "Me he culpado sin necesidad cuando las cosas salían mal",
      options: [
        "Sí, casi siempre",
        "Sí, a veces",
        "No muy a menudo",
        "No, nunca",
      ],
    },
    {
      question: "He estado nerviosa o preocupada sin un buen motivo",
      options: [
        "No, en absoluto",
        "Casi nunca",
        "Sí, a veces",
        "Sí, muy a menudo",
      ],
    },
    {
      question: "He sentido miedo o pánico sin un motivo muy claro",
      options: [
        "Sí, bastante",
        "Sí, a veces",
        "No, no mucho",
        "No, en absoluto",
      ],
    },
    {
      question: "Las cosas me han estado superando",
      options: [
        "Sí, casi siempre no he podido afrontarlas en absoluto",
        "Sí, a veces no las he afrontado tan bien como de costumbre",
        "No, casi siempre las he afrontado bastante bien",
        "No, las he afrontado tan bien como siempre",
      ],
    },
    {
      question: "Me he sentido tan infeliz que me ha costado dormir",
      options: [
        "Sí, casi siempre",
        "Sí, a veces",
        "No muy a menudo",
        "No, en absoluto",
      ],
    },
    {
      question: "Me he sentido triste o desdichada",
      options: [
        "Sí, casi siempre",
        "Sí, bastante a menudo",
        "No muy a menudo",
        "No, en absoluto",
      ],
    },
    {
      question: "Me he sentido tan infeliz que he estado llorando",
      options: [
        "Sí, casi siempre",
        "Sí, bastante a menudo",
        "Solo de vez en cuando",
        "No, nunca",
      ],
    },
    {
      question: "Se me ha pasado por la cabeza la idea de hacerme daño",
      options: ["Sí, bastante a menudo", "A veces", "Casi nunca", "Nunca"],
    },
  ],
  result: {
    title: "Tu pausa",
    scoreCaption: (score: number) => `Total ${score} de 30`,
    disclaimer:
      "Esto es una pausa de cribado, no un diagnóstico. Solo un profesional puede valorar cómo te sientes. Puede ayudar llevar un seguimiento de cómo cambian estas respuestas con el tiempo.",
    doneCta: "Hecho",
    saveError:
      "No pudimos guardar esta pausa, así que no aparecerá en tu historial. Puedes intentarlo de nuevo más tarde.",
  },
  bands: {
    lower: {
      title: "Gracias por tomarte este momento",
      body: "Tus respuestas no sugieren nada urgente. Sigue prestándote atención y contacta con tu equipo de salud siempre que algo te preocupe.",
    },
    elevated: {
      title: "Podría ayudar hablarlo",
      body: "A muchas personas con respuestas en este rango les resulta útil hablarlo con su matrona, su médico o su profesional de salud.",
    },
    high: {
      title: "Compartir esto con tu equipo de salud podría ayudar",
      body: "Te animamos a compartir estas respuestas con tu equipo de salud pronto. Hay apoyo disponible y no tienes que llevar esto sola.",
    },
  },
  urgentSupport: {
    title: "Mereces apoyo ahora mismo",
    body: "Algunas de tus respuestas sugieren que podrías estar teniendo pensamientos de hacerte daño. Mereces apoyo ahora mismo — por favor, contacta con tu equipo de salud, o con los servicios de emergencia si estás en peligro inmediato.",
  },
  history: {
    title: "Tus pausas",
    empty: "Todavía no tienes pausas guardadas.",
    rowLabel: (date: string, score: number) =>
      `${date} — puntuación ${score} de 30`,
    lastCheckInLabel: (date: string, score: number) =>
      `Última pausa: ${date}, puntuación ${score}`,
    openCta: "Ver pausas anteriores",
    backCta: "Atrás",
  },
  delete: {
    cta: "Eliminar datos de las pausas",
    title: "Eliminar datos de las pausas",
    body: "Esto elimina de forma permanente todas las pausas guardadas de este dispositivo. Tu historial de ciclo, tus registros diarios y tus datos de embarazo y posparto no se ven afectados. No se puede deshacer.",
    deviceAuthPrompt:
      "Confirma que eres tú para eliminar los datos de tus pausas",
    dialog: {
      title: "¿Eliminar todos los datos de las pausas?",
      body: "Esto elimina de forma permanente todas las pausas guardadas en este dispositivo. No se puede deshacer.",
      confirm: "Eliminar",
      cancel: "Cancelar",
    },
    status: {
      deviceAuthUnavailable:
        "La autenticación del dispositivo no está disponible, así que no se puede continuar.",
      deviceAuthFailed:
        "No pudimos verificar que eres tú. Inténtalo de nuevo.",
      failed: "No pudimos eliminarlo ahora mismo. Inténtalo de nuevo.",
    },
  },
  disclaimer:
    "Esta pausa es una herramienta general de cribado, no un consejo médico ni un diagnóstico. Si te preocupa cómo te sientes, contacta con tu médico, tu matrona o tu profesional de salud.",
};

const screeningCopyIt: ScreeningCopy = {
  offer: {
    title: "Un momento delicato su come ti senti",
    body: "Una breve serie di domande private sulla settimana passata. Un momento con i tuoi tempi, non un test.",
    ctaLabel: "Inizia il momento",
  },
  intro: {
    title: "Come ti sei sentita",
    body: "Queste 10 domande riguardano come ti sei sentita negli ultimi 7 giorni. È un momento conosciuto usato dopo la nascita, non una diagnosi. Non ci sono risposte giuste o sbagliate.",
    instruction:
      "Per ogni domanda, scegli la risposta che più si avvicina a come ti sei sentita negli ultimi 7 giorni.",
    privacyNote: "Le tue risposte restano su questo dispositivo, cifrate.",
    attribution:
      "Scala di Edimburgo per la depressione postnatale (EPDS): Cox, J.L., Holden, J.M. e Sagovsky, R. (1987), British Journal of Psychiatry 150, 568-570.",
    startCta: "Inizia",
  },
  flow: {
    progress: (current: number, total: number) =>
      `Domanda ${current} di ${total}`,
    next: "Avanti",
    back: "Indietro",
  },
  items: [
    {
      question: "Sono riuscita a ridere e a vedere il lato divertente delle cose",
      options: [
        "Quanto sempre",
        "Ora non proprio così tanto",
        "Sicuramente molto meno ora",
        "Per niente",
      ],
    },
    {
      question: "Ho guardato alle cose con piacere e attesa",
      options: [
        "Quanto sempre",
        "Piuttosto meno di prima",
        "Sicuramente meno di prima",
        "Quasi per niente",
      ],
    },
    {
      question: "Mi sono incolpata senza motivo quando le cose andavano male",
      options: [
        "Sì, la maggior parte delle volte",
        "Sì, a volte",
        "Non molto spesso",
        "No, mai",
      ],
    },
    {
      question: "Sono stata ansiosa o preoccupata senza un valido motivo",
      options: [
        "No, per niente",
        "Quasi mai",
        "Sì, a volte",
        "Sì, molto spesso",
      ],
    },
    {
      question: "Ho avuto paura o sono andata nel panico senza un buon motivo",
      options: [
        "Sì, abbastanza",
        "Sì, a volte",
        "No, non molto",
        "No, per niente",
      ],
    },
    {
      question: "Le cose mi sono sembrate insormontabili",
      options: [
        "Sì, la maggior parte delle volte non sono riuscita affatto a farcela",
        "Sì, a volte non ho gestito bene come al solito",
        "No, la maggior parte delle volte ho gestito abbastanza bene",
        "No, ho gestito bene come sempre",
      ],
    },
    {
      question: "Sono stata così infelice da avere difficoltà a dormire",
      options: [
        "Sì, la maggior parte delle volte",
        "Sì, a volte",
        "Non molto spesso",
        "No, per niente",
      ],
    },
    {
      question: "Mi sono sentita triste o giù di morale",
      options: [
        "Sì, la maggior parte delle volte",
        "Sì, abbastanza spesso",
        "Non molto spesso",
        "No, per niente",
      ],
    },
    {
      question: "Sono stata così infelice da piangere",
      options: [
        "Sì, la maggior parte delle volte",
        "Sì, abbastanza spesso",
        "Solo ogni tanto",
        "No, mai",
      ],
    },
    {
      question: "Mi è venuto in mente il pensiero di farmi del male",
      options: ["Sì, abbastanza spesso", "A volte", "Quasi mai", "Mai"],
    },
  ],
  result: {
    title: "Il tuo momento",
    scoreCaption: (score: number) => `Totale ${score} su 30`,
    disclaimer:
      "Questo è un momento di screening, non una diagnosi. Solo un professionista può valutare come stai. Può aiutare tenere traccia di come queste risposte cambiano nel tempo.",
    doneCta: "Fatto",
    saveError:
      "Non siamo riusciti a salvare questo momento, quindi non comparirà nella cronologia. Puoi riprovare più tardi.",
  },
  bands: {
    lower: {
      title: "Grazie per aver dedicato questo momento",
      body: "Le tue risposte non suggeriscono nulla di urgente. Continua ad ascoltarti e rivolgiti al tuo team di cura ogni volta che qualcosa ti preoccupa.",
    },
    elevated: {
      title: "Potrebbe aiutare parlarne",
      body: "Molte persone con risposte in questo intervallo trovano utile parlarne con la propria ostetrica, il proprio medico o il proprio professionista sanitario.",
    },
    high: {
      title: "Condividere questo con il tuo team di cura potrebbe aiutare",
      body: "Ti incoraggiamo a condividere presto queste risposte con il tuo team di cura. Il supporto è disponibile e non devi affrontare tutto da sola.",
    },
  },
  urgentSupport: {
    title: "Meriti supporto proprio ora",
    body: "Alcune delle tue risposte suggeriscono che potresti avere pensieri di farti del male. Meriti supporto proprio ora — contatta il tuo team di cura, o i servizi di emergenza se sei in pericolo immediato.",
  },
  history: {
    title: "I tuoi momenti",
    empty: "Non hai ancora momenti salvati.",
    rowLabel: (date: string, score: number) =>
      `${date} — punteggio ${score} su 30`,
    lastCheckInLabel: (date: string, score: number) =>
      `Ultimo momento: ${date}, punteggio ${score}`,
    openCta: "Vedi i momenti passati",
    backCta: "Indietro",
  },
  delete: {
    cta: "Elimina i dati dei momenti",
    title: "Elimina i dati dei momenti",
    body: "Questo rimuove definitivamente ogni momento salvato da questo dispositivo. La cronologia del ciclo, i diari giornalieri e i dati su gravidanza e post-partum non sono interessati. Non può essere annullato.",
    deviceAuthPrompt:
      "Conferma che sei tu per eliminare i dati dei tuoi momenti",
    dialog: {
      title: "Eliminare tutti i dati dei momenti?",
      body: "Questo elimina definitivamente ogni momento salvato su questo dispositivo. Non può essere annullato.",
      confirm: "Elimina",
      cancel: "Annulla",
    },
    status: {
      deviceAuthUnavailable:
        "L'autenticazione del dispositivo non è disponibile, quindi non è possibile continuare.",
      deviceAuthFailed:
        "Non siamo riusciti a verificare la tua identità. Riprova.",
      failed: "Non siamo riusciti a eliminare adesso. Riprova.",
    },
  },
  disclaimer:
    "Questo momento è uno strumento di screening generale, non un consiglio medico o una diagnosi. Se sei preoccupata per come ti senti, contatta il tuo medico, la tua ostetrica o il tuo professionista sanitario.",
};

const screeningCopyCatalog: Record<InterfaceLanguage, ScreeningCopy> = {
  en: screeningCopyEn,
  ru: screeningCopyRu,
  es: screeningCopyEs,
  de: screeningCopyDe,
  fr: screeningCopyFr,
  it: screeningCopyIt,
};

export type { ScreeningCopy };

export function getScreeningCopy(language: string | null | undefined) {
  return screeningCopyCatalog[resolveCopyLanguage(language)];
}
