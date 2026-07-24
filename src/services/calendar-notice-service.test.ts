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
