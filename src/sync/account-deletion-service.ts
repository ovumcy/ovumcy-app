import { clearManagedPartnerInviteToken } from "../security/managed-partner-invite-token-buffer";
import type { SyncSecretStore } from "../security/sync-secret-store";
import { describeSubscriptionCountdown } from "../services/subscription-countdown-service";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  createManagedCloudAPIClient,
  type ManagedCloudActiveSubscription,
  type ManagedCloudAPIClient,
  type ManagedCloudAPIErrorCode,
} from "./managed-cloud-api-client";
import {
  createSyncAPIClient,
  type SyncAPIClient,
  type SyncAPIErrorCode,
} from "./sync-api-client";
import {
  normalizeSyncEndpoint,
  type NormalizeSyncEndpointErrorCode,
} from "./sync-endpoint-policy";
import {
  MANAGED_CLOUD_AUTH_BASE_URL,
  type SyncMode,
  type SyncPreferencesRecord,
} from "./sync-contract";

type SyncAPIClientFactory = (baseURL: string) => SyncAPIClient;
type ManagedCloudAPIClientFactory = (baseURL: string) => ManagedCloudAPIClient;

/**
 * AccountDeletionViewModel is the pure, screen-agnostic decision the
 * "Delete account" UI renders off. It never touches storage or the network
 * itself — `buildAccountDeletionViewModel` derives it from already-loaded
 * state so the screen layer can stay presentational.
 */
export type AccountDeletionViewModel = {
  // mode mirrors the current sync preferences mode; the screen uses it only
  // to decide which backend name to show in copy (managed vs self-hosted),
  // never to branch business logic on its own.
  mode: SyncMode;
  // hasConnectedSession is true when there is a live session for the current
  // mode (a managed auth session in managed mode, a community auth session
  // in self-hosted mode). When false, deletion is local-only: no network
  // call happens and the flow reduces to the local wipe.
  hasConnectedSession: boolean;
  // requiresSubscriptionWarning is true only when the managed billing
  // snapshot reports a subscription still on the hook for real charges —
  // describeSubscriptionCountdown kind "active" or "canceling". Pure
  // "trialing" is deliberately EXCLUDED even though describeSubscriptionCountdown
  // treats it as a live, non-"none"/"ended" state: the managed backend starts
  // every account on a 30-day trial with no payment method, and in-app
  // purchase is not possible on-device until Google Play Billing (the first
  // planned IAP channel — see README.md's "Public Alpha Expectations")
  // lands, so a trial can never actually be store/paid-backed today.
  // ManagedCloudActiveSubscription.source is parsed off the wire but has no
  // documented store/payment-source meaning and nothing else in the app
  // branches on it — once Play Billing ships a real store-source signal,
  // revisit whether a store-backed trial should also warn. The UI must show
  // the store-neutral cancellation warning and require a distinct,
  // deliberate acknowledgment before deleting.
  requiresSubscriptionWarning: boolean;
};

/**
 * Builds the account-deletion view-model from already-loaded settings state.
 * Pure and synchronous by design: the screen controller already holds
 * `state.managedPremiumAccess.activeSubscription` (the same field
 * `describeSubscriptionCountdown` renders the plan countdown from) and
 * `state.hasSyncSession` from its one-time load via `loadSettingsScreenState`
 * — this function only makes the decision, matching how
 * `buildBackupSyncSetupPresentation` separates state-loading from
 * presentation.
 */
export function buildAccountDeletionViewModel(input: {
  hasConnectedSession: boolean;
  preferences: SyncPreferencesRecord;
  activeSubscription: ManagedCloudActiveSubscription | null;
  now: Date;
}): AccountDeletionViewModel {
  const countdown = describeSubscriptionCountdown(
    input.activeSubscription,
    input.now.toISOString(),
  );

  return {
    mode: input.preferences.mode,
    hasConnectedSession: input.hasConnectedSession,
    requiresSubscriptionWarning:
      countdown.kind === "active" || countdown.kind === "canceling",
  };
}

export type DeleteOvumcyAccountErrorCode =
  | NormalizeSyncEndpointErrorCode
  | ManagedCloudAPIErrorCode
  | SyncAPIErrorCode
  | "generic";

/**
 * deleteOvumcyAccount runs the full destructive deletion in a strict order:
 *
 *   1. network:  call DELETE /account on the CONNECTED backend only
 *                (managed session in managed mode, community session in
 *                self-hosted mode). No session / local-only mode -> skip.
 *                A failing call ABORTS here — nothing local is touched.
 *   2. secrets:  clear sync secrets in full via `secretStore.clearSyncSecrets`
 *                (the same call `clearAllLocalSettingsData` makes — the
 *                account is gone, so unlike disconnect there is no reason to
 *                keep the local wrapped master key around), plus the pending
 *                managed partner invite buffer — mirroring the existing
 *                session-boundary invariant.
 *   3. local:    wipe all local data via `storage.clearAllLocalData()`
 *                (the same danger-zone path settings uses; this already
 *                clears the managed billing cache table too, so no separate
 *                cache-clear call is needed here). No new schema/migration.
 *
 * The caller (screen controller) owns confirmation, the subscription
 * warning, and routing back to onboarding after a successful result — this
 * function is pure orchestration + decision logic so it stays unit-testable
 * without any UI.
 */
export async function deleteOvumcyAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<
  | { ok: true }
  | { ok: false; errorCode: DeleteOvumcyAccountErrorCode }
> {
  const secrets = await secretStore.readSyncSecrets();

  if (preferences.mode === "managed" && secrets?.managedAuthSessionToken) {
    const managedClient = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const result = await managedClient.deleteAccount(
      secrets.managedAuthSessionToken,
    );
    if (!result.ok) {
      return { ok: false, errorCode: result.errorCode };
    }
  } else if (preferences.mode === "self_hosted" && secrets?.authSessionToken) {
    const normalizedEndpoint = normalizeSyncEndpoint(
      preferences.mode,
      preferences.endpointInput,
    );
    if (!normalizedEndpoint.ok) {
      return normalizedEndpoint;
    }
    const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
    const result = await client.deleteAccount(secrets.authSessionToken);
    if (!result.ok) {
      return { ok: false, errorCode: result.errorCode };
    }
  }
  // No session for the active mode (or genuinely local-only): nothing to
  // call on the server, proceed straight to the local teardown below.

  try {
    // Session boundary: same buffer cleared on disconnect and mode-switch
    // must not survive account deletion either. Order mirrors
    // `clearAllLocalSettingsData`: secrets first, then the local database.
    await secretStore.clearSyncSecrets();
    clearManagedPartnerInviteToken();
    await storage.clearAllLocalData();
  } catch {
    return { ok: false, errorCode: "generic" };
  }

  return { ok: true };
}
