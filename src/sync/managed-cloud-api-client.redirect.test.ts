import { fetch as expoFetch } from "expo/fetch";

import { createManagedCloudAPIClient } from "./managed-cloud-api-client";
import { MANAGED_CLOUD_ENDPOINTS } from "../test/managed-cloud-endpoint-sweep";
import { responseLeftRequestOrigin } from "./redirect-refusing-fetch";

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

const BASE_URL = "https://cloud.example.test/api";

function responseFrom(
  url: string,
  redirected: boolean,
  body: unknown = {},
  status = 200,
): Response {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  Object.defineProperty(response, "url", { value: url });
  Object.defineProperty(response, "redirected", { value: redirected });
  return response;
}

describe("managed-cloud-api-client redirect refusal", () => {
  it("lists every client method in the sweep", () => {
    const client = createManagedCloudAPIClient(BASE_URL, jest.fn());
    expect(Object.keys(client).sort()).toEqual(Object.keys(MANAGED_CLOUD_ENDPOINTS).sort());
  });

  describe.each(Object.entries(MANAGED_CLOUD_ENDPOINTS))("%s", (_name, call) => {
    it("asks the fetch to refuse redirects", async () => {
      const fetch = jest
        .fn()
        .mockResolvedValue(responseFrom(`${BASE_URL}/x`, false));

      await call(createManagedCloudAPIClient(BASE_URL, fetch));

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1]).toEqual(
        expect.objectContaining({ redirect: "error", credentials: "omit" }),
      );
    });

    it("fails closed on a response that followed a redirect", async () => {
      const fetch = jest
        .fn()
        .mockResolvedValue(responseFrom("https://attacker.example/x", true));

      const result = await call(createManagedCloudAPIClient(BASE_URL, fetch));

      expect(result).toEqual(
        expect.objectContaining({ ok: false, errorCode: "network_failed" }),
      );
    });

    it("fails closed on a response from another origin", async () => {
      const fetch = jest
        .fn()
        .mockResolvedValue(responseFrom("https://attacker.example/x", false));

      const result = await call(createManagedCloudAPIClient(BASE_URL, fetch));

      expect(result).toEqual(
        expect.objectContaining({ ok: false, errorCode: "network_failed" }),
      );
    });

    it("maps a fetch that throws on a refused redirect to network_failed", async () => {
      const fetch = jest
        .fn()
        .mockRejectedValue(
          new Error("Redirect is not allowed when redirect mode is 'error'"),
        );

      const result = await call(createManagedCloudAPIClient(BASE_URL, fetch));

      expect(result).toEqual(
        expect.objectContaining({ ok: false, errorCode: "network_failed" }),
      );
    });
  });

  it("passes a same-origin, non-redirected response through", async () => {
    const fetch = jest.fn().mockResolvedValue(
      responseFrom(
        `${BASE_URL}/auth/session`,
        false,
        { error: "unauthorized" },
        401,
      ),
    );

    const result = await createManagedCloudAPIClient(BASE_URL, fetch).getSession(
      "s",
    );

    expect(result).toEqual({ ok: false, errorCode: "unauthorized" });
  });

  it("defaults to expo/fetch, which enforces redirect: error natively", async () => {
    const mockedExpoFetch = jest.mocked(expoFetch);
    mockedExpoFetch.mockResolvedValue(
      responseFrom(`${BASE_URL}/auth/session`, false) as never,
    );

    await createManagedCloudAPIClient(BASE_URL).getSession("s");

    expect(mockedExpoFetch).toHaveBeenCalledTimes(1);
    expect(mockedExpoFetch.mock.calls[0]![0]).toBe(`${BASE_URL}/auth/session`);
    expect(mockedExpoFetch.mock.calls[0]![1]).toEqual(
      expect.objectContaining({ redirect: "error" }),
    );
  });
});

describe("responseLeftRequestOrigin", () => {
  const request = "https://cloud.example.test/api/auth/login";

  it.each([
    ["an empty response URL", "", false, false],
    ["the same origin and path", request, false, false],
    ["the same origin with different case", "HTTPS://Cloud.Example.Test/api/x", false, false],
    ["a followed same-origin redirect", "https://cloud.example.test/other", true, true],
    ["another host", "https://attacker.example/api/auth/login", false, true],
    ["a lookalike suffix host", "https://cloud.example.test.attacker.example/api", false, true],
    ["another scheme", "http://cloud.example.test/api/auth/login", false, true],
    ["another port", "https://cloud.example.test:8443/api/auth/login", false, true],
    ["userinfo hiding another host", "https://cloud.example.test@attacker.example/api", false, true],
    ["an unparseable response URL", "not a url", false, true],
  ])("classifies %s (url %j, redirected %s) as left=%s", (_label, url, redirected, expected) => {
    expect(responseLeftRequestOrigin(request, { url, redirected })).toBe(expected);
  });

  it("fails closed when the request URL cannot be parsed", () => {
    expect(
      responseLeftRequestOrigin("relative/path", {
        url: "https://cloud.example.test/x",
        redirected: false,
      }),
    ).toBe(true);
  });
});
