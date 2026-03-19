export const dashboardCopy = {
  cycleDay: "Cycle day",
  nextPeriod: "Next period",
  nextPeriodUnknown: "unknown",
  nextPeriodNeedsCycles: "3 cycles are needed for a reliable range",
  nextPeriodPrompt: "Enter the start date of your last cycle",
  ovulation: "Ovulation",
  ovulationNeedsCycles:
    "3 completed cycles are needed before Ovumcy shows an ovulation range",
  ovulationUnavailable: "Cannot be calculated",
  predictionsOff: "Predictions off",
  factsOnlyHint:
    "Predictions are off in unpredictable cycle mode. Ovumcy shows recorded facts only.",
  todayEditor: "Today journal",
  quickActionsTitle: "Quick actions",
  quickActions: {
    mood: "Quick log mood",
    period: "Quick toggle period day",
    symptom: "Quick log a symptom",
  },
  periodDay: "Period day",
  symptoms: "Symptoms",
  mood: "Mood",
  cycleFactors: "Cycle factors",
  cycleFactorsHint:
    "Optional context tags for things that may affect cycle timing.",
  intimacy: "Intimacy",
  intimacyHiddenHint: "This section is hidden in settings.",
  sexSettingsHint: "You can hide this section in settings.",
  cervicalMucus: "Cervical mucus",
  cervicalMucusExplainer:
    "Cervical mucus means vaginal discharge. Egg-white mucus usually appears near peak fertility.",
  bbt: "BBT",
  notes: "Notes",
  manualCycleStart: "Mark new cycle start",
  manualCycleStartSaved: "Cycle start updated locally.",
  manualCycleStartFailed: "Unable to mark a new cycle start. Please try again.",
  invalidCycleStartDate:
    "A new cycle start can be marked only for past days and no more than 2 days ahead.",
  cycleStartSuggestion:
    "This may be the first day of your period. If so, mark it as a new cycle start.",
  cycleStartReplaceMessage:
    "You already marked a cycle start on %s. Replace it with %s?",
  cycleStartReplaceAccept: "Replace",
  cycleStartReplaceRequired:
    "Confirm replacing the already marked cycle start.",
  cycleStartShortGapMessage:
    "⚠️ Only %s days have passed since the previous cycle. This may not be a new cycle. Previous date: %s.",
  cycleStartShortGapAccept: "Mark anyway",
  cycleStartConfirmationRequired:
    "Confirm marking a cycle start with a short gap.",
  futureCycleStartNotice: "Predictions will be recalculated when that day arrives.",
  implantationWarning:
    "This may be implantation bleeding, not a new cycle. If you are trying to conceive, consider taking a test.",
} as const;
