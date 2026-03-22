import type { SymptomID } from "../../../models/symptom";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import {
  archiveSettingsSymptom,
  createSettingsSymptom,
  restoreSettingsSymptom,
  updateSettingsSymptom,
} from "../../../services/settings-screen-service";
import type {
  LoadedSettingsState,
  SettingsViewData,
} from "../../../services/settings-view-service";
import {
  createDefaultSymptomDraft,
  type SymptomDraftValues,
} from "../../../services/symptom-policy";
import { removeRowSymptomDraft } from "./settings-screen-updaters";
import { resolveSettingsSymptomErrorMessage } from "./settings-screen-messages";

type SymptomActionContext = {
  createSymptomDraft: SymptomDraftValues;
  resetSymptomMessages: () => void;
  setCreateSymptomDraft: (value: SymptomDraftValues) => void;
  setCreateSymptomErrorMessage: (value: string) => void;
  setCreateSymptomStatusMessage: (value: string) => void;
  setRowSymptomDrafts: (
    updater: (current: Record<string, SymptomDraftValues>) => Record<string, SymptomDraftValues>,
  ) => void;
  setRowSymptomErrorMessages: (value: Record<string, string>) => void;
  setRowSymptomStatusMessages: (value: Record<string, string>) => void;
  setState: (value: LoadedSettingsState) => void;
  storage: LocalAppStorage;
  viewData: SettingsViewData;
};

export async function runCreateSymptomAction(
  context: SymptomActionContext,
  readyState: LoadedSettingsState,
) {
  const {
    createSymptomDraft,
    resetSymptomMessages,
    setCreateSymptomDraft,
    setCreateSymptomErrorMessage,
    setCreateSymptomStatusMessage,
    setState,
    storage,
    viewData,
  } = context;

  resetSymptomMessages();

  const result = await createSettingsSymptom(storage, readyState, createSymptomDraft);
  if (!result.ok) {
    setCreateSymptomErrorMessage(
      resolveSettingsSymptomErrorMessage(result.errorCode, viewData),
    );
    return;
  }

  setState(result.state);
  setCreateSymptomDraft(createDefaultSymptomDraft());
  setCreateSymptomStatusMessage(viewData.symptoms.status.created);
}

export async function runUpdateSymptomAction(
  context: SymptomActionContext,
  readyState: LoadedSettingsState,
  rowSymptomDrafts: Record<string, SymptomDraftValues>,
  symptomID: SymptomID,
) {
  const {
    resetSymptomMessages,
    setRowSymptomDrafts,
    setRowSymptomErrorMessages,
    setRowSymptomStatusMessages,
    setState,
    storage,
    viewData,
  } = context;

  resetSymptomMessages();
  const currentRecord = readyState.symptomRecords.find((record) => record.id === symptomID);
  if (!currentRecord) {
    setRowSymptomErrorMessages({
      [symptomID]: viewData.symptoms.errors.notFound,
    });
    return;
  }

  const payload: SymptomDraftValues = rowSymptomDrafts[symptomID] ?? {
    label: currentRecord.label,
    icon: currentRecord.icon,
  };

  const result = await updateSettingsSymptom(storage, readyState, symptomID, payload);
  if (!result.ok) {
    setRowSymptomErrorMessages({
      [symptomID]: resolveSettingsSymptomErrorMessage(result.errorCode, viewData),
    });
    return;
  }

  setState(result.state);
  setRowSymptomDrafts((current) => removeRowSymptomDraft(current, symptomID));
  setRowSymptomStatusMessages({
    [symptomID]: viewData.symptoms.status.updated,
  });
}

export async function runArchiveSymptomAction(
  context: SymptomActionContext,
  readyState: LoadedSettingsState,
  symptomID: SymptomID,
) {
  const {
    resetSymptomMessages,
    setRowSymptomErrorMessages,
    setRowSymptomStatusMessages,
    setState,
    storage,
    viewData,
  } = context;

  resetSymptomMessages();
  const result = await archiveSettingsSymptom(storage, readyState, symptomID);
  if (!result.ok) {
    setRowSymptomErrorMessages({
      [symptomID]: resolveSettingsSymptomErrorMessage(result.errorCode, viewData),
    });
    return;
  }

  setState(result.state);
  setRowSymptomStatusMessages({
    [symptomID]: viewData.symptoms.status.archived,
  });
}

export async function runRestoreSymptomAction(
  context: SymptomActionContext,
  readyState: LoadedSettingsState,
  symptomID: SymptomID,
) {
  const {
    resetSymptomMessages,
    setRowSymptomErrorMessages,
    setRowSymptomStatusMessages,
    setState,
    storage,
    viewData,
  } = context;

  resetSymptomMessages();
  const result = await restoreSettingsSymptom(storage, readyState, symptomID);
  if (!result.ok) {
    setRowSymptomErrorMessages({
      [symptomID]: resolveSettingsSymptomErrorMessage(result.errorCode, viewData),
    });
    return;
  }

  setState(result.state);
  setRowSymptomStatusMessages({
    [symptomID]: viewData.symptoms.status.restored,
  });
}
