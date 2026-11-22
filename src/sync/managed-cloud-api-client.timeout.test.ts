import {
  createManagedCloudAPIClient,
  isManagedCloudTransportFailure,
  MANAGED_CLOUD_REQUEST_TIMEOUT_MS,
} from "./managed-cloud-api-client";
import { MANAGED_CLOUD_ENDPOINTS } from "../test/managed-cloud-endpoint-sweep";

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

const BASE_URL = "https://cloud.example.test/api";

function never(): Promise<never> {
  return new Promise<never>(() => undefined);
}

describe("managed-cloud-api-client request timeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe.each(Object.entries(MANAGED_CLOUD_ENDPOINTS))("%s", (_name, call) => {
    it("aborts the request and reports network_failed when it outlives the timeout", async () => {
      const fetch = jest.fn((_url: string, _init: RequestInit) => never());

      const pending = call(createManagedCloudAPIClient(BASE_URL, fetch));
      await jest.advanceTimersByTimeAsync(MANAGED_CLOUD_REQUEST_TIMEOUT_MS);

      await expect(pending).resolves.toEqual(
        expect.objectContaining({ ok: false, errorCode: "network_failed" }),
      );
      expect(fetch.mock.calls[0]![1].signal?.aborted).toBe(true);
    });
  });

  it("keeps the request open until the deadline", async () => {
    const fetch = jest.fn((_url: string, _init: RequestInit) => never());
    let settled = false;

    void createManagedCloudAPIClient(BASE_URL, fetch)
      .getSession("s")
      .then(() => {
        settled = true;
      });
    await jest.advanceTimersByTimeAsync(MANAGED_CLOUD_REQUEST_TIMEOUT_MS - 1);

    expect(settled).toBe(false);
    expect(fetch.mock.calls[0]![1].signal?.aborted).toBe(false);
  });

  it("reports network_failed when the headers arrive but the body stalls past the timeout", async () => {
    const stalled = {
      ok: true,
      status: 200,
      redirected: false,
      url: "",
      headers: new Headers({ "Content-Type": "application/json" }),
      text: never,
      json: never,
    } as unknown as Response;
    const fetch = jest.fn(async () => stalled);

    const pending = createManagedCloudAPIClient(BASE_URL, fetch).getSession("s");
    await jest.advanceTimersByTimeAsync(MANAGED_CLOUD_REQUEST_TIMEOUT_MS);

    await expect(pending).resolves.toEqual({ ok: false, errorCode: "network_failed" });
  });

  it("leaves no timer behind once the answer arrives", async () => {
    const fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );

    await expect(
      createManagedCloudAPIClient(BASE_URL, fetch).getSession("s"),
    ).resolves.toEqual({ ok: false, errorCode: "unauthorized" });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("keeps Retry-After readable through the buffered response", async () => {
    const fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "Retry-After": "42" },
        }),
    );

    await expect(
      createManagedCloudAPIClient(BASE_URL, fetch).upsertPartnerProjection("s", "grant-1", {
        schemaVersion: 1,
        checksumSHA256: "deadbeef",
        ciphertextBase64: "c29tZS1jaXBoZXJ0ZXh0",
        ciphertextSize: 15,
        sourceInviteID: "invite-1",
      }),
    ).resolves.toEqual({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 42 });
  });
});

describe("managed-cloud-api-client server error classification", () => {
  it.each([
    ["the API's internal_error", 500, JSON.stringify({ error: "internal_error" })],
    ["an unknown error code", 500, JSON.stringify({ error: "boom" })],
    ["no body", 500, ""],
    ["a 501 page", 501, "<html>"],
  ])(
    "maps a %s answer with status %i to generic, a server answer rather than a transport failure",
    async (_label, status, body) => {
      const fetch = jest.fn(async () => new Response(body, { status }));

      const result = await createManagedCloudAPIClient(BASE_URL, fetch).getBillingSnapshot(
        "s",
      );

      expect(result).toEqual({ ok: false, errorCode: "generic" });
      expect(isManagedCloudTransportFailure("generic")).toBe(false);
    },
  );

  it.each([
    ["an unparseable 502 gateway page", 502, "<html>"],
    ["a 503 with no body", 503, ""],
    ["a 504 gateway timeout", 504, "<html>"],
  ])("maps %s to network_failed, a transport failure", async (_label, status, body) => {
    const fetch = jest.fn(async () => new Response(body, { status }));

    await expect(
      createManagedCloudAPIClient(BASE_URL, fetch).getBillingSnapshot("s"),
    ).resolves.toEqual({ ok: false, errorCode: "network_failed" });
  });
});
