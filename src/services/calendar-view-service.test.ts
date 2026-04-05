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

  it("opens empty days in direct-edit mode while keeping saved days summary-first", () => {
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
          ...createEmptyDayLogRecord("2026-03-17"),
          mood: 4,
        },
      ],
      new Date(2026, 2, 17),
      new Date(2026, 2, 1),
      "2026-03-13",
    );

    const byDate = new Map(viewData.days.map((day) => [day.date, day]));

    expect(byDate.get("2026-03-13")).toEqual(
      expect.objectContaining({
        hasData: false,
        openEditDirectly: true,
      }),
    );
    expect(byDate.get("2026-03-17")).toEqual(
      expect.objectContaining({
        hasData: true,
        openEditDirectly: false,
      }),
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
    expect(byDate.get("2026-03-26")).toEqual(
      expect.objectContaining({
        stateKey: "fertility_peak",
      }),
    );
    expect(byDate.get("2026-03-27")).toEqual(
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
    expect(byDate.get("2026-03-27")?.accessibilityLabel).toContain("Ovulation");
    const mayViewData = buildCalendarViewData(
      profile,
      records,
      new Date(2026, 2, 17),
      new Date(2026, 4, 1),
      "2026-05-09",
    );
    const mayByDate = new Map(mayViewData.days.map((day) => [day.date, day]));
    expect(mayByDate.get("2026-05-09")).toEqual(
      expect.objectContaining({
        stateKey: "predicted",
      }),
    );
    expect(mayByDate.get("2026-05-22")).toEqual(
      expect.objectContaining({
        stateKey: "ovulation",
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

  it("keeps a single settings-backed ovulation marker after nearby period logs", () => {
    const profile = {
      lastPeriodStart: "2026-03-24",
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
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-01"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-02"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-03"),
        isPeriod: true,
      },
      {
        ...createEmptyDayLogRecord("2026-03-24"),
        isPeriod: true,
      },
    ];

    const aprilViewData = buildCalendarViewData(
      profile,
      records,
      new Date(2026, 2, 24),
      new Date(2026, 3, 1),
      "2026-04-01",
    );

    expect(
      aprilViewData.days.filter((day) => day.hasOvulationMarker).map((day) => day.date),
    ).toEqual(["2026-04-06"]);
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

  it("keeps the last recorded period start visible in calendar history even without a stored day-log row", async () => {
    const storage = createVolatileWebAppStorage();
    await storage.writeProfileRecord({
      lastPeriodStart: "2026-02-08",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: false,
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

    const state = await loadCalendarScreenState(
      storage,
      new Date(2026, 2, 26),
      "2026-02",
      "2026-02-08",
    );
    const byDate = new Map(state.viewData.days.map((day) => [day.date, day]));

    expect(byDate.get("2026-02-08")).toEqual(
      expect.objectContaining({
        stateKey: "period",
        isPeriod: true,
        hasData: true,
      }),
    );
    expect(byDate.get("2026-02-21")).toEqual(
      expect.objectContaining({
        stateKey: "ovulation",
        hasOvulationMarker: true,
      }),
    );
    expect(state.selectedRecord).toEqual(
      expect.objectContaining({
        date: "2026-02-08",
        cycleStart: true,
        isPeriod: true,
      }),
    );
  });

  it("keeps the missed period window visible after a stale cycle but stops extending a new fertile window", () => {
    const viewData = buildCalendarViewData(
      {
        lastPeriodStart: "2026-02-01",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: false,
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
      [],
      new Date(2026, 2, 25),
      new Date(2026, 2, 1),
      "2026-03-14",
    );
    const byDate = new Map(viewData.days.map((day) => [day.date, day]));

    expect(byDate.get("2026-03-01")).toEqual(
      expect.objectContaining({
        stateKey: "predicted",
      }),
    );
    expect(
      viewData.days.some(
        (day) => day.date.startsWith("2026-03") && day.hasOvulationMarker,
      ),
    ).toBe(false);
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

    expect(state.selectedDaySummary.stateSummary.value).toBe(
      "Fertility may be starting",
    );
    expect(state.selectedDaySummary.markerSummary).toEqual({
      label: "Extra markers",
      value: "Logged entry · Intimacy logged",
    });
  });
});
