// The only file that imports the store library. Everything it returns is
// mapped onto the transport-free contract, so a library purchase object — and
// the purchase token inside it — never leaves this module.
//
// Only the functions imported below are used. The library also ships purchase
// verification and app-ownership helpers that call out over the network;
// importing any of them here breaks the no-telemetry boundary
// (store-client-import-boundary.test.ts pins the list).

import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  requestPurchase,
  type ErrorCode,
  type Purchase,
  type SubscriptionOffer,
} from "expo-iap";
import { Platform } from "react-native";

import {
  CLOUD_SUBSCRIPTION_BASE_PLAN_IDS,
  CLOUD_SUBSCRIPTION_PRODUCT_ID,
  type CloudSubscriptionBasePlanId,
  type StoreClient,
  type StoreProduct,
  type StorePurchase,
  type StorePurchaseOutcome,
  type StorePurchaseState,
  type StoreSubscriptionPlan,
} from "./store-contract";

// A store that does not answer must not hold a screen: the dashboard awaits
// the ownership read, which the store serves from its on-device cache. This
// is the whole budget of one call — connecting, the read, and its one retry.
// The product lookup and the acknowledgment go to the network through the
// store, so they get three times as long.
export const STORE_CALL_TIMEOUT_MS = 5_000;
const NETWORK_CALL_TIMEOUT_FACTOR = 3;

const USER_CANCELLED: `${ErrorCode.UserCancelled}` = "user-cancelled";

const TIMED_OUT = Symbol("store-call-timed-out");

function storeUnavailable(): Error {
  // Deliberately carries nothing from the library's error: its message can
  // quote store debug text.
  return new Error("store_unavailable");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(TIMED_OUT), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function toState(purchase: Purchase): StorePurchaseState {
  if (purchase.purchaseState === "purchased") {
    return "purchased";
  }
  return purchase.purchaseState === "pending" ? "pending" : "unknown";
}

function productIdsOf(purchase: Purchase): string[] {
  return purchase.ids && purchase.ids.length > 0
    ? purchase.ids
    : [purchase.productId];
}

function isAcknowledged(purchase: Purchase): boolean {
  return (
    (purchase as { isAcknowledgedAndroid?: boolean | null })
      .isAcknowledgedAndroid === true
  );
}

function errorCodeOf(error: unknown): unknown {
  return typeof error === "object" && error !== null
    ? (error as { code?: unknown }).code
    : undefined;
}

// Play Billing's recurrence mode for the phase that renews until cancelled.
const INFINITE_RECURRING = 1;

type ChosenPlan = {
  plan: StoreSubscriptionPlan;
  offerToken: string;
};

function phasesOf(offer: SubscriptionOffer) {
  return offer.pricingPhasesAndroid?.pricingPhaseList ?? [];
}

function hasFreePhase(offer: SubscriptionOffer): boolean {
  return phasesOf(offer).some((phase) => phase.priceAmountMicros === "0");
}

// Per base plan: the free-trial offer when the store returned one (it returns
// one only to an eligible account), otherwise the plain base plan. The shown
// price is the renewing phase, never the trial's zero.
function choosePlans(offers: readonly SubscriptionOffer[]): ChosenPlan[] {
  return CLOUD_SUBSCRIPTION_BASE_PLAN_IDS.flatMap((basePlanId) => {
    const candidates = offers.filter(
      (offer) =>
        offer.basePlanIdAndroid === basePlanId &&
        typeof offer.offerTokenAndroid === "string" &&
        offer.offerTokenAndroid !== "" &&
        phasesOf(offer).length > 0,
    );
    const trial = candidates.find(hasFreePhase);
    const base =
      candidates.find(
        (offer) => !hasFreePhase(offer) && phasesOf(offer).length === 1,
      ) ?? candidates.find((offer) => !hasFreePhase(offer));
    const priced = base ?? trial;
    const chosen = trial ?? base;
    if (!priced || !chosen) {
      return [];
    }
    const phases = phasesOf(priced);
    const renewing =
      phases.find((phase) => phase.recurrenceMode === INFINITE_RECURRING) ??
      phases[phases.length - 1]!;
    if (renewing.priceAmountMicros === "0" || renewing.formattedPrice === "") {
      return [];
    }
    return [
      {
        plan: {
          basePlanId,
          displayPrice: renewing.formattedPrice,
          freeTrial: trial !== undefined,
        },
        offerToken: chosen.offerTokenAndroid!,
      },
    ];
  });
}

export function createStoreClient(
  options: { platformOS?: string; timeoutMs?: number } = {},
): StoreClient {
  // Google Play only. The App Store product does not exist yet, so iOS reads
  // as "store unavailable" instead of running an unverified purchase path.
  const supported = (options.platformOS ?? Platform.OS) === "android";
  const timeoutMs = options.timeoutMs ?? STORE_CALL_TIMEOUT_MS;
  let connection: Promise<void> | null = null;

  function connect(): Promise<void> {
    if (!supported) {
      return Promise.reject(storeUnavailable());
    }
    // A rejected connection is dropped by the caller that sees it reject, so
    // the next call connects again.
    connection ??= withTimeout(initConnection(), timeoutMs).then((ready) => {
      if (ready !== true) {
        throw storeUnavailable();
      }
    });
    return connection;
  }

  async function attempt<T>(operation: () => Promise<T>): Promise<T> {
    await connect();
    return operation();
  }

  // The billing service can drop a connection it reported as ready, so a
  // failed call is retried once on a fresh one. Both tries share one
  // deadline: that deadline, not a per-step one, is what a screen waits on.
  async function call<T>(
    operation: () => Promise<T>,
    limitMs: number = timeoutMs,
  ): Promise<T> {
    if (!supported) {
      throw storeUnavailable();
    }
    try {
      return await withTimeout(
        attempt(operation).catch(() => {
          connection = null;
          return attempt(operation);
        }),
        limitMs,
      );
    } catch {
      connection = null;
      throw storeUnavailable();
    }
  }

  const networkTimeoutMs = timeoutMs * NETWORK_CALL_TIMEOUT_FACTOR;

  async function loadCloudPlans(): Promise<ChosenPlan[]> {
    const products = await call(
      () =>
        fetchProducts({ skus: [CLOUD_SUBSCRIPTION_PRODUCT_ID], type: "subs" }),
      networkTimeoutMs,
    );
    const product = (products ?? []).find(
      (item) => item.id === CLOUD_SUBSCRIPTION_PRODUCT_ID,
    );
    const offers =
      product && "subscriptionOffers" in product
        ? (product.subscriptionOffers ?? [])
        : [];
    return choosePlans(offers);
  }

  return {
    supported,

    async loadProduct(productId: string): Promise<StoreProduct | null> {
      const products = await call(
        () => fetchProducts({ skus: [productId], type: "in-app" }),
        networkTimeoutMs,
      );
      const product = (products ?? []).find((item) => item.id === productId);
      return product
        ? { productId: product.id, displayPrice: product.displayPrice }
        : null;
    },

    async listPurchases(): Promise<readonly StorePurchase[]> {
      const purchases = await call(() => getAvailablePurchases());
      return purchases.flatMap((purchase) =>
        productIdsOf(purchase).map((productId) => ({
          productId,
          state: toState(purchase),
          acknowledged: isAcknowledged(purchase),
        })),
      );
    },

    // Not retried and not timed: the purchase sheet is the user's, and a
    // retry would open it a second time.
    async purchase(productId: string): Promise<StorePurchaseOutcome> {
      try {
        await connect();
        await requestPurchase({
          request: { google: { skus: [productId] } },
          type: "in-app",
        });
        return "completed";
      } catch (error) {
        if (errorCodeOf(error) === USER_CANCELLED) {
          return "cancelled";
        }
        connection = null;
        throw storeUnavailable();
      }
    },

    async acknowledge(productId: string): Promise<void> {
      const purchases = await call(() => getAvailablePurchases());
      const owed = purchases.find(
        (purchase) =>
          purchase.purchaseState === "purchased" &&
          !isAcknowledged(purchase) &&
          productIdsOf(purchase).includes(productId),
      );
      if (!owed) {
        return;
      }
      // Not consumable is the acknowledge path; consumable would consume the
      // purchase and let the store sell the product again.
      await call(
        () => finishTransaction({ purchase: owed, isConsumable: false }),
        networkTimeoutMs,
      );
    },

    async loadSubscriptionPlans(): Promise<readonly StoreSubscriptionPlan[]> {
      return (await loadCloudPlans()).map(({ plan }) => plan);
    },

    // Offers are re-read here so the sheet opens with an offer the store just
    // returned. Like `purchase`, the sheet itself is neither retried nor timed.
    async purchaseSubscription(
      basePlanId: CloudSubscriptionBasePlanId,
    ): Promise<StorePurchaseOutcome> {
      const chosen = (await loadCloudPlans()).find(
        ({ plan }) => plan.basePlanId === basePlanId,
      );
      if (!chosen) {
        throw storeUnavailable();
      }
      try {
        await connect();
        await requestPurchase({
          request: {
            google: {
              skus: [CLOUD_SUBSCRIPTION_PRODUCT_ID],
              subscriptionOffers: [
                {
                  sku: CLOUD_SUBSCRIPTION_PRODUCT_ID,
                  offerToken: chosen.offerToken,
                },
              ],
            },
          },
          type: "subs",
        });
        return "completed";
      } catch (error) {
        if (errorCodeOf(error) === USER_CANCELLED) {
          return "cancelled";
        }
        connection = null;
        throw storeUnavailable();
      }
    },
  };
}

export const storeClient: StoreClient = createStoreClient();
