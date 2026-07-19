import type { PartnerShareSecretStore } from "../../../security/partner-share-secret-store";
import * as localReminderSyncService from "../../../services/local-reminder-sync-service";
import * as managedPartnerShareSyncService from "../../../services/managed-partner-share-sync-service";
import * as settingsScreenService from "../../../services/settings-screen-service";
import { loadSettingsScreenState } from "../../../services/settings-state-service";
import {
  buildSettingsViewData,
  type LoadedSettingsState,
} from "../../../services/settings-view-service";
import { createSettingsStorageMock } from "../../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../../test/create-sync-secret-store-mock";
import { runSavePendingSettingsAction } from "./settings-screen-save-actions";

const now = new Date(2026, 2, 17);
const viewData = buildSettingsViewData(now, "en");
const noopPartnerShareSecretStore = {} as unknown as PartnerShareSecretStore;

const allClean = {
  isCycleDirty: false,
  isReminderDirty: false,
  isInterfaceDirty: false,
  isTrackingDirty: false,
};

async function loadReadyState(): Promise<LoadedSettingsState> {
  const storage = createSettingsStorageMock();
  const syncSecretStore = createSyncSecretStoreMock();
  return loadSettingsScreenState(storage, syncSecretStore, now);
}

function createContext() {
  return {
    effectiveNow: now,
    setCycleErrorMessage: jest.fn(),
    setCycleStatusMessage: jest.fn(),
    setInterfaceErrorMessage: jest.fn(),
    setInterfaceStatusMessage: jest.fn(),
    setIsSavingReminders: jest.fn(),
    setIsSavingCycle: jest.fn(),
    setIsSavingInterface: jest.fn(),
    setIsSavingTracking: jest.fn(),
    setReminderStatusMessage: jest.fn(),
    setReminderStatusTone: jest.fn(),
    setState: jest.fn(),
    setTrackingStatusMessage: jest.fn(),
    reminderScheduler: { sync: jest.fn().mockResolvedValue("scheduled") },
    locale: "en",
    partnerShareSecretStore: noopPartnerShareSecretStore,
    storage: createSettingsStorageMock(),
    syncSecretStore: createSyncSecretStoreMock(),
    syncProfilePreferences: jest.fn(),
    viewData,
  } satisfies Parameters<typeof runSavePendingSettingsAction>[0];
}

describe("runSavePendingSettingsAction: cycle save failures", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [
      "invalid_last_period_start",
      () => viewData.status.invalidLastPeriodStart,
    ],
    ["invalid_cycle_settings", () => viewData.cycle.messages.errorIncompatible],
    ["generic", () => viewData.status.saveFailed],
  ] as const)(
    "maps %s to the cycle error banner and stops the save",
    async (errorCode, expected) => {
      const readyState = await loadReadyState();
      const context = createContext();
      jest
        .spyOn(settingsScreenService, "saveCycleSettings")
        .mockResolvedValue({ ok: false, errorCode });
      const syncSpy = jest.spyOn(
        managedPartnerShareSyncService,
        "syncManagedPartnerSharedProjections",
      );

      const result = await runSavePendingSettingsAction(context, readyState, {
        ...allClean,
        isCycleDirty: true,
      });

      expect(result).toBe(false);
      expect(context.setCycleErrorMessage).toHaveBeenCalledWith(expected());
      expect(context.setState).toHaveBeenCalledWith(readyState);
      // A failed cycle save must not fan out into a partner-projection
      // resync or continue on to the next dirty section.
      expect(syncSpy).not.toHaveBeenCalled();
    },
  );
});

describe("runSavePendingSettingsAction: tracking save failure", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("reports the generic save-failed banner and stops the save", async () => {
    const readyState = await loadReadyState();
    const context = createContext();
    jest
      .spyOn(settingsScreenService, "saveTrackingSettings")
      .mockResolvedValue({ ok: false, errorCode: "generic" });

    const result = await runSavePendingSettingsAction(context, readyState, {
      ...allClean,
      isTrackingDirty: true,
    });

    expect(result).toBe(false);
    expect(context.setTrackingStatusMessage).toHaveBeenCalledWith(
      viewData.status.saveFailed,
    );
    expect(context.setState).toHaveBeenCalledWith(readyState);
  });
});

describe("runSavePendingSettingsAction: reminder save failures", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["invalid_reminder_time", () => viewData.reminders.errors.invalidTime],
    ["generic", () => viewData.reminders.errors.saveFailed],
  ] as const)(
    "maps %s to the reminder error tone and stops the save",
    async (errorCode, expected) => {
      const readyState = await loadReadyState();
      const context = createContext();
      jest
        .spyOn(settingsScreenService, "saveReminderSettings")
        .mockResolvedValue({ ok: false, errorCode });

      const result = await runSavePendingSettingsAction(context, readyState, {
        ...allClean,
        isReminderDirty: true,
      });

      expect(result).toBe(false);
      expect(context.setReminderStatusMessage).toHaveBeenCalledWith(expected());
      expect(context.setReminderStatusTone).toHaveBeenCalledWith("error");
      expect(context.setState).toHaveBeenCalledWith(readyState);
    },
  );
});

describe("runSavePendingSettingsAction: interface save failure", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("reports the generic save-failed banner and never previews the failed values app-wide", async () => {
    const readyState = await loadReadyState();
    const context = createContext();
    jest
      .spyOn(settingsScreenService, "saveInterfaceSettings")
      .mockResolvedValue({ ok: false, errorCode: "generic" });

    const result = await runSavePendingSettingsAction(context, readyState, {
      ...allClean,
      isInterfaceDirty: true,
    });

    expect(result).toBe(false);
    expect(context.setInterfaceErrorMessage).toHaveBeenCalledWith(
      viewData.status.saveFailed,
    );
    expect(context.syncProfilePreferences).not.toHaveBeenCalled();
    expect(context.setState).toHaveBeenCalledWith(readyState);
  });
});

describe("runSavePendingSettingsAction: multi-section save sequencing", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("resyncs partner-shared projections after cycle and tracking, and reminder delivery once at the end", async () => {
    const readyState = await loadReadyState();
    const context = createContext();
    const cycleState = { ...readyState, cycleValues: { ...readyState.cycleValues } };
    const trackingState = {
      ...cycleState,
      trackingValues: { ...cycleState.trackingValues },
    };
    jest
      .spyOn(settingsScreenService, "saveCycleSettings")
      .mockResolvedValue({ ok: true, state: cycleState });
    jest
      .spyOn(settingsScreenService, "saveTrackingSettings")
      .mockResolvedValue({ ok: true, state: trackingState });
    const partnerSyncSpy = jest
      .spyOn(managedPartnerShareSyncService, "syncManagedPartnerSharedProjections")
      .mockResolvedValue({ skipped: true, syncedCount: 0 });
    const reminderSyncSpy = jest
      .spyOn(localReminderSyncService, "syncReminderDeliveryState")
      .mockResolvedValue({ local: "scheduled", email: "disabled" });

    const result = await runSavePendingSettingsAction(context, readyState, {
      ...allClean,
      isCycleDirty: true,
      isTrackingDirty: true,
    });

    expect(result).toBe(true);
    // Fired once after the cycle save and once after the tracking save.
    expect(partnerSyncSpy).toHaveBeenCalledTimes(2);
    // Reminder delivery only resyncs once, at the end, keyed off the final
    // merged profile rather than either intermediate state.
    expect(reminderSyncSpy).toHaveBeenCalledTimes(1);
    expect(reminderSyncSpy).toHaveBeenCalledWith(
      context.storage,
      context.syncSecretStore,
      context.reminderScheduler,
      trackingState.profile,
      { locale: "en", now },
    );
    expect(context.setState).toHaveBeenLastCalledWith(trackingState);
  });
});

describe("runSavePendingSettingsAction: reminder delivery status mapping", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [
      "permission_denied local overrides any email result",
      { local: "permission_denied", email: "synced" } as const,
      () => viewData.reminders.status.permissionDenied,
      "error",
    ],
    [
      "unavailable local overrides any email result",
      { local: "unavailable", email: "synced" } as const,
      () => viewData.reminders.status.unavailable,
      "info",
    ],
    [
      "scheduled local + synced email",
      { local: "scheduled", email: "synced" } as const,
      () => viewData.reminders.status.savedWithEmail,
      "success",
    ],
    [
      "scheduled local + unavailable email",
      { local: "scheduled", email: "unavailable" } as const,
      () => viewData.reminders.status.emailUnavailable,
      "info",
    ],
    [
      "scheduled local + failed email",
      { local: "scheduled", email: "failed" } as const,
      () => viewData.reminders.status.emailSyncFailed,
      "error",
    ],
    [
      "scheduled local + unauthorized email",
      { local: "scheduled", email: "unauthorized" } as const,
      () => viewData.reminders.status.emailSyncFailed,
      "error",
    ],
    [
      "scheduled local + disabled email (all reminders off) falls back to plain saved",
      { local: "scheduled", email: "disabled" } as const,
      () => viewData.reminders.status.saved,
      "success",
    ],
  ] as const)("%s", async (_label, syncResult, expectedMessage, expectedTone) => {
    const readyState = await loadReadyState();
    const context = createContext();
    jest
      .spyOn(settingsScreenService, "saveReminderSettings")
      .mockResolvedValue({ ok: true, state: readyState });
    jest
      .spyOn(localReminderSyncService, "syncReminderDeliveryState")
      .mockResolvedValue(syncResult);

    await runSavePendingSettingsAction(context, readyState, {
      ...allClean,
      isReminderDirty: true,
    });

    expect(context.setReminderStatusMessage).toHaveBeenLastCalledWith(
      expectedMessage(),
    );
    expect(context.setReminderStatusTone).toHaveBeenLastCalledWith(expectedTone);
  });
});
