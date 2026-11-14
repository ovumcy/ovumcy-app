import type { ProfileRecord } from "../models/profile";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  legacyRowsWithdrawStoredCycleStart,
  repointStoredCycleStart,
} from "./cycle-history-service";
import { formatLocalDate } from "./profile-settings-policy";

export const STORED_CYCLE_START_REPOINT_VERSION = 1;

const MIN_DAY_LOG_DATE = "0001-01-01";

// The repoint version and the stashed start describe this device's own
// migration. They never leave it (sync snapshot, JSON export): an older client
// would carry a version it does not honour, so a profile arriving from
// elsewhere is always re-read.
export function withoutStoredCycleStartRepointState(profile: ProfileRecord): ProfileRecord {
  const outgoing = { ...profile };
  delete outgoing.storedCycleStartRepointVersion;
  delete outgoing.lastPeriodStartBeforeRepoint;
  return outgoing;
}

// Data written before the write paths repointed profile.lastPeriodStart was
// read under a wider withdrawal rule (any non-period, spotting or
// uncertain-marked row on its date). This re-reads such data once under that
// rule and stores the result, so the narrower read side shows the same start.
// It runs at launch until the version is stored, and after a sync restore or a
// profile-restoring import, whose profile never carries the version.
export async function repointLegacyStoredCycleStart(
  storage: LocalAppStorage,
  now: Date,
): Promise<void> {
  const profile = await storage.readProfileRecord();
  if ((profile.storedCycleStartRepointVersion ?? 0) >= STORED_CYCLE_START_REPOINT_VERSION) {
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
