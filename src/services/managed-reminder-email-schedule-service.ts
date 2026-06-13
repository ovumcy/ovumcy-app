import type { SyncSecretStore } from "../security/sync-secret-store";
import {
  createManagedCloudAPIClient,
  type ManagedCloudReminderEmailScheduleKind,
  type ManagedCloudReminderEmailScheduleType,
} from "../sync/managed-cloud-api-client";
import { MANAGED_CLOUD_AUTH_BASE_URL, type SyncMode } from "../sync/sync-contract";
import type { LocalReminderPlan } from "./local-reminder-plan-service";

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
      timeZone: resolveReminderTimeZone(timeZone),
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
  const subtag = String(locale ?? "")
    .toLowerCase()
    .replace(/_/g, "-")
    .split("-")[0];
  switch (subtag) {
    case "ru":
    case "es":
    case "de":
    case "fr":
      return subtag;
    default:
      return "en";
  }
}

function resolveReminderTimeZone(timeZone: string | undefined): string {
  const normalized = String(timeZone ?? "").trim();
  if (normalized.length > 0) {
    return normalized;
  }

  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return resolved?.trim() ? resolved : "UTC";
  } catch {
    return "UTC";
  }
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

  const candidate = zonedDateTimeToUTC(timeZone, year, month, day, hour, minute);
  if (hour < currentHour || (hour === currentHour && minute <= currentMinute)) {
    return zonedDateTimeToUTC(timeZone, year, month, day + 1, hour, minute);
  }

  return candidate;
}

function zonedDateTimeToUTC(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const approximate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(approximate);

  const zonedYear = Number(parts.find((part) => part.type === "year")?.value ?? year);
  const zonedMonth = Number(parts.find((part) => part.type === "month")?.value ?? month);
  const zonedDay = Number(parts.find((part) => part.type === "day")?.value ?? day);
  const zonedHour = Number(parts.find((part) => part.type === "hour")?.value ?? hour);
  const zonedMinute = Number(parts.find((part) => part.type === "minute")?.value ?? minute);
  const zonedSecond = Number(parts.find((part) => part.type === "second")?.value ?? 0);

  const zonedAsUTC = Date.UTC(
    zonedYear,
    zonedMonth - 1,
    zonedDay,
    zonedHour,
    zonedMinute,
    zonedSecond,
    0,
  );
  const targetAsUTC = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  return new Date(approximate.getTime() - (zonedAsUTC - targetAsUTC));
}
