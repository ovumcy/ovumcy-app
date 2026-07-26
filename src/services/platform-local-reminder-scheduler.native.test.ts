type ExpoNotificationsMock = {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getAllScheduledNotificationsAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
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
});
