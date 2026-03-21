import type { ExportFormat, ExportRangeValues } from "../models/export";
import type {
  CycleSettingsValues,
  InterfaceSettingsValues,
  ProfileRecord,
  TrackingSettingsValues,
} from "../models/profile";
import type { SymptomID } from "../models/symptom";
import type { SyncSecretStore } from "../security/sync-secret-store";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  type ExportArtifact,
  type ExportServiceDependencies,
  buildLocalExportArtifact,
  loadLocalExportState,
} from "./export-service";
import {
  createLoadedSettingsState,
  type LoadedSettingsState,
} from "./settings-view-service";
import {
  loadSyncSetupState,
  prepareSyncSetup,
  saveSyncPreferencesDraft,
  type PrepareSyncSetupErrorCode,
  type SaveSyncPreferencesDraftErrorCode,
} from "../sync/sync-setup-service";
import {
  connectSyncAccount,
  disconnectSyncAccount,
  loadManagedSyncCapabilities,
  runSyncRestore,
  runSyncUpload,
  type SyncConnectErrorCode,
  type SyncRunErrorCode,
} from "../sync/sync-client-service";
import {
  getSettingsCycleStartDateBounds,
  parseLocalDate,
  sanitizeCycleSettingsValues,
  sanitizeInterfaceSettingsValues,
  sanitizeTrackingSettingsValues,
} from "./profile-settings-policy";
import {
  archiveCustomSymptomRecord,
  createCustomSymptomRecord,
  restoreCustomSymptomRecord,
  updateCustomSymptomRecord,
  type SymptomDraftValues,
  type SymptomValidationErrorCode,
} from "./symptom-policy";
import { resetDismissedCalendarPredictionNotice } from "./calendar-notice-service";

type SaveSettingsErrorCode = "invalid_last_period_start" | "generic";
type SaveSymptomErrorCode = SymptomValidationErrorCode | "generic";
type ExportSettingsErrorCode =
  | "invalid_from_date"
  | "invalid_to_date"
  | "invalid_range"
  | "generic";
type SyncConnectSettingsErrorCode = SyncConnectErrorCode;
type SyncRunSettingsErrorCode = SyncRunErrorCode;

type SaveStateResult<ErrorCode extends string> =
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: ErrorCode;
    };

type RefreshExportStateResult =
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: ExportSettingsErrorCode;
      state: LoadedSettingsState;
    };

export async function loadSettingsScreenState(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  now: Date,
): Promise<LoadedSettingsState> {
  const [profile, syncState, symptomRecords, exportResult] = await Promise.all([
    storage.readProfileRecord(),
    loadSyncSetupState(storage, secretStore),
    storage.listSymptomRecords(),
    loadLocalExportState(storage, now),
  ]);

  let syncCapabilities = null;
  if (
    syncState.hasAuthSession &&
    syncState.preferences.mode === "managed" &&
    syncState.preferences.setupStatus === "connected"
  ) {
    const capabilitiesResult = await loadManagedSyncCapabilities(
      secretStore,
      syncState.preferences,
    );
    if (capabilitiesResult.ok) {
      syncCapabilities = capabilitiesResult.capabilities;
    }
  }

  return createLoadedSettingsState(
    profile,
    syncState.preferences,
    syncState.hasStoredSecrets,
    syncState.hasAuthSession,
    symptomRecords,
    exportResult.state,
    syncState.preferences,
    syncCapabilities,
  );
}

export async function saveCycleSettings(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  cycleValues: CycleSettingsValues,
  now: Date,
): Promise<SaveStateResult<SaveSettingsErrorCode>> {
  if (!isValidCycleStartDate(cycleValues.lastPeriodStart, now)) {
    return {
      ok: false,
      errorCode: "invalid_last_period_start",
    };
  }

  const nextProfile = resetDismissedCalendarPredictionNotice(currentState.profile, {
    ...currentState.profile,
    ...sanitizeCycleSettingsValues(cycleValues),
  });

  try {
    await storage.writeProfileRecord(nextProfile);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      nextProfile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords,
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function saveTrackingSettings(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  trackingValues: TrackingSettingsValues,
): Promise<SaveStateResult<SaveSettingsErrorCode>> {
  const nextProfile: ProfileRecord = {
    ...currentState.profile,
    ...sanitizeTrackingSettingsValues(trackingValues),
  };

  try {
    await storage.writeProfileRecord(nextProfile);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      nextProfile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords,
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function saveInterfaceSettings(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  interfaceValues: InterfaceSettingsValues,
): Promise<SaveStateResult<SaveSettingsErrorCode>> {
  const nextProfile: ProfileRecord = {
    ...currentState.profile,
    ...sanitizeInterfaceSettingsValues(interfaceValues),
  };

  try {
    await storage.writeProfileRecord(nextProfile);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      nextProfile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords,
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function createSettingsSymptom(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  draft: SymptomDraftValues,
): Promise<SaveStateResult<SaveSymptomErrorCode>> {
  const result = createCustomSymptomRecord(currentState.symptomRecords, draft);
  if (!result.ok) {
    return result;
  }

  try {
    await storage.writeSymptomRecord(result.record);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      [...currentState.symptomRecords, result.record],
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function updateSettingsSymptom(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  symptomID: SymptomID,
  draft: SymptomDraftValues,
): Promise<SaveStateResult<SaveSymptomErrorCode>> {
  const result = updateCustomSymptomRecord(
    currentState.symptomRecords,
    symptomID,
    draft,
  );
  if (!result.ok) {
    return result;
  }

  try {
    await storage.writeSymptomRecord(result.record);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords.map((record) =>
        record.id === symptomID ? result.record : record,
      ),
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function archiveSettingsSymptom(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  symptomID: SymptomID,
): Promise<SaveStateResult<SaveSymptomErrorCode>> {
  const result = archiveCustomSymptomRecord(currentState.symptomRecords, symptomID);
  if (!result.ok) {
    return result;
  }

  try {
    await storage.writeSymptomRecord(result.record);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords.map((record) =>
        record.id === symptomID ? result.record : record,
      ),
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function restoreSettingsSymptom(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  symptomID: SymptomID,
): Promise<SaveStateResult<SaveSymptomErrorCode>> {
  const result = restoreCustomSymptomRecord(currentState.symptomRecords, symptomID);
  if (!result.ok) {
    return result;
  }

  try {
    await storage.writeSymptomRecord(result.record);
  } catch {
    return {
      ok: false,
      errorCode: "generic",
    };
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      currentState.savedSyncPreferences,
      currentState.hasStoredSyncSecrets,
      currentState.hasSyncSession,
      currentState.symptomRecords.map((record) =>
        record.id === symptomID ? result.record : record,
      ),
      currentState.exportState,
      currentState.syncPreferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function refreshSettingsExportState(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  exportValues: ExportRangeValues,
  now: Date,
): Promise<RefreshExportStateResult> {
  const result = await loadLocalExportState(storage, now, exportValues);
  const nextState = createLoadedSettingsState(
    currentState.profile,
    currentState.savedSyncPreferences,
    currentState.hasStoredSyncSecrets,
    currentState.hasSyncSession,
    currentState.symptomRecords,
    result.state,
    currentState.syncPreferences,
    currentState.syncCapabilities,
  );
  if (result.errorCode) {
    return {
      ok: false,
      errorCode: result.errorCode,
      state: nextState,
    };
  }

  return {
    ok: true,
    state: nextState,
  };
}

export async function prepareSettingsExportArtifact(
  storage: LocalAppStorage,
  currentState: LoadedSettingsState,
  format: ExportFormat,
  now: Date,
  dependencies: ExportServiceDependencies = {},
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
      artifact: ExportArtifact;
    }
  | {
      ok: false;
      errorCode: ExportSettingsErrorCode;
      state: LoadedSettingsState;
    }
> {
  const result = await buildLocalExportArtifact(
    storage,
    currentState.exportState,
    format,
    now,
    dependencies,
  );
  const nextState = createLoadedSettingsState(
    currentState.profile,
    currentState.savedSyncPreferences,
    currentState.hasStoredSyncSecrets,
    currentState.hasSyncSession,
    currentState.symptomRecords,
    result.state,
    currentState.syncPreferences,
    currentState.syncCapabilities,
  );

  if (!result.ok) {
    return {
      ok: false,
      errorCode: result.errorCode,
      state: nextState,
    };
  }

  return {
    ok: true,
    artifact: result.artifact,
    state: nextState,
  };
}

export async function prepareSettingsSyncSetup(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
      recoveryPhrase: string;
      regenerated: boolean;
    }
  | {
      ok: false;
      errorCode: PrepareSyncSetupErrorCode;
    }
> {
  const regenerated = currentState.hasStoredSyncSecrets;
  const result = await prepareSyncSetup(
    storage,
    secretStore,
    currentState.syncPreferences,
    now,
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      result.preferences,
      true,
      currentState.hasSyncSession,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      null,
    ),
    recoveryPhrase: result.recoveryPhrase,
    regenerated,
  };
}

export async function saveSettingsSyncDraft(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: SaveSyncPreferencesDraftErrorCode;
    }
> {
  const result = await saveSyncPreferencesDraft(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
    currentState.syncPreferences,
    currentState.hasStoredSyncSecrets,
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      result.preferences,
      result.hasStoredSecrets,
      currentState.hasSyncSession && result.hasStoredSecrets,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      null,
    ),
  };
}

export async function connectSettingsSyncAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  credentials: { login: string; password: string },
  mode: "register" | "login",
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
      connected: boolean;
    }
  | {
      ok: false;
      errorCode: SyncConnectSettingsErrorCode;
    }
> {
  const result = await connectSyncAccount(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
    credentials,
    mode,
    now,
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    connected: true,
    state: createLoadedSettingsState(
      currentState.profile,
      result.preferences,
      currentState.hasStoredSyncSecrets,
      true,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      result.preferences.mode === "managed" ? result.capabilities : null,
    ),
  };
}

export async function uploadSettingsSyncSnapshot(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
  now: Date,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: SyncRunSettingsErrorCode;
    }
> {
  const result = await runSyncUpload(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
    now,
  );
  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      result.preferences,
      currentState.hasStoredSyncSecrets,
      true,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function restoreSettingsSyncSnapshot(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
): Promise<
  | {
      ok: true;
      state: LoadedSettingsState;
    }
  | {
      ok: false;
      errorCode: SyncRunSettingsErrorCode;
    }
> {
  const result = await runSyncRestore(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
  );
  if (!result.ok) {
    return result;
  }

  const profile = await storage.readProfileRecord();
  const symptomRecords = await storage.listSymptomRecords();
  const exportResult = await loadLocalExportState(storage, new Date());

  return {
    ok: true,
    state: createLoadedSettingsState(
      profile,
      result.preferences,
      currentState.hasStoredSyncSecrets,
      true,
      symptomRecords,
      exportResult.state,
      result.preferences,
      currentState.syncCapabilities,
    ),
  };
}

export async function disconnectSettingsSyncAccount(
  storage: LocalAppStorage,
  secretStore: SyncSecretStore,
  currentState: LoadedSettingsState,
): Promise<{
  ok: true;
  state: LoadedSettingsState;
}> {
  const result = await disconnectSyncAccount(
    storage,
    secretStore,
    currentState.savedSyncPreferences,
  );

  return {
    ok: true,
    state: createLoadedSettingsState(
      currentState.profile,
      result.preferences,
      currentState.hasStoredSyncSecrets,
      false,
      currentState.symptomRecords,
      currentState.exportState,
      result.preferences,
      null,
    ),
  };
}

function isValidCycleStartDate(
  lastPeriodStart: CycleSettingsValues["lastPeriodStart"],
  now: Date,
): boolean {
  if (lastPeriodStart === null) {
    return true;
  }

  const parsed = parseLocalDate(lastPeriodStart);
  if (!parsed) {
    return false;
  }

  const bounds = getSettingsCycleStartDateBounds(now);
  return lastPeriodStart >= bounds.minDate && lastPeriodStart <= bounds.maxDate;
}
