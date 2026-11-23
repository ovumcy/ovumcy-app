// Advanced by a destructive local reset (clear local data, account deletion).
// A sync flow captures it before its network call and writes nothing when it
// moved: a response arriving after the wipe must not put the pre-wipe secrets,
// preferences or restored records back.
let wipeEpoch = 0;

/** Changes whenever a wipe starts or finishes on this device. */
export function readSyncWipeEpoch(): number {
  return wipeEpoch;
}

/** Marks every sync flow begun before this call as superseded by a wipe. */
export function advanceSyncWipeEpoch(): void {
  wipeEpoch += 1;
}
