import { resolveEffectiveLanguage } from "../i18n/runtime";
import type { ProfileRecord } from "../models/profile";
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

// Reminders are local-first and account-free: plans derive purely from
// on-device profile + day-log data and go straight to the platform scheduler.
// Delivery happens on this device only — there is no server-side reminder
// channel, so this path reads no session, no billing snapshot, and no
// secret store at all (web parity — reminders ship in ovumcy-web's free
// owner flow).
//
// `now` is optional so a screen left open past midnight never plans from the
// day it was mounted: without an injected instant the clock is read here, at
// plan time. The plan service itself still takes "now" as a parameter.
export async function syncLocalReminderSchedule(
  storage: LocalAppStorage,
  scheduler: LocalReminderScheduler,
  profile: ProfileRecord,
  options: {
    locale?: string | undefined;
    now?: Date | undefined;
  },
): Promise<LocalReminderSyncResult> {
  const hasAnyReminderEnabled =
    profile.dailyLogReminderEnabled === true ||
    profile.upcomingPeriodReminderEnabled === true ||
    profile.fertileWindowReminderEnabled === true ||
    profile.kickCountReminderEnabled === true;

  // Every toggle off: clear the device schedule without touching day-log or
  // pregnancy storage at all.
  if (!hasAnyReminderEnabled) {
    await scheduler.sync([]);
    return "disabled";
  }

  const { locale = "en", now = new Date() } = options;
  const plans = await loadLocalReminderPlans(storage, profile, now, locale);
  return syncLocalReminderPlans(scheduler, plans);
}

// Rebuild from what is stored now, for a path that changed a plan input
// (profile, day logs, pregnancy record) without holding the profile it wrote:
// kick-count toggle, pregnancy start/end/re-date/delete, local-data delete,
// JSON import, app launch. Best effort: the caller's own write has already
// succeeded, so a failed rebuild resolves to "failed" instead of surfacing as
// that action's error; the next rebuild (at the latest the next launch)
// replaces the schedule. The copy language is the stored profile's effective
// interface language, the same value the app resolves at launch.
export async function rebuildLocalReminderScheduleFromStorage(
  storage: LocalAppStorage,
  scheduler: LocalReminderScheduler,
  options: {
    now?: Date | undefined;
  } = {},
): Promise<LocalReminderSyncResult | "failed"> {
  try {
    const profile = await storage.readProfileRecord();
    return await syncLocalReminderSchedule(storage, scheduler, profile, {
      locale: resolveEffectiveLanguage(profile.languageOverride),
      now: options.now,
    });
  } catch {
    return "failed";
  }
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
  // Kind-level gating stays in buildLocalReminderPlans.
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
