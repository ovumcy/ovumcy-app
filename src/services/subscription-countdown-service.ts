import type { ManagedCloudActiveSubscription } from "../sync/managed-cloud-api-client";

export type SubscriptionCountdownKind =
  | "none"
  | "trialing"
  | "active"
  | "canceling"
  | "ended";

export type SubscriptionCountdown = {
  kind: SubscriptionCountdownKind;
  // daysRemaining is whole days from `now` until the current period ends,
  // rounded UP (a period ending in 2h still reads as "1 day left", never 0
  // while it is live) and clamped to >= 0. Null when there is nothing to count
  // down to (kind === "none", or the timestamps could not be parsed).
  daysRemaining: number | null;
  periodEndsAtISO: string | null;
  // willRenew is true only for a trialing or active subscription not set to
  // cancel at period end; any other status has no confirmed renewal.
  willRenew: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Managed subscription statuses (billing contract): "trialing" | "active" |
// "grace_period" | "past_due" | "canceled" | "expired". Only "trialing" and
// "active" can roll over on their own. "grace_period" and "past_due" have an
// unconfirmed renewal that a payment retry may still charge, so they count
// down like a plan set to end (which keeps the account-deletion warning).
// "canceled", "expired" and any unknown status read as ended.
type LiveCountdownKind = "trialing" | "active" | "canceling" | "ended";

function resolveLiveCountdownKind(
  subscription: ManagedCloudActiveSubscription,
): LiveCountdownKind {
  switch (subscription.status) {
    // Check trialing before cancelAtPeriodEnd so a trial that will not renew
    // is reported as "trialing" (with its countdown) rather than "canceling".
    // "canceling" is reserved for paid plans set not to auto-renew.
    case "trialing":
      return "trialing";
    case "active":
      return subscription.cancelAtPeriodEnd ? "canceling" : "active";
    case "grace_period":
    case "past_due":
      return "canceling";
    default:
      return "ended";
  }
}

function willSubscriptionRenew(
  subscription: ManagedCloudActiveSubscription,
): boolean {
  return (
    (subscription.status === "trialing" || subscription.status === "active") &&
    !subscription.cancelAtPeriodEnd
  );
}

// describeSubscriptionCountdown reduces a billing subscription row plus the
// current time into a small, locale-agnostic shape the UI can render. The
// caller supplies `nowISO` (rather than reading the clock here) so the result
// is deterministic and unit-testable.
export function describeSubscriptionCountdown(
  subscription: ManagedCloudActiveSubscription | null,
  nowISO: string,
): SubscriptionCountdown {
  if (!subscription) {
    return {
      kind: "none",
      daysRemaining: null,
      periodEndsAtISO: null,
      willRenew: false,
    };
  }

  const endMs = Date.parse(subscription.currentPeriodEndsAt);
  const nowMs = Date.parse(nowISO);

  if (Number.isNaN(endMs) || Number.isNaN(nowMs)) {
    // Unparseable timestamps: surface the plan status without a countdown
    // rather than inventing a day count.
    return {
      kind: resolveLiveCountdownKind(subscription),
      daysRemaining: null,
      periodEndsAtISO: subscription.currentPeriodEndsAt || null,
      willRenew: willSubscriptionRenew(subscription),
    };
  }

  const periodEndsAtISO = subscription.currentPeriodEndsAt;
  const remainingMs = endMs - nowMs;

  if (remainingMs <= 0) {
    return {
      kind: "ended",
      daysRemaining: 0,
      periodEndsAtISO,
      willRenew: false,
    };
  }

  const kind = resolveLiveCountdownKind(subscription);
  return {
    kind,
    daysRemaining: kind === "ended" ? 0 : Math.ceil(remainingMs / MS_PER_DAY),
    periodEndsAtISO,
    willRenew: willSubscriptionRenew(subscription),
  };
}

// SubscriptionCountdownCopy is the locale-specific surface the UI passes in so
// the formatter stays free of i18n details. The day-count functions only ever
// receive whole counts >= 1; "ended" is a static label (no count to show).
export type SubscriptionCountdownCopy = {
  trial: (days: number) => string;
  active: (days: number) => string;
  canceling: (days: number) => string;
  ended: string;
};

// formatSubscriptionCountdownMessage renders a countdown into the single line
// shown on Backup & Sync. It returns "" when there is nothing to show — no
// subscription, or a live plan whose timestamps could not be parsed into a day
// count — so the caller can simply skip an empty banner line.
export function formatSubscriptionCountdownMessage(
  countdown: SubscriptionCountdown,
  copy: SubscriptionCountdownCopy,
): string {
  if (countdown.kind === "ended") {
    return copy.ended;
  }
  if (countdown.daysRemaining === null) {
    return "";
  }
  switch (countdown.kind) {
    case "trialing":
      return copy.trial(countdown.daysRemaining);
    case "active":
      return copy.active(countdown.daysRemaining);
    case "canceling":
      return copy.canceling(countdown.daysRemaining);
    default:
      return "";
  }
}
