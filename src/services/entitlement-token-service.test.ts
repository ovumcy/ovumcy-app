import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { fromByteArray } from "base64-js";

import {
  createEntitlementTokenStore,
  type EntitlementTokenStore,
} from "../security/entitlement-token-store";
import type { ManagedCloudAPIClient } from "../sync/managed-cloud-api-client";
import { resolveVerifiedEntitlements } from "./entitlement-token-service";

const SEED = new Uint8Array(32).fill(7);
const KID = "test-kid-0001";
const SUB = "acct-test-0001";
const NOW = 1_750_000_000;
const PUBLIC_KEYS = { [KID]: bytesToHex(ed25519.getPublicKey(SEED)) };

function base64UrlEncode(bytes: Uint8Array): string {
  return fromByteArray(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function signToken(entitlements: string[]): string {
  const header = base64UrlEncode(utf8(JSON.stringify({ alg: "EdDSA", kid: KID, typ: "JWT" })));
  const payload = base64UrlEncode(
    utf8(
      JSON.stringify({
        iss: "ovumcy-managed",
        aud: "ovumcy-app",
        sub: SUB,
        iat: NOW - 60,
        exp: NOW + 86_400,
        entitlements,
      }),
    ),
  );
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${base64UrlEncode(ed25519.sign(utf8(signingInput), SEED))}`;
}

function createMemoryStore(): EntitlementTokenStore {
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

function clientAnswering(
  result: { ok: true; token: string } | { ok: false; errorCode: string },
): ManagedCloudAPIClient {
  return {
    getEntitlementToken: jest.fn(async () =>
      result.ok
        ? { ok: true, result: { token: result.token, expiresAt: null } }
        : { ok: false, errorCode: result.errorCode },
    ),
  } as unknown as ManagedCloudAPIClient;
}

describe("resolveVerifiedEntitlements", () => {
  it("reports a verified token with an empty entitlement list as verified, not unavailable", async () => {
    const result = await resolveVerifiedEntitlements({
      store: createMemoryStore(),
      managedSessionToken: "session-1",
      expectedSub: SUB,
      now: NOW,
      client: clientAnswering({ ok: true, token: signToken([]) }),
      publicKeysByKid: PUBLIC_KEYS,
    });

    expect(result.status).toBe("verified");
    expect(result.status === "verified" ? [...result.entitlements] : null).toEqual([]);
  });

  it("reports unavailable when the only token fails verification", async () => {
    const result = await resolveVerifiedEntitlements({
      store: createMemoryStore(),
      managedSessionToken: "session-1",
      expectedSub: "acct-someone-else",
      now: NOW,
      client: clientAnswering({ ok: true, token: signToken(["doctor_pdf"]) }),
      publicKeysByKid: PUBLIC_KEYS,
    });

    expect(result).toEqual({ status: "unavailable" });
  });

  it("discards the cached token when the mint is refused", async () => {
    const store = createMemoryStore();
    await store.writeEntitlementToken({ token: signToken(["doctor_pdf"]) });

    const result = await resolveVerifiedEntitlements({
      store,
      managedSessionToken: "session-1",
      expectedSub: SUB,
      now: NOW,
      client: clientAnswering({ ok: false, errorCode: "sync_not_allowed" }),
      publicKeysByKid: PUBLIC_KEYS,
    });

    expect(result).toEqual({ status: "unavailable" });
    expect(await store.readEntitlementToken()).toBeNull();
  });

  it("reports unavailable instead of throwing when the token store fails", async () => {
    const store = createMemoryStore();
    jest.spyOn(store, "readEntitlementToken").mockRejectedValue(new Error("keychain locked"));

    const result = await resolveVerifiedEntitlements({
      store,
      managedSessionToken: null,
      expectedSub: SUB,
      now: NOW,
      client: clientAnswering({ ok: false, errorCode: "network_failed" }),
      publicKeysByKid: PUBLIC_KEYS,
    });

    expect(result).toEqual({ status: "unavailable" });
  });

  it("keeps and verifies the cached token on a transport failure", async () => {
    const store = createMemoryStore();
    const cached = signToken(["doctor_pdf"]);
    await store.writeEntitlementToken({ token: cached });

    const result = await resolveVerifiedEntitlements({
      store,
      managedSessionToken: "session-1",
      expectedSub: SUB,
      now: NOW,
      client: clientAnswering({ ok: false, errorCode: "network_failed" }),
      publicKeysByKid: PUBLIC_KEYS,
    });

    expect(result.status).toBe("verified");
    expect(await store.readEntitlementToken()).toEqual({ token: cached });
  });
});
