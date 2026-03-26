import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

import { requestSensitiveActionChallenge } from "./sensitive-action-auth";

jest.mock("expo-local-authentication", () => ({
  authenticateAsync: jest.fn(),
}));

const mockAuthenticateAsync = jest.mocked(LocalAuthentication.authenticateAsync);

describe("requestSensitiveActionChallenge", () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    mockAuthenticateAsync.mockReset();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatformOS,
    });
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

  it("treats browser preview as unavailable for sensitive device challenges", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });

    await expect(
      requestSensitiveActionChallenge("Confirm sensitive action"),
    ).resolves.toEqual({ ok: false, reason: "unavailable" });
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
  });

  it("allows an explicit web bypass when the caller already has another guard", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "web",
    });

    await expect(
      requestSensitiveActionChallenge("Confirm sensitive action", {
        allowWebBypass: true,
      }),
    ).resolves.toEqual({ ok: true });
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
  });
});
