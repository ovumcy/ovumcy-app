import type { ExportBackupEnvelope } from "../../../models/export";
import type { InterfaceSettingsValues } from "../../../models/profile";
import type { ImportFilePickerClient } from "../../../services/import-file-picker";
import {
  importBackupEnvelope,
  parseImportEnvelope,
  previewImportBackupEnvelope,
  type ImportOutcome,
} from "../../../services/import-service";
import type { LocalReminderScheduler } from "../../../services/local-reminder-scheduler-contract";
import { rebuildLocalReminderScheduleFromStorage } from "../../../services/local-reminder-sync-service";
import { refreshSettingsStateAfterImport } from "../../../services/settings-screen-service";
import {
  buildSettingsImportResultMessage,
  type LoadedSettingsState,
  type SettingsViewData,
} from "../../../services/settings-view-service";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { resolveSettingsImportErrorMessage } from "./settings-screen-messages";

// The parsed envelope held between the preview and the explicit confirm. It
// stays in memory only — never persisted, never logged. restoreReminders is
// the preview's opt-in, off until the user turns it on.
export type PendingImportPreview = {
  envelope: ExportBackupEnvelope;
  outcome: ImportOutcome;
  restoreReminders: boolean;
};

export function withRestoreReminders(
  pending: PendingImportPreview | null,
  restoreReminders: boolean,
): PendingImportPreview | null {
  return pending ? { ...pending, restoreReminders } : null;
}

type ImportActionContext = {
  effectiveNow: Date;
  importFilePickerClient: ImportFilePickerClient;
  resetImportMessages: () => void;
  setImportErrorMessage: (value: string) => void;
  setImportStatusMessage: (value: string) => void;
  setIsImporting: (value: boolean) => void;
  setPendingImportPreview: (value: PendingImportPreview | null) => void;
  setState: (value: LoadedSettingsState) => void;
  // Injected instant for the reminder rebuild; undefined reads the clock.
  reminderNow?: Date | undefined;
  reminderScheduler: LocalReminderScheduler;
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
    setPendingImportPreview({
      envelope: parsed.envelope,
      outcome,
      restoreReminders: false,
    });
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
    reminderNow,
    reminderScheduler,
    storage,
    syncProfilePreferences,
    viewData,
  } = context;

  resetImportMessages();
  setIsImporting(true);
  let applying = false;

  try {
    // The confirmed counts must be the ones the user saw: if the device
    // changed since the preview, the preview is refreshed and confirmed again
    // instead of applying a different restore.
    const current = await previewImportBackupEnvelope(storage, pending.envelope);
    if (!areImportOutcomesEqual(current, pending.outcome)) {
      setPendingImportPreview({ ...pending, outcome: current });
      setImportStatusMessage(viewData.import.previewChanged);
      return;
    }

    applying = true;
    const outcome = await importBackupEnvelope(storage, pending.envelope, {
      restoreReminders: pending.restoreReminders,
    });
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
    // An import can add day logs, a pregnancy record and a profile with its
    // own reminder settings — and a failed one may have written part of them
    // — so the schedule is rebuilt from storage either way.
    if (applying) {
      await rebuildLocalReminderScheduleFromStorage(storage, reminderScheduler, {
        now: reminderNow,
      });
    }
    setIsImporting(false);
  }
}

function areImportOutcomesEqual(left: ImportOutcome, right: ImportOutcome): boolean {
  const keys = Object.keys(left) as (keyof ImportOutcome)[];
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.is(left[key], right[key]))
  );
}
