import type { LocalAppStorage } from "../storage/local/storage-contract";
import { cleanupStaleExportArtifacts } from "./export-artifact-cleanup";
import type { LocalReminderScheduler } from "./local-reminder-scheduler-contract";
import { rebuildLocalReminderScheduleFromStorage } from "./local-reminder-sync-service";
import { repointLegacyStoredCycleStart } from "./stored-cycle-start-repoint-service";

// Work that runs once per app launch, before the user can interact.
export async function runAppLaunchTasks(
  storage: LocalAppStorage,
  scheduler: LocalReminderScheduler,
): Promise<void> {
  // Any export artifact left over from a JS-process kill mid-share (cycle
  // CSV/JSON, doctor PDF, recovery phrase) is sensitive. Sweep them out of
  // the platform cache before the user can hand the device to anyone.
  // The sweep is independent of the rebuild, so a failed sweep never skips it.
  try {
    await cleanupStaleExportArtifacts();
  } catch {
    // Best effort: the next launch sweeps again.
  }

  // One-time re-read of the stored cycle start written under the earlier
  // withdrawal rule; it runs before the rebuild so reminders use the result.
  try {
    await repointLegacyStoredCycleStart(storage, new Date(), { force: false });
  } catch {
    // Best effort: the version is not stored, so the next launch retries.
  }

  // A one-time reminder that already fired is replaced only by a rebuild, so
  // every launch rebuilds the schedule from stored data.
  await rebuildLocalReminderScheduleFromStorage(storage, scheduler);
}
