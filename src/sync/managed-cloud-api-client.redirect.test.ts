import { fetch as expoFetch } from "expo/fetch";

import {
  createManagedCloudAPIClient,
  type ManagedCloudAPIClient,
} from "./managed-cloud-api-client";
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

// Typed against the client, so a new endpoint fails to compile until it is
// listed here and covered by the sweep.
const ENDPOINTS: {
  [K in keyof ManagedCloudAPIClient]: (
    client: ManagedCloudAPIClient,
  ) => Promise<unknown>;
} = {
  register: (c) => c.register({ email: "a@example.test", password: "pw" }),
  login: (c) => c.login({ email: "a@example.test", password: "pw" }),
  logout: (c) => c.logout({ sessionToken: "s", refreshToken: "r" }),
  deleteAccount: (c) => c.deleteAccount("s", {} as never),
  changePassword: (c) => c.changePassword("s", {} as never),
  forgotPassword: (c) => c.forgotPassword({} as never),
  resetPassword: (c) => c.resetPassword({} as never),
  regenerateRecoveryCode: (c) => c.regenerateRecoveryCode("s", {} as never),
  replaceRecoveryKey: (c) =>
    c.replaceRecoveryKey("s", { recoveryKeyPackage: {} } as never),
  startTOTPEnrollment: (c) => c.startTOTPEnrollment("s", {} as never),
  verifyTOTPEnrollment: (c) => c.verifyTOTPEnrollment("s", {} as never),
  disableTOTP: (c) => c.disableTOTP("s", {} as never),
  completeTOTPChallenge: (c) => c.completeTOTPChallenge({} as never),
  refreshSession: (c) => c.refreshSession("r"),
  getSession: (c) => c.getSession("s"),
  createSyncSession: (c) => c.createSyncSession("s"),
  getBillingSnapshot: (c) => c.getBillingSnapshot("s"),
  getEntitlementToken: (c) => c.getEntitlementToken("s"),
  getPartnerAccess: (c) => c.getPartnerAccess("s"),
  getPartnerProjection: (c) => c.getPartnerProjection("s", "grant-1"),
  issuePartnerInvite: (c) => c.issuePartnerInvite("s", {} as never),
  acceptPartnerInvite: (c) => c.acceptPartnerInvite("s", "invite-token"),
  acceptPartnerInviteAsGuest: (c) => c.acceptPartnerInviteAsGuest("invite-token"),
  upgradeGuestAccount: (c) => c.upgradeGuestAccount("s", {} as never),
  revokePartnerInvite: (c) => c.revokePartnerInvite("s", "invite-1"),
  revokePartnerGrant: (c) => c.revokePartnerGrant("s", "grant-1"),
  upsertPartnerProjection: (c) =>
    c.upsertPartnerProjection("s", "grant-1", { ciphertextSize: 1 } as never),
};

describe("managed-cloud-api-client redirect refusal", () => {
  it("lists every client method in the sweep", () => {
    const client = createManagedCloudAPIClient(BASE_URL, jest.fn());
    expect(Object.keys(client).sort()).toEqual(Object.keys(ENDPOINTS).sort());
  });

  describe.each(Object.entries(ENDPOINTS))("%s", (_name, call) => {
    it("asks the fetch to refuse redirects", async () => {
      const fetch = jest
        .fn()
        .mockResolvedValue(responseFrom(`${BASE_URL}/x`, false));

      await call(createManagedCloudAPIClient(BASE_URL, fetch));

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch.mock.calls[0][1]).toEqual(
        expect.objectContaining({ redirect: "error" }),
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
