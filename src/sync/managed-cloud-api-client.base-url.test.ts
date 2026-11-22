import { createManagedCloudAPIClient } from "./managed-cloud-api-client";
import { MANAGED_CLOUD_ENDPOINTS } from "../test/managed-cloud-endpoint-sweep";

jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

const REFUSED_BASE_URLS = [
  "http://managed.ovumcy.cloud",
  "http://203.0.113.10:8090",
  "http://192.168.1.1.attacker.example",
  "http://169.254.10.10",
  "ftp://managed.ovumcy.cloud",
  "javascript:alert(1)",
  "managed.ovumcy.cloud",
  "not a url",
  "",
];

const PERMITTED_BASE_URLS = [
  "https://managed.ovumcy.cloud",
  "https://cloud.example.test/api/",
  "http://10.0.2.2:8090",
  "http://127.0.0.1:8090",
  "http://localhost:8090",
  "http://[::1]:8090",
  "http://192.168.1.20",
  "http://ovumcy.local",
];

function okResponse(url: string): Response {
  const response = new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}

describe("managed-cloud-api-client base URL scheme check", () => {
  describe.each(REFUSED_BASE_URLS)("refused base URL %j", (baseURL) => {
    it.each(Object.entries(MANAGED_CLOUD_ENDPOINTS))(
      "%s sends no request and fails closed",
      async (_name, call) => {
        const fetch = jest.fn();

        const result = await call(createManagedCloudAPIClient(baseURL, fetch));

        expect(fetch).not.toHaveBeenCalled();
        expect(result).toEqual(
          expect.objectContaining({ ok: false, errorCode: "network_failed" }),
        );
      },
    );
  });

  it.each(PERMITTED_BASE_URLS)("sends requests to permitted base URL %j", async (baseURL) => {
    const normalized = baseURL.replace(/\/+$/, "");
    const fetch = jest.fn().mockResolvedValue(okResponse(`${normalized}/x`));

    await MANAGED_CLOUD_ENDPOINTS.login(
      createManagedCloudAPIClient(baseURL, fetch),
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0]).startsWith(`${normalized}/`)).toBe(true);
  });
});
