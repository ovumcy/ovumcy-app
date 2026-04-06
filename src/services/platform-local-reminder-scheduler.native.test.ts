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
});
