import { useLocalSearchParams } from "expo-router";

import { OnboardingScreen } from "../src/ui/screens/OnboardingScreen";

export default function OnboardingRoute() {
  const { reset } = useLocalSearchParams<{ reset?: string | string[] }>();

  return <OnboardingScreen reloadKey={reset} />;
}
