/**
 * Pins the prescribed localization audit fixes so regressions are caught.
 * Groups mirror the audit prescription (A through G).
 */

import { getStatsCopy } from "./stats-copy";
import { getShellCopy } from "./shell-copy";
import { getDashboardCopy } from "./dashboard-copy";
import { getDayLogCopy } from "./day-log-copy";
import { getSettingsCopy } from "./settings-copy";
import { getOnboardingCopy } from "./app-copy";
import { selectTOTPCopy } from "./totp-copy";
import { getReminderCopy } from "./reminder-copy";

// ── A. Russian count grammar ───────────────────────────────────────────────

describe("A1 dashboard-copy ru cycleHeroRegular — canonical hyphen pattern", () => {
  const ru = getDashboardCopy("ru");
  it("uses N-дневный цикл for day 28", () => {
    expect(ru.cycleHeroRegular(28)).toBe("28-дневный цикл");
  });
  it("uses N-дневный цикл for day 1", () => {
    expect(ru.cycleHeroRegular(1)).toBe("1-дневный цикл");
  });
});

describe("A2 stats-copy ru factorCycleLength — canonical hyphen pattern", () => {
  const ru = getStatsCopy("ru");
  it("uses N-дневный цикл for 28", () => {
    expect(ru.factorCycleLength(28)).toBe("28-дневный цикл");
  });
  it("uses N-дневный цикл for 7", () => {
    expect(ru.factorCycleLength(7)).toBe("7-дневный цикл");
  });
});

describe("A3 stats-copy ru factorContextWindow — ruDayWord agreement", () => {
  const ru = getStatsCopy("ru");
  it("1 день", () => {
    expect(ru.factorContextWindow(1)).toBe("Отмечено за последние 1 день.");
  });
  it("2 дня", () => {
    expect(ru.factorContextWindow(2)).toBe("Отмечено за последние 2 дня.");
  });
  it("5 дней", () => {
    expect(ru.factorContextWindow(5)).toBe("Отмечено за последние 5 дней.");
  });
  it("21 день", () => {
    expect(ru.factorContextWindow(21)).toBe("Отмечено за последние 21 день.");
  });
  it("30 дней", () => {
    expect(ru.factorContextWindow(30)).toBe("Отмечено за последние 30 дней.");
  });
});

describe("A4 stats-copy ru phaseMoodCount / phaseSymptomsDays — participle agreement", () => {
  const ru = getStatsCopy("ru");

  it("phaseMoodCount(1) → 1 записанный день", () => {
    expect(ru.phaseMoodCount(1)).toBe("1 записанный день");
  });
  it("phaseMoodCount(2) → 2 записанных дня", () => {
    expect(ru.phaseMoodCount(2)).toBe("2 записанных дня");
  });
  it("phaseMoodCount(4) → 4 записанных дня", () => {
    expect(ru.phaseMoodCount(4)).toBe("4 записанных дня");
  });
  it("phaseMoodCount(5) → 5 записанных дней", () => {
    expect(ru.phaseMoodCount(5)).toBe("5 записанных дней");
  });
  it("phaseMoodCount(21) → 21 записанный день", () => {
    expect(ru.phaseMoodCount(21)).toBe("21 записанный день");
  });
  it("phaseMoodCount(11) → 11 записанных дней", () => {
    expect(ru.phaseMoodCount(11)).toBe("11 записанных дней");
  });

  it("phaseSymptomsDays(1) → …в этой фазе", () => {
    expect(ru.phaseSymptomsDays(1)).toBe("1 записанный день в этой фазе");
  });
  it("phaseSymptomsDays(3) → …в этой фазе", () => {
    expect(ru.phaseSymptomsDays(3)).toBe("3 записанных дня в этой фазе");
  });
  it("phaseSymptomsDays(10) → …в этой фазе", () => {
    expect(ru.phaseSymptomsDays(10)).toBe("10 записанных дней в этой фазе");
  });
});

describe("A5 stats-copy ru irregularNotice / cycleRangeSummary — genitive after до", () => {
  const ru = getStatsCopy("ru");

  it("irregularNotice(21,31) → до 31 дня", () => {
    expect(ru.irregularNotice(21, 31)).toContain("до 31 дня");
  });
  it("irregularNotice(21,24) → до 24 дней", () => {
    expect(ru.irregularNotice(21, 24)).toContain("до 24 дней");
  });
  it("irregularNotice(21,25) → до 25 дней", () => {
    expect(ru.irregularNotice(21, 25)).toContain("до 25 дней");
  });
  it("irregularNotice(20,21) → до 21 дня", () => {
    expect(ru.irregularNotice(20, 21)).toContain("до 21 дня");
  });

  it("cycleRangeSummary(21,31) → до 31 дня", () => {
    expect(ru.cycleRangeSummary(21, 31)).toContain("до 31 дня");
  });
  it("cycleRangeSummary(21,28) → до 28 дней", () => {
    expect(ru.cycleRangeSummary(21, 28)).toContain("до 28 дней");
  });
});

// ── B. Russian terminology Инсайты → Аналитика ────────────────────────────

describe("B stats-copy ru — Аналитика terminology", () => {
  const ru = getStatsCopy("ru");
  it("title is Аналитика", () => {
    expect(ru.title).toBe("Аналитика");
  });
  it("emptyTitle contains аналитику", () => {
    expect(ru.emptyTitle).toContain("аналитику");
  });
  it("emptyBodyZero contains аналитику", () => {
    expect(ru.emptyBodyZero).toContain("аналитику");
  });
  it("emptyBodyOne contains аналитику", () => {
    expect(ru.emptyBodyOne).toContain("аналитику");
  });
  it("advancedInsights.title is Расширенная аналитика", () => {
    expect(ru.advancedInsights.title).toBe("Расширенная аналитика");
  });
  it("premiumLock.advancedInsights.title is Расширенная аналитика", () => {
    expect(ru.premiumLock.advancedInsights.title).toBe("Расширенная аналитика");
  });
  it("title does not contain Инсайты", () => {
    expect(ru.title).not.toContain("Инсайты");
  });
});

describe("B shell-copy ru — Аналитика terminology", () => {
  const ru = getShellCopy("ru");
  it("tabs.stats is Аналитика", () => {
    expect(ru.tabs.stats).toBe("Аналитика");
  });
  it("loading.statsTitle contains аналитику", () => {
    expect(ru.loading.statsTitle).toContain("аналитику");
  });
});

// ── C. Russian formal register ─────────────────────────────────────────────

describe("C totp-copy ru — formal imperatives (Вы-forms)", () => {
  const ru = selectTOTPCopy("ru");
  it("section.hint uses Дополните", () => {
    expect(ru.section.hint).toContain("Дополните");
  });
  it("enroll.secretTitle uses Отсканируйте или введите", () => {
    expect(ru.enroll.secretTitle).toContain("Отсканируйте или введите");
  });
  it("enroll.secretHint uses Добавьте", () => {
    expect(ru.enroll.secretHint).toContain("Добавьте");
  });
  it("enroll.secretHint uses введите", () => {
    expect(ru.enroll.secretHint).toContain("введите");
  });
  it("enroll.successMessage uses войдите заново", () => {
    expect(ru.enroll.successMessage.toLowerCase()).toContain("войдите заново");
  });
  it("challenge.title uses Введите", () => {
    expect(ru.challenge.title).toContain("Введите");
  });
  it("challenge.hint uses Откройте", () => {
    expect(ru.challenge.hint).toContain("Откройте");
  });
  it("challenge.hint uses введите", () => {
    expect(ru.challenge.hint).toContain("введите");
  });
  it("challenge.expiredHint uses Войдите заново", () => {
    expect(ru.challenge.expiredHint).toContain("Войдите заново");
  });
  it("errors.currentPasswordRequired uses Введите", () => {
    expect(ru.errors.currentPasswordRequired).toContain("Введите");
  });
  it("errors.totpAlreadyEnabled uses выключите", () => {
    expect(ru.errors.totpAlreadyEnabled.toLowerCase()).toContain("выключите");
  });
  it("errors.totpInvalidCode uses Попробуйте", () => {
    expect(ru.errors.totpInvalidCode).toContain("Попробуйте");
  });
  it("errors.totpReplayed uses Подождите", () => {
    expect(ru.errors.totpReplayed).toContain("Подождите");
  });
  it("errors.totpChallengeInvalid uses Войдите заново", () => {
    expect(ru.errors.totpChallengeInvalid).toContain("Войдите заново");
  });
  it("errors.totpSecretFailed uses Повторите", () => {
    expect(ru.errors.totpSecretFailed).toContain("Повторите");
  });
  it("errors.challengeIDRequired uses Войдите заново", () => {
    expect(ru.errors.challengeIDRequired).toContain("Войдите заново");
  });
  it("errors.notConnected uses подключите", () => {
    expect(ru.errors.notConnected.toLowerCase()).toContain("подключите");
  });
  it("errors.rateLimited uses Повторите", () => {
    expect(ru.errors.rateLimited).toContain("Повторите");
  });
  it("errors.networkFailed uses Повторите", () => {
    expect(ru.errors.networkFailed).toContain("Повторите");
  });
  it("errors.unauthorized uses Войдите заново", () => {
    expect(ru.errors.unauthorized).toContain("Войдите заново");
  });
  it("errors.generic uses Повторите", () => {
    expect(ru.errors.generic).toContain("Повторите");
  });
  // No informal ты-forms should remain
  it("no remaining ты-forms: Подожди", () => {
    const all = JSON.stringify(ru);
    expect(all).not.toContain("Подожди ");
  });
  it("no remaining ты-forms: Повтори ", () => {
    const all = JSON.stringify(ru);
    expect(all).not.toContain("Повтори ");
  });
  it("no remaining ты-forms: Введи ", () => {
    const all = JSON.stringify(ru);
    expect(all).not.toContain("Введи ");
  });
  it("no remaining ты-forms: Открой ", () => {
    const all = JSON.stringify(ru);
    expect(all).not.toContain("Открой ");
  });
  it("no remaining ты-forms: Войди ", () => {
    const all = JSON.stringify(ru);
    expect(all).not.toContain("Войди ");
  });
});

describe("C reminder-copy ru — formal Откройте", () => {
  const ru = getReminderCopy("ru");
  it("dailyLogBody uses Откройте", () => {
    expect(ru.dailyLogBody).toContain("Откройте");
  });
  it("cycleBody uses Откройте", () => {
    expect(ru.cycleBody).toContain("Откройте");
  });
  it("no informal Открой", () => {
    expect(ru.dailyLogBody).not.toContain("Открой ");
    expect(ru.cycleBody).not.toContain("Открой ");
  });
});

describe("C dashboard-copy ru — cycleHeroStale uses месячных, predictionsOff uses Прогнозы", () => {
  const ru = getDashboardCopy("ru");
  it("cycleHeroStale contains месячных", () => {
    expect(ru.cycleHeroStale).toContain("месячных");
  });
  it("predictionsOff is Прогнозы выключены", () => {
    expect(ru.predictionsOff).toBe("Прогнозы выключены");
  });
  it("pregnancyPausedHint contains месячных", () => {
    expect(ru.pregnancyPausedHint).toContain("месячных");
  });
  it("futureCycleStartNotice uses Прогнозы", () => {
    expect(ru.futureCycleStartNotice).toContain("Прогнозы");
  });
});

describe("C stats-copy ru — Прогнозы replaces Предсказания", () => {
  const ru = getStatsCopy("ru");
  it("emptyProgressHint uses Прогнозы", () => {
    expect(ru.emptyProgressHint).toContain("Прогнозы");
  });
  it("irregularNotice uses Прогнозы", () => {
    expect(ru.irregularNotice(20, 30)).toContain("Прогнозы");
  });
  it("factsOnlyValue is Прогнозы выключены", () => {
    expect(ru.factsOnlyValue).toBe("Прогнозы выключены");
  });
  it("reliabilityHint uses прогнозируемый", () => {
    expect(ru.reliabilityHint).toContain("прогнозируемый");
  });
  it("reliabilityHintVariable uses Прогнозы", () => {
    expect(ru.reliabilityHintVariable).toContain("Прогнозы");
  });
});

// ── D. Spanish TCB → TBC, dashboard → panel, médico → profesional ──────────

describe("D Spanish TCB → TBC", () => {
  it("dashboard-copy es bbt is TBC", () => {
    expect(getDashboardCopy("es").bbt).toBe("TBC");
  });
  it("day-log-copy es bbt is TBC", () => {
    expect(getDayLogCopy("es").bbt).toBe("TBC");
  });
  it("stats-copy es bbtTitle contains TBC", () => {
    expect(getStatsCopy("es").bbtTitle).toContain("TBC");
  });
  it("settings-copy es trackBBT contains TBC", () => {
    expect(getSettingsCopy("es").tracking.trackBBT).toContain("TBC");
  });
  it("settings-copy es temperatureUnit contains TBC", () => {
    expect(getSettingsCopy("es").tracking.temperatureUnit).toContain("TBC");
  });
  it("no remaining TCB in es stats", () => {
    const all = JSON.stringify(getStatsCopy("es"));
    expect(all).not.toContain("TCB");
  });
  it("no remaining TCB in es settings", () => {
    const all = JSON.stringify(getSettingsCopy("es"));
    expect(all).not.toContain("TCB");
  });
  it("no remaining TCB in es day-log", () => {
    const all = JSON.stringify(getDayLogCopy("es"));
    expect(all).not.toContain("TCB");
  });
  it("no remaining TCB in es dashboard", () => {
    const all = JSON.stringify(getDashboardCopy("es"));
    expect(all).not.toContain("TCB");
  });
});

describe("D Spanish dashboard → panel", () => {
  it("settings trackBBTHint uses panel not dashboard", () => {
    const hint = getSettingsCopy("es").tracking.trackBBTHint;
    expect(hint).toContain("panel");
    expect(hint).not.toContain("dashboard");
  });
  it("settings activeHint uses panel not dashboard", () => {
    const hint = getSettingsCopy("es").symptoms.activeHint;
    expect(hint).toContain("panel");
    expect(hint).not.toContain("dashboard");
  });
  it("settings export noData uses panel not dashboard", () => {
    const noData = getSettingsCopy("es").export.noData;
    expect(noData).toContain("panel");
    expect(noData).not.toContain("dashboard");
  });
  it("settings trackingSaved uses panel not dashboard", () => {
    const saved = getSettingsCopy("es").status.trackingSaved;
    expect(saved).toContain("panel");
    expect(saved).not.toContain("dashboard");
  });
});

describe("D Spanish médico → profesional de la salud", () => {
  it("settings infoPeriodLong uses profesional de la salud", () => {
    expect(getSettingsCopy("es").cycle.infoPeriodLong).toContain("profesional de la salud");
  });
  it("settings infoCycleLong uses profesional de la salud", () => {
    expect(getSettingsCopy("es").cycle.infoCycleLong).toContain("profesional de la salud");
  });
  it("settings infoCycleShort uses profesional de la salud", () => {
    expect(getSettingsCopy("es").cycle.infoCycleShort).toContain("profesional de la salud");
  });
  it("settings export subtitle uses profesional de la salud", () => {
    expect(getSettingsCopy("es").export.subtitle).toContain("profesional de la salud");
  });
  it("settings premiumLock pdfExportTitle uses profesional de la salud", () => {
    expect(getSettingsCopy("es").premiumLock.pdfExportTitle).toContain("profesional de la salud");
  });
  it("app-copy es step2.infoPeriodLong uses profesional de la salud", () => {
    expect(getOnboardingCopy("es").step2.infoPeriodLong).toContain("profesional de la salud");
  });
  it("app-copy es step2.infoCycleLong uses profesional de la salud", () => {
    expect(getOnboardingCopy("es").step2.infoCycleLong).toContain("profesional de la salud");
  });
  it("stats shortLutealDescription uses profesional de la salud", () => {
    expect(getStatsCopy("es").advancedInsights.shortLutealDescription(3)).toContain("profesional de la salud");
  });
  it("no remaining médico/médica in es settings", () => {
    const all = JSON.stringify(getSettingsCopy("es"));
    expect(all).not.toContain("médico");
    expect(all).not.toContain("médica");
  });
});

// ── E. German point fixes ──────────────────────────────────────────────────

describe("E German point fixes", () => {
  it("stats-copy de premiumLock.advancedInsights.description uses Vorhersagen not Prognosen", () => {
    const desc = getStatsCopy("de").premiumLock.advancedInsights.description;
    expect(desc).toContain("Vorhersagen");
    expect(desc).not.toContain("Prognosen");
  });
  it("dashboard-copy de cycleHeroApproximate is Ungefährer Zyklus (nominative)", () => {
    expect(getDashboardCopy("de").cycleHeroApproximate).toBe("Ungefährer Zyklus");
  });
});

// ── F. French point fixes ──────────────────────────────────────────────────

describe("F French cervical mucus feminine agreement", () => {
  const fr = getDayLogCopy("fr");
  const cm = fr.options.cervicalMucus;
  it("dry option is Sèche", () => {
    const dry = cm.find((o) => o.value === "dry");
    expect(dry?.label).toBe("Sèche");
  });
  it("creamy option is Crémeuse", () => {
    const creamy = cm.find((o) => o.value === "creamy");
    expect(creamy?.label).toBe("Crémeuse");
  });
  it("moist option stays Humide", () => {
    const moist = cm.find((o) => o.value === "moist");
    expect(moist?.label).toBe("Humide");
  });
});

describe("F French TBC → TB", () => {
  it("dashboard-copy fr bbt is TB", () => {
    expect(getDashboardCopy("fr").bbt).toBe("TB");
  });
  it("day-log-copy fr bbt is TB", () => {
    expect(getDayLogCopy("fr").bbt).toBe("TB");
  });
  it("stats-copy fr bbtTitle contains TB not TBC", () => {
    const title = getStatsCopy("fr").bbtTitle;
    expect(title).toContain("TB");
    expect(title).not.toContain("TBC");
  });
  it("stats-copy fr bbtCaption uses TB not TBC", () => {
    const cap = getStatsCopy("fr").bbtCaption;
    expect(cap).toContain("TB");
    expect(cap).not.toContain("TBC");
  });
  it("settings-copy fr trackBBT uses TB not TBC", () => {
    const label = getSettingsCopy("fr").tracking.trackBBT;
    expect(label).toContain("TB");
    expect(label).not.toContain("TBC");
  });
  it("settings-copy fr temperatureUnit uses TB not TBC", () => {
    const unit = getSettingsCopy("fr").tracking.temperatureUnit;
    expect(unit).toContain("TB");
    expect(unit).not.toContain("TBC");
  });
  it("no remaining TBC in fr stats", () => {
    const all = JSON.stringify(getStatsCopy("fr"));
    expect(all).not.toContain("TBC");
  });
  it("no remaining TBC in fr settings tracking", () => {
    const tracking = JSON.stringify(getSettingsCopy("fr").tracking);
    expect(tracking).not.toContain("TBC");
  });
});

describe("F French dashboard → tableau de bord in settings", () => {
  it("trackBBTHint uses tableau de bord", () => {
    expect(getSettingsCopy("fr").tracking.trackBBTHint).toContain("tableau de bord");
  });
  it("activeHint uses tableau de bord", () => {
    expect(getSettingsCopy("fr").symptoms.activeHint).toContain("tableau de bord");
  });
  it("export noData uses tableau de bord", () => {
    expect(getSettingsCopy("fr").export.noData).toContain("tableau de bord");
  });
  it("trackingSaved uses tableau de bord", () => {
    expect(getSettingsCopy("fr").status.trackingSaved).toContain("tableau de bord");
  });
  it("no remaining standalone dashboard in fr settings tracking", () => {
    const tracking = JSON.stringify(getSettingsCopy("fr").tracking);
    // "dashboard" should not appear as a word (tableau de bord replaced it)
    expect(tracking).not.toContain('"dashboard"');
    expect(tracking.toLowerCase()).not.toMatch(/\bdashboard\b/);
  });
});

// ── H. Stats short/long cycle notices — web-parity copy + formal register ──

describe("H stats-copy short/long cycle notices — thresholds and register", () => {
  it("en short/long notices name the 24/45 boundaries and a health professional", () => {
    const en = getStatsCopy("en");
    expect(en.shortCycleNotice).toContain("24");
    expect(en.shortCycleNotice).toContain("health professional");
    expect(en.longCycleNotice).toContain("45");
    expect(en.longCycleNotice).toContain("health professional");
  });
  it("de uses formal Sie and an Ärztin/Arzt referral, names 24/45", () => {
    const de = getStatsCopy("de");
    expect(de.shortCycleNotice).toContain("24");
    expect(de.shortCycleNotice).toContain("besprechen Sie");
    expect(de.shortCycleNotice).toContain("einer Ärztin oder einem Arzt");
    expect(de.longCycleNotice).toContain("45");
    expect(de.longCycleNotice).toContain("besprechen Sie");
    // No informal du-forms reintroduced.
    expect(de.shortCycleNotice).not.toMatch(/\bdu\b/i);
    expect(de.longCycleNotice).not.toMatch(/\bdu\b/i);
  });
  it("fr uses formal vous-forms (vos cycles) and names 24/45", () => {
    const fr = getStatsCopy("fr");
    expect(fr.shortCycleNotice).toContain("24");
    expect(fr.shortCycleNotice).toContain("vos cycles");
    expect(fr.shortCycleNotice).toContain("un médecin");
    expect(fr.longCycleNotice).toContain("45");
    expect(fr.longCycleNotice).toContain("vos cycles");
    // No informal tu/tes-forms reintroduced.
    expect(fr.shortCycleNotice).not.toMatch(/\b(tu|tes)\b/i);
    expect(fr.longCycleNotice).not.toMatch(/\b(tu|tes)\b/i);
  });
  it("ru uses formal Вы and врач terminology", () => {
    const ru = getStatsCopy("ru");
    expect(ru.shortCycleNotice).toContain("Ваших");
    expect(ru.shortCycleNotice).toContain("врачом");
    expect(ru.longCycleNotice).toContain("Ваших");
  });
  it("es uses profesional de la salud (not médico)", () => {
    const es = getStatsCopy("es");
    expect(es.shortCycleNotice).toContain("profesional de la salud");
    expect(es.longCycleNotice).toContain("profesional de la salud");
    expect(es.shortCycleNotice).not.toContain("médico");
    expect(es.longCycleNotice).not.toContain("médico");
  });
});

// ── I. Dashboard prediction disclaimer — web-parity safety copy ─────────────

describe("I dashboard-copy prediction disclaimer — five-locale safety copy", () => {
  it("en states estimates, not medical advice or contraception", () => {
    expect(getDashboardCopy("en").predictionDisclaimer).toBe(
      "These are estimates, not medical advice or a method of contraception.",
    );
  });
  it("de mirrors web (no medizinische Beratung / Verhütungsmethode)", () => {
    const de = getDashboardCopy("de").predictionDisclaimer;
    expect(de).toContain("medizinische Beratung");
    expect(de).toContain("Verhütungsmethode");
  });
  it("fr mirrors web (avis médical / contraception)", () => {
    const fr = getDashboardCopy("fr").predictionDisclaimer;
    expect(fr).toContain("avis médical");
    expect(fr).toContain("contraception");
  });
  it("ru mirrors web (медицинский совет / контрацепции)", () => {
    const ru = getDashboardCopy("ru").predictionDisclaimer;
    expect(ru).toContain("медицинский совет");
    expect(ru).toContain("контрацепции");
  });
  it("es mirrors web (consejo médico / anticonceptivo)", () => {
    const es = getDashboardCopy("es").predictionDisclaimer;
    expect(es).toContain("consejo médico");
    expect(es).toContain("anticonceptivo");
  });
});

// ── G. infoCycleShort threshold — NOT changed (code boundary is 21) ────────

describe("G infoCycleShort — threshold aligned to canonical 24 days", () => {
  it("settings-copy en mentions 24", () => {
    expect(getSettingsCopy("en").cycle.infoCycleShort).toContain("24");
  });
  it("settings-copy de mentions 24", () => {
    expect(getSettingsCopy("de").cycle.infoCycleShort).toContain("24");
  });
  it("settings-copy fr mentions 24", () => {
    expect(getSettingsCopy("fr").cycle.infoCycleShort).toContain("24");
  });
  it("settings-copy ru mentions 24", () => {
    expect(getSettingsCopy("ru").cycle.infoCycleShort).toContain("24");
  });
  it("settings-copy es mentions 24", () => {
    expect(getSettingsCopy("es").cycle.infoCycleShort).toContain("24");
  });
});
