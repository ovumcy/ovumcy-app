import type { LocalAppStorage } from "../storage/local/storage-contract";
import { cleanupStaleExportArtifacts } from "./export-artifact-cleanup";
import type { LocalReminderScheduler } from "./local-reminder-scheduler-contract";
import { rebuildLocalReminderScheduleFromStorage } from "./local-reminder-sync-service";
import { acknowledgePregnancyModulePurchase } from "./pregnancy-purchase-service";
import { repointLegacyStoredCycleStart } from "./stored-cycle-start-repoint-service";

export const STORED_CYCLE_START_REPOINT_TIMEOUT_MS = 10_000;

// Work that runs once per app launch, before the user can interact.
// `onProfileSettled` fires once the one-time stored-cycle-start repoint has
// finished or failed; the shell renders screens only after it, so no screen
// reads (and later saves back) a profile from before the repoint. A repoint
// still pending after the timeout settles the gate anyway and writes nothing
// when it ends, so it never saves over a profile edited since; the unstored
// version re-runs it at the next launch.
export async function runAppLaunchTasks(
  storage: LocalAppStorage,
  scheduler: LocalReminderScheduler,
  onProfileSettled?: () => void,
): Promise<void> {
  // One-time re-read of the stored cycle start written under the earlier
  // withdrawal rule; it runs before the rebuild so reminders use the result.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  try {
    await Promise.race([
      repointLegacyStoredCycleStart(storage, new Date(), () => !timedOut),
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          resolve();
        }, STORED_CYCLE_START_REPOINT_TIMEOUT_MS);
      }),
    ]);
  } catch {
    // Best effort: the version is not stored, so the next launch retries.
  } finally {
    clearTimeout(timer);
    onProfileSettled?.();
  }

  // Any export artifact left over from a JS-process kill mid-share (cycle
  // CSV/JSON, doctor PDF, recovery phrase) is sensitive. Sweep them out of
  // the platform cache before the user can hand the device to anyone.
  // The sweep is independent of the rebuild, so a failed sweep never skips it.
  try {
    await cleanupStaleExportArtifacts();
  } catch {
    // Best effort: the next launch sweeps again.
  }

  // A store purchase that was still pending at the last run may have been
  // charged since, and the store refunds one left unacknowledged for three
  // days. It runs beside the rebuild — a slow store never delays reminders —
  // and never rejects.
  const acknowledged = acknowledgePregnancyModulePurchase();

  // A one-time reminder that already fired is replaced only by a rebuild, so
  // every launch rebuilds the schedule from stored data.
  await rebuildLocalReminderScheduleFromStorage(storage, scheduler);
  await acknowledged;
}
