import type { LocalReminderPlan } from "./local-reminder-plan-service";

export type LocalReminderSchedulerSyncResult =
  | "scheduled"
  | "permission_denied"
  | "unavailable";

export type LocalReminderScheduler = {
  sync(plans: readonly LocalReminderPlan[]): Promise<LocalReminderSchedulerSyncResult>;
};

