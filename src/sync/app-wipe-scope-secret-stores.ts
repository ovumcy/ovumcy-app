import { createPlatformCertPinStore } from "../security/platform-cert-pin-store";
import { createPlatformEntitlementTokenStore } from "../security/platform-entitlement-token-store";

// App-wide instances of the remaining wipe-scope SecureStore stores; the sync
// secret store lives in app-sync-service and the partner-share secret store
// in app-partner-share-service.
export const certPinStore = createPlatformCertPinStore();
export const entitlementTokenStore = createPlatformEntitlementTokenStore();
