import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createDefaultOnboardingRecord } from "../services/onboarding-policy";
import {
  createDefaultBootstrapState,
  type LocalAppStorage,
} from "../storage/local/storage-contract";

export function createLocalAppStorageMock(
  overrides: Partial<LocalAppStorage> = {},
): LocalAppStorage {
  const defaultProfile = createDefaultProfileRecord();
  const defaultOnboarding = createDefaultOnboardingRecord();

  return {
    readBootstrapState: jest.fn().mockResolvedValue({
      ...createDefaultBootstrapState(),
      hasCompletedOnboarding: true,
      profileVersion: 2,
    }),
    writeBootstrapState: jest.fn().mockResolvedValue(undefined),
    clearAllLocalData: jest.fn().mockResolvedValue(undefined),
    readProfileRecord: jest.fn().mockResolvedValue(defaultProfile),
    writeProfileRecord: jest.fn().mockResolvedValue(undefined),
    readSyncPreferencesRecord: jest
      .fn()
      .mockResolvedValue(createDefaultSyncPreferencesRecord()),
    writeSyncPreferencesRecord: jest.fn().mockResolvedValue(undefined),
    readOnboardingRecord: jest.fn().mockResolvedValue(defaultOnboarding),
    writeOnboardingRecord: jest.fn().mockResolvedValue(undefined),
    readDayLogRecord: jest
      .fn()
      .mockImplementation(async (date: string) => createEmptyDayLogRecord(date)),
    writeDayLogRecord: jest.fn().mockResolvedValue(undefined),
    deleteDayLogRecord: jest.fn().mockResolvedValue(undefined),
    listDayLogRecordsInRange: jest.fn().mockResolvedValue([]),
    readDayLogSummary: jest.fn().mockResolvedValue({
      totalEntries: 0,
      hasData: false,
      dateFrom: null,
      dateTo: null,
    }),
    listSymptomRecords: jest.fn().mockResolvedValue(createDefaultSymptomRecords()),
    writeSymptomRecord: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
