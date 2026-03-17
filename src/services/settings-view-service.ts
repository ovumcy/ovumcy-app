import { settingsCopy } from "../i18n/settings-copy";
import type {
  AgeGroupOption,
  CycleSettingsValues,
  ProfileRecord,
  TemperatureUnit,
  TrackingSettingsValues,
  UsageGoal,
} from "../models/profile";
import type { SymptomRecord } from "../models/symptom";
import { SYMPTOM_ICON_CATALOG } from "../models/symptom";
import {
  buildCycleGuidanceState,
  getSettingsCycleStartDateBounds,
  resolveDisplayedAgeGroup,
} from "./profile-settings-policy";
import { splitCustomSymptoms } from "./symptom-policy";

export type SettingsViewData = {
  eyebrow: string;
  title: string;
  description: string;
  common: typeof settingsCopy.common;
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
    errors: typeof settingsCopy.symptoms.errors;
  };
  status: typeof settingsCopy.status;
};

export type LoadedSettingsState = {
  profile: ProfileRecord;
  cycleValues: CycleSettingsValues;
  trackingValues: TrackingSettingsValues;
  symptomRecords: SymptomRecord[];
};

export function buildSettingsViewData(now: Date): SettingsViewData {
  return {
    eyebrow: "Preferences",
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
    status: settingsCopy.status,
  };
}

export function createLoadedSettingsState(
  profile: ProfileRecord,
  symptomRecords: SymptomRecord[],
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
    trackingValues: {
      trackBBT: profile.trackBBT,
      temperatureUnit: profile.temperatureUnit,
      trackCervicalMucus: profile.trackCervicalMucus,
      hideSexChip: profile.hideSexChip,
    },
    symptomRecords,
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
