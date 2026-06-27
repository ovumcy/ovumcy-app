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
  // willRenew is false when the subscription is set to cancel at period end or
  // has already ended; true while it is expected to roll over into a new period.
  willRenew: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
    // rather than inventing a day count. cancelAtPeriodEnd takes priority
    // over trialing so that a canceling subscription is never misreported
    // as active.
    const kind = subscription.cancelAtPeriodEnd
      ? "canceling"
      : subscription.status === "trialing"
        ? "trialing"
        : "active";
    return {
      kind,
      daysRemaining: null,
      periodEndsAtISO: subscription.currentPeriodEndsAt || null,
      willRenew: !subscription.cancelAtPeriodEnd,
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

  const daysRemaining = Math.ceil(remainingMs / MS_PER_DAY);

  // Check trialing before cancelAtPeriodEnd so a trial that will not renew
  // is reported as "trialing" (with its countdown) rather than "canceling".
  // "canceling" is reserved for paid plans set not to auto-renew.
  if (subscription.status === "trialing") {
    return { kind: "trialing", daysRemaining, periodEndsAtISO, willRenew: !subscription.cancelAtPeriodEnd };
  }
  if (subscription.cancelAtPeriodEnd) {
    return { kind: "canceling", daysRemaining, periodEndsAtISO, willRenew: false };
  }
  return { kind: "active", daysRemaining, periodEndsAtISO, willRenew: true };
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
