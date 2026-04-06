import type { DayLogRecord } from "./day-log";
import type { LocalDateISO, ProfileRecord } from "./profile";
import type { SymptomRecord } from "./symptom";

export const PARTNER_SHARE_SCHEMA_VERSION = 1;

export type PartnerShareAccessLevel = "summary" | "full";

export type PartnerSharedProfileRecord = Pick<
  ProfileRecord,
  | "ageGroup"
  | "cycleLength"
  | "hideNotes"
  | "hideSexChip"
  | "irregularCycle"
  | "lastPeriodStart"
  | "periodLength"
  | "temperatureUnit"
  | "trackBBT"
  | "trackCervicalMucus"
  | "unpredictableCycle"
  | "usageGoal"
>;

export type PartnerSharedProjectionPayload = {
  schemaVersion: typeof PARTNER_SHARE_SCHEMA_VERSION;
  generatedAt: string;
  accessLevel: PartnerShareAccessLevel;
  ownerAccountID: string;
  grantID: string;
  profile: PartnerSharedProfileRecord;
  dayLogs: DayLogRecord[];
  symptomRecords: SymptomRecord[];
};

export type PartnerSharedProjectionEnvelope = {
  accessLevel: PartnerShareAccessLevel;
  grantID: string;
  generatedAt: string;
  schemaVersion: number;
  checksumSHA256: string;
  ciphertextBase64: string;
  ciphertextSize: number;
};

export type PartnerSharedSummaryMetrics = {
  lastCycleLength: number;
  averageCycleLength: number;
  averagePeriodLength: number;
  totalLoggedDays: number;
  topSymptoms: string[];
};

export type PartnerSharedReadState = {
  accessLevel: PartnerShareAccessLevel;
  generatedAt: string;
  cycleStatus: {
    currentCycleDay: number | null;
    nextPeriodDate: LocalDateISO | null;
    nextPeriodWindowEndDate: LocalDateISO | null;
    nextPeriodWindowStartDate: LocalDateISO | null;
    predictionExplanation: string;
    state: "regular" | "approximate" | "facts_only" | "unknown" | "stale";
  };
  summaryMetrics: PartnerSharedSummaryMetrics;
  recentRows: {
    date: LocalDateISO;
    period: boolean;
    flow: string;
    moodRating: number;
    sexActivity: string;
    bbt: number;
    cervicalMucus: string;
    lhTest: string;
    cycleFactors: string[];
    symptomSummary: string;
    notes: string;
  }[];
};
