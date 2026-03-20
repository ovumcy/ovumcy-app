import { APP_LANGUAGE_LABELS } from "../i18n/runtime";
import { getSettingsCopy } from "../i18n/settings-copy";
import type { LoadedExportState } from "../models/export";
import type {
  AgeGroupOption,
  CycleSettingsValues,
  InterfaceLanguage,
  InterfaceSettingsValues,
  ProfileRecord,
  TemperatureUnit,
  ThemePreference,
  TrackingSettingsValues,
  UsageGoal,
} from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import { SYMPTOM_ICON_CATALOG } from "../models/symptom";
import type { SyncMode, SyncPreferencesRecord } from "../sync/sync-contract";
import {
  buildCycleGuidanceState,
  getSettingsCycleStartDateBounds,
  resolveDisplayedAgeGroup,
} from "./profile-settings-policy";
import { splitCustomSymptoms } from "./symptom-policy";

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
    irregularCycleLabel: string;
    irregularCycleHint: string;
    unpredictableCycleLabel: string;
    unpredictableCycleHint: string;
    saveLabel: string;
    messages: {
      errorIncompatible: string;
      warningApproximate: string;
      infoAdjusted: string;
      infoPeriodLong: string;
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
    temperatureUnit: {
      label: string;
      hint: string;
      options: { value: TemperatureUnit; label: string }[];
    };
    saveLabel: string;
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
    discardChangesLabel: string;
    saveLabel: string;
    saveBeforeLeaveLabel: string;
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
    modeRowLabel: string;
    endpointRowLabel: string;
    encryptionRowLabel: string;
    encryptionReady: string;
    encryptionMissing: string;
    recoveryTitle: string;
    recoveryHint: string;
    recoveryNotice: string;
    recoveryShownOnce: string;
    prepareLabel: string;
    regenerateLabel: string;
    regeneratePrompt: string;
    regenerateAccept: string;
    regenerateDeviceAuthPrompt: string;
    status: {
      prepared: string;
      regenerated: string;
    };
    errors: {
      deviceLabelRequired: string;
      endpointRequired: string;
      invalidEndpoint: string;
      unsupportedScheme: string;
      insecurePublicHttp: string;
      deviceAuthUnavailable: string;
      deviceAuthFailed: string;
      saveFailed: string;
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
  status: SettingsCopy["status"];
};

export type LoadedSettingsState = {
  profile: ProfileRecord;
  cycleValues: CycleSettingsValues;
  interfaceValues: InterfaceSettingsValues;
  savedSyncPreferences: SyncPreferencesRecord;
  syncPreferences: SyncPreferencesRecord;
  hasStoredSyncSecrets: boolean;
  trackingValues: TrackingSettingsValues;
  symptomRecords: SymptomRecord[];
  exportState: LoadedExportState;
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
      irregularCycleLabel: settingsCopy.cycle.irregularCycle,
      irregularCycleHint: settingsCopy.cycle.irregularCycleHint,
      unpredictableCycleLabel: settingsCopy.cycle.unpredictableCycle,
      unpredictableCycleHint: settingsCopy.cycle.unpredictableCycleHint,
      saveLabel: settingsCopy.cycle.save,
      messages: {
        errorIncompatible: settingsCopy.cycle.errorIncompatible,
        warningApproximate: settingsCopy.cycle.warningApproximate,
        infoAdjusted: settingsCopy.cycle.infoAdjusted,
        infoPeriodLong: settingsCopy.cycle.infoPeriodLong,
        infoCycleShort: settingsCopy.cycle.infoCycleShort,
      },
    },
    ageGroup: {
      label: settingsCopy.ageGroup.title,
      hint: settingsCopy.ageGroup.hint,
      options: [
        { value: "under_20", label: settingsCopy.ageGroup.under20 },
        { value: "age_20_35", label: settingsCopy.ageGroup.age20to35 },
        { value: "age_35_plus", label: settingsCopy.ageGroup.age35plus },
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
      temperatureUnit: {
        label: settingsCopy.tracking.temperatureUnit,
        hint: settingsCopy.tracking.temperatureUnitHint,
        options: [
          { value: "c", label: `°C · ${settingsCopy.tracking.temperatureUnitCelsius}` },
          { value: "f", label: `°F · ${settingsCopy.tracking.temperatureUnitFahrenheit}` },
        ],
      },
      saveLabel: settingsCopy.tracking.save,
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
      ],
      previewHint: settingsCopy.interface.previewHint,
      themeLabel: settingsCopy.interface.themeLabel,
      themeHint: settingsCopy.interface.themeHint,
      themeOptions: [
        { value: "light", label: settingsCopy.interface.themeLight },
        { value: "dark", label: settingsCopy.interface.themeDark },
      ],
      discardChangesLabel: settingsCopy.interface.discardChanges,
      saveLabel: settingsCopy.interface.save,
      saveBeforeLeaveLabel: settingsCopy.interface.saveBeforeLeave,
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
      modeRowLabel: settingsCopy.account.modeRowLabel,
      endpointRowLabel: settingsCopy.account.endpointRowLabel,
      encryptionRowLabel: settingsCopy.account.encryptionRowLabel,
      encryptionReady: settingsCopy.account.encryptionReady,
      encryptionMissing: settingsCopy.account.encryptionMissing,
      recoveryTitle: settingsCopy.account.recoveryTitle,
      recoveryHint: settingsCopy.account.recoveryHint,
      recoveryNotice: settingsCopy.account.recoveryNotice,
      recoveryShownOnce: settingsCopy.account.recoveryShownOnce,
      prepareLabel: settingsCopy.account.prepareLabel,
      regenerateLabel: settingsCopy.account.regenerateLabel,
      regeneratePrompt: settingsCopy.account.regeneratePrompt,
      regenerateAccept: settingsCopy.account.regenerateAccept,
      regenerateDeviceAuthPrompt: settingsCopy.account.regenerateDeviceAuthPrompt,
      status: {
        prepared: settingsCopy.account.prepared,
        regenerated: settingsCopy.account.regenerated,
      },
      errors: {
        deviceLabelRequired: settingsCopy.account.errors.deviceLabelRequired,
        endpointRequired: settingsCopy.account.errors.endpointRequired,
        invalidEndpoint: settingsCopy.account.errors.invalidEndpoint,
        unsupportedScheme: settingsCopy.account.errors.unsupportedScheme,
        insecurePublicHttp: settingsCopy.account.errors.insecurePublicHttp,
        deviceAuthUnavailable: settingsCopy.account.errors.deviceAuthUnavailable,
        deviceAuthFailed: settingsCopy.account.errors.deviceAuthFailed,
        saveFailed: settingsCopy.account.errors.saveFailed,
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
    status: settingsCopy.status,
  };
}

export function createLoadedSettingsState(
  profile: ProfileRecord,
  savedSyncPreferences: SyncPreferencesRecord,
  hasStoredSyncSecrets: boolean,
  symptomRecords: SymptomRecord[],
  exportState: LoadedExportState,
  syncPreferences: SyncPreferencesRecord = savedSyncPreferences,
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
      ageGroup: resolveDisplayedAgeGroup(profile.ageGroup),
      usageGoal: profile.usageGoal,
    },
    interfaceValues: {
      languageOverride: profile.languageOverride,
      themeOverride: profile.themeOverride,
    },
    savedSyncPreferences,
    syncPreferences,
    hasStoredSyncSecrets,
    trackingValues: {
      trackBBT: profile.trackBBT,
      temperatureUnit: profile.temperatureUnit,
      trackCervicalMucus: profile.trackCervicalMucus,
      hideSexChip: profile.hideSexChip,
    },
    symptomRecords,
    exportState,
  };
}

export function buildSettingsSymptomsState(symptomRecords: readonly SymptomRecord[]) {
  return splitCustomSymptoms(symptomRecords);
}

export function resolveSettingsAgeGroupSelection(
  cycleValues: CycleSettingsValues,
): AgeGroupOption {
  return resolveDisplayedAgeGroup(cycleValues.ageGroup);
}

export function buildSettingsCycleGuidance(cycleValues: CycleSettingsValues) {
  return buildCycleGuidanceState(cycleValues.cycleLength, cycleValues.periodLength);
}
