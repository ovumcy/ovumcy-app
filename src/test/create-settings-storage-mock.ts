import { createLocalAppStorageMock } from "./create-local-app-storage-mock";

export function createSettingsStorageMock(overrides = {}) {
  return createLocalAppStorageMock({
    readProfileRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
      trackBBT: false,
      temperatureUnit: "c",
      trackCervicalMucus: false,
      hideSexChip: false,
      languageOverride: "en",
      themeOverride: "light",
      screenCaptureProtectionEnabled: true,
    }),
    readOnboardingRecord: jest.fn().mockResolvedValue({
      lastPeriodStart: "2026-03-10",
      cycleLength: 28,
      periodLength: 5,
      autoPeriodFill: true,
      irregularCycle: false,
      unpredictableCycle: false,
      ageGroup: "",
      usageGoal: "health",
    }),
    readDayLogSummary: jest.fn().mockResolvedValue({
      totalEntries: 1,
      hasData: true,
      dateFrom: "2026-03-10",
      dateTo: "2026-03-10",
    }),
    listDayLogRecordsInRange: jest.fn().mockResolvedValue([
      {
        date: "2026-03-10",
        isPeriod: true,
        cycleStart: true,
        isUncertain: false,
        flow: "medium",
        mood: 0,
        sexActivity: "none",
        bbt: 0,
        cervicalMucus: "none",
        cycleFactorKeys: [],
        symptomIDs: [],
        notes: "Cycle start",
      },
    ]),
    ...overrides,
  });
}
