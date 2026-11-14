import type { ProfileRecord } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  legacyRowsWithdrawStoredCycleStart,
  repointStoredCycleStart,
} from "./cycle-history-service";
import { formatLocalDate } from "./profile-settings-policy";

export const STORED_CYCLE_START_REPOINT_VERSION = 1;

const MIN_DAY_LOG_DATE = "0001-01-01";

// Data written before the write paths repointed profile.lastPeriodStart was
// read under a wider withdrawal rule (any non-period, spotting or
// uncertain-marked row on its date). This re-reads such data once under that
// rule and stores the result, so the narrower read side shows the same start.
// Runs once per profile at launch (behind the stored version) and after every
// bulk write that can bring such data in (JSON import, sync restore).
export async function repointLegacyStoredCycleStart(
  storage: LocalAppStorage,
  now: Date,
  options: { force: boolean },
): Promise<void> {
  const profile = await storage.readProfileRecord();
  if (
    !options.force &&
    (profile.storedCycleStartRepointVersion ?? 0) >= STORED_CYCLE_START_REPOINT_VERSION
  ) {
    return;
  }

  const todayValue = formatLocalDate(now);
  const records = await storage.listDayLogRecordsInRange(MIN_DAY_LOG_DATE, todayValue);
  const nextProfile: ProfileRecord = {
    ...profile,
    storedCycleStartRepointVersion: STORED_CYCLE_START_REPOINT_VERSION,
  };
  if (legacyRowsWithdrawStoredCycleStart(profile, records)) {
    const repointed = repointStoredCycleStart(profile, records, todayValue);
    if (repointed !== profile.lastPeriodStart) {
      nextProfile.lastPeriodStart = repointed;
      nextProfile.lastPeriodStartBeforeRepoint = profile.lastPeriodStart;
    }
  }
  await storage.writeProfileRecord(nextProfile);
}
