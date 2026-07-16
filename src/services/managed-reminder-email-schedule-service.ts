import { resolveCopyLanguage } from "../i18n/runtime";
import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudReminderEmailScheduleKind,
  type ManagedCloudReminderEmailScheduleType,
} from "../sync/managed-cloud-api-client";
import { MANAGED_CLOUD_AUTH_BASE_URL, type SyncMode } from "../sync/sync-contract";
import {
  resolveReminderTimeZone,
  zonedWallTimeToUTC,
  type LocalReminderPlan,
} from "./local-reminder-plan-service";

export type ManagedReminderEmailSyncResult =
  | "synced"
  | "cleared"
  | "disabled"
  | "unavailable"
  | "failed"
  | "unauthorized";

export async function syncManagedReminderEmailSchedules(
  secretStore: SyncSecretStore,
  syncMode: SyncMode,
  plans: readonly LocalReminderPlan[],
  options: {
    enabled: boolean;
    locale?: string | undefined;
    timeZone?: string | undefined;
  },
): Promise<ManagedReminderEmailSyncResult> {
  if (syncMode !== "managed") {
    return "disabled";
  }

  const secrets = await secretStore.readSyncSecrets();
  if (!secrets?.managedAuthSessionToken) {
    return "disabled";
  }

  const client = createManagedCloudAPIClient(MANAGED_CLOUD_AUTH_BASE_URL);

  if (!options.enabled || plans.length === 0) {
    const clearResult = await client.clearReminderEmailSchedules(
      secrets.managedAuthSessionToken,
    );
    if (clearResult.ok) {
      return "cleared";
    }
    return clearResult.errorCode === "unauthorized"
      ? "unauthorized"
      : "failed";
  }

  const replaceResult = await client.replaceReminderEmailSchedules(
    secrets.managedAuthSessionToken,
    {
      schedules: buildManagedReminderEmailSchedules(
        plans,
        options.locale,
        options.timeZone,
      ),
    },
  );

  if (replaceResult.ok) {
    return "synced";
  }

  switch (replaceResult.errorCode) {
    case "unauthorized":
      return "unauthorized";
    case "reminder_schedule_unavailable":
      return "unavailable";
    default:
      return "failed";
  }
}

export function buildManagedReminderEmailSchedules(
  plans: readonly LocalReminderPlan[],
  locale: string | undefined,
  timeZone: string | undefined,
): {
  kind: ManagedCloudReminderEmailScheduleKind;
  scheduleType: ManagedCloudReminderEmailScheduleType;
  locale: string;
  timeZone: string;
  dailyHour: number;
  dailyMinute: number;
  nextDeliveryAt: string;
}[] {
  return plans.map((plan) => {
    const base = {
      kind: plan.kind,
      locale: normalizeReminderLocale(locale),
      // The plan already carries the resolved zone that the device push trigger
      // was built against; prefer it so email and push share one local day. The
      // explicit `timeZone` argument is only a fallback for plans built before
      // this field existed.
      timeZone: resolveReminderTimeZone(plan.timeZone ?? timeZone),
    } as const;

    if (plan.trigger.type === "daily") {
      return {
        ...base,
        scheduleType: "daily" as const,
        dailyHour: plan.trigger.hour,
        dailyMinute: plan.trigger.minute,
        nextDeliveryAt: nextDailyReminderDeliveryAt(
          base.timeZone,
          plan.trigger.hour,
          plan.trigger.minute,
        ).toISOString(),
      };
    }

    return {
      ...base,
      scheduleType: "once" as const,
      dailyHour: 0,
      dailyMinute: 0,
      nextDeliveryAt: plan.trigger.at.toISOString(),
    };
  });
}

function normalizeReminderLocale(locale: string | undefined): string {
  // Delegates to the canonical resolver (`resolveCopyLanguage`) instead of a
  // local subtag switch so this surface can't drift from the six supported
  // interface locales documented in docs/web-parity-checklist.md.
  return resolveCopyLanguage(locale);
}

function nextDailyReminderDeliveryAt(
  timeZone: string,
  hour: number,
  minute: number,
): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "1");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "1");
  const currentHour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const currentMinute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );

  const candidate = zonedWallTimeToUTC(timeZone, year, month, day, hour, minute);
  if (hour < currentHour || (hour === currentHour && minute <= currentMinute)) {
    return zonedWallTimeToUTC(timeZone, year, month, day + 1, hour, minute);
  }

  return candidate;
}
