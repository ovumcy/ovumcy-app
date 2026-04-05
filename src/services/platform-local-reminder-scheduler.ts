import { Platform } from "react-native";

import type { LocalReminderScheduler } from "./local-reminder-scheduler-contract";
import { createPlatformLocalReminderScheduler as createNativeScheduler } from "./platform-local-reminder-scheduler.native";
import { createPlatformLocalReminderScheduler as createWebScheduler } from "./platform-local-reminder-scheduler.web";

export function createPlatformLocalReminderScheduler(): LocalReminderScheduler {
  if (Platform.OS === "web") {
    return createWebScheduler();
  }

  return createNativeScheduler();
}
