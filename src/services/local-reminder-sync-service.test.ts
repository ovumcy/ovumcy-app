import { createDefaultProfileRecord } from "../models/profile";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  syncLocalReminderSchedule,
  syncReminderDeliveryState,
} from "./local-reminder-sync-service";
import { loadManagedPremiumFeatures } from "./managed-premium-features-service";
import { syncManagedReminderEmailSchedules } from "./managed-reminder-email-schedule-service";
import type { LocalReminderScheduler } from "./local-reminder-scheduler-contract";

jest.mock("./managed-premium-features-service", () => ({
  loadManagedPremiumFeatures: jest.fn(),
}));
jest.mock("./managed-reminder-email-schedule-service", () => ({
  syncManagedReminderEmailSchedules: jest.fn(),
}));

const loadManagedPremiumFeaturesMock = loadManagedPremiumFeatures as jest.Mock;
const syncManagedReminderEmailSchedulesMock =
  syncManagedReminderEmailSchedules as jest.Mock;

function premiumFeaturesWithReminders(reminders: boolean) {
  return {
    advancedFertility: false,
    advancedInsights: false,
    doctorPDF: false,
    extendedReports: false,
    partnerAccess: false,
    reminders,
  };
}

function createScheduler(): LocalReminderScheduler {
  return {
    sync: jest.fn().mockResolvedValue("scheduled"),
  };
}

const cycleStartRecords = [
  {
    date: "2026-03-01",
    isPeriod: true,
    cycleStart: true,
    isUncertain: false,
    flow: "medium",
    mood: 0,
    sexActivity: "none",
    bbt: 0,
    cervicalMucus: "none",
    cycleFactorKeys: [],
    symptomIDs: [],
    notes: "",
  },
  {
    date: "2026-03-28",
    isPeriod: true,
    cycleStart: true,
    isUncertain: false,
    flow: "medium",
    mood: 0,
    sexActivity: "none",
    bbt: 0,
    cervicalMucus: "none",
    cycleFactorKeys: [],
    symptomIDs: [],
    notes: "",
  },
];

describe("local-reminder-sync-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("schedules local reminder plans without any account or premium access", async () => {
    const storage = createLocalAppStorageMock({
      listDayLogRecordsInRange: jest.fn().mockResolvedValue(cycleStartRecords),
    });
    const scheduler = createScheduler();
    const profile = {
      ...createDefaultProfileRecord(),
      dailyLogReminderEnabled: true,
      upcomingPeriodReminderEnabled: true,
      fertileWindowReminderEnabled: true,
      reminderTime: "21:30",
    };

    await expect(
      syncLocalReminderSchedule(storage, scheduler, profile, {
        now: new Date(2026, 3, 5, 10, 0, 0, 0),
      }),
    ).resolves.toBe("scheduled");

    expect(scheduler.sync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "daily_log",
          trigger: {
            type: "daily",
            hour: 21,
            minute: 30,
          },
        }),
      ]),
    );
  });

  it("returns disabled and clears the device schedule when nothing is enabled", async () => {
    const storage = createLocalAppStorageMock();
    const scheduler = createScheduler();

    await expect(
      syncLocalReminderSchedule(storage, scheduler, createDefaultProfileRecord(), {
        now: new Date(2026, 3, 5, 10, 0, 0, 0),
      }),
    ).resolves.toBe("disabled");

    expect(scheduler.sync).toHaveBeenCalledWith([]);
  });

  describe("syncReminderDeliveryState", () => {
    it("syncs the local device schedule for free users while the email channel stays gated", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock();
      const scheduler = createScheduler();
      loadManagedPremiumFeaturesMock.mockResolvedValue(
        premiumFeaturesWithReminders(false),
      );
      syncManagedReminderEmailSchedulesMock.mockResolvedValue("disabled");
      const profile = {
        ...createDefaultProfileRecord(),
        dailyLogReminderEnabled: true,
        // Owner opted into emails, but without the billing entitlement the
        // email channel must stay fail-closed while local still schedules.
        managedReminderEmailsEnabled: true,
      };

      const result = await syncReminderDeliveryState(
        storage,
        secretStore,
        scheduler,
        profile,
        { now: new Date(2026, 3, 5, 10, 0, 0, 0) },
      );

      expect(result.local).toBe("scheduled");
      expect(result.email).toBe("disabled");
      expect(scheduler.sync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ kind: "daily_log" }),
        ]),
      );
      expect(syncManagedReminderEmailSchedulesMock).toHaveBeenCalledWith(
        secretStore,
        expect.anything(),
        expect.arrayContaining([
          expect.objectContaining({ kind: "daily_log" }),
        ]),
        expect.objectContaining({ enabled: false }),
      );
    });

    it("enables managed email delivery only when billing grants reminders and the owner opted in", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock();
      const scheduler = createScheduler();
      loadManagedPremiumFeaturesMock.mockResolvedValue(
        premiumFeaturesWithReminders(true),
      );
      syncManagedReminderEmailSchedulesMock.mockResolvedValue("synced");
      const profile = {
        ...createDefaultProfileRecord(),
        dailyLogReminderEnabled: true,
        managedReminderEmailsEnabled: true,
      };

      const result = await syncReminderDeliveryState(
        storage,
        secretStore,
        scheduler,
        profile,
        { now: new Date(2026, 3, 5, 10, 0, 0, 0) },
      );

      expect(result.local).toBe("scheduled");
      expect(result.email).toBe("synced");
      expect(syncManagedReminderEmailSchedulesMock).toHaveBeenCalledWith(
        secretStore,
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ enabled: true }),
      );
    });

    it("keeps email delivery off when billing grants reminders but the owner opted out", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock();
      const scheduler = createScheduler();
      loadManagedPremiumFeaturesMock.mockResolvedValue(
        premiumFeaturesWithReminders(true),
      );
      syncManagedReminderEmailSchedulesMock.mockResolvedValue("cleared");
      const profile = {
        ...createDefaultProfileRecord(),
        dailyLogReminderEnabled: true,
        managedReminderEmailsEnabled: false,
      };

      await syncReminderDeliveryState(storage, secretStore, scheduler, profile, {
        now: new Date(2026, 3, 5, 10, 0, 0, 0),
      });

      expect(syncManagedReminderEmailSchedulesMock).toHaveBeenCalledWith(
        secretStore,
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ enabled: false }),
      );
    });

    it("clears both channels without a billing lookup when every reminder toggle is off", async () => {
      const storage = createLocalAppStorageMock();
      const secretStore = createSyncSecretStoreMock();
      const scheduler = createScheduler();
      syncManagedReminderEmailSchedulesMock.mockResolvedValue("cleared");

      const result = await syncReminderDeliveryState(
        storage,
        secretStore,
        scheduler,
        createDefaultProfileRecord(),
        { now: new Date(2026, 3, 5, 10, 0, 0, 0) },
      );

      expect(result.local).toBe("disabled");
      expect(scheduler.sync).toHaveBeenCalledWith([]);
      expect(syncManagedReminderEmailSchedulesMock).toHaveBeenCalledWith(
        secretStore,
        expect.anything(),
        [],
        { enabled: false },
      );
      expect(loadManagedPremiumFeaturesMock).not.toHaveBeenCalled();
    });
  });
});
