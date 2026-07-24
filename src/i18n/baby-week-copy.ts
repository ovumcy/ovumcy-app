import type { InterfaceLanguage } from "../models/profile";
import type { WidenLiteral } from "./catalog-types";
import { resolveCopyLanguage } from "./runtime";

// "Baby this week" copy: per-week fetal size + development education on
// the pregnancy dashboard. STRICT tone rules (SECURITY.md medical-safety
// invariant, mirroring pregnancy-copy.ts / red-flag-copy.ts): education only,
// generic and warm register -- "around this week, many babies...", "commonly
// described as..." framing; approximate sizes only (a conventional
// fruit/object comparison plus an approximate length and/or weight where
// customary, metric only); NEVER percentiles, growth-standard curves, or
// anything personalized against the owner's own logged data; no diagnoses; no
// exclamation marks.
//
// This card is about the BABY only -- organs, senses, movement, position,
// growth -- and deliberately does NOT restate the screening-window/checkpoint
// facts that already live in pregnancy-copy.ts's `milestones` catalog (NIPT,
// NT scan, anatomy scan, GDM screen, anti-D, Tdap, GBS, kick-counts-start,
// birth-prep) or any red-flag-copy.ts content (heavy bleeding, preeclampsia
// signs, severe vomiting, reduced movements, waters early, fever). A week's
// development line may share a broad time window with a milestone (e.g. week
// 28 = start of trimester III here AND the anti-D/kick-counts milestone
// window) without ever repeating that milestone's own fact.
//
// Size figures are deliberately approximate and rounded (never claimed as
// precise measurements) -- the well-known "banana at week 20" style jump in
// length around weeks 19-20 reflects the customary switch from an early
// crown-rump figure to a fuller head-to-heel figure once the fetus uncurls;
// this is the standard, widely recognized way this content is presented, not
// a data error.
//
// en + ru are primary, authored and tone-checked directly; de/fr/es/it are
// best-effort translations pending a native-speaker review before public
// launch -- same status as every other pregnancy-mode catalog.

export type BabyWeekNumber =
  | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19
  | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34
  | 35 | 36 | 37 | 38 | 39 | 40 | 41;

type BabyWeekEntry = { size: string; development: string };
type BabyWeekEntriesCopy = Record<BabyWeekNumber, BabyWeekEntry>;

const babyWeekCopyEn = {
  title: "Baby this week",
  multiplesNote:
    "With twins or more, sizes and timing vary — your scans tell the real story.",
  // Weeks 0-3 (before the per-week catalog starts at week 4): one shared
  // gentle entry using the SAME {size, development} shape as every other
  // week, rather than a dedicated one-line shape -- so the view-data builder
  // and the rendered card never special-case a different layout this early.

  veryEarly: {
    size: "This early, there is not yet a size to compare — many pregnancies are just being confirmed around now.",
    development:
      "The earliest days after conception are commonly when implantation and the first cell divisions take place, before many people know they are pregnant.",
  },
  weeks: {
    4: {
      size: "Commonly described as about the size of a poppy seed, roughly 2 mm.",
      development:
        "Implantation is commonly completing around now, and the very first structures that will become the brain and spinal cord are just beginning to form.",
    },
    5: {
      size: "Commonly described as about the size of a sesame seed, roughly 3 mm.",
      development:
        "The neural tube is commonly closing around this time, and the earliest version of the heart is starting to take shape.",
    },
    6: {
      size: "Around the size of a lentil, roughly 5 mm.",
      development:
        "Heartbeat activity is commonly detectable from around this week, and tiny buds that will become arms and legs are starting to appear.",
    },
    7: {
      size: "Commonly described as about the size of a blueberry, roughly 1 cm.",
      development:
        "The beginnings of hands and feet are commonly forming, and the face is starting to develop recognizable features.",
    },
    8: {
      size: "Around the size of a raspberry — roughly 1.6 cm and 1 gram.",
      development:
        "Fingers and toes are commonly forming, though still webbed, and all the major organs have begun developing.",
    },
    9: {
      size: "Commonly described as about the size of a grape — roughly 2.3 cm and 2 grams.",
      development:
        "The developing baby is commonly starting to look more distinctly human, with elbows and knees now visible.",
    },
    10: {
      size: "Around the size of a strawberry — roughly 3 cm and 4 grams.",
      development:
        "Vital organs are commonly mostly in place and continuing to mature, and tiny fingernails are commonly starting to form.",
    },
    11: {
      size: "Commonly described as about the size of a lime — roughly 4 cm and 7 grams.",
      development:
        "The baby can commonly be seen moving on an ultrasound around now, although these movements usually cannot be felt yet.",
    },
    12: {
      size: "Around the size of a plum — roughly 5.5 cm and 14 grams.",
      development:
        "Reflexes are commonly developing, and the digestive system is starting to practice the muscle movements it will use after birth.",
    },
    13: {
      size: "Commonly described as about the size of a peach — roughly 7 cm and 23 grams.",
      development:
        "The move from embryo to fetus is commonly complete by now, and the vocal cords are starting to form.",
    },
    14: {
      size: "Around the size of a lemon — roughly 8.5 cm and 43 grams.",
      development:
        "Facial muscles are commonly developed enough for expressions like squinting and frowning.",
    },
    15: {
      size: "Commonly described as about the size of an apple — roughly 10 cm and 70 grams.",
      development:
        "The skeleton is commonly hardening from soft cartilage into bone, and the sense of hearing is starting to develop.",
    },
    16: {
      size: "Around the size of an avocado — roughly 12 cm and 100 grams.",
      development:
        "The circulatory system is commonly functioning well, and the legs are noticeably more developed.",
    },
    17: {
      size: "Commonly described as about the size of an onion — roughly 13 cm and 140 grams.",
      development:
        "The umbilical cord is commonly thickening and strengthening, and the baby is starting to lay down a small amount of body fat.",
    },
    18: {
      size: "Around the size of a bell pepper — roughly 14 cm and 190 grams.",
      development:
        "The ears are commonly reaching their final position, and the baby may start responding to sounds from outside the body.",
    },
    19: {
      size: "Commonly described as about the size of a mango — roughly 15 cm and 240 grams.",
      development:
        "A protective waxy coating called vernix commonly begins covering the skin around now, and the senses of taste and smell continue developing.",
    },
    20: {
      size: "Around the size of a banana — roughly 25 cm and 300 grams.",
      development:
        "Many people begin feeling movements — often described as fluttering — for the first time from around now, though timing varies quite a bit from one pregnancy to another.",
    },
    21: {
      size: "Commonly described as about the size of a grapefruit — roughly 26.5 cm and 360 grams.",
      development:
        "Movements are commonly becoming easier to notice as muscles strengthen, and the digestive system continues maturing.",
    },
    22: {
      size: "Around the size of a carrot — roughly 28 cm and 430 grams.",
      development:
        "The senses continue sharpening, and eyebrows and eyelids are commonly fully formed.",
    },
    23: {
      size: "Commonly described as about the size of an ear of corn — roughly 29 cm and 500 grams.",
      development:
        "Blood vessels in the lungs are commonly developing to prepare for breathing after birth, and hearing continues to mature.",
    },
    24: {
      size: "Around the size of a cantaloupe — roughly 30 cm and 600 grams.",
      development:
        "The lungs continue developing their branching airway structure, and the skin is commonly becoming a little less translucent.",
    },
    25: {
      size: "Commonly described as about the size of a cauliflower — roughly 34 cm and 660 grams.",
      development:
        "The baby commonly responds to familiar sounds and touch, and the nervous system continues maturing.",
    },
    26: {
      size: "Around the size of a papaya — roughly 35 cm and 760 grams.",
      development:
        "The eyes commonly begin to open around this time, and the lungs are starting to produce surfactant, a substance that helps them expand after birth.",
    },
    27: {
      size: "Commonly described as about the size of a cabbage — roughly 36.5 cm and 875 grams.",
      development:
        "The baby commonly opens and closes the eyes, and sleep-wake cycles are becoming more noticeable.",
    },
    28: {
      size: "Around the size of an eggplant — roughly 37.5 cm and about 1 kg.",
      development:
        "This is commonly considered the start of the third trimester, and the brain's surface is starting to develop its characteristic folds.",
    },
    29: {
      size: "Commonly described as about the size of a coconut — roughly 38.5 cm and about 1.15 kg.",
      development:
        "Muscles and lungs continue maturing, and the baby is commonly gaining weight steadily from around now.",
    },
    30: {
      size: "Around the size of a butternut squash — roughly 40 cm and about 1.3 kg.",
      development:
        "The baby can commonly open and close the eyes at will, and white blood cells are starting to develop for immune protection.",
    },
    31: {
      size: "Commonly described as about the size of a small pineapple — roughly 41 cm and about 1.5 kg.",
      development:
        "The baby commonly practices breathing motions using amniotic fluid, and reflexes continue sharpening.",
    },
    32: {
      size: "Around the size of a napa cabbage — roughly 42 cm and about 1.7 kg.",
      development:
        "Toenails are commonly fully formed, and the baby is often beginning to settle into a head-down or other position ahead of birth, though this can still change.",
    },
    33: {
      size: "Commonly described as about the size of a pineapple — roughly 44 cm and about 1.9 kg.",
      development:
        "The bones continue hardening, except for the skull, which commonly stays soft and flexible to help ease the passage through the birth canal.",
    },
    34: {
      size: "Around the size of a large melon — roughly 45 cm and about 2.1 kg.",
      development:
        "The central nervous system and lungs continue maturing, and a protective layer of fat is commonly building up steadily under the skin.",
    },
    35: {
      size: "Commonly described as about the size of a mini watermelon — roughly 46 cm and about 2.4 kg.",
      development:
        "There is commonly less room to move as space becomes tighter, though regular movement patterns are still commonly felt.",
    },
    36: {
      size: "Around the size of a honeydew melon — roughly 47 cm and about 2.6 kg.",
      development:
        "The baby is commonly considered early term soon, and the protective vernix coating commonly begins to thin.",
    },
    37: {
      size: "Commonly described as about the size of a head of romaine lettuce — roughly 48.5 cm and about 2.9 kg.",
      development:
        "This is commonly considered full term from here, and skills like sucking and swallowing continue being fine-tuned.",
    },
    38: {
      size: "Around the size of a small watermelon — roughly 50 cm and about 3.1 kg.",
      development:
        "The lungs and brain continue their final maturing, and the baby commonly continues settling into position for birth.",
    },
    39: {
      size: "Commonly described as about the size of a large cabbage — roughly 50.5 cm and about 3.3 kg.",
      development:
        "The baby is commonly considered fully developed by now, with organs ready to work on their own after birth.",
    },
    40: {
      size: "Around the size of a small pumpkin — roughly 51 cm and about 3.5 kg.",
      development:
        "This is the estimated due date, though many babies arrive before or after it, and final touches like fat layers and reflexes continue rounding out.",
    },
    41: {
      size: "About the same as last week, a small pumpkin — roughly 51.5 cm and about 3.6 kg.",
      development:
        "Development is commonly complete by now, with growth continuing at a slower, steadier pace than earlier in the third trimester.",
    },
  } satisfies BabyWeekEntriesCopy,
} as const;

type BabyWeekCopy = WidenLiteral<typeof babyWeekCopyEn>;

const babyWeekCopyRu: BabyWeekCopy = {
  title: "Малыш на этой неделе",
  multiplesNote:
    "При двойне или большем числе малышей размеры и сроки могут отличаться — точную картину покажут ваши УЗИ.",
  veryEarly: {
    size: "На этом сроке сравнивать пока не с чем — многие беременности как раз сейчас подтверждаются.",
    development:
      "В первые дни после зачатия обычно происходит имплантация и первые деления клеток, ещё до того, как многие узнают о беременности.",
  },
  weeks: {
    4: {
      size: "Обычно сравнивают с маковым зёрнышком — примерно 2 мм.",
      development:
        "Имплантация обычно завершается примерно в это время, и только начинают формироваться самые первые структуры будущих головного и спинного мозга.",
    },
    5: {
      size: "Обычно сравнивают с кунжутным зёрнышком — примерно 3 мм.",
      development:
        "Примерно сейчас обычно закрывается нервная трубка, и начинает формироваться самая ранняя версия сердца.",
    },
    6: {
      size: "Примерно с чечевицей — около 5 мм.",
      development:
        "Сердечная активность обычно уже определяется начиная примерно с этой недели, а на месте будущих рук и ног появляются крошечные зачатки.",
    },
    7: {
      size: "Обычно сравнивают с черникой — примерно 1 см.",
      development:
        "Обычно формируются зачатки кистей и стоп, а личико начинает приобретать узнаваемые черты.",
    },
    8: {
      size: "Примерно с малиной — около 1,6 см и 1 грамма.",
      development:
        "Пальцы на руках и ногах обычно формируются, хотя пока соединены перепонками, и уже заложены все основные органы.",
    },
    9: {
      size: "Обычно сравнивают с виноградиной — примерно 2,3 см и 2 грамма.",
      development:
        "Малыш обычно начинает выглядеть более узнаваемо, с уже различимыми локтями и коленями.",
    },
    10: {
      size: "Примерно с клубникой — около 3 см и 4 граммов.",
      development:
        "Жизненно важные органы обычно в основном уже сформированы и продолжают развиваться, начинают формироваться крошечные ноготки.",
    },
    11: {
      size: "Обычно сравнивают с лаймом — примерно 4 см и 7 граммов.",
      development:
        "Примерно с этого срока малыша иногда уже видно двигающимся на УЗИ, хотя сами движения пока обычно не ощущаются.",
    },
    12: {
      size: "Примерно со сливой — около 5,5 см и 14 граммов.",
      development:
        "Развиваются рефлексы, а пищеварительная система начинает «тренировать» движения мышц, которые понадобятся после рождения.",
    },
    13: {
      size: "Обычно сравнивают с персиком — примерно 7 см и 23 грамма.",
      development:
        "Переход от эмбриона к плоду обычно завершён, и начинают формироваться голосовые связки.",
    },
    14: {
      size: "Примерно с лимоном — около 8,5 см и 43 грамма.",
      development:
        "Мышцы лица обычно уже достаточно развиты для мимики — например, малыш может щуриться или хмуриться.",
    },
    15: {
      size: "Обычно сравнивают с яблоком — примерно 10 см и 70 граммов.",
      development:
        "Скелет постепенно твердеет, превращаясь из хряща в кость, и начинает развиваться слух.",
    },
    16: {
      size: "Примерно с авокадо — около 12 см и 100 граммов.",
      development:
        "Кровеносная система обычно уже неплохо работает, а ножки заметно более развиты.",
    },
    17: {
      size: "Обычно сравнивают с луковицей — примерно 13 см и 140 граммов.",
      development:
        "Пуповина обычно утолщается и укрепляется, и малыш начинает откладывать небольшое количество жировой ткани.",
    },
    18: {
      size: "Примерно с болгарским перцем — около 14 см и 190 граммов.",
      development:
        "Ушки обычно занимают своё окончательное положение, и малыш может начать реагировать на звуки снаружи.",
    },
    19: {
      size: "Обычно сравнивают с манго — примерно 15 см и 240 граммов.",
      development:
        "Примерно в это время кожу обычно начинает покрывать защитная смазка — верникс, а вкус и обоняние продолжают развиваться.",
    },
    20: {
      size: "Примерно с бананом — около 25 см и 300 граммов.",
      development:
        "Многие впервые начинают ощущать шевеления — часто их описывают как лёгкое трепетание — примерно с этого срока, хотя сроки сильно различаются от беременности к беременности.",
    },
    21: {
      size: "Обычно сравнивают с грейпфрутом — примерно 26,5 см и 360 граммов.",
      development:
        "Шевеления обычно становится легче замечать по мере укрепления мышц, а пищеварительная система продолжает созревать.",
    },
    22: {
      size: "Примерно с морковью — около 28 см и 430 граммов.",
      development:
        "Органы чувств продолжают развиваться тоньше, а брови и веки уже обычно полностью сформированы.",
    },
    23: {
      size: "Обычно сравнивают с початком кукурузы — примерно 29 см и 500 граммов.",
      development:
        "В лёгких обычно развиваются кровеносные сосуды, готовя их к дыханию после рождения, а слух продолжает созревать.",
    },
    24: {
      size: "Примерно с небольшой дыней — около 30 см и 600 граммов.",
      development:
        "Лёгкие продолжают формировать разветвлённую структуру дыхательных путей, а кожа обычно становится чуть менее прозрачной.",
    },
    25: {
      size: "Обычно сравнивают с цветной капустой — примерно 34 см и 660 граммов.",
      development:
        "Малыш обычно реагирует на знакомые звуки и прикосновения, а нервная система продолжает созревать.",
    },
    26: {
      size: "Примерно с папайей — около 35 см и 760 граммов.",
      development:
        "Примерно в это время обычно начинают открываться глазки, а в лёгких начинает вырабатываться сурфактант — вещество, которое помогает им расправляться после рождения.",
    },
    27: {
      size: "Обычно сравнивают с кочаном капусты — примерно 36,5 см и 875 граммов.",
      development:
        "Малыш обычно открывает и закрывает глазки, а циклы сна и бодрствования становятся более заметными.",
    },
    28: {
      size: "Примерно с баклажаном — около 37,5 см и около 1 кг.",
      development:
        "Это обычно считается началом третьего триместра, и на поверхности мозга начинают появляться характерные извилины.",
    },
    29: {
      size: "Обычно сравнивают с кокосом — примерно 38,5 см и около 1,15 кг.",
      development:
        "Мышцы и лёгкие продолжают созревать, и примерно с этого срока малыш обычно стабильно набирает вес.",
    },
    30: {
      size: "Примерно с мускатной тыквой — около 40 см и около 1,3 кг.",
      development:
        "Малыш обычно уже может открывать и закрывать глаза по своему «желанию», а для иммунной защиты начинают развиваться белые кровяные тельца.",
    },
    31: {
      size: "Обычно сравнивают с небольшим ананасом — примерно 41 см и около 1,5 кг.",
      development:
        "Малыш обычно тренирует дыхательные движения с помощью околоплодных вод, а рефлексы продолжают становиться увереннее.",
    },
    32: {
      size: "Примерно с пекинской капустой — около 42 см и около 1,7 кг.",
      development:
        "Ноготки на ногах обычно уже полностью сформированы, и малыш нередко начинает занимать головное или другое положение перед родами, хотя оно ещё может измениться.",
    },
    33: {
      size: "Обычно сравнивают с ананасом — примерно 44 см и около 1,9 кг.",
      development:
        "Кости продолжают твердеть, кроме костей черепа, которые обычно остаются мягкими и подвижными — это помогает при прохождении по родовым путям.",
    },
    34: {
      size: "Примерно с крупной дыней — около 45 см и около 2,1 кг.",
      development:
        "Центральная нервная система и лёгкие продолжают созревать, а под кожей обычно постепенно накапливается защитный слой жира.",
    },
    35: {
      size: "Обычно сравнивают с миниатюрным арбузом — примерно 46 см и около 2,4 кг.",
      development:
        "Свободного места для движений обычно становится меньше, хотя привычные шевеления, как правило, по-прежнему хорошо ощущаются.",
    },
    36: {
      size: "Примерно с медовой дыней — около 47 см и около 2,6 кг.",
      development:
        "Малыша уже скоро можно будет считать доношенным «ранним сроком», а защитная смазка-верникс обычно начинает истончаться.",
    },
    37: {
      size: "Обычно сравнивают с кочаном салата ромен — примерно 48,5 см и около 2,9 кг.",
      development:
        "С этого срока беременность обычно считается доношенной, и такие навыки, как сосание и глотание, продолжают «оттачиваться».",
    },
    38: {
      size: "Примерно с небольшим арбузом — около 50 см и около 3,1 кг.",
      development:
        "Лёгкие и мозг проходят финальные этапы созревания, а малыш обычно продолжает занимать положение перед родами.",
    },
    39: {
      size: "Обычно сравнивают с крупным кочаном капусты — примерно 50,5 см и около 3,3 кг.",
      development:
        "К этому сроку малыша обычно можно считать полностью сформировавшимся, а органы — готовыми работать самостоятельно после рождения.",
    },
    40: {
      size: "Примерно с небольшой тыквой — около 51 см и около 3,5 кг.",
      development:
        "Это предполагаемая дата родов, хотя многие малыши появляются на свет раньше или позже неё, а последние штрихи вроде жировой прослойки и рефлексов продолжают «дорабатываться».",
    },
    41: {
      size: "Похоже на прошлую неделю — всё та же небольшая тыква, примерно 51,5 см и около 3,6 кг.",
      development:
        "К этому сроку развитие обычно уже завершено, и рост продолжается более медленно и равномерно, чем раньше в третьем триместре.",
    },
  },
};

const babyWeekCopyDe: BabyWeekCopy = {
  title: "Das Baby diese Woche",
  multiplesNote:
    "Bei Zwillingen oder mehr variieren Größe und Zeitpunkt — Ihre Ultraschalluntersuchungen zeigen den genauen Verlauf.",
  veryEarly: {
    size: "So früh gibt es noch keine Größe zum Vergleichen — viele Schwangerschaften werden gerade erst jetzt bestätigt.",
    development:
      "In den ersten Tagen nach der Befruchtung finden üblicherweise die Einnistung und die ersten Zellteilungen statt, noch bevor viele von der Schwangerschaft wissen.",
  },
  weeks: {
    4: {
      size: "Meist beschrieben als etwa so groß wie ein Mohnsamen — ungefähr 2 mm.",
      development:
        "Die Einnistung ist um diese Zeit meist abgeschlossen, und die ersten Strukturen von Gehirn und Rückenmark beginnen sich gerade erst zu bilden.",
    },
    5: {
      size: "Etwa so groß wie ein Sesamkorn — ungefähr 3 mm.",
      development:
        "Das Neuralrohr schließt sich üblicherweise um diese Zeit, und die früheste Form des Herzens beginnt sich zu bilden.",
    },
    6: {
      size: "Etwa so groß wie eine Linse — ungefähr 5 mm.",
      development:
        "Ab etwa dieser Woche ist häufig schon eine Herzaktivität feststellbar, und winzige Knospen für Arme und Beine erscheinen.",
    },
    7: {
      size: "Meist beschrieben als etwa so groß wie eine Heidelbeere — ungefähr 1 cm.",
      development:
        "Die Anlagen von Händen und Füßen bilden sich meist aus, und das Gesicht beginnt, erkennbare Züge zu entwickeln.",
    },
    8: {
      size: "Etwa so groß wie eine Himbeere — ungefähr 1,6 cm und 1 Gramm.",
      development:
        "Finger und Zehen bilden sich meist aus, sind aber noch von Haut verbunden, und alle wichtigen Organe haben sich bereits angelegt.",
    },
    9: {
      size: "Meist beschrieben als etwa so groß wie eine Weintraube — ungefähr 2,3 cm und 2 Gramm.",
      development:
        "Das Baby beginnt meist, deutlich menschlicher auszusehen, mit inzwischen erkennbaren Ellbogen und Knien.",
    },
    10: {
      size: "Etwa so groß wie eine Erdbeere — ungefähr 3 cm und 4 Gramm.",
      development:
        "Die lebenswichtigen Organe sind meist größtenteils angelegt und entwickeln sich weiter, winzige Fingernägel beginnen sich zu bilden.",
    },
    11: {
      size: "Meist beschrieben als etwa so groß wie eine Limette — ungefähr 4 cm und 7 Gramm.",
      development:
        "Ab etwa jetzt lässt sich das Baby im Ultraschall häufig schon in Bewegung sehen, auch wenn diese Bewegungen meist noch nicht spürbar sind.",
    },
    12: {
      size: "Etwa so groß wie eine Pflaume — ungefähr 5,5 cm und 14 Gramm.",
      development:
        "Reflexe entwickeln sich, und der Verdauungstrakt beginnt, die Muskelbewegungen zu üben, die nach der Geburt gebraucht werden.",
    },
    13: {
      size: "Meist beschrieben als etwa so groß wie ein Pfirsich — ungefähr 7 cm und 23 Gramm.",
      development:
        "Der Übergang vom Embryo zum Fötus ist meist abgeschlossen, und die Stimmbänder beginnen sich zu bilden.",
    },
    14: {
      size: "Etwa so groß wie eine Zitrone — ungefähr 8,5 cm und 43 Gramm.",
      development:
        "Die Gesichtsmuskeln sind meist so weit entwickelt, dass Mimik wie Blinzeln oder Stirnrunzeln möglich ist.",
    },
    15: {
      size: "Meist beschrieben als etwa so groß wie ein Apfel — ungefähr 10 cm und 70 Gramm.",
      development:
        "Das Skelett verhärtet sich nach und nach von Knorpel zu Knochen, und der Hörsinn beginnt sich zu entwickeln.",
    },
    16: {
      size: "Etwa so groß wie eine Avocado — ungefähr 12 cm und 100 Gramm.",
      development:
        "Der Kreislauf funktioniert meist schon recht gut, und die Beine sind deutlich weiter entwickelt.",
    },
    17: {
      size: "Meist beschrieben als etwa so groß wie eine Zwiebel — ungefähr 13 cm und 140 Gramm.",
      development:
        "Die Nabelschnur wird meist dicker und stabiler, und das Baby beginnt, etwas Körperfett anzulegen.",
    },
    18: {
      size: "Etwa so groß wie eine Paprika — ungefähr 14 cm und 190 Gramm.",
      development:
        "Die Ohren erreichen meist ihre endgültige Position, und das Baby reagiert möglicherweise erstmals auf Geräusche von außen.",
    },
    19: {
      size: "Meist beschrieben als etwa so groß wie eine Mango — ungefähr 15 cm und 240 Gramm.",
      development:
        "Um diese Zeit bildet sich auf der Haut meist eine schützende, wachsartige Schicht namens Vernix, und Geschmacks- und Geruchssinn entwickeln sich weiter.",
    },
    20: {
      size: "Etwa so groß wie eine Banane — ungefähr 25 cm und 300 Gramm.",
      development:
        "Viele spüren ab etwa jetzt zum ersten Mal Bewegungen — oft als leichtes Flattern beschrieben —, wobei der Zeitpunkt von Schwangerschaft zu Schwangerschaft sehr unterschiedlich ist.",
    },
    21: {
      size: "Meist beschrieben als etwa so groß wie eine Grapefruit — ungefähr 26,5 cm und 360 Gramm.",
      development:
        "Bewegungen werden meist leichter spürbar, da die Muskeln kräftiger werden, und der Verdauungstrakt reift weiter.",
    },
    22: {
      size: "Etwa so groß wie eine Karotte — ungefähr 28 cm und 430 Gramm.",
      development:
        "Die Sinne werden weiter feiner, und Augenbrauen sowie Augenlider sind meist vollständig ausgebildet.",
    },
    23: {
      size: "Meist beschrieben als etwa so groß wie ein Maiskolben — ungefähr 29 cm und 500 Gramm.",
      development:
        "In der Lunge bilden sich meist Blutgefäße, die sie auf die Atmung nach der Geburt vorbereiten, und das Gehör reift weiter.",
    },
    24: {
      size: "Etwa so groß wie eine Cantaloupe-Melone — ungefähr 30 cm und 600 Gramm.",
      development:
        "Die Lunge entwickelt weiter ihre verzweigte Struktur der Atemwege, und die Haut wird meist etwas weniger durchscheinend.",
    },
    25: {
      size: "Meist beschrieben als etwa so groß wie ein Blumenkohl — ungefähr 34 cm und 660 Gramm.",
      development:
        "Das Baby reagiert meist auf vertraute Geräusche und Berührungen, und das Nervensystem reift weiter.",
    },
    26: {
      size: "Etwa so groß wie eine Papaya — ungefähr 35 cm und 760 Gramm.",
      development:
        "Die Augen beginnen sich um diese Zeit meist zu öffnen, und die Lunge beginnt, Surfactant zu bilden — eine Substanz, die ihr nach der Geburt beim Entfalten hilft.",
    },
    27: {
      size: "Meist beschrieben als etwa so groß wie ein Kohlkopf — ungefähr 36,5 cm und 875 Gramm.",
      development:
        "Das Baby öffnet und schließt meist die Augen, und Schlaf-Wach-Rhythmen werden deutlicher erkennbar.",
    },
    28: {
      size: "Etwa so groß wie eine Aubergine — ungefähr 37,5 cm und etwa 1 kg.",
      development:
        "Dies gilt meist als Beginn des dritten Trimesters, und die Hirnoberfläche beginnt, ihre charakteristischen Furchen auszubilden.",
    },
    29: {
      size: "Meist beschrieben als etwa so groß wie eine Kokosnuss — ungefähr 38,5 cm und etwa 1,15 kg.",
      development:
        "Muskeln und Lunge reifen weiter, und das Baby nimmt ab etwa jetzt meist stetig an Gewicht zu.",
    },
    30: {
      size: "Etwa so groß wie ein Butternusskürbis — ungefähr 40 cm und etwa 1,3 kg.",
      development:
        "Das Baby kann die Augen meist willentlich öffnen und schließen, und weiße Blutkörperchen beginnen sich für die Immunabwehr zu entwickeln.",
    },
    31: {
      size: "Meist beschrieben als etwa so groß wie eine kleine Ananas — ungefähr 41 cm und etwa 1,5 kg.",
      development:
        "Das Baby übt meist Atembewegungen mithilfe des Fruchtwassers, und die Reflexe werden weiter sicherer.",
    },
    32: {
      size: "Etwa so groß wie ein Chinakohl — ungefähr 42 cm und etwa 1,7 kg.",
      development:
        "Die Fußnägel sind meist vollständig ausgebildet, und das Baby beginnt häufig, sich vor der Geburt in eine Kopf-unten- oder andere Lage einzupendeln, auch wenn sich das noch ändern kann.",
    },
    33: {
      size: "Meist beschrieben als etwa so groß wie eine Ananas — ungefähr 44 cm und etwa 1,9 kg.",
      development:
        "Die Knochen härten weiter aus, außer denen des Schädels, die meist weich und beweglich bleiben, um den Weg durch den Geburtskanal zu erleichtern.",
    },
    34: {
      size: "Etwa so groß wie eine große Melone — ungefähr 45 cm und etwa 2,1 kg.",
      development:
        "Zentralnervensystem und Lunge reifen weiter, und unter der Haut baut sich meist stetig eine schützende Fettschicht auf.",
    },
    35: {
      size: "Meist beschrieben als etwa so groß wie eine Mini-Wassermelone — ungefähr 46 cm und etwa 2,4 kg.",
      development:
        "Der Platz zum Bewegen wird meist enger, auch wenn die gewohnten Bewegungsmuster in der Regel weiterhin regelmäßig spürbar sind.",
    },
    36: {
      size: "Etwa so groß wie eine Honigmelone — ungefähr 47 cm und etwa 2,6 kg.",
      development:
        "Das Baby gilt bald meist als „früh reif“, und die schützende Vernix-Schicht beginnt meist dünner zu werden.",
    },
    37: {
      size: "Meist beschrieben als etwa so groß wie ein Kopf Römersalat — ungefähr 48,5 cm und etwa 2,9 kg.",
      development:
        "Ab hier gilt die Schwangerschaft meist als termingerecht, und Fähigkeiten wie Saugen und Schlucken werden weiter verfeinert.",
    },
    38: {
      size: "Etwa so groß wie eine kleine Wassermelone — ungefähr 50 cm und etwa 3,1 kg.",
      development:
        "Lunge und Gehirn durchlaufen ihre letzten Reifungsschritte, und das Baby pendelt sich meist weiter in seine Geburtsposition ein.",
    },
    39: {
      size: "Meist beschrieben als etwa so groß wie ein großer Kohlkopf — ungefähr 50,5 cm und etwa 3,3 kg.",
      development:
        "Das Baby gilt zu diesem Zeitpunkt meist als vollständig entwickelt, mit Organen, die bereit sind, nach der Geburt eigenständig zu arbeiten.",
    },
    40: {
      size: "Etwa so groß wie ein kleiner Kürbis — ungefähr 51 cm und etwa 3,5 kg.",
      development:
        "Dies ist der errechnete Termin, auch wenn viele Babys davor oder danach zur Welt kommen, und letzte Details wie Fettpolster und Reflexe werden weiter abgerundet.",
    },
    41: {
      size: "Ähnlich wie letzte Woche — weiterhin etwa kürbisgroß, ungefähr 51,5 cm und etwa 3,6 kg.",
      development:
        "Die Entwicklung ist meist inzwischen abgeschlossen, und das Wachstum setzt sich langsamer und gleichmäßiger fort als zuvor im dritten Trimester.",
    },
  },
};

const babyWeekCopyFr: BabyWeekCopy = {
  title: "Bébé cette semaine",
  multiplesNote:
    "En cas de jumeaux ou plus, les tailles et les délais varient — vos échographies donneront la vraie mesure.",
  veryEarly: {
    size: "À ce stade, il n'y a pas encore de taille à comparer — de nombreuses grossesses sont tout juste confirmées à ce moment.",
    development:
      "Les tout premiers jours après la conception sont couramment ceux de l'implantation et des toutes premières divisions cellulaires, avant que beaucoup de personnes sachent qu'elles sont enceintes.",
  },
  weeks: {
    4: {
      size: "Souvent décrit comme la taille d'une graine de pavot — environ 2 mm.",
      development:
        "L'implantation est généralement terminée vers ce moment, et les toutes premières structures du futur cerveau et de la moelle épinière commencent tout juste à se former.",
    },
    5: {
      size: "Environ la taille d'une graine de sésame — environ 3 mm.",
      development:
        "Le tube neural se referme couramment vers cette période, et la toute première forme du cœur commence à se dessiner.",
    },
    6: {
      size: "Environ la taille d'une lentille — environ 5 mm.",
      development:
        "Une activité cardiaque est couramment détectable à partir d'environ cette semaine, et de minuscules bourgeons qui deviendront les bras et les jambes apparaissent.",
    },
    7: {
      size: "Souvent décrit comme la taille d'une myrtille — environ 1 cm.",
      development:
        "Les ébauches des mains et des pieds se forment couramment, et le visage commence à développer des traits reconnaissables.",
    },
    8: {
      size: "Environ la taille d'une framboise — environ 1,6 cm et 1 gramme.",
      development:
        "Les doigts et les orteils se forment couramment, encore reliés par une fine membrane, et tous les organes principaux ont déjà commencé à se développer.",
    },
    9: {
      size: "Souvent décrit comme la taille d'un grain de raisin — environ 2,3 cm et 2 grammes.",
      development:
        "Le bébé commence couramment à avoir une allure plus nettement humaine, avec des coudes et des genoux désormais visibles.",
    },
    10: {
      size: "Environ la taille d'une fraise — environ 3 cm et 4 grammes.",
      development:
        "Les organes vitaux sont couramment en grande partie en place et continuent à se développer, et de minuscules ongles commencent à apparaître.",
    },
    11: {
      size: "Souvent décrit comme la taille d'un citron vert — environ 4 cm et 7 grammes.",
      development:
        "À partir d'environ maintenant, le bébé peut couramment être vu en train de bouger à l'échographie, même si ces mouvements ne sont généralement pas encore ressentis.",
    },
    12: {
      size: "Environ la taille d'une prune — environ 5,5 cm et 14 grammes.",
      development:
        "Les réflexes se développent, et le système digestif commence à s'entraîner aux mouvements musculaires qu'il utilisera après la naissance.",
    },
    13: {
      size: "Souvent décrit comme la taille d'une pêche — environ 7 cm et 23 grammes.",
      development:
        "Le passage d'embryon à fœtus est couramment terminé, et les cordes vocales commencent à se former.",
    },
    14: {
      size: "Environ la taille d'un citron — environ 8,5 cm et 43 grammes.",
      development:
        "Les muscles du visage sont couramment assez développés pour des expressions comme plisser les yeux ou froncer les sourcils.",
    },
    15: {
      size: "Souvent décrit comme la taille d'une pomme — environ 10 cm et 70 grammes.",
      development:
        "Le squelette durcit peu à peu, passant du cartilage souple à l'os, et le sens de l'ouïe commence à se développer.",
    },
    16: {
      size: "Environ la taille d'un avocat — environ 12 cm et 100 grammes.",
      development:
        "Le système circulatoire fonctionne couramment déjà bien, et les jambes sont nettement plus développées.",
    },
    17: {
      size: "Souvent décrit comme la taille d'un oignon — environ 13 cm et 140 grammes.",
      development:
        "Le cordon ombilical s'épaissit et se renforce couramment, et le bébé commence à accumuler un peu de graisse corporelle.",
    },
    18: {
      size: "Environ la taille d'un poivron — environ 14 cm et 190 grammes.",
      development:
        "Les oreilles atteignent couramment leur position définitive, et le bébé peut commencer à réagir aux sons venant de l'extérieur.",
    },
    19: {
      size: "Souvent décrit comme la taille d'une mangue — environ 15 cm et 240 grammes.",
      development:
        "Vers cette période, un enduit protecteur cireux appelé vernix commence couramment à recouvrir la peau, et les sens du goût et de l'odorat continuent de se développer.",
    },
    20: {
      size: "Environ la taille d'une banane — environ 25 cm et 300 grammes.",
      development:
        "Beaucoup de personnes ressentent pour la première fois des mouvements — souvent décrits comme un léger battement — à partir d'environ maintenant, bien que le moment varie beaucoup d'une grossesse à l'autre.",
    },
    21: {
      size: "Souvent décrit comme la taille d'un pamplemousse — environ 26,5 cm et 360 grammes.",
      development:
        "Les mouvements deviennent couramment plus faciles à remarquer à mesure que les muscles se renforcent, et le système digestif continue de mûrir.",
    },
    22: {
      size: "Environ la taille d'une carotte — environ 28 cm et 430 grammes.",
      development:
        "Les sens continuent de s'affiner, et les sourcils ainsi que les paupières sont couramment entièrement formés.",
    },
    23: {
      size: "Souvent décrit comme la taille d'un épi de maïs — environ 29 cm et 500 grammes.",
      development:
        "Les vaisseaux sanguins des poumons se développent couramment pour préparer la respiration après la naissance, et l'ouïe continue de mûrir.",
    },
    24: {
      size: "Environ la taille d'un melon cantaloup — environ 30 cm et 600 grammes.",
      development:
        "Les poumons continuent de développer leur structure ramifiée de voies respiratoires, et la peau devient couramment un peu moins transparente.",
    },
    25: {
      size: "Souvent décrit comme la taille d'un chou-fleur — environ 34 cm et 660 grammes.",
      development:
        "Le bébé réagit couramment aux sons familiers et au toucher, et le système nerveux continue de mûrir.",
    },
    26: {
      size: "Environ la taille d'une papaye — environ 35 cm et 760 grammes.",
      development:
        "Les yeux commencent couramment à s'ouvrir vers cette période, et les poumons commencent à produire du surfactant, une substance qui les aide à se déployer après la naissance.",
    },
    27: {
      size: "Souvent décrit comme la taille d'un chou — environ 36,5 cm et 875 grammes.",
      development:
        "Le bébé ouvre et ferme couramment les yeux, et les cycles de sommeil et d'éveil deviennent plus perceptibles.",
    },
    28: {
      size: "Environ la taille d'une aubergine — environ 37,5 cm et environ 1 kg.",
      development:
        "C'est couramment considéré comme le début du troisième trimestre, et la surface du cerveau commence à développer ses plis caractéristiques.",
    },
    29: {
      size: "Souvent décrit comme la taille d'une noix de coco — environ 38,5 cm et environ 1,15 kg.",
      development:
        "Les muscles et les poumons continuent de mûrir, et le bébé prend couramment du poids de façon régulière à partir d'environ maintenant.",
    },
    30: {
      size: "Environ la taille d'une courge butternut — environ 40 cm et environ 1,3 kg.",
      development:
        "Le bébé peut couramment ouvrir et fermer les yeux à volonté, et des globules blancs commencent à se développer pour la protection immunitaire.",
    },
    31: {
      size: "Souvent décrit comme la taille d'un petit ananas — environ 41 cm et environ 1,5 kg.",
      development:
        "Le bébé s'entraîne couramment à respirer à l'aide du liquide amniotique, et les réflexes continuent de s'affiner.",
    },
    32: {
      size: "Environ la taille d'un chou chinois — environ 42 cm et environ 1,7 kg.",
      development:
        "Les ongles des orteils sont couramment entièrement formés, et le bébé commence souvent à s'installer en position tête en bas ou autre avant la naissance, bien que cela puisse encore changer.",
    },
    33: {
      size: "Souvent décrit comme la taille d'un ananas — environ 44 cm et environ 1,9 kg.",
      development:
        "Les os continuent de durcir, sauf ceux du crâne, qui restent couramment souples pour faciliter le passage dans le bassin lors de la naissance.",
    },
    34: {
      size: "Environ la taille d'un gros melon — environ 45 cm et environ 2,1 kg.",
      development:
        "Le système nerveux central et les poumons continuent de mûrir, et une couche protectrice de graisse s'accumule couramment sous la peau.",
    },
    35: {
      size: "Souvent décrit comme la taille d'une mini pastèque — environ 46 cm et environ 2,4 kg.",
      development:
        "L'espace pour bouger devient couramment plus restreint, même si les mouvements habituels restent généralement bien ressentis.",
    },
    36: {
      size: "Environ la taille d'un melon miel — environ 47 cm et environ 2,6 kg.",
      development:
        "Le bébé sera bientôt couramment considéré comme « à terme précoce », et le vernix protecteur commence couramment à s'amincir.",
    },
    37: {
      size: "Souvent décrit comme la taille d'une laitue romaine — environ 48,5 cm et environ 2,9 kg.",
      development:
        "À partir de maintenant, la grossesse est couramment considérée comme à terme, et des capacités comme téter et avaler continuent de s'affiner.",
    },
    38: {
      size: "Environ la taille d'une petite pastèque — environ 50 cm et environ 3,1 kg.",
      development:
        "Les poumons et le cerveau poursuivent leur maturation finale, et le bébé continue couramment de s'installer en position pour la naissance.",
    },
    39: {
      size: "Souvent décrit comme la taille d'un gros chou — environ 50,5 cm et environ 3,3 kg.",
      development:
        "Le bébé est couramment considéré comme pleinement développé à ce stade, avec des organes prêts à fonctionner seuls après la naissance.",
    },
    40: {
      size: "Environ la taille d'une petite citrouille — environ 51 cm et environ 3,5 kg.",
      development:
        "C'est la date prévue d'accouchement, même si beaucoup de bébés arrivent avant ou après, et les derniers détails comme les réserves de graisse et les réflexes continuent de s'affiner.",
    },
    41: {
      size: "Semblable à la semaine dernière — toujours à peu près la taille d'une petite citrouille, environ 51,5 cm et environ 3,6 kg.",
      development:
        "Le développement est couramment terminé à ce stade, et la croissance se poursuit à un rythme plus lent et plus régulier que plus tôt dans le troisième trimestre.",
    },
  },
};

const babyWeekCopyEs: BabyWeekCopy = {
  title: "El bebé esta semana",
  multiplesNote:
    "Con mellizos, gemelos o más, los tamaños y los tiempos varían — tus ecografías mostrarán la situación real.",
  veryEarly: {
    size: "A estas alturas todavía no hay un tamaño con el que comparar — muchos embarazos se están confirmando justo ahora.",
    development:
      "Los primeros días después de la concepción son habitualmente cuando ocurren la implantación y las primeras divisiones celulares, antes de que muchas personas sepan que están embarazadas.",
  },
  weeks: {
    4: {
      size: "Se suele describir como del tamaño de una semilla de amapola — unos 2 mm.",
      development:
        "La implantación suele completarse alrededor de ahora, y las primerísimas estructuras que darán lugar al cerebro y la médula espinal apenas empiezan a formarse.",
    },
    5: {
      size: "Aproximadamente del tamaño de una semilla de sésamo — unos 3 mm.",
      development:
        "El tubo neural suele cerrarse hacia este momento, y la forma más temprana del corazón empieza a esbozarse.",
    },
    6: {
      size: "Aproximadamente del tamaño de una lenteja — unos 5 mm.",
      development:
        "Suele detectarse actividad cardiaca desde aproximadamente esta semana, y aparecen pequeños brotes que darán lugar a los brazos y las piernas.",
    },
    7: {
      size: "Se suele describir como del tamaño de un arándano — 1 cm.",
      development:
        "Suelen formarse los primeros esbozos de manos y pies, y la cara empieza a desarrollar rasgos reconocibles.",
    },
    8: {
      size: "Aproximadamente del tamaño de una frambuesa — unos 1,6 cm y 1 gramo.",
      development:
        "Los dedos de manos y pies suelen formarse, aunque todavía unidos por una membrana, y ya han comenzado a desarrollarse todos los órganos principales.",
    },
    9: {
      size: "Se suele describir como del tamaño de una uva — unos 2,3 cm y 2 gramos.",
      development:
        "El bebé suele empezar a tener un aspecto más claramente humano, con codos y rodillas ya visibles.",
    },
    10: {
      size: "Aproximadamente del tamaño de una fresa — unos 3 cm y 4 gramos.",
      development:
        "Los órganos vitales suelen estar ya en gran parte formados y siguen desarrollándose, y empiezan a formarse las uñitas.",
    },
    11: {
      size: "Se suele describir como del tamaño de una lima — unos 4 cm y 7 gramos.",
      development:
        "Desde aproximadamente ahora, el bebé a veces puede verse moviéndose en la ecografía, aunque esos movimientos normalmente todavía no se sienten.",
    },
    12: {
      size: "Aproximadamente del tamaño de una ciruela — unos 5,5 cm y 14 gramos.",
      development:
        "Se desarrollan los reflejos, y el sistema digestivo empieza a practicar los movimientos musculares que usará después de nacer.",
    },
    13: {
      size: "Se suele describir como del tamaño de un melocotón — unos 7 cm y 23 gramos.",
      development:
        "El paso de embrión a feto suele estar completo, y las cuerdas vocales empiezan a formarse.",
    },
    14: {
      size: "Aproximadamente del tamaño de un limón — unos 8,5 cm y 43 gramos.",
      development:
        "Los músculos de la cara suelen estar ya lo bastante desarrollados para expresiones como entornar los ojos o fruncir el ceño.",
    },
    15: {
      size: "Se suele describir como del tamaño de una manzana — unos 10 cm y 70 gramos.",
      development:
        "El esqueleto se va endureciendo poco a poco, pasando de cartílago blando a hueso, y el sentido del oído empieza a desarrollarse.",
    },
    16: {
      size: "Aproximadamente del tamaño de un aguacate — unos 12 cm y 100 gramos.",
      development:
        "El sistema circulatorio suele funcionar ya bastante bien, y las piernas están notablemente más desarrolladas.",
    },
    17: {
      size: "Se suele describir como del tamaño de una cebolla — unos 13 cm y 140 gramos.",
      development:
        "El cordón umbilical suele engrosarse y fortalecerse, y el bebé empieza a acumular algo de grasa corporal.",
    },
    18: {
      size: "Aproximadamente del tamaño de un pimiento — unos 14 cm y 190 gramos.",
      development:
        "Las orejas suelen alcanzar su posición definitiva, y el bebé puede empezar a responder a sonidos del exterior.",
    },
    19: {
      size: "Se suele describir como del tamaño de un mango — unos 15 cm y 240 gramos.",
      development:
        "Hacia esta época, una capa protectora cerosa llamada vérnix suele empezar a cubrir la piel, y los sentidos del gusto y el olfato siguen desarrollándose.",
    },
    20: {
      size: "Aproximadamente del tamaño de un plátano — unos 25 cm y 300 gramos.",
      development:
        "Muchas personas empiezan a sentir movimientos por primera vez — descritos a menudo como un leve aleteo — desde aproximadamente ahora, aunque el momento varía bastante de un embarazo a otro.",
    },
    21: {
      size: "Se suele describir como del tamaño de un pomelo — unos 26,5 cm y 360 gramos.",
      development:
        "Los movimientos suelen notarse cada vez con más facilidad a medida que los músculos se fortalecen, y el sistema digestivo sigue madurando.",
    },
    22: {
      size: "Aproximadamente del tamaño de una zanahoria — unos 28 cm y 430 gramos.",
      development:
        "Los sentidos continúan afinándose, y las cejas y los párpados suelen estar ya completamente formados.",
    },
    23: {
      size: "Se suele describir como del tamaño de una mazorca de maíz — unos 29 cm y 500 gramos.",
      development:
        "Los vasos sanguíneos de los pulmones suelen desarrollarse para preparar la respiración tras el nacimiento, y el oído sigue madurando.",
    },
    24: {
      size: "Aproximadamente del tamaño de un melón cantalupo — unos 30 cm y 600 gramos.",
      development:
        "Los pulmones siguen desarrollando su estructura ramificada de vías respiratorias, y la piel suele volverse algo menos transparente.",
    },
    25: {
      size: "Se suele describir como del tamaño de una coliflor — unos 34 cm y 660 gramos.",
      development:
        "El bebé suele responder a sonidos y contacto familiares, y el sistema nervioso sigue madurando.",
    },
    26: {
      size: "Aproximadamente del tamaño de una papaya — unos 35 cm y 760 gramos.",
      development:
        "Los ojos suelen empezar a abrirse hacia esta época, y los pulmones empiezan a producir surfactante, una sustancia que les ayuda a expandirse después de nacer.",
    },
    27: {
      size: "Se suele describir como del tamaño de un repollo — unos 36,5 cm y 875 gramos.",
      development:
        "El bebé suele abrir y cerrar los ojos, y los ciclos de sueño y vigilia se vuelven más perceptibles.",
    },
    28: {
      size: "Aproximadamente del tamaño de una berenjena — unos 37,5 cm y alrededor de 1 kg.",
      development:
        "Esto se suele considerar el inicio del tercer trimestre, y la superficie del cerebro empieza a desarrollar sus pliegues característicos.",
    },
    29: {
      size: "Se suele describir como del tamaño de un coco — unos 38,5 cm y alrededor de 1,15 kg.",
      development:
        "Los músculos y los pulmones siguen madurando, y el bebé suele ganar peso de forma constante desde aproximadamente ahora.",
    },
    30: {
      size: "Aproximadamente del tamaño de una calabaza butternut — unos 40 cm y alrededor de 1,3 kg.",
      development:
        "El bebé ya suele poder abrir y cerrar los ojos a voluntad, y empiezan a desarrollarse glóbulos blancos para la protección inmunitaria.",
    },
    31: {
      size: "Se suele describir como del tamaño de una piña pequeña — unos 41 cm y alrededor de 1,5 kg.",
      development:
        "El bebé suele practicar movimientos respiratorios usando el líquido amniótico, y los reflejos siguen afinándose.",
    },
    32: {
      size: "Aproximadamente del tamaño de una col china — unos 42 cm y alrededor de 1,7 kg.",
      development:
        "Las uñas de los pies suelen estar ya completamente formadas, y el bebé a menudo empieza a colocarse cabeza abajo u otra posición antes del parto, aunque todavía puede cambiar.",
    },
    33: {
      size: "Se suele describir como del tamaño de una piña — unos 44 cm y alrededor de 1,9 kg.",
      development:
        "Los huesos siguen endureciéndose, salvo los del cráneo, que suelen mantenerse blandos y flexibles para facilitar el paso por el canal del parto.",
    },
    34: {
      size: "Aproximadamente del tamaño de un melón grande — unos 45 cm y alrededor de 2,1 kg.",
      development:
        "El sistema nervioso central y los pulmones siguen madurando, y bajo la piel suele acumularse de forma constante una capa protectora de grasa.",
    },
    35: {
      size: "Se suele describir como del tamaño de una sandía mini — unos 46 cm y alrededor de 2,4 kg.",
      development:
        "Suele haber cada vez menos espacio para moverse, aunque los patrones de movimiento habituales generalmente se siguen sintiendo con regularidad.",
    },
    36: {
      size: "Aproximadamente del tamaño de un melón dulce — unos 47 cm y alrededor de 2,6 kg.",
      development:
        "Pronto se suele considerar al bebé a término temprano, y la capa protectora de vérnix suele empezar a adelgazar.",
    },
    37: {
      size: "Se suele describir como del tamaño de una lechuga romana — unos 48,5 cm y alrededor de 2,9 kg.",
      development:
        "Desde aquí el embarazo se suele considerar a término, y habilidades como succionar y tragar se siguen perfeccionando.",
    },
    38: {
      size: "Aproximadamente del tamaño de una sandía pequeña — unos 50 cm y alrededor de 3,1 kg.",
      development:
        "Los pulmones y el cerebro completan su maduración final, y el bebé suele seguir acomodándose en posición para el nacimiento.",
    },
    39: {
      size: "Se suele describir como del tamaño de un repollo grande — unos 50,5 cm y alrededor de 3,3 kg.",
      development:
        "El bebé suele considerarse ya completamente desarrollado a estas alturas, con los órganos listos para funcionar por sí solos después de nacer.",
    },
    40: {
      size: "Aproximadamente del tamaño de una calabaza pequeña — unos 51 cm y alrededor de 3,5 kg.",
      development:
        "Esta es la fecha probable de parto, aunque muchos bebés nacen antes o después de ella, y los últimos detalles, como las reservas de grasa y los reflejos, se siguen puliendo.",
    },
    41: {
      size: "Parecido a la semana pasada — sigue siendo aproximadamente del tamaño de una calabaza pequeña, unos 51,5 cm y alrededor de 3,6 kg.",
      development:
        "El desarrollo suele estar prácticamente completo a estas alturas, y el crecimiento continúa a un ritmo más lento y constante que antes en el tercer trimestre.",
    },
  },
};

const babyWeekCopyIt: BabyWeekCopy = {
  title: "Il bambino questa settimana",
  multiplesNote:
    "Con gemelli o più bambini, dimensioni e tempi variano — le tue ecografie racconteranno la situazione reale.",
  veryEarly: {
    size: "A questo punto non c'è ancora una dimensione da confrontare — molte gravidanze vengono confermate proprio in questo periodo.",
    development:
      "I primissimi giorni dopo il concepimento sono comunemente quelli dell'impianto e delle prime divisioni cellulari, prima che molte persone sappiano di essere incinte.",
  },
  weeks: {
    4: {
      size: "Descritto comunemente come grande quanto un seme di papavero — circa 2 mm.",
      development:
        "L'impianto si completa comunemente intorno a questo periodo, e le primissime strutture che daranno origine al cervello e al midollo spinale iniziano appena a formarsi.",
    },
    5: {
      size: "Circa le dimensioni di un seme di sesamo — circa 3 mm.",
      development:
        "Il tubo neurale si chiude comunemente intorno a questo periodo, e la forma più precoce del cuore inizia a delinearsi.",
    },
    6: {
      size: "Circa le dimensioni di una lenticchia — circa 5 mm.",
      development:
        "Un'attività cardiaca è comunemente rilevabile a partire da circa questa settimana, e compaiono piccoli abbozzi che diventeranno braccia e gambe.",
    },
    7: {
      size: "Descritto comunemente come grande quanto un mirtillo — circa 1 cm.",
      development:
        "Gli abbozzi di mani e piedi si formano comunemente, e il viso inizia a sviluppare tratti riconoscibili.",
    },
    8: {
      size: "Circa le dimensioni di un lampone — circa 1,6 cm e 1 grammo.",
      development:
        "Le dita di mani e piedi si formano comunemente, anche se ancora unite da una membrana, e tutti gli organi principali hanno già iniziato a svilupparsi.",
    },
    9: {
      size: "Descritto comunemente come grande quanto un chicco d'uva — circa 2,3 cm e 2 grammi.",
      development:
        "Il bambino inizia comunemente ad avere un aspetto più chiaramente umano, con gomiti e ginocchia ormai visibili.",
    },
    10: {
      size: "Circa le dimensioni di una fragola — circa 3 cm e 4 grammi.",
      development:
        "Gli organi vitali sono comunemente già in gran parte formati e continuano a svilupparsi, e iniziano a formarsi le unghiette.",
    },
    11: {
      size: "Descritto comunemente come grande quanto un lime — circa 4 cm e 7 grammi.",
      development:
        "Da circa questo momento, il bambino può comunemente essere visto muoversi durante un'ecografia, anche se questi movimenti di solito non si sentono ancora.",
    },
    12: {
      size: "Circa le dimensioni di una susina — circa 5,5 cm e 14 grammi.",
      development:
        "I riflessi si stanno sviluppando, e l'apparato digerente inizia a esercitare i movimenti muscolari che userà dopo la nascita.",
    },
    13: {
      size: "Descritto comunemente come grande quanto una pesca — circa 7 cm e 23 grammi.",
      development:
        "Il passaggio da embrione a feto è comunemente completo, e le corde vocali iniziano a formarsi.",
    },
    14: {
      size: "Circa le dimensioni di un limone — circa 8,5 cm e 43 grammi.",
      development:
        "I muscoli del viso sono comunemente sviluppati abbastanza da permettere espressioni come socchiudere gli occhi o accigliarsi.",
    },
    15: {
      size: "Descritto comunemente come grande quanto una mela — circa 10 cm e 70 grammi.",
      development:
        "Lo scheletro si indurisce gradualmente, passando da cartilagine morbida a osso, e il senso dell'udito inizia a svilupparsi.",
    },
    16: {
      size: "Circa le dimensioni di un avocado — circa 12 cm e 100 grammi.",
      development:
        "L'apparato circolatorio funziona comunemente già abbastanza bene, e le gambe sono notevolmente più sviluppate.",
    },
    17: {
      size: "Descritto comunemente come grande quanto una cipolla — circa 13 cm e 140 grammi.",
      development:
        "Il cordone ombelicale si ispessisce e si rinforza comunemente, e il bambino inizia ad accumulare un po' di grasso corporeo.",
    },
    18: {
      size: "Circa le dimensioni di un peperone — circa 14 cm e 190 grammi.",
      development:
        "Le orecchie raggiungono comunemente la loro posizione definitiva, e il bambino potrebbe iniziare a rispondere ai suoni provenienti dall'esterno.",
    },
    19: {
      size: "Descritto comunemente come grande quanto un mango — circa 15 cm e 240 grammi.",
      development:
        "Intorno a questo periodo, uno strato protettivo ceroso chiamato vernice caseosa inizia comunemente a ricoprire la pelle, e i sensi del gusto e dell'olfatto continuano a svilupparsi.",
    },
    20: {
      size: "Circa le dimensioni di una banana — circa 25 cm e 300 grammi.",
      development:
        "Molte persone iniziano a sentire i movimenti per la prima volta — spesso descritti come un leggero svolazzare — da circa questo momento, anche se i tempi variano molto da una gravidanza all'altra.",
    },
    21: {
      size: "Descritto comunemente come grande quanto un pompelmo — circa 26,5 cm e 360 grammi.",
      development:
        "I movimenti diventano comunemente più facili da notare man mano che i muscoli si rafforzano, e l'apparato digerente continua a maturare.",
    },
    22: {
      size: "Circa le dimensioni di una carota — circa 28 cm e 430 grammi.",
      development:
        "I sensi continuano ad affinarsi, e le sopracciglia e le palpebre sono comunemente già completamente formate.",
    },
    23: {
      size: "Descritto comunemente come grande quanto una pannocchia di mais — circa 29 cm e 500 grammi.",
      development:
        "I vasi sanguigni dei polmoni si sviluppano comunemente per prepararsi alla respirazione dopo la nascita, e l'udito continua a maturare.",
    },
    24: {
      size: "Circa le dimensioni di un melone cantalupo — circa 30 cm e 600 grammi.",
      development:
        "I polmoni continuano a sviluppare la loro struttura ramificata delle vie respiratorie, e la pelle diventa comunemente un po' meno trasparente.",
    },
    25: {
      size: "Descritto comunemente come grande quanto un cavolfiore — circa 34 cm e 660 grammi.",
      development:
        "Il bambino risponde comunemente a suoni e tocchi familiari, e il sistema nervoso continua a maturare.",
    },
    26: {
      size: "Circa le dimensioni di una papaya — circa 35 cm e 760 grammi.",
      development:
        "Gli occhi iniziano comunemente ad aprirsi intorno a questo periodo, e i polmoni iniziano a produrre surfattante, una sostanza che li aiuta a espandersi dopo la nascita.",
    },
    27: {
      size: "Descritto comunemente come grande quanto un cavolo — circa 36,5 cm e 875 grammi.",
      development:
        "Il bambino apre e chiude comunemente gli occhi, e i cicli di sonno e veglia diventano più evidenti.",
    },
    28: {
      size: "Circa le dimensioni di una melanzana — circa 37,5 cm e circa 1 kg.",
      development:
        "Questo è comunemente considerato l'inizio del terzo trimestre, e la superficie del cervello inizia a sviluppare le sue caratteristiche circonvoluzioni.",
    },
    29: {
      size: "Descritto comunemente come grande quanto una noce di cocco — circa 38,5 cm e circa 1,15 kg.",
      development:
        "Muscoli e polmoni continuano a maturare, e da circa questo momento il bambino guadagna comunemente peso in modo costante.",
    },
    30: {
      size: "Circa le dimensioni di una zucca butternut — circa 40 cm e circa 1,3 kg.",
      development:
        "Il bambino ormai riesce comunemente ad aprire e chiudere gli occhi a piacimento, e i globuli bianchi iniziano a svilupparsi per la protezione immunitaria.",
    },
    31: {
      size: "Descritto comunemente come grande quanto un ananas piccolo — circa 41 cm e circa 1,5 kg.",
      development:
        "Il bambino esercita comunemente movimenti respiratori usando il liquido amniotico, e i riflessi continuano ad affinarsi.",
    },
    32: {
      size: "Circa le dimensioni di un cavolo cinese — circa 42 cm e circa 1,7 kg.",
      development:
        "Le unghie dei piedi sono comunemente già completamente formate, e il bambino inizia spesso a sistemarsi in posizione cefalica, podalica o di altro tipo in vista della nascita, anche se può ancora cambiare.",
    },
    33: {
      size: "Descritto comunemente come grande quanto un ananas — circa 44 cm e circa 1,9 kg.",
      development:
        "Le ossa continuano a indurirsi, tranne quelle del cranio, che restano comunemente morbide e flessibili per facilitare il passaggio nel canale del parto.",
    },
    34: {
      size: "Circa le dimensioni di un melone grande — circa 45 cm e circa 2,1 kg.",
      development:
        "Il sistema nervoso centrale e i polmoni continuano a maturare, e sotto la pelle si accumula comunemente in modo costante uno strato protettivo di grasso.",
    },
    35: {
      size: "Descritto comunemente come grande quanto un'anguria mini — circa 46 cm e circa 2,4 kg.",
      development:
        "Lo spazio per muoversi diventa comunemente più ridotto, anche se i movimenti abituali di solito continuano a essere sentiti regolarmente.",
    },
    36: {
      size: "Circa le dimensioni di un melone invernale — circa 47 cm e circa 2,6 kg.",
      development:
        "Il bambino sarà presto comunemente considerato a termine precoce, e lo strato protettivo di vernice caseosa inizia comunemente ad assottigliarsi.",
    },
    37: {
      size: "Descritto comunemente come grande quanto una lattuga romana — circa 48,5 cm e circa 2,9 kg.",
      development:
        "Da qui in poi la gravidanza è comunemente considerata a termine, e abilità come succhiare e deglutire continuano a perfezionarsi.",
    },
    38: {
      size: "Circa le dimensioni di un'anguria piccola — circa 50 cm e circa 3,1 kg.",
      development:
        "I polmoni e il cervello completano la loro maturazione finale, e il bambino continua comunemente a sistemarsi in posizione per la nascita.",
    },
    39: {
      size: "Descritto comunemente come grande quanto un cavolo grande — circa 50,5 cm e circa 3,3 kg.",
      development:
        "A questo punto il bambino è comunemente considerato pienamente sviluppato, con gli organi pronti a funzionare autonomamente dopo la nascita.",
    },
    40: {
      size: "Circa le dimensioni di una zucca piccola — circa 51 cm e circa 3,5 kg.",
      development:
        "Questa è la data presunta del parto, anche se molti bambini nascono prima o dopo di essa, e gli ultimi ritocchi, come le riserve di grasso e i riflessi, continuano a perfezionarsi.",
    },
    41: {
      size: "Simile alla settimana scorsa — ancora circa grande quanto una zucca piccola, circa 51,5 cm e circa 3,6 kg.",
      development:
        "Lo sviluppo è comunemente completo a questo punto, e la crescita prosegue a un ritmo più lento e costante rispetto a prima nel terzo trimestre.",
    },
  },
};

const babyWeekCopyCatalog: Record<InterfaceLanguage, BabyWeekCopy> = {
  en: babyWeekCopyEn,
  ru: babyWeekCopyRu,
  es: babyWeekCopyEs,
  de: babyWeekCopyDe,
  fr: babyWeekCopyFr,
  it: babyWeekCopyIt,
};

export type { BabyWeekCopy };

export function getBabyWeekCopy(language: string | null | undefined) {
  return babyWeekCopyCatalog[resolveCopyLanguage(language)];
}
