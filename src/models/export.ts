import type { DayLogRecord } from "./day-log";
import type {
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

export type ExportCSVRow = {
  date: LocalDateISO;
  period: boolean;
  flow: string;
  moodRating: number;
  sexActivity: string;
  bbt: number;
  cervicalMucus: string;
  cycleFactors: string[];
  symptoms: ExportSymptomFlags;
  otherSymptoms: string[];
  notes: string;
};

export type ExportBackupEnvelope = {
  app: "ovumcy";
  formatVersion: 1;
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
  cycleFactors: string[];
  symptoms: string[];
  notes: string;
};

export type ExportPDFCalendarDay = {
  date: LocalDateISO;
  isPeriod: boolean;
  hasData: boolean;
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

export type ExportPDFReport = {
  generatedAt: string;
  summary: ExportPDFSummary;
  calendarDays: ExportPDFCalendarDay[];
  cycles: ExportPDFCycle[];
  temperatureUnit: TemperatureUnit;
};
