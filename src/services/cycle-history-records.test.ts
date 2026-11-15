import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import { loadCalendarScreenState } from "./calendar-view-service";
import { listCycleHistoryRecords, selectWholeClustersFrom } from "./cycle-history-records";
import { collectCycleStartDates } from "./cycle-history-service";
import { loadDashboardScreenState } from "./dashboard-view-service";
import { loadStatsScreenState } from "./stats-view-service";

const NOW = new Date(2026, 5, 20);
const TODAY = "2026-06-20";

const period = (date: string, fields: Partial<DayLogRecord> = {}): DayLogRecord => ({
  ...createEmptyDayLogRecord(date),
  isPeriod: true,
  ...fields,
});

async function seed(profile: Partial<ProfileRecord>, records: DayLogRecord[]) {
  const storage = createVolatileWebAppStorage();
  await storage.writeProfileRecord({
    ...createDefaultProfileRecord(),
    autoPeriodFill: false,
    lastPeriodStart: null,
    ...profile,
  });
  for (const record of records) {
    await storage.writeDayLogRecord(record);
  }
  return storage;
}

function dates(records: readonly DayLogRecord[]): string[] {
  return records.map((record) => record.date);
}

describe("selectWholeClustersFrom", () => {
  it("reaches back to the first day of a run the bound cuts", () => {
    const records = [period("2024-06-19"), period("2024-06-20"), period("2024-07-17")];

    expect(dates(selectWholeClustersFrom(records, "2024-06-20"))).toEqual([
      "2024-06-19",
      "2024-06-20",
      "2024-07-17",
    ]);
  });

  it("follows a chain of period days fewer than five clear days apart", () => {
    const records = [
      period("2024-06-01"),
      period("2024-06-08"),
      period("2024-06-12"),
      { ...createEmptyDayLogRecord("2024-06-14"), notes: "between" },
      period("2024-06-17"),
      period("2024-06-21"),
    ];

    expect(dates(selectWholeClustersFrom(records, "2024-06-20"))).toEqual([
      "2024-06-08",
      "2024-06-12",
      "2024-06-14",
      "2024-06-17",
      "2024-06-21",
    ]);
  });

  it("keeps the bound when five clear days separate the earlier period", () => {
    const records = [period("2024-06-14"), period("2024-06-20"), period("2024-06-21")];

    expect(dates(selectWholeClustersFrom(records, "2024-06-20"))).toEqual([
      "2024-06-20",
      "2024-06-21",
    ]);
  });

  it("keeps the bound when no period day follows it closely", () => {
    const records = [
      period("2024-06-18"),
      period("2024-06-19"),
      { ...createEmptyDayLogRecord("2024-06-20"), notes: "after" },
    ];

    expect(dates(selectWholeClustersFrom(records, "2024-06-20"))).toEqual(["2024-06-20"]);
  });
});

describe("shared cycle history across surfaces", () => {
  it("counts a run straddling the two-year bound as one cycle on every surface", async () => {
    const records = [
      period("2024-06-19"),
      period("2024-06-20"),
      period("2024-07-17"),
      period("2024-07-18"),
      period("2026-06-01"),
      period("2026-06-02"),
    ];
    const storage = await seed({}, records);
    const profile = await storage.readProfileRecord();
    const allStarts = collectCycleStartDates(profile, records, TODAY);

    const dashboard = await loadDashboardScreenState(storage, NOW);
    const stats = await loadStatsScreenState(storage, NOW);
    const history = await listCycleHistoryRecords(storage, NOW);

    expect(allStarts).toEqual(["2024-06-19", "2024-07-17", "2026-06-01"]);
    expect(collectCycleStartDates(profile, dashboard.historyRecords, TODAY)).toEqual(allStarts);
    expect(collectCycleStartDates(profile, stats.records, TODAY)).toEqual(allStarts);
    expect(collectCycleStartDates(profile, history, TODAY)).toEqual(allStarts);
  });

  it("paints a month paged ahead from the same cycles as the dashboard", async () => {
    const storage = await seed({}, [
      period("2026-04-06"),
      period("2026-04-07"),
      period("2026-05-04"),
      period("2026-05-05"),
      period("2026-06-01"),
      period("2026-06-02"),
    ]);

    const calendar = await loadCalendarScreenState(storage, NOW, "2026-09");
    const predicted = calendar.viewData.days
      .filter((day) => day.stateKey === "predicted")
      .map((day) => day.date);

    expect(predicted).toContain("2026-09-21");
  });

  it("keeps the pregnancy pause on a calendar month paged past the grid window", async () => {
    const storage = await seed({ lastPeriodStart: "2026-06-01" }, [
      period("2026-06-01", { cycleStart: true }),
      period("2026-06-02"),
      { ...createEmptyDayLogRecord("2026-06-15"), pregnancyTest: "positive" },
    ]);

    for (const month of ["2026-07", "2026-10", "2027-03"]) {
      const calendar = await loadCalendarScreenState(storage, NOW, month);
      const painted = calendar.viewData.days.filter(
        (day) => day.stateKey !== "neutral" && day.stateKey !== "period",
      );
      expect({ month, painted: painted.map((day) => day.date) }).toEqual({
        month,
        painted: [],
      });
    }
  });
});
