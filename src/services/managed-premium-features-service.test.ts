import {
  createEntitlementTokenStore,
  type EntitlementTokenStore,
} from "../security/entitlement-token-store";
import {
  createDefaultSyncPreferencesRecord,
  type SyncSecretsRecord,
} from "../sync/sync-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  loadManagedBillingSnapshot,
  loadManagedPremiumFeatures,
  loadManagedPremiumFeaturesForCurrentSession,
  type EntitlementTokenGate,
} from "./managed-premium-features-service";

// The golden token from entitlement-token.test.ts (the Go-signer interop
// vector). It carries entitlements ["doctor_pdf","advanced_insights"], sub
// "acct-test-0001", exp 1750086400, signed by the golden key. The service
// resolves the embedded public-key map, whose PLACEHOLDER is the golden key,
// so this end-to-end test verifies the real path without a private key.
const GOLDEN_TOKEN =
  "eyJhbGciOiJFZERTQSIsImtpZCI6IjY1YjYwNjczZDZlZDg4NGIiLCJ0eXAiOiJKV1QifQ" +
  ".eyJhdWQiOiJvdnVtY3ktYXBwIiwiZW50aXRsZW1lbnRzIjpbImRvY3Rvcl9wZGYiLCJhZHZhbmNlZF9pbnNpZ2h0cyJdLCJleHAiOjE3NTAwODY0MDAsImlhdCI6MTc1MDAwMDAwMCwiaXNzIjoib3Z1bWN5LW1hbmFnZWQiLCJzdWIiOiJhY2N0LXRlc3QtMDAwMSJ9" +
  ".aLxva7cu0mWgbcl5QJCnFQFvyC4z5j9GEEuSTnSDomqkC1xccZl3tBaw45_RwaTLlRVQS9qjgRaDO8Nq2w2zBw";
const GOLDEN_SUB = "acct-test-0001";
const GOLDEN_NOW = 1_750_000_000; // < exp 1750086400
const GOLDEN_PAST_EXP = 1_750_086_401; // >= exp

const MANAGED_SECRETS: SyncSecretsRecord = {
  device: {
    deviceID: "device-1",
    deviceLabel: "Pixel 7",
    createdAt: "2026-03-19T08:15:00.000Z",
  },
  masterKeyHex: "aa",
  deviceSecretHex: "bb",
  wrappedKey: {
    algorithm: "xchacha20poly1305",
    kdf: "bip39_seed_hkdf_sha256",
    mnemonicWordCount: 12,
    wrapNonceHex: "cc",
    wrappedMasterKeyHex: "dd",
    phraseFingerprintHex: "ee",
  },
  authSessionToken: null,
  managedAuthSessionToken: "managed-session-1",
  managedAuthSessionExpiresAt: null,
  managedRefreshToken: null,
  managedRefreshTokenExpiresAt: null,
};

const originalFetch = global.fetch;

function createMemoryEntitlementTokenStore(): EntitlementTokenStore {
  let raw: string | null = null;
  return createEntitlementTokenStore({
    async deleteItem(): Promise<void> {
      raw = null;
    },
    async getItem(): Promise<string | null> {
      return raw;
    },
    async setItem(_key: string, value: string): Promise<void> {
      raw = value;
    },
  });
}

const FULL_FALSE_FEATURES = {
  advancedFertility: false,
  advancedInsights: false,
  doctorPDF: false,
  extendedReports: false,
  partnerAccess: false,
  reminders: false,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Routes the two endpoints the gate touches: /account/billing and
// /account/entitlements/token. `tokenResponse` of null means the
// entitlement-token endpoint is never expected to be called.
function mockManagedFetch(options: {
  billingFeatures: typeof FULL_FALSE_FEATURES;
  tokenResponse: Response | null;
}): jest.Mock {
  const fn = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/account/billing")) {
      return jsonResponse({
        has_active_plan: true,
        premium_features: {
          advanced_fertility: options.billingFeatures.advancedFertility,
          advanced_insights: options.billingFeatures.advancedInsights,
          doctor_pdf: options.billingFeatures.doctorPDF,
          extended_reports: options.billingFeatures.extendedReports,
          partner_access: options.billingFeatures.partnerAccess,
          reminders: options.billingFeatures.reminders,
        },
      });
    }
    if (url.endsWith("/account/entitlements/token")) {
      if (options.tokenResponse) {
        return options.tokenResponse;
      }
      throw new Error("unexpected entitlements/token call");
    }
    throw new Error(`unexpected fetch to ${url}`);
  });
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe("loadManagedBillingSnapshot — dead refresh chain", () => {
  it("serves nothing, not even the offline-grace cache, once the session is gone", async () => {
    // An access session past its expiry with a refresh token beside it: the
    // load path renews before fetching billing. Here the renewal is refused,
    // which means the managed session no longer exists.
    const secretStore = createSyncSecretStoreMock({
      ...MANAGED_SECRETS,
      managedAuthSessionExpiresAt: "2000-01-01T00:00:00.000Z",
      managedRefreshToken: "refresh-1",
      managedRefreshTokenExpiresAt: "2099-01-01T00:00:00.000Z",
    });
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/refresh")) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch after a dead refresh chain: ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const snapshot = await loadManagedBillingSnapshot(
      createLocalAppStorageMock(),
      secretStore,
      "managed",
    );

    // Serving cached premium under a session that no longer exists is exactly
    // the unbounded cached-entitlement the billing invariant forbids.
    expect(snapshot).toBeNull();
    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.endsWith("/account/billing"))).toBe(false);

    const stored = await secretStore.readSyncSecrets();
    expect(stored?.managedAuthSessionToken).toBeNull();
    expect(stored?.managedRefreshToken).toBeNull();
  });
});

describe("loadManagedPremiumFeatures — fallback path (no token gate) is unchanged", () => {
  it("returns the snapshot premiumFeatures verbatim when no gate is supplied", async () => {
    mockManagedFetch({
      billingFeatures: { ...FULL_FALSE_FEATURES, reminders: true },
      tokenResponse: null, // gate absent -> the token endpoint is never hit
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);

    const features = await loadManagedPremiumFeatures(createLocalAppStorageMock(), secretStore, "managed");

    expect(features).toEqual({ ...FULL_FALSE_FEATURES, reminders: true });
  });

  it("does not call the entitlements/token endpoint at all when no gate is supplied", async () => {
    const fetchMock = mockManagedFetch({
      billingFeatures: FULL_FALSE_FEATURES,
      tokenResponse: null,
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);

    await loadManagedBillingSnapshot(createLocalAppStorageMock(), secretStore, "managed");

    const calledUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(calledUrls.some((url) => url.endsWith("/account/billing"))).toBe(
      true,
    );
    expect(
      calledUrls.some((url) => url.endsWith("/account/entitlements/token")),
    ).toBe(false);
  });
});

describe("loadManagedPremiumFeaturesForCurrentSession — gate built from the live session", () => {
  it("constructs the signed-token gate for the active managed session when none is injected", async () => {
    // No tokenGate argument, so the current managed session must drive gate
    // construction (buildEntitlementTokenGate). The session-view refresh is
    // unauthorized here, so the builder returns no gate and premium features
    // fall back to the billing snapshot (fail-to-snapshot, never crash).
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/auth/session")) {
        return jsonResponse({ error: "unauthorized" }, 401);
      }
      if (url.endsWith("/account/billing")) {
        return jsonResponse({
          has_active_plan: true,
          premium_features: {
            advanced_fertility: false,
            advanced_insights: false,
            doctor_pdf: true,
            extended_reports: false,
            partner_access: false,
            reminders: false,
          },
        });
      }
      throw new Error(`unexpected fetch to ${url}`);
    }) as unknown as typeof fetch;

    const storage = createLocalAppStorageMock();
    (storage.readSyncPreferencesRecord as jest.Mock).mockResolvedValue({
      ...createDefaultSyncPreferencesRecord(),
      mode: "managed",
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);

    const features = await loadManagedPremiumFeaturesForCurrentSession(
      storage,
      secretStore,
    );

    expect(features).toEqual({ ...FULL_FALSE_FEATURES, doctorPDF: true });
  });
});

describe("loadManagedBillingSnapshot — verified-token overlay", () => {
  function gate(store: EntitlementTokenStore): EntitlementTokenGate {
    // publicKeysByKid is resolved from the embedded placeholder (== golden
    // key), so the gate itself need only carry the store/now/sub.
    return { store, now: GOLDEN_NOW, expectedSub: GOLDEN_SUB };
  }

  it("overlays a verified token: the two local features become true, server-gated stay from the snapshot", async () => {
    mockManagedFetch({
      billingFeatures: { ...FULL_FALSE_FEATURES, reminders: true },
      tokenResponse: jsonResponse({
        token: GOLDEN_TOKEN,
        expires_at: "2025-06-16T17:46:40Z",
      }),
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);
    const store = createMemoryEntitlementTokenStore();

    const snapshot = await loadManagedBillingSnapshot(
      createLocalAppStorageMock(),
      secretStore,
      "managed",
      gate(store),
    );

    expect(snapshot?.premiumFeatures).toEqual({
      ...FULL_FALSE_FEATURES,
      doctorPDF: true,
      advancedInsights: true,
      reminders: true, // server-gated: untouched
    });
    expect(snapshot?.hasActivePlan).toBe(true);
    // Token cached for offline use.
    expect(await store.readEntitlementToken()).toEqual({ token: GOLDEN_TOKEN });
  });

  it("falls back to snapshot booleans when the endpoint is 503 and nothing is cached (no regression)", async () => {
    mockManagedFetch({
      billingFeatures: {
        ...FULL_FALSE_FEATURES,
        doctorPDF: true,
        advancedInsights: true,
      },
      tokenResponse: jsonResponse({ error: "entitlements_unavailable" }, 503),
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);
    const store = createMemoryEntitlementTokenStore();

    const snapshot = await loadManagedBillingSnapshot(
      createLocalAppStorageMock(),
      secretStore,
      "managed",
      gate(store),
    );

    // Identical to the snapshot — no token, no overlay.
    expect(snapshot?.premiumFeatures).toEqual({
      ...FULL_FALSE_FEATURES,
      doctorPDF: true,
      advancedInsights: true,
    });
  });

  it("honors a cached non-expired token offline when the endpoint is unavailable", async () => {
    mockManagedFetch({
      billingFeatures: FULL_FALSE_FEATURES,
      tokenResponse: jsonResponse({ error: "network_failed" }, 599),
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);
    const store = createMemoryEntitlementTokenStore();
    await store.writeEntitlementToken({ token: GOLDEN_TOKEN });

    const snapshot = await loadManagedBillingSnapshot(
      createLocalAppStorageMock(),
      secretStore,
      "managed",
      gate(store),
    );

    expect(snapshot?.premiumFeatures.doctorPDF).toBe(true);
    expect(snapshot?.premiumFeatures.advancedInsights).toBe(true);
  });

  it("re-locks when the cached token is expired and falls back to the snapshot booleans", async () => {
    mockManagedFetch({
      billingFeatures: FULL_FALSE_FEATURES,
      tokenResponse: jsonResponse({ error: "network_failed" }, 599),
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);
    const store = createMemoryEntitlementTokenStore();
    await store.writeEntitlementToken({ token: GOLDEN_TOKEN });

    const snapshot = await loadManagedBillingSnapshot(createLocalAppStorageMock(), secretStore, "managed", {
      store,
      now: GOLDEN_PAST_EXP, // token exp has passed
      expectedSub: GOLDEN_SUB,
    });

    expect(snapshot?.premiumFeatures).toEqual(FULL_FALSE_FEATURES);
  });

  it("rejects a token minted for another account (sub mismatch) and falls back", async () => {
    mockManagedFetch({
      billingFeatures: FULL_FALSE_FEATURES,
      tokenResponse: jsonResponse({
        token: GOLDEN_TOKEN,
        expires_at: "2025-06-16T17:46:40Z",
      }),
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);
    const store = createMemoryEntitlementTokenStore();

    const snapshot = await loadManagedBillingSnapshot(createLocalAppStorageMock(), secretStore, "managed", {
      store,
      now: GOLDEN_NOW,
      expectedSub: "acct-someone-else",
    });

    expect(snapshot?.premiumFeatures).toEqual(FULL_FALSE_FEATURES);
  });
});

describe("loadManagedBillingSnapshot — bounded offline grace cache", () => {
  const CACHE_NOW = new Date("2026-07-01T12:00:00.000Z");
  const FRESH_FETCHED_AT = "2026-06-30T12:00:00.000Z"; // 24h old, inside 72h
  const STALE_FETCHED_AT = "2026-06-28T11:00:00.000Z"; // 73h old, outside 72h

  function cachedRecord(fetchedAt: string) {
    return {
      snapshot: {
        hasActivePlan: true,
        premiumFeatures: {
          ...FULL_FALSE_FEATURES,
          doctorPDF: true,
          reminders: true,
        },
        fetchedAt,
      },
      dismissedOfferIDs: ["offer-1"],
    };
  }

  function mockFailedBillingFetch(): void {
    // performFetch turns thrown network errors into a synthetic 599 response.
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
  }

  it("refreshes the persisted last-known-good snapshot on a successful fetch", async () => {
    mockManagedFetch({
      billingFeatures: { ...FULL_FALSE_FEATURES, doctorPDF: true },
      tokenResponse: null,
    });
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);

    const snapshot = await loadManagedBillingSnapshot(
      storage,
      secretStore,
      "managed",
      undefined,
      CACHE_NOW,
    );

    expect(snapshot?.hasActivePlan).toBe(true);
    expect(storage.writeManagedBillingCacheRecord).toHaveBeenCalledWith({
      snapshot: {
        hasActivePlan: true,
        premiumFeatures: { ...FULL_FALSE_FEATURES, doctorPDF: true },
        fetchedAt: CACHE_NOW.toISOString(),
      },
      dismissedOfferIDs: [],
    });
  });

  it("serves the cached snapshot within the 72h TTL when the billing fetch fails", async () => {
    mockFailedBillingFetch();
    const storage = createLocalAppStorageMock({
      readManagedBillingCacheRecord: jest
        .fn()
        .mockResolvedValue(cachedRecord(FRESH_FETCHED_AT)),
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);

    const snapshot = await loadManagedBillingSnapshot(
      storage,
      secretStore,
      "managed",
      undefined,
      CACHE_NOW,
    );

    expect(snapshot).toEqual({
      hasActivePlan: true,
      premiumFeatures: {
        ...FULL_FALSE_FEATURES,
        doctorPDF: true,
        reminders: true,
      },
      // Server-driven affordances fail closed on cached truth.
      activeSubscription: null,
      billingManagement: {
        canManageRenewal: false,
        canCancelAtPeriodEnd: false,
        canResumeRenewal: false,
      },
      offers: [],
    });
  });

  it("fails closed exactly as before once the cache is older than 72h", async () => {
    mockFailedBillingFetch();
    const storage = createLocalAppStorageMock({
      readManagedBillingCacheRecord: jest
        .fn()
        .mockResolvedValue(cachedRecord(STALE_FETCHED_AT)),
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);

    await expect(
      loadManagedBillingSnapshot(
        storage,
        secretStore,
        "managed",
        undefined,
        CACHE_NOW,
      ),
    ).resolves.toBeNull();
  });

  it("fails closed when the fetch fails and no snapshot was ever cached", async () => {
    mockFailedBillingFetch();
    const storage = createLocalAppStorageMock();
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);

    await expect(
      loadManagedBillingSnapshot(
        storage,
        secretStore,
        "managed",
        undefined,
        CACHE_NOW,
      ),
    ).resolves.toBeNull();
  });

  it("never serves the cache without a managed session token", async () => {
    mockFailedBillingFetch();
    const storage = createLocalAppStorageMock({
      readManagedBillingCacheRecord: jest
        .fn()
        .mockResolvedValue(cachedRecord(FRESH_FETCHED_AT)),
    });
    const secretStore = createSyncSecretStoreMock({
      ...MANAGED_SECRETS,
      managedAuthSessionToken: null,
    });

    await expect(
      loadManagedBillingSnapshot(
        storage,
        secretStore,
        "managed",
        undefined,
        CACHE_NOW,
      ),
    ).resolves.toBeNull();
    expect(storage.readManagedBillingCacheRecord).not.toHaveBeenCalled();
  });

  it("keeps six premium gates unlocked through loadManagedPremiumFeatures on a network blip", async () => {
    mockFailedBillingFetch();
    const storage = createLocalAppStorageMock({
      readManagedBillingCacheRecord: jest.fn().mockResolvedValue({
        snapshot: {
          hasActivePlan: true,
          premiumFeatures: {
            advancedFertility: true,
            advancedInsights: true,
            doctorPDF: true,
            extendedReports: true,
            partnerAccess: true,
            reminders: true,
          },
          fetchedAt: FRESH_FETCHED_AT,
        },
        dismissedOfferIDs: [],
      }),
    });
    const secretStore = createSyncSecretStoreMock(MANAGED_SECRETS);

    await expect(
      loadManagedPremiumFeatures(
        storage,
        secretStore,
        "managed",
        undefined,
        CACHE_NOW,
      ),
    ).resolves.toEqual({
      advancedFertility: true,
      advancedInsights: true,
      doctorPDF: true,
      extendedReports: true,
      partnerAccess: true,
      reminders: true,
    });
  });
});
