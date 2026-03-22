import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import type { ExportDeliveryClient } from "../../../services/export-delivery";
import type { ExportServiceDependencies } from "../../../services/export-service";
import {
  prepareSettingsExportArtifact,
  refreshSettingsExportState,
} from "../../../services/settings-screen-service";
import type {
  LoadedSettingsState,
  SettingsViewData,
} from "../../../services/settings-view-service";
import { resolveSettingsExportErrorMessage } from "./settings-screen-messages";

type ExportActionContext = {
  effectiveNow: Date;
  exportDeliveryClient: ExportDeliveryClient;
  exportServiceDependencies?: ExportServiceDependencies | undefined;
  resetExportMessages: () => void;
  setExportErrorMessage: (value: string) => void;
  setExportStatusMessage: (value: string) => void;
  setIsExporting: (value: boolean) => void;
  setState: (value: LoadedSettingsState) => void;
  storage: LocalAppStorage;
  viewData: SettingsViewData;
};

export async function runRefreshExportRangeAction(
  context: ExportActionContext,
  readyState: LoadedSettingsState,
  nextValues: LoadedSettingsState["exportState"]["values"],
) {
  const {
    effectiveNow,
    resetExportMessages,
    setExportErrorMessage,
    setState,
    storage,
    viewData,
  } = context;

  resetExportMessages();
  const result = await refreshSettingsExportState(
    storage,
    readyState,
    nextValues,
    effectiveNow,
  );
  setState(result.state);
  if (!result.ok) {
    setExportErrorMessage(
      resolveSettingsExportErrorMessage(result.errorCode, viewData),
    );
  }
}

export async function runExportAction(
  context: ExportActionContext,
  readyState: LoadedSettingsState,
  format: "csv" | "json" | "pdf",
) {
  const {
    effectiveNow,
    exportDeliveryClient,
    exportServiceDependencies,
    resetExportMessages,
    setExportErrorMessage,
    setExportStatusMessage,
    setIsExporting,
    setState,
    storage,
    viewData,
  } = context;

  resetExportMessages();
  setIsExporting(true);

  const result = await prepareSettingsExportArtifact(
    storage,
    readyState,
    format,
    effectiveNow,
    exportServiceDependencies,
  );
  setState(result.state);
  if (!result.ok) {
    setExportErrorMessage(
      resolveSettingsExportErrorMessage(result.errorCode, viewData),
    );
    setIsExporting(false);
    return;
  }

  const deliveryResult = await exportDeliveryClient.deliver(result.artifact);
  if (!deliveryResult.ok) {
    setExportErrorMessage(
      resolveSettingsExportErrorMessage(deliveryResult.errorCode, viewData),
    );
    setIsExporting(false);
    return;
  }

  setExportStatusMessage(
    format === "json"
      ? viewData.export.status.jsonReady
      : format === "pdf"
        ? viewData.export.status.pdfReady
        : viewData.export.status.csvReady,
  );
  setIsExporting(false);
}
