import * as fc from "fast-check";

import type { ManagedCloudBillingOffer } from "../sync/managed-cloud-api-client";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createDefaultManagedBillingCacheRecord } from "../storage/local/storage-contract";
import {
  dismissBillingOffer,
  isBillingOfferWithinWindow,
  resolveBillingOfferCopy,
  resolveVisibleBillingOffers,
} from "./offers-service";

const NOW = new Date("2026-07-01T12:00:00.000Z");

function makeOffer(
  overrides: Partial<ManagedCloudBillingOffer> = {},
): ManagedCloudBillingOffer {
  return {
    id: "offer-1",
    kind: "subscription_promo",
    audience: [],
    startsAt: null,
    endsAt: null,
    copy: {
      en: { title: "Title", body: "Body", cta: "CTA" },
    },
    action: {
      type: "play_checkout",
      productId: "premium",
      basePlanId: "monthly",
      offerId: null,
      screen: null,
    },
    ...overrides,
  };
}

describe("offers-service resolveVisibleBillingOffers", () => {
  it("keeps an in-window known offer and resolves copy for the active language", () => {
    const resolved = resolveVisibleBillingOffers({
      offers: [
        makeOffer({
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: "2026-08-01T00:00:00.000Z",
          copy: {
            en: { title: "EN title", body: "EN body", cta: "EN cta" },
            ru: { title: "RU заголовок", body: "RU текст", cta: "RU кнопка" },
          },
        }),
      ],
      now: NOW,
      language: "ru",
      dismissedOfferIDs: [],
    });

    expect(resolved).toEqual([
      {
        id: "offer-1",
        kind: "subscription_promo",
        title: "RU заголовок",
        body: "RU текст",
        cta: "RU кнопка",
        action: {
          type: "play_checkout",
          productId: "premium",
          basePlanId: "monthly",
          offerId: null,
        },
      },
    ]);
  });

  it("falls back to English copy and drops offers without en or active-language copy", () => {
    const resolved = resolveVisibleBillingOffers({
      offers: [
        makeOffer({ id: "with-en" }),
        makeOffer({
          id: "de-only",
          copy: { de: { title: "T", body: "B", cta: "C" } },
        }),
      ],
      now: NOW,
      language: "fr",
      dismissedOfferIDs: [],
    });

    expect(resolved.map((offer) => offer.id)).toEqual(["with-en"]);
    expect(resolved[0]?.title).toBe("Title");
  });

  it("drops offers outside the date window, including unparseable bounds", () => {
    const resolved = resolveVisibleBillingOffers({
      offers: [
        makeOffer({ id: "not-yet", startsAt: "2026-07-02T00:00:00.000Z" }),
        makeOffer({ id: "expired", endsAt: "2026-06-30T00:00:00.000Z" }),
        makeOffer({ id: "broken-window", startsAt: "not-a-date" }),
        makeOffer({
          id: "active",
          startsAt: "2026-07-01T00:00:00.000Z",
          endsAt: "2026-07-01T23:59:59.000Z",
        }),
      ],
      now: NOW,
      language: "en",
      dismissedOfferIDs: [],
    });

    expect(resolved.map((offer) => offer.id)).toEqual(["active"]);
  });

  it("excludes dismissed ids and collapses duplicate ids to the first occurrence", () => {
    const resolved = resolveVisibleBillingOffers({
      offers: [
        makeOffer({ id: "dismissed" }),
        makeOffer({
          id: "kept",
          copy: { en: { title: "First", body: "B", cta: "C" } },
        }),
        makeOffer({
          id: "kept",
          copy: { en: { title: "Duplicate", body: "B", cta: "C" } },
        }),
      ],
      now: NOW,
      language: "en",
      dismissedOfferIDs: ["dismissed"],
    });

    expect(resolved.map((offer) => offer.title)).toEqual(["First"]);
  });

  it("drops unknown kinds, unknown action types, and unknown screens", () => {
    const resolved = resolveVisibleBillingOffers({
      offers: [
        makeOffer({ id: "future-kind", kind: "flash_sale" }),
        makeOffer({
          id: "future-action",
          action: {
            type: "open_url",
            productId: null,
            basePlanId: null,
            offerId: null,
            screen: null,
          },
        }),
        makeOffer({
          id: "unknown-screen",
          kind: "announcement",
          action: {
            type: "screen",
            productId: null,
            basePlanId: null,
            offerId: null,
            screen: "secret-admin",
          },
        }),
        makeOffer({
          id: "known-screen",
          kind: "announcement",
          action: {
            type: "screen",
            productId: null,
            basePlanId: null,
            offerId: null,
            screen: "backup-sync",
          },
        }),
      ],
      now: NOW,
      language: "en",
      dismissedOfferIDs: [],
    });

    expect(resolved).toEqual([
      {
        id: "known-screen",
        kind: "announcement",
        title: "Title",
        body: "Body",
        cta: "CTA",
        action: { type: "screen", screen: "backup-sync" },
      },
    ]);
  });

  it("property: never throws, never resolves dismissed/unknown/out-of-window offers", () => {
    const copyEntryArb = fc.record({
      title: fc.string(),
      body: fc.string(),
      cta: fc.string(),
    });
    const offerArb: fc.Arbitrary<ManagedCloudBillingOffer> = fc.record({
      id: fc.string(),
      kind: fc.oneof(
        fc.constant("subscription_promo"),
        fc.constant("announcement"),
        fc.string(),
      ),
      audience: fc.array(fc.string(), { maxLength: 3 }),
      startsAt: fc.oneof(
        fc.constant<string | null>(null),
        fc
          .date({
            min: new Date("2020-01-01T00:00:00.000Z"),
            max: new Date("2030-01-01T00:00:00.000Z"),
          })
          .map((date) => date.toISOString()),
        fc.string(),
      ),
      endsAt: fc.oneof(
        fc.constant<string | null>(null),
        fc
          .date({
            min: new Date("2020-01-01T00:00:00.000Z"),
            max: new Date("2030-01-01T00:00:00.000Z"),
          })
          .map((date) => date.toISOString()),
        fc.string(),
      ),
      copy: fc.dictionary(
        fc.constantFrom("en", "ru", "de", "fr", "es", "xx"),
        copyEntryArb,
        { maxKeys: 6 },
      ),
      action: fc.record({
        type: fc.oneof(
          fc.constant("play_checkout"),
          fc.constant("screen"),
          fc.string(),
        ),
        productId: fc.option(fc.string(), { nil: null }),
        basePlanId: fc.option(fc.string(), { nil: null }),
        offerId: fc.option(fc.string(), { nil: null }),
        screen: fc.oneof(
          fc.constant<string | null>(null),
          fc.constant("backup-sync"),
          fc.string(),
        ),
      }),
    });

    fc.assert(
      fc.property(
        fc.array(offerArb, { maxLength: 12 }),
        fc.array(fc.string(), { maxLength: 6 }),
        fc.constantFrom("en", "ru", "de", "fr", "es"),
        (offers, dismissedOfferIDs, language) => {
          const resolved = resolveVisibleBillingOffers({
            offers,
            now: NOW,
            language,
            dismissedOfferIDs,
          });

          const seen = new Set<string>();
          for (const offer of resolved) {
            // Invariants of every rendered offer:
            expect(dismissedOfferIDs).not.toContain(offer.id);
            expect(["subscription_promo", "announcement"]).toContain(offer.kind);
            expect(seen.has(offer.id)).toBe(false);
            seen.add(offer.id);
            if (offer.action.type === "screen") {
              expect(offer.action.screen).toBe("backup-sync");
            } else {
              expect(offer.action.type).toBe("play_checkout");
            }
            // The resolver keeps the first PASSING occurrence of an id, so a
            // duplicate id may resolve from a later entry — assert that SOME
            // source with this id satisfies the window + copy invariants.
            const sources = offers.filter(
              (candidate) => candidate.id === offer.id,
            );
            expect(
              sources.some(
                (candidate) =>
                  isBillingOfferWithinWindow(candidate, NOW) &&
                  resolveBillingOfferCopy(candidate, language) !== null,
              ),
            ).toBe(true);
          }
        },
      ),
    );
  });
});

describe("offers-service dismissBillingOffer", () => {
  it("appends the id without clobbering the cached snapshot and dedupes repeats", async () => {
    const record = {
      ...createDefaultManagedBillingCacheRecord(),
      snapshot: {
        hasActivePlan: true,
        premiumFeatures: {
          advancedFertility: true,
          advancedInsights: false,
          doctorPDF: false,
          extendedReports: false,
          partnerAccess: false,
          reminders: false,
        },
        fetchedAt: "2026-07-01T00:00:00.000Z",
      },
      dismissedOfferIDs: ["existing"],
    };
    const storage = createLocalAppStorageMock({
      readManagedBillingCacheRecord: jest.fn().mockResolvedValue(record),
    });

    await expect(dismissBillingOffer(storage, "offer-9")).resolves.toEqual([
      "existing",
      "offer-9",
    ]);
    expect(storage.writeManagedBillingCacheRecord).toHaveBeenCalledWith({
      ...record,
      dismissedOfferIDs: ["existing", "offer-9"],
    });

    // Repeat dismissal is a no-op write-wise.
    (storage.readManagedBillingCacheRecord as jest.Mock).mockResolvedValue({
      ...record,
      dismissedOfferIDs: ["existing", "offer-9"],
    });
    await expect(dismissBillingOffer(storage, "offer-9")).resolves.toEqual([
      "existing",
      "offer-9",
    ]);
    expect(storage.writeManagedBillingCacheRecord).toHaveBeenCalledTimes(1);
  });
});
