import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

// Warm, neutral postpartum-mode copy (recovery-card content deepened into
// a phase x mode-of-delivery matrix ; a later phase adds the
// cycle-return offer card + the LAM education card). Tone rules (SECURITY.md
// medical-safety invariant): education only, never diagnoses, outcome
// promises, or alarming instructions; no exclamation marks. The lochia timeline
// and the "a return to bright-red bleeding is worth contacting your care team"
// line are EDUCATION phrasing, not clinical alerts — red-flag / crisis
// surfaces are a separate task and are deliberately not built here. The LAM
// card is likewise commonly-discussed education plus talk-to-your-care-team —
// never framed as endorsing or configuring a contraception method.
// Postpartum outcome data is the same sensitivity class as pregnancy outcome
// data. en + ru are primary and reviewed against the tone invariant;
// de/fr/es/it are best-effort translations pending a native-speaker review
// before public launch.


// Recovery-card content matrix: phase x mode-of-delivery, nine
// bodies per locale. `neutral` covers a null/unknown mode of delivery (owner
// declined to say, or the source birth record carried none). The phase key
// mirrors postpartum-mode-service.PostpartumPhase structurally
// ("early" | "core" | "extended") -- duplicated here rather than imported,
// since src/i18n must not depend on src/services (architecture layering);
// TypeScript matches the two literal unions structurally at the call site.
type PostpartumRecoveryPhase = "early" | "core" | "extended";
export type PostpartumRecoveryMode = "vaginal" | "cesarean" | "neutral";
type PostpartumRecoveryBodyMatrix = Record<
  PostpartumRecoveryPhase,
  Record<PostpartumRecoveryMode, string>
>;

// Shared base for the extended-phase body: every mode reads nearly the same
// (mode-of-delivery mostly stops mattering by six weeks), so vaginal/neutral
// reuse this constant verbatim and cesarean appends one scar-specific clause
// -- avoids the vaginal/neutral copies silently drifting apart.
const postpartumRecoveryExtendedBaseEn =
  "Many people feel more like themselves after six weeks, even though healing quietly continues for months behind the scenes. Intimacy, exercise, and contraception timing are personal, and your care team can advise on what suits your recovery.";

const postpartumCopyEn = {
  // Offer step, shown ONLY after a just-confirmed birth in the same end-flow
  // session (never on a bare deep link). Always with an easy opt-out.
  offer: {
    title: "Switch to postpartum tracking?",
    body: "Follow your recovery week by week — a weeks-since-birth view, gentle recovery notes, and a few reminders. You can turn it off anytime.",
    startCta: "Start postpartum tracking",
    notNowCta: "Not now",
  },
  hero: {
    eyebrow: "Postpartum",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "weeks + days since birth",
    phaseLabels: {
      early: "Early recovery",
      core: "Core recovery",
      extended: "Ongoing recovery",
    },
  },
  // Recovery card body is phase x mode-of-delivery aware: nine bodies per
  // locale (early/core/extended x vaginal/cesarean/neutral), resolved by
  // postpartum-mode-service from this matrix -- see PostpartumRecoveryBodyMatrix
  // above. `neutral` also covers a null
  // mode of delivery.
  recovery: {
    title: "Your recovery",
    bodies: {
      early: {
        vaginal:
          "The first couple of weeks are mostly about rest, with gentle movement as you feel ready. Perineal soreness and bleeding are common in these early days. Warmth, plenty of water, and pain relief from your care team can all help you feel more comfortable.",
        cesarean:
          "You are also recovering from abdominal surgery, so extra rest matters in these first couple of weeks. It is common to avoid lifting anything heavier than your baby for now, and to keep the wound clean and dry. Short, gentle walks when you feel able support circulation, which also helps lower the chance of blood clots. Your care team will guide you on pacing your recovery.",
        neutral:
          "The first couple of weeks are mostly about rest, fluids, and accepting help from people around you. Bleeding and soreness are common early on and tend to ease with time. Your care team can advise on anything that feels concerning.",
      },
      core: {
        vaginal:
          "As bleeding settles over these weeks, many people gradually build up more activity. Gentle pelvic-floor exercises are commonly suggested during this stretch. Soreness should ease week by week, and your care team can advise if recovery feels slower than expected.",
        cesarean:
          "It is common to continue avoiding heavy lifting for around six weeks, since the wound keeps healing from the inside even once the skin looks settled. Gentle activity can build up gradually as you feel ready. Pelvic-floor work still matters after a cesarean, and your care team can advise on when to increase activity.",
        neutral:
          "This stretch is usually a gradual return to activity, at your own pace. Pelvic-floor exercises are commonly suggested around this time. Energy tends to return unevenly, and that is normal — your care team can advise if anything concerns you.",
      },
      extended: {
        vaginal: postpartumRecoveryExtendedBaseEn,
        neutral: postpartumRecoveryExtendedBaseEn,
        cesarean: `${postpartumRecoveryExtendedBaseEn} The scar area may stay numb or sensitive for a while, which is commonly normal.`,
      },
    } satisfies PostpartumRecoveryBodyMatrix,
  },
  lochia: {
    title: "Bleeding after birth",
    body: "Bleeding after birth (lochia) usually starts bright red for roughly the first five days, fades to pink or brown by around day 12, and turns whitish or pale over the following weeks, easing off by around six weeks. If bleeding that had settled turns bright red again, it is worth contacting your care team.",
  },
  // Cycle-return offer: a gentle dashboard nudge shown once the
  // day-log history shows a cycle start after the birth date. Accepting ends
  // postpartum tracking with reason "cycle_returned" (see
  // postpartum-mode-service.buildPostpartumCycleReturnOfferViewData); the
  // confirm dialog mirrors manage.endDialog's two-button, dismissal-keeps-
  // tracking contract.
  cycleReturnOffer: {
    title: "Your cycle may be back",
    body: "A period logged after the birth suggests your cycles are returning. You can close postpartum tracking and go back to the cycle view — your postpartum records stay saved.",
    acceptCta: "Close postpartum tracking",
    keepCta: "Keep postpartum view",
    confirmDialog: {
      title: "Close postpartum tracking?",
      body: "Ovumcy will close postpartum tracking and switch back to the cycle view. Your postpartum records stay saved on this device.",
      confirm: "Close tracking",
      cancel: "Keep tracking",
    },
  },
  // LAM (lactational amenorrhea method) education card: commonly-
  // discussed education only -- never framed as endorsing or configuring a
  // contraception method (SECURITY.md medical-safety invariant). No feeding
  // data is collected anywhere in the app; this card is static copy only.
  lam: {
    title: "Breastfeeding and your cycle",
    body: "While fully breastfeeding and before your period returns, many people have reduced fertility. This is commonly discussed as LAM (the lactational amenorrhea method). It is usually described as reliable only while all three conditions hold together: no period since birth, exclusive breastfeeding day and night, and a baby under six months old. Effectiveness changes quickly if any of these change — talk with your care team about what this means for you.",
  },
  // Compact dashboard fallback for an active postpartum record whose birth date
  // has drifted past the trackable window (more than ~6 months). Mirrors the
  // pregnancy staleCard: review/close, never a silent vanish.
  staleCard: {
    title: "Your postpartum tracking",
    body: "It has been a while since the birth date you recorded. Review your postpartum tracking to finish or update it.",
  },
  dashboard: {
    manageCta: "Manage postpartum tracking",
  },
  // Rows added to the pregnancy-end / manage screen for postpartum.
  manage: {
    startRow: "Start postpartum tracking",
    startHint:
      "Follow your recovery week by week, with a few gentle reminders. You can turn it off anytime.",
    endRow: "End postpartum tracking",
    endHint: "Switch back to cycle tracking only.",
    endDialog: {
      title: "End postpartum tracking?",
      body: "Ovumcy will stop postpartum tracking and return to your cycle. Your entries stay saved on this device. You can do this later instead.",
      confirm: "End tracking",
      cancel: "Keep tracking",
    },
  },
  delete: {
    cta: "Delete postpartum data",
    title: "Delete postpartum data",
    body: "This permanently removes all postpartum records from this device. Your cycle history, day logs, and pregnancy data are not affected. This can't be undone.",
    deviceAuthPrompt: "Confirm it's you to delete postpartum data",
    dialog: {
      title: "Delete all postpartum data?",
      body: "This permanently deletes every postpartum record on this device. This can't be undone.",
      confirm: "Delete",
      cancel: "Cancel",
    },
    status: {
      deviceAuthUnavailable:
        "Device authentication isn't available, so this can't continue.",
      deviceAuthFailed: "We couldn't verify it's you. Please try again.",
      failed: "We couldn't delete this just now. Please try again.",
    },
  },
  status: {
    startFailed:
      "We couldn't start postpartum tracking just now. Please try again.",
    endFailed: "We couldn't update this just now. Please try again.",
  },
  disclaimer:
    "These are general notes, not medical advice. Recovery is different for everyone. Talk to your doctor or midwife about your recovery and any concerns.",
} as const;

type PostpartumCopy = WidenLiteral<typeof postpartumCopyEn>;

const postpartumRecoveryExtendedBaseRu =
  "Многие снова чувствуют себя собой примерно через шесть недель, хотя восстановление незаметно продолжается ещё много месяцев. Близость, физическая активность и сроки возобновления контрацепции — личный выбор, и врач подскажет, что подходит именно вам.";

const postpartumCopyRu: PostpartumCopy = {
  offer: {
    title: "Перейти к отслеживанию послеродового периода?",
    body: "Следите за восстановлением неделя за неделей — сколько недель прошло после родов, мягкие заметки о восстановлении и несколько напоминаний. Отключить можно в любой момент.",
    startCta: "Начать отслеживание послеродового периода",
    notNowCta: "Не сейчас",
  },
  hero: {
    eyebrow: "После родов",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "недели + дни после родов",
    phaseLabels: {
      early: "Раннее восстановление",
      core: "Основное восстановление",
      extended: "Продолжающееся восстановление",
    },
  },
  recovery: {
    title: "Ваше восстановление",
    bodies: {
      early: {
        vaginal:
          "Первые пару недель — это прежде всего отдых, с мягкой активностью, когда вы к ней готовы. Болезненность в области промежности и выделения — обычное явление в эти первые дни. Тепло, достаточное количество воды и обезболивание, рекомендованное врачом, могут облегчить самочувствие.",
        cesarean:
          "Вы также восстанавливаетесь после полостной операции, поэтому в первые недели особенно важен дополнительный отдых. Обычно рекомендуют пока не поднимать ничего тяжелее малыша и следить, чтобы шов оставался чистым и сухим. Короткие спокойные прогулки, когда вы к ним готовы, помогают кровообращению и заодно снижают риск образования тромбов. Врач подскажет, в каком темпе восстанавливаться.",
        neutral:
          "Первые пару недель — это прежде всего отдых, достаточное количество жидкости и помощь от близких, которую стоит принимать. Выделения и болезненность — обычное явление в первое время и постепенно уменьшаются. Врач подскажет, если что-то вызывает беспокойство.",
      },
      core: {
        vaginal:
          "По мере того как выделения уменьшаются в эти недели, многие постепенно возвращаются к более активной жизни. В этот период часто рекомендуют мягкие упражнения для мышц тазового дна. Болезненность должна уменьшаться неделя за неделей, и врач подскажет, если восстановление кажется более медленным, чем ожидалось.",
        cesarean:
          "Обычно поднятие тяжестей по-прежнему стоит ограничивать примерно шесть недель, поскольку шов продолжает заживать изнутри, даже когда кожа уже выглядит зажившей. Активность можно постепенно наращивать, когда вы к этому готовы. Упражнения для мышц тазового дна важны и после кесарева сечения, и врач подскажет, когда увеличивать нагрузку.",
        neutral:
          "Этот период обычно проходит как постепенное возвращение к активности, в своём темпе. Примерно в это время часто рекомендуют упражнения для мышц тазового дна. Силы возвращаются неравномерно, и это нормально — врач подскажет, если что-то беспокоит.",
      },
      extended: {
        vaginal: postpartumRecoveryExtendedBaseRu,
        neutral: postpartumRecoveryExtendedBaseRu,
        cesarean: `${postpartumRecoveryExtendedBaseRu} Область шва может оставаться онемевшей или чувствительной некоторое время, и обычно это нормально.`,
      },
    } satisfies PostpartumRecoveryBodyMatrix,
  },
  lochia: {
    title: "Выделения после родов",
    body: "Выделения после родов (лохии) обычно первые примерно пять дней ярко-красные, к 12-му дню становятся розоватыми или коричневыми, а в следующие недели светлеют и к шести неделям почти прекращаются. Если уже уменьшившиеся выделения снова становятся ярко-красными, стоит обратиться к врачу.",
  },
  cycleReturnOffer: {
    title: "Возможно, ваш цикл возвращается",
    body: "Месячные, зафиксированные после родов, говорят о том, что цикл возвращается. Вы можете закрыть отслеживание послеродового периода и вернуться к отслеживанию цикла — ваши послеродовые записи останутся сохранены.",
    acceptCta: "Закрыть отслеживание послеродового периода",
    keepCta: "Остаться в послеродовом режиме",
    confirmDialog: {
      title: "Закрыть отслеживание послеродового периода?",
      body: "Ovumcy закроет отслеживание послеродового периода и вернётся к отслеживанию цикла. Ваши послеродовые записи останутся на этом устройстве.",
      confirm: "Закрыть отслеживание",
      cancel: "Продолжить отслеживание",
    },
  },
  lam: {
    title: "Грудное вскармливание и ваш цикл",
    body: "Пока вы кормите грудью полностью и месячные ещё не вернулись, у многих снижается фертильность. Это часто обсуждают как метод лактационной аменореи (МЛА). Обычно его считают надёжным, только если одновременно выполняются три условия: не было месячных после родов, кормление грудью полностью, днём и ночью, и возраст ребёнка меньше шести месяцев. Эффективность быстро меняется, если хотя бы одно из условий нарушается — обсудите с врачом, что это значит именно для вас.",
  },
  staleCard: {
    title: "Отслеживание послеродового периода",
    body: "С указанной вами даты родов прошло уже немало времени. Просмотрите отслеживание послеродового периода, чтобы завершить его или обновить данные.",
  },
  dashboard: {
    manageCta: "Управление послеродовым отслеживанием",
  },
  manage: {
    startRow: "Начать отслеживание послеродового периода",
    startHint:
      "Следите за восстановлением неделя за неделей с несколькими мягкими напоминаниями. Отключить можно в любой момент.",
    endRow: "Завершить отслеживание послеродового периода",
    endHint: "Вернуться только к отслеживанию цикла.",
    endDialog: {
      title: "Завершить отслеживание послеродового периода?",
      body: "Ovumcy остановит послеродовое отслеживание и вернётся к вашему циклу. Ваши записи останутся на этом устройстве. Это можно сделать и позже.",
      confirm: "Завершить",
      cancel: "Продолжить отслеживание",
    },
  },
  delete: {
    cta: "Удалить данные послеродового периода",
    title: "Удалить данные послеродового периода",
    body: "Это безвозвратно удалит все записи послеродового периода с этого устройства. История цикла, дневник дней и данные о беременности не затрагиваются. Отменить нельзя.",
    deviceAuthPrompt:
      "Подтвердите, что это вы, чтобы удалить данные послеродового периода",
    dialog: {
      title: "Удалить все данные послеродового периода?",
      body: "Это безвозвратно удалит все записи послеродового периода на этом устройстве. Отменить нельзя.",
      confirm: "Удалить",
      cancel: "Отмена",
    },
    status: {
      deviceAuthUnavailable:
        "Аутентификация устройства недоступна, поэтому действие нельзя продолжить.",
      deviceAuthFailed:
        "Не удалось подтвердить, что это вы. Попробуйте снова.",
      failed: "Не удалось удалить сейчас. Попробуйте снова.",
    },
  },
  status: {
    startFailed:
      "Не удалось начать послеродовое отслеживание сейчас. Попробуйте снова.",
    endFailed: "Не удалось обновить сейчас. Попробуйте снова.",
  },
  disclaimer:
    "Это общие сведения, а не медицинский совет. Восстановление у всех разное. Обсуждайте своё восстановление и любые вопросы с врачом или акушеркой.",
};

const postpartumRecoveryExtendedBaseDe =
  "Viele fühlen sich nach sechs Wochen wieder mehr wie sie selbst, auch wenn die Heilung im Hintergrund noch monatelang weitergeht. Intimität, Sport und der richtige Zeitpunkt für Verhütung sind persönliche Entscheidungen, und Ihr Behandlungsteam berät Sie, was zu Ihrer Erholung passt.";

const postpartumCopyDe: PostpartumCopy = {
  offer: {
    title: "Zum Wochenbett-Tracking wechseln?",
    body: "Verfolgen Sie Ihre Erholung Woche für Woche — eine Ansicht der Wochen seit der Geburt, sanfte Erholungshinweise und einige Erinnerungen. Sie können es jederzeit ausschalten.",
    startCta: "Wochenbett-Tracking starten",
    notNowCta: "Jetzt nicht",
  },
  hero: {
    eyebrow: "Wochenbett",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "Wochen + Tage seit der Geburt",
    phaseLabels: {
      early: "Frühe Erholung",
      core: "Hauptphase der Erholung",
      extended: "Fortlaufende Erholung",
    },
  },
  recovery: {
    title: "Ihre Erholung",
    bodies: {
      early: {
        vaginal:
          "In den ersten Wochen geht es vor allem um Ruhe, mit sanfter Bewegung, sobald Sie sich dazu bereit fühlen. Schmerzen im Dammbereich und Blutungen sind in diesen frühen Tagen normal. Wärme, ausreichend Wasser und eine von Ihrem Behandlungsteam empfohlene Schmerzlinderung können das Wohlbefinden unterstützen.",
        cesarean:
          "Sie erholen sich außerdem von einer Bauchoperation, daher ist zusätzliche Ruhe in diesen ersten Wochen besonders wichtig. Es ist üblich, vorerst nichts Schwereres als Ihr Baby zu heben und die Wunde sauber und trocken zu halten. Kurze, sanfte Spaziergänge, sobald Sie dazu in der Lage sind, unterstützen die Durchblutung und senken zugleich das Risiko von Blutgerinnseln. Ihr Behandlungsteam berät Sie zum Tempo Ihrer Erholung.",
        neutral:
          "In den ersten Wochen geht es vor allem um Ruhe, ausreichend Flüssigkeit und die Unterstützung durch Menschen um Sie herum. Blutungen und Schmerzen sind in dieser frühen Zeit normal und lassen mit der Zeit meist nach. Ihr Behandlungsteam berät Sie bei allem, was Ihnen Sorgen bereitet.",
      },
      core: {
        vaginal:
          "Während die Blutung in diesen Wochen nachlässt, steigern viele allmählich ihre Aktivität. Sanfte Beckenbodenübungen werden in dieser Phase häufig empfohlen. Die Beschwerden sollten Woche für Woche nachlassen, und Ihr Behandlungsteam berät Sie, falls die Erholung langsamer verläuft als erwartet.",
        cesarean:
          "Es ist üblich, etwa sechs Wochen lang weiterhin auf schweres Heben zu verzichten, da die Wunde von innen weiterheilt, auch wenn die Haut bereits verheilt aussieht. Aktivität kann allmählich gesteigert werden, sobald Sie sich dazu bereit fühlen. Beckenbodenübungen bleiben auch nach einem Kaiserschnitt wichtig, und Ihr Behandlungsteam berät Sie, wann Sie die Aktivität steigern können.",
        neutral:
          "Diese Phase ist meist eine allmähliche Rückkehr zur Aktivität, in Ihrem eigenen Tempo. Beckenbodenübungen werden um diese Zeit häufig empfohlen. Die Energie kehrt oft ungleichmäßig zurück, was normal ist — Ihr Behandlungsteam berät Sie bei allem, was Sie beschäftigt.",
      },
      extended: {
        vaginal: postpartumRecoveryExtendedBaseDe,
        neutral: postpartumRecoveryExtendedBaseDe,
        cesarean: `${postpartumRecoveryExtendedBaseDe} Der Bereich der Narbe kann noch eine Weile taub oder empfindlich bleiben, was normal ist.`,
      },
    } satisfies PostpartumRecoveryBodyMatrix,
  },
  lochia: {
    title: "Blutung nach der Geburt",
    body: "Die Blutung nach der Geburt (Wochenfluss) ist in den ersten rund fünf Tagen meist hellrot, wird bis etwa Tag 12 rosa oder bräunlich und über die folgenden Wochen heller, bis sie um die sechste Woche nachlässt. Wenn eine bereits abgeklungene Blutung wieder hellrot wird, ist es sinnvoll, Ihr Behandlungsteam zu kontaktieren.",
  },
  cycleReturnOffer: {
    title: "Ihr Zyklus könnte zurück sein",
    body: "Eine nach der Geburt erfasste Periode deutet darauf hin, dass Ihr Zyklus zurückkehrt. Sie können das Wochenbett-Tracking schließen und zur Zyklusansicht zurückkehren — Ihre Wochenbett-Einträge bleiben gespeichert.",
    acceptCta: "Wochenbett-Tracking schließen",
    keepCta: "Wochenbett-Ansicht behalten",
    confirmDialog: {
      title: "Wochenbett-Tracking schließen?",
      body: "Ovumcy schließt das Wochenbett-Tracking und wechselt zurück zur Zyklusansicht. Ihre Wochenbett-Einträge bleiben auf diesem Gerät gespeichert.",
      confirm: "Tracking schließen",
      cancel: "Tracking fortsetzen",
    },
  },
  lam: {
    title: "Stillen und Ihr Zyklus",
    body: "Solange Sie voll stillen und Ihre Periode noch nicht zurückgekehrt ist, ist die Fruchtbarkeit bei vielen Menschen verringert. Dies wird häufig als LAM (Laktationsamenorrhoe-Methode) bezeichnet. Sie gilt üblicherweise nur dann als zuverlässig, wenn alle drei Bedingungen gleichzeitig zutreffen: keine Periode seit der Geburt, ausschließliches Stillen Tag und Nacht, und ein Baby unter sechs Monaten. Die Wirksamkeit ändert sich schnell, sobald sich eine dieser Bedingungen ändert — besprechen Sie mit Ihrem Behandlungsteam, was das für Sie bedeutet.",
  },
  staleCard: {
    title: "Ihr Wochenbett-Tracking",
    body: "Das von Ihnen erfasste Geburtsdatum liegt schon eine Weile zurück. Prüfen Sie Ihr Wochenbett-Tracking, um es abzuschließen oder zu aktualisieren.",
  },
  dashboard: {
    manageCta: "Wochenbett-Tracking verwalten",
  },
  manage: {
    startRow: "Wochenbett-Tracking starten",
    startHint:
      "Verfolgen Sie Ihre Erholung Woche für Woche mit einigen sanften Erinnerungen. Sie können es jederzeit ausschalten.",
    endRow: "Wochenbett-Tracking beenden",
    endHint: "Nur zum Zyklus-Tracking zurückkehren.",
    endDialog: {
      title: "Wochenbett-Tracking beenden?",
      body: "Ovumcy beendet das Wochenbett-Tracking und kehrt zu Ihrem Zyklus zurück. Ihre Einträge bleiben auf diesem Gerät gespeichert. Sie können das auch später tun.",
      confirm: "Beenden",
      cancel: "Weiter verfolgen",
    },
  },
  delete: {
    cta: "Wochenbettdaten löschen",
    title: "Wochenbettdaten löschen",
    body: "Damit werden alle Wochenbett-Einträge dauerhaft von diesem Gerät entfernt. Ihr Zyklusverlauf, Ihre Tageseinträge und Ihre Schwangerschaftsdaten sind nicht betroffen. Das kann nicht rückgängig gemacht werden.",
    deviceAuthPrompt:
      "Bestätigen Sie, dass Sie es sind, um Wochenbettdaten zu löschen",
    dialog: {
      title: "Alle Wochenbettdaten löschen?",
      body: "Damit werden alle Wochenbett-Einträge auf diesem Gerät dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.",
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
  status: {
    startFailed:
      "Wir konnten das Wochenbett-Tracking gerade nicht starten. Bitte versuchen Sie es erneut.",
    endFailed:
      "Wir konnten das gerade nicht aktualisieren. Bitte versuchen Sie es erneut.",
  },
  disclaimer:
    "Dies sind allgemeine Hinweise, keine medizinische Beratung. Die Erholung ist bei jeder Person anders. Besprechen Sie Ihre Erholung und alle Fragen mit Ihrer Ärztin, Ihrem Arzt oder Ihrer Hebamme.",
};

const postpartumRecoveryExtendedBaseFr =
  "Beaucoup se sentent plus elles-mêmes après six semaines, même si la guérison se poursuit tranquillement pendant des mois. L'intimité, l'exercice et le moment de reprendre une contraception sont des choix personnels, et votre équipe soignante peut vous conseiller sur ce qui convient à votre récupération.";

const postpartumCopyFr: PostpartumCopy = {
  offer: {
    title: "Passer au suivi post-partum ?",
    body: "Suivez votre récupération semaine après semaine — une vue des semaines depuis la naissance, des notes de récupération douces et quelques rappels. Vous pouvez le désactiver quand vous voulez.",
    startCta: "Démarrer le suivi post-partum",
    notNowCta: "Pas maintenant",
  },
  hero: {
    eyebrow: "Post-partum",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "semaines + jours depuis la naissance",
    phaseLabels: {
      early: "Récupération précoce",
      core: "Récupération principale",
      extended: "Récupération continue",
    },
  },
  recovery: {
    title: "Votre récupération",
    bodies: {
      early: {
        vaginal:
          "Les premières semaines sont surtout consacrées au repos, avec des mouvements doux dès que vous vous en sentez capable. Une gêne au niveau du périnée et des saignements sont courants durant ces premiers jours. La chaleur, une bonne hydratation et un soulagement de la douleur recommandé par votre équipe soignante peuvent vous aider à vous sentir mieux.",
        cesarean:
          "Vous récupérez aussi d'une chirurgie abdominale, le repos supplémentaire est donc important durant ces premières semaines. Il est courant d'éviter de porter plus lourd que votre bébé pour l'instant, et de garder la cicatrice propre et sèche. De courtes marches douces, dès que vous vous en sentez capable, favorisent la circulation et aident aussi à réduire le risque de caillots sanguins. Votre équipe soignante vous guidera sur le rythme de votre récupération.",
        neutral:
          "Les premières semaines sont surtout consacrées au repos, à l'hydratation et à l'aide acceptée de votre entourage. Les saignements et la gêne sont courants au début et s'atténuent généralement avec le temps. Votre équipe soignante peut vous conseiller sur tout ce qui vous inquiète.",
      },
      core: {
        vaginal:
          "À mesure que les saignements diminuent au cours de ces semaines, beaucoup reprennent progressivement plus d'activité. Des exercices doux du plancher pelvien sont couramment recommandés durant cette période. La gêne devrait s'atténuer semaine après semaine, et votre équipe soignante peut vous conseiller si la récupération semble plus lente que prévu.",
        cesarean:
          "Il est courant de continuer à éviter de porter des charges lourdes pendant environ six semaines, car la cicatrice continue de guérir en profondeur même quand la peau semble refermée. L'activité peut reprendre progressivement, à votre rythme. Le travail du plancher pelvien reste important même après une césarienne, et votre équipe soignante peut vous conseiller sur le moment d'augmenter l'activité.",
        neutral:
          "Cette période est généralement marquée par un retour progressif à l'activité, à votre propre rythme. Des exercices du plancher pelvien sont couramment recommandés à ce stade. L'énergie revient souvent de façon inégale, ce qui est normal — votre équipe soignante peut vous conseiller si quelque chose vous préoccupe.",
      },
      extended: {
        vaginal: postpartumRecoveryExtendedBaseFr,
        neutral: postpartumRecoveryExtendedBaseFr,
        cesarean: `${postpartumRecoveryExtendedBaseFr} La zone de la cicatrice peut rester engourdie ou sensible pendant un moment, ce qui est généralement normal.`,
      },
    } satisfies PostpartumRecoveryBodyMatrix,
  },
  lochia: {
    title: "Saignements après la naissance",
    body: "Les saignements après la naissance (lochies) sont généralement rouge vif pendant environ les cinq premiers jours, deviennent roses ou bruns vers le 12e jour, puis pâlissent au fil des semaines et diminuent vers six semaines. Si des saignements qui s'étaient calmés redeviennent rouge vif, il est utile de contacter votre équipe soignante.",
  },
  cycleReturnOffer: {
    title: "Votre cycle est peut-être de retour",
    body: "Des règles enregistrées après la naissance suggèrent que votre cycle revient. Vous pouvez fermer le suivi post-partum et revenir à la vue du cycle — vos données post-partum restent enregistrées.",
    acceptCta: "Fermer le suivi post-partum",
    keepCta: "Garder la vue post-partum",
    confirmDialog: {
      title: "Fermer le suivi post-partum ?",
      body: "Ovumcy fermera le suivi post-partum et reviendra à la vue du cycle. Vos données post-partum restent enregistrées sur cet appareil.",
      confirm: "Fermer le suivi",
      cancel: "Continuer le suivi",
    },
  },
  lam: {
    title: "Allaitement et votre cycle",
    body: "Tant que vous allaitez exclusivement et que vos règles ne sont pas revenues, la fertilité de nombreuses personnes est réduite. C'est ce qu'on appelle couramment la méthode MAMA (méthode de l'allaitement maternel et de l'aménorrhée). Elle est généralement décrite comme fiable uniquement si ces trois conditions sont réunies : aucune règle depuis la naissance, allaitement exclusif de jour comme de nuit, et un bébé de moins de six mois. L'efficacité change rapidement dès que l'une de ces conditions change — parlez-en à votre équipe soignante pour savoir ce que cela signifie pour vous.",
  },
  staleCard: {
    title: "Votre suivi post-partum",
    body: "La date de naissance que vous avez enregistrée remonte à un moment. Consultez votre suivi post-partum pour le terminer ou le mettre à jour.",
  },
  dashboard: {
    manageCta: "Gérer le suivi post-partum",
  },
  manage: {
    startRow: "Démarrer le suivi post-partum",
    startHint:
      "Suivez votre récupération semaine après semaine, avec quelques rappels doux. Vous pouvez le désactiver quand vous voulez.",
    endRow: "Terminer le suivi post-partum",
    endHint: "Revenir au suivi du cycle uniquement.",
    endDialog: {
      title: "Terminer le suivi post-partum ?",
      body: "Ovumcy arrêtera le suivi post-partum et reviendra à votre cycle. Vos entrées restent enregistrées sur cet appareil. Vous pouvez aussi le faire plus tard.",
      confirm: "Terminer",
      cancel: "Continuer le suivi",
    },
  },
  delete: {
    cta: "Supprimer les données post-partum",
    title: "Supprimer les données post-partum",
    body: "Cela supprime définitivement toutes les données post-partum de cet appareil. Votre historique de cycle, vos journaux quotidiens et vos données de grossesse ne sont pas affectés. Cette action est irréversible.",
    deviceAuthPrompt:
      "Confirmez votre identité pour supprimer les données post-partum",
    dialog: {
      title: "Supprimer toutes les données post-partum ?",
      body: "Cela supprime définitivement toutes les données post-partum sur cet appareil. Cette action est irréversible.",
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
  status: {
    startFailed:
      "Nous n'avons pas pu démarrer le suivi post-partum pour le moment. Veuillez réessayer.",
    endFailed:
      "Nous n'avons pas pu mettre à jour pour le moment. Veuillez réessayer.",
  },
  disclaimer:
    "Ce sont des notes générales, pas un avis médical. La récupération est différente pour chacune. Parlez de votre récupération et de toute préoccupation à votre médecin ou sage-femme.",
};

const postpartumRecoveryExtendedBaseEs =
  "Muchas personas se sienten más ellas mismas después de las seis semanas, aunque la curación sigue avanzando en silencio durante meses. La intimidad, el ejercicio y el momento de retomar la anticoncepción son decisiones personales, y tu equipo de salud puede orientarte sobre lo que conviene a tu recuperación.";

const postpartumCopyEs: PostpartumCopy = {
  offer: {
    title: "¿Cambiar al seguimiento posparto?",
    body: "Sigue tu recuperación semana a semana: una vista de las semanas desde el parto, notas de recuperación suaves y algunos recordatorios. Puedes desactivarlo cuando quieras.",
    startCta: "Iniciar el seguimiento posparto",
    notNowCta: "Ahora no",
  },
  hero: {
    eyebrow: "Posparto",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "semanas + días desde el parto",
    phaseLabels: {
      early: "Recuperación temprana",
      core: "Recuperación principal",
      extended: "Recuperación continua",
    },
  },
  recovery: {
    title: "Tu recuperación",
    bodies: {
      early: {
        vaginal:
          "Las primeras semanas son sobre todo de descanso, con movimiento suave a medida que te sientas lista. Las molestias en el perineo y el sangrado son habituales en estos primeros días. El calor, beber suficiente agua y el alivio del dolor recomendado por tu equipo de salud pueden ayudarte a sentirte mejor.",
        cesarean:
          "También te estás recuperando de una cirugía abdominal, así que el descanso adicional importa en estas primeras semanas. Es habitual evitar levantar algo más pesado que tu bebé por ahora, y mantener la herida limpia y seca. Caminatas cortas y suaves, cuando te sientas capaz, favorecen la circulación y también ayudan a reducir el riesgo de coágulos. Tu equipo de salud te orientará sobre el ritmo de tu recuperación.",
        neutral:
          "Las primeras semanas son sobre todo de descanso, líquidos y aceptar la ayuda de quienes te rodean. El sangrado y las molestias son habituales al principio y suelen ir disminuyendo con el tiempo. Tu equipo de salud puede orientarte sobre cualquier cosa que te preocupe.",
      },
      core: {
        vaginal:
          "A medida que el sangrado disminuye en estas semanas, muchas personas retoman la actividad poco a poco. Los ejercicios suaves de suelo pélvico se recomiendan con frecuencia durante esta etapa. Las molestias deberían ir mejorando semana a semana, y tu equipo de salud puede orientarte si la recuperación se siente más lenta de lo esperado.",
        cesarean:
          "Es habitual seguir evitando levantar peso durante unas seis semanas, ya que la herida sigue cicatrizando por dentro incluso cuando la piel ya parece curada. La actividad puede aumentar poco a poco, a tu propio ritmo. El trabajo de suelo pélvico también importa después de una cesárea, y tu equipo de salud puede orientarte sobre cuándo aumentar la actividad.",
        neutral:
          "Esta etapa suele ser un regreso gradual a la actividad, a tu propio ritmo. Los ejercicios de suelo pélvico se recomiendan con frecuencia por estas semanas. La energía suele volver de forma irregular, y eso es normal — tu equipo de salud puede orientarte si algo te preocupa.",
      },
      extended: {
        vaginal: postpartumRecoveryExtendedBaseEs,
        neutral: postpartumRecoveryExtendedBaseEs,
        cesarean: `${postpartumRecoveryExtendedBaseEs} La zona de la cicatriz puede seguir estando adormecida o sensible durante un tiempo, algo que suele ser normal.`,
      },
    } satisfies PostpartumRecoveryBodyMatrix,
  },
  lochia: {
    title: "Sangrado tras el parto",
    body: "El sangrado tras el parto (loquios) suele empezar de color rojo vivo durante los primeros cinco días aproximadamente, se vuelve rosado o marrón hacia el día 12 y se aclara en las semanas siguientes, disminuyendo hacia las seis semanas. Si un sangrado que ya había cedido vuelve a ser rojo vivo, conviene contactar con tu equipo de salud.",
  },
  cycleReturnOffer: {
    title: "Tu ciclo podría haber vuelto",
    body: "Un sangrado registrado después del parto sugiere que tu ciclo está regresando. Puedes cerrar el seguimiento posparto y volver a la vista del ciclo — tus registros posparto se mantienen guardados.",
    acceptCta: "Cerrar el seguimiento posparto",
    keepCta: "Mantener la vista posparto",
    confirmDialog: {
      title: "¿Cerrar el seguimiento posparto?",
      body: "Ovumcy cerrará el seguimiento posparto y volverá a la vista del ciclo. Tus registros posparto se mantienen guardados en este dispositivo.",
      confirm: "Cerrar seguimiento",
      cancel: "Seguir con el seguimiento",
    },
  },
  lam: {
    title: "Lactancia y tu ciclo",
    body: "Mientras estés en lactancia exclusiva y tu periodo aún no haya vuelto, muchas personas tienen la fertilidad reducida. Esto se conoce comúnmente como MELA (método de la lactancia y amenorrea). Suele describirse como fiable solo mientras se cumplan las tres condiciones a la vez: sin periodo desde el parto, lactancia exclusiva de día y de noche, y un bebé menor de seis meses. La eficacia cambia rápidamente si alguna de estas condiciones cambia — habla con tu equipo de salud sobre lo que esto significa para ti.",
  },
  staleCard: {
    title: "Tu seguimiento posparto",
    body: "Ha pasado un tiempo desde la fecha de parto que registraste. Revisa tu seguimiento posparto para finalizarlo o actualizarlo.",
  },
  dashboard: {
    manageCta: "Gestionar el seguimiento posparto",
  },
  manage: {
    startRow: "Iniciar el seguimiento posparto",
    startHint:
      "Sigue tu recuperación semana a semana, con algunos recordatorios suaves. Puedes desactivarlo cuando quieras.",
    endRow: "Finalizar el seguimiento posparto",
    endHint: "Volver solo al seguimiento del ciclo.",
    endDialog: {
      title: "¿Finalizar el seguimiento posparto?",
      body: "Ovumcy detendrá el seguimiento posparto y volverá a tu ciclo. Tus entradas se mantienen guardadas en este dispositivo. También puedes hacerlo más tarde.",
      confirm: "Finalizar",
      cancel: "Seguir con el seguimiento",
    },
  },
  delete: {
    cta: "Eliminar datos del posparto",
    title: "Eliminar datos del posparto",
    body: "Esto elimina de forma permanente todos los registros del posparto de este dispositivo. Tu historial de ciclo, tus registros diarios y tus datos de embarazo no se ven afectados. No se puede deshacer.",
    deviceAuthPrompt:
      "Confirma que eres tú para eliminar los datos del posparto",
    dialog: {
      title: "¿Eliminar todos los datos del posparto?",
      body: "Esto elimina de forma permanente todos los registros del posparto de este dispositivo. No se puede deshacer.",
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
  status: {
    startFailed:
      "No pudimos iniciar el seguimiento posparto ahora mismo. Inténtalo de nuevo.",
    endFailed: "No pudimos actualizarlo ahora mismo. Inténtalo de nuevo.",
  },
  disclaimer:
    "Estas son notas generales, no consejo médico. La recuperación es diferente para cada persona. Habla con tu médico o matrona sobre tu recuperación y cualquier preocupación.",
};

const postpartumRecoveryExtendedBaseIt =
  "Molte persone si sentono più sé stesse dopo le sei settimane, anche se la guarigione continua silenziosamente per mesi. Intimità, attività fisica e i tempi per riprendere la contraccezione sono scelte personali, e il tuo team di cura può consigliarti su cosa è adatto alla tua ripresa.";

const postpartumCopyIt: PostpartumCopy = {
  offer: {
    title: "Passare al monitoraggio post-partum?",
    body: "Segui la tua ripresa settimana per settimana: una vista delle settimane dalla nascita, note delicate sulla ripresa e qualche promemoria. Puoi disattivarlo quando vuoi.",
    startCta: "Avvia il monitoraggio post-partum",
    notNowCta: "Non ora",
  },
  hero: {
    eyebrow: "Post-partum",
    weekValue: (weeks: number, days: number) => `${weeks}+${days}`,
    weekCaption: "settimane + giorni dalla nascita",
    phaseLabels: {
      early: "Ripresa iniziale",
      core: "Ripresa principale",
      extended: "Ripresa continua",
    },
  },
  recovery: {
    title: "La tua ripresa",
    bodies: {
      early: {
        vaginal:
          "Le prime settimane servono soprattutto al riposo, con movimento delicato quando ti senti pronta. Fastidio nella zona perineale e perdite di sangue sono comuni in questi primi giorni. Il calore, una buona idratazione e un sollievo dal dolore consigliato dal tuo team di cura possono aiutarti a stare più comoda.",
        cesarean:
          "Ti stai anche riprendendo da un intervento chirurgico addominale, quindi un riposo extra è importante in queste prime settimane. È comune evitare di sollevare pesi maggiori del tuo bambino per ora, e tenere la ferita pulita e asciutta. Brevi passeggiate leggere, quando ti senti in grado, favoriscono la circolazione e aiutano anche a ridurre il rischio di coaguli. Il tuo team di cura ti guiderà sui ritmi della tua ripresa.",
        neutral:
          "Le prime settimane servono soprattutto al riposo, ai liquidi e ad accettare l'aiuto delle persone intorno a te. Perdite di sangue e fastidi sono comuni all'inizio e tendono ad attenuarsi con il tempo. Il tuo team di cura può consigliarti su qualsiasi cosa ti preoccupi.",
      },
      core: {
        vaginal:
          "Man mano che le perdite di sangue diminuiscono in queste settimane, molte persone riprendono gradualmente più attività. In questo periodo si consigliano spesso esercizi delicati per il pavimento pelvico. Il fastidio dovrebbe attenuarsi settimana dopo settimana, e il tuo team di cura può consigliarti se la ripresa sembra più lenta del previsto.",
        cesarean:
          "È comune continuare a evitare di sollevare pesi per circa sei settimane, perché la ferita continua a guarire dall'interno anche quando la pelle sembra già rimarginata. L'attività può aumentare gradualmente, quando ti senti pronta. Il lavoro sul pavimento pelvico resta importante anche dopo un cesareo, e il tuo team di cura può consigliarti quando aumentare l'attività.",
        neutral:
          "Questo periodo è di solito un ritorno graduale all'attività, con i tuoi tempi. In questa fase si consigliano spesso esercizi per il pavimento pelvico. Le energie tornano spesso in modo irregolare, ed è normale — il tuo team di cura può consigliarti se qualcosa ti preoccupa.",
      },
      extended: {
        vaginal: postpartumRecoveryExtendedBaseIt,
        neutral: postpartumRecoveryExtendedBaseIt,
        cesarean: `${postpartumRecoveryExtendedBaseIt} La zona della cicatrice può restare intorpidita o sensibile per un po', il che è comunemente normale.`,
      },
    } satisfies PostpartumRecoveryBodyMatrix,
  },
  lochia: {
    title: "Sanguinamento dopo il parto",
    body: "Il sanguinamento dopo il parto (lochiazioni) di solito è rosso vivo per i primi cinque giorni circa, diventa rosato o marrone verso il 12° giorno e schiarisce nelle settimane successive, riducendosi intorno alle sei settimane. Se un sanguinamento che si era attenuato torna rosso vivo, vale la pena contattare il tuo team di cura.",
  },
  cycleReturnOffer: {
    title: "Il tuo ciclo potrebbe essere tornato",
    body: "Un sanguinamento registrato dopo il parto suggerisce che il ciclo sta tornando. Puoi chiudere il monitoraggio post-partum e tornare alla vista del ciclo — i tuoi dati post-partum restano salvati.",
    acceptCta: "Chiudi il monitoraggio post-partum",
    keepCta: "Mantieni la vista post-partum",
    confirmDialog: {
      title: "Chiudere il monitoraggio post-partum?",
      body: "Ovumcy chiuderà il monitoraggio post-partum e tornerà alla vista del ciclo. I tuoi dati post-partum restano salvati su questo dispositivo.",
      confirm: "Chiudi monitoraggio",
      cancel: "Continua a monitorare",
    },
  },
  lam: {
    title: "Allattamento e il tuo ciclo",
    body: "Finché allatti in modo esclusivo e il ciclo non è ancora tornato, molte persone hanno una fertilità ridotta. Questo è comunemente indicato come LAM (metodo dell'amenorrea da allattamento). Viene generalmente descritto come affidabile solo se sussistono contemporaneamente tre condizioni: nessun ciclo dalla nascita, allattamento esclusivo giorno e notte, e un bambino di età inferiore ai sei mesi. L'efficacia cambia rapidamente se una di queste condizioni cambia: parlane con il tuo team di cura per capire cosa significa per te.",
  },
  staleCard: {
    title: "Il tuo monitoraggio post-partum",
    body: "È passato un po' di tempo dalla data di nascita che hai registrato. Controlla il monitoraggio post-partum per completarlo o aggiornarlo.",
  },
  dashboard: {
    manageCta: "Gestisci il monitoraggio post-partum",
  },
  manage: {
    startRow: "Avvia il monitoraggio post-partum",
    startHint:
      "Segui la tua ripresa settimana per settimana, con qualche promemoria delicato. Puoi disattivarlo quando vuoi.",
    endRow: "Termina il monitoraggio post-partum",
    endHint: "Tornare solo al monitoraggio del ciclo.",
    endDialog: {
      title: "Terminare il monitoraggio post-partum?",
      body: "Ovumcy interromperà il monitoraggio post-partum e tornerà al tuo ciclo. Le tue voci restano salvate su questo dispositivo. Puoi farlo anche più tardi.",
      confirm: "Termina",
      cancel: "Continua a monitorare",
    },
  },
  delete: {
    cta: "Elimina i dati post-partum",
    title: "Elimina i dati post-partum",
    body: "Questo rimuove definitivamente tutti i record post-partum da questo dispositivo. La cronologia del ciclo, i diari giornalieri e i dati sulla gravidanza non sono interessati. Non può essere annullato.",
    deviceAuthPrompt:
      "Conferma che sei tu per eliminare i dati post-partum",
    dialog: {
      title: "Eliminare tutti i dati post-partum?",
      body: "Questo elimina definitivamente ogni record post-partum su questo dispositivo. Non può essere annullato.",
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
  status: {
    startFailed:
      "Non siamo riusciti ad avviare il monitoraggio post-partum adesso. Riprova.",
    endFailed: "Non siamo riusciti ad aggiornare adesso. Riprova.",
  },
  disclaimer:
    "Queste sono note generali, non un consiglio medico. La ripresa è diversa per ognuna. Parla della tua ripresa e di qualsiasi dubbio con il tuo medico o la tua ostetrica.",
};

const postpartumCopyCatalog: Record<InterfaceLanguage, PostpartumCopy> = {
  en: postpartumCopyEn,
  ru: postpartumCopyRu,
  es: postpartumCopyEs,
  de: postpartumCopyDe,
  fr: postpartumCopyFr,
  it: postpartumCopyIt,
};

export type { PostpartumCopy };

export function getPostpartumCopy(language: string | null | undefined) {
  return postpartumCopyCatalog[resolveCopyLanguage(language)];
}
