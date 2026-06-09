import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIClient,
} from "./managed-cloud-api-client";
import { createSyncAPIClient, type SyncAPIClient } from "./sync-api-client";
import {
  MANAGED_CLOUD_AUTH_BASE_URL,
  type SyncPreferencesRecord,
} from "./sync-contract";
import { normalizeSyncEndpoint } from "./sync-endpoint-policy";

type SyncAPIClientFactory = (baseURL: string) => SyncAPIClient;
type ManagedCloudAPIClientFactory = (baseURL: string) => ManagedCloudAPIClient;

/**
 * describeSyncAccountTwoFactor fetches the connected account's current session
 * and reports whether TOTP two-factor is enabled, so the security screen can
 * show a live status instead of inferring it from a login challenge. It routes
 * to the managed or self-hosted server the same way the TOTP operations do.
 *
 * Returns null when the answer is unknown — not connected, no session token, a
 * bad endpoint, or a failed/legacy response — and the caller treats null as
 * "don't claim a 2FA state" rather than guessing.
 */
export async function describeSyncAccountTwoFactor(
  secretStore: SyncSecretStore,
  preferences: SyncPreferencesRecord,
  apiClientFactory: SyncAPIClientFactory = createSyncAPIClient,
  managedClientFactory: ManagedCloudAPIClientFactory = createManagedCloudAPIClient,
): Promise<{ twoFactorEnabled: boolean } | null> {
  const secrets = await secretStore.readSyncSecrets();
  if (!secrets) {
    return null;
  }

  if (preferences.mode === "managed") {
    if (!secrets.managedAuthSessionToken) {
      return null;
    }
    const client = managedClientFactory(MANAGED_CLOUD_AUTH_BASE_URL);
    const result = await client.getSession(secrets.managedAuthSessionToken);
    return result.ok
      ? { twoFactorEnabled: result.session.twoFactorEnabled }
      : null;
  }

  const normalizedEndpoint = normalizeSyncEndpoint(
    preferences.mode,
    preferences.endpointInput,
  );
  if (!normalizedEndpoint.ok) {
    return null;
  }
  if (!secrets.authSessionToken) {
    return null;
  }
  const client = apiClientFactory(normalizedEndpoint.endpoint.baseURL);
  const result = await client.getSession(secrets.authSessionToken);
  return result.ok
    ? { twoFactorEnabled: result.session.twoFactorEnabled }
    : null;
}
