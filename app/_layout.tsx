import { Stack } from "expo-router";
import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { cleanupStaleExportArtifacts } from "../src/services/export-artifact-cleanup";
import { useAppScreenProtection } from "../src/security/app-screen-protection";
import { ConfirmDialogProvider } from "../src/ui/confirm/ConfirmDialogProvider";
import {
  AppPreferencesProvider,
  useAppPreferences,
} from "../src/ui/providers/AppPreferencesProvider";
import { AppErrorScreen } from "../src/ui/screens/AppErrorScreen";

// F9 note: the invite_token scrub for web targets is bootstrapped from
// index.js (see src/security/web-invite-token-scrub-bootstrap.ts). By the
// time expo-router lazy-loads this layout, window.location has already
// been cleaned and the token (if any) is stashed in the in-memory buffer.

export default function RootLayout() {
  useEffect(() => {
    // F10.b: any export artifact left over from a JS-process kill mid-share
    // (cycle CSV/JSON, doctor PDF, recovery phrase) is sensitive. Sweep
    // them out of the platform cache before the user can hand the device
    // to anyone.
    void cleanupStaleExportArtifacts();
  }, []);

  return (
    <AppPreferencesProvider>
      <RootNavigator />
    </AppPreferencesProvider>
  );
}

// expo-router renders this in place of the crashed tree, including
// AppPreferencesProvider itself — so AppErrorScreen must stay
// context-free (see its own file for the constraint).
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <AppErrorScreen
      message={error.message}
      onRetry={() => {
        void retry();
      }}
    />
  );
}

function RootNavigator() {
  const { colors, screenCaptureProtectionEnabled } = useAppPreferences();
  useAppScreenProtection(screenCaptureProtectionEnabled);

  return (
    <GestureHandlerRootView
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
      <ConfirmDialogProvider>
        <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              contentStyle: { backgroundColor: "transparent" },
              headerShown: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="backup-sync" />
            <Stack.Screen name="sync-account-security" />
            <Stack.Screen name="partner-shared" />
            <Stack.Screen name="privacy" />
          </Stack>
        </View>
      </ConfirmDialogProvider>
    </GestureHandlerRootView>
  );
}
