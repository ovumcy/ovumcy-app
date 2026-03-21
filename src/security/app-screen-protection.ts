import { useEffect } from "react";
import { Platform } from "react-native";
import {
  allowScreenCaptureAsync,
  disableAppSwitcherProtectionAsync,
  enableAppSwitcherProtectionAsync,
  preventScreenCaptureAsync,
} from "expo-screen-capture";

const APP_SCREEN_PROTECTION_KEY = "ovumcy.app-screen-protection";
const IOS_APP_SWITCHER_BLUR_INTENSITY = 0.7;

type AppScreenProtectionOptions = {
  isDevelopment?: boolean;
};

export function useAppScreenProtection(
  enabled = true,
  options: AppScreenProtectionOptions = {},
) {
  const isDevelopment = options.isDevelopment ?? __DEV__;

  useEffect(() => {
    if (!enabled || Platform.OS === "web" || isDevelopment) {
      return;
    }

    void preventScreenCaptureAsync(APP_SCREEN_PROTECTION_KEY).catch(() => {
      // Best-effort privacy hardening on supported native platforms.
    });

    if (Platform.OS === "ios") {
      void enableAppSwitcherProtectionAsync(
        IOS_APP_SWITCHER_BLUR_INTENSITY,
      ).catch(() => {
        // Best-effort privacy hardening on supported native platforms.
      });
    }

    return () => {
      void allowScreenCaptureAsync(APP_SCREEN_PROTECTION_KEY).catch(() => {
        // Best-effort cleanup when the app shell unmounts.
      });

      if (Platform.OS === "ios") {
        void disableAppSwitcherProtectionAsync().catch(() => {
          // Best-effort cleanup when the app shell unmounts.
        });
      }
    };
  }, [enabled, isDevelopment]);
}
