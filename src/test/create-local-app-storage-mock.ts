import { createEmptyDayLogRecord } from "../models/day-log";
import { createDefaultProfileRecord } from "../models/profile";
import { createDefaultSyncPreferencesRecord } from "../sync/sync-contract";
import { createDefaultSymptomRecords } from "../models/symptom";
import { createDefaultOnboardingRecord } from "../services/onboarding-policy";
import {
  createDefaultBootstrapState,
  createDefaultManagedBillingCacheRecord,
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
      incompleteOnboardingStep: null,
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
    readManagedBillingCacheRecord: jest
      .fn()
      .mockResolvedValue(createDefaultManagedBillingCacheRecord()),
    writeManagedBillingCacheRecord: jest.fn().mockResolvedValue(undefined),
    readActivePregnancy: jest.fn().mockResolvedValue(null),
    listPregnancyRecords: jest.fn().mockResolvedValue([]),
    writePregnancyRecord: jest.fn().mockResolvedValue(undefined),
    listKickSessions: jest.fn().mockResolvedValue([]),
    writeKickSession: jest.fn().mockResolvedValue(undefined),
    deleteKickSession: jest.fn().mockResolvedValue(undefined),
    listContractionSessions: jest.fn().mockResolvedValue([]),
    writeContractionSession: jest.fn().mockResolvedValue(undefined),
    deleteContractionSession: jest.fn().mockResolvedValue(undefined),
    deleteAllPregnancyData: jest.fn().mockResolvedValue(undefined),
    readActivePostpartum: jest.fn().mockResolvedValue(null),
    listPostpartumRecords: jest.fn().mockResolvedValue([]),
    writePostpartumRecord: jest.fn().mockResolvedValue(undefined),
    deleteAllPostpartumData: jest.fn().mockResolvedValue(undefined),
    listScreeningResponses: jest.fn().mockResolvedValue([]),
    writeScreeningResponse: jest.fn().mockResolvedValue(undefined),
    deleteAllScreeningData: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
