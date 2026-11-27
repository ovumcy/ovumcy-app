import { getDashboardCopy } from "../i18n/dashboard-copy";
import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { FERTILITY_MINIMUM_CYCLES } from "../models/stats";
import { completedCycleHistory } from "./__fixtures__/completed-cycles";
import { buildCalendarViewData } from "./calendar-view-service";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
} from "./cycle-history-service";
import { predictCycleWindow } from "./cycle-prediction-policy";
import { resolveDaySaveMessageKey } from "./dashboard-view-service";
import { buildLocalReminderPlans } from "./local-reminder-plan-service";

// Web FertilityProjectionSuppressed, read from the one projection every
// surface shares. Cycle length 28 throughout, running cycle opened 2026-03-05.
const CURRENT_START = "2026-03-05";

function profileOf(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    ...createDefaultProfileRecord(),
    cycleLength: 28,
    periodLength: 5,
    dailyLogReminderEnabled: true,
    upcomingPeriodReminderEnabled: true,
    fertileWindowReminderEnabled: true,
    reminderTime: "20:00",
    ...overrides,
  };
}

function periodRun(start: string, days: number): DayLogRecord[] {
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(`${start}T00:00:00`);
    date.setDate(date.getDate() + offset);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return {
      ...createEmptyDayLogRecord(value),
      isPeriod: true,
      cycleStart: offset === 0,
      flow: "medium" as const,
    };
  });
}

function recordsWith(completed: number, extra: DayLogRecord[] = []): DayLogRecord[] {
  return [
    ...completedCycleHistory({ currentStart: CURRENT_START, completed }),
    ...periodRun(CURRENT_START, 5),
    ...extra,
  ];
}

function project(profile: ProfileRecord, records: DayLogRecord[], now: Date) {
  const history = buildCycleHistorySummary(profile, records, now);
  return buildCurrentCycleProjection(profile, history, records, now);
}

const MARCH_12 = new Date(2026, 2, 12, 10, 0, 0, 0);

describe("fertility gate on the shared projection", () => {
  it("withholds the fertility half and keeps the next period before three completed cycles", () => {
    expect(FERTILITY_MINIMUM_CYCLES).toBe(3);
    const control = project(profileOf(), recordsWith(3), MARCH_12);
    expect(control.fertilitySuppressed).toBe(false);
    expect(control.fertilityAwaiting).toBeNull();
    expect(control.ovulationDate).not.toBeNull();
    expect(control.upcomingOvulationDate).not.toBeNull();

    for (const completed of [0, 1, 2]) {
      const projection = project(profileOf(), recordsWith(completed), MARCH_12);
      expect(projection.fertilitySuppressed).toBe(true);
      expect(projection.fertilityAwaiting).toBe(completed === 0 ? "first_cycle" : "more_cycles");
      expect(projection.ovulationDate).toBeNull();
      expect(projection.upcomingOvulationDate).toBeNull();
      expect(projection.upcomingOvulationWindowStartDate ?? null).toBeNull();
      expect(projection.currentPhase).toBe("unknown");
      // The next-period estimate rests on the recorded start and stays.
      expect(projection.nextPeriodDate).toBe("2026-04-02");
    }
  });

  it("withholds the fertility half while a period day logged today is not a cycle start", () => {
    // Two period days, five clear days, then a spotting day today: the boundary
    // rule opens no cycle on it, so the running projection and the log disagree.
    const base = [
      ...completedCycleHistory({ currentStart: CURRENT_START }),
      ...periodRun(CURRENT_START, 2),
    ];
    const control = project(profileOf(), base, MARCH_12);
    expect(control.fertilitySuppressed).toBe(false);

    const spotting: DayLogRecord = {
      ...createEmptyDayLogRecord("2026-03-12"),
      isPeriod: true,
      flow: "spotting",
    };
    const projection = project(profileOf(), [...base, spotting], MARCH_12);
    expect(projection.cycleAnchorDate).toBe(CURRENT_START);
    expect(projection.fertilitySuppressed).toBe(true);
    expect(projection.fertilityAwaiting).toBeNull();
    expect(projection.ovulationDate).toBeNull();
    expect(projection.upcomingOvulationDate).toBeNull();
    expect(projection.nextPeriodDate).toBe("2026-04-02");
  });

  it("withholds every date for an irregular cycle with fewer than three completed cycles", () => {
    const irregular = profileOf({ irregularCycle: true });
    for (const completed of [0, 1, 2]) {
      const projection = project(irregular, recordsWith(completed), MARCH_12);
      expect(projection.awaitingIrregularHistory).toBe(true);
      expect(projection.fertilitySuppressed).toBe(true);
      expect(projection.nextPeriodDate).toBeNull();
      expect(projection.nextPeriodWindowStartDate).toBeNull();
      expect(projection.ovulationDate).toBeNull();
      expect(projection.upcomingOvulationDate).toBeNull();
    }
    const control = project(irregular, recordsWith(3), MARCH_12);
    expect(control.awaitingIrregularHistory).toBe(false);
    expect(control.nextPeriodDate).not.toBeNull();
  });
});

describe("fertility gate on the day-save message", () => {
  it("makes no fertile claim in the day-save message while the fertility half is withheld", () => {
    const profile = profileOf();
    const window = predictCycleWindow(CURRENT_START, 28, 14);
    const fertileDay = window.fertilityStart ?? "";
    expect(fertileDay).not.toBe("");

    const open = project(profile, recordsWith(3), MARCH_12);
    expect(resolveDaySaveMessageKey(fertileDay, profile, open)).toBe("fertile");

    const floor = project(profile, recordsWith(2), MARCH_12);
    expect(resolveDaySaveMessageKey(fertileDay, profile, floor)).toBe("neutral");

    // The stale band: the same anchor-recomputed window lies behind the cycle.
    const stale = project(profile, recordsWith(3), new Date(2026, 3, 3, 10));
    expect(stale.isPredictionStale).toBe(true);
    expect(resolveDaySaveMessageKey(fertileDay, profile, stale)).toBe("neutral");
  });
});

describe("fertility gate on the dashboard copy", () => {
  it("renders the awaiting copy in all six locales with Russian plural forms", () => {
    for (const locale of ["en", "de", "fr", "ru", "es", "it"]) {
      const copy = getDashboardCopy(locale);
      expect(copy.fertilityAwaitingFirstCycle.length).toBeGreaterThan(20);
      expect(copy.fertilityAwaitingMoreCycles(FERTILITY_MINIMUM_CYCLES)).toContain("3");
    }
    const ru = getDashboardCopy("ru").fertilityAwaitingMoreCycles;
    expect(ru(1)).toContain("1 завершённого цикла");
    expect(ru(3)).toContain("3 завершённых цикла");
    expect(ru(5)).toContain("5 завершённых циклов");
    expect(ru(11)).toContain("11 завершённых циклов");
    expect(ru(22)).toContain("22 завершённых цикла");
  });
});

describe("fertility gate on the calendar", () => {
  function stateKeys(profile: ProfileRecord, records: DayLogRecord[]): Map<string, string> {
    const keys = new Map<string, string>();
    for (const month of [2, 3, 4, 5]) {
      const viewData = buildCalendarViewData(
        profile,
        records,
        MARCH_12,
        new Date(2026, month, 1),
        "2026-03-12",
      );
      for (const day of viewData.days) {
        keys.set(day.date, day.stateKey);
      }
    }
    return keys;
  }
  const FERTILE_KEYS = new Set([
    "pre_fertile",
    "fertility_edge",
    "fertility_peak",
    "ovulation",
    "ovulation_tentative",
  ]);

  it("paints predicted periods but no fertile window or ovulation day before three completed cycles", () => {
    const open = stateKeys(profileOf(), recordsWith(3));
    expect([...open.values()].some((key) => FERTILE_KEYS.has(key))).toBe(true);

    for (const completed of [0, 1, 2]) {
      const keys = stateKeys(profileOf(), recordsWith(completed));
      expect([...keys.values()].filter((key) => FERTILE_KEYS.has(key))).toEqual([]);
      expect(keys.get("2026-04-02")).toBe("predicted");
      expect(keys.get("2026-04-30")).toBe("predicted");
    }
  });

  it("chains a fertile window to the next cycle only and keeps the periods running", () => {
    const keys = stateKeys(profileOf(), recordsWith(3));
    // Running cycle (03-05) and N+1 (04-02) carry an ovulation day; N+2
    // (04-30, ovulation would be 05-13) carries a period but no window.
    expect(keys.get("2026-03-18")).toBe("ovulation");
    expect(keys.get("2026-04-15")).toBe("ovulation");
    expect(keys.get("2026-04-30")).toBe("predicted");
    expect(keys.get("2026-05-13")).not.toBe("ovulation");
    expect(
      [...keys.entries()].filter(
        ([date, key]) => date >= "2026-04-30" && FERTILE_KEYS.has(key),
      ),
    ).toEqual([]);
  });

  it("paints nothing for an irregular cycle with fewer than three completed cycles", () => {
    const keys = stateKeys(profileOf({ irregularCycle: true }), recordsWith(2));
    expect(
      [...keys.values()].filter((key) => FERTILE_KEYS.has(key) || key === "predicted"),
    ).toEqual([]);
  });
});

describe("fertility gate on device reminders", () => {
  function kinds(profile: ProfileRecord, records: DayLogRecord[], now: Date) {
    return buildLocalReminderPlans(profile, records, now, "en").map((plan) => plan.kind);
  }

  it("plans no fertile reminder under the floor or in the stale band and keeps the period reminder", () => {
    expect(kinds(profileOf(), recordsWith(3), MARCH_12)).toEqual([
      "daily_log",
      "upcoming_period",
      "fertile_window",
    ]);
    // Under the floor the period estimate stays, the fertile reminder goes.
    expect(kinds(profileOf(), recordsWith(2), MARCH_12)).toEqual([
      "daily_log",
      "upcoming_period",
    ]);
    // Stale band: the window recomputed from the anchor is behind the owner.
    expect(kinds(profileOf(), recordsWith(3), new Date(2026, 3, 3, 10))).not.toContain(
      "fertile_window",
    );
  });

  it("plans no period or fertile reminder for an irregular cycle with fewer than three completed cycles", () => {
    expect(kinds(profileOf({ irregularCycle: true }), recordsWith(2), MARCH_12)).toEqual([
      "daily_log",
    ]);
    expect(kinds(profileOf({ irregularCycle: true }), recordsWith(3), MARCH_12)).toContain(
      "upcoming_period",
    );
  });
});
