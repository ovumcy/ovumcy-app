import { advanceSyncWipeEpoch, readSyncWipeEpoch } from "./sync-wipe-epoch";

describe("sync wipe epoch", () => {
  it("changes on every advance", () => {
    const before = readSyncWipeEpoch();
    advanceSyncWipeEpoch();
    const middle = readSyncWipeEpoch();
    advanceSyncWipeEpoch();

    expect(middle).not.toBe(before);
    expect(readSyncWipeEpoch()).not.toBe(middle);
  });
});
