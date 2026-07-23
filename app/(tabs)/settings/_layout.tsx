import { Stack } from "expo-router";

export default function SettingsStackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: "transparent" },
        headerShown: false,
      }}
    />
  );
}
