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

// "disabled" means there is nothing to schedule on this device — every
// reminder toggle is off, or the enabled kinds produced no plans (pregnancy
// pause, no upcoming dates). It is NOT a premium state: the local device
// channel is a Free-tier feature and never consults the billing snapshot.
export type LocalReminderSyncResult =
  | LocalReminderSchedulerSyncResult
  | "disabled";

export type ReminderDeliverySyncResult = {
  email: ManagedReminderEmailSyncResult;
  local: LocalReminderSyncResult;
};

// Free-tier local channel: derives reminder plans purely from on-device
// profile + day-log data and hands them to the platform scheduler. Works
// with no account, sync, or premium plan (web parity — reminders ship in
// ovumcy-web's free owner flow).
export async function syncLocalReminderSchedule(
  storage: LocalAppStorage,
  scheduler: LocalReminderScheduler,
  profile: ProfileRecord,
  options: {
    locale?: string | undefined;
    now: Date;
  },
): Promise<LocalReminderSyncResult> {
  const { locale = "en", now } = options;
  const plans = await loadLocalReminderPlans(storage, profile, now, locale);
  return syncLocalReminderPlans(scheduler, plans);
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
    profile.fertileWindowReminderEnabled === true ||
    profile.kickCountReminderEnabled === true;

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
  const plans = await loadLocalReminderPlans(
    storage,
    profile,
    options.now,
    options.locale ?? "en",
  );
  // Local device notifications are Free-tier: they sync from local data
  // alone, before and independently of any billing lookup.
  const local = await syncLocalReminderPlans(scheduler, plans);

  // The managed billing snapshot stays the only premium truth for the EMAIL
  // channel — server-driven delivery beyond the web Free-tier baseline.
  const premiumFeatures = await loadManagedPremiumFeatures(
    storage,
    secretStore,
    syncPreferences.mode,
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
  // Pregnancy state gates two things: the kick-count plan (an active record at
  // gaWeeks >= 28) and prediction suppression for the period/fertile-window
  // plans (an ACTIVE record suppresses them even when the day-log pause is
  // lifted or was never set). Reading it only when one of those three flags is
  // on keeps a profile with none of them free of the extra storage call.
  // Kind-level gating stays in buildLocalReminderPlans; kick_count remains
  // local-push-only (the managed email channel filters it out in
  // managed-reminder-email-schedule-service).
  const needsPregnancyState =
    profile.kickCountReminderEnabled === true ||
    profile.upcomingPeriodReminderEnabled === true ||
    profile.fertileWindowReminderEnabled === true;
  const activePregnancy = needsPregnancyState
    ? await storage.readActivePregnancy()
    : null;
  return buildLocalReminderPlans(
    profile,
    records,
    now,
    locale,
    undefined,
    activePregnancy,
  );
}

async function syncLocalReminderPlans(
  scheduler: LocalReminderScheduler,
  plans: readonly LocalReminderPlan[],
): Promise<LocalReminderSyncResult> {
  if (plans.length === 0) {
    await scheduler.sync([]);
    return "disabled";
  }

  return scheduler.sync(plans);
}
