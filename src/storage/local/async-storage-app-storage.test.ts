import AsyncStorage from "@react-native-async-storage/async-storage";

import { createDefaultProfileRecord } from "../../models/profile";
import * as legacySource from "./async-storage-app-storage";
import {
  clearAsyncStorageLocalAppData,
  DAY_LOG_RECORDS_KEY,
  hasAsyncStorageLocalAppData,
  ONBOARDING_RECORD_KEY,
  PROFILE_RECORD_KEY,
  readAsyncStorageBootstrapState,
  readAsyncStorageProfileRecord,
} from "./async-storage-app-storage";

describe("async-storage-app-storage (legacy source)", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("exposes only readers and the scrubbing clear, never a plaintext storage adapter", () => {
    const functionExports = Object.entries(legacySource)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();

    expect(functionExports).toEqual([
      "clearAsyncStorageLocalAppData",
      "hasAsyncStorageLocalAppData",
      "readAsyncStorageBootstrapState",
      "readAsyncStorageProfileRecord",
    ]);
  });

  it("returns defaults when no legacy state exists", async () => {
    await expect(readAsyncStorageBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: false,
      profileVersion: 2,
      incompleteOnboardingStep: 1,
    });
    await expect(readAsyncStorageProfileRecord()).resolves.toEqual(
      createDefaultProfileRecord(),
    );
  });

  it("reads a stored bootstrap state", async () => {
    await AsyncStorage.setItem(
      "ovumcy/bootstrap-state",
      JSON.stringify({
        hasCompletedOnboarding: true,
        profileVersion: 5,
        incompleteOnboardingStep: null,
      }),
    );

    await expect(readAsyncStorageBootstrapState()).resolves.toEqual({
      hasCompletedOnboarding: true,
      profileVersion: 5,
      incompleteOnboardingStep: null,
    });
  });

  it("normalizes legacy ageGroup values to unspecified on profile read", async () => {
    for (const ageGroup of ["age_35_plus", "age_20_35", "under_20"]) {
      await AsyncStorage.setItem(
        PROFILE_RECORD_KEY,
        JSON.stringify({ ...createDefaultProfileRecord(), ageGroup }),
      );
      await expect(readAsyncStorageProfileRecord()).resolves.toEqual(
        expect.objectContaining({ ageGroup: "" }),
      );
    }
  });

  it("migrates a legacy onboarding-only record into the canonical profile on first read", async () => {
    // Before the canonical profile-record key existed, onboarding state lived
    // under ONBOARDING_RECORD_KEY alone; the reader folds that one-time shape
    // into a full ProfileRecord rather than dropping the pre-migration data.
    await AsyncStorage.setItem(
      ONBOARDING_RECORD_KEY,
      JSON.stringify({
        lastPeriodStart: "2026-02-01",
        cycleLength: 27,
        periodLength: 4,
        autoPeriodFill: true,
        irregularCycle: false,
        unpredictableCycle: false,
        ageGroup: "age_20_35",
        usageGoal: "avoid_pregnancy",
      }),
    );

    await expect(readAsyncStorageProfileRecord()).resolves.toEqual(
      expect.objectContaining({
        lastPeriodStart: "2026-02-01",
        cycleLength: 27,
        periodLength: 4,
        usageGoal: "avoid_pregnancy",
      }),
    );
  });

  it("reports whether any legacy local data is present", async () => {
    await expect(hasAsyncStorageLocalAppData()).resolves.toBe(false);

    await AsyncStorage.setItem(
      PROFILE_RECORD_KEY,
      JSON.stringify(createDefaultProfileRecord()),
    );

    await expect(hasAsyncStorageLocalAppData()).resolves.toBe(true);
  });

  it("falls back to defaults when a stored record is corrupted JSON", async () => {
    // A corrupted legacy value never throws out of the storage layer; it
    // degrades to defaults exactly like a missing key.
    await AsyncStorage.setItem(PROFILE_RECORD_KEY, "{not valid json");

    await expect(readAsyncStorageProfileRecord()).resolves.toEqual(
      createDefaultProfileRecord(),
    );
  });

  it("clears every legacy key and falls back to defaults", async () => {
    await AsyncStorage.setItem(
      PROFILE_RECORD_KEY,
      JSON.stringify({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-14",
      }),
    );
    await AsyncStorage.setItem(DAY_LOG_RECORDS_KEY, "{}");
    await AsyncStorage.setItem("ovumcy/pregnancy-records", "{}");
    await AsyncStorage.setItem("ovumcy/screening-responses", "{}");

    await clearAsyncStorageLocalAppData();

    await expect(hasAsyncStorageLocalAppData()).resolves.toBe(false);
    await expect(AsyncStorage.getAllKeys()).resolves.toEqual([]);
    await expect(readAsyncStorageProfileRecord()).resolves.toEqual(
      createDefaultProfileRecord(),
    );
  });

  // The spies below wrap the AsyncStorage mock, which exposes jest.fn();
  // mockRestore() on a spy layered over a pre-existing jest.fn() resets it to
  // a bare no-op mock rather than the real implementation, which would silently
  // break every AsyncStorage write in any test that runs afterward.
  it("overwrites legacy plaintext keys before removing them", async () => {
    // `multiRemove` alone unlinks keys but leaves the old plaintext in the
    // store's freed pages. The clear path first overwrites each key with an
    // inert filler, then removes it, so the residue exposed to forensic
    // recovery is filler, not the original health data.
    await AsyncStorage.setItem(
      PROFILE_RECORD_KEY,
      JSON.stringify({
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-14",
      }),
    );
    await AsyncStorage.setItem(
      DAY_LOG_RECORDS_KEY,
      JSON.stringify({ "2026-03-18": { notes: "forensic residue check" } }),
    );

    const multiSetSpy = jest.spyOn(AsyncStorage, "multiSet");
    const multiRemoveSpy = jest.spyOn(AsyncStorage, "multiRemove");
    multiSetSpy.mockClear();
    multiRemoveSpy.mockClear();

    await clearAsyncStorageLocalAppData();

    expect(multiSetSpy).toHaveBeenCalled();
    expect(multiRemoveSpy).toHaveBeenCalled();
    expect(multiSetSpy.mock.invocationCallOrder[0]).toBeLessThan(
      multiRemoveSpy.mock.invocationCallOrder[0]!,
    );

    const overwritePairs = multiSetSpy.mock.calls.flatMap((call) => call[0]);
    const overwrittenKeys = overwritePairs.map(([key]) => key);
    expect(overwrittenKeys).toEqual(
      expect.arrayContaining([
        "ovumcy/profile-record",
        "ovumcy/day-log-records",
        "ovumcy/pregnancy-records",
        "ovumcy/postpartum-records",
        "ovumcy/screening-responses",
      ]),
    );
    for (const [, value] of overwritePairs) {
      expect(value).not.toContain("2026-03-14");
      expect(value).not.toContain("forensic residue check");
    }

    multiSetSpy.mockRestore();
    multiRemoveSpy.mockRestore();
  });
});
