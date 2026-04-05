import * as Notifications from "expo-notifications";
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

function createNativeReminderScheduler(): LocalReminderScheduler {
  return {
    async sync(plans: readonly LocalReminderPlan[]) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        await cancelManagedReminderSchedules();
        return "permission_denied" satisfies LocalReminderSchedulerSyncResult;
      }

      await cancelManagedReminderSchedules();
      await ensureReminderChannel();

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

async function ensureReminderChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(OVUMCY_REMINDER_CHANNEL_ID, {
    name: "Ovumcy reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
  });
}

async function ensureNotificationPermission() {
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

async function cancelManagedReminderSchedules() {
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
