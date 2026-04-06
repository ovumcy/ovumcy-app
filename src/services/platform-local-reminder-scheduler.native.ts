import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import type { LocalReminderPlan } from "./local-reminder-plan-service";
import type {
  LocalReminderScheduler,
  LocalReminderSchedulerSyncResult,
} from "./local-reminder-scheduler-contract";

const OVUMCY_REMINDER_KINDS = new Set<string>([
  "daily_log",
  "upcoming_period",
  "fertile_window",
] as const);
const OVUMCY_REMINDER_CHANNEL_ID = "ovumcy-reminders";
type ExpoNotificationsModule = typeof import("expo-notifications");

function createNativeReminderScheduler(): LocalReminderScheduler {
  return {
    async sync(plans: readonly LocalReminderPlan[]) {
      if (isExpoGoStoreClient()) {
        return "unavailable" satisfies LocalReminderSchedulerSyncResult;
      }

      const Notifications = loadExpoNotificationsModule();
      const granted = await ensureNotificationPermission(Notifications);
      if (!granted) {
        await cancelManagedReminderSchedules(Notifications);
        return "permission_denied" satisfies LocalReminderSchedulerSyncResult;
      }

      await cancelManagedReminderSchedules(Notifications);
      await ensureReminderChannel(Notifications);

      for (const plan of plans) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: plan.title,
            body: plan.body,
            sound: "default",
            data: {
              ovumcyReminderKind: plan.kind,
            },
          },
          trigger:
            plan.trigger.type === "daily"
              ? {
                  type: Notifications.SchedulableTriggerInputTypes.DAILY,
                  hour: plan.trigger.hour,
                  minute: plan.trigger.minute,
                }
              : {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: plan.trigger.at,
                },
        });
      }

      return "scheduled" satisfies LocalReminderSchedulerSyncResult;
    },
  };
}

function isExpoGoStoreClient() {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function loadExpoNotificationsModule(): ExpoNotificationsModule {
  // load expo-notifications only outside Expo Go so startup stays quiet there
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("expo-notifications") as ExpoNotificationsModule;
}

async function ensureReminderChannel(Notifications: ExpoNotificationsModule) {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(OVUMCY_REMINDER_CHANNEL_ID, {
    name: "Ovumcy reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

async function ensureNotificationPermission(
  Notifications: ExpoNotificationsModule,
) {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted || existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return (
    requested.granted ||
    requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function cancelManagedReminderSchedules(
  Notifications: ExpoNotificationsModule,
) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of scheduled) {
    const kind = request.content.data?.ovumcyReminderKind;
    if (typeof kind === "string" && OVUMCY_REMINDER_KINDS.has(kind)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
}

export function createPlatformLocalReminderScheduler(): LocalReminderScheduler {
  return createNativeReminderScheduler();
}
