import {
  createEmptyPartnerShareSecretsRecord,
  type PartnerShareSecretStore,
} from "../security/partner-share-secret-store";
import { getPartnerCopy } from "../i18n/partner-copy";
import { getShellCopy } from "../i18n/shell-copy";
import { createDefaultProfileRecord } from "../models/profile";
import { createDefaultSymptomRecords } from "../models/symptom";
import type { LoadedExportState } from "../models/export";
import {
  buildSettingsViewData,
  createLoadedSettingsState,
  type LoadedSettingsState,
} from "../services/settings-view-service";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import { createAppPreferencesContextValue } from "../ui/providers/AppPreferencesProvider";
import type { BackupSyncSessionCore } from "../ui/screens/backup-sync/useBackupSyncSessionCore";
import { createLocalAppStorageMock } from "./create-local-app-storage-mock";
import { createSyncSecretStoreMock } from "./create-sync-secret-store-mock";

const DEFAULT_EXPORT_STATE: LoadedExportState = {
  values: { preset: "all", fromDate: "2026-03-01", toDate: "2026-03-20" },
  availableSummary: {
    totalEntries: 0,
    hasData: false,
    dateFrom: null,
    dateTo: null,
  },
  summary: { totalEntries: 0, hasData: false, dateFrom: null, dateTo: null },
  bounds: { minDate: "2026-03-01", maxDate: "2026-03-20" },
};

/**
 * A loaded settings state fixture with sensible defaults (managed mode,
 * signed-in-with-secrets), so callers only need to override the handful of
 * fields their test actually cares about.
 */
export function createLoadedSettingsStateFixture(
  overrides: Partial<LoadedSettingsState> = {},
): LoadedSettingsState {
  const savedSyncPreferences = createDefaultSyncPreferencesRecord();
  const base = createLoadedSettingsState(
    createDefaultProfileRecord(),
    savedSyncPreferences,
    true,
    true,
    createDefaultSymptomRecords(),
    DEFAULT_EXPORT_STATE,
  );
  return { ...base, ...overrides };
}

function createPartnerShareSecretStoreStub(): PartnerShareSecretStore {
  return {
    clearPartnerShareSecrets: jest.fn().mockResolvedValue(undefined),
    readPartnerShareSecrets: jest
      .fn()
      .mockResolvedValue(createEmptyPartnerShareSecretsRecord()),
    writePartnerShareSecrets: jest.fn().mockResolvedValue(undefined),
    mutatePartnerShareSecrets: jest.fn(),
  };
}

/**
 * Builds a fake `BackupSyncSessionCore` (the shared state/orchestration
 * object every backup-sync concern hook receives) for isolated `renderHook`
 * tests of a single concern hook — without mounting the full screen through
 * expo-router/react-navigation. Every setter is a `jest.fn()` so tests can
 * assert exactly which state transitions a handler dispatches; `state`
 * defaults to a realistic managed, signed-in `LoadedSettingsState` fixture
 * since most handlers early-return on `null`.
 *
 * The concern hooks only read/write through this object and never re-read
 * `core.state` after calling `core.setState` inside the same handler (they
 * thread the fresh value through local variables instead) — so a static
 * object, rather than one backed by real `useState`, is sufficient.
 */
export function createBackupSyncSessionCoreMock(
  overrides: Partial<BackupSyncSessionCore> = {},
): BackupSyncSessionCore {
  const effectiveNow = new Date("2026-03-20T08:00:00.000Z");
  const language = "en" as const;
  const preferences = createAppPreferencesContextValue({});
  const state = createLoadedSettingsStateFixture();

  const core: BackupSyncSessionCore = {
    // Resolved dependencies
    exportDeliveryClient: { deliver: jest.fn() },
    partnerShareSecretStore: createPartnerShareSecretStoreStub(),
    storage: createLocalAppStorageMock(),
    syncSecretStore: createSyncSecretStoreMock(),
    // Preferences + copy + derived view data
    colors: preferences.colors,
    language,
    syncProfilePreferences: jest.fn(),
    shellCopy: getShellCopy(language),
    partnerCopy: getPartnerCopy(language),
    viewData: buildSettingsViewData(effectiveNow, language),
    // Navigation
    navigation: { dispatch: jest.fn() } as unknown as BackupSyncSessionCore["navigation"],
    router: {
      back: jest.fn(),
      push: jest.fn(),
      replace: jest.fn(),
    } as unknown as BackupSyncSessionCore["router"],
    // Root state
    effectiveNow,
    isLoading: false,
    state,
    setState: jest.fn(),
    isSyncDirty: false,
    // Feedback
    errorState: null,
    setErrorState: jest.fn(),
    accountStatusMessage: "",
    setAccountStatusMessage: jest.fn(),
    resetFeedbackMessages: jest.fn(),
    revertUnsavedSync: jest.fn(),
    // Recovery-phrase state
    generatedRecoveryPhrase: "",
    setGeneratedRecoveryPhrase: jest.fn(),
    generatedRecoveryCode: "",
    setGeneratedRecoveryCode: jest.fn(),
    recoveryPhraseInputValue: "",
    setRecoveryPhraseInputValue: jest.fn(),
    // Partner buffer + partner-access snapshot
    pendingPartnerInviteToken: "",
    setPendingPartnerInviteToken: jest.fn(),
    partnerOverview: null,
    setPartnerOverview: jest.fn(),
    partnerStatusMessage: "",
    setPartnerStatusMessage: jest.fn(),
    partnerErrorMessage: "",
    setPartnerErrorMessage: jest.fn(),
    showPartnerOwnerControls: false,
    setShowPartnerOwnerControls: jest.fn(),
    resetPartnerFeedback: jest.fn(),
    loadPartnerState: jest.fn().mockResolvedValue({
      errorMessage: "",
      overview: null,
      showOwnerControls: false,
    }),
    reloadPartnerAccess: jest.fn().mockResolvedValue(undefined),
    // Offers
    dismissedOfferIDs: [],
    setDismissedOfferIDs: jest.fn(),
    // Sync-draft
    isSavingSyncDraft: false,
    saveSyncDraftIfNeeded: jest.fn().mockResolvedValue(state),
  };

  return { ...core, ...overrides };
}
