import type { SymptomID } from "../../../models/symptom";
import { loadSettingsScreenState } from "../../../services/settings-state-service";
import {
  buildSettingsViewData,
  type LoadedSettingsState,
} from "../../../services/settings-view-service";
import { createSettingsStorageMock } from "../../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../../test/create-sync-secret-store-mock";
import {
  runArchiveSymptomAction,
  runCreateSymptomAction,
  runRestoreSymptomAction,
  runUpdateSymptomAction,
} from "./settings-screen-symptom-actions";

const now = new Date(2026, 2, 17);
const viewData = buildSettingsViewData(now, "en");

async function loadReadyState(): Promise<LoadedSettingsState> {
  const storage = createSettingsStorageMock();
  const syncSecretStore = createSyncSecretStoreMock();
  return loadSettingsScreenState(storage, syncSecretStore, now);
}

function createContext(storage = createSettingsStorageMock()) {
  return {
    createSymptomDraft: { label: "", icon: "✨" },
    resetSymptomMessages: jest.fn(),
    setCreateSymptomDraft: jest.fn(),
    setCreateSymptomErrorMessage: jest.fn(),
    setCreateSymptomStatusMessage: jest.fn(),
    setRowSymptomDrafts: jest.fn(),
    setRowSymptomErrorMessages: jest.fn(),
    setRowSymptomStatusMessages: jest.fn(),
    setState: jest.fn(),
    storage,
    viewData,
  };
}

// The RNTL suite (SettingsScreen.test.tsx) only exercises the create-symptom
// happy path; a validation failure (e.g. the still-blank default draft) is
// covered directly here.
describe("settings-screen-symptom-actions: create failure", () => {
  it("runCreateSymptomAction reports the mapped error and never resets the draft", async () => {
    const readyState = await loadReadyState();
    const context = createContext();

    await runCreateSymptomAction(context, readyState);

    expect(context.setCreateSymptomErrorMessage).toHaveBeenCalledWith(
      viewData.symptoms.errors.labelRequired,
    );
    expect(context.setCreateSymptomDraft).not.toHaveBeenCalled();
    expect(context.setCreateSymptomStatusMessage).not.toHaveBeenCalled();
    expect(context.setState).not.toHaveBeenCalled();
    expect(context.storage.writeSymptomRecord).not.toHaveBeenCalled();
  });
});

// The row-level actions each short-circuit on a symptom ID that is no longer
// present in the loaded state (e.g. a stale row from a previous render) —
// this guard runs before the underlying service call, so it never touches
// storage or clears the row's editing draft.
describe("settings-screen-symptom-actions: not-found guard", () => {
  it("runUpdateSymptomAction reports not-found without writing or touching drafts", async () => {
    const readyState = await loadReadyState();
    const context = createContext();

    await runUpdateSymptomAction(
      context,
      readyState,
      {},
      "missing-id" as SymptomID,
    );

    expect(context.resetSymptomMessages).toHaveBeenCalledTimes(1);
    expect(context.setRowSymptomErrorMessages).toHaveBeenCalledWith({
      "missing-id": viewData.symptoms.errors.notFound,
    });
    expect(context.setState).not.toHaveBeenCalled();
    expect(context.setRowSymptomDrafts).not.toHaveBeenCalled();
    expect(context.storage.writeSymptomRecord).not.toHaveBeenCalled();
  });

  it("runArchiveSymptomAction reports not-found without writing", async () => {
    const readyState = await loadReadyState();
    const context = createContext();

    await runArchiveSymptomAction(context, readyState, "missing-id" as SymptomID);

    expect(context.setRowSymptomErrorMessages).toHaveBeenCalledWith({
      "missing-id": viewData.symptoms.errors.notFound,
    });
    expect(context.setState).not.toHaveBeenCalled();
    expect(context.storage.writeSymptomRecord).not.toHaveBeenCalled();
  });

  it("runRestoreSymptomAction reports not-found without writing", async () => {
    const readyState = await loadReadyState();
    const context = createContext();

    await runRestoreSymptomAction(context, readyState, "missing-id" as SymptomID);

    expect(context.setRowSymptomErrorMessages).toHaveBeenCalledWith({
      "missing-id": viewData.symptoms.errors.notFound,
    });
    expect(context.setState).not.toHaveBeenCalled();
    expect(context.storage.writeSymptomRecord).not.toHaveBeenCalled();
  });
});

// Built-in symptoms never appear as editable/archivable rows in the first
// place — settings-view-service's splitCustomSymptoms filters out every
// record.isDefault entry before the Settings UI ever renders an update,
// archive, or restore control for it (see the parallel RNTL assertion in
// SettingsScreen.test.tsx). The action layer's builtin_edit_forbidden guard
// is therefore defense-in-depth with no reachable UI path — cover it
// directly here instead of trying to contrive it through the screen.
describe("settings-screen-symptom-actions: defensive builtin-forbidden guard", () => {
  it("runUpdateSymptomAction refuses to edit a built-in record", async () => {
    const readyState = await loadReadyState();
    const context = createContext();
    const builtinID = readyState.symptomRecords[0]!.id;
    expect(readyState.symptomRecords[0]!.isDefault).toBe(true);

    await runUpdateSymptomAction(context, readyState, {}, builtinID);

    expect(context.setRowSymptomErrorMessages).toHaveBeenCalledWith({
      [builtinID]: viewData.symptoms.errors.notFound,
    });
    expect(context.setState).not.toHaveBeenCalled();
    expect(context.storage.writeSymptomRecord).not.toHaveBeenCalled();
  });

  it("runArchiveSymptomAction refuses to archive a built-in record", async () => {
    const readyState = await loadReadyState();
    const context = createContext();
    const builtinID = readyState.symptomRecords[0]!.id;

    await runArchiveSymptomAction(context, readyState, builtinID);

    expect(context.setRowSymptomErrorMessages).toHaveBeenCalledWith({
      [builtinID]: viewData.symptoms.errors.notFound,
    });
    expect(context.setState).not.toHaveBeenCalled();
    expect(context.storage.writeSymptomRecord).not.toHaveBeenCalled();
  });

  it("runRestoreSymptomAction refuses to restore an archived built-in record", async () => {
    const readyState = await loadReadyState();
    const archivedBuiltin: LoadedSettingsState["symptomRecords"][number] = {
      id: "cramps" as SymptomID,
      slug: "cramps",
      label: "Cramps",
      icon: "🩸",
      color: "#FF4444",
      isArchived: true,
      sortOrder: 0,
      isDefault: true,
    };
    const stateWithArchivedBuiltin: LoadedSettingsState = {
      ...readyState,
      symptomRecords: [archivedBuiltin],
    };
    const context = createContext();

    await runRestoreSymptomAction(
      context,
      stateWithArchivedBuiltin,
      "cramps" as SymptomID,
    );

    expect(context.setRowSymptomErrorMessages).toHaveBeenCalledWith({
      cramps: viewData.symptoms.errors.notFound,
    });
    expect(context.setState).not.toHaveBeenCalled();
    expect(context.storage.writeSymptomRecord).not.toHaveBeenCalled();
  });
});
