import * as LocalAuthentication from "expo-local-authentication";

import { requestSensitiveActionChallenge } from "./sensitive-action-auth";

jest.mock("expo-local-authentication", () => ({
  authenticateAsync: jest.fn(),
}));

const mockAuthenticateAsync = jest.mocked(LocalAuthentication.authenticateAsync);

describe("requestSensitiveActionChallenge", () => {
  beforeEach(() => {
    mockAuthenticateAsync.mockReset();
  });

  it("succeeds when local authentication succeeds", async () => {
    mockAuthenticateAsync.mockResolvedValue({
      success: true,
    } as Awaited<ReturnType<typeof LocalAuthentication.authenticateAsync>>);

    await expect(
      requestSensitiveActionChallenge("Confirm sensitive action"),
    ).resolves.toEqual({ ok: true });
  });

  it("maps unavailable device security to an unavailable result", async () => {
    mockAuthenticateAsync.mockResolvedValue({
      success: false,
      error: "not_enrolled",
    } as Awaited<ReturnType<typeof LocalAuthentication.authenticateAsync>>);

    await expect(
      requestSensitiveActionChallenge("Confirm sensitive action"),
    ).resolves.toEqual({ ok: false, reason: "unavailable" });
  });

  it("maps user cancellation to a cancelled result", async () => {
    mockAuthenticateAsync.mockResolvedValue({
      success: false,
      error: "user_cancel",
    } as Awaited<ReturnType<typeof LocalAuthentication.authenticateAsync>>);

    await expect(
      requestSensitiveActionChallenge("Confirm sensitive action"),
    ).resolves.toEqual({ ok: false, reason: "cancelled" });
  });
});
