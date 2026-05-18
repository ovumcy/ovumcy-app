import { Stack } from "expo-router";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAppScreenProtection } from "../src/security/app-screen-protection";
import { ConfirmDialogProvider } from "../src/ui/confirm/ConfirmDialogProvider";
import {
  AppPreferencesProvider,
  useAppPreferences,
} from "../src/ui/providers/AppPreferencesProvider";

export default function RootLayout() {
  return (
    <AppPreferencesProvider>
      <RootNavigator />
    </AppPreferencesProvider>
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
          </Stack>
        </View>
      </ConfirmDialogProvider>
    </GestureHandlerRootView>
  );
}
