import type { PostpartumRecord } from "../models/postpartum";
import {
  EPDS_SELF_HARM_ITEM_INDEX,
  createScreeningResponse,
  type ScreeningResponse,
} from "../models/screening";
import {
  buildScreeningHistorySummaryViewData,
  buildScreeningHistoryViewData,
  buildScreeningOfferViewData,
  buildScreeningQuestionnaireViewData,
  buildScreeningResultViewData,
  resolveScreeningBand,
  scoreScreening,
} from "./screening-service";

function activePostpartum(): PostpartumRecord {
  return {
    id: "postpartum_1",
    status: "active",
    startedAt: "2026-05-01",
    modeOfDelivery: "vaginal",
    endedAt: null,
    endReason: null,
  };
}

function response(date: string, answers: number[]): ScreeningResponse {
  return createScreeningResponse({ date, answers });
}

const ZEROS = new Array<number>(10).fill(0);

// Answers that sum to `total` with item 10 = 0 (so the band is isolated from
// the self-harm flag). Spreads the total across items 1-9 in chunks of <=3.
function answersSumming(total: number): number[] {
  const answers = new Array<number>(10).fill(0);
  let remaining = total;
  for (let index = 0; index < EPDS_SELF_HARM_ITEM_INDEX && remaining > 0; index += 1) {
    const value = Math.min(3, remaining);
    answers[index] = value;
    remaining -= value;
  }
  if (remaining > 0) {
    throw new Error("answersSumming: total too large to place with item 10 = 0");
  }
  return answers;
}

describe("scoreScreening + resolveScreeningBand", () => {
  it.each([
    [9, "lower"],
    [10, "elevated"],
    [12, "elevated"],
    [13, "high"],
  ])("bands a score of %i as %s", (score, band) => {
    expect(resolveScreeningBand(score)).toBe(band);
  });

  it("sums answers and bands via scoreScreening", () => {
    expect(scoreScreening(answersSumming(9))).toEqual({
      score: 9,
      selfHarmFlag: false,
      band: "lower",
    });
    expect(scoreScreening(answersSumming(10)).band).toBe("elevated");
    expect(scoreScreening(answersSumming(13)).band).toBe("high");
  });

  it("raises the self-harm flag at total 3 with item 10 = 1 while the band stays lower", () => {
    const answers = [1, 1, 0, 0, 0, 0, 0, 0, 0, 1];
    const result = scoreScreening(answers);
    expect(result.score).toBe(3);
    expect(result.selfHarmFlag).toBe(true);
    expect(result.band).toBe("lower");
  });
});

describe("buildScreeningOfferViewData", () => {
  const today = "2026-07-01";

  it("is not visible when there is no active postpartum record", () => {
    const offer = buildScreeningOfferViewData(null, [], today, "en");
    expect(offer.visible).toBe(false);
    expect(offer.ctaLabel.length).toBeGreaterThan(0);
  });

  it("is not visible when the postpartum record is ended", () => {
    const ended: PostpartumRecord = {
      ...activePostpartum(),
      status: "ended",
      endedAt: "2026-06-01",
      endReason: "manual",
    };
    expect(buildScreeningOfferViewData(ended, [], today, "en").visible).toBe(
      false,
    );
  });

  it("is visible in active postpartum when no screening exists yet", () => {
    expect(
      buildScreeningOfferViewData(activePostpartum(), [], today, "en").visible,
    ).toBe(true);
  });

  it("is not visible when the most recent screening is less than 14 days old", () => {
    const responses = [response("2026-06-20", ZEROS)]; // 11 days before today
    expect(
      buildScreeningOfferViewData(activePostpartum(), responses, today, "en")
        .visible,
    ).toBe(false);
  });

  it("is visible again when the most recent screening is at least 14 days old", () => {
    const responses = [
      response("2026-06-01", ZEROS),
      response("2026-06-17", ZEROS), // exactly 14 days before today
    ];
    expect(
      buildScreeningOfferViewData(activePostpartum(), responses, today, "en")
        .visible,
    ).toBe(true);
  });
});

describe("buildScreeningQuestionnaireViewData", () => {
  it("exposes ten questions each with four scored options and the attribution", () => {
    const viewData = buildScreeningQuestionnaireViewData("en");

    expect(viewData.questions).toHaveLength(10);
    for (const question of viewData.questions) {
      expect(question.options).toHaveLength(4);
    }
    expect(viewData.intro.attribution).toContain("Cox");
    expect(viewData.intro.privacyNote).toContain("encrypted");
  });

  it("maps published option order to the instrument's scoring key", () => {
    const viewData = buildScreeningQuestionnaireViewData("en");

    // Item 1 lists options ascending 0->3.
    expect(viewData.questions[0]?.options.map((option) => option.value)).toEqual(
      [0, 1, 2, 3],
    );
    // Item 3 lists options descending 3->0.
    expect(viewData.questions[2]?.options.map((option) => option.value)).toEqual(
      [3, 2, 1, 0],
    );
    // Item 10 (self-harm) descending: "Never" scores 0, "Yes, quite often" 3.
    const itemTen = viewData.questions[9];
    expect(itemTen?.options.map((option) => option.value)).toEqual([3, 2, 1, 0]);
    expect(itemTen?.options[3]?.label).toBe("Never");
    expect(itemTen?.options[3]?.value).toBe(0);
  });

  it("choosing the max-score option on every item totals 30 and flags self-harm", () => {
    const viewData = buildScreeningQuestionnaireViewData("en");
    const worstAnswers = viewData.questions.map(
      (question) =>
        Math.max(...question.options.map((option) => option.value)),
    );
    expect(scoreScreening(worstAnswers)).toEqual({
      score: 30,
      selfHarmFlag: true,
      band: "high",
    });
  });
});

describe("buildScreeningResultViewData", () => {
  it("renders neutral band copy without a crisis block when the flag is clear", () => {
    const viewData = buildScreeningResultViewData(
      scoreScreening(answersSumming(4)),
      "en",
    );
    expect(viewData.band).toBe("lower");
    expect(viewData.crisisSupport).toBeNull();
    expect(viewData.bandBody.length).toBeGreaterThan(0);
  });

  it("renders the crisis-support block whenever the self-harm flag is raised, overriding the band", () => {
    const viewData = buildScreeningResultViewData(
      scoreScreening([1, 1, 0, 0, 0, 0, 0, 0, 0, 1]),
      "en",
    );
    expect(viewData.band).toBe("lower");
    expect(viewData.crisisSupport).not.toBeNull();
    // Fixed guidance always present; no personal contact was passed.
    expect(viewData.crisisSupport?.guidance).toContain("immediate support");
    expect(viewData.crisisSupport?.contactDisplayLine).toBeNull();
  });

  it("threads a personal crisis contact into the block when the flag is raised", () => {
    const viewData = buildScreeningResultViewData(
      scoreScreening([0, 0, 0, 0, 0, 0, 0, 0, 0, 1]),
      "en",
      { name: "Mum", phone: "07700 900000" },
    );
    expect(viewData.crisisSupport?.contactDisplayLine).toBe(
      "Your support contact: Mum — 07700 900000",
    );
    // A contact never surfaces when the flag is clear (no crisis block at all).
    const clear = buildScreeningResultViewData(
      scoreScreening(answersSumming(2)),
      "en",
      { name: "Mum", phone: "07700 900000" },
    );
    expect(clear.crisisSupport).toBeNull();
  });

  it("uses the firmer high-band copy at or above 13", () => {
    const lower = buildScreeningResultViewData(
      scoreScreening(answersSumming(9)),
      "en",
    );
    const high = buildScreeningResultViewData(
      scoreScreening(answersSumming(13)),
      "en",
    );
    expect(lower.bandBody).not.toBe(high.bandBody);
    expect(high.band).toBe("high");
  });
});

describe("buildScreeningHistoryViewData", () => {
  it("lists rows newest-first with date and score only (no answers)", () => {
    const responses = [
      response("2026-06-01", answersSumming(5)),
      response("2026-07-01", answersSumming(12)),
    ];
    const viewData = buildScreeningHistoryViewData(responses, "en");

    expect(viewData.hasEntries).toBe(true);
    expect(viewData.rows.map((row) => row.date)).toEqual([
      "2026-07-01",
      "2026-06-01",
    ]);
    expect(viewData.rows[0]?.score).toBe(12);
    // The serialized row view-data must not leak the per-item answers.
    expect(JSON.stringify(viewData.rows)).not.toContain("answers");
  });

  it("reports an empty state when there are no responses", () => {
    const viewData = buildScreeningHistoryViewData([], "en");
    expect(viewData.hasEntries).toBe(false);
    expect(viewData.rows).toEqual([]);
    expect(viewData.empty.length).toBeGreaterThan(0);
  });
});

describe("buildScreeningHistorySummaryViewData", () => {
  it("is null when no response exists", () => {
    expect(buildScreeningHistorySummaryViewData([], "en")).toBeNull();
  });

  it("summarizes the most recent response as a last-check-in row", () => {
    const responses = [
      response("2026-06-01", answersSumming(5)),
      response("2026-07-01", answersSumming(12)),
    ];
    const summary = buildScreeningHistorySummaryViewData(responses, "en");
    expect(summary?.label).toContain("2026-07-01");
    expect(summary?.label).toContain("12");
  });
});
