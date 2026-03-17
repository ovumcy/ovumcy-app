export const settingsCopy = {
  title: "Settings",
  subtitle: "Manage cycle parameters, tracking fields, and local profile behavior.",
  common: {
    daysShort: "d",
    changeDate: "Change date",
    clearDate: "Clear date",
    saving: "Saving...",
  },
  cycle: {
    title: "Cycle Parameters",
    cycleLength: "Typical cycle length",
    periodLength: "Period duration",
    lastPeriodStart: "Last period start date",
    lastPeriodStartHint:
      "Optional. Used as a fallback cycle anchor when your journal does not yet have a marked cycle start.",
    errorIncompatible:
      "Period duration is incompatible with cycle length. Menstruation cannot take up almost the whole cycle.",
    warningApproximate:
      "With these values, ovulation cannot be calculated reliably. Prediction will be approximate.",
    infoAdjusted:
      "Period length was adjusted automatically so at least 10 days remain before the next cycle.",
    infoPeriodLong:
      "A duration above 8 days may indicate cycle irregularities; please discuss with a doctor.",
    infoCycleShort:
      "A cycle shorter than 24 days is less common; please discuss with a doctor.",
    autoPeriodFill: "Auto-fill period days",
    autoPeriodFillHint:
      "When enabled, marking the first day auto-fills the next days based on your period length.",
    irregularCycle: "I have an irregular cycle",
    irregularCycleHint:
      "Turn this on if your cycles vary by more than 7 days. Ranges will be used for next period and ovulation instead of a single date.",
    unpredictableCycle: "My cycle is unpredictable (PCOS, perimenopause, etc.)",
    unpredictableCycleHint:
      "Turns date prediction off completely and keeps the dashboard focused on recorded facts only.",
    save: "Save Changes",
  },
  ageGroup: {
    title: "Age group",
    hint: "Optional. If you are 35+, Ovumcy widens the prediction range by one extra day.",
    under20: "Under 20",
    age20to35: "20-35",
    age35plus: "35+",
  },
  goal: {
    title: "Usage goal",
    hint: "Optional. This changes how fertile days are framed in the UI. It does not change the algorithm.",
    avoid: "Avoid pregnancy",
    trying: "Trying to conceive",
    health: "Track my health",
  },
  tracking: {
    title: "Additional tracking",
    subtitle:
      "Turn on the owner-only fields you want in daily logging. Existing values stay in your private history.",
    trackBBT: "Show BBT field",
    trackBBTHint:
      "Adds a basal body temperature field to dashboard and calendar day editing. Saved values still appear in owner history and exports later.",
    trackBBTStateOn: "Currently visible in dashboard and calendar day editor.",
    trackBBTStateOff: "Currently hidden from new dashboard and calendar entries.",
    trackCervicalMucus: "Show cervical mucus field",
    trackCervicalMucusHint:
      "Adds cervical mucus choices to dashboard and calendar day editing. Saved values still appear in owner history.",
    trackCervicalMucusStateOn:
      "Currently visible in dashboard and calendar day editor.",
    trackCervicalMucusStateOff:
      "Currently hidden from new dashboard and calendar entries.",
    hideSexChip: "Hide intimacy section",
    hideSexChipHint:
      "Removes the intimacy section from new dashboard and calendar entries. Saved activity still appears in your private history.",
    hideSexChipStateOn:
      "Currently hidden in dashboard and calendar day editor.",
    hideSexChipStateOff:
      "Currently visible in dashboard and calendar day editor.",
    temperatureUnit: "BBT unit",
    temperatureUnitHint: "Used when the BBT field is visible.",
    temperatureUnitCelsius: "Celsius",
    temperatureUnitFahrenheit: "Fahrenheit",
    save: "Save tracking",
  },
  status: {
    cycleSaved: "Cycle settings updated successfully.",
    trackingSaved: "Tracking settings updated.",
    invalidLastPeriodStart:
      "Please enter a valid last period start date that is not in the future.",
    saveFailed: "Unable to save your settings. Please try again.",
  },
} as const;
