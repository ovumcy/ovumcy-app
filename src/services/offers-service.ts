import type {
  ManagedCloudBillingOffer,
} from "../sync/managed-cloud-api-client";
import type { LocalAppStorage } from "../storage/local/storage-contract";

export const KNOWN_BILLING_OFFER_KINDS = [
  "subscription_promo",
  "announcement",
] as const;

export type BillingOfferKind = (typeof KNOWN_BILLING_OFFER_KINDS)[number];

// The only in-app destination an offer may open in v1. Unknown screens are
// dropped rather than routed, so a newer server cannot steer an older app
// into an arbitrary route.
export const KNOWN_BILLING_OFFER_SCREENS = ["backup-sync"] as const;

export type ResolvedBillingOfferAction =
  | {
      type: "play_checkout";
      productId: string | null;
      basePlanId: string | null;
      offerId: string | null;
    }
  | {
      type: "screen";
      screen: "backup-sync";
    };

export type ResolvedBillingOffer = {
  id: string;
  kind: BillingOfferKind;
  title: string;
  body: string;
  cta: string;
  action: ResolvedBillingOfferAction;
};

function isKnownOfferKind(value: string): value is BillingOfferKind {
  return (KNOWN_BILLING_OFFER_KINDS as readonly string[]).includes(value);
}

function isKnownOfferScreen(
  value: string | null,
): value is (typeof KNOWN_BILLING_OFFER_SCREENS)[number] {
  return (
    value !== null &&
    (KNOWN_BILLING_OFFER_SCREENS as readonly string[]).includes(value)
  );
}

export function isBillingOfferWithinWindow(
  offer: Pick<ManagedCloudBillingOffer, "startsAt" | "endsAt">,
  now: Date,
): boolean {
  const nowMs = now.getTime();

  if (offer.startsAt !== null) {
    const startsMs = Date.parse(offer.startsAt);
    // An unparseable window bound means the display window cannot be
    // trusted; hide the offer instead of guessing.
    if (Number.isNaN(startsMs) || nowMs < startsMs) {
      return false;
    }
  }

  if (offer.endsAt !== null) {
    const endsMs = Date.parse(offer.endsAt);
    if (Number.isNaN(endsMs) || nowMs > endsMs) {
      return false;
    }
  }

  return true;
}

export function resolveBillingOfferCopy(
  offer: Pick<ManagedCloudBillingOffer, "copy">,
  language: string,
): { title: string; body: string; cta: string } | null {
  return offer.copy[language] ?? offer.copy.en ?? null;
}

function resolveBillingOfferAction(
  offer: Pick<ManagedCloudBillingOffer, "action">,
): ResolvedBillingOfferAction | null {
  if (offer.action.type === "play_checkout") {
    return {
      type: "play_checkout",
      productId: offer.action.productId,
      basePlanId: offer.action.basePlanId,
      offerId: offer.action.offerId,
    };
  }

  if (offer.action.type === "screen") {
    if (!isKnownOfferScreen(offer.action.screen)) {
      return null;
    }
    return {
      type: "screen",
      screen: offer.action.screen,
    };
  }

  return null;
}

/**
 * resolveVisibleBillingOffers narrows the tolerant client shape down to the
 * offers this app version can actually render:
 * - only known kinds and action types (unknown → dropped, forward-tolerant);
 * - only offers inside their [startsAt, endsAt] window at `now`;
 * - copy resolved for the active interface language with "en" fallback
 *   (offers without either localisation are dropped);
 * - dismissed offer ids excluded;
 * - duplicate ids collapsed to the first occurrence.
 */
export function resolveVisibleBillingOffers(input: {
  offers: readonly ManagedCloudBillingOffer[];
  now: Date;
  language: string;
  dismissedOfferIDs: readonly string[];
}): ResolvedBillingOffer[] {
  const dismissed = new Set(input.dismissedOfferIDs);
  const seenIDs = new Set<string>();
  const resolved: ResolvedBillingOffer[] = [];

  for (const offer of input.offers) {
    if (seenIDs.has(offer.id) || dismissed.has(offer.id)) {
      continue;
    }
    if (!isKnownOfferKind(offer.kind)) {
      continue;
    }
    if (!isBillingOfferWithinWindow(offer, input.now)) {
      continue;
    }

    const action = resolveBillingOfferAction(offer);
    if (!action) {
      continue;
    }

    const copy = resolveBillingOfferCopy(offer, input.language);
    if (!copy) {
      continue;
    }

    seenIDs.add(offer.id);
    resolved.push({
      id: offer.id,
      kind: offer.kind,
      title: copy.title,
      body: copy.body,
      cta: copy.cta,
      action,
    });
  }

  return resolved;
}

/**
 * dismissBillingOffer persists an offer dismissal in the managed billing
 * cache record (same singleton as the offline-grace snapshot) without
 * clobbering the cached snapshot. Returns the updated dismissed-id list.
 */
export async function dismissBillingOffer(
  storage: LocalAppStorage,
  offerID: string,
): Promise<string[]> {
  const record = await storage.readManagedBillingCacheRecord();
  if (record.dismissedOfferIDs.includes(offerID)) {
    return record.dismissedOfferIDs;
  }

  const nextDismissed = [...record.dismissedOfferIDs, offerID];
  await storage.writeManagedBillingCacheRecord({
    ...record,
    dismissedOfferIDs: nextDismissed,
  });
  return nextDismissed;
}

export async function readDismissedBillingOfferIDs(
  storage: LocalAppStorage,
): Promise<string[]> {
  const record = await storage.readManagedBillingCacheRecord();
  return record.dismissedOfferIDs;
}
