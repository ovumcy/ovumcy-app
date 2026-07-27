import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import { createPregnancyRecord } from "../models/pregnancy";
import type { ProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createVolatileWebAppStorage } from "../storage/local/volatile-web-app-storage";
import {
  buildCurrentCycleProjection,
  buildCycleHistorySummary,
} from "./cycle-history-service";
import { buildStatsViewData, loadStatsScreenState } from "./stats-view-service";

function createProfileRecord(
  overrides?: Partial<ProfileRecord>,
): ProfileRecord {
  return {
    lastPeriodStart: "2026-01-17",
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
    ...overrides,
  };
}

function createPeriodRecord(
  date: string,
  overrides?: Partial<ReturnType<typeof createEmptyDayLogRecord>>,
) {
  return {
    ...createEmptyDayLogRecord(date),
    isPeriod: true,
    ...overrides,
  };
}

describe("buildStatsViewData", () => {
  it("keeps stats in the empty state until two completed cycles exist", () => {
    const viewData = buildStatsViewData(
      createProfileRecord(),
      [],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
    );

    expect(viewData.hasInsights).toBe(false);
    expect(viewData.predictionDisclaimer).toBe(
      "These are estimates, not medical advice or a method of contraception.",
    );
    expect(viewData.emptyState?.title).toBe("Keep logging to unlock insights");
    expect(viewData.emptyState?.progressLabel).toBe("Cycle 0 of 2 completed");
    expect(viewData.emptyState?.lockedSections).toContain("Cycle length");
    expect(viewData.emptyState?.action).toEqual({
      kind: "open_logging",
      label: "Log today to speed this up",
    });
  });

  it("builds trend, symptom, phase, and bbt insight sections after local history unlocks stats", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        trackBBT: true,
      }),
      [
        createPeriodRecord("2025-12-20"),
        {
          ...createEmptyDayLogRecord("2025-12-21"),
          flow: "medium",
          mood: 3,
          symptomIDs: ["cramps"],
        },
        createPeriodRecord("2026-01-17"),
        {
          ...createEmptyDayLogRecord("2026-01-18"),
          flow: "medium",
          mood: 2,
          symptomIDs: ["cramps"],
        },
        createPeriodRecord("2026-02-14"),
        {
          ...createEmptyDayLogRecord("2026-02-15"),
          flow: "light",
          mood: 4,
          symptomIDs: ["cramps"],
        },
        createPeriodRecord("2026-03-14"),
        {
          ...createEmptyDayLogRecord("2026-03-15"),
          bbt: 36.45,
        },
        {
          ...createEmptyDayLogRecord("2026-03-16"),
          bbt: 36.62,
          symptomIDs: ["headache"],
        },
        {
          ...createEmptyDayLogRecord("2026-03-17"),
          bbt: 36.55,
        },
        {
          ...createEmptyDayLogRecord("2026-03-18"),
          bbt: 36.7,
        },
        {
          ...createEmptyDayLogRecord("2026-03-19"),
          bbt: 36.65,
        },
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 19),
    );

    expect(viewData.hasInsights).toBe(true);
    expect(viewData.predictionDisclaimer).toBe(
      "These are estimates, not medical advice or a method of contraception.",
    );
    expect(viewData.topCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Prediction reliability",
          value: "Building pattern",
        }),
      ]),
    );
    expect(viewData.trendChart?.title).toBe("Cycle trend");
    expect(viewData.trendChart?.points).toHaveLength(3);
    expect(viewData.symptomFrequency?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps" }),
      ]),
    );
    expect(viewData.lastCycleSymptoms?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps" }),
      ]),
    );
    expect(viewData.symptomPatterns?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps" }),
      ]),
    );
    expect(viewData.phaseMoodInsights?.items.some((item) => item.hasData)).toBe(true);
    expect(viewData.phaseSymptomInsights?.items.some((item) => item.hasData)).toBe(
      true,
    );
    expect(viewData.bbtTrend?.points).toHaveLength(5);
  });

  it("surfaces the free-tier BBT coverline and probable-ovulation caption once a shift is confirmed (no premium entitlement)", () => {
    // A canonical "3-over-6" shift in the current cycle (start 2026-03-14): six
    // coverline days then a 3-day streak 03-20..03-22, so the coverline (36.4 C)
    // and probable ovulation (day before the first elevated day, 2026-03-19) are
    // exposed for FREE — no premiumFeatures arg.
    const viewData = buildStatsViewData(
      createProfileRecord({ trackBBT: true }),
      [
        createPeriodRecord("2025-12-20"),
        createPeriodRecord("2026-01-17"),
        createPeriodRecord("2026-02-14"),
        createPeriodRecord("2026-03-14", { bbt: 36.3 }),
        { ...createEmptyDayLogRecord("2026-03-15"), bbt: 36.35 },
        { ...createEmptyDayLogRecord("2026-03-16"), bbt: 36.3 },
        { ...createEmptyDayLogRecord("2026-03-17"), bbt: 36.4 },
        { ...createEmptyDayLogRecord("2026-03-18"), bbt: 36.3 },
        { ...createEmptyDayLogRecord("2026-03-19"), bbt: 36.35 },
        { ...createEmptyDayLogRecord("2026-03-20"), bbt: 36.6 },
        { ...createEmptyDayLogRecord("2026-03-21"), bbt: 36.65 },
        { ...createEmptyDayLogRecord("2026-03-22"), bbt: 36.7 },
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 23),
    );

    expect(viewData.bbtTrend?.coverlineValue).toBeCloseTo(36.4, 5);
    expect(viewData.bbtTrend?.coverlineLabel).toBe("Coverline");
    expect(viewData.bbtTrend?.probableOvulationLabel).toContain(
      "Probable ovulation",
    );
    // The advanced-fertility premium section stays absent without the entitlement.
    expect(viewData.advancedFertility).toBeUndefined();
  });

  it("omits the BBT coverline and probable-ovulation caption when no shift is confirmed", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({ trackBBT: true }),
      [
        createPeriodRecord("2025-12-20"),
        createPeriodRecord("2026-01-17"),
        createPeriodRecord("2026-02-14"),
        createPeriodRecord("2026-03-14", { bbt: 36.3 }),
        { ...createEmptyDayLogRecord("2026-03-15"), bbt: 36.3 },
        { ...createEmptyDayLogRecord("2026-03-16"), bbt: 36.31 },
        { ...createEmptyDayLogRecord("2026-03-17"), bbt: 36.3 },
        { ...createEmptyDayLogRecord("2026-03-18"), bbt: 36.29 },
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 19),
    );

    expect(viewData.bbtTrend?.points.length).toBeGreaterThan(0);
    expect(viewData.bbtTrend?.coverlineValue).toBeNull();
    expect(viewData.bbtTrend?.probableOvulationLabel).toBeNull();
  });

  it("adds a mucus-based fertility insight when egg-white mucus is logged in the current cycle", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        trackCervicalMucus: true,
      }),
      [
        createPeriodRecord("2026-01-17"),
        createPeriodRecord("2026-02-14"),
        createPeriodRecord("2026-03-14"),
        {
          ...createEmptyDayLogRecord("2026-03-16"),
          cervicalMucus: "eggwhite",
        },
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
    );

    expect(viewData.topCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "High fertility",
          value: "Mucus signal",
          description: "Egg-white mucus was logged on Mar 16.",
        }),
      ]),
    );
    expect(viewData.topCards).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "current-phase",
        }),
      ]),
    );
    expect(viewData.topCards.length).toBeLessThanOrEqual(4);
  });

  it("localizes built-in symptom labels in insight sections", () => {
    const viewData = buildStatsViewData(
      createProfileRecord(),
      [
        createPeriodRecord("2026-01-17"),
        {
          ...createEmptyDayLogRecord("2026-01-18"),
          symptomIDs: ["cramps"],
        },
        createPeriodRecord("2026-02-14"),
        {
          ...createEmptyDayLogRecord("2026-02-15"),
          symptomIDs: ["cramps"],
        },
        createPeriodRecord("2026-03-14"),
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
      "ru",
    );

    expect(viewData.symptomFrequency?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps", label: "Спазмы" }),
      ]),
    );
    expect(viewData.lastCycleSymptoms?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cramps", label: "Спазмы" }),
      ]),
    );
  });

  it("switches to facts-only copy when unpredictable mode is enabled", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        unpredictableCycle: true,
      }),
      [
        createPeriodRecord("2026-02-14"),
        createPeriodRecord("2026-03-14"),
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
    );

    expect(viewData.topCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Facts only",
          value: "Predictions off",
        }),
      ]),
    );
    expect(viewData.predictionExplanation).toBe(
      "Predictions are off in unpredictable cycle mode. Ovumcy shows recorded facts only.",
    );
    expect(
      viewData.topCards.find((card) => card.title === "Prediction reliability"),
    ).toBeUndefined();
  });

  it("shows factor context and the perimenopause hint for 45+ irregular users", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        irregularCycle: true,
        ageGroup: "age_45_plus",
      }),
      [
        createPeriodRecord("2026-02-08", {
          cycleFactorKeys: ["stress"],
        }),
        createPeriodRecord("2026-03-15", {
          cycleFactorKeys: ["stress", "travel"],
        }),
        {
          ...createEmptyDayLogRecord("2026-03-16"),
          cycleFactorKeys: ["travel"],
        },
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
    );

    expect(viewData.factorContext?.recentFactors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "stress" }),
        expect.objectContaining({ key: "travel" }),
      ]),
    );
    expect(
      viewData.notices.some((notice) =>
        notice.includes("After 45") && notice.includes("perimenopause"),
      ),
    ).toBe(true);
  });

  it("surfaces the perimenopause hint even before insights unlock for 45+ users", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        ageGroup: "age_45_plus",
      }),
      [],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
    );

    expect(viewData.hasInsights).toBe(false);
    expect(
      viewData.notices.some((notice) =>
        notice.includes("After 45") && notice.includes("perimenopause"),
      ),
    ).toBe(true);
  });

  it("adds the data-driven range explainer when prediction span is computed from history", () => {
    const viewData = buildStatsViewData(
      createProfileRecord(),
      [
        createPeriodRecord("2026-01-01"),
        createPeriodRecord("2026-01-30"),
        createPeriodRecord("2026-02-25"),
        createPeriodRecord("2026-03-26"),
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 28),
    );

    expect(viewData.hasInsights).toBe(true);
    expect(viewData.notices).toContain(
      "Your prediction shows a range that reflects how much your cycle length varies.",
    );
  });

  it("adds advanced insights when the managed premium entitlement is active", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({
        trackBBT: true,
        trackCervicalMucus: true,
      }),
      [
        createPeriodRecord("2025-10-01"),
        {
          ...createEmptyDayLogRecord("2025-10-14"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        {
          ...createEmptyDayLogRecord("2025-10-11"),
          symptomIDs: ["headache"],
        },
        createPeriodRecord("2025-10-29"),
        {
          ...createEmptyDayLogRecord("2025-11-12"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        {
          ...createEmptyDayLogRecord("2025-11-08"),
          symptomIDs: ["headache"],
        },
        createPeriodRecord("2025-11-26"),
        {
          ...createEmptyDayLogRecord("2025-12-10"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        {
          ...createEmptyDayLogRecord("2025-12-06"),
          symptomIDs: ["headache"],
        },
        createPeriodRecord("2025-12-24"),
        {
          ...createEmptyDayLogRecord("2026-01-08"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        createPeriodRecord("2026-01-21"),
        {
          ...createEmptyDayLogRecord("2026-02-04"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        createPeriodRecord("2026-02-18"),
        {
          ...createEmptyDayLogRecord("2026-03-12"),
          cervicalMucus: "eggwhite",
          lhTest: "peak",
        },
        // Current cycle: six flat coverline BBT days, then a 3-day sustained
        // "3-over-6" streak so the canonical detector anchors the shift on
        // 2026-04-03 (ovulation 2026-04-02).
        createPeriodRecord("2026-03-28", { bbt: 36.3 }),
        {
          ...createEmptyDayLogRecord("2026-03-29"),
          bbt: 36.31,
        },
        {
          ...createEmptyDayLogRecord("2026-03-30"),
          bbt: 36.29,
          cervicalMucus: "eggwhite",
          lhTest: "peak",
          pregnancyTest: "none",
        },
        {
          ...createEmptyDayLogRecord("2026-03-31"),
          bbt: 36.3,
        },
        {
          ...createEmptyDayLogRecord("2026-04-01"),
          bbt: 36.3,
        },
        {
          ...createEmptyDayLogRecord("2026-04-02"),
          bbt: 36.3,
        },
        {
          ...createEmptyDayLogRecord("2026-04-03"),
          bbt: 36.55,
        },
        {
          ...createEmptyDayLogRecord("2026-04-04"),
          bbt: 36.56,
        },
        {
          ...createEmptyDayLogRecord("2026-04-05"),
          bbt: 36.57,
        },
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 3, 6),
      "en",
      {
        advancedFertility: true,
        advancedInsights: true,
        doctorPDF: false,
        extendedReports: true,
        partnerAccess: false,
        reminders: false,
      },
    );

    expect(viewData.advancedInsights?.title).toBe("Advanced insights");
    expect(viewData.advancedInsights?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "weighted-average",
          title: "Weighted average",
        }),
        expect.objectContaining({
          key: "pattern-drift",
          title: "Pattern drift",
        }),
        expect.objectContaining({
          key: "anomalous-cycle",
          title: "Anomalous cycle",
        }),
        expect.objectContaining({
          key: "seasonal-pattern",
          title: "Seasonal pattern",
          value: "Winter",
        }),
        expect.objectContaining({
          key: "phase-symptom-peak",
          title: "Phase symptom peak",
        }),
      ]),
    );
    expect(viewData.advancedFertility?.title).toBe("Advanced fertility");
    expect(viewData.advancedFertility?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "observed-luteal",
          title: "Observed luteal phase",
        }),
        expect.objectContaining({
          key: "signal-coverage",
          title: "Signal coverage",
        }),
        expect.objectContaining({
          key: "luteal-consistency",
          title: "Luteal consistency",
        }),
        expect.objectContaining({
          key: "thermal-shift",
          title: "Thermal shift",
        }),
        expect.objectContaining({
          key: "ovulation-confirmation",
          title: "Ovulation confirmation",
        }),
        expect.objectContaining({
          key: "lh-peak",
          title: "LH peak",
        }),
      ]),
    );
    expect(viewData.personalForecasts?.title).toBe("Personal forecasts");
    expect(viewData.personalForecasts?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Headache",
          value: "In 1 day",
        }),
      ]),
    );
    expect(viewData.extendedReports?.title).toBe("Extended reports");
    expect(viewData.extendedReports?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cycleLengthLabel: expect.stringContaining("Cycle"),
          periodLengthLabel: expect.stringContaining("Period"),
        }),
      ]),
    );
    expect(viewData.premiumLocks).toBeUndefined();
  });

  it("returns premium lock placeholders when entitlements are missing", () => {
    const viewData = buildStatsViewData(
      createProfileRecord(),
      [
        createPeriodRecord("2025-12-01"),
        createPeriodRecord("2025-12-29"),
        createPeriodRecord("2026-01-26"),
        createPeriodRecord("2026-02-23"),
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 17),
    );

    expect(viewData.hasInsights).toBe(true);
    expect(viewData.advancedInsights).toBeUndefined();
    expect(viewData.advancedFertility).toBeUndefined();
    expect(viewData.extendedReports).toBeUndefined();
    expect(viewData.premiumLocks?.advancedInsights?.title).toBe(
      "Advanced insights",
    );
    expect(viewData.premiumLocks?.advancedInsights?.ctaLabel).toBe(
      "Open Ovumcy Cloud",
    );
    expect(viewData.premiumLocks?.advancedFertility?.title).toBe(
      "Advanced fertility",
    );
    expect(viewData.premiumLocks?.extendedReports?.title).toBe(
      "Extended reports",
    );
  });

  it("surfaces the short luteal phase warning in advanced insights when 3+ recent cycles show luteal <10 days", () => {
    const viewData = buildStatsViewData(
      createProfileRecord({ trackCervicalMucus: true }),
      [
        createPeriodRecord("2025-12-01"),
        {
          ...createEmptyDayLogRecord("2025-12-20"),
          lhTest: "peak",
        },
        createPeriodRecord("2025-12-26"),
        {
          ...createEmptyDayLogRecord("2026-01-15"),
          lhTest: "peak",
        },
        createPeriodRecord("2026-01-20"),
        {
          ...createEmptyDayLogRecord("2026-02-09"),
          lhTest: "peak",
        },
        createPeriodRecord("2026-02-14"),
      ],
      createDefaultSymptomRecords(),
      new Date(2026, 2, 4),
      "en",
      {
        advancedFertility: false,
        advancedInsights: true,
        doctorPDF: false,
        extendedReports: false,
        partnerAccess: false,
        reminders: false,
      },
    );

    expect(viewData.advancedInsights?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "short-luteal-warning",
          title: "Short luteal phase",
          tone: "warning",
        }),
      ]),
    );
  });
});

describe("buildStatsViewData short/long completed-cycle notices", () => {
  const SHORT_NOTICE =
    "Several of your recent cycles are shorter than 24 days. Cycles this short are less common — consider discussing them with a health professional.";
  const LONG_NOTICE =
    "Several of your recent cycles are longer than 45 days. Cycles this long are less common and can have many causes — consider discussing them with a health professional.";

  // Builds completed cycles of the given lengths by placing cycle starts that
  // many days apart, beginning at startDate. N lengths => N+1 starts => N
  // completed cycles. lastPeriodStart is pinned to the first start so the
  // profile does not inject a stray cluster start.
  function buildNoticeViewData(
    cycleLengths: number[],
    startDate = "2026-01-01",
  ) {
    const records = [createPeriodRecord(startDate)];
    // UTC-based day stepping so the generated cycle lengths are exact calendar
    // gaps regardless of any DST transition the span happens to cross.
    const [year, month, day] = startDate.split("-").map(Number);
    let cursorMs = Date.UTC(year!, month! - 1, day!);
    for (const length of cycleLengths) {
      cursorMs += length * 24 * 60 * 60 * 1000;
      const iso = new Date(cursorMs).toISOString().slice(0, 10);
      records.push(createPeriodRecord(iso));
    }

    return buildStatsViewData(
      createProfileRecord({ lastPeriodStart: startDate }),
      records,
      createDefaultSymptomRecords(),
      // Late in the year so every generated start is strictly in the past.
      new Date(2026, 11, 31),
    );
  }

  it("shows the short-cycle notice when exactly 3 completed cycles are below 24 days", () => {
    const viewData = buildNoticeViewData([23, 23, 23]);

    expect(viewData.hasInsights).toBe(true);
    expect(viewData.notices).toContain(SHORT_NOTICE);
    expect(viewData.notices).not.toContain(LONG_NOTICE);
  });

  it("does not show the short-cycle notice with only 2 short cycles", () => {
    const viewData = buildNoticeViewData([23, 23]);

    expect(viewData.hasInsights).toBe(true);
    expect(viewData.notices).not.toContain(SHORT_NOTICE);
  });

  it("does not treat a cycle of exactly 24 days as short (strict < threshold)", () => {
    const viewData = buildNoticeViewData([24, 24, 24]);

    expect(viewData.notices).not.toContain(SHORT_NOTICE);
  });

  it("shows the long-cycle notice when 3 completed cycles are above 45 days", () => {
    const viewData = buildNoticeViewData([46, 46, 46]);

    expect(viewData.notices).toContain(LONG_NOTICE);
    expect(viewData.notices).not.toContain(SHORT_NOTICE);
  });

  it("does not treat a cycle of exactly 45 days as long (strict > threshold)", () => {
    const viewData = buildNoticeViewData([45, 45, 45]);

    expect(viewData.notices).not.toContain(LONG_NOTICE);
  });

  it("does not show either notice for a single short cycle among normal cycles", () => {
    // 23-day short cycle followed by three ~28-day cycles: only one short.
    const viewData = buildNoticeViewData([23, 28, 28, 28]);

    expect(viewData.notices).not.toContain(SHORT_NOTICE);
    expect(viewData.notices).not.toContain(LONG_NOTICE);
  });
});

describe("buildStatsViewData active-pregnancy prediction suppression", () => {
  // A period logged AFTER the latest positive test lifts
  // resolvePregnancyPause's own pause (cycle-history-service, untouched) --
  // during an ACTIVE pregnancy that lift is medically wrong, and stats has no
  // dashboard-style mode switch to hide the leak. Mirrors the calendar's
  // lifted-pause fixture: three completed cycles unlock insights, then a
  // positive test (2026-03-20) followed by a logged period (2026-03-25) that
  // re-anchors the projection mid-pregnancy. The varied cycle lengths
  // (26/30/28) force a multi-day next-period window so the unsuppressed
  // prediction explanation is deterministically non-empty; the day-10
  // headache pattern plus BBT/mucus/LH records after the phantom anchor make
  // every gated section render in the unsuppressed regression guard.
  const liftedPauseProfile = createProfileRecord({
    lastPeriodStart: "2025-12-20",
    trackBBT: true,
  });
  const liftedPauseRecords: DayLogRecord[] = [
    createPeriodRecord("2025-12-20"),
    { ...createEmptyDayLogRecord("2025-12-29"), symptomIDs: ["headache"] },
    createPeriodRecord("2026-01-15"),
    { ...createEmptyDayLogRecord("2026-01-24"), symptomIDs: ["headache"] },
    createPeriodRecord("2026-02-14"),
    { ...createEmptyDayLogRecord("2026-02-23"), symptomIDs: ["headache"] },
    createPeriodRecord("2026-03-14"),
    { ...createEmptyDayLogRecord("2026-03-20"), pregnancyTest: "positive" },
    {
      ...createEmptyDayLogRecord("2026-03-25"),
      isPeriod: true,
      cycleStart: true,
      bbt: 36.4,
    },
    { ...createEmptyDayLogRecord("2026-03-26"), bbt: 36.5 },
    {
      ...createEmptyDayLogRecord("2026-03-27"),
      bbt: 36.45,
      cervicalMucus: "eggwhite",
    },
    { ...createEmptyDayLogRecord("2026-03-28"), bbt: 36.6, lhTest: "peak" },
    { ...createEmptyDayLogRecord("2026-03-29"), bbt: 36.55 },
  ];
  const liftedPauseNow = new Date(2026, 2, 29);
  const premiumFeatures = {
    advancedFertility: true,
    advancedInsights: true,
    doctorPDF: false,
    extendedReports: false,
    partnerAccess: false,
    reminders: false,
  };

  it("still renders prediction-bearing sections once the pause lifts and no suppression flag is set (regression guard -- e.g. no active pregnancy)", () => {
    const viewData = buildStatsViewData(
      liftedPauseProfile,
      liftedPauseRecords,
      createDefaultSymptomRecords(),
      liftedPauseNow,
      "en",
      premiumFeatures,
    );

    expect(viewData.hasInsights).toBe(true);
    expect(viewData.bbtTrend?.points).toHaveLength(5);
    expect(viewData.predictionExplanation).toBe(
      "Your cycle length varies, so the next period is shown as a range rather than a single day.",
    );
    expect(viewData.topCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "mucus-fertility" }),
      ]),
    );
    expect(viewData.personalForecasts?.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "headache" })]),
    );
    expect(viewData.advancedFertility?.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "lh-peak" })]),
    );
  });

  it("suppresses prediction-bearing sections for an active pregnancy even after the pause lifts, keeping completed-cycle facts", () => {
    // Sanity check on the fixture itself: cycle-history-service's own pause
    // IS lifted here (this is the exact hole the flag closes on this surface).
    const history = buildCycleHistorySummary(
      liftedPauseProfile,
      liftedPauseRecords,
      liftedPauseNow,
    );
    const projection = buildCurrentCycleProjection(
      liftedPauseProfile,
      history,
      liftedPauseRecords,
      liftedPauseNow,
    );
    expect(projection.isPregnancyPaused).toBe(false);

    const viewData = buildStatsViewData(
      liftedPauseProfile,
      liftedPauseRecords,
      createDefaultSymptomRecords(),
      liftedPauseNow,
      "en",
      premiumFeatures,
      { suppressPredictions: true },
    );

    expect(viewData.bbtTrend).toBeUndefined();
    expect(viewData.predictionExplanation).toBe("");
    expect(viewData.personalForecasts).toBeUndefined();
    expect(viewData.topCards).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "mucus-fertility" }),
      ]),
    );
    const phaseCard = viewData.topCards.find(
      (card) => card.key === "current-phase",
    );
    expect(phaseCard?.value).toContain("Unknown");
    expect(phaseCard?.description).toBeUndefined();
    // Current-cycle fertility signals drop; completed-cycle facts stay.
    expect(viewData.advancedFertility?.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "lh-peak" })]),
    );
    expect(viewData.advancedFertility?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "signal-coverage" }),
      ]),
    );
    // Historical facts untouched by suppression -- including the 11-day
    // "cycle" the phantom period closed: logged data stays a fact, only
    // prediction framing is suppressed.
    expect(viewData.hasInsights).toBe(true);
    expect(viewData.trendChart?.points).toHaveLength(4);
    expect(viewData.predictionDisclaimer).toBe(
      "These are estimates, not medical advice or a method of contraception.",
    );
  });

  it("suppresses predictions end-to-end via loadStatsScreenState when a pregnancy is active and the pause has lifted", async () => {
    const storage = createVolatileWebAppStorage();
    await storage.writeProfileRecord(liftedPauseProfile);
    for (const record of liftedPauseRecords) {
      await storage.writeDayLogRecord(record);
    }
    await storage.writePregnancyRecord(
      createPregnancyRecord({
        edd: "2026-12-19",
        eddBasis: "lmp",
        lmpDate: "2026-03-14",
        startedAt: "2026-03-14",
      }),
    );

    const state = await loadStatsScreenState(storage, liftedPauseNow);

    expect(state.viewData.hasInsights).toBe(true);
    expect(state.viewData.bbtTrend).toBeUndefined();
    expect(state.viewData.predictionExplanation).toBe("");
    expect(state.viewData.topCards).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "mucus-fertility" }),
      ]),
    );
    const phaseCard = state.viewData.topCards.find(
      (card) => card.key === "current-phase",
    );
    expect(phaseCard?.description).toBeUndefined();
  });
});

describe("buildStatsViewData day-log pause prediction suppression", () => {
  // The un-lifted counterpart of the fixture above: the same three completed
  // cycles and post-anchor BBT/mucus/LH signals, but the positive test
  // (2026-03-20) is never followed by a logged period, so
  // resolvePregnancyPause's own pause HOLDS. The paused projection
  // deliberately keeps cycleAnchorDate (2026-03-14), which is exactly why the
  // builder must OR the pause into suppression itself: without it the BBT
  // trend/coverline, the mucus peak-fertility card, and the current-cycle
  // fertility signals all kept rendering for a paused owner — e.g. one who
  // logged a positive test but never started (or cannot start) the pregnancy
  // module, so no active record ever covers the gap.
  const activePauseProfile = createProfileRecord({
    lastPeriodStart: "2025-12-20",
    trackBBT: true,
  });
  const activePauseRecords: DayLogRecord[] = [
    createPeriodRecord("2025-12-20"),
    { ...createEmptyDayLogRecord("2025-12-29"), symptomIDs: ["headache"] },
    createPeriodRecord("2026-01-15"),
    { ...createEmptyDayLogRecord("2026-01-24"), symptomIDs: ["headache"] },
    createPeriodRecord("2026-02-14"),
    { ...createEmptyDayLogRecord("2026-02-23"), symptomIDs: ["headache"] },
    createPeriodRecord("2026-03-14"),
    { ...createEmptyDayLogRecord("2026-03-20"), pregnancyTest: "positive" },
    { ...createEmptyDayLogRecord("2026-03-25"), bbt: 36.4 },
    { ...createEmptyDayLogRecord("2026-03-26"), bbt: 36.5 },
    {
      ...createEmptyDayLogRecord("2026-03-27"),
      bbt: 36.45,
      cervicalMucus: "eggwhite",
    },
    { ...createEmptyDayLogRecord("2026-03-28"), bbt: 36.6, lhTest: "peak" },
    { ...createEmptyDayLogRecord("2026-03-29"), bbt: 36.55 },
  ];
  const activePauseNow = new Date(2026, 2, 29);
  const premiumFeatures = {
    advancedFertility: true,
    advancedInsights: true,
    doctorPDF: false,
    extendedReports: false,
    partnerAccess: false,
    reminders: false,
  };

  it("hides BBT trend, the peak-fertility card, and current-cycle fertility signals while the day-log pause is active (no pregnancy record)", () => {
    const history = buildCycleHistorySummary(
      activePauseProfile,
      activePauseRecords,
      activePauseNow,
    );
    const projection = buildCurrentCycleProjection(
      activePauseProfile,
      history,
      activePauseRecords,
      activePauseNow,
    );
    // Fixture sanity: the pause HOLDS and still carries the anchor the gated
    // sections would otherwise render from.
    expect(projection.isPregnancyPaused).toBe(true);
    expect(projection.cycleAnchorDate).toBe("2026-03-14");

    const viewData = buildStatsViewData(
      activePauseProfile,
      activePauseRecords,
      createDefaultSymptomRecords(),
      activePauseNow,
      "en",
      premiumFeatures,
    );

    expect(viewData.hasInsights).toBe(true);
    expect(viewData.bbtTrend).toBeUndefined();
    expect(viewData.topCards).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "mucus-fertility" }),
      ]),
    );
    const phaseCard = viewData.topCards.find(
      (card) => card.key === "current-phase",
    );
    expect(phaseCard?.value).toContain("Unknown");
    expect(phaseCard?.description).toBeUndefined();
    // Current-cycle fertility signals drop; completed-cycle facts stay.
    expect(viewData.advancedFertility?.items).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "lh-peak" })]),
    );
    expect(viewData.advancedFertility?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "signal-coverage" }),
      ]),
    );
    expect(viewData.personalForecasts).toBeUndefined();
    // The copy split stays: a plain day-log pause keeps its own hint (an
    // active record blanks it — pinned by the suppression describe above).
    expect(viewData.predictionExplanation).toBe(
      "Cycle predictions are paused after a positive pregnancy test. Log a new period to resume them.",
    );
    // Historical facts untouched by suppression.
    expect(viewData.trendChart?.points).toHaveLength(3);
  });
});
