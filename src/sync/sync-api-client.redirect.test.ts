import { fetch as expoFetch } from "expo/fetch";

import { SYNC_ENDPOINTS } from "../test/sync-api-endpoint-sweep";
import { createSyncAPIClient } from "./sync-api-client";

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

const BASE_URL = "https://sync.example.test/api";

function responseFrom(url: string, redirected: boolean, status = 200): Response {
  const response = new Response(JSON.stringify({}), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  Object.defineProperty(response, "url", { value: url });
  Object.defineProperty(response, "redirected", { value: redirected });
  return response;
}

describe("sync-api-client redirect refusal", () => {
  it("lists every client method in the sweep", () => {
    const client = createSyncAPIClient(BASE_URL, jest.fn());
    expect(Object.keys(client).sort()).toEqual(Object.keys(SYNC_ENDPOINTS).sort());
  });

  describe.each(Object.entries(SYNC_ENDPOINTS))("%s", (_name, call) => {
    it("asks the fetch to refuse redirects and omit cookies", async () => {
      const fetch = jest.fn().mockResolvedValue(responseFrom(`${BASE_URL}/x`, false));

      await call(createSyncAPIClient(BASE_URL, fetch));

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1]).toEqual(
        expect.objectContaining({ redirect: "error", credentials: "omit" }),
      );
    });

    it("fails closed on a response that followed a redirect", async () => {
      const fetch = jest
        .fn()
        .mockResolvedValue(responseFrom("https://attacker.example/x", true));

      const result = await call(createSyncAPIClient(BASE_URL, fetch));

      expect(result).toEqual(
        expect.objectContaining({ ok: false, errorCode: "network_failed" }),
      );
    });

    it("fails closed on a response from another origin", async () => {
      const fetch = jest
        .fn()
        .mockResolvedValue(responseFrom("https://attacker.example/x", false));

      const result = await call(createSyncAPIClient(BASE_URL, fetch));

      expect(result).toEqual(
        expect.objectContaining({ ok: false, errorCode: "network_failed" }),
      );
    });

    it("maps a fetch that throws on a refused redirect to network_failed", async () => {
      const fetch = jest
        .fn()
        .mockRejectedValue(new Error("Redirect is not allowed when redirect mode is 'error'"));

      const result = await call(createSyncAPIClient(BASE_URL, fetch));

      expect(result).toEqual(
        expect.objectContaining({ ok: false, errorCode: "network_failed" }),
      );
    });
  });

  it("keeps a same-origin answer", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(responseFrom(`${BASE_URL}/auth/session`, false, 401));

    const result = await createSyncAPIClient(BASE_URL, fetch).getSession("s");

    expect(result).toEqual({ ok: false, errorCode: "generic" });
  });

  it("defaults to expo/fetch, which enforces redirect: error natively", async () => {
    const mockedExpoFetch = jest.mocked(expoFetch);
    mockedExpoFetch.mockResolvedValue(
      responseFrom(`${BASE_URL}/sync/capabilities`, false) as never,
    );

    await createSyncAPIClient(BASE_URL).getCapabilities("s");

    expect(mockedExpoFetch).toHaveBeenCalledTimes(1);
    expect(mockedExpoFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/sync/capabilities`);
    expect(mockedExpoFetch.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ redirect: "error" }),
    );
  });
});
