import { createEmptyDayLogRecord } from "../../../models/day-log";
import { createDefaultProfileRecord } from "../../../models/profile";
import { loadSettingsScreenState } from "../../../services/settings-state-service";
import {
  buildSettingsViewData,
  type LoadedSettingsState,
} from "../../../services/settings-view-service";
import { createSettingsStorageMock } from "../../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../../test/create-sync-secret-store-mock";
import {
  runConfirmImportAction,
  runPickImportFileAction,
  withRestoreReminders,
  type PendingImportPreview,
} from "./settings-screen-import-actions";

const now = new Date(2026, 2, 17);
const viewData = buildSettingsViewData(now, "en");

const backupJSON = JSON.stringify({
  app: "ovumcy",
  formatVersion: 1,
  exportedAt: "2026-03-18T10:00:00.000Z",
  preset: "all",
  range: { fromDate: null, toDate: null },
  summary: { totalEntries: 1, hasData: true, dateFrom: "2026-02-01", dateTo: "2026-02-01" },
  symptoms: [],
  dayLogs: [{ ...createEmptyDayLogRecord("2026-02-01"), isPeriod: true, flow: "medium" }],
});

function createContext() {
  const storage = createSettingsStorageMock();
  const context = {
    effectiveNow: now,
    reminderNow: now,
    reminderScheduler: { sync: jest.fn().mockResolvedValue("scheduled") },
    importFilePickerClient: {
      pick: jest.fn().mockResolvedValue({ status: "picked", content: backupJSON }),
    },
    resetImportMessages: jest.fn(),
    setImportErrorMessage: jest.fn(),
    setImportStatusMessage: jest.fn(),
    setIsImporting: jest.fn(),
    setPendingImportPreview: jest.fn(),
    setState: jest.fn(),
    storage,
    syncProfilePreferences: jest.fn(),
    viewData,
  };
  return { context, storage };
}

async function loadReadyState(): Promise<LoadedSettingsState> {
  return loadSettingsScreenState(
    createSettingsStorageMock(),
    createSyncSecretStoreMock(),
    now,
  );
}

function calledMutators(storage: object): string[] {
  return Object.entries(storage)
    .filter(
      ([name, fn]) =>
        /^(write|delete|clear)/.test(name) &&
        jest.isMockFunction(fn) &&
        fn.mock.calls.length > 0,
    )
    .map(([name]) => name);
}

describe("offline JSON restore gates", () => {
  it("writes nothing while previewing a picked file and hands the envelope to the confirm step", async () => {
    const { context, storage } = createContext();

    await runPickImportFileAction(context);

    expect(calledMutators(storage)).toEqual([]);
    expect(context.setImportErrorMessage).not.toHaveBeenCalled();
    const pending = context.setPendingImportPreview.mock.calls.at(-1)?.[0] as
      | PendingImportPreview
      | null;
    expect(pending?.outcome.dayLogsAdded).toBe(1);
  });

  it("writes only when the confirm step runs on the previewed envelope", async () => {
    const { context, storage } = createContext();
    await runPickImportFileAction(context);
    const pending = context.setPendingImportPreview.mock.calls.at(-1)?.[0] as PendingImportPreview;
    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();

    await runConfirmImportAction(context, await loadReadyState(), pending);

    expect(storage.writeDayLogRecord).toHaveBeenCalledTimes(1);
    expect(context.setPendingImportPreview).toHaveBeenLastCalledWith(null);
  });

  it("refreshes the preview instead of applying when the device changed after it", async () => {
    const { context, storage } = createContext();
    await runPickImportFileAction(context);
    const pending = context.setPendingImportPreview.mock.calls.at(-1)?.[0] as PendingImportPreview;
    jest.mocked(storage.readDayLogRecord).mockResolvedValue({
      ...createEmptyDayLogRecord("2026-02-01"),
      isPeriod: true,
      flow: "light",
    });

    await runConfirmImportAction(context, await loadReadyState(), pending);

    expect(calledMutators(storage)).toEqual([]);
    expect(context.reminderScheduler.sync).not.toHaveBeenCalled();
    const refreshed = context.setPendingImportPreview.mock.calls.at(-1)?.[0] as PendingImportPreview;
    expect(refreshed.outcome).toMatchObject({ dayLogsAdded: 0, dayLogsSkipped: 1 });
    expect(refreshed.envelope).toBe(pending.envelope);
    expect(context.setImportStatusMessage).toHaveBeenLastCalledWith(
      viewData.import.previewChanged,
    );
  });

  it("starts every preview with the reminder opt-in off and applies the opt-in the user chose", async () => {
    const { context, storage } = createContext();
    jest.mocked(storage.readProfileRecord).mockResolvedValue(createDefaultProfileRecord());
    jest.mocked(storage.readDayLogSummary).mockResolvedValue({
      totalEntries: 0,
      hasData: false,
      dateFrom: null,
      dateTo: null,
    });
    const backupWithReminders = JSON.stringify({
      ...JSON.parse(backupJSON),
      dayLogs: [],
      profile: {
        ...createDefaultProfileRecord(),
        cycleLength: 31,
        dailyLogReminderEnabled: true,
      },
    });
    context.importFilePickerClient.pick.mockResolvedValue({
      status: "picked",
      content: backupWithReminders,
    });
    await runPickImportFileAction(context);
    const pending = context.setPendingImportPreview.mock.calls.at(-1)?.[0] as PendingImportPreview;
    expect(pending.restoreReminders).toBe(false);
    expect(pending.outcome.reminderSettingsAvailable).toBe(true);

    await runConfirmImportAction(context, await loadReadyState(), {
      ...pending,
      restoreReminders: true,
    });

    expect(storage.writeProfileRecord).toHaveBeenCalledWith(
      expect.objectContaining({ cycleLength: 31, dailyLogReminderEnabled: true }),
    );
  });
});

describe("reminder rebuild after a JSON import", () => {
  async function pickPending(context: ReturnType<typeof createContext>["context"]) {
    await runPickImportFileAction(context);
    return context.setPendingImportPreview.mock.calls.at(-1)?.[0] as PendingImportPreview;
  }

  it("rebuilds the schedule from storage after the confirmed import, not during the preview", async () => {
    const { context, storage } = createContext();
    const pending = await pickPending(context);
    expect(context.reminderScheduler.sync).not.toHaveBeenCalled();

    jest.mocked(storage.readProfileRecord).mockResolvedValue({
      ...(await storage.readProfileRecord()),
      dailyLogReminderEnabled: true,
      reminderTime: "20:15",
    });
    await runConfirmImportAction(context, await loadReadyState(), pending);

    expect(context.reminderScheduler.sync).toHaveBeenCalledTimes(1);
    expect(context.reminderScheduler.sync).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: "daily_log",
        trigger: { type: "daily", hour: 20, minute: 15 },
      }),
    ]);
  });

  it("still rebuilds when the import fails part-way", async () => {
    const { context, storage } = createContext();
    const pending = await pickPending(context);
    jest.mocked(storage.writeDayLogRecord).mockRejectedValueOnce(new Error("disk full"));

    await runConfirmImportAction(context, await loadReadyState(), pending);

    expect(context.setImportErrorMessage).toHaveBeenCalled();
    expect(context.reminderScheduler.sync).toHaveBeenCalledTimes(1);
  });
});

describe("withRestoreReminders", () => {
  it("sets the opt-in on the pending preview and keeps the previewed envelope", () => {
    const pending = {
      envelope: {},
      outcome: {},
      restoreReminders: false,
    } as unknown as PendingImportPreview;

    expect(withRestoreReminders(pending, true)).toEqual({
      ...pending,
      restoreReminders: true,
    });
  });

  it("stays empty when no preview is pending", () => {
    expect(withRestoreReminders(null, true)).toBeNull();
  });
});
