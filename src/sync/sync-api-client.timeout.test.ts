import { SYNC_ENDPOINTS } from "../test/sync-api-endpoint-sweep";
import {
  createSyncAPIClient,
  SYNC_BLOB_TRANSFER_TIMEOUT_MS,
  SYNC_REQUEST_TIMEOUT_MS,
} from "./sync-api-client";

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

const BASE_URL = "https://sync.example.test/api";
const BLOB_METHODS = new Set(["getBlob", "putBlob"]);

function never(): Promise<never> {
  return new Promise<never>(() => undefined);
}

describe("sync-api-client request timeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe.each(Object.entries(SYNC_ENDPOINTS))("%s", (name, call) => {
    const deadline = BLOB_METHODS.has(name)
      ? SYNC_BLOB_TRANSFER_TIMEOUT_MS
      : SYNC_REQUEST_TIMEOUT_MS;

    it("aborts the request and reports network_failed at its deadline, not before", async () => {
      const fetch = jest.fn((_url: string, _init: RequestInit) => never());
      let settled = false;

      const pending = call(createSyncAPIClient(BASE_URL, fetch)).then((result) => {
        settled = true;
        return result;
      });
      await jest.advanceTimersByTimeAsync(deadline - 1);
      expect(settled).toBe(false);
      expect(fetch.mock.calls[0]![1].signal?.aborted).toBe(false);

      await jest.advanceTimersByTimeAsync(1);
      await expect(pending).resolves.toEqual(
        expect.objectContaining({ ok: false, errorCode: "network_failed" }),
      );
      expect(fetch.mock.calls[0]![1].signal?.aborted).toBe(true);
    });
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

    const pending = createSyncAPIClient(BASE_URL, fetch).getSession("s");
    await jest.advanceTimersByTimeAsync(SYNC_REQUEST_TIMEOUT_MS);

    await expect(pending).resolves.toEqual({ ok: false, errorCode: "network_failed" });
  });

  it("leaves no timer behind once the answer arrives", async () => {
    const fetch = jest.fn(
      async () => new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    );

    await expect(createSyncAPIClient(BASE_URL, fetch).getSession("s")).resolves.toEqual({
      ok: false,
      errorCode: "unauthorized",
    });
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
      createSyncAPIClient(BASE_URL, fetch).login({ login: "a", password: "p" }),
    ).resolves.toEqual(
      expect.objectContaining({ ok: false, errorCode: "rate_limited", retryAfterSeconds: 42 }),
    );
  });
});
