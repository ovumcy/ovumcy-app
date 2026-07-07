import type { ExportBackupEnvelope } from "../../../models/export";
import type { InterfaceSettingsValues } from "../../../models/profile";
import type { ImportFilePickerClient } from "../../../services/import-file-picker";
import {
  importBackupEnvelope,
  parseImportEnvelope,
  previewImportBackupEnvelope,
  type ImportOutcome,
} from "../../../services/import-service";
import { refreshSettingsStateAfterImport } from "../../../services/settings-screen-service";
import {
  buildSettingsImportResultMessage,
  type LoadedSettingsState,
  type SettingsViewData,
} from "../../../services/settings-view-service";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { resolveSettingsImportErrorMessage } from "./settings-screen-messages";

// The parsed envelope held between the preview and the explicit confirm. It
// stays in memory only — never persisted, never logged.
export type PendingImportPreview = {
  envelope: ExportBackupEnvelope;
  outcome: ImportOutcome;
};

type ImportActionContext = {
  effectiveNow: Date;
  importFilePickerClient: ImportFilePickerClient;
  resetImportMessages: () => void;
  setImportErrorMessage: (value: string) => void;
  setImportStatusMessage: (value: string) => void;
  setIsImporting: (value: boolean) => void;
  setPendingImportPreview: (value: PendingImportPreview | null) => void;
  setState: (value: LoadedSettingsState) => void;
  storage: LocalAppStorage;
  syncProfilePreferences: (profile: InterfaceSettingsValues) => void;
  viewData: SettingsViewData;
};

// Phase one of the import flow: pick a file, parse it, and compute the
// dry-run preview. Nothing is written; the user still has to confirm.
export async function runPickImportFileAction(context: ImportActionContext) {
  const {
    importFilePickerClient,
    resetImportMessages,
    setImportErrorMessage,
    setIsImporting,
    setPendingImportPreview,
    storage,
    viewData,
  } = context;

  resetImportMessages();
  setPendingImportPreview(null);
  setIsImporting(true);

  try {
    const picked = await importFilePickerClient.pick();
    if (picked.status === "cancelled") {
      return;
    }
    if (picked.status === "failed") {
      setImportErrorMessage(
        resolveSettingsImportErrorMessage(picked.errorCode, viewData),
      );
      return;
    }

    const parsed = parseImportEnvelope(picked.content);
    if (!parsed.ok) {
      setImportErrorMessage(
        resolveSettingsImportErrorMessage(parsed.errorCode, viewData),
      );
      return;
    }

    const outcome = await previewImportBackupEnvelope(storage, parsed.envelope);
    setPendingImportPreview({ envelope: parsed.envelope, outcome });
  } catch {
    setImportErrorMessage(
      resolveSettingsImportErrorMessage("import_failed", viewData),
    );
  } finally {
    setIsImporting(false);
  }
}

// Phase two: the user confirmed the previewed restore — apply it additively
// and rebuild the settings state from the (possibly grown) local repos.
export async function runConfirmImportAction(
  context: ImportActionContext,
  readyState: LoadedSettingsState,
  pending: PendingImportPreview,
) {
  const {
    effectiveNow,
    resetImportMessages,
    setImportErrorMessage,
    setImportStatusMessage,
    setIsImporting,
    setPendingImportPreview,
    setState,
    storage,
    syncProfilePreferences,
    viewData,
  } = context;

  resetImportMessages();
  setIsImporting(true);

  try {
    const outcome = await importBackupEnvelope(storage, pending.envelope);
    const nextState = await refreshSettingsStateAfterImport(
      storage,
      readyState,
      effectiveNow,
      outcome.profileRestored,
    );
    setState(nextState);
    if (outcome.profileRestored) {
      // A restored profile may carry language/theme overrides; apply them
      // app-wide the same way the interface-settings save path does.
      syncProfilePreferences(nextState.interfaceValues);
    }
    setPendingImportPreview(null);
    setImportStatusMessage(
      buildSettingsImportResultMessage(outcome, viewData.import),
    );
  } catch {
    setImportErrorMessage(
      resolveSettingsImportErrorMessage("import_failed", viewData),
    );
  } finally {
    setIsImporting(false);
  }
}
