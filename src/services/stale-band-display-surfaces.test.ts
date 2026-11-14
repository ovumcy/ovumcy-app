import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord, type ProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
  resolveDisplayCycleDay,
} from "./cycle-history-service";
import {
  buildPartnerSharedProjectionPayload,
  buildPartnerSharedReadState,
} from "./partner-shared-projection-service";
import { buildStatsViewData } from "./stats-view-service";

// Stale band (web CycleDataStale): the projection rolls its published cycle day
// to 1-7 after the predicted next period, while the dashboard hero shows the raw
// "~N". Stats and the partner snapshot show the raw day too, and the phase
// reads "unknown". Anchor 2026-03-14, length 28: raw day 28 on 2026-04-10 is
// the last non-stale day, raw day 29 on 2026-04-11 the first stale one.
const profile: ProfileRecord = {
  ...createDefaultProfileRecord(),
  lastPeriodStart: "2026-03-14",
  cycleLength: 28,
  periodLength: 5,
};
const period = (date: string): DayLogRecord => ({
  ...createEmptyDayLogRecord(date),
  isPeriod: true,
  cycleStart: true,
});
const records: DayLogRecord[] = [
  period("2025-12-20"),
  period("2026-01-17"),
  period("2026-02-14"),
  period("2026-03-14"),
];
const lastFreshDay = new Date(2026, 3, 10, 10);
const firstStaleDay = new Date(2026, 3, 11, 10);
const lateStaleDay = new Date(2026, 3, 17, 10);

function project(now: Date) {
  return buildCurrentCycleProjection(
    profile,
    buildCycleHistorySummary(profile, records, now),
    records,
    now,
  );
}

function currentPhaseCard(now: Date) {
  const view = buildStatsViewData(
    profile,
    records,
    createDefaultSymptomRecords(),
    now,
    "en",
    {
      advancedFertility: false,
      advancedInsights: false,
      doctorPDF: false,
      extendedReports: false,
      partnerAccess: false,
      reminders: false,
    },
  );
  return view.topCards.find((card) => card.key === "current-phase");
}

function partnerCycleStatus(now: Date) {
  const payload = buildPartnerSharedProjectionPayload({
    accessLevel: "full",
    dayLogs: records,
    generatedAt: now.toISOString(),
    generation: 1,
    grantID: "grant-1",
    ownerAccountID: "owner-1",
    profile,
    symptomRecords: createDefaultSymptomRecords(),
  });
  return buildPartnerSharedReadState(payload, now, "en").cycleStatus;
}

describe("resolveDisplayCycleDay", () => {
  it("returns the rolled day outside the stale band and the raw day inside it", () => {
    const fresh = project(lastFreshDay);
    expect(fresh.isPredictionStale).toBe(false);
    expect(resolveDisplayCycleDay(fresh)).toBe(28);

    const stale = project(firstStaleDay);
    expect(stale.isPredictionStale).toBe(true);
    // The published field keeps the rolled value the shared vectors pin.
    expect(stale.currentCycleDay).toBe(1);
    expect(resolveDisplayCycleDay(stale)).toBe(29);

    const late = project(lateStaleDay);
    expect(late.currentCycleDay).toBe(7);
    expect(resolveDisplayCycleDay(late)).toBe(35);
  });
});

describe("stats in the stale band", () => {
  it("shows the last fresh day as a known phase on its cycle day", () => {
    const card = currentPhaseCard(lastFreshDay);
    expect(card?.description).toBe("Cycle day 28");
    expect(card?.value).not.toContain("Unknown");
  });

  it.each([
    ["first stale day", firstStaleDay, "Cycle day 29"],
    ["late stale day", lateStaleDay, "Cycle day 35"],
  ])("reads the %s as the raw cycle day with an unknown phase", (_label, now, text) => {
    const card = currentPhaseCard(now);
    expect(card?.description).toBe(text);
    expect(card?.value).toContain("Unknown");
  });
});

describe("partner share in the stale band", () => {
  it("shares the rolled day while fresh and the raw day once stale", () => {
    const fresh = partnerCycleStatus(lastFreshDay);
    expect(fresh.state).not.toBe("stale");
    expect(fresh.currentCycleDay).toBe(28);

    const stale = partnerCycleStatus(firstStaleDay);
    expect(stale.state).toBe("stale");
    expect(stale.currentCycleDay).toBe(29);

    expect(partnerCycleStatus(lateStaleDay).currentCycleDay).toBe(35);
  });
});
