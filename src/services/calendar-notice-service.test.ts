import { buildCalendarPredictionNotice } from "./calendar-notice-service";

describe("buildCalendarPredictionNotice without options", () => {
  it("resolves the persistent mode notices exactly as before the options parameter existed", () => {
    const notice = buildCalendarPredictionNotice(
      {
        dismissedCalendarPredictionNoticeKey: null,
        irregularCycle: true,
        unpredictableCycle: false,
      },
      "en",
    );

    expect(notice).toEqual(
      expect.objectContaining({
        dismissalScope: "persistent",
        key: "calendar_irregular_prediction_notice_v1",
      }),
    );
  });
});

describe("calendar awaiting-cycle-start notice", () => {
  const base = {
    dismissedCalendarPredictionNoticeKey: null,
    irregularCycle: false,
    unpredictableCycle: false,
  };

  it("explains the empty calendar as a session notice when no cycle start exists", () => {
    expect(
      buildCalendarPredictionNotice(base, "en", { awaitingCycleStart: true }),
    ).toEqual({
      dismissalScope: "session",
      dismissLabel: "Dismiss notice",
      key: "calendar_awaiting_cycle_start_notice_v1",
      message: expect.stringContaining("No cycle start is logged yet"),
    });
  });

  it("outranks the irregular notice but yields to pregnancy and facts-only", () => {
    const awaiting = { awaitingCycleStart: true };
    expect(
      buildCalendarPredictionNotice({ ...base, irregularCycle: true }, "en", awaiting)?.key,
    ).toBe("calendar_awaiting_cycle_start_notice_v1");
    expect(
      buildCalendarPredictionNotice({ ...base, unpredictableCycle: true }, "en", awaiting)?.key,
    ).toBe("calendar_unpredictable_prediction_notice_v1");
    expect(
      buildCalendarPredictionNotice(base, "en", { ...awaiting, pregnancyActive: true })?.key,
    ).toBe("calendar_pregnancy_paused_prediction_notice_v1");
  });
});
