import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import type { ProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import {
  createEntitlementTokenStore,
  type EntitlementTokenStore,
} from "../security/entitlement-token-store";
import type { ManagedCloudPremiumFeatures } from "../sync/managed-cloud-api-client";
import type { SyncSecretsRecord } from "../sync/sync-contract";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  loadManagedBillingSnapshot,
  type EntitlementTokenGate,
} from "./managed-premium-features-service";
import { resolvePDFExportAccessState } from "./pdf-export-access-policy";
import { buildStatsViewData } from "./stats-view-service";

/**
 * P2.13 — real UNLOCKED-premium proof at the jest/integration level.
 *
 * The audit gap this closes: prior tests only exercised the LOCKED placeholder
 * cards. Here we seed an active plan + a VALID signed entitlement token and prove
 * the WHOLE loop: the two purely-local premium features unlock VIA THE TOKEN, the
 * server-gated features unlock VIA THE SNAPSHOT, and the unlocked state produces
 * real view-data — doctor-PDF export allowed and a populated advanced-insights
 * panel — not just the absence of a lock card. The counter-cases (expired /
 * tampered / wrong-sub / unknown-kid token, lapsed plan) fall back to the
 * snapshot and re-lock.
 *
 * The Playwright unlocked-UI E2E remains blocked on Chromium (plan P3.17); this
 * jest proof stands in for it until then.
 */

// The Go-signer interop golden vector (also used by entitlement-token.test.ts /
// managed-premium-features-service.test.ts). It carries entitlements
// ["doctor_pdf","advanced_insights"], sub "acct-test-0001", exp 1750086400,
// signed by the golden key whose kid is the embedded PLACEHOLDER public key — so
// this drives the REAL verifier without a private key.
const GOLDEN_TOKEN =
  "eyJhbGciOiJFZERTQSIsImtpZCI6IjY1YjYwNjczZDZlZDg4NGIiLCJ0eXAiOiJKV1QifQ" +
  ".eyJhdWQiOiJvdnVtY3ktYXBwIiwiZW50aXRsZW1lbnRzIjpbImRvY3Rvcl9wZGYiLCJhZHZhbmNlZF9pbnNpZ2h0cyJdLCJleHAiOjE3NTAwODY0MDAsImlhdCI6MTc1MDAwMDAwMCwiaXNzIjoib3Z1bWN5LW1hbmFnZWQiLCJzdWIiOiJhY2N0LXRlc3QtMDAwMSJ9" +
  ".aLxva7cu0mWgbcl5QJCnFQFvyC4z5j9GEEuSTnSDomqkC1xccZl3tBaw45_RwaTLlRVQS9qjgRaDO8Nq2w2zBw";
const GOLDEN_SUB = "acct-test-0001";
const GOLDEN_NOW = 1_750_000_000; // < exp 1750086400
const GOLDEN_PAST_EXP = 1_750_086_401; // >= exp -> token expired

// Tamper the FIRST signature byte (its top bits are significant, unlike the
// final base64url char which only carries padding): the verifier must reject it.
const TAMPERED_TOKEN = (() => {
  const parts = GOLDEN_TOKEN.split(".");
  const signature = parts[2] ?? "";
  const flipped = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
  return `${parts[0] ?? ""}.${parts[1] ?? ""}.${flipped}`;
})();

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
afterEach(() => {
  global.fetch = originalFetch;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

type SnapshotFeatures = {
  advancedFertility: boolean;
  advancedInsights: boolean;
  doctorPDF: boolean;
  extendedReports: boolean;
  partnerAccess: boolean;
  reminders: boolean;
};

// Routes the two endpoints the gate touches. `token` of null means the
// entitlement-token endpoint answers 503 (no token minted).
function mockManagedFetch(options: {
  hasActivePlan: boolean;
  billing: SnapshotFeatures;
  token: string | null;
}): void {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/account/billing")) {
      return jsonResponse({
        has_active_plan: options.hasActivePlan,
        premium_features: {
          advanced_fertility: options.billing.advancedFertility,
          advanced_insights: options.billing.advancedInsights,
          doctor_pdf: options.billing.doctorPDF,
          extended_reports: options.billing.extendedReports,
          partner_access: options.billing.partnerAccess,
          reminders: options.billing.reminders,
        },
      });
    }
    if (url.endsWith("/account/entitlements/token")) {
      return options.token
        ? jsonResponse({ token: options.token, expires_at: "2025-06-16T17:46:40Z" })
        : jsonResponse({ error: "entitlements_unavailable" }, 503);
    }
    throw new Error(`unexpected fetch to ${url}`);
  }) as unknown as typeof fetch;
}

function gate(store: EntitlementTokenStore, now = GOLDEN_NOW): EntitlementTokenGate {
  return { store, now, expectedSub: GOLDEN_SUB };
}

const ALL_FALSE: SnapshotFeatures = {
  advancedFertility: false,
  advancedInsights: false,
  doctorPDF: false,
  extendedReports: false,
  partnerAccess: false,
  reminders: false,
};

async function resolveFeatures(
  billingGate: EntitlementTokenGate | undefined,
): Promise<ManagedCloudPremiumFeatures> {
  const snapshot = await loadManagedBillingSnapshot(
    createLocalAppStorageMock(),
    createSyncSecretStoreMock(MANAGED_SECRETS),
    "managed",
    billingGate,
  );
  if (!snapshot) {
    return { ...ALL_FALSE };
  }
  return snapshot.premiumFeatures;
}

// A history rich enough that the shared stats services compute a full
// advanced-insights panel once the entitlement unlocks it (mirrors the proven
// fixture in stats-view-service.test.ts).
function richInsightsFixture(): {
  profile: ProfileRecord;
  records: DayLogRecord[];
  now: Date;
} {
  const profile: ProfileRecord = {
    lastPeriodStart: "2026-03-28",
    cycleLength: 28,
    periodLength: 5,
    autoPeriodFill: true,
    irregularCycle: false,
    unpredictableCycle: false,
    ageGroup: "",
    usageGoal: "health",
    trackBBT: true,
    temperatureUnit: "c",
    trackCervicalMucus: true,
    hideSexChip: false,
    languageOverride: null,
    themeOverride: null,
  };
  const period = (date: string): DayLogRecord => ({
    ...createEmptyDayLogRecord(date),
    isPeriod: true,
  });
  const records: DayLogRecord[] = [
    period("2025-10-01"),
    { ...createEmptyDayLogRecord("2025-10-11"), symptomIDs: ["headache"] },
    { ...createEmptyDayLogRecord("2025-10-14"), cervicalMucus: "eggwhite", lhTest: "peak" },
    period("2025-10-29"),
    { ...createEmptyDayLogRecord("2025-11-08"), symptomIDs: ["headache"] },
    { ...createEmptyDayLogRecord("2025-11-12"), cervicalMucus: "eggwhite", lhTest: "peak" },
    period("2025-11-26"),
    { ...createEmptyDayLogRecord("2025-12-06"), symptomIDs: ["headache"] },
    { ...createEmptyDayLogRecord("2025-12-10"), cervicalMucus: "eggwhite", lhTest: "peak" },
    period("2025-12-24"),
    { ...createEmptyDayLogRecord("2026-01-08"), cervicalMucus: "eggwhite", lhTest: "peak" },
    period("2026-01-21"),
    { ...createEmptyDayLogRecord("2026-02-04"), cervicalMucus: "eggwhite", lhTest: "peak" },
    period("2026-02-18"),
    { ...createEmptyDayLogRecord("2026-03-12"), cervicalMucus: "eggwhite", lhTest: "peak" },
    { ...period("2026-03-28"), bbt: 36.3 },
    { ...createEmptyDayLogRecord("2026-03-29"), bbt: 36.31 },
    { ...createEmptyDayLogRecord("2026-03-30"), bbt: 36.29, cervicalMucus: "eggwhite", lhTest: "peak" },
    { ...createEmptyDayLogRecord("2026-03-31"), bbt: 36.3 },
    { ...createEmptyDayLogRecord("2026-04-01"), bbt: 36.3 },
    { ...createEmptyDayLogRecord("2026-04-02"), bbt: 36.3 },
    { ...createEmptyDayLogRecord("2026-04-03"), bbt: 36.55 },
    { ...createEmptyDayLogRecord("2026-04-04"), bbt: 36.56 },
    { ...createEmptyDayLogRecord("2026-04-05"), bbt: 36.57 },
  ];
  return { profile, records, now: new Date(2026, 3, 6) };
}

describe("premium unlock loop — token unlocks local features, snapshot unlocks server-gated", () => {
  it("a valid signed token unlocks doctorPDF + advancedInsights VIA THE TOKEN; reminders/partner unlock VIA THE SNAPSHOT", async () => {
    // Active plan; the snapshot alone would leave the two local features locked
    // (doctor_pdf/advanced_insights false) — only the token unlocks them.
    mockManagedFetch({
      hasActivePlan: true,
      billing: { ...ALL_FALSE, reminders: true, partnerAccess: true },
      token: GOLDEN_TOKEN,
    });
    const store = createMemoryEntitlementTokenStore();

    const features = await resolveFeatures(gate(store));

    expect(features).toEqual({
      ...ALL_FALSE,
      doctorPDF: true, // via token
      advancedInsights: true, // via token
      reminders: true, // via snapshot
      partnerAccess: true, // via snapshot
    });
    // The verified token is cached for the offline-grace window.
    expect(await store.readEntitlementToken()).toEqual({ token: GOLDEN_TOKEN });
  });

  it("produces REAL unlocked view-data: doctor-PDF export allowed and a populated advanced-insights panel", async () => {
    mockManagedFetch({
      hasActivePlan: true,
      billing: { ...ALL_FALSE },
      token: GOLDEN_TOKEN,
    });

    const features = await resolveFeatures(gate(createMemoryEntitlementTokenStore()));
    expect(features.doctorPDF).toBe(true);
    expect(features.advancedInsights).toBe(true);

    // Doctor PDF export gate: unlocked because the token flipped doctorPDF.
    expect(
      resolvePDFExportAccessState({
        hasSyncSession: true,
        syncMode: "managed",
        managedDoctorPDFAllowed: features.doctorPDF,
      }),
    ).toEqual({ enabled: true, reason: null });

    // Advanced-insights panel: populated (not the locked placeholder card).
    const { profile, records, now } = richInsightsFixture();
    const viewData = buildStatsViewData(
      profile,
      records,
      createDefaultSymptomRecords(),
      now,
      "en",
      features,
    );
    expect(viewData.advancedInsights?.title).toBe("Advanced insights");
    expect(viewData.advancedInsights?.items.length).toBeGreaterThan(0);
    // The lock placeholder is gone precisely because the token unlocked it.
    expect(viewData.premiumLocks?.advancedInsights).toBeUndefined();
  });
});

describe("premium relock — counter-cases fall back to the snapshot and lock", () => {
  it("no active plan relocks everything (snapshot all-false, no token minted)", async () => {
    mockManagedFetch({ hasActivePlan: false, billing: { ...ALL_FALSE }, token: null });

    const features = await resolveFeatures(gate(createMemoryEntitlementTokenStore()));

    expect(features).toEqual(ALL_FALSE);
    expect(
      resolvePDFExportAccessState({
        hasSyncSession: true,
        syncMode: "managed",
        managedDoctorPDFAllowed: features.doctorPDF,
      }),
    ).toEqual({ enabled: false, reason: "plan_required" });

    const { profile, records, now } = richInsightsFixture();
    const viewData = buildStatsViewData(
      profile,
      records,
      createDefaultSymptomRecords(),
      now,
      "en",
      features,
    );
    // Locked: the placeholder card renders instead of the panel.
    expect(viewData.advancedInsights).toBeUndefined();
    expect(viewData.premiumLocks?.advancedInsights?.title).toBe("Advanced insights");
  });

  it("an expired token (now >= exp) falls back to the snapshot booleans (locked)", async () => {
    mockManagedFetch({ hasActivePlan: true, billing: { ...ALL_FALSE }, token: GOLDEN_TOKEN });
    const store = createMemoryEntitlementTokenStore();

    const features = await resolveFeatures(gate(store, GOLDEN_PAST_EXP));

    expect(features.doctorPDF).toBe(false);
    expect(features.advancedInsights).toBe(false);
  });

  it("a tampered token signature is rejected; the snapshot booleans stand", async () => {
    mockManagedFetch({ hasActivePlan: true, billing: { ...ALL_FALSE }, token: TAMPERED_TOKEN });

    const features = await resolveFeatures(gate(createMemoryEntitlementTokenStore()));

    expect(features.doctorPDF).toBe(false);
    expect(features.advancedInsights).toBe(false);
  });

  it("a token minted for another account (wrong sub) is rejected; the snapshot stands", async () => {
    mockManagedFetch({ hasActivePlan: true, billing: { ...ALL_FALSE }, token: GOLDEN_TOKEN });
    const store = createMemoryEntitlementTokenStore();

    const features = await resolveFeatures({
      store,
      now: GOLDEN_NOW,
      expectedSub: "acct-someone-else",
    });

    expect(features.doctorPDF).toBe(false);
    expect(features.advancedInsights).toBe(false);
  });

  it("an unknown-kid token (no matching embedded public key) is rejected; the snapshot stands", async () => {
    // Swap the header kid to one absent from the embedded key map: the header
    // is part of the signed input, so this also fails the signature — either
    // way it must NOT verify and the snapshot booleans stand.
    const [, payload, signature] = GOLDEN_TOKEN.split(".");
    const unknownKidHeader = Buffer.from(
      JSON.stringify({ alg: "EdDSA", kid: "deadbeefdeadbeef", typ: "JWT" }),
    ).toString("base64url");
    const unknownKidToken = `${unknownKidHeader}.${payload}.${signature}`;
    mockManagedFetch({ hasActivePlan: true, billing: { ...ALL_FALSE }, token: unknownKidToken });

    const features = await resolveFeatures(gate(createMemoryEntitlementTokenStore()));

    expect(features.doctorPDF).toBe(false);
    expect(features.advancedInsights).toBe(false);
  });
});

describe("premium offline grace — token gate never weakens the 72h billing-cache contract", () => {
  const CACHE_NOW = new Date("2026-07-01T12:00:00.000Z");
  const FRESH_FETCHED_AT = "2026-06-30T12:00:00.000Z"; // 24h old, inside 72h
  const STALE_FETCHED_AT = "2026-06-28T11:00:00.000Z"; // 73h old, outside 72h

  function mockFailedBillingFetch(): void {
    global.fetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
  }

  it("offline with a fresh 72h cache keeps the local premium features unlocked from the cached snapshot", async () => {
    mockFailedBillingFetch();
    const storage = createLocalAppStorageMock({
      readManagedBillingCacheRecord: jest.fn().mockResolvedValue({
        snapshot: {
          hasActivePlan: true,
          premiumFeatures: { ...ALL_FALSE, doctorPDF: true, advancedInsights: true },
          fetchedAt: FRESH_FETCHED_AT,
        },
        dismissedOfferIDs: [],
      }),
    });
    // Offline: no getEntitlementToken succeeds and nothing is cached, so the gate
    // overlay is a no-op and the CACHED snapshot booleans stand (the 72h grace).
    const snapshot = await loadManagedBillingSnapshot(
      storage,
      createSyncSecretStoreMock(MANAGED_SECRETS),
      "managed",
      gate(createMemoryEntitlementTokenStore()),
      CACHE_NOW,
    );

    expect(snapshot?.premiumFeatures.doctorPDF).toBe(true);
    expect(snapshot?.premiumFeatures.advancedInsights).toBe(true);
  });

  it("offline with a stale (>72h) cache re-locks: fails closed to null", async () => {
    mockFailedBillingFetch();
    const storage = createLocalAppStorageMock({
      readManagedBillingCacheRecord: jest.fn().mockResolvedValue({
        snapshot: {
          hasActivePlan: true,
          premiumFeatures: { ...ALL_FALSE, doctorPDF: true, advancedInsights: true },
          fetchedAt: STALE_FETCHED_AT,
        },
        dismissedOfferIDs: [],
      }),
    });

    const snapshot = await loadManagedBillingSnapshot(
      storage,
      createSyncSecretStoreMock(MANAGED_SECRETS),
      "managed",
      gate(createMemoryEntitlementTokenStore()),
      CACHE_NOW,
    );

    expect(snapshot).toBeNull();
  });
});
