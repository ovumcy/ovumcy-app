import {
  describeSubscriptionCountdown,
  formatSubscriptionCountdownMessage,
  type SubscriptionCountdown,
} from "./subscription-countdown-service";
import type { ManagedCloudActiveSubscription } from "../sync/managed-cloud-api-client";
import { getSubscriptionCopy } from "../i18n/subscription-copy";

function sub(
  overrides: Partial<ManagedCloudActiveSubscription> = {},
): ManagedCloudActiveSubscription {
  return {
    planCode: "ovumcy_cloud",
    planName: "Ovumcy Cloud",
    billingInterval: "month",
    source: "trial",
    status: "trialing",
    currency: "EUR",
    amountMinor: 499,
    displayAmount: "€4.99",
    currentPeriodStartsAt: "2026-05-31T00:00:00.000Z",
    currentPeriodEndsAt: "2026-06-30T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    ...overrides,
  };
}

describe("describeSubscriptionCountdown", () => {
  it("returns 'none' when there is no subscription", () => {
    expect(
      describeSubscriptionCountdown(null, "2026-06-01T00:00:00.000Z"),
    ).toEqual({
      kind: "none",
      daysRemaining: null,
      periodEndsAtISO: null,
      willRenew: false,
    });
  });

  it("counts whole trial days remaining to the period end", () => {
    const result = describeSubscriptionCountdown(
      sub({ status: "trialing", currentPeriodEndsAt: "2026-06-30T00:00:00.000Z" }),
      "2026-06-01T00:00:00.000Z",
    );
    expect(result.kind).toBe("trialing");
    expect(result.daysRemaining).toBe(29);
    expect(result.willRenew).toBe(true);
    expect(result.periodEndsAtISO).toBe("2026-06-30T00:00:00.000Z");
  });

  it("rounds a partial final day up to a whole day", () => {
    const result = describeSubscriptionCountdown(
      sub({ currentPeriodEndsAt: "2026-06-02T01:00:00.000Z" }),
      "2026-06-01T00:00:00.000Z",
    );
    // 25h remaining -> ceil -> 2 days, never reported as 1.04
    expect(result.daysRemaining).toBe(2);
  });

  it("treats an active (non-trial) subscription as 'active'", () => {
    const result = describeSubscriptionCountdown(
      sub({ status: "active", source: "subscription" }),
      "2026-06-01T00:00:00.000Z",
    );
    expect(result.kind).toBe("active");
    expect(result.willRenew).toBe(true);
  });

  it("reports 'trialing' (no renew) when trialing+cancelAtPeriodEnd — trial kind takes priority", () => {
    // Previously this returned kind="canceling"; now trialing outranks cancelAtPeriodEnd
    // so the UI can show the trial countdown. willRenew=false signals non-renewal.
    const result = describeSubscriptionCountdown(
      sub({ status: "trialing", cancelAtPeriodEnd: true }),
      "2026-06-01T00:00:00.000Z",
    );
    expect(result.kind).toBe("trialing");
    expect(result.willRenew).toBe(false);
    expect(result.daysRemaining).toBe(29);
  });

  it("reports 'canceling' (no renew) when a PAID plan has cancelAtPeriodEnd set", () => {
    const result = describeSubscriptionCountdown(
      sub({ status: "active", source: "subscription", cancelAtPeriodEnd: true }),
      "2026-06-01T00:00:00.000Z",
    );
    expect(result.kind).toBe("canceling");
    expect(result.willRenew).toBe(false);
    expect(result.daysRemaining).toBe(29);
  });

  it("reports 'ended' once the period end is in the past", () => {
    const result = describeSubscriptionCountdown(
      sub({ currentPeriodEndsAt: "2026-05-30T00:00:00.000Z" }),
      "2026-06-01T00:00:00.000Z",
    );
    expect(result.kind).toBe("ended");
    expect(result.daysRemaining).toBe(0);
    expect(result.willRenew).toBe(false);
  });

  it("treats the exact expiry instant as ended", () => {
    const at = "2026-06-30T00:00:00.000Z";
    const result = describeSubscriptionCountdown(sub({ currentPeriodEndsAt: at }), at);
    expect(result.kind).toBe("ended");
    expect(result.daysRemaining).toBe(0);
  });

  it("keeps a sub-day remainder live (1 day) right before expiry", () => {
    const result = describeSubscriptionCountdown(
      sub({ status: "active", currentPeriodEndsAt: "2026-06-30T00:00:00.000Z" }),
      "2026-06-29T23:00:00.000Z",
    );
    expect(result.kind).toBe("active");
    expect(result.daysRemaining).toBe(1);
  });

  it("falls back to a countdown-less status when timestamps are unparseable", () => {
    const result = describeSubscriptionCountdown(
      sub({ status: "trialing", currentPeriodEndsAt: "not-a-date" }),
      "2026-06-01T00:00:00.000Z",
    );
    expect(result.kind).toBe("trialing");
    expect(result.daysRemaining).toBeNull();
    expect(result.willRenew).toBe(true);
  });

  it("prioritizes trialing over cancelAtPeriodEnd when timestamps are unparseable (matches the live-countdown branch)", () => {
    // Regression: the unparseable-date fallback used to order
    // cancelAtPeriodEnd above trialing, contradicting the live-countdown
    // branch's "trial kind takes priority" rule above. A trialing plan set
    // not to renew must report kind="trialing" here too.
    const result = describeSubscriptionCountdown(
      sub({ status: "trialing", currentPeriodEndsAt: "not-a-date", cancelAtPeriodEnd: true }),
      "2026-06-01T00:00:00.000Z",
    );
    expect(result.kind).toBe("trialing");
    expect(result.daysRemaining).toBeNull();
    expect(result.willRenew).toBe(false);
  });

  it("preserves kind='canceling' with null days when timestamps are unparseable and cancelAtPeriodEnd=true", () => {
    // Previously this collapsed to kind="active"; now cancelAtPeriodEnd is respected
    // even when the period end timestamp is unparseable.
    const result = describeSubscriptionCountdown(
      sub({ status: "active", source: "subscription", currentPeriodEndsAt: "not-a-date", cancelAtPeriodEnd: true }),
      "2026-06-01T00:00:00.000Z",
    );
    expect(result.kind).toBe("canceling");
    expect(result.daysRemaining).toBeNull();
    expect(result.willRenew).toBe(false);
  });
});

describe("formatSubscriptionCountdownMessage", () => {
  function countdown(
    over: Partial<SubscriptionCountdown> = {},
  ): SubscriptionCountdown {
    return {
      kind: "active",
      daysRemaining: 5,
      periodEndsAtISO: "2026-06-30T00:00:00.000Z",
      willRenew: true,
      ...over,
    };
  }

  it("renders English trial and active countdowns with singular/plural days", () => {
    const en = getSubscriptionCopy("en");
    expect(
      formatSubscriptionCountdownMessage(
        countdown({ kind: "trialing", daysRemaining: 1 }),
        en,
      ),
    ).toBe("Free trial — 1 day left");
    expect(
      formatSubscriptionCountdownMessage(
        countdown({ kind: "active", daysRemaining: 3 }),
        en,
      ),
    ).toBe("Premium active — renews in 3 days");
  });

  it("selects the correct Russian plural form for the day count", () => {
    const ru = getSubscriptionCopy("ru");
    const trial = (days: number) =>
      formatSubscriptionCountdownMessage(
        countdown({ kind: "trialing", daysRemaining: days }),
        ru,
      );
    expect(trial(1)).toBe("Пробный период — осталось 1 день");
    expect(trial(2)).toBe("Пробный период — осталось 2 дня");
    expect(trial(5)).toBe("Пробный период — осталось 5 дней");
    expect(trial(11)).toBe("Пробный период — осталось 11 дней");
    expect(trial(21)).toBe("Пробный период — осталось 21 день");
    expect(trial(22)).toBe("Пробный период — осталось 22 дня");
  });

  it("renders a static ended label and nothing for none / unparseable plans", () => {
    expect(
      formatSubscriptionCountdownMessage(
        countdown({ kind: "ended", daysRemaining: 0 }),
        getSubscriptionCopy("ru"),
      ),
    ).toBe("Премиум-план завершён");
    expect(
      formatSubscriptionCountdownMessage(
        countdown({ kind: "none", daysRemaining: null }),
        getSubscriptionCopy("en"),
      ),
    ).toBe("");
    expect(
      formatSubscriptionCountdownMessage(
        countdown({ kind: "trialing", daysRemaining: null }),
        getSubscriptionCopy("en"),
      ),
    ).toBe("");
  });
});
