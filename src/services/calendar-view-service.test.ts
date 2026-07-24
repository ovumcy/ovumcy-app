import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createPregnancyRecord } from "../models/pregnancy";
import type { ProfileRecord } from "../models/profile";
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
          lhTest: "none",
          pregnancyTest: "none",
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
    expect(viewData.predictionDisclaimer).toBe(
      "These are estimates, not medical advice or a method of contraception.",
    );
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

  it("renders a saved future period day as a fact, not a prediction (injected clock)", () => {
    // Future-period invariant: a period row the owner saved for a date after
    // today is a recorded FACT, so the calendar paints it as a period cell with
    // no date guard. Uses an injected clock so it never depends on wall time.
    const now = new Date(2026, 2, 15);
    const futureDate = "2026-03-25";
    const viewData = buildCalendarViewData(
      {
        lastPeriodStart: "2026-03-10",
        cycleLength: 28,
        periodLength: 5,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "" as const,
        usageGoal: "health" as const,
        trackBBT: false,
        temperatureUnit: "c" as const,
        trackCervicalMucus: false,
        hideSexChip: false,
        languageOverride: null,
        themeOverride: null,
        dismissedCalendarPredictionNoticeKey: null,
      },
      [{ ...createEmptyDayLogRecord(futureDate), isPeriod: true }],
      now,
      new Date(2026, 2, 1),
      "2026-03-15",
    );

    const futureCell = viewData.days.find((day) => day.date === futureDate);
    expect(futureCell?.isPeriod).toBe(true);
    expect(futureCell?.hasData).toBe(true);
  });

  it("starts the calendar week on the configured first day of the week", () => {
    const profile = {
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "" as const,
      usageGoal: "health" as const,
      trackBBT: false,
      temperatureUnit: "c" as const,
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
      dismissedCalendarPredictionNoticeKey: null,
    };
    const sunday = buildCalendarViewData(
      { ...profile, firstDayOfWeek: 0 },
      [],
      new Date(2026, 2, 17),
      new Date(2026, 2, 1),
      "2026-03-17",
    );
    const monday = buildCalendarViewData(
      { ...profile, firstDayOfWeek: 1 },
      [],
      new Date(2026, 2, 17),
      new Date(2026, 2, 1),
      "2026-03-17",
    );

    expect(sunday.weekdayLabels[0]).toBe("Sun");
    expect(monday.weekdayLabels[0]).toBe("Mon");
    expect(monday.weekdayLabels[6]).toBe("Sun");
    // The grid's first cell shifts to the configured week start.
    expect(sunday.days[0]?.date).not.toBe(monday.days[0]?.date);
  });

  it("paints fertile markers on past completed cycles only when showHistoricalPhases is on", () => {
    const baseProfile = {
      lastPeriodStart: "2026-02-26",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "" as const,
      usageGoal: "health" as const,
      trackBBT: false,
      temperatureUnit: "c" as const,
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
      dismissedCalendarPredictionNoticeKey: null,
    };
    // Three cycle starts → two completed past cycles (Jan 1→29, Jan 29→Feb 26);
    // the latest start is the current anchor and is painted separately.
    const records = ["2026-01-01", "2026-01-29", "2026-02-26"].map((date) => ({
      ...createEmptyDayLogRecord(date),
      isPeriod: true,
      cycleStart: true,
      flow: "medium" as const,
    }));

    const off = buildCalendarViewData(
      { ...baseProfile, showHistoricalPhases: false },
      records,
      new Date(2026, 2, 10),
      new Date(2026, 0, 1),
      "2026-01-15",
    );
    expect(
      off.days.some(
        (day) => day.date.startsWith("2026-01") && day.hasOvulationMarker,
      ),
    ).toBe(false);

    const on = buildCalendarViewData(
      { ...baseProfile, showHistoricalPhases: true },
      records,
      new Date(2026, 2, 10),
      new Date(2026, 0, 1),
      "2026-01-15",
    );
    expect(
      on.days.some(
        (day) => day.date.startsWith("2026-01") && day.hasOvulationMarker,
      ),
    ).toBe(true);
    expect(
      on.days.some(
        (day) => day.date.startsWith("2026-01") && day.stateKey === "fertility_peak",
      ),
    ).toBe(true);
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

  it("marks the predicted ovulation day as tentative when BBT shows no thermal shift", () => {
    const profile = {
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: true,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
      dismissedCalendarPredictionNoticeKey: null,
    } as const;
    const flatBBTRecords = Array.from({ length: 14 }, (_, offset) => ({
      ...createEmptyDayLogRecord(
        `2026-03-${String(10 + offset).padStart(2, "0")}`,
      ),
      bbt: 36.4,
    }));
    const records = [
      { ...flatBBTRecords[0]!, isPeriod: true, cycleStart: true, flow: "medium" as const },
      ...flatBBTRecords.slice(1),
    ];

    const viewData = buildCalendarViewData(
      profile,
      records,
      new Date(2026, 2, 25),
      new Date(2026, 2, 1),
      "2026-03-25",
    );

    const ovulationDay = viewData.days.find(
      (day) => day.date === "2026-03-23",
    );
    expect(ovulationDay).toEqual(
      expect.objectContaining({
        stateKey: "ovulation_tentative",
        hasTentativeOvulationMarker: true,
        hasOvulationMarker: false,
      }),
    );
  });

  it("keeps the predicted ovulation day confirmed when BBT shows a sustained thermal shift", () => {
    const profile = {
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: true,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
      dismissedCalendarPredictionNoticeKey: null,
    } as const;
    // A canonical "3-over-6" shift: six coverline days at 36.4 then a 3-day
    // elevated streak 03-16..03-18. The detected shift keeps the predicted
    // ovulation day firm (not demoted to tentative).
    const records = [
      {
        ...createEmptyDayLogRecord("2026-03-10"),
        isPeriod: true,
        cycleStart: true,
        flow: "medium" as const,
        bbt: 36.4,
      },
      { ...createEmptyDayLogRecord("2026-03-11"), bbt: 36.4 },
      { ...createEmptyDayLogRecord("2026-03-12"), bbt: 36.4 },
      { ...createEmptyDayLogRecord("2026-03-13"), bbt: 36.4 },
      { ...createEmptyDayLogRecord("2026-03-14"), bbt: 36.4 },
      { ...createEmptyDayLogRecord("2026-03-15"), bbt: 36.4 },
      { ...createEmptyDayLogRecord("2026-03-16"), bbt: 36.7 },
      { ...createEmptyDayLogRecord("2026-03-17"), bbt: 36.7 },
      { ...createEmptyDayLogRecord("2026-03-18"), bbt: 36.7 },
    ];

    const viewData = buildCalendarViewData(
      profile,
      records,
      new Date(2026, 2, 18),
      new Date(2026, 2, 1),
      "2026-03-18",
    );

    const ovulationDay = viewData.days.find(
      (day) => day.date === "2026-03-23",
    );
    expect(ovulationDay).toEqual(
      expect.objectContaining({
        stateKey: "ovulation",
        hasOvulationMarker: true,
        hasTentativeOvulationMarker: false,
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
      dismissalScope: "persistent",
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
      dismissalScope: "persistent",
      dismissLabel: "Dismiss notice",
      key: "calendar_unpredictable_prediction_notice_v1",
      message:
        "Facts-only mode is on. Calendar predictions are off, so this screen shows recorded facts and saved markers only.",
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

  it("keeps painting the missed cycle's period and fertile window after a stale cycle (web forward-roll parity)", () => {
    // Anchor 2026-02-01, len 28, today 2026-03-25. Web's calendar paints
    // predicted cycles from stats.NextPeriodStart = anchor + cycleLength =
    // 2026-03-01 forward (calendar_days.go appendPredictedCycles), so the
    // "missed" cycle that should have started 2026-03-01 still shows its
    // predicted period AND its fertile window / ovulation (2026-03-14), rather
    // than dropping all March predictions.
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
    expect(byDate.get("2026-03-14")).toEqual(
      expect.objectContaining({
        stateKey: "ovulation",
        hasOvulationMarker: true,
      }),
    );
    // The next rolled cycle (2026-03-29) is also painted as predicted.
    expect(byDate.get("2026-03-29")).toEqual(
      expect.objectContaining({
        stateKey: "predicted",
      }),
    );
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
      lhTest: "none",
      pregnancyTest: "none",
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

  it("hides predicted period and fertility cells when pregnancy predictions are paused", () => {
    const viewData = buildCalendarViewData(
      {
        lastPeriodStart: "2026-03-01",
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
          ...createEmptyDayLogRecord("2026-03-01"),
          isPeriod: true,
          cycleStart: true,
          flow: "medium",
        },
        {
          ...createEmptyDayLogRecord("2026-04-05"),
          pregnancyTest: "positive",
        },
      ],
      new Date(2026, 3, 10),
      new Date(2026, 3, 1),
      "2026-04-10",
    );

    const predictionStates: string[] = [
      "predicted",
      "pre_fertile",
      "fertility_edge",
      "fertility_peak",
      "ovulation",
      "ovulation_tentative",
    ];
    const predictedDay = viewData.days.find((day) =>
      predictionStates.includes(day.stateKey),
    );
    const tentativeDay = viewData.days.find(
      (day) => day.hasTentativeOvulationMarker === true,
    );
    expect(predictedDay).toBeUndefined();
    expect(tentativeDay).toBeUndefined();
  });

  // Shared literal for the storage-backed (loadCalendarScreenState) tests below,
  // mirroring the inline profile objects used throughout this file but factored
  // out because this block exercises many small variations of it.
  function baseStorageProfile(overrides: Record<string, unknown> = {}) {
    return {
      lastPeriodStart: null as string | null,
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "" as const,
      usageGoal: "health" as const,
      trackBBT: false,
      temperatureUnit: "c" as const,
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: null,
      themeOverride: null,
      dismissedCalendarPredictionNoticeKey: null,
      ...overrides,
    };
  }

  describe("selected-day summary hints per state key (loadCalendarScreenState, previously only asserted via day cells)", () => {
    it("surfaces the fertility-edge, fertility-peak, and ovulation hints on the selected day summary", async () => {
      const storage = createVolatileWebAppStorage();
      await storage.writeProfileRecord(
        baseStorageProfile({ lastPeriodStart: "2026-03-14" }),
      );
      for (const date of ["2026-01-17", "2026-02-14", "2026-03-14"]) {
        await storage.writeDayLogRecord({
          ...createEmptyDayLogRecord(date),
          isPeriod: true,
          flow: "medium",
        });
      }

      const edge = await loadCalendarScreenState(
        storage,
        new Date(2026, 2, 17),
        "2026-03",
        "2026-03-24",
      );
      expect(edge.selectedDaySummary.stateSummary).toEqual({
        hint: "This day sits inside the likely fertile window.",
        label: "What this day means",
        value: "Higher fertility",
      });

      const peak = await loadCalendarScreenState(
        storage,
        new Date(2026, 2, 17),
        "2026-03",
        "2026-03-26",
      );
      expect(peak.selectedDaySummary.stateSummary).toEqual({
        hint: "This day sits inside the highest-likelihood part of the fertile window.",
        label: "What this day means",
        value: "Peak fertility",
      });

      const ovulation = await loadCalendarScreenState(
        storage,
        new Date(2026, 2, 17),
        "2026-03",
        "2026-03-27",
      );
      expect(ovulation.selectedDaySummary.stateSummary).toEqual({
        hint: "This is the predicted ovulation day based on the current cycle model.",
        label: "What this day means",
        value: "Ovulation day",
      });
    });

    it("surfaces the tentative-ovulation hint when BBT shows no thermal shift", async () => {
      const storage = createVolatileWebAppStorage();
      await storage.writeProfileRecord(
        baseStorageProfile({ lastPeriodStart: "2026-03-10", trackBBT: true }),
      );
      for (let offset = 0; offset < 14; offset += 1) {
        const date = `2026-03-${String(10 + offset).padStart(2, "0")}`;
        await storage.writeDayLogRecord({
          ...createEmptyDayLogRecord(date),
          bbt: 36.4,
          ...(offset === 0
            ? { isPeriod: true, cycleStart: true, flow: "medium" as const }
            : {}),
        });
      }

      const state = await loadCalendarScreenState(
        storage,
        new Date(2026, 2, 25),
        "2026-03",
        "2026-03-23",
      );
      expect(state.selectedDaySummary.stateSummary).toEqual({
        hint: "This is a possible ovulation day without temperature confirmation.",
        label: "What this day means",
        value: "Possible ovulation day",
      });
    });

    it("falls back to the logged-entry hint for a plain data day with no special prediction state", async () => {
      const storage = createVolatileWebAppStorage();
      await storage.writeProfileRecord(
        baseStorageProfile({ lastPeriodStart: "2026-03-14" }),
      );
      // 2026-04-05 sits in the luteal gap after ovulation (03-27) and before the
      // next predicted period (04-11 = anchor + 28) -- no period/fertile/
      // ovulation markers apply, but the day still has logged data (a mood entry).
      await storage.writeDayLogRecord({
        ...createEmptyDayLogRecord("2026-04-05"),
        mood: 3,
      });

      const state = await loadCalendarScreenState(
        storage,
        new Date(2026, 3, 5),
        "2026-04",
        "2026-04-05",
      );
      expect(state.selectedDaySummary.stateSummary).toEqual({
        hint: "You already saved a local entry for this day.",
        label: "What this day means",
        value: "Logged entry",
      });
    });

    it("returns a neutral, no-data summary and an empty synthetic record when the selected date is outside the rendered grid", async () => {
      const storage = createVolatileWebAppStorage();
      await storage.writeProfileRecord(
        baseStorageProfile({ lastPeriodStart: "2026-03-14" }),
      );

      const state = await loadCalendarScreenState(
        storage,
        new Date(2026, 2, 17),
        "2026-03",
        "2026-09-15",
      );
      expect(state.selectedDaySummary.markerSummary).toBeNull();
      expect(state.selectedDaySummary.stateSummary).toEqual({
        hint: "No recorded or predicted event is attached to this day yet.",
        label: "What this day means",
        value: "-",
      });
      // resolveCalendarVisibleRecord falls back to an empty synthetic record
      // (no stored day-log row for a date this far outside the loaded range).
      expect(state.selectedRecord).toEqual(
        expect.objectContaining({ date: "2026-09-15", isPeriod: false, mood: 0 }),
      );
    });

    it("falls back to the raw string as the date label when selectedDate is not a valid calendar date", async () => {
      const storage = createVolatileWebAppStorage();
      await storage.writeProfileRecord(
        baseStorageProfile({ lastPeriodStart: "2026-03-14" }),
      );

      const state = await loadCalendarScreenState(
        storage,
        new Date(2026, 2, 17),
        "2026-03",
        "not-a-real-date",
      );
      expect(state.selectedDaySummary.dateLabel).toBe("not-a-real-date");
    });
  });

  describe("loadCalendarScreenState defaults when monthValue/selectedDate are omitted or malformed", () => {
    it("falls back to the current month and today's date when monthValue/selectedDate are omitted", async () => {
      const storage = createVolatileWebAppStorage();
      await storage.writeProfileRecord(baseStorageProfile());

      const state = await loadCalendarScreenState(storage, new Date(2026, 5, 15));
      expect(state.viewData.monthValue).toBe("2026-06");
      expect(state.viewData.selectedDate).toBe("2026-06-15");
    });

    it("falls back to the current month for a syntactically malformed or a semantically invalid monthValue", async () => {
      const storage = createVolatileWebAppStorage();
      await storage.writeProfileRecord(baseStorageProfile());
      const now = new Date(2026, 5, 15);

      const malformed = await loadCalendarScreenState(storage, now, "not-a-month");
      expect(malformed.viewData.monthValue).toBe("2026-06");

      // "2026-13" matches the YYYY-MM shape but month 13 does not exist; the
      // rolled-over Date disagrees with the requested year/month and is rejected.
      const invalidMonth = await loadCalendarScreenState(storage, now, "2026-13");
      expect(invalidMonth.viewData.monthValue).toBe("2026-06");
    });
  });

  describe("empty/degenerate cycle-math edge cases in calendar prediction painting", () => {
    it("shows no predicted, fertile, or ovulation markers for a brand-new profile with no logged periods", () => {
      const viewData = buildCalendarViewData(
        baseStorageProfile({ lastPeriodStart: null }),
        [],
        new Date(2026, 2, 17),
        new Date(2026, 2, 1),
        "2026-03-17",
      );

      const predictionStates: string[] = [
        "predicted",
        "pre_fertile",
        "fertility_edge",
        "fertility_peak",
        "ovulation",
        "ovulation_tentative",
      ];
      expect(viewData.days.every((day) => !predictionStates.includes(day.stateKey))).toBe(
        true,
      );
      expect(
        viewData.days.every(
          (day) => !day.hasOvulationMarker && !day.hasTentativeOvulationMarker,
        ),
      ).toBe(true);
    });

    it("paints only the recorded period -- no fertility or ovulation markers -- when the cycle length is too short to place ovulation", () => {
      const profile = baseStorageProfile({
        lastPeriodStart: "2026-01-21",
        cycleLength: 10,
      });
      const records = [
        {
          ...createEmptyDayLogRecord("2026-01-21"),
          isPeriod: true,
          cycleStart: true,
          flow: "medium" as const,
        },
      ];

      const viewData = buildCalendarViewData(
        profile,
        records,
        new Date(2026, 0, 25),
        new Date(2026, 0, 1),
        "2026-01-25",
      );

      const fertilityStates: string[] = [
        "pre_fertile",
        "fertility_edge",
        "fertility_peak",
        "ovulation",
        "ovulation_tentative",
      ];
      expect(viewData.days.some((day) => fertilityStates.includes(day.stateKey))).toBe(
        false,
      );
      expect(viewData.days.find((day) => day.date === "2026-01-21")).toEqual(
        expect.objectContaining({ stateKey: "period", isPeriod: true }),
      );
    });

    it("paints no pre-fertile gap when the logged period consumes every day before the fertility window opens", () => {
      const profile = baseStorageProfile({
        lastPeriodStart: "2026-01-01",
        cycleLength: 20,
        periodLength: 10,
      });
      const records = [
        {
          ...createEmptyDayLogRecord("2026-01-01"),
          isPeriod: true,
          cycleStart: true,
          flow: "medium" as const,
        },
      ];

      const viewData = buildCalendarViewData(
        profile,
        records,
        new Date(2026, 0, 5),
        new Date(2026, 0, 1),
        "2026-01-05",
      );

      expect(viewData.days.some((day) => day.stateKey === "pre_fertile")).toBe(false);
    });
  });

  // A period logged AFTER the latest positive test lifts
  // resolvePregnancyPause's own pause (cycle-history-service, untouched) --
  // during an ACTIVE pregnancy that lift is medically wrong. This fixture is
  // the same shape as the "hides predicted period..." test above, plus one
  // more logged period (2026-04-08) dated after the positive test.
  const liftedPauseProfile: ProfileRecord = {
    lastPeriodStart: "2026-03-01",
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
  };
  const liftedPauseRecords: DayLogRecord[] = [
    {
      ...createEmptyDayLogRecord("2026-03-01"),
      isPeriod: true,
      cycleStart: true,
    },
    { ...createEmptyDayLogRecord("2026-04-05"), pregnancyTest: "positive" },
    {
      ...createEmptyDayLogRecord("2026-04-08"),
      isPeriod: true,
      cycleStart: true,
    },
  ];
  const predictionStateKeys = [
    "predicted",
    "pre_fertile",
    "fertility_edge",
    "fertility_peak",
    "ovulation",
    "ovulation_tentative",
  ];

  it("paints predictions normally once the pause lifts and no suppression flag is set (regression guard -- e.g. no active pregnancy)", () => {
    const viewData = buildCalendarViewData(
      liftedPauseProfile,
      liftedPauseRecords,
      new Date(2026, 3, 10),
      new Date(2026, 3, 1),
      "2026-04-10",
    );

    expect(
      viewData.days.some((day) => predictionStateKeys.includes(day.stateKey)),
    ).toBe(true);
  });

  it("suppresses prediction cells for an active pregnancy even after the pause lifts, while still painting the logged period", () => {
    const viewData = buildCalendarViewData(
      liftedPauseProfile,
      liftedPauseRecords,
      new Date(2026, 3, 10),
      new Date(2026, 3, 1),
      "2026-04-10",
      "en",
      { suppressPredictions: true },
    );

    expect(
      viewData.days.some((day) => predictionStateKeys.includes(day.stateKey)),
    ).toBe(false);
    const loggedPeriodDay = viewData.days.find(
      (day) => day.date === "2026-04-08",
    );
    expect(loggedPeriodDay?.stateKey).toBe("period");
    expect(loggedPeriodDay?.isPeriod).toBe(true);
  });

  it("suppresses predictions end-to-end via loadCalendarScreenState when a pregnancy is active and the pause has lifted", async () => {
    const storage = createVolatileWebAppStorage();
    await storage.writePregnancyRecord(
      createPregnancyRecord({
        edd: "2027-01-15",
        eddBasis: "lmp",
        lmpDate: "2026-04-01",
        startedAt: "2026-04-01",
      }),
    );
    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-04-05"),
      pregnancyTest: "positive",
    });
    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-04-08"),
      isPeriod: true,
      cycleStart: true,
    });

    const state = await loadCalendarScreenState(
      storage,
      new Date(2026, 3, 10),
      "2026-04",
      "2026-04-10",
    );

    expect(
      state.viewData.days.some((day) =>
        predictionStateKeys.includes(day.stateKey),
      ),
    ).toBe(false);
  });

  it("shows a session-scoped pregnancy-paused notice when an active pregnancy suppresses predictions", () => {
    const viewData = buildCalendarViewData(
      liftedPauseProfile,
      liftedPauseRecords,
      new Date(2026, 3, 10),
      new Date(2026, 3, 1),
      "2026-04-10",
      "en",
      { suppressPredictions: true },
    );

    expect(viewData.predictionNotice).toEqual({
      dismissalScope: "session",
      dismissLabel: "Dismiss notice",
      key: "calendar_pregnancy_paused_prediction_notice_v1",
      message:
        "Pregnancy tracking is active. Calendar predictions are paused, so this screen shows recorded facts and saved markers only.",
    });
  });

  it("keeps the pregnancy-paused notice off when predictions are not suppressed, even with pregnancy facts logged", () => {
    const viewData = buildCalendarViewData(
      liftedPauseProfile,
      liftedPauseRecords,
      new Date(2026, 3, 10),
      new Date(2026, 3, 1),
      "2026-04-10",
    );

    expect(viewData.predictionNotice).toBeNull();
  });

  it("prefers the pregnancy-paused notice over the mode notices while predictions are suppressed", () => {
    const viewData = buildCalendarViewData(
      {
        ...liftedPauseProfile,
        irregularCycle: true,
        unpredictableCycle: true,
      },
      liftedPauseRecords,
      new Date(2026, 3, 10),
      new Date(2026, 3, 1),
      "2026-04-10",
      "en",
      { suppressPredictions: true },
    );

    expect(viewData.predictionNotice?.key).toBe(
      "calendar_pregnancy_paused_prediction_notice_v1",
    );
  });

  it("shows the pregnancy-paused notice even after a mode notice was dismissed and persisted", () => {
    const viewData = buildCalendarViewData(
      {
        ...liftedPauseProfile,
        unpredictableCycle: true,
        dismissedCalendarPredictionNoticeKey:
          "calendar_unpredictable_prediction_notice_v1",
      },
      liftedPauseRecords,
      new Date(2026, 3, 10),
      new Date(2026, 3, 1),
      "2026-04-10",
      "en",
      { suppressPredictions: true },
    );

    expect(viewData.predictionNotice).toEqual(
      expect.objectContaining({
        dismissalScope: "session",
        key: "calendar_pregnancy_paused_prediction_notice_v1",
      }),
    );
  });

  it("surfaces the pregnancy-paused notice end-to-end via loadCalendarScreenState for an active pregnancy", async () => {
    const storage = createVolatileWebAppStorage();
    await storage.writePregnancyRecord(
      createPregnancyRecord({
        edd: "2027-01-15",
        eddBasis: "lmp",
        lmpDate: "2026-04-01",
        startedAt: "2026-04-01",
      }),
    );
    await storage.writeDayLogRecord({
      ...createEmptyDayLogRecord("2026-04-05"),
      pregnancyTest: "positive",
    });

    const state = await loadCalendarScreenState(
      storage,
      new Date(2026, 3, 10),
      "2026-04",
      "2026-04-10",
    );

    expect(state.viewData.predictionNotice).toEqual(
      expect.objectContaining({
        dismissalScope: "session",
        key: "calendar_pregnancy_paused_prediction_notice_v1",
      }),
    );
  });

  it("shows pregnancy metrics in the calendar day editor while a pregnancy is active", async () => {
    const storage = createVolatileWebAppStorage();
    await storage.writePregnancyRecord(
      createPregnancyRecord({
        edd: "2027-04-18",
        eddBasis: "lmp",
        lmpDate: "2026-07-12",
        startedAt: "2026-07-12",
      }),
    );

    const state = await loadCalendarScreenState(
      storage,
      new Date(2026, 6, 12),
      "2026-07",
      "2026-07-12",
    );

    expect(state.editorViewData.visibility.showPregnancyMetrics).toBe(true);
  });

  it("keeps pregnancy metrics out of the calendar day editor without an active pregnancy", async () => {
    const storage = createVolatileWebAppStorage();

    const state = await loadCalendarScreenState(
      storage,
      new Date(2026, 6, 12),
      "2026-07",
      "2026-07-12",
    );

    expect(state.editorViewData.visibility.showPregnancyMetrics).toBe(false);
  });
});
