import { getStatsCopy } from "../i18n/stats-copy";
import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import type { StatsCycleHistorySummary } from "../models/stats";
import { createDefaultSymptomRecords } from "../models/symptom";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";
import {
  buildCycleLengthTrendStatement,
  buildStatsHistoryStatements,
  buildSymptomPhaseRecurrenceStatements,
} from "./stats-history-statements-service";

// Four completed 28-day cycles: period days 1-5, ovulation on day 14.
const STARTS = ["2026-01-01", "2026-01-29", "2026-02-26", "2026-03-26", "2026-04-23"];

function dayOf(cycleIndex: number, cycleDay: number): string {
  return formatLocalDate(addDays(parseLocalDate(STARTS[cycleIndex]!)!, cycleDay - 1));
}

function buildRecords(
  logs: { cycle: number; day: number; symptomIDs: string[] }[],
): DayLogRecord[] {
  const byDate = new Map<string, DayLogRecord>();
  STARTS.forEach((_, cycle) => {
    for (let day = 1; day <= 5; day += 1) {
      byDate.set(dayOf(cycle, day), {
        ...createEmptyDayLogRecord(dayOf(cycle, day)),
        isPeriod: true,
        cycleStart: day === 1,
      });
    }
  });
  for (const log of logs) {
    const date = dayOf(log.cycle, log.day);
    const record = byDate.get(date) ?? createEmptyDayLogRecord(date);
    byDate.set(date, { ...record, symptomIDs: log.symptomIDs });
  }
  return [...byDate.values()];
}

const symptoms = createDefaultSymptomRecords();

describe("buildCycleLengthTrendStatement", () => {
  it.each([
    [[28, 28, 28], "steady", 0, 3],
    [[30, 30, 30, 26, 26, 26], "shorter", 4, 6],
    [[26, 27, 30, 31, 0, -1], "longer", 4, 4],
    [[40, 40, 28, 28, 28, 28, 28, 28], "steady", 0, 6],
    [[28, 40, 30], "longer", 2, 3],
  ] as const)("%j → %s by %i over %i", (lengths, direction, days, windowSize) => {
    expect(buildCycleLengthTrendStatement(lengths)).toEqual({
      kind: "cycle_length_trend",
      direction,
      days,
      windowSize,
    });
  });

  it("needs three completed cycles", () => {
    expect(buildCycleLengthTrendStatement([28, 0, 30])).toBeNull();
  });
});

describe("buildSymptomPhaseRecurrenceStatements", () => {
  it("keeps strict-majority recurrences, strongest first, capped at three", () => {
    const records = buildRecords([
      ...[0, 1, 2].map((cycle) => ({ cycle, day: 1, symptomIDs: ["cramps", "bloating", "ghost"] })),
      { cycle: 0, day: 8, symptomIDs: ["spotting", "fatigue"] },
      { cycle: 1, day: 8, symptomIDs: ["spotting", "fatigue", "fatigue"] },
      { cycle: 2, day: 8, symptomIDs: ["spotting"] },
      ...[0, 1, 2].map((cycle) => ({ cycle, day: 20, symptomIDs: ["headache", "acne"] })),
      { cycle: 3, day: 20, symptomIDs: ["mood_swings"] },
    ]);

    const statements = buildSymptomPhaseRecurrenceStatements(records, symptoms);

    expect(
      statements.map(({ id, phase, count, total }) => `${id}:${phase}:${count}/${total}`),
    ).toEqual([
      "spotting:follicular:3/3",
      "bloating:menstrual:3/4",
      "cramps:menstrual:3/4",
    ]);
    expect(statements[0]).toEqual(
      expect.objectContaining({ kind: "symptom_phase_recurrence", label: "Spotting", icon: "🩹" }),
    );
  });

  it("orders equal ratios by phase before label and drops a bare half", () => {
    const records = buildRecords([
      ...[0, 1, 2].map((cycle) => ({ cycle, day: 2, symptomIDs: ["headache"] })),
      ...[0, 1, 2].map((cycle) => ({ cycle, day: 20, symptomIDs: ["bloating"] })),
      { cycle: 3, day: 20, symptomIDs: [] },
      ...[0, 1].map((cycle) => ({ cycle, day: 14, symptomIDs: ["acne"] })),
      ...[2, 3].map((cycle) => ({ cycle, day: 14, symptomIDs: [] })),
    ]);

    expect(
      buildSymptomPhaseRecurrenceStatements(records, symptoms).map(
        ({ id, phase }) => `${id}:${phase}`,
      ),
    ).toEqual(["headache:menstrual", "bloating:luteal"]);
  });

  it("needs three completed cycles and a symptom catalogue", () => {
    const logs = [0, 1, 2].map((cycle) => ({ cycle, day: 1, symptomIDs: ["cramps"] }));
    expect(buildSymptomPhaseRecurrenceStatements(buildRecords(logs), [])).toEqual([]);
    expect(
      buildSymptomPhaseRecurrenceStatements(
        buildRecords(logs).filter((record) => record.date < STARTS[3]!),
        symptoms,
      ),
    ).toEqual([]);
  });
});

describe("buildStatsHistoryStatements", () => {
  const history = (lengths: number[]) =>
    ({
      completedCycles: lengths.map((cycleLength) => ({ cycleLength })),
    }) as unknown as StatsCycleHistorySummary;
  const records = buildRecords(
    [0, 1, 2].map((cycle) => ({ cycle, day: 1, symptomIDs: ["cramps"] })),
  );

  it("puts the trend before the recurrences", () => {
    expect(
      buildStatsHistoryStatements(history([28, 28, 28, 28]), records, symptoms).map(
        (statement) => statement.kind,
      ),
    ).toEqual(["cycle_length_trend", "symptom_phase_recurrence"]);
  });

  it("omits the trend when the window is too short", () => {
    expect(
      buildStatsHistoryStatements(history([28, 28]), records, symptoms).map(
        (statement) => statement.kind,
      ),
    ).toEqual(["symptom_phase_recurrence"]);
  });
});

describe("history statement copy", () => {
  it("renders English sentences", () => {
    const copy = getStatsCopy("en");
    expect(copy.statementCycleTrendShorter(1)).toBe(
      "Your recent cycles are about 1 day shorter than the earlier ones.",
    );
    expect(copy.statementCycleTrendSteady(1)).toBe(
      "Your cycle length has stayed steady across 1 completed cycle.",
    );
    expect(copy.statementSymptomRecurrence(1, 1)).toBe("Logged in 1 of 1 recorded phase.");
  });

  it("renders Russian plural forms", () => {
    const copy = getStatsCopy("ru");
    expect(copy.statementCycleTrendLonger(2)).toBe(
      "Недавние циклы примерно на 2 дня длиннее предыдущих.",
    );
    expect(copy.statementCycleTrendWindow(5)).toBe("Сравнили 5 завершённых циклов.");
    expect(copy.statementSymptomRecurrence(3, 4)).toBe("Отмечено в 3 из 4 фаз с записями.");
  });

  it.each(["en", "de", "fr", "ru", "es", "it"])(
    "%s fills every count into singular and plural forms",
    (locale) => {
      const copy = getStatsCopy(locale);
      expect(copy.historyStatementsTitle).not.toBe("");
      expect(copy.historyStatementsSubtitle).not.toBe("");
      for (const count of [1, 2, 5]) {
        for (const sentence of [
          copy.statementCycleTrendShorter(count),
          copy.statementCycleTrendLonger(count),
          copy.statementCycleTrendSteady(count),
          copy.statementCycleTrendWindow(count),
          copy.statementSymptomRecurrence(1, count),
        ]) {
          expect(sentence).toContain(String(count));
        }
      }
      expect(copy.statementCycleTrendShorter(1)).not.toBe(
        copy.statementCycleTrendShorter(2).replace("2", "1"),
      );
    },
  );
});
