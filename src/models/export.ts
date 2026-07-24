import type { DayLogRecord } from "./day-log";
import type {
  ContractionSession,
  KickCountSession,
  PregnancyRecord,
} from "./pregnancy";
import type { PostpartumRecord } from "./postpartum";
import type { ScreeningResponse } from "./screening";
import type {
  InterfaceLanguage,
  LocalDateISO,
  ProfileRecord,
  TemperatureUnit,
} from "./profile";
import type { SymptomRecord } from "./symptom";

export const EXPORT_PRESET_VALUES = ["all", "30", "90", "365", "custom"] as const;
export const EXPORT_FORMAT_VALUES = ["csv", "json", "pdf"] as const;

export type ExportPreset = (typeof EXPORT_PRESET_VALUES)[number];
export type ExportFormat = (typeof EXPORT_FORMAT_VALUES)[number];

export type ExportRangeValues = {
  preset: ExportPreset;
  fromDate: LocalDateISO | "";
  toDate: LocalDateISO | "";
};

export type ExportDataSummary = {
  totalEntries: number;
  hasData: boolean;
  dateFrom: LocalDateISO | null;
  dateTo: LocalDateISO | null;
};

export type ExportDateBounds = {
  minDate: LocalDateISO | null;
  maxDate: LocalDateISO | null;
};

export type ExportArtifactContent = string | Uint8Array;

export type LoadedExportState = {
  values: ExportRangeValues;
  availableSummary: ExportDataSummary;
  summary: ExportDataSummary;
  bounds: ExportDateBounds;
};

export type ExportSymptomFlags = {
  cramps: boolean;
  headache: boolean;
  acne: boolean;
  mood: boolean;
  bloating: boolean;
  fatigue: boolean;
  breastTenderness: boolean;
  backPain: boolean;
  nausea: boolean;
  spotting: boolean;
  irritability: boolean;
  insomnia: boolean;
  foodCravings: boolean;
  diarrhea: boolean;
  constipation: boolean;
};

// Pregnancy-mode fields. weightKg/bpSystolic/bpDiastolic are per-day
// metrics already carried on DayLogRecord -- blank when absent, mirroring
// moodRating/bbt's existing "0 renders blank" convention. kickCount is the SUM
// of that date's kick-count sessions (0/none renders blank the same way).
// Contraction sessions are deliberately NOT represented as a CSV column: they
// are datetime-grained (multiple timestamped contractions per session, not
// one value per day) and do not fit this file's one-row-per-day shape: they
// export only in the JSON backup (ExportBackupEnvelope.contractionSessions).
// Postpartum records (episodic recovery episodes) and screening responses
// (a 10-item answer vector + derived score) are the same shape mismatch, so
// they too stay JSON-only (postpartumRecords / screeningResponses) with no CSV
// column -- the screening answer vector in particular is the most sensitive
// class and never belongs in a flat spreadsheet cell.
export type ExportCSVRow = {
  date: LocalDateISO;
  period: boolean;
  flow: string;
  moodRating: number;
  sexActivity: string;
  bbt: number;
  cervicalMucus: string;
  lhTest: string;
  cycleFactors: string[];
  symptoms: ExportSymptomFlags;
  otherSymptoms: string[];
  notes: string;
  pregnancyTest: string;
  cycleStart: boolean;
  isUncertain: boolean;
  weightKg: number;
  bpSystolic: number;
  bpDiastolic: number;
  kickCount: number;
};

export type ExportBackupEnvelope = {
  app: "ovumcy";
  // 1: original shape (profile/symptoms/dayLogs only). 2: adds the optional
  // pregnancy-mode collections. 3: adds the optional postpartum + screening
  // collections below. A v1/v2 object (the newer keys absent) stays
  // structurally valid so old backups keep parsing unchanged.
  formatVersion: 1 | 2 | 3;
  exportedAt: string;
  preset: ExportPreset;
  range: {
    fromDate: LocalDateISO | null;
    toDate: LocalDateISO | null;
  };
  summary: ExportDataSummary;
  profile: ProfileRecord;
  symptoms: SymptomRecord[];
  dayLogs: DayLogRecord[];
  // Pregnancy-mode collections (v2+). The export path always writes all
  // three (possibly empty arrays) at formatVersion 2+; they stay optional on
  // the type only so a v1-shaped object (parsed from an old backup) remains
  // assignable without fabricating empty arrays that were never on disk.
  pregnancies?: PregnancyRecord[];
  kickSessions?: KickCountSession[];
  contractionSessions?: ContractionSession[];
  // Postpartum + EPDS mood-screening collections (v3+). The export path
  // always writes both (possibly empty arrays) at formatVersion 3; optional on
  // the type for the same reason as the pregnancy collections above — a v1/v2
  // object stays assignable without inventing keys that were never on disk.
  // Screening responses are the most sensitive class in the product; they live
  // in the JSON backup only (never a CSV column) and never in an export
  // filename or log. postpartumRecords are episodic and therefore un-ranged
  // (like pregnancies); screeningResponses are ranged by completion date (like
  // sessions) — see export-service.buildJSONArtifact.
  postpartumRecords?: PostpartumRecord[];
  screeningResponses?: ScreeningResponse[];
};

export type ExportPDFCycleDay = {
  date: LocalDateISO;
  cycleDay: number;
  isPeriod: boolean;
  flow: string;
  moodRating: number;
  sexActivity: string;
  bbt: number;
  cervicalMucus: string;
  lhTest: string;
  cycleFactors: string[];
  symptoms: string[];
  notes: string;
};

export type ExportPDFCalendarDay = {
  date: LocalDateISO;
  isPeriod: boolean;
  hasData: boolean;
  isFertile: boolean;
  isOvulation: boolean;
  isTentativeOvulation: boolean;
};

export type ExportPDFCycle = {
  startDate: LocalDateISO;
  endDate: LocalDateISO;
  cycleLength: number;
  periodLength: number;
  entries: ExportPDFCycleDay[];
};

export type ExportPDFSummary = {
  loggedDays: number;
  completedCycles: number;
  averageCycleLength: number;
  averagePeriodLength: number;
  averageMood: number;
  hasAverageMood: boolean;
  rangeStart: LocalDateISO | "";
  rangeEnd: LocalDateISO | "";
};

export type ExportPDFAdvancedFertilityItem = {
  key: string;
  title: string;
  value: string;
  description: string;
};

export type ExportPDFExtendedReportRow = {
  startDate: LocalDateISO;
  cycleLength: number;
  periodLength: number;
  comparison: "longer" | "shorter" | "variable";
};

export type ExportPDFShortLutealWarning = {
  averageDays: number;
  observationCount: number;
};

export type ExportPDFPregnancyTest = {
  date: LocalDateISO;
  result: "negative" | "positive";
};

export type ExportPDFReport = {
  generatedAt: string;
  language: InterfaceLanguage;
  summary: ExportPDFSummary;
  calendarDays: ExportPDFCalendarDay[];
  cycles: ExportPDFCycle[];
  temperatureUnit: TemperatureUnit;
  advancedFertility: ExportPDFAdvancedFertilityItem[];
  extendedReportRows: ExportPDFExtendedReportRow[];
  shortLutealWarning: ExportPDFShortLutealWarning | null;
  pregnancyTests: ExportPDFPregnancyTest[];
  // Non-null only while the shared projection reports an active pause, so the
  // report never re-derives the pregnancy rule on its own.
  pregnancyPauseDate: LocalDateISO | null;
};
