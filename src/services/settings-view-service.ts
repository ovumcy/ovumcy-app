import { APP_LANGUAGE_LABELS } from "../i18n/runtime";
import { getSettingsCopy } from "../i18n/settings-copy";
import type {
  ManagedCloudActiveSubscription,
  ManagedCloudBillingManagement,
  ManagedCloudBillingOffer,
  ManagedCloudBillingSnapshot,
} from "../sync/managed-cloud-api-client";
import type { ExportBackupEnvelope, LoadedExportState } from "../models/export";
import type {
  AgeGroupOption,
  CycleSettingsValues,
  InterfaceLanguage,
  InterfaceSettingsValues,
  PredictionMode,
  ProfileRecord,
  ReminderSettingsValues,
  TemperatureUnit,
  ThemePreference,
  TrackingSettingsValues,
  UsageGoal,
  WeekStartDay,
} from "../models/profile";
import {
  DEFAULT_REMINDER_LEAD_DAYS,
  DEFAULT_REMINDER_TIME,
  normalizeWeekStartDay,
  resolvePredictionMode,
  resolveScreenCaptureProtectionEnabled,
} from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import { SYMPTOM_ICON_CATALOG } from "../models/symptom";
import type {
  SyncCapabilityDocument,
  SyncMode,
  SyncPreferencesRecord,
} from "../sync/sync-contract";
import {
  buildCycleGuidanceState,
  clampReminderLeadDays,
  formatLocalDate,
  getSettingsCycleStartDateBounds,
  normalizeAgeGroup,
  parseLocalDate,
} from "./profile-settings-policy";
import { resolvePDFExportAccessState } from "./pdf-export-access-policy";
import { splitCustomSymptoms } from "./symptom-policy";
import type { ImportOutcome } from "./import-service";

type SettingsCopy = ReturnType<typeof getSettingsCopy>;

export type SettingsViewData = {
  title: string;
  description: string;
  common: SettingsCopy["common"];
  cycle: {
    title: string;
    dateBounds: ReturnType<typeof getSettingsCycleStartDateBounds>;
    cycleLengthLabel: string;
    periodLengthLabel: string;
    lastPeriodStartLabel: string;
    lastPeriodStartHint: string;
    autoPeriodFillLabel: string;
    autoPeriodFillHint: string;
    predictionModeLabel: string;
    predictionModeHint: string;
    predictionModeOptions: {
      value: PredictionMode;
      label: string;
      secondaryLabel: string;
    }[];
    messages: {
      errorIncompatible: string;
      warningApproximate: string;
      infoAdjusted: string;
      infoPeriodLong: string;
      infoCycleLong: string;
      infoCycleShort: string;
    };
  };
  ageGroup: {
    label: string;
    hint: string;
    options: { value: AgeGroupOption; label: string }[];
  };
  usageGoal: {
    label: string;
    hint: string;
    options: { value: UsageGoal; label: string }[];
  };
  tracking: {
    title: string;
    subtitle: string;
    trackBBT: {
      label: string;
      hint: string;
      stateOn: string;
      stateOff: string;
    };
    trackCervicalMucus: {
      label: string;
      hint: string;
      stateOn: string;
      stateOff: string;
    };
    hideSexChip: {
      label: string;
      hint: string;
      stateOn: string;
      stateOff: string;
    };
    hideNotes: {
      label: string;
      hint: string;
      stateOn: string;
      stateOff: string;
    };
    showHistoricalPhases: {
      label: string;
      hint: string;
      stateOn: string;
      stateOff: string;
    };
    hideCycleFactors: {
      label: string;
      hint: string;
      stateOn: string;
      stateOff: string;
    };
    temperatureUnit: {
      label: string;
      hint: string;
      options: { value: TemperatureUnit; label: string }[];
    };
  };
  reminders: {
    title: string;
    subtitle: string;
    localOnlyHint: string;
    lockedHint: string;
    emailHint: string;
    timeLabel: string;
    timeHint: string;
    leadDaysLabel: string;
    leadDaysHint: string;
    emailDelivery: {
      label: string;
      hint: string;
      stateOn: string;
      stateOff: string;
    };
    dailyLog: {
      label: string;
      hint: string;
      stateOn: string;
      stateOff: string;
    };
    upcomingPeriod: {
      label: string;
      hint: string;
      stateOn: string;
      stateOff: string;
    };
    fertileWindow: {
      label: string;
      hint: string;
      stateOn: string;
      stateOff: string;
    };
    status: {
      saved: string;
      savedWithEmail: string;
      emailUnavailable: string;
      emailSyncFailed: string;
      permissionDenied: string;
      unavailable: string;
    };
    errors: {
      invalidTime: string;
      saveFailed: string;
    };
  };
  interface: {
    title: string;
    subtitle: string;
    languageLabel: string;
    languageHint: string;
    languageOptions: { value: InterfaceLanguage; label: string }[];
    previewHint: string;
    themeLabel: string;
    themeHint: string;
    themeOptions: { value: ThemePreference; label: string }[];
    firstDayOfWeekLabel: string;
    firstDayOfWeekHint: string;
    firstDayOfWeekOptions: { value: WeekStartDay; label: string }[];
    screenCaptureProtectionLabel: string;
    screenCaptureProtectionHint: string;
    screenCaptureProtectionStateOn: string;
    screenCaptureProtectionStateOff: string;
    discardChangesLabel: string;
    saveBeforeLeaveLabel: string;
    keepEditingLabel: string;
    status: {
      saved: string;
      languageSaved: string;
      themeSaved: string;
    };
    unsavedPrompt: string;
  };
  account: {
    title: string;
    subtitle: string;
    hubSubtitle: string;
    openHubLabel: string;
    backToSettingsLabel: string;
    localStepTitle: string;
    localStepHint: string;
    preparingTitle: string;
    preparingHint: string;
    accountStepTitle: string;
    accountStepHintManaged: string;
    accountStepHintSelfHosted: string;
    planStepTitle: string;
    planStepHint: string;
    planSignInFirst: string;
    planUnknown: string;
    planInactive: string;
    planCheckFailed: string;
    planUnavailable: string;
    planActive: string;
    checkPlanAgain: string;
    advancedSectionLabel: string;
    syncStepTitle: string;
    syncStepHintManaged: string;
    syncStepHintSelfHosted: string;
    syncBlockedNoPlan: string;
    modeLabel: string;
    modeOptions: { value: SyncMode; label: string }[];
    managedHint: string;
    selfHostedHint: string;
    endpointLabel: string;
    endpointHint: string;
    endpointPlaceholder: string;
    deviceLabel: string;
    deviceHint: string;
    devicePlaceholder: string;
    stateLabel: string;
    stateReady: string;
    stateMissing: string;
    connectionLabel: string;
    connectionReady: string;
    connectionMissing: string;
    lastSyncLabel: string;
    lastSyncNever: string;
    modeRowLabel: string;
    endpointRowLabel: string;
    encryptionRowLabel: string;
    encryptionReady: string;
    encryptionMissing: string;
    loginLabel: string;
    loginPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    recoveryImportTitle: string;
    recoveryImportHint: string;
    recoveryPhraseInputLabel: string;
    recoveryPhraseInputPlaceholder: string;
    recoveryPhraseInputHint: string;
    recoverAccessLabel: string;
    registerLabel: string;
    loginActionLabel: string;
    syncNowLabel: string;
    restoreLabel: string;
    disconnectLabel: string;
    restorePrompt: string;
    restoreAccept: string;
    restoreDeviceAuthPrompt: string;
    uploadOverBackupPrompt: string;
    uploadOverBackupAccept: string;
    renewalCancelLabel: string;
    renewalResumeLabel: string;
    renewalCancelPrompt: string;
    renewalCancelAccept: string;
    withdrawalTitle: string;
    withdrawalBody: string;
    offerDismissLabel: string;
    offerPromoEyebrow: string;
    offerAnnouncementEyebrow: string;
    disconnectPrompt: string;
    disconnectDeviceAuthPrompt: string;
    deleteAccountLabel: string;
    deleteAccountPrompt: string;
    deleteAccountAccept: string;
    deleteAccountDeviceAuthPrompt: string;
    deleteAccountSubscriptionWarningTitle: string;
    deleteAccountSubscriptionWarningMessage: string;
    deleteAccountSubscriptionWarningAccept: string;
    recoveryTitle: string;
    recoveryHint: string;
    recoveryNotice: string;
    recoveryShownOnce: string;
    recoveryExportLabel: string;
    recoveryCodeTitle: string;
    recoveryCodeHint: string;
    prepareLabel: string;
    regenerateLabel: string;
    regeneratePrompt: string;
    regenerateAccept: string;
    regenerateDeviceAuthPrompt: string;
    discardChangesLabel: string;
    saveBeforeLeaveLabel: string;
    keepEditingLabel: string;
    unsavedPrompt: string;
    status: {
      prepared: string;
      regenerated: string;
      connected: string;
      connectedNoPlan: string;
      recovered: string;
      uploaded: string;
      restored: string;
      disconnected: string;
      deleted: string;
      renewalCancelled: string;
      renewalResumed: string;
    };
    errors: {
      loginRequired: string;
      passwordRequired: string;
      passwordTooShort: string;
      deviceLabelRequired: string;
      endpointRequired: string;
      invalidEndpoint: string;
      unsupportedScheme: string;
      insecurePublicHttp: string;
      invalidRegistrationInput: string;
      registrationFailed: string;
      invalidCredentials: string;
      recoveryPhraseRequired: string;
      invalidRecoveryPhrase: string;
      recoveryNotAvailable: string;
      recoveryPackageNotFound: string;
      tooManyDevices: string;
      syncNotPrepared: string;
      notConnected: string;
      blobNotFound: string;
      invalidPayload: string;
      networkFailed: string;
      recoveryExportUnavailable: string;
      recoveryExportFailed: string;
      deviceAuthUnavailable: string;
      deviceAuthFailed: string;
      saveFailed: string;
      syncFailed: string;
      restoreFailed: string;
      deleteAccountFailed: string;
      deleteAccountCleanupUnavailable: string;
      renewalUnavailable: string;
      renewalUpdateFailed: string;
    };
  };
  symptoms: {
    title: string;
    subtitle: string;
    activeHeading: string;
    activeHint: string;
    activeItem: string;
    archivedHeading: string;
    archivedHint: string;
    archivedItem: string;
    archivedBadge: string;
    empty: string;
    emptyActive: string;
    nameLabel: string;
    namePlaceholder: string;
    nameHint: string;
    iconLabel: string;
    addLabel: string;
    saveLabel: string;
    hideLabel: string;
    restoreLabel: string;
    iconOptions: { value: string; label: string }[];
    status: {
      created: string;
      updated: string;
      archived: string;
      restored: string;
    };
    errors: SettingsCopy["symptoms"]["errors"];
  };
  export: {
    title: string;
    subtitle: string;
    storageHint: string;
    sensitiveHint: string;
    pdfCloudOnlyHint: string;
    pdfPlanHint: string;
    noData: string;
    presetLabel: string;
    presetOptions: {
      value: "all" | "30" | "90" | "365";
      label: string;
    }[];
    fromLabel: string;
    toLabel: string;
    datePlaceholder: string;
    summaryTotalTemplate: string;
    summaryRangeTemplate: string;
    summaryRangeEmpty: string;
    csvAction: string;
    jsonAction: string;
    pdfAction: string;
      status: {
        csvReady: string;
        jsonReady: string;
        pdfReady: string;
      };
    errors: SettingsCopy["export"]["errors"];
  };
  import: SettingsCopy["import"];
  danger: {
    title: string;
    subtitle: string;
    clearTitle: string;
    clearSubtitle: string;
    confirmationLabel: string;
    confirmationPlaceholder: string;
    confirmationHint: string;
    deviceAuthPrompt: string;
    action: string;
    status: {
      success: string;
      invalidConfirmation: string;
      deviceAuthUnavailable: string;
      deviceAuthFailed: string;
      failed: string;
    };
  };
  privacy: SettingsCopy["privacy"];
  status: SettingsCopy["status"];
  premiumLock: SettingsCopy["premiumLock"];
};

export type SettingsManagedPremiumAccess = {
  planStatus: "unknown" | "inactive" | "active";
  doctorPDF: boolean;
  reminders: boolean;
  // activeSubscription drives the plan/trial countdown on Backup & Sync. Null
  // when there is no managed subscription row (self-hosted, signed out, or a
  // plan-less managed account).
  activeSubscription: ManagedCloudActiveSubscription | null;
  // billingManagement mirrors the live snapshot's renewal affordances; all
  // false when signed out, self-hosted, or on cached (offline-grace) billing
  // truth, which hides the manage-renewal row entirely.
  billingManagement: ManagedCloudBillingManagement;
  // offers carries billing-surface promos/announcements from the LIVE
  // snapshot only ([] on cached truth); backup-sync is the single render
  // surface in v1.
  offers: ManagedCloudBillingOffer[];
};

export function createEmptySettingsManagedPremiumAccess(): SettingsManagedPremiumAccess {
  return {
    planStatus: "unknown",
    doctorPDF: false,
    reminders: false,
    activeSubscription: null,
    billingManagement: {
      canManageRenewal: false,
      canCancelAtPeriodEnd: false,
      canResumeRenewal: false,
    },
    offers: [],
  };
}

export function mapBillingSnapshotToManagedPremiumAccess(
  billingSnapshot: ManagedCloudBillingSnapshot,
): SettingsManagedPremiumAccess {
  return {
    planStatus: billingSnapshot.hasActivePlan ? "active" : "inactive",
    doctorPDF: billingSnapshot.premiumFeatures.doctorPDF,
    reminders: billingSnapshot.premiumFeatures.reminders,
    activeSubscription: billingSnapshot.activeSubscription,
    billingManagement: billingSnapshot.billingManagement,
    offers: billingSnapshot.offers,
  };
}

export type LoadedSettingsState = {
  profile: ProfileRecord;
  cycleValues: CycleSettingsValues;
  interfaceValues: InterfaceSettingsValues;
  hasSyncSession: boolean;
  managedPremiumAccess: SettingsManagedPremiumAccess;
  syncCapabilities: SyncCapabilityDocument | null;
  savedSyncPreferences: SyncPreferencesRecord;
  syncPreferences: SyncPreferencesRecord;
  hasStoredSyncSecrets: boolean;
  reminderValues: ReminderSettingsValues;
  trackingValues: TrackingSettingsValues;
  symptomRecords: SymptomRecord[];
  exportState: LoadedExportState;
};

export type SettingsSyncSummaryViewData = {
  title: string;
  description: string;
  destinationLabel: string;
  destinationValue: string;
  lastSyncLabel: string;
  lastSyncValue: string;
  actionLabel: string;
  statusMessage: string;
  statusTone: "success" | "info";
};

// One key per settings section that moved to its own route. "data" hosts the
// export + import pair — the issue-level "import-export" grouping. Sync and
// privacy are not keys here: their hub cards already navigate to dedicated
// screens (/backup-sync, /privacy).
export type SettingsHubSectionKey =
  | "cycle"
  | "symptoms"
  | "tracking"
  | "reminders"
  | "interface"
  | "data"
  | "danger";

export type SettingsHubNavigationRow = {
  key: SettingsHubSectionKey;
  title: string;
  description: string;
};

export type SettingsSymptomsState = {
  active: SymptomRecord[];
  archived: SymptomRecord[];
};

export type SettingsDirtyState = {
  isCycleDirty: boolean;
  isReminderDirty: boolean;
  isTrackingDirty: boolean;
  isInterfaceDirty: boolean;
  hasUnsavedSettingsChanges: boolean;
};

export type SettingsExportSectionPresentationState = {
  hasAnyData: boolean;
  summaryRangeLabel: string;
  summaryTotalLabel: string;
  supportsNativeDatePicker: boolean;
  canExportPDF: boolean;
  pdfHint: string;
};

export type SettingsFlowPresentationState = {
  cyclePickerMaximumDate: Date | undefined;
  cyclePickerMinimumDate: Date | undefined;
  cyclePickerValue: Date;
  displayedCycleStartDate: string;
  exportPickerMaximumDate: Date | undefined;
  exportPickerMinimumDate: Date | undefined;
  exportPickerValue: Date;
  exportSection: SettingsExportSectionPresentationState;
  predictionMode: PredictionMode;
  symptomsState: SettingsSymptomsState;
};

export function buildSettingsViewData(
  now: Date,
  locale = "en",
): SettingsViewData {
  const settingsCopy = getSettingsCopy(locale);

  return {
    title: settingsCopy.title,
    description: settingsCopy.subtitle,
    common: settingsCopy.common,
    cycle: {
      title: settingsCopy.cycle.title,
      dateBounds: getSettingsCycleStartDateBounds(now),
      cycleLengthLabel: settingsCopy.cycle.cycleLength,
      periodLengthLabel: settingsCopy.cycle.periodLength,
      lastPeriodStartLabel: settingsCopy.cycle.lastPeriodStart,
      lastPeriodStartHint: settingsCopy.cycle.lastPeriodStartHint,
      autoPeriodFillLabel: settingsCopy.cycle.autoPeriodFill,
      autoPeriodFillHint: settingsCopy.cycle.autoPeriodFillHint,
      predictionModeLabel: settingsCopy.cycle.predictionModeLabel,
      predictionModeHint: settingsCopy.cycle.predictionModeHint,
      predictionModeOptions: [
        {
          value: "regular",
          label: settingsCopy.cycle.predictionModeRegular,
          secondaryLabel: settingsCopy.cycle.predictionModeRegularHint,
        },
        {
          value: "irregular",
          label: settingsCopy.cycle.predictionModeIrregular,
          secondaryLabel: settingsCopy.cycle.predictionModeIrregularHint,
        },
        {
          value: "facts_only",
          label: settingsCopy.cycle.predictionModeFactsOnly,
          secondaryLabel: settingsCopy.cycle.predictionModeFactsOnlyHint,
        },
      ],
      messages: {
        errorIncompatible: settingsCopy.cycle.errorIncompatible,
        warningApproximate: settingsCopy.cycle.warningApproximate,
        infoAdjusted: settingsCopy.cycle.infoAdjusted,
        infoPeriodLong: settingsCopy.cycle.infoPeriodLong,
        infoCycleLong: settingsCopy.cycle.infoCycleLong,
        infoCycleShort: settingsCopy.cycle.infoCycleShort,
      },
    },
    ageGroup: {
      label: settingsCopy.ageGroup.title,
      hint: settingsCopy.ageGroup.hint,
      options: [
        { value: "", label: settingsCopy.ageGroup.unspecified },
        { value: "under_40", label: settingsCopy.ageGroup.under40 },
        { value: "age_40_45", label: settingsCopy.ageGroup.age40to45 },
        { value: "age_45_plus", label: settingsCopy.ageGroup.age45plus },
      ],
    },
    usageGoal: {
      label: settingsCopy.goal.title,
      hint: settingsCopy.goal.hint,
      options: [
        { value: "avoid_pregnancy", label: settingsCopy.goal.avoid },
        { value: "trying_to_conceive", label: settingsCopy.goal.trying },
        { value: "health", label: settingsCopy.goal.health },
      ],
    },
    tracking: {
      title: settingsCopy.tracking.title,
      subtitle: settingsCopy.tracking.subtitle,
      trackBBT: {
        label: settingsCopy.tracking.trackBBT,
        hint: settingsCopy.tracking.trackBBTHint,
        stateOn: settingsCopy.tracking.trackBBTStateOn,
        stateOff: settingsCopy.tracking.trackBBTStateOff,
      },
      trackCervicalMucus: {
        label: settingsCopy.tracking.trackCervicalMucus,
        hint: settingsCopy.tracking.trackCervicalMucusHint,
        stateOn: settingsCopy.tracking.trackCervicalMucusStateOn,
        stateOff: settingsCopy.tracking.trackCervicalMucusStateOff,
      },
      hideSexChip: {
        label: settingsCopy.tracking.hideSexChip,
        hint: settingsCopy.tracking.hideSexChipHint,
        stateOn: settingsCopy.tracking.hideSexChipStateOn,
        stateOff: settingsCopy.tracking.hideSexChipStateOff,
      },
      hideNotes: {
        label: settingsCopy.tracking.hideNotes,
        hint: settingsCopy.tracking.hideNotesHint,
        stateOn: settingsCopy.tracking.hideNotesStateOn,
        stateOff: settingsCopy.tracking.hideNotesStateOff,
      },
      showHistoricalPhases: {
        label: settingsCopy.tracking.showHistoricalPhases,
        hint: settingsCopy.tracking.showHistoricalPhasesHint,
        stateOn: settingsCopy.tracking.showHistoricalPhasesStateOn,
        stateOff: settingsCopy.tracking.showHistoricalPhasesStateOff,
      },
      hideCycleFactors: {
        label: settingsCopy.tracking.hideCycleFactors,
        hint: settingsCopy.tracking.hideCycleFactorsHint,
        stateOn: settingsCopy.tracking.hideCycleFactorsStateOn,
        stateOff: settingsCopy.tracking.hideCycleFactorsStateOff,
      },
      temperatureUnit: {
        label: settingsCopy.tracking.temperatureUnit,
        hint: settingsCopy.tracking.temperatureUnitHint,
        options: [
          { value: "c", label: `°C · ${settingsCopy.tracking.temperatureUnitCelsius}` },
          { value: "f", label: `°F · ${settingsCopy.tracking.temperatureUnitFahrenheit}` },
        ],
      },
    },
    reminders: {
      title: settingsCopy.reminders.title,
      subtitle: settingsCopy.reminders.subtitle,
      localOnlyHint: settingsCopy.reminders.localOnlyHint,
      lockedHint: settingsCopy.reminders.lockedHint,
      emailHint: settingsCopy.reminders.emailHint,
      timeLabel: settingsCopy.reminders.timeLabel,
      timeHint: settingsCopy.reminders.timeHint,
      leadDaysLabel: settingsCopy.reminders.leadDaysLabel,
      leadDaysHint: settingsCopy.reminders.leadDaysHint,
      emailDelivery: {
        label: settingsCopy.reminders.emailDelivery,
        hint: settingsCopy.reminders.emailDeliveryHint,
        stateOn: settingsCopy.reminders.statusOn,
        stateOff: settingsCopy.reminders.statusOff,
      },
      dailyLog: {
        label: settingsCopy.reminders.dailyLog,
        hint: settingsCopy.reminders.dailyLogHint,
        stateOn: settingsCopy.reminders.statusOn,
        stateOff: settingsCopy.reminders.statusOff,
      },
      upcomingPeriod: {
        label: settingsCopy.reminders.upcomingPeriod,
        hint: settingsCopy.reminders.upcomingPeriodHint,
        stateOn: settingsCopy.reminders.statusOn,
        stateOff: settingsCopy.reminders.statusOff,
      },
      fertileWindow: {
        label: settingsCopy.reminders.fertileWindow,
        hint: settingsCopy.reminders.fertileWindowHint,
        stateOn: settingsCopy.reminders.statusOn,
        stateOff: settingsCopy.reminders.statusOff,
      },
      status: {
        saved: settingsCopy.reminders.saved,
        savedWithEmail: settingsCopy.reminders.savedWithEmail,
        emailUnavailable: settingsCopy.reminders.emailUnavailable,
        emailSyncFailed: settingsCopy.reminders.emailSyncFailed,
        permissionDenied: settingsCopy.reminders.permissionDenied,
        unavailable: settingsCopy.reminders.unavailable,
      },
      errors: {
        invalidTime: settingsCopy.reminders.errors.invalidTime,
        saveFailed: settingsCopy.reminders.errors.saveFailed,
      },
    },
    interface: {
      title: settingsCopy.interface.title,
      subtitle: settingsCopy.interface.subtitle,
      languageLabel: settingsCopy.interface.languageLabel,
      languageHint: settingsCopy.interface.languageHint,
      languageOptions: [
        { value: "en", label: APP_LANGUAGE_LABELS.en },
        { value: "ru", label: APP_LANGUAGE_LABELS.ru },
        { value: "es", label: APP_LANGUAGE_LABELS.es },
        { value: "de", label: APP_LANGUAGE_LABELS.de },
        { value: "fr", label: APP_LANGUAGE_LABELS.fr },
        { value: "it", label: APP_LANGUAGE_LABELS.it },
      ],
      previewHint: settingsCopy.interface.previewHint,
      themeLabel: settingsCopy.interface.themeLabel,
      themeHint: settingsCopy.interface.themeHint,
      themeOptions: [
        { value: "light", label: settingsCopy.interface.themeLight },
        { value: "dark", label: settingsCopy.interface.themeDark },
        { value: "system", label: settingsCopy.interface.themeSystem },
      ],
      firstDayOfWeekLabel: settingsCopy.interface.firstDayOfWeekLabel,
      firstDayOfWeekHint: settingsCopy.interface.firstDayOfWeekHint,
      firstDayOfWeekOptions: [
        { value: 0, label: settingsCopy.interface.firstDayOfWeekSunday },
        { value: 1, label: settingsCopy.interface.firstDayOfWeekMonday },
      ],
      screenCaptureProtectionLabel:
        settingsCopy.interface.screenCaptureProtectionLabel,
      screenCaptureProtectionHint:
        settingsCopy.interface.screenCaptureProtectionHint,
      screenCaptureProtectionStateOn:
        settingsCopy.interface.screenCaptureProtectionStateOn,
      screenCaptureProtectionStateOff:
        settingsCopy.interface.screenCaptureProtectionStateOff,
      discardChangesLabel: settingsCopy.interface.discardChanges,
      saveBeforeLeaveLabel: settingsCopy.interface.saveBeforeLeave,
      keepEditingLabel: settingsCopy.interface.keepEditing,
      status: {
        saved: settingsCopy.interface.saved,
        languageSaved: settingsCopy.interface.languageSaved,
        themeSaved: settingsCopy.interface.themeSaved,
      },
      unsavedPrompt: settingsCopy.interface.unsavedPrompt,
    },
    account: {
      title: settingsCopy.account.title,
      subtitle: settingsCopy.account.subtitle,
      hubSubtitle: settingsCopy.account.hubSubtitle,
      openHubLabel: settingsCopy.account.openHubLabel,
      backToSettingsLabel: settingsCopy.account.backToSettingsLabel,
      localStepTitle: settingsCopy.account.localStepTitle,
      localStepHint: settingsCopy.account.localStepHint,
      preparingTitle: settingsCopy.account.preparingTitle,
      preparingHint: settingsCopy.account.preparingHint,
      accountStepTitle: settingsCopy.account.accountStepTitle,
      accountStepHintManaged: settingsCopy.account.accountStepHintManaged,
      accountStepHintSelfHosted: settingsCopy.account.accountStepHintSelfHosted,
      planStepTitle: settingsCopy.account.planStepTitle,
      planStepHint: settingsCopy.account.planStepHint,
      planSignInFirst: settingsCopy.account.planSignInFirst,
      planUnknown: settingsCopy.account.planUnknown,
      planInactive: settingsCopy.account.planInactive,
      planCheckFailed: settingsCopy.account.planCheckFailed,
      planUnavailable: settingsCopy.account.planUnavailable,
      planActive: settingsCopy.account.planActive,
      checkPlanAgain: settingsCopy.account.checkPlanAgain,
      advancedSectionLabel: settingsCopy.account.advancedSectionLabel,
      syncStepTitle: settingsCopy.account.syncStepTitle,
      syncStepHintManaged: settingsCopy.account.syncStepHintManaged,
      syncStepHintSelfHosted: settingsCopy.account.syncStepHintSelfHosted,
      syncBlockedNoPlan: settingsCopy.account.syncBlockedNoPlan,
      modeLabel: settingsCopy.account.modeLabel,
      modeOptions: [
        { value: "managed", label: settingsCopy.account.modeManaged },
        { value: "self_hosted", label: settingsCopy.account.modeSelfHosted },
      ],
      managedHint: settingsCopy.account.managedHint,
      selfHostedHint: settingsCopy.account.selfHostedHint,
      endpointLabel: settingsCopy.account.endpointLabel,
      endpointHint: settingsCopy.account.endpointHint,
      endpointPlaceholder: settingsCopy.account.endpointPlaceholder,
      deviceLabel: settingsCopy.account.deviceLabel,
      deviceHint: settingsCopy.account.deviceHint,
      devicePlaceholder: settingsCopy.account.devicePlaceholder,
      stateLabel: settingsCopy.account.stateLabel,
      stateReady: settingsCopy.account.stateReady,
      stateMissing: settingsCopy.account.stateMissing,
      connectionLabel: settingsCopy.account.connectionLabel,
      connectionReady: settingsCopy.account.connectionReady,
      connectionMissing: settingsCopy.account.connectionMissing,
      lastSyncLabel: settingsCopy.account.lastSyncLabel,
      lastSyncNever: settingsCopy.account.lastSyncNever,
      modeRowLabel: settingsCopy.account.modeRowLabel,
      endpointRowLabel: settingsCopy.account.endpointRowLabel,
      encryptionRowLabel: settingsCopy.account.encryptionRowLabel,
      encryptionReady: settingsCopy.account.encryptionReady,
      encryptionMissing: settingsCopy.account.encryptionMissing,
      loginLabel: settingsCopy.account.loginLabel,
      loginPlaceholder: settingsCopy.account.loginPlaceholder,
      passwordLabel: settingsCopy.account.passwordLabel,
      passwordPlaceholder: settingsCopy.account.passwordPlaceholder,
      recoveryImportTitle: settingsCopy.account.recoveryImportTitle,
      recoveryImportHint: settingsCopy.account.recoveryImportHint,
      recoveryPhraseInputLabel: settingsCopy.account.recoveryPhraseInputLabel,
      recoveryPhraseInputPlaceholder:
        settingsCopy.account.recoveryPhraseInputPlaceholder,
      recoveryPhraseInputHint: settingsCopy.account.recoveryPhraseInputHint,
      recoverAccessLabel: settingsCopy.account.recoverAccessLabel,
      registerLabel: settingsCopy.account.registerLabel,
      loginActionLabel: settingsCopy.account.loginActionLabel,
      syncNowLabel: settingsCopy.account.syncNowLabel,
      restoreLabel: settingsCopy.account.restoreLabel,
      disconnectLabel: settingsCopy.account.disconnectLabel,
      restorePrompt: settingsCopy.account.restorePrompt,
      restoreAccept: settingsCopy.account.restoreAccept,
      restoreDeviceAuthPrompt: settingsCopy.account.restoreDeviceAuthPrompt,
      uploadOverBackupPrompt: settingsCopy.account.uploadOverBackupPrompt,
      uploadOverBackupAccept: settingsCopy.account.uploadOverBackupAccept,
      renewalCancelLabel: settingsCopy.account.renewalCancelLabel,
      renewalResumeLabel: settingsCopy.account.renewalResumeLabel,
      renewalCancelPrompt: settingsCopy.account.renewalCancelPrompt,
      renewalCancelAccept: settingsCopy.account.renewalCancelAccept,
      withdrawalTitle: settingsCopy.account.withdrawalTitle,
      withdrawalBody: settingsCopy.account.withdrawalBody,
      offerDismissLabel: settingsCopy.account.offerDismissLabel,
      offerPromoEyebrow: settingsCopy.account.offerPromoEyebrow,
      offerAnnouncementEyebrow: settingsCopy.account.offerAnnouncementEyebrow,
      disconnectPrompt: settingsCopy.account.disconnectPrompt,
      disconnectDeviceAuthPrompt: settingsCopy.account.disconnectDeviceAuthPrompt,
      deleteAccountLabel: settingsCopy.account.deleteAccountLabel,
      deleteAccountPrompt: settingsCopy.account.deleteAccountPrompt,
      deleteAccountAccept: settingsCopy.account.deleteAccountAccept,
      deleteAccountDeviceAuthPrompt:
        settingsCopy.account.deleteAccountDeviceAuthPrompt,
      deleteAccountSubscriptionWarningTitle:
        settingsCopy.account.deleteAccountSubscriptionWarningTitle,
      deleteAccountSubscriptionWarningMessage:
        settingsCopy.account.deleteAccountSubscriptionWarningMessage,
      deleteAccountSubscriptionWarningAccept:
        settingsCopy.account.deleteAccountSubscriptionWarningAccept,
      recoveryTitle: settingsCopy.account.recoveryTitle,
      recoveryHint: settingsCopy.account.recoveryHint,
      recoveryNotice: settingsCopy.account.recoveryNotice,
      recoveryShownOnce: settingsCopy.account.recoveryShownOnce,
      recoveryExportLabel: settingsCopy.account.recoveryExportLabel,
      recoveryCodeTitle: settingsCopy.account.recoveryCodeTitle,
      recoveryCodeHint: settingsCopy.account.recoveryCodeHint,
      prepareLabel: settingsCopy.account.prepareLabel,
      regenerateLabel: settingsCopy.account.regenerateLabel,
      regeneratePrompt: settingsCopy.account.regeneratePrompt,
      regenerateAccept: settingsCopy.account.regenerateAccept,
      regenerateDeviceAuthPrompt: settingsCopy.account.regenerateDeviceAuthPrompt,
      discardChangesLabel: settingsCopy.account.discardChangesLabel,
      saveBeforeLeaveLabel: settingsCopy.account.saveBeforeLeaveLabel,
      keepEditingLabel: settingsCopy.account.keepEditingLabel,
      unsavedPrompt: settingsCopy.account.unsavedPrompt,
      status: {
        prepared: settingsCopy.account.prepared,
        regenerated: settingsCopy.account.regenerated,
        connected: settingsCopy.account.connected,
        connectedNoPlan: settingsCopy.account.connectedNoPlan,
        recovered: settingsCopy.account.recovered,
        uploaded: settingsCopy.account.uploaded,
        restored: settingsCopy.account.restored,
        disconnected: settingsCopy.account.disconnected,
        deleted: settingsCopy.account.deleted,
        renewalCancelled: settingsCopy.account.renewalCancelled,
        renewalResumed: settingsCopy.account.renewalResumed,
      },
      errors: {
        loginRequired: settingsCopy.account.errors.loginRequired,
        passwordRequired: settingsCopy.account.errors.passwordRequired,
        passwordTooShort: settingsCopy.account.errors.passwordTooShort,
        deviceLabelRequired: settingsCopy.account.errors.deviceLabelRequired,
        endpointRequired: settingsCopy.account.errors.endpointRequired,
        invalidEndpoint: settingsCopy.account.errors.invalidEndpoint,
        unsupportedScheme: settingsCopy.account.errors.unsupportedScheme,
        insecurePublicHttp: settingsCopy.account.errors.insecurePublicHttp,
        invalidRegistrationInput:
          settingsCopy.account.errors.invalidRegistrationInput,
        registrationFailed: settingsCopy.account.errors.registrationFailed,
        invalidCredentials: settingsCopy.account.errors.invalidCredentials,
        recoveryPhraseRequired:
          settingsCopy.account.errors.recoveryPhraseRequired,
        invalidRecoveryPhrase:
          settingsCopy.account.errors.invalidRecoveryPhrase,
        recoveryNotAvailable:
          settingsCopy.account.errors.recoveryNotAvailable,
        recoveryPackageNotFound:
          settingsCopy.account.errors.recoveryPackageNotFound,
        tooManyDevices: settingsCopy.account.errors.tooManyDevices,
        syncNotPrepared: settingsCopy.account.errors.syncNotPrepared,
        notConnected: settingsCopy.account.errors.notConnected,
        blobNotFound: settingsCopy.account.errors.blobNotFound,
        invalidPayload: settingsCopy.account.errors.invalidPayload,
        networkFailed: settingsCopy.account.errors.networkFailed,
        recoveryExportUnavailable:
          settingsCopy.account.errors.recoveryExportUnavailable,
        recoveryExportFailed: settingsCopy.account.errors.recoveryExportFailed,
        deviceAuthUnavailable: settingsCopy.account.errors.deviceAuthUnavailable,
        deviceAuthFailed: settingsCopy.account.errors.deviceAuthFailed,
        saveFailed: settingsCopy.account.errors.saveFailed,
        syncFailed: settingsCopy.account.errors.syncFailed,
        restoreFailed: settingsCopy.account.errors.restoreFailed,
        deleteAccountFailed: settingsCopy.account.errors.deleteAccountFailed,
        deleteAccountCleanupUnavailable:
          settingsCopy.account.errors.deleteAccountCleanupUnavailable,
        renewalUnavailable: settingsCopy.account.errors.renewalUnavailable,
        renewalUpdateFailed: settingsCopy.account.errors.renewalUpdateFailed,
      },
    },
    symptoms: {
      title: settingsCopy.symptoms.title,
      subtitle: settingsCopy.symptoms.subtitle,
      activeHeading: settingsCopy.symptoms.activeHeading,
      activeHint: settingsCopy.symptoms.activeHint,
      activeItem: settingsCopy.symptoms.activeItem,
      archivedHeading: settingsCopy.symptoms.archivedHeading,
      archivedHint: settingsCopy.symptoms.archivedHint,
      archivedItem: settingsCopy.symptoms.archivedItem,
      archivedBadge: settingsCopy.symptoms.archivedBadge,
      empty: settingsCopy.symptoms.empty,
      emptyActive: settingsCopy.symptoms.emptyActive,
      nameLabel: settingsCopy.symptoms.name,
      namePlaceholder: settingsCopy.symptoms.namePlaceholder,
      nameHint: settingsCopy.symptoms.nameHint,
      iconLabel: settingsCopy.symptoms.icon,
      addLabel: settingsCopy.symptoms.add,
      saveLabel: settingsCopy.symptoms.save,
      hideLabel: settingsCopy.symptoms.hide,
      restoreLabel: settingsCopy.symptoms.restore,
      iconOptions: SYMPTOM_ICON_CATALOG.map((value) => ({
        value,
        label: value,
      })),
      status: {
        created: settingsCopy.symptoms.created,
        updated: settingsCopy.symptoms.updated,
        archived: settingsCopy.symptoms.archived,
        restored: settingsCopy.symptoms.restored,
      },
      errors: settingsCopy.symptoms.errors,
    },
    export: {
      title: settingsCopy.export.title,
      subtitle: settingsCopy.export.subtitle,
      storageHint: settingsCopy.export.storageHint,
      sensitiveHint: settingsCopy.export.sensitiveHint,
      pdfCloudOnlyHint: settingsCopy.export.pdfCloudOnlyHint,
      pdfPlanHint: settingsCopy.export.pdfPlanHint,
      noData: settingsCopy.export.noData,
      presetLabel: settingsCopy.export.presetLabel,
      presetOptions: [
        { value: "all", label: settingsCopy.export.presetAll },
        { value: "30", label: settingsCopy.export.preset30 },
        { value: "90", label: settingsCopy.export.preset90 },
        { value: "365", label: settingsCopy.export.preset365 },
      ],
      fromLabel: settingsCopy.export.fromLabel,
      toLabel: settingsCopy.export.toLabel,
      datePlaceholder: settingsCopy.export.datePlaceholder,
      summaryTotalTemplate: settingsCopy.export.summaryTotalTemplate,
      summaryRangeTemplate: settingsCopy.export.summaryRangeTemplate,
      summaryRangeEmpty: settingsCopy.export.summaryRangeEmpty,
      csvAction: settingsCopy.export.csvAction,
      jsonAction: settingsCopy.export.jsonAction,
      pdfAction: settingsCopy.export.pdfAction,
      status: {
        csvReady: settingsCopy.export.csvStatus,
        jsonReady: settingsCopy.export.jsonStatus,
        pdfReady: settingsCopy.export.pdfStatus,
      },
      errors: settingsCopy.export.errors,
    },
    import: settingsCopy.import,
    danger: {
      title: settingsCopy.danger.title,
      subtitle: settingsCopy.danger.subtitle,
      clearTitle: settingsCopy.danger.clearTitle,
      clearSubtitle: settingsCopy.danger.clearSubtitle,
      confirmationLabel: settingsCopy.danger.confirmationLabel,
      confirmationPlaceholder: settingsCopy.danger.confirmationPlaceholder,
      confirmationHint: settingsCopy.danger.confirmationHint,
      deviceAuthPrompt: settingsCopy.danger.deviceAuthPrompt,
      action: settingsCopy.danger.action,
      status: {
        success: settingsCopy.danger.success,
        invalidConfirmation: settingsCopy.danger.invalidConfirmation,
        deviceAuthUnavailable: settingsCopy.danger.deviceAuthUnavailable,
        deviceAuthFailed: settingsCopy.danger.deviceAuthFailed,
        failed: settingsCopy.danger.failed,
      },
    },
    privacy: settingsCopy.privacy,
    status: settingsCopy.status,
    premiumLock: settingsCopy.premiumLock,
  };
}

export function createLoadedSettingsState(
  profile: ProfileRecord,
  savedSyncPreferences: SyncPreferencesRecord,
  hasStoredSyncSecrets: boolean,
  hasSyncSession: boolean,
  symptomRecords: SymptomRecord[],
  exportState: LoadedExportState,
  syncPreferences: SyncPreferencesRecord = savedSyncPreferences,
  syncCapabilities: SyncCapabilityDocument | null = null,
  managedPremiumAccess: SettingsManagedPremiumAccess = createEmptySettingsManagedPremiumAccess(),
): LoadedSettingsState {
  return {
    profile,
    cycleValues: {
      lastPeriodStart: profile.lastPeriodStart,
      cycleLength: profile.cycleLength,
      periodLength: profile.periodLength,
      autoPeriodFill: profile.autoPeriodFill,
      irregularCycle: profile.irregularCycle,
      unpredictableCycle: profile.unpredictableCycle,
      ageGroup: normalizeAgeGroup(profile.ageGroup),
      usageGoal: profile.usageGoal,
    },
    interfaceValues: {
      languageOverride: profile.languageOverride,
      themeOverride: profile.themeOverride,
      firstDayOfWeek: normalizeWeekStartDay(profile.firstDayOfWeek),
      screenCaptureProtectionEnabled: resolveScreenCaptureProtectionEnabled(
        profile.screenCaptureProtectionEnabled,
      ),
    },
    hasSyncSession,
    managedPremiumAccess,
    syncCapabilities,
    savedSyncPreferences,
    syncPreferences,
    hasStoredSyncSecrets,
    reminderValues: {
      dailyLogReminderEnabled: profile.dailyLogReminderEnabled === true,
      upcomingPeriodReminderEnabled: profile.upcomingPeriodReminderEnabled === true,
      fertileWindowReminderEnabled: profile.fertileWindowReminderEnabled === true,
      managedReminderEmailsEnabled:
        profile.managedReminderEmailsEnabled === true,
      reminderTime: profile.reminderTime ?? DEFAULT_REMINDER_TIME,
      reminderLeadDays: clampReminderLeadDays(
        profile.reminderLeadDays ?? DEFAULT_REMINDER_LEAD_DAYS,
      ),
    },
    trackingValues: {
      trackBBT: profile.trackBBT,
      temperatureUnit: profile.temperatureUnit,
      trackCervicalMucus: profile.trackCervicalMucus,
      hideSexChip: profile.hideSexChip,
      hideNotes: profile.hideNotes === true,
      hideCycleFactors: profile.hideCycleFactors === true,
      showHistoricalPhases: profile.showHistoricalPhases === true,
    },
    symptomRecords,
    exportState,
  };
}

export function buildSettingsSymptomsState(
  symptomRecords: readonly SymptomRecord[],
): SettingsSymptomsState {
  return splitCustomSymptoms(symptomRecords);
}

export function extractPersistedCycleValues(
  profile: LoadedSettingsState["profile"],
): LoadedSettingsState["cycleValues"] {
  return {
    lastPeriodStart: profile.lastPeriodStart,
    cycleLength: profile.cycleLength,
    periodLength: profile.periodLength,
    autoPeriodFill: profile.autoPeriodFill,
    irregularCycle: profile.irregularCycle,
    unpredictableCycle: profile.unpredictableCycle,
    ageGroup: normalizeAgeGroup(profile.ageGroup),
    usageGoal: profile.usageGoal,
  };
}

export function extractPersistedTrackingValues(
  profile: LoadedSettingsState["profile"],
): LoadedSettingsState["trackingValues"] {
  return {
    trackBBT: profile.trackBBT,
    temperatureUnit: profile.temperatureUnit,
    trackCervicalMucus: profile.trackCervicalMucus,
    hideSexChip: profile.hideSexChip,
    hideNotes: profile.hideNotes === true,
    hideCycleFactors: profile.hideCycleFactors === true,
    showHistoricalPhases: profile.showHistoricalPhases === true,
  };
}

export function extractPersistedReminderValues(
  profile: LoadedSettingsState["profile"],
): LoadedSettingsState["reminderValues"] {
  return {
    dailyLogReminderEnabled: profile.dailyLogReminderEnabled === true,
    upcomingPeriodReminderEnabled: profile.upcomingPeriodReminderEnabled === true,
    fertileWindowReminderEnabled: profile.fertileWindowReminderEnabled === true,
    managedReminderEmailsEnabled: profile.managedReminderEmailsEnabled === true,
    reminderTime: profile.reminderTime ?? DEFAULT_REMINDER_TIME,
    reminderLeadDays: clampReminderLeadDays(
      profile.reminderLeadDays ?? DEFAULT_REMINDER_LEAD_DAYS,
    ),
  };
}

export function extractPersistedInterfaceValues(
  profile: LoadedSettingsState["profile"],
): LoadedSettingsState["interfaceValues"] {
  return {
    languageOverride: profile.languageOverride,
    themeOverride: profile.themeOverride,
    firstDayOfWeek: normalizeWeekStartDay(profile.firstDayOfWeek),
    screenCaptureProtectionEnabled: resolveScreenCaptureProtectionEnabled(
      profile.screenCaptureProtectionEnabled,
    ),
  };
}

export function areCycleSettingsEqual(
  left: LoadedSettingsState["cycleValues"],
  right: LoadedSettingsState["cycleValues"],
): boolean {
  return (
    left.lastPeriodStart === right.lastPeriodStart &&
    left.cycleLength === right.cycleLength &&
    left.periodLength === right.periodLength &&
    left.autoPeriodFill === right.autoPeriodFill &&
    left.irregularCycle === right.irregularCycle &&
    left.unpredictableCycle === right.unpredictableCycle &&
    left.ageGroup === right.ageGroup &&
    left.usageGoal === right.usageGoal
  );
}

export function areTrackingSettingsEqual(
  left: LoadedSettingsState["trackingValues"],
  right: LoadedSettingsState["trackingValues"],
): boolean {
  return (
    left.trackBBT === right.trackBBT &&
    left.temperatureUnit === right.temperatureUnit &&
    left.trackCervicalMucus === right.trackCervicalMucus &&
    left.hideSexChip === right.hideSexChip &&
    left.hideNotes === right.hideNotes &&
    left.hideCycleFactors === right.hideCycleFactors &&
    left.showHistoricalPhases === right.showHistoricalPhases
  );
}

export function areReminderSettingsEqual(
  left: LoadedSettingsState["reminderValues"],
  right: LoadedSettingsState["reminderValues"],
): boolean {
  return (
    left.dailyLogReminderEnabled === right.dailyLogReminderEnabled &&
    left.upcomingPeriodReminderEnabled === right.upcomingPeriodReminderEnabled &&
    left.fertileWindowReminderEnabled === right.fertileWindowReminderEnabled &&
    left.managedReminderEmailsEnabled === right.managedReminderEmailsEnabled &&
    left.reminderTime === right.reminderTime &&
    left.reminderLeadDays === right.reminderLeadDays
  );
}

export function areInterfaceSettingsEqual(
  left: LoadedSettingsState["interfaceValues"],
  right: LoadedSettingsState["interfaceValues"],
): boolean {
  return (
    left.languageOverride === right.languageOverride &&
    left.themeOverride === right.themeOverride &&
    left.screenCaptureProtectionEnabled === right.screenCaptureProtectionEnabled &&
    left.firstDayOfWeek === right.firstDayOfWeek
  );
}

export function buildSettingsDirtyState(
  state: LoadedSettingsState | null,
): SettingsDirtyState {
  if (!state) {
    return {
      isCycleDirty: false,
      isReminderDirty: false,
      isTrackingDirty: false,
      isInterfaceDirty: false,
      hasUnsavedSettingsChanges: false,
    };
  }

  const isCycleDirty = !areCycleSettingsEqual(
    state.cycleValues,
    extractPersistedCycleValues(state.profile),
  );
  const isReminderDirty = !areReminderSettingsEqual(
    state.reminderValues,
    extractPersistedReminderValues(state.profile),
  );
  const isTrackingDirty = !areTrackingSettingsEqual(
    state.trackingValues,
    extractPersistedTrackingValues(state.profile),
  );
  const isInterfaceDirty = !areInterfaceSettingsEqual(
    state.interfaceValues,
    extractPersistedInterfaceValues(state.profile),
  );

  return {
    isCycleDirty,
    isReminderDirty,
    isTrackingDirty,
    isInterfaceDirty,
    hasUnsavedSettingsChanges:
      isCycleDirty || isReminderDirty || isTrackingDirty || isInterfaceDirty,
  };
}

export function revertLoadedSettingsDraftValues(
  state: LoadedSettingsState,
): LoadedSettingsState {
  return {
    ...state,
    cycleValues: extractPersistedCycleValues(state.profile),
    reminderValues: extractPersistedReminderValues(state.profile),
    trackingValues: extractPersistedTrackingValues(state.profile),
    interfaceValues: extractPersistedInterfaceValues(state.profile),
  };
}

export function buildSettingsSyncSummary(
  state: Pick<
    LoadedSettingsState,
    | "hasStoredSyncSecrets"
    | "hasSyncSession"
    | "managedPremiumAccess"
    | "syncCapabilities"
    | "syncPreferences"
  >,
  viewData: SettingsViewData["account"],
  notSetLabel: string,
  locale?: string,
): SettingsSyncSummaryViewData {
  const isManaged = state.syncPreferences.mode === "managed";
  const destinationValue = isManaged
    ? viewData.modeOptions.find((option) => option.value === "managed")?.label ??
      "managed"
    : state.syncPreferences.endpointInput.trim() || notSetLabel;
  const lastSyncValue = state.syncPreferences.lastSyncedAt
    ? formatSettingsLastSync(state.syncPreferences.lastSyncedAt, locale)
    : viewData.lastSyncNever;

  let statusMessage = viewData.stateMissing;
  let statusTone: SettingsSyncSummaryViewData["statusTone"] = "info";

  if (state.hasStoredSyncSecrets) {
    statusMessage = viewData.connectionMissing;

    if (state.hasSyncSession) {
      if (isManaged) {
        if (state.managedPremiumAccess.planStatus === "unknown") {
          statusMessage = viewData.planCheckFailed;
        } else if (state.managedPremiumAccess.planStatus === "active") {
          statusMessage = viewData.planActive;
          statusTone = "success";
        } else {
          statusMessage = viewData.planInactive;
        }
      } else {
        statusMessage = viewData.status.connected;
        statusTone = "success";
      }
    }
  }

  return {
    title: viewData.title,
    description: viewData.hubSubtitle,
    destinationLabel: viewData.modeRowLabel,
    destinationValue,
    lastSyncLabel: viewData.lastSyncLabel,
    lastSyncValue,
    actionLabel: viewData.openHubLabel,
    statusMessage,
    statusTone,
  };
}

// Assemble the hub navigation rows from the section copy that already exists —
// the route split reuses each section's own title (and subtitle where the
// section has one) so no new locale keys are introduced. The "data" row pairs
// the export title with the import title so both halves of that screen are
// named on the hub.
export function buildSettingsHubNavigation(
  viewData: SettingsViewData,
): Record<SettingsHubSectionKey, SettingsHubNavigationRow> {
  return {
    cycle: {
      key: "cycle",
      title: viewData.cycle.title,
      description: "",
    },
    symptoms: {
      key: "symptoms",
      title: viewData.symptoms.title,
      description: viewData.symptoms.subtitle,
    },
    tracking: {
      key: "tracking",
      title: viewData.tracking.title,
      description: viewData.tracking.subtitle,
    },
    reminders: {
      key: "reminders",
      title: viewData.reminders.title,
      description: viewData.reminders.subtitle,
    },
    interface: {
      key: "interface",
      title: viewData.interface.title,
      description: viewData.interface.subtitle,
    },
    data: {
      key: "data",
      title: viewData.export.title,
      description: viewData.import.title,
    },
    danger: {
      key: "danger",
      title: viewData.danger.title,
      description: viewData.danger.subtitle,
    },
  };
}

export function resolveSettingsPredictionMode(
  cycleValues: Pick<CycleSettingsValues, "irregularCycle" | "unpredictableCycle">,
): PredictionMode {
  return resolvePredictionMode(cycleValues);
}

export function buildSettingsCycleGuidance(cycleValues: CycleSettingsValues) {
  return buildCycleGuidanceState(cycleValues.cycleLength, cycleValues.periodLength);
}

export function buildSettingsExportSectionPresentationState(
  state: Pick<
    LoadedSettingsState,
    | "exportState"
    | "hasSyncSession"
    | "managedPremiumAccess"
    | "syncPreferences"
  >,
  viewData: SettingsViewData["export"],
  platformOS: string,
): SettingsExportSectionPresentationState {
  const pdfAccess = resolvePDFExportAccessState({
    hasSyncSession: state.hasSyncSession,
    managedDoctorPDFAllowed: state.managedPremiumAccess.doctorPDF,
    syncMode: state.syncPreferences.mode,
  });

  return {
    hasAnyData: state.exportState.availableSummary.hasData,
    summaryRangeLabel: buildSummaryRangeLabel(
      viewData.summaryRangeTemplate,
      viewData.summaryRangeEmpty,
      state.exportState,
    ),
    summaryTotalLabel: formatTemplate(viewData.summaryTotalTemplate, [
      String(state.exportState.summary.totalEntries),
    ]),
    supportsNativeDatePicker: platformOS !== "web",
    canExportPDF: pdfAccess.enabled,
    pdfHint:
      pdfAccess.reason === "cloud_only"
        ? viewData.pdfCloudOnlyHint
        : pdfAccess.reason === "plan_required"
          ? viewData.pdfPlanHint
          : "",
  };
}

export type SettingsImportPreviewViewData = {
  detailLines: string[];
  profileLine: string;
  nothingNewLine: string;
  canConfirm: boolean;
};

// Assemble the localized preview lines for the two-phase import flow: what the
// backup contains and exactly what confirming will add. Values coming from the
// (user-picked, untrusted) envelope are validated before display so a
// tampered file cannot inject arbitrary strings into the preview.
export function buildSettingsImportPreviewViewData(
  envelope: ExportBackupEnvelope,
  outcome: ImportOutcome,
  viewData: SettingsViewData["import"],
  locale: string,
): SettingsImportPreviewViewData {
  const detailLines: string[] = [];

  const createdAt =
    typeof envelope.exportedAt === "string" ? new Date(envelope.exportedAt) : null;
  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    detailLines.push(
      formatTemplate(viewData.previewCreatedTemplate, [
        formatSettingsLastSync(envelope.exportedAt, locale),
      ]),
    );
  }

  const rangeFrom =
    typeof envelope.summary?.dateFrom === "string" &&
    parseLocalDate(envelope.summary.dateFrom)
      ? envelope.summary.dateFrom
      : "";
  const rangeTo =
    typeof envelope.summary?.dateTo === "string" &&
    parseLocalDate(envelope.summary.dateTo)
      ? envelope.summary.dateTo
      : "";
  if (rangeFrom && rangeTo) {
    detailLines.push(
      formatTemplate(viewData.previewRangeTemplate, [rangeFrom, rangeTo]),
    );
  }

  detailLines.push(
    formatTemplate(viewData.previewTotalTemplate, [
      String(envelope.dayLogs?.length ?? 0),
    ]),
  );
  detailLines.push(
    formatTemplate(viewData.previewAddTemplate, [String(outcome.dayLogsAdded)]),
  );
  if (outcome.dayLogsSkipped > 0) {
    detailLines.push(
      formatTemplate(viewData.previewSkipTemplate, [
        String(outcome.dayLogsSkipped),
      ]),
    );
  }
  if (outcome.dayLogsRejected > 0) {
    detailLines.push(
      formatTemplate(viewData.previewRejectTemplate, [
        String(outcome.dayLogsRejected),
      ]),
    );
  }
  if (outcome.symptomsAdded > 0) {
    detailLines.push(
      formatTemplate(viewData.previewSymptomsTemplate, [
        String(outcome.symptomsAdded),
      ]),
    );
  }

  // Pregnancy-mode collections(formatVersion 2). Each row appears only
  // when its count is positive, so a v1 file's preview renders exactly as it
  // did before these collections existed.
  if (outcome.pregnanciesAdded > 0) {
    detailLines.push(
      formatTemplate(viewData.previewPregnanciesTemplate, [
        String(outcome.pregnanciesAdded),
      ]),
    );
  }
  if (outcome.kickSessionsAdded > 0) {
    detailLines.push(
      formatTemplate(viewData.previewKickSessionsTemplate, [
        String(outcome.kickSessionsAdded),
      ]),
    );
  }
  if (outcome.contractionSessionsAdded > 0) {
    detailLines.push(
      formatTemplate(viewData.previewContractionSessionsTemplate, [
        String(outcome.contractionSessionsAdded),
      ]),
    );
  }

  // Postpartum records + screening responses(formatVersion 3). Same
  // "row only when the count is positive" rule as the pregnancy-mode rows above,
  // so a v1/v2 file's preview stays byte-identical to before these collections
  // existed. The screening row reports only a COUNT of new check-ins — never a
  // score, band, or self-harm signal (the most sensitive class never surfaces
  // its answers in a settings preview).
  if (outcome.postpartumRecordsAdded > 0) {
    detailLines.push(
      formatTemplate(viewData.previewPostpartumRecordsTemplate, [
        String(outcome.postpartumRecordsAdded),
      ]),
    );
  }
  if (outcome.screeningResponsesAdded > 0) {
    detailLines.push(
      formatTemplate(viewData.previewScreeningResponsesTemplate, [
        String(outcome.screeningResponsesAdded),
      ]),
    );
  }

  // The pregnancy-mode + postpartum/screening counts participate in hasChanges so a v2/v3 backup
  // whose only new content is one of these collections can actually be
  // confirmed — otherwise the preview would list rows to add while
  // simultaneously claiming "nothing new" with a disabled confirm button.
  const hasChanges =
    outcome.dayLogsAdded > 0 ||
    outcome.symptomsAdded > 0 ||
    outcome.profileRestored ||
    outcome.pregnanciesAdded > 0 ||
    outcome.kickSessionsAdded > 0 ||
    outcome.contractionSessionsAdded > 0 ||
    outcome.postpartumRecordsAdded > 0 ||
    outcome.screeningResponsesAdded > 0;

  return {
    detailLines,
    profileLine: outcome.profileRestored
      ? viewData.previewProfileRestore
      : viewData.previewProfileKept,
    nothingNewLine: hasChanges ? "" : viewData.previewNothingNew,
    canConfirm: hasChanges,
  };
}

export function buildSettingsImportResultMessage(
  outcome: ImportOutcome,
  viewData: SettingsViewData["import"],
): string {
  const base = formatTemplate(viewData.successTemplate, [
    String(outcome.dayLogsAdded),
    String(outcome.dayLogsSkipped),
    String(outcome.dayLogsRejected),
  ]);

  return outcome.profileRestored
    ? `${base} ${viewData.successProfileNote}`
    : base;
}

export function buildSettingsFlowPresentationState(
  state: LoadedSettingsState,
  viewData: SettingsViewData,
  locale: string,
  now: Date,
  platformOS: string,
  exportDatePickerTarget: "from" | "to" | null,
): SettingsFlowPresentationState {
  const selectedDate = state.cycleValues.lastPeriodStart
    ? parseLocalDate(state.cycleValues.lastPeriodStart)
    : null;

  return {
    cyclePickerMaximumDate:
      parseLocalDate(viewData.cycle.dateBounds.maxDate) ?? undefined,
    cyclePickerMinimumDate:
      parseLocalDate(viewData.cycle.dateBounds.minDate) ?? undefined,
    cyclePickerValue:
      selectedDate ??
      parseLocalDate(viewData.cycle.dateBounds.maxDate) ??
      now,
    displayedCycleStartDate: selectedDate
      ? formatLongDate(selectedDate, locale)
      : viewData.common.notSet,
    exportPickerMaximumDate:
      parseLocalDate(state.exportState.bounds.maxDate ?? "") ?? undefined,
    exportPickerMinimumDate:
      parseLocalDate(state.exportState.bounds.minDate ?? "") ?? undefined,
    exportPickerValue: resolveExportDatePickerValue(
      state,
      exportDatePickerTarget,
      now,
    ),
    exportSection: buildSettingsExportSectionPresentationState(
      state,
      viewData.export,
      platformOS,
    ),
    predictionMode: resolveSettingsPredictionMode(state.cycleValues),
    symptomsState: buildSettingsSymptomsState(state.symptomRecords),
  };
}

export function formatSettingsLastSync(value: string, locale?: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function buildSummaryRangeLabel(
  template: string,
  emptyTemplate: string,
  exportState: LoadedExportState,
): string {
  const fromValue = resolveSummaryDateValue(
    exportState.values.fromDate,
    exportState.summary.dateFrom,
  );
  const toValue = resolveSummaryDateValue(
    exportState.values.toDate,
    exportState.summary.dateTo,
  );
  if (!fromValue || !toValue) {
    return emptyTemplate;
  }

  return formatTemplate(template, [fromValue, toValue]);
}

function resolveSummaryDateValue(
  draftValue: string,
  fallbackValue: string | null,
): string | null {
  const normalizedDraftValue = String(draftValue ?? "").trim();
  if (normalizedDraftValue.length === 0) {
    return fallbackValue;
  }

  const parsedDraftValue = parseLocalDate(normalizedDraftValue);
  if (
    !parsedDraftValue ||
    formatLocalDate(parsedDraftValue) !== normalizedDraftValue
  ) {
    return null;
  }

  return normalizedDraftValue;
}

function formatTemplate(template: string, values: string[]): string {
  let index = 0;
  return String(template).replace(/%[sd]/g, () => {
    const value = index < values.length ? values[index] ?? "" : "";
    index += 1;
    return value;
  });
}

function formatLongDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(value);
}

function resolveExportDatePickerValue(
  state: LoadedSettingsState,
  target: "from" | "to" | null,
  fallback: Date,
): Date {
  if (target === "from") {
    return (
      parseLocalDate(state.exportState.values.fromDate) ??
      parseLocalDate(state.exportState.bounds.minDate ?? "") ??
      fallback
    );
  }
  if (target === "to") {
    return (
      parseLocalDate(state.exportState.values.toDate) ??
      parseLocalDate(state.exportState.bounds.maxDate ?? "") ??
      fallback
    );
  }

  return (
    parseLocalDate(state.exportState.bounds.maxDate ?? "") ??
    parseLocalDate(state.exportState.bounds.minDate ?? "") ??
    fallback
  );
}
