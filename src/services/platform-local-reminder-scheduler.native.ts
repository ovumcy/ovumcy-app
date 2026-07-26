import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import type {
  LocalReminderKind,
  LocalReminderPlan,
} from "./local-reminder-plan-service";
import type {
  LocalReminderScheduler,
  LocalReminderSchedulerSyncResult,
} from "./local-reminder-scheduler-contract";

// Every kind this scheduler owns. `sync` cancels its own schedules before
// planning again, so a kind missing here is scheduled and never cancelled --
// by any path, including the reminders-off one. A Record over the union
// rather than a Set of strings so a new LocalReminderKind fails to compile
// until it is listed.
const OVUMCY_REMINDER_KINDS: Record<LocalReminderKind, true> = {
  daily_log: true,
  upcoming_period: true,
  fertile_window: true,
  kick_count: true,
};
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

// hasOwnProperty, not `in`: an inherited key ("toString") would otherwise
// match and cancel a notification this app never scheduled.
function isOvumcyReminderKind(value: unknown): value is LocalReminderKind {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(OVUMCY_REMINDER_KINDS, value)
  );
}

async function cancelManagedReminderSchedules(
  Notifications: ExpoNotificationsModule,
) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of scheduled) {
    if (isOvumcyReminderKind(request.content.data?.ovumcyReminderKind)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
}

export function createPlatformLocalReminderScheduler(): LocalReminderScheduler {
  return createNativeReminderScheduler();
}
