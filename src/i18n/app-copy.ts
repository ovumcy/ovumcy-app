export const appInfo = {
  name: "Ovumcy",
  tagline: "Local-first cycle tracking for iOS and Android.",
};

export const onboardingCopy = {
  progress: {
    step1: "Step 1 of 2",
    step2: "Step 2 of 2",
  },
  buttons: {
    back: "Back",
    next: "Next",
    finish: "Finish",
  },
  step1: {
    title: "When did your last period start?",
    subtitle: "Choose a date from the last 60 days.",
    field: "Last period start date",
    day1Tip: "Day 1 is the first day of full flow, not spotting.",
    privacy:
      "All your data stays on this device unless you choose sync later. Core tracking does not require an account.",
    today: "Today",
    yesterday: "Yesterday",
    twoDaysAgo: "2 days ago",
    changeDate: "Choose another date",
    selectedDate: "Selected date",
  },
  step2: {
    title: "Set up cycle parameters",
    cycleLength: "Typical cycle length",
    cycleLengthHint:
      "Move the slider to the cycle length you usually see from one period start to the next. A common baseline is about 21-35 days.",
    periodLength: "Period duration",
    periodLengthHint:
      "This is the number of days with actual period flow, not spotting before it starts.",
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
    autoPeriodFill: "Auto-mark period days",
    autoPeriodFillHint:
      "When enabled, marking the first day auto-fills the next days based on your period length.",
    irregularCycle: "My cycle is usually irregular",
    irregularCycleHint:
      "Turn this on if your cycles vary by more than 7 days. Ranges will be used for next period and ovulation instead of a single date.",
    ageGroup: "Your age",
    ageGroupHint:
      "Optional. This helps widen the prediction range when cycle variability is naturally higher.",
    usageGoal: "Why are you using Ovumcy?",
    usageGoalHint:
      "Optional. This changes UI emphasis only, not the prediction algorithm.",
  },
  ageGroup: {
    under20: "Under 20",
    age20to35: "20-35",
    age35plus: "35+",
  },
  usageGoal: {
    avoidPregnancy: "Avoid pregnancy",
    tryingToConceive: "Trying to conceive",
    health: "General cycle tracking",
  },
  errors: {
    dateRequired: "Please select a date.",
    invalidLastPeriodStart: "Please select a valid last period start date.",
    lastPeriodRange: "Choose a date within the last 60 days.",
    generic: "Failed to save onboarding data. Please try again.",
  },
  loading: "Loading your local setup…",
} as const;
