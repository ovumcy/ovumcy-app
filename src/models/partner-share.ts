import type { DayLogRecord } from "./day-log";
import type { LocalDateISO, ProfileRecord } from "./profile";
import type { SymptomRecord } from "./symptom";

export const PARTNER_SHARE_SCHEMA_VERSION = 1;

// Lower bound of the per-grant monotonic generation counter the owner
// reserves before every projection upload. The counter starts at 0 in the
// secret store, so the first reserved value is INITIAL_GENERATION. The crypto
// layer rejects any decrypted payload below this floor and the reserve
// helper increments from it on first use.
export const INITIAL_GENERATION = 1;

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
  // Monotonic per-grant counter the owner increments on every upload.
  // Lives inside the AEAD-protected ciphertext (not the outer envelope),
  // so a malicious managed cloud cannot rewrite it without invalidating
  // the auth tag. Partner enforces non-regression on decrypt to reject
  // rollback to a previously-observed stale ciphertext.
  generation: number;
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
  // isStale is true when the snapshot is older than PARTNER_SNAPSHOT_STALE_DAYS.
  // When stale, the screen suppresses predictions and shows a notice.
  isStale: boolean;
  temperatureUnit: ProfileRecord["temperatureUnit"];
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
