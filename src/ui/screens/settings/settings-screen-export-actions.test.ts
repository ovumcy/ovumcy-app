import * as settingsScreenService from "../../../services/settings-screen-service";
import { loadSettingsScreenState } from "../../../services/settings-state-service";
import {
  buildSettingsViewData,
  type LoadedSettingsState,
} from "../../../services/settings-view-service";
import { createSettingsStorageMock } from "../../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../../test/create-sync-secret-store-mock";
import {
  runExportAction,
  runRefreshExportRangeAction,
} from "./settings-screen-export-actions";

const now = new Date(2026, 2, 17);
const viewData = buildSettingsViewData(now, "en");

async function loadReadyState(): Promise<LoadedSettingsState> {
  const storage = createSettingsStorageMock();
  const syncSecretStore = createSyncSecretStoreMock();
  return loadSettingsScreenState(storage, syncSecretStore, now);
}

function createContext(deliverResult: { ok: true } | { ok: false; errorCode: string } = { ok: true }) {
  return {
    effectiveNow: now,
    exportDeliveryClient: {
      deliver: jest.fn().mockResolvedValue(deliverResult),
    },
    exportServiceDependencies: undefined,
    resetExportMessages: jest.fn(),
    setExportErrorMessage: jest.fn(),
    setExportStatusMessage: jest.fn(),
    setIsExporting: jest.fn(),
    setState: jest.fn(),
    storage: createSettingsStorageMock(),
    viewData,
  } satisfies Parameters<typeof runExportAction>[0];
}

describe("runRefreshExportRangeAction", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["invalid_from_date", () => viewData.export.errors.invalidFromDate],
    ["invalid_to_date", () => viewData.export.errors.invalidToDate],
    ["invalid_range", () => viewData.export.errors.invalidRange],
  ] as const)(
    "maps a %s refresh failure to the export error banner but still commits the returned state",
    async (errorCode, expected) => {
      const readyState = await loadReadyState();
      const context = createContext();
      const failedState = { ...readyState };
      jest
        .spyOn(settingsScreenService, "refreshSettingsExportState")
        .mockResolvedValue({ ok: false, errorCode, state: failedState });

      await runRefreshExportRangeAction(context, readyState, readyState.exportState.values);

      expect(context.resetExportMessages).toHaveBeenCalledTimes(1);
      // The range picker still commits the returned (unsuccessful) state so
      // the UI reflects whatever partial range the user typed.
      expect(context.setState).toHaveBeenCalledWith(failedState);
      expect(context.setExportErrorMessage).toHaveBeenCalledWith(expected());
    },
  );

  it("commits the refreshed state without an error message on success", async () => {
    const readyState = await loadReadyState();
    const context = createContext();
    const refreshedState = { ...readyState };
    jest
      .spyOn(settingsScreenService, "refreshSettingsExportState")
      .mockResolvedValue({ ok: true, state: refreshedState });

    await runRefreshExportRangeAction(context, readyState, readyState.exportState.values);

    expect(context.setState).toHaveBeenCalledWith(refreshedState);
    expect(context.setExportErrorMessage).not.toHaveBeenCalled();
  });
});

describe("runExportAction: preparation failures", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["pdf_locked", () => viewData.export.errors.pdfLocked],
    ["generic", () => viewData.export.errors.exportFailed],
  ] as const)(
    "maps a %s preparation failure and never calls the delivery client",
    async (errorCode, expected) => {
      const readyState = await loadReadyState();
      const context = createContext();
      jest
        .spyOn(settingsScreenService, "prepareSettingsExportArtifact")
        .mockResolvedValue({ ok: false, errorCode, state: readyState });

      await runExportAction(context, readyState, "pdf");

      expect(context.setExportErrorMessage).toHaveBeenCalledWith(expected());
      expect(context.exportDeliveryClient.deliver).not.toHaveBeenCalled();
      expect(context.setIsExporting).toHaveBeenLastCalledWith(false);
    },
  );
});

describe("runExportAction: delivery failures", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["delivery_unavailable", () => viewData.export.errors.deliveryUnavailable],
    ["delivery_failed", () => viewData.export.errors.deliveryFailed],
  ] as const)(
    "maps a %s delivery failure after a successful preparation",
    async (errorCode, expected) => {
      const readyState = await loadReadyState();
      const context = createContext({ ok: false, errorCode });
      const preparedArtifact = {
        filename: "ovumcy-export-2026-03-17.json",
        mimeType: "application/json",
        content: "{}",
      };
      jest.spyOn(settingsScreenService, "prepareSettingsExportArtifact").mockResolvedValue({
        ok: true,
        state: readyState,
        artifact: preparedArtifact,
      });

      await runExportAction(context, readyState, "json");

      expect(context.exportDeliveryClient.deliver).toHaveBeenCalledWith(preparedArtifact);
      expect(context.setExportErrorMessage).toHaveBeenCalledWith(expected());
      expect(context.setExportStatusMessage).not.toHaveBeenCalled();
      expect(context.setIsExporting).toHaveBeenLastCalledWith(false);
    },
  );
});
