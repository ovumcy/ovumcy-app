import type { ProfileRecord } from "../models/profile";
import type { SyncSecretStore } from "../security/sync-secret-store";
import { loadManagedPremiumFeatures } from "./managed-premium-features-service";
import {
  syncManagedReminderEmailSchedules,
  type ManagedReminderEmailSyncResult,
} from "./managed-reminder-email-schedule-service";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import { formatLocalDate } from "./profile-settings-policy";
import {
  buildLocalReminderPlans,
  type LocalReminderPlan,
} from "./local-reminder-plan-service";
import type {
  LocalReminderScheduler,
  LocalReminderSchedulerSyncResult,
} from "./local-reminder-scheduler-contract";

export type LocalReminderSyncResult =
  | LocalReminderSchedulerSyncResult
  | "disabled";

export type ReminderDeliverySyncResult = {
  email: ManagedReminderEmailSyncResult;
  local: LocalReminderSyncResult;
};

export async function syncLocalReminderSchedule(
  storage: LocalAppStorage,
  scheduler: LocalReminderScheduler,
  profile: ProfileRecord,
  options: {
    locale?: string | undefined;
    now: Date;
    premiumEnabled: boolean;
  },
): Promise<LocalReminderSyncResult> {
  const { locale = "en", now, premiumEnabled } = options;
  const plans = await loadLocalReminderPlans(storage, profile, now, locale);

  if (!premiumEnabled) {
    await scheduler.sync([]);
    return "disabled";
  }

  if (plans.length === 0) {
    await scheduler.sync([]);
    return "disabled";
  }

  return scheduler.sync(plans);
}

export async function syncManagedLocalReminderSchedule(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  scheduler: LocalReminderScheduler,
  profile: ProfileRecord,
  options: {
    locale?: string | undefined;
    now: Date;
  },
): Promise<LocalReminderSyncResult> {
  const result = await syncReminderDeliveryState(
    storage,
    secretStore,
    scheduler,
    profile,
    options,
  );
  return result.local;
}

export async function syncReminderDeliveryState(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  scheduler: LocalReminderScheduler,
  profile: ProfileRecord,
  options: {
    locale?: string | undefined;
    now: Date;
    timeZone?: string | undefined;
  },
): Promise<ReminderDeliverySyncResult> {
  const hasAnyReminderEnabled =
    profile.dailyLogReminderEnabled === true ||
    profile.upcomingPeriodReminderEnabled === true ||
    profile.fertileWindowReminderEnabled === true;

  if (!hasAnyReminderEnabled) {
    await scheduler.sync([]);
    const syncPreferences = await storage.readSyncPreferencesRecord();
    const email = await syncManagedReminderEmailSchedules(
      secretStore,
      syncPreferences.mode,
      [],
      {
        enabled: false,
      },
    );
    return {
      email,
      local: "disabled",
    };
  }

  const syncPreferences = await storage.readSyncPreferencesRecord();
  const premiumFeatures = await loadManagedPremiumFeatures(
    storage,
    secretStore,
    syncPreferences.mode,
  );
  const plans = await loadLocalReminderPlans(
    storage,
    profile,
    options.now,
    options.locale ?? "en",
  );
  const local = await syncLocalReminderPlans(
    scheduler,
    plans,
    premiumFeatures.reminders,
  );

  const email = await syncManagedReminderEmailSchedules(
    secretStore,
    syncPreferences.mode,
    plans,
    {
      enabled:
        premiumFeatures.reminders &&
        profile.managedReminderEmailsEnabled === true,
      locale: options.locale,
      timeZone: options.timeZone,
    },
  );

  return {
    email,
    local,
  };
}

async function loadLocalReminderPlans(
  storage: LocalAppStorage,
  profile: ProfileRecord,
  now: Date,
  locale: string,
) {
  const rangeStart = formatLocalDate(
    new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()),
  );
  const today = formatLocalDate(now);
  const records = await storage.listDayLogRecordsInRange(rangeStart, today);
  return buildLocalReminderPlans(profile, records, now, locale);
}

async function syncLocalReminderPlans(
  scheduler: LocalReminderScheduler,
  plans: readonly LocalReminderPlan[],
  premiumEnabled: boolean,
): Promise<LocalReminderSyncResult> {
  if (!premiumEnabled || plans.length === 0) {
    await scheduler.sync([]);
    return "disabled";
  }

  return scheduler.sync(plans);
}
