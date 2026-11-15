type ExpoNotificationsMock = {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getAllScheduledNotificationsAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  getPresentedNotificationsAsync: jest.Mock;
  dismissNotificationAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
};

const DAILY_PLAN = {
  kind: "daily_log" as const,
  title: "Ovumcy reminder",
  body: "Open Ovumcy to update today's entry.",
  trigger: {
    type: "daily" as const,
    hour: 21,
    minute: 30,
  },
};

const KICK_COUNT_PLAN = {
  kind: "kick_count" as const,
  title: "Ovumcy reminder",
  body: "Open Ovumcy to update today's entry.",
  trigger: {
    type: "daily" as const,
    hour: 21,
    minute: 30,
  },
};

function loadSchedulerModule(executionEnvironment: string) {
  jest.resetModules();
  jest.doMock("expo-constants", () => ({
    __esModule: true,
    default: {
      executionEnvironment,
    },
    ExecutionEnvironment: {
      Bare: "bare",
      Standalone: "standalone",
      StoreClient: "storeClient",
    },
  }));

  return jest.requireActual<typeof import("./platform-local-reminder-scheduler.native")>(
    "./platform-local-reminder-scheduler.native",
  );
}

describe("platform-local-reminder-scheduler.native", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.unmock("expo-constants");
  });

  it("returns unavailable in Expo Go without touching expo-notifications", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "storeClient",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    await expect(scheduler.sync([DAILY_PLAN])).resolves.toBe("unavailable");

    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it("uses expo-notifications in standalone builds", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    await expect(scheduler.sync([DAILY_PLAN])).resolves.toBe("scheduled");

    expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: DAILY_PLAN.title,
          body: DAILY_PLAN.body,
          data: {
            ovumcyReminderKind: DAILY_PLAN.kind,
          },
        }),
      }),
    );
  });

  it("schedules a kick-count reminder under its own kind", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    await expect(scheduler.sync([KICK_COUNT_PLAN])).resolves.toBe("scheduled");

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          data: {
            ovumcyReminderKind: "kick_count",
          },
        }),
      }),
    );
  });

  // sync([]) is the every-reminder-off path (local-reminder-sync-service), and
  // the same cancel pass runs on a denied permission and on every re-plan. A
  // kind absent from the cancel set is scheduled daily and cancellable by
  // nothing short of uninstalling the app.
  it("cancels an already-scheduled kick-count reminder when reminders are turned off", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: "kick-1", content: { data: { ovumcyReminderKind: "kick_count" } } },
    ]);

    await expect(scheduler.sync([])).resolves.toBe("scheduled");

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "kick-1",
    );
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("dismisses its own already-shown reminders when the schedule is cleared", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    Notifications.getPresentedNotificationsAsync.mockResolvedValueOnce([
      { request: { identifier: "shown-1", content: { data: { ovumcyReminderKind: "cycle_day" } } } },
      { request: { identifier: "foreign-1", content: { data: {} } } },
    ]);

    await expect(scheduler.sync([])).resolves.toBe("scheduled");

    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith("shown-1");
  });

  it("still clears the schedule when the shade cannot be read", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: "daily-1", content: { data: { ovumcyReminderKind: "daily_log" } } },
    ]);
    Notifications.getPresentedNotificationsAsync.mockRejectedValueOnce(
      new Error("unsupported"),
    );

    await expect(scheduler.sync([])).resolves.toBe("scheduled");

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "daily-1",
    );
    expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
  });

  it("clears the shade even when cancelling a schedule fails", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: "daily-1", content: { data: { ovumcyReminderKind: "daily_log" } } },
    ]);
    Notifications.cancelScheduledNotificationAsync.mockRejectedValueOnce(
      new Error("cancel failed"),
    );
    Notifications.getPresentedNotificationsAsync.mockResolvedValueOnce([
      { request: { identifier: "shown-1", content: { data: { ovumcyReminderKind: "cycle_day" } } } },
    ]);

    await expect(scheduler.sync([])).rejects.toThrow("cancel failed");

    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith("shown-1");
  });

  it("keeps dismissing its shown reminders after one refuses to go", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    Notifications.getPresentedNotificationsAsync.mockResolvedValueOnce([
      { request: { identifier: "shown-1", content: { data: { ovumcyReminderKind: "cycle_day" } } } },
      { request: { identifier: "shown-2", content: { data: { ovumcyReminderKind: "daily_log" } } } },
    ]);
    Notifications.dismissNotificationAsync.mockRejectedValueOnce(
      new Error("gone"),
    );

    await expect(scheduler.sync([])).resolves.toBe("scheduled");

    expect(Notifications.dismissNotificationAsync).toHaveBeenNthCalledWith(1, "shown-1");
    expect(Notifications.dismissNotificationAsync).toHaveBeenNthCalledWith(2, "shown-2");
  });

  it("leaves notifications it did not schedule alone", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: "foreign-1", content: { data: {} } },
      // an inherited Object.prototype key must not count as a known kind
      { identifier: "foreign-2", content: { data: { ovumcyReminderKind: "toString" } } },
    ]);

    await expect(scheduler.sync([])).resolves.toBe("scheduled");

    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it("never asks for notification permission when the plan is empty", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: "daily-1", content: { data: { ovumcyReminderKind: "daily_log" } } },
    ]);

    await expect(scheduler.sync([])).resolves.toBe("scheduled");

    // the clear still runs, it just needs no permission
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "daily-1",
    );
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("asks for permission once a reminder will be scheduled", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    Notifications.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      ios: { status: 0 },
    });

    await expect(scheduler.sync([DAILY_PLAN])).resolves.toBe("scheduled");

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it("cancels its own schedules and reports permission_denied when permission is refused", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    Notifications.getPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      ios: { status: 0 },
    });
    Notifications.requestPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      ios: { status: 1 },
    });
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      { identifier: "daily-1", content: { data: { ovumcyReminderKind: "daily_log" } } },
      { identifier: "foreign-1", content: { data: {} } },
    ]);

    await expect(scheduler.sync([DAILY_PLAN])).resolves.toBe(
      "permission_denied",
    );

    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      "daily-1",
    );
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("routes daily and one-time reminders to the ovumcy-reminders channel", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    const scheduler = createPlatformLocalReminderScheduler();
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;
    const at = new Date("2026-03-10T09:00:00.000Z");

    await expect(
      scheduler.sync([
        DAILY_PLAN,
        {
          kind: "upcoming_period" as const,
          title: "Ovumcy reminder",
          body: "Open Ovumcy to check your cycle.",
          trigger: { type: "once" as const, at },
        },
      ]),
    ).resolves.toBe("scheduled");

    const triggers = Notifications.scheduleNotificationAsync.mock.calls.map(
      (call: unknown[]) => (call[0] as { trigger: unknown }).trigger,
    );
    expect(triggers).toEqual([
      { type: "daily", channelId: "ovumcy-reminders", hour: 21, minute: 30 },
      { type: "date", channelId: "ovumcy-reminders", date: at },
    ]);
  });
});

describe("platform-local-reminder-scheduler.native: Android channel", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.unmock("expo-constants");
  });

  it("creates the reminders channel with private lock-screen visibility", async () => {
    const { createPlatformLocalReminderScheduler } = loadSchedulerModule(
      "standalone",
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native") as typeof import("react-native");
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "android", configurable: true });
    const Notifications = jest.requireMock(
      "expo-notifications",
    ) as ExpoNotificationsMock;

    try {
      await expect(
        createPlatformLocalReminderScheduler().sync([DAILY_PLAN]),
      ).resolves.toBe("scheduled");
    } finally {
      Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
    }

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      "ovumcy-reminders",
      expect.objectContaining({ lockscreenVisibility: 2 }),
    );
  });
});
