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
  cycle_day: true,
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

      // An empty plan only clears this app's schedules, which needs no
      // permission: asking here would prompt a user who never turned a
      // reminder on.
      if (plans.length === 0) {
        await clearManagedReminders(Notifications);
        return "scheduled" satisfies LocalReminderSchedulerSyncResult;
      }

      const granted = await ensureNotificationPermission(Notifications);
      if (!granted) {
        await clearManagedReminders(Notifications);
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
          // channelId routes the Android notification to the channel created
          // above instead of the fallback one; iOS ignores it.
          trigger:
            plan.trigger.type === "daily"
              ? {
                  type: Notifications.SchedulableTriggerInputTypes.DAILY,
                  channelId: OVUMCY_REMINDER_CHANNEL_ID,
                  hour: plan.trigger.hour,
                  minute: plan.trigger.minute,
                }
              : {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  channelId: OVUMCY_REMINDER_CHANNEL_ID,
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
    // A secure lock screen shows only that a reminder arrived, never its text,
    // so an opted-in cycle-day label is read after unlock. Android fixes a
    // channel's lock-screen visibility once the channel exists.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
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

// A cleared schedule (every reminder off, a local wipe, account deletion) also
// removes this app's reminders already shown in the notification shade, so an
// opted-in cycle-day label does not outlive the data it came from.
// Best effort: the schedules are already cancelled, so a shade that cannot be
// read, or one entry that refuses to go, must neither turn the clear into an
// error nor leave the remaining entries in place.
async function dismissPresentedReminders(Notifications: ExpoNotificationsModule) {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const notification of presented) {
      if (isOvumcyReminderKind(notification.request.content.data?.ovumcyReminderKind)) {
        try {
          await Notifications.dismissNotificationAsync(notification.request.identifier);
        } catch {
          // keep dismissing the rest
        }
      }
    }
  } catch {
    // the shade cannot be read; the schedules are cancelled regardless
  }
}

// The shade is cleared even when a cancel fails, so an opted-in label does not
// stay shown; the cancel error still reaches the caller.
async function clearManagedReminders(Notifications: ExpoNotificationsModule) {
  try {
    await cancelManagedReminderSchedules(Notifications);
  } finally {
    await dismissPresentedReminders(Notifications);
  }
}

export function createPlatformLocalReminderScheduler(): LocalReminderScheduler {
  return createNativeReminderScheduler();
}
