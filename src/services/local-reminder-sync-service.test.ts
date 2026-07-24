import { createPregnancyRecord } from "../models/pregnancy";
import { createDefaultProfileRecord } from "../models/profile";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "../test/create-sync-secret-store-mock";
import {
  syncLocalReminderSchedule,
  syncReminderDeliveryState,
} from "./local-reminder-sync-service";
import { loadManagedPremiumFeatures } from "./managed-premium-features-service";
import { syncManagedReminderEmailSchedules } from "./managed-reminder-email-schedule-service";
import { addDays, parseLocalDate } from "./profile-settings-policy";
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

  describe("kick-count reminder wiring(end-to-end through the sync service)", () => {
    const KICK_EDD = "2026-10-08";

    function nowForGaDays(gaDays: number): Date {
      return addDays(parseLocalDate(KICK_EDD)!, gaDays - 280);
    }

    function activePregnancyRecord() {
      return createPregnancyRecord({
        edd: KICK_EDD,
        eddBasis: "lmp",
        lmpDate: "2026-01-01",
        startedAt: "2026-03-01",
      });
    }

    it("never reads pregnancy state when the kick flag is off, and schedules no kick plan", async () => {
      const storage = createLocalAppStorageMock({
        listDayLogRecordsInRange: jest.fn().mockResolvedValue(cycleStartRecords),
      });
      const scheduler = createScheduler();
      const profile = {
        ...createDefaultProfileRecord(),
        dailyLogReminderEnabled: true,
        kickCountReminderEnabled: false,
      };

      await expect(
        syncLocalReminderSchedule(storage, scheduler, profile, {
          now: new Date(2026, 3, 5, 10, 0, 0, 0),
        }),
      ).resolves.toBe("scheduled");

      // Plain cycle load stays free of the extra pregnancy read.
      expect(storage.readActivePregnancy).not.toHaveBeenCalled();
      const [plans] = (scheduler.sync as jest.Mock).mock.calls[0] as [
        { kind: string }[],
      ];
      expect(plans.some((plan) => plan.kind === "kick_count")).toBe(false);
    });

    it("schedules the kick reminder at the profile reminder time when on, active, and >= 28 weeks", async () => {
      // Kick is the ONLY enabled reminder: this exercises both edits at once —
      // the hasAnyReminderEnabled gate no longer short-circuits, and the
      // plan-builder receives the active pregnancy.
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(activePregnancyRecord()),
      });
      const secretStore = createSyncSecretStoreMock();
      const scheduler = createScheduler();
      loadManagedPremiumFeaturesMock.mockResolvedValue(
        premiumFeaturesWithReminders(false),
      );
      syncManagedReminderEmailSchedulesMock.mockResolvedValue("disabled");
      const profile = {
        ...createDefaultProfileRecord(),
        kickCountReminderEnabled: true,
        reminderTime: "09:15",
      };

      const result = await syncReminderDeliveryState(
        storage,
        secretStore,
        scheduler,
        profile,
        { now: nowForGaDays(28 * 7) },
      );

      expect(result.local).toBe("scheduled");
      expect(storage.readActivePregnancy).toHaveBeenCalledTimes(1);
      expect(scheduler.sync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "kick_count",
            trigger: { type: "daily", hour: 9, minute: 15 },
          }),
        ]),
      );
    });

    it("schedules nothing when the flag is on but there is no active pregnancy", async () => {
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(null),
      });
      const scheduler = createScheduler();
      const profile = {
        ...createDefaultProfileRecord(),
        kickCountReminderEnabled: true,
      };

      await expect(
        syncLocalReminderSchedule(storage, scheduler, profile, {
          now: new Date(2026, 5, 1, 10, 0, 0, 0),
        }),
      ).resolves.toBe("disabled");

      expect(storage.readActivePregnancy).toHaveBeenCalledTimes(1);
      expect(scheduler.sync).toHaveBeenCalledWith([]);
    });

    it("schedules nothing for an ended pregnancy (defense-in-depth on the status field)", async () => {
      // The real repo's readActivePregnancy never returns an ended record;
      // mocking one here proves the plan-builder's own status check holds
      // end-to-end even if that repo contract were violated.
      const ended = {
        ...activePregnancyRecord(),
        status: "ended" as const,
        endedAt: "2026-09-01",
        endReason: "birth" as const,
        modeOfDelivery: "vaginal" as const,
      };
      const storage = createLocalAppStorageMock({
        readActivePregnancy: jest.fn().mockResolvedValue(ended),
      });
      const scheduler = createScheduler();
      const profile = {
        ...createDefaultProfileRecord(),
        kickCountReminderEnabled: true,
      };

      await expect(
        syncLocalReminderSchedule(storage, scheduler, profile, {
          now: nowForGaDays(30 * 7),
        }),
      ).resolves.toBe("disabled");

      expect(scheduler.sync).toHaveBeenCalledWith([]);
    });
  });
});
