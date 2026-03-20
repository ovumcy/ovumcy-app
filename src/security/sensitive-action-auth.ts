import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

type SensitiveActionChallengeResult =
  | { ok: true }
  | {
      ok: false;
      reason: "cancelled" | "failed" | "unavailable";
    };

const CANCELLED_ERRORS = new Set([
  "app_cancel",
  "system_cancel",
  "user_cancel",
]);

const UNAVAILABLE_ERRORS = new Set([
  "lockout",
  "not_available",
  "not_enrolled",
  "passcode_not_set",
]);

export async function requestSensitiveActionChallenge(
  promptMessage: string,
): Promise<SensitiveActionChallengeResult> {
  if (Platform.OS === "web") {
    return { ok: true };
  }

  try {
    const result = await LocalAuthentication.authenticateAsync({
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
      promptMessage,
      requireConfirmation: true,
    });

    if (result.success) {
      return { ok: true };
    }

    if (CANCELLED_ERRORS.has(result.error)) {
      return { ok: false, reason: "cancelled" };
    }

    if (UNAVAILABLE_ERRORS.has(result.error)) {
      return { ok: false, reason: "unavailable" };
    }

    return { ok: false, reason: "failed" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
