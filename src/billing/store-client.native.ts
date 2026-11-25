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
} from "expo-iap";
import { Platform } from "react-native";

import type {
  StoreClient,
  StoreProduct,
  StorePurchase,
  StorePurchaseOutcome,
  StorePurchaseState,
} from "./store-contract";

// A store that does not answer must not hold a screen: the dashboard awaits
// the ownership read.
export const STORE_CALL_TIMEOUT_MS = 5_000;

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
    "isAcknowledgedAndroid" in purchase &&
    purchase.isAcknowledgedAndroid === true
  );
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
    if (!connection) {
      const attempt = withTimeout(initConnection(), timeoutMs).then((ready) => {
        if (ready !== true) {
          throw storeUnavailable();
        }
      });
      connection = attempt;
      attempt.catch(() => {
        if (connection === attempt) {
          connection = null;
        }
      });
    }
    return connection;
  }

  async function attempt<T>(operation: () => Promise<T>): Promise<T> {
    await connect();
    return withTimeout(operation(), timeoutMs);
  }

  // The billing service can drop a connection it reported as ready, so a
  // failed call is retried once on a fresh one. A timeout is not retried.
  async function call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await attempt(operation);
    } catch (error) {
      connection = null;
      if (!supported || error === TIMED_OUT) {
        throw storeUnavailable();
      }
    }
    try {
      return await attempt(operation);
    } catch {
      connection = null;
      throw storeUnavailable();
    }
  }

  return {
    async loadProduct(productId: string): Promise<StoreProduct | null> {
      const products = await call(() =>
        fetchProducts({ skus: [productId], type: "in-app" }),
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
        if (
          typeof error === "object" &&
          error !== null &&
          (error as { code?: unknown }).code === USER_CANCELLED
        ) {
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
      await call(() => finishTransaction({ purchase: owed, isConsumable: false }));
    },
  };
}

export const storeClient: StoreClient = createStoreClient();
