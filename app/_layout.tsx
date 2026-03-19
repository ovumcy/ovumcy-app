import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
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
  const { colors } = useAppPreferences();

  return (
    <GestureHandlerRootView
      style={{ backgroundColor: colors.background, flex: 1 }}
    >
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}
