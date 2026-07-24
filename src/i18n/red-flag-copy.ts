import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

// Red-flag education copy: the static "when to contact your care
// team" reasons shown, collapsed by default, on the pregnancy and postpartum
// dashboards. STRICT tone rules (SECURITY.md medical-safety invariant): this
// is EDUCATION ONLY -- no logged data is ever evaluated against these items,
// nothing here is a diagnosis, a threshold, or a personalized verdict; calm
// phrasing, no exclamation marks, "contact your care team promptly" register.
// The `mental_health` item stays gentle; the dedicated crisis-support block
// (CrisisSupportCard + crisis-copy) now hosts the personal-contact surface.
// `psychosis_signs` (postpartum only) is the ONE firm-but-calm escalation the
// domain reference demands for postpartum psychosis: education register, no
// sirens, but the correct "now"/"today" urgency (a treatable, time-critical
// emergency).
//
// `section` (title/intro/expand/collapse) is ONE shared header reused by both
// dashboards; only `items` differs per mode -- pregnancy-mode-service.ts and
// postpartum-mode-service.ts each own their own static id list (which items
// belong to that dashboard) plus, for pregnancy only, the gestational-age
// filtering of `reduced_movements`/`waters_early`. That selection is product
// logic and deliberately lives in the services, not here -- this catalog is
// text only.
//
// en + ru are primary and checked against the tone invariant above; de/fr/es/
// it are best-effort translations pending a native-speaker review before
// public launch, same status as every other pregnancy/postpartum catalog.

export type RedFlagItemID =
  | "heavy_bleeding"
  | "preeclampsia_signs"
  | "severe_vomiting"
  | "reduced_movements"
  | "waters_early"
  | "fever"
  | "heavy_bleeding_pp"
  | "bleeding_returns"
  | "vte_signs"
  | "fever_pp"
  | "breast_symptoms"
  | "preeclampsia_pp"
  | "mental_health"
  | "psychosis_signs";

type RedFlagItemsCopy = Record<RedFlagItemID, { title: string; body: string }>;

const redFlagCopyEn = {
  section: {
    title: "When to contact your care team",
    intro:
      "These are common reasons to reach out promptly — trust your instincts even when something isn't on this list.",
    expandLabel: "Show reasons to contact your care team",
    collapseLabel: "Hide reasons to contact your care team",
  },
  items: {
    heavy_bleeding: {
      title: "Heavy bleeding",
      body: "Soaking through pads, with or without pain.",
    },
    preeclampsia_signs: {
      title: "Possible signs of preeclampsia",
      body: "A severe or persistent headache, changes in your vision, or sudden swelling of your face or hands, especially after week 20.",
    },
    severe_vomiting: {
      title: "Severe vomiting",
      body: "Unable to keep fluids down for a day or more.",
    },
    reduced_movements: {
      title: "Reduced movements",
      body: "A clear decrease in your baby's usual movements.",
    },
    waters_early: {
      title: "Waters breaking early",
      body: "A gush or steady leak of fluid before week 37.",
    },
    fever: {
      title: "Fever",
      body: "A fever that doesn't settle.",
    },
    heavy_bleeding_pp: {
      title: "Heavy bleeding",
      body: "Soaking a pad within an hour, or passing large clots.",
    },
    bleeding_returns: {
      title: "Bleeding returns",
      body: "Bright-red bleeding returning after it had settled.",
    },
    vte_signs: {
      title: "Possible signs of a blood clot",
      body: "Pain or swelling in one leg, sudden breathlessness, or chest pain — reach out urgently.",
    },
    fever_pp: {
      title: "Fever or chills",
      body: "A fever or chills.",
    },
    breast_symptoms: {
      title: "Breast pain, redness, or warmth with fever",
      body: "A painful, red, hot area of the breast with a fever.",
    },
    preeclampsia_pp: {
      title: "Possible signs of preeclampsia",
      body: "A severe headache or changes in your vision in the first weeks after birth.",
    },
    // Neutral by design -- see the file header. A dedicated crisis-support
    // block (EPDS + emergency resources) is a separate, later task.
    mental_health: {
      title: "Finding it hard to cope",
      body: "Feeling unable to cope, hopeless, or having thoughts of harming yourself. You deserve support now — contact your care team or emergency services.",
    },
    psychosis_signs: {
      title: "Confusion, seeing or hearing things, or not sleeping",
      body: "Seeing or hearing things others don't, feeling paranoid or confused, racing thoughts, or being unable to sleep for days in the first weeks after birth need urgent medical attention now — these symptoms are treatable and time-critical. Ask someone close to you to help you get care today.",
    },
  } satisfies RedFlagItemsCopy,
} as const;

type RedFlagCopy = WidenLiteral<typeof redFlagCopyEn>;

const redFlagCopyRu: RedFlagCopy = {
  section: {
    title: "Когда обращаться к врачу или акушерке",
    intro:
      "Это частые поводы обратиться к врачу или акушерке без промедления — доверяйте своим ощущениям, даже если чего-то нет в этом списке.",
    expandLabel: "Показать поводы обратиться к врачу",
    collapseLabel: "Скрыть поводы обратиться к врачу",
  },
  items: {
    heavy_bleeding: {
      title: "Сильное кровотечение",
      body: "Прокладка промокает насквозь, с болью или без неё.",
    },
    preeclampsia_signs: {
      title: "Возможные признаки преэклампсии",
      body: "Сильная или неотступающая головная боль, изменения зрения или внезапный отёк лица либо рук — особенно после 20-й недели.",
    },
    severe_vomiting: {
      title: "Сильная рвота",
      body: "Не удаётся удерживать жидкость в течение суток и более.",
    },
    reduced_movements: {
      title: "Снижение шевелений",
      body: "Заметное уменьшение привычной активности малыша.",
    },
    waters_early: {
      title: "Раннее излитие вод",
      body: "Внезапное или постепенное подтекание жидкости до 37-й недели.",
    },
    fever: {
      title: "Повышенная температура",
      body: "Температура, которая не снижается.",
    },
    heavy_bleeding_pp: {
      title: "Сильное кровотечение",
      body: "Прокладка промокает за час или отходят крупные сгустки.",
    },
    bleeding_returns: {
      title: "Возврат кровотечения",
      body: "Уже посветлевшие выделения снова становятся ярко-красными.",
    },
    vte_signs: {
      title: "Возможные признаки тромбоза",
      body: "Боль или отёк одной ноги, внезапная одышка или боль в груди — обратитесь за помощью незамедлительно.",
    },
    fever_pp: {
      title: "Температура или озноб",
      body: "Повышенная температура или озноб.",
    },
    breast_symptoms: {
      title: "Боль, покраснение или жар в груди с температурой",
      body: "Болезненный, покрасневший, горячий участок груди вместе с повышенной температурой.",
    },
    preeclampsia_pp: {
      title: "Возможные признаки преэклампсии",
      body: "Сильная головная боль или изменения зрения в первые недели после родов.",
    },
    mental_health: {
      title: "Трудно справляться",
      body: "Ощущение, что вы не справляетесь, чувство безнадёжности или мысли о том, чтобы причинить себе вред. Вы заслуживаете поддержки прямо сейчас — обратитесь к своему врачу или в экстренную службу.",
    },
    psychosis_signs: {
      title: "Спутанность, видения или голоса, или бессонница",
      body: "Если в первые недели после родов вы видите или слышите то, чего не замечают другие, чувствуете подозрительность или спутанность, у вас скачут мысли или вы не можете спать несколько дней — это требует срочной медицинской помощи сейчас. Эти симптомы поддаются лечению, и время имеет значение. Попросите кого-то из близких помочь вам получить помощь сегодня.",
    },
  },
};

const redFlagCopyDe: RedFlagCopy = {
  section: {
    title: "Wann Sie sich an Ihr Behandlungsteam wenden sollten",
    intro:
      "Das sind häufige Gründe, sich zeitnah zu melden — vertrauen Sie Ihrem Gefühl, auch wenn etwas nicht auf dieser Liste steht.",
    expandLabel: "Gründe anzeigen, sich an Ihr Behandlungsteam zu wenden",
    collapseLabel: "Gründe ausblenden, sich an Ihr Behandlungsteam zu wenden",
  },
  items: {
    heavy_bleeding: {
      title: "Starke Blutung",
      body: "Eine Binde durchnässt vollständig, mit oder ohne Schmerzen.",
    },
    preeclampsia_signs: {
      title: "Mögliche Anzeichen einer Präeklampsie",
      body: "Starke oder anhaltende Kopfschmerzen, Sehveränderungen oder plötzliche Schwellungen im Gesicht oder an den Händen — besonders nach der 20. Woche.",
    },
    severe_vomiting: {
      title: "Starkes Erbrechen",
      body: "Sie können seit einem Tag oder länger keine Flüssigkeit bei sich behalten.",
    },
    reduced_movements: {
      title: "Weniger Kindsbewegungen",
      body: "Eine deutliche Abnahme der gewohnten Bewegungen Ihres Babys.",
    },
    waters_early: {
      title: "Vorzeitiger Blasensprung",
      body: "Ein plötzlicher Schwall oder ein stetiges Auslaufen von Fruchtwasser vor der 37. Woche.",
    },
    fever: {
      title: "Fieber",
      body: "Fieber, das nicht zurückgeht.",
    },
    heavy_bleeding_pp: {
      title: "Starke Blutung",
      body: "Eine Binde durchnässt innerhalb einer Stunde, oder Sie verlieren große Blutklumpen.",
    },
    bleeding_returns: {
      title: "Wiederkehrende Blutung",
      body: "Bereits abgeklungene Blutung wird wieder hellrot.",
    },
    vte_signs: {
      title: "Mögliche Anzeichen eines Blutgerinnsels",
      body: "Schmerzen oder Schwellung in einem Bein, plötzliche Atemnot oder Brustschmerzen — melden Sie sich dringend.",
    },
    fever_pp: {
      title: "Fieber oder Schüttelfrost",
      body: "Fieber oder Schüttelfrost.",
    },
    breast_symptoms: {
      title: "Schmerzen, Rötung oder Wärme in der Brust mit Fieber",
      body: "Ein schmerzhafter, geröteter, warmer Bereich der Brust zusammen mit Fieber.",
    },
    preeclampsia_pp: {
      title: "Mögliche Anzeichen einer Präeklampsie",
      body: "Starke Kopfschmerzen oder Sehveränderungen in den ersten Wochen nach der Geburt.",
    },
    mental_health: {
      title: "Wenn es schwerfällt, zurechtzukommen",
      body: "Das Gefühl, nicht zurechtzukommen, Hoffnungslosigkeit oder Gedanken, sich selbst zu schaden. Sie verdienen jetzt Unterstützung — wenden Sie sich an Ihr Behandlungsteam oder den Notruf.",
    },
    psychosis_signs: {
      title: "Verwirrung, Sehen oder Hören von Dingen, oder kein Schlaf",
      body: "Dinge zu sehen oder zu hören, die andere nicht wahrnehmen, sich paranoid oder verwirrt zu fühlen, rasende Gedanken oder tagelang nicht schlafen zu können in den ersten Wochen nach der Geburt brauchen jetzt dringend ärztliche Hilfe — diese Symptome sind behandelbar und zeitkritisch. Bitten Sie eine nahestehende Person, Ihnen noch heute zu helfen, Hilfe zu bekommen.",
    },
  },
};

const redFlagCopyFr: RedFlagCopy = {
  section: {
    title: "Quand contacter votre équipe soignante",
    intro:
      "Voici des raisons courantes de contacter rapidement — faites confiance à votre instinct même si quelque chose ne figure pas dans cette liste.",
    expandLabel: "Afficher les raisons de contacter votre équipe soignante",
    collapseLabel: "Masquer les raisons de contacter votre équipe soignante",
  },
  items: {
    heavy_bleeding: {
      title: "Saignements abondants",
      body: "Une protection trempée entièrement, avec ou sans douleur.",
    },
    preeclampsia_signs: {
      title: "Signes possibles de prééclampsie",
      body: "Un mal de tête sévère ou persistant, des troubles de la vision, ou un gonflement soudain du visage ou des mains — surtout après la semaine 20.",
    },
    severe_vomiting: {
      title: "Vomissements sévères",
      body: "Incapacité à garder des liquides pendant un jour ou plus.",
    },
    reduced_movements: {
      title: "Diminution des mouvements",
      body: "Une nette diminution des mouvements habituels de votre bébé.",
    },
    waters_early: {
      title: "Perte des eaux précoce",
      body: "Un écoulement soudain ou continu de liquide avant la semaine 37.",
    },
    fever: {
      title: "Fièvre",
      body: "Une fièvre qui ne baisse pas.",
    },
    heavy_bleeding_pp: {
      title: "Saignements abondants",
      body: "Une protection trempée en une heure, ou des caillots volumineux.",
    },
    bleeding_returns: {
      title: "Retour des saignements",
      body: "Des saignements rouge vif qui reviennent après s'être calmés.",
    },
    vte_signs: {
      title: "Signes possibles d'un caillot sanguin",
      body: "Douleur ou gonflement d'une jambe, essoufflement soudain, ou douleur thoracique — contactez rapidement votre équipe soignante.",
    },
    fever_pp: {
      title: "Fièvre ou frissons",
      body: "Une fièvre ou des frissons.",
    },
    breast_symptoms: {
      title: "Douleur, rougeur ou chaleur au sein avec fièvre",
      body: "Une zone du sein douloureuse, rouge et chaude, accompagnée de fièvre.",
    },
    preeclampsia_pp: {
      title: "Signes possibles de prééclampsie",
      body: "Un mal de tête sévère ou des troubles de la vision dans les premières semaines après l'accouchement.",
    },
    mental_health: {
      title: "Avoir du mal à faire face",
      body: "Se sentir incapable de faire face, désespérée, ou avoir des pensées de vous faire du mal. Vous méritez du soutien dès maintenant — contactez votre équipe soignante ou les services d'urgence.",
    },
    psychosis_signs: {
      title: "Confusion, voir ou entendre des choses, ou ne pas dormir",
      body: "Voir ou entendre des choses que les autres ne perçoivent pas, se sentir paranoïaque ou confuse, avoir des pensées qui s'emballent, ou être incapable de dormir pendant des jours dans les premières semaines après la naissance nécessitent des soins médicaux urgents dès maintenant — ces symptômes se soignent et le temps compte. Demandez à un proche de vous aider à obtenir des soins aujourd'hui.",
    },
  },
};

const redFlagCopyEs: RedFlagCopy = {
  section: {
    title: "Cuándo contactar con tu equipo de salud",
    intro:
      "Estos son motivos frecuentes para contactar cuanto antes — confía en tu instinto aunque algo no esté en esta lista.",
    expandLabel: "Mostrar motivos para contactar con tu equipo de salud",
    collapseLabel: "Ocultar motivos para contactar con tu equipo de salud",
  },
  items: {
    heavy_bleeding: {
      title: "Sangrado abundante",
      body: "Empapar una compresa por completo, con o sin dolor.",
    },
    preeclampsia_signs: {
      title: "Posibles signos de preeclampsia",
      body: "Dolor de cabeza intenso o persistente, cambios en la visión, o hinchazón repentina de la cara o las manos, especialmente después de la semana 20.",
    },
    severe_vomiting: {
      title: "Vómitos intensos",
      body: "No poder retener líquidos durante un día o más.",
    },
    reduced_movements: {
      title: "Menos movimientos",
      body: "Una disminución clara en los movimientos habituales de tu bebé.",
    },
    waters_early: {
      title: "Rotura de aguas prematura",
      body: "Un chorro o una pérdida constante de líquido antes de la semana 37.",
    },
    fever: {
      title: "Fiebre",
      body: "Fiebre que no cede.",
    },
    heavy_bleeding_pp: {
      title: "Sangrado abundante",
      body: "Empapar una compresa en una hora, o expulsar coágulos grandes.",
    },
    bleeding_returns: {
      title: "El sangrado vuelve",
      body: "Sangrado rojo vivo que reaparece después de haber disminuido.",
    },
    vte_signs: {
      title: "Posibles signos de un coágulo",
      body: "Dolor o hinchazón en una pierna, dificultad repentina para respirar, o dolor en el pecho: contacta con urgencia.",
    },
    fever_pp: {
      title: "Fiebre o escalofríos",
      body: "Fiebre o escalofríos.",
    },
    breast_symptoms: {
      title: "Dolor, enrojecimiento o calor en el pecho con fiebre",
      body: "Una zona del pecho dolorida, enrojecida y caliente, junto con fiebre.",
    },
    preeclampsia_pp: {
      title: "Posibles signos de preeclampsia",
      body: "Dolor de cabeza intenso o cambios en la visión en las primeras semanas después del parto.",
    },
    mental_health: {
      title: "Sentir que cuesta afrontarlo",
      body: "Sentirte incapaz de afrontarlo, con desesperanza, o con pensamientos de hacerte daño. Mereces apoyo ahora mismo: contacta con tu equipo de salud o con los servicios de emergencia.",
    },
    psychosis_signs: {
      title: "Confusión, ver u oír cosas, o no dormir",
      body: "Ver u oír cosas que otros no perciben, sentirte paranoica o confusa, tener pensamientos acelerados, o no poder dormir durante días en las primeras semanas tras el parto necesitan atención médica urgente ahora — estos síntomas tienen tratamiento y el tiempo es importante. Pide a alguien cercano que te ayude a conseguir atención hoy.",
    },
  },
};

const redFlagCopyIt: RedFlagCopy = {
  section: {
    title: "Quando contattare il tuo team di cura",
    intro:
      "Questi sono motivi comuni per contattare tempestivamente — fidati del tuo istinto anche se qualcosa non è in questo elenco.",
    expandLabel: "Mostra i motivi per contattare il team di cura",
    collapseLabel: "Nascondi i motivi per contattare il team di cura",
  },
  items: {
    heavy_bleeding: {
      title: "Sanguinamento abbondante",
      body: "Un assorbente che si bagna completamente, con o senza dolore.",
    },
    preeclampsia_signs: {
      title: "Possibili segni di preeclampsia",
      body: "Mal di testa forte o persistente, cambiamenti della vista, o gonfiore improvviso del viso o delle mani, soprattutto dopo la settimana 20.",
    },
    severe_vomiting: {
      title: "Vomito intenso",
      body: "Impossibilità di trattenere liquidi per un giorno o più.",
    },
    reduced_movements: {
      title: "Movimenti ridotti",
      body: "Una chiara diminuzione dei movimenti abituali del tuo bambino.",
    },
    waters_early: {
      title: "Rottura precoce delle acque",
      body: "Una perdita improvvisa o continua di liquido prima della settimana 37.",
    },
    fever: {
      title: "Febbre",
      body: "Febbre che non si abbassa.",
    },
    heavy_bleeding_pp: {
      title: "Sanguinamento abbondante",
      body: "Un assorbente che si bagna entro un'ora, o grossi coaguli.",
    },
    bleeding_returns: {
      title: "Il sanguinamento ritorna",
      body: "Un sanguinamento rosso vivo che ritorna dopo essersi attenuato.",
    },
    vte_signs: {
      title: "Possibili segni di un coagulo di sangue",
      body: "Dolore o gonfiore a una gamba, difficoltà respiratoria improvvisa, o dolore al petto: contatta il tuo team di cura con urgenza.",
    },
    fever_pp: {
      title: "Febbre o brividi",
      body: "Febbre o brividi.",
    },
    breast_symptoms: {
      title: "Dolore, rossore o calore al seno con febbre",
      body: "Un'area del seno dolorante, arrossata e calda, insieme a febbre.",
    },
    preeclampsia_pp: {
      title: "Possibili segni di preeclampsia",
      body: "Mal di testa forte o cambiamenti della vista nelle prime settimane dopo il parto.",
    },
    mental_health: {
      title: "Fare fatica a farcela",
      body: "Sentirsi incapaci di farcela, senza speranza, o avere pensieri di farsi del male. Meriti sostegno adesso: contatta il tuo team di cura o i servizi di emergenza.",
    },
    psychosis_signs: {
      title: "Confusione, vedere o sentire cose, o non dormire",
      body: "Vedere o sentire cose che gli altri non percepiscono, sentirsi paranoica o confusa, avere pensieri accelerati, o non riuscire a dormire per giorni nelle prime settimane dopo il parto richiedono cure mediche urgenti adesso — questi sintomi sono curabili e il tempo conta. Chiedi a una persona vicina di aiutarti a ricevere assistenza oggi.",
    },
  },
};

const redFlagCopyCatalog: Record<InterfaceLanguage, RedFlagCopy> = {
  en: redFlagCopyEn,
  ru: redFlagCopyRu,
  es: redFlagCopyEs,
  de: redFlagCopyDe,
  fr: redFlagCopyFr,
  it: redFlagCopyIt,
};

export type { RedFlagCopy };

export function getRedFlagCopy(language: string | null | undefined) {
  return redFlagCopyCatalog[resolveCopyLanguage(language)];
}
