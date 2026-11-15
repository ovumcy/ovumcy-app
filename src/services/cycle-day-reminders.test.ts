import { createEmptyDayLogRecord } from "../models/day-log";
import { createPregnancyRecord } from "../models/pregnancy";
import {
  createDefaultProfileRecord,
  type CycleDayReminder,
} from "../models/profile";
import { getReminderCopy } from "../i18n/reminder-copy";
import {
  addCycleDayReminderRule,
  areCycleDayRemindersEqual,
  createCycleDayReminderID,
  normalizeCycleDayReminders,
  patchCycleDayReminderRule,
  removeCycleDayReminderRule,
} from "./cycle-day-reminder-policy";
import { buildLocalReminderPlans } from "./local-reminder-plan-service";
import { withoutStoredCycleStartRepointState } from "./stored-cycle-start-repoint-service";

function rule(overrides: Partial<CycleDayReminder> = {}): CycleDayReminder {
  return {
    id: "cdr_a",
    cycleDay: 14,
    remindAtHour: 9,
    label: "",
    showLabel: false,
    ...overrides,
  };
}

// Two logged cycle starts (28 days apart); the running cycle opens 2026-03-29.
const records = [
  { ...createEmptyDayLogRecord("2026-03-01"), isPeriod: true, cycleStart: true },
  { ...createEmptyDayLogRecord("2026-03-29"), isPeriod: true, cycleStart: true },
];
const now = new Date(2026, 3, 5, 10, 0, 0, 0); // cycle day 8

function plansFor(
  rules: CycleDayReminder[],
  options: {
    dayLogs?: typeof records;
    when?: Date;
    pregnancy?: ReturnType<typeof createPregnancyRecord> | null;
    profile?: Partial<ReturnType<typeof createDefaultProfileRecord>>;
  } = {},
) {
  return buildLocalReminderPlans(
    { ...createDefaultProfileRecord(), cycleDayReminders: rules, ...options.profile },
    options.dayLogs ?? records,
    options.when ?? now,
    "en",
    undefined,
    options.pregnancy ?? null,
  ).filter((plan) => plan.kind === "cycle_day");
}

describe("cycle-day reminder rule validation", () => {
  it("accepts the bounds and defaults an absent hour to 09:00", () => {
    expect(
      normalizeCycleDayReminders([
        { id: "lo", cycleDay: 1, remindAtHour: 0, label: "", showLabel: false },
        { id: "hi", cycleDay: 90, remindAtHour: 23, label: "x".repeat(64), showLabel: true },
        { id: "nohour", cycleDay: 5 },
      ]).map((entry) => [entry.id, entry.cycleDay, entry.remindAtHour]),
    ).toEqual([
      ["lo", 1, 0],
      ["hi", 90, 23],
      ["nohour", 5, 9],
    ]);
  });

  it.each([
    ["day 0", { cycleDay: 0 }],
    ["day 91", { cycleDay: 91 }],
    ["fractional day", { cycleDay: 1.5 }],
    ["string day", { cycleDay: "14" }],
    ["hour -1", { remindAtHour: -1 }],
    ["hour 24", { remindAtHour: 24 }],
    ["label of 65 characters", { label: "x".repeat(65) }],
    ["label with a bidi override", { label: "a‮b" }],
    ["label with a control character", { label: "a\nb" }],
    ["label with an Arabic letter mark", { label: "a؜b" }],
    ["label with a Mongolian vowel separator", { label: "a᠎b" }],
    ["label with a line separator", { label: "a b" }],
    ["label with an interlinear annotation", { label: "a￹b" }],
    ["label with a tag character", { label: "a\u{e0041}b" }],
    ["label of a Hangul filler", { label: "ㅤ" }],
    ["label of a blank braille pattern", { label: "⠀" }],
    ["label with a lone surrogate", { label: "a\ud800b" }],
    ["label with a doubled joiner", { label: "a‍‍b" }],
    ["label of variation selectors around a joiner", { label: "️‍️" }],
    ["label of base-less combining marks", { label: "́‍́" }],
    ["label of a lone variation selector", { label: "\u{e0100}" }],
    ["label with a joiner next to an ideographic space", { label: "a　‍b" }],
    ["label with a joiner next to a space", { label: "a ‍b" }],
    ["label with a joiner next to a zero-width space", { label: "a​‍b" }],
    ["non-string label", { label: 7 }],
    ["id with a space", { id: "a b" }],
    ["empty id", { id: "" }],
    ["id of 65 characters", { id: "i".repeat(65) }],
  ])("drops a rule with %s", (_name, overrides) => {
    expect(normalizeCycleDayReminders([{ ...rule(), ...overrides }])).toEqual([]);
  });

  it.each([
    ["an emoji ZWJ sequence", "\u{1f469}‍⚕️ check"],
    ["an emoji sequence after a variation selector", "\u{1f3f3}️‍\u{1f308}"],
    ["a Persian word with a non-joiner", "می‌خواهم"],
  ])("keeps a label with %s", (_name, label) => {
    expect(normalizeCycleDayReminders([rule({ label })])).toEqual([rule({ label })]);
  });

  it("trims joiners at either end like spaces", () => {
    expect(
      normalizeCycleDayReminders([
        rule({ id: "a", label: "‍ab‌ " }),
        rule({ id: "b", label: "‍", showLabel: true }),
      ]).map((entry) => [entry.label, entry.showLabel]),
    ).toEqual([
      ["ab", false],
      ["", false],
    ]);
  });

  it("keeps joiners typed between visible characters and drops misplaced ones while editing", () => {
    const rules = [rule({ id: "p" })];
    const patchLabel = (label: string) =>
      patchCycleDayReminderRule(rules, "p", { label })[0]!.label;

    expect(patchLabel("\u{1f469}‍⚕️")).toBe("\u{1f469}‍⚕️");
    expect(patchLabel("می‌")).toBe("می‌");
    expect(patchLabel("‍a‍‍b")).toBe("a‍b");
    expect(patchLabel("a‍ b")).toBe("a b");
    expect(patchLabel("a ‍b")).toBe("a b");
    // a typed trailing joiner is trimmed when the rule is saved
    expect(
      normalizeCycleDayReminders([rule({ label: patchLabel("می‌") })])[0]!.label,
    ).toBe("می");
  });

  it("trims the label and refuses showLabel without one", () => {
    expect(
      normalizeCycleDayReminders([
        rule({ id: "a", label: "  pill  ", showLabel: true }),
        rule({ id: "b", label: "   ", showLabel: true }),
      ]),
    ).toEqual([
      rule({ id: "a", label: "pill", showLabel: true }),
      rule({ id: "b", label: "", showLabel: false }),
    ]);
  });

  it("keeps at most ten rules and drops a repeated id", () => {
    const many = Array.from({ length: 14 }, (_, index) => rule({ id: `r${index}` }));
    expect(normalizeCycleDayReminders(many)).toHaveLength(10);
    expect(normalizeCycleDayReminders([rule(), rule()])).toHaveLength(1);
  });

  it("reads a non-list as no rules", () => {
    expect(normalizeCycleDayReminders(undefined)).toEqual([]);
    expect(normalizeCycleDayReminders({ 0: rule() })).toEqual([]);
    expect(normalizeCycleDayReminders([null, 3, "x", []])).toEqual([]);
  });

  it("editor operations stay in bounds and cap the list at ten", () => {
    let rules: CycleDayReminder[] = [];
    for (let index = 0; index < 12; index += 1) {
      rules = addCycleDayReminderRule(rules);
    }
    expect(rules).toHaveLength(10);
    expect(new Set(rules.map((entry) => entry.id)).size).toBe(10);

    const id = rules[0]!.id;
    const patched = patchCycleDayReminderRule(rules, id, {
      cycleDay: 400,
      remindAtHour: 99,
      label: `a‮${"y".repeat(80)}`,
      showLabel: true,
    })[0]!;
    expect(patched).toMatchObject({ cycleDay: 90, remindAtHour: 23, showLabel: true });
    expect(Array.from(patched.label)).toHaveLength(64);
    expect(patched.label).not.toContain("‮");
    expect(
      patchCycleDayReminderRule(rules, id, { label: "", showLabel: true })[0]!.showLabel,
    ).toBe(false);
    expect(removeCycleDayReminderRule(rules, id)).toHaveLength(9);
    expect(areCycleDayRemindersEqual(rules, [...rules])).toBe(true);
    expect(areCycleDayRemindersEqual(rules, removeCycleDayReminderRule(rules, id))).toBe(false);
  });
});

describe("cycle-day reminder planning", () => {
  it("plans one local notification on the day the running cycle reaches day N, at the rule hour", () => {
    const plans = plansFor([rule({ cycleDay: 14, remindAtHour: 7 })]);

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      kind: "cycle_day",
      trigger: { type: "once", at: new Date(2026, 3, 11, 7, 0, 0, 0) },
    });
  });

  it("plans nothing when the day or hour already passed", () => {
    expect(plansFor([rule({ cycleDay: 8, remindAtHour: 9 })])).toEqual([]);
    expect(plansFor([rule({ cycleDay: 3 })])).toEqual([]);
    expect(plansFor([rule({ cycleDay: 8, remindAtHour: 11 })])).toHaveLength(1);
  });

  it("uses a generic body by default and the label only when that rule opts in", () => {
    const plans = plansFor([
      rule({ id: "hidden", cycleDay: 12, label: "Secret pill", showLabel: false }),
      rule({ id: "shown", cycleDay: 13, label: "Take vitamin D", showLabel: true }),
    ]);

    expect(plans).toHaveLength(2);
    expect(plans[0]!.body).toBe(getReminderCopy("en").cycleDayBody);
    expect(plans[1]!.body).toBe("Take vitamin D");
    const serializedHidden = JSON.stringify(plans[0]);
    expect(serializedHidden).not.toContain("Secret pill");
    expect(serializedHidden).not.toContain("hidden");
    // The label reaches nothing but the opted-in body.
    expect(JSON.stringify({ ...plans[1], body: "" })).not.toContain("vitamin");
  });

  it("is withheld under a positive pregnancy test (paused predictions)", () => {
    const paused = [
      ...records,
      { ...createEmptyDayLogRecord("2026-04-03"), pregnancyTest: "positive" as const },
    ];
    expect(plansFor([rule()])).toHaveLength(1);
    expect(plansFor([rule()], { dayLogs: paused as never })).toEqual([]);
  });

  it("is withheld while a pregnancy record is active", () => {
    const active = createPregnancyRecord({
      edd: "2026-12-20",
      eddBasis: "lmp",
      lmpDate: "2026-03-15",
      startedAt: "2026-04-01",
    });
    expect(plansFor([rule()], { pregnancy: active })).toEqual([]);
  });

  it("is withheld past the overdue gate and in the stale band", () => {
    // Every day up to the usual length (28) is already behind a stale cycle, so
    // the stale-band gate and the length bound withhold the same rules; the
    // assertion pins the outcome whichever of them holds it.
    const dayRules = [1, 20, 28, 40].map((cycleDay) => rule({ id: `d${cycleDay}`, cycleDay }));
    // Day 36 (> 28): stale band, web holds the reminder.
    expect(plansFor(dayRules, { when: new Date(2026, 4, 3, 10) })).toEqual([]);
    // Day 40 (> 28 + 7): overdue gate.
    expect(plansFor(dayRules, { when: new Date(2026, 4, 7, 10) })).toEqual([]);
  });

  it("is withheld for a day beyond the owner's usual cycle length", () => {
    expect(plansFor([rule({ cycleDay: 29 })])).toEqual([]);
    expect(plansFor([rule({ cycleDay: 28 })])).toHaveLength(1);
  });

  it("is withheld in unpredictable (facts-only) mode", () => {
    expect(plansFor([rule()], { profile: { unpredictableCycle: true } })).toEqual([]);
  });

  it("holds every rule until the cycle start is settled", () => {
    const lone = [
      ...records.slice(0, 1),
      { ...createEmptyDayLogRecord("2026-04-05"), isPeriod: true },
    ];
    const todayNow = new Date(2026, 3, 5, 6, 0, 0, 0);
    const dayRules = [
      rule({ id: "d2", cycleDay: 2 }),
      rule({ id: "d3", cycleDay: 3 }),
      rule({ id: "d14", cycleDay: 14 }),
    ];
    // A lone unmarked bleeding day today is provisional: withdrawn the day
    // after, it would leave rules scheduled on days the cycle never reaches.
    expect(plansFor(dayRules, { dayLogs: lone, when: todayNow })).toEqual([]);
    // An explicit start mark settles it.
    const marked = [
      ...records.slice(0, 1),
      { ...createEmptyDayLogRecord("2026-04-05"), isPeriod: true, cycleStart: true },
    ];
    expect(plansFor(dayRules, { dayLogs: marked, when: todayNow })).toHaveLength(3);
  });

  it("counts from the stored cycle start when no day is logged", () => {
    expect(
      plansFor([rule({ cycleDay: 14 })], {
        dayLogs: [],
        profile: { lastPeriodStart: "2026-03-29" },
      }),
    ).toHaveLength(1);
  });

  it("re-validates stored rules at plan time", () => {
    expect(
      plansFor([rule({ cycleDay: 500 }), rule({ id: "ok", cycleDay: 14 })] as CycleDayReminder[]),
    ).toHaveLength(1);
  });
});

describe("cycle-day reminders travel with the profile", () => {
  it("survives the JSON export profile projection", () => {
    const profile = { ...createDefaultProfileRecord(), cycleDayReminders: [rule()] };
    expect(withoutStoredCycleStartRepointState(profile).cycleDayReminders).toEqual([rule()]);
  });
});

describe("cycle-day reminder ids", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");

  afterEach(() => {
    if (original) {
      Object.defineProperty(globalThis, "crypto", original);
    }
  });

  function stubCrypto(value: unknown): void {
    Object.defineProperty(globalThis, "crypto", { configurable: true, value });
  }

  it("uses a random UUID when the runtime has one", () => {
    stubCrypto({ randomUUID: () => "11111111-2222-3333-4444-555555555555" });

    expect(createCycleDayReminderID()).toBe("cdr_11111111-2222-3333-4444-555555555555");
  });

  it.each([
    ["no crypto object", undefined],
    ["crypto without randomUUID", {}],
  ])("falls back to a time-and-counter id with %s", (_label, value) => {
    stubCrypto(value);

    const first = createCycleDayReminderID();
    const second = createCycleDayReminderID();

    expect(first).toMatch(/^cdr_[0-9a-z]+_[0-9a-z]+$/);
    expect(second).not.toBe(first);
  });
});
