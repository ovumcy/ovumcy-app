import type {
  LocalReminderScheduler,
  LocalReminderSchedulerSyncResult,
} from "./local-reminder-scheduler-contract";

function createWebReminderScheduler(): LocalReminderScheduler {
  return {
    async sync() {
      return "unavailable" satisfies LocalReminderSchedulerSyncResult;
    },
  };
}

export function createPlatformLocalReminderScheduler(): LocalReminderScheduler {
  return createWebReminderScheduler();
}

