import { createEmptyDayLogRecord } from "../../../models/day-log";
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

describe("offline JSON restore gates", () => {
  it("writes nothing while previewing a picked file and hands the envelope to the confirm step", async () => {
    const { context, storage } = createContext();

    await runPickImportFileAction(context);

    expect(storage.writeDayLogRecord).not.toHaveBeenCalled();
    expect(storage.writeSymptomRecord).not.toHaveBeenCalled();
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
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
});
