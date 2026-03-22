import { Stack } from "expo-router";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { getSettingsCopy } from "../src/i18n/settings-copy";
import { useAppScreenProtection } from "../src/security/app-screen-protection";
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
  const { colors, language } = useAppPreferences();
  useAppScreenProtection();
  const settingsCopy = getSettingsCopy(language);

  return (
    <GestureHandlerRootView
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
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
          <Stack.Screen
            name="backup-sync"
            options={{
              headerShown: true,
              headerShadowVisible: false,
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              title: settingsCopy.account.title,
            }}
          />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}
