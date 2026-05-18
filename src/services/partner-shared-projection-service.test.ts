import {
  buildPartnerSharedProjectionPayload,
  buildPartnerSharedReadState,
} from "./partner-shared-projection-service";
import { createDefaultProfileRecord } from "../models/profile";
import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultSymptomRecords } from "../models/symptom";

describe("partner-shared-projection-service", () => {
  it("redacts detailed day fields for summary access", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      hideNotes: true,
      hideSexChip: true,
      trackBBT: false,
      trackCervicalMucus: false,
    };
    const record = {
      ...createEmptyDayLogRecord("2026-04-05"),
      isPeriod: true,
      cycleStart: true,
      flow: "medium" as const,
      mood: 4,
      sexActivity: "unprotected" as const,
      bbt: 36.7,
      cervicalMucus: "eggwhite" as const,
      lhTest: "peak" as const,
      symptomIDs: ["cramps"],
      notes: "private note",
    };

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "summary",
      dayLogs: [record],
      generatedAt: "2026-04-05T08:00:00.000Z",
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: createDefaultSymptomRecords(),
    });

    expect(projection.dayLogs).toHaveLength(1);
    expect(projection.dayLogs[0]).toEqual(
      expect.objectContaining({
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "none",
        symptomIDs: [],
        notes: "",
      }),
    );
    expect(projection.symptomRecords).toEqual([]);
  });

  it("keeps full history but respects owner privacy toggles", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      hideNotes: true,
      hideSexChip: true,
      trackBBT: false,
      trackCervicalMucus: false,
    };
    const record = {
      ...createEmptyDayLogRecord("2026-04-05"),
      isPeriod: true,
      flow: "medium" as const,
      mood: 4,
      sexActivity: "unprotected" as const,
      bbt: 36.7,
      cervicalMucus: "eggwhite" as const,
      lhTest: "peak" as const,
      symptomIDs: ["cramps"],
      notes: "private note",
    };

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "full",
      dayLogs: [record],
      generatedAt: "2026-04-05T08:00:00.000Z",
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: createDefaultSymptomRecords(),
    });

    expect(projection.dayLogs[0]).toEqual(
      expect.objectContaining({
        mood: 4,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        lhTest: "peak",
        notes: "",
      }),
    );
    expect(projection.symptomRecords).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "cramps" })]),
    );
  });

  it("builds shared read metrics from the redacted projection", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-04-01",
    };
    const records = [
      {
        ...createEmptyDayLogRecord("2026-04-01"),
        isPeriod: true,
        cycleStart: true,
        flow: "heavy" as const,
      },
      {
        ...createEmptyDayLogRecord("2026-04-02"),
        isPeriod: true,
        flow: "medium" as const,
        symptomIDs: ["cramps"],
      },
      {
        ...createEmptyDayLogRecord("2026-03-04"),
        isPeriod: true,
        cycleStart: true,
      },
    ];

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "full",
      dayLogs: records,
      generatedAt: "2026-04-05T08:00:00.000Z",
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: createDefaultSymptomRecords(),
    });

    const readState = buildPartnerSharedReadState(
      projection,
      new Date("2026-04-05T10:00:00.000Z"),
      "en",
    );

    expect(readState.summaryMetrics.totalLoggedDays).toBe(3);
    expect(readState.summaryMetrics.topSymptoms).toContain("Cramps");
    expect(readState.cycleStatus.state).toBe("regular");
    expect(readState.cycleStatus.nextPeriodWindowStartDate).toBe("2026-04-25");
    expect(readState.recentRows[0]?.date).toBe("2026-04-02");
  });

  it("localizes builtin symptom labels in shared summaries and history", () => {
    const profile = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-04-01",
    };
    const records = [
      {
        ...createEmptyDayLogRecord("2026-04-02"),
        isPeriod: true,
        flow: "spotting" as const,
        symptomIDs: ["cramps", "headache"],
      },
    ];

    const projection = buildPartnerSharedProjectionPayload({
      accessLevel: "full",
      dayLogs: records,
      generatedAt: "2026-04-05T08:00:00.000Z",
      grantID: "grant-1",
      ownerAccountID: "owner-1",
      profile,
      symptomRecords: createDefaultSymptomRecords(),
    });

    const readState = buildPartnerSharedReadState(
      projection,
      new Date("2026-04-05T10:00:00.000Z"),
      "ru",
    );

    expect(readState.summaryMetrics.topSymptoms).toEqual(["Спазмы", "Головная боль"]);
    expect(readState.recentRows[0]?.symptomSummary).toBe("Спазмы, Головная боль");
  });
});
