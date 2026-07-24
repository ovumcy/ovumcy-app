import { useLocalSearchParams } from "expo-router";

import { PregnancyEndScreen } from "../src/ui/screens/pregnancy/PregnancyEndScreen";

export default function PregnancyEndRoute() {
  // Transport-only: forward the coarse ?reason intent; the screen re-derives
  // everything else from storage/service and tolerates a missing/invalid value.
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  return (
    <PregnancyEndScreen
      reasonParam={typeof reason === "string" ? reason : undefined}
    />
  );
}
