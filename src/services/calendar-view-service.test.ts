import { createEmptyDayLogRecord } from "../models/day-log";
import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import {
  buildCalendarViewData,
  loadCalendarScreenState,
} from "./calendar-view-service";

describe("calendar-view-service", () => {
  it("builds month cells with recorded period and sex markers", () => {
    const viewData = buildCalendarViewData(
      {
        lastPeriodStart: "2026-03-10",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: false,
        temperatureUnit: "c",
        trackCervicalMucus: false,
        hideSexChip: false,
        languageOverride: null,
        themeOverride: null,
        dismissedCalendarPredictionNoticeKey: null,
      },
      [
        {
          date: "2026-03-17",
          isPeriod: true,
          cycleStart: false,
          isUncertain: false,
          flow: "medium",
          mood: 4,
          sexActivity: "protected",
          bbt: 0,
          cervicalMucus: "none",
          cycleFactorKeys: [],
          symptomIDs: [],
          notes: "",
        },
      ],
      new Date(2026, 2, 17),
      new Date(2026, 2, 1),
      "2026-03-17",
    );

    expect(viewData.monthValue).toBe("2026-03");
    expect(viewData.selectedDate).toBe("2026-03-17");
    expect(viewData.days).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: "2026-03-17",
          isToday: true,
          isSelected: true,
          isPeriod: true,
          hasData: true,
          hasSex: true,
          openEditDirectly: false,
        }),
      ]),
    );
  });

  it("builds multi-cycle fertility and prediction states from shared history", () => {
    const profile = {
      lastPeriodStart: "2026-03-14",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
      dismissedCalendarPredictionNoticeKey: null,
    } as const;
    const createPeriodRecord = (date: string) => ({
      ...createEmptyDayLogRecord(date),
      isPeriod: true,
      flow: "medium" as const,
    });
    const records = [
      createPeriodRecord("2026-01-17"),
      createPeriodRecord("2026-02-14"),
      createPeriodRecord("2026-03-14"),
    ];

    const viewData = buildCalendarViewData(
      profile,
      records,
      new Date(2026, 2, 17),
      new Date(2026, 2, 1),
      "2026-03-17",
    );
    const aprilViewData = buildCalendarViewData(
      profile,
      records,
      new Date(2026, 2, 17),
      new Date(2026, 3, 1),
      "2026-04-11",
    );

    const byDate = new Map(viewData.days.map((day) => [day.date, day]));
    const aprilByDate = new Map(aprilViewData.days.map((day) => [day.date, day]));

    expect(byDate.get("2026-03-14")).toEqual(
      expect.objectContaining({
        stateKey: "period",
        isPeriod: true,
      }),
    );
    expect(byDate.get("2026-03-20")).toEqual(
      expect.objectContaining({
        stateKey: "pre_fertile",
      }),
    );
    expect(byDate.get("2026-03-24")).toEqual(
      expect.objectContaining({
        stateKey: "fertility_edge",
      }),
    );
    expect(byDate.get("2026-03-27")).toEqual(
      expect.objectContaining({
        stateKey: "fertility_peak",
      }),
    );
    expect(byDate.get("2026-03-28")).toEqual(
      expect.objectContaining({
        stateKey: "ovulation",
        hasOvulationMarker: true,
      }),
    );
    expect(aprilByDate.get("2026-04-11")).toEqual(
      expect.objectContaining({
        stateKey: "predicted",
      }),
    );
    expect(aprilViewData.legend).toEqual(
      expect.objectContaining({
        guide: expect.any(String),
        meaningTitle: expect.any(String),
        markersTitle: expect.any(String),
      }),
    );
  });

  it("adds an approximate prediction notice when irregular cycle mode is enabled", () => {
    const viewData = buildCalendarViewData(
      {
        lastPeriodStart: "2026-03-14",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: true,
        unpredictableCycle: false,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: false,
        temperatureUnit: "c",
        trackCervicalMucus: false,
        hideSexChip: false,
        languageOverride: null,
        themeOverride: null,
        dismissedCalendarPredictionNoticeKey: null,
      },
      [],
      new Date(2026, 2, 17),
      new Date(2026, 2, 1),
      "2026-03-17",
    );

    expect(viewData.isPredictionDisabled).toBe(false);
    expect(viewData.predictionNotice).toEqual({
      dismissLabel: "Dismiss notice",
      key: "calendar_irregular_prediction_notice_v1",
      message:
        "Irregular cycle mode is on. Ovumcy still shows predictions here, but they should be read as approximate guidance rather than exact dates.",
    });
  });

  it("shows a facts-only notice when unpredictable cycle mode disables calendar predictions", () => {
    const viewData = buildCalendarViewData(
      {
        lastPeriodStart: "2026-03-14",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: true,
        unpredictableCycle: true,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: false,
        temperatureUnit: "c",
        trackCervicalMucus: false,
        hideSexChip: false,
        languageOverride: null,
        themeOverride: null,
        dismissedCalendarPredictionNoticeKey: null,
      },
      [],
      new Date(2026, 2, 17),
      new Date(2026, 2, 1),
      "2026-03-17",
    );

    expect(viewData.isPredictionDisabled).toBe(true);
    expect(viewData.predictionNotice).toEqual({
      dismissLabel: "Dismiss notice",
      key: "calendar_unpredictable_prediction_notice_v1",
      message:
        "Unpredictable cycle mode is on. Calendar predictions are off, so this screen shows recorded facts and saved markers only.",
    });
  });

  it("hides a prediction notice after the matching mode notice was dismissed", () => {
    const viewData = buildCalendarViewData(
      {
        lastPeriodStart: "2026-03-14",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: true,
        ageGroup: "",
        usageGoal: "health",
        trackBBT: false,
        temperatureUnit: "c",
        trackCervicalMucus: false,
        hideSexChip: false,
        languageOverride: null,
        themeOverride: null,
        dismissedCalendarPredictionNoticeKey:
          "calendar_unpredictable_prediction_notice_v1",
      },
      [],
      new Date(2026, 2, 17),
      new Date(2026, 2, 1),
      "2026-03-17",
    );

    expect(viewData.predictionNotice).toBeNull();
  });

  it("explains saved markers separately from the selected day meaning", async () => {
    const storage = createVolatileWebAppStorage();
    await storage.writeProfileRecord({
      lastPeriodStart: "2026-03-14",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
      dismissedCalendarPredictionNoticeKey: null,
    });
    await storage.writeDayLogRecord({
      date: "2026-03-20",
      isPeriod: false,
      cycleStart: false,
      isUncertain: false,
      flow: "none",
      mood: 4,
      sexActivity: "protected",
      bbt: 0,
      cervicalMucus: "none",
      cycleFactorKeys: [],
      symptomIDs: [],
      notes: "",
    });

    const state = await loadCalendarScreenState(
      storage,
      new Date(2026, 2, 17),
      "2026-03",
      "2026-03-20",
    );

    expect(state.selectedDaySummary.stateSummary.value).toBe("Low probability");
    expect(state.selectedDaySummary.markerSummary).toEqual({
      label: "Extra markers",
      value: "Logged entry · Intimacy logged",
    });
  });
});
