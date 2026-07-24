import { useLocalSearchParams } from "expo-router";

import { ScreeningScreen } from "../src/ui/screens/postpartum/ScreeningScreen";

export default function PostpartumScreeningRoute() {
  // Transport-only: forward the coarse ?view intent (questionnaire | history).
  // No health data rides the param — the screen re-derives everything from
  // storage/service and tolerates a missing/invalid value.
  const { view } = useLocalSearchParams<{ view?: string }>();
  return (
    <ScreeningScreen
      initialView={view === "history" ? "history" : "questionnaire"}
    />
  );
}
