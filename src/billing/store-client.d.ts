import type { StoreClient } from "./store-contract";

/**
 * The platform store behind the transport-free contract.
 *
 * Native: Google Play Billing through the one adapter that imports the store
 * library. Web, and any platform without a wired store: every call rejects.
 */
export declare const storeClient: StoreClient;
