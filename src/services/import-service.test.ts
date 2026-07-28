import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import type {
  ContractionSession,
  KickCountSession,
  PregnancyRecord,
} from "../models/pregnancy";
import type { PostpartumRecord } from "../models/postpartum";
import type { ScreeningResponse } from "../models/screening";
import {
  createDefaultProfileRecord,
  type ProfileRecord,
} from "../models/profile";
import { createDefaultSymptomRecords, type SymptomRecord } from "../models/symptom";
import { createLocalAppStorageMock } from "../test/create-local-app-storage-mock";
import type { ExportBackupEnvelope } from "../models/export";
import type { LocalAppStorage } from "../storage/local/storage-contract";
import {
  importBackupEnvelope,
  parseImportEnvelope,
  previewImportBackupEnvelope,
  restoreFromJSONBackup,
} from "./import-service";
import { createCustomSymptomRecord, filterKnownSymptomIDs } from "./symptom-policy";

// A stateful in-memory storage so writes are observable through reads, letting
// the merge/skip semantics be asserted round-trip.
function createStatefulStorage(
  initialProfile: ProfileRecord = createDefaultProfileRecord(),
): {
  storage: LocalAppStorage;
  dayLogs: Map<string, DayLogRecord>;
  symptoms: SymptomRecord[];
  pregnancies: Map<string, PregnancyRecord>;
  kickSessions: Map<string, KickCountSession>;
  contractionSessions: Map<string, ContractionSession>;
  postpartumRecords: Map<string, PostpartumRecord>;
  screeningResponses: Map<string, ScreeningResponse>;
  getProfile: () => ProfileRecord;
} {
  const dayLogs = new Map<string, DayLogRecord>();
  const symptoms: SymptomRecord[] = createDefaultSymptomRecords();
  const pregnancies = new Map<string, PregnancyRecord>();
  const kickSessions = new Map<string, KickCountSession>();
  const contractionSessions = new Map<string, ContractionSession>();
  const postpartumRecords = new Map<string, PostpartumRecord>();
  const screeningResponses = new Map<string, ScreeningResponse>();
  let profile: ProfileRecord = initialProfile;

  const storage = createLocalAppStorageMock({
    readDayLogRecord: jest.fn(async (date: string) =>
      dayLogs.get(date) ?? createEmptyDayLogRecord(date),
    ),
    writeDayLogRecord: jest.fn(async (record: DayLogRecord) => {
      dayLogs.set(record.date, record);
    }),
    listSymptomRecords: jest.fn(async () => symptoms),
    writeSymptomRecord: jest.fn(async (record: SymptomRecord) => {
      symptoms.push(record);
    }),
    readProfileRecord: jest.fn(async () => profile),
    writeProfileRecord: jest.fn(async (record: ProfileRecord) => {
      profile = record;
    }),
    listPregnancyRecords: jest.fn(async () => [...pregnancies.values()]),
    writePregnancyRecord: jest.fn(async (record: PregnancyRecord) => {
      pregnancies.set(record.id, record);
    }),
    listKickSessions: jest.fn(async () => [...kickSessions.values()]),
    writeKickSession: jest.fn(async (session: KickCountSession) => {
      kickSessions.set(session.id, session);
    }),
    listContractionSessions: jest.fn(async () => [...contractionSessions.values()]),
    writeContractionSession: jest.fn(async (session: ContractionSession) => {
      contractionSessions.set(session.id, session);
    }),
    listPostpartumRecords: jest.fn(async () => [...postpartumRecords.values()]),
    writePostpartumRecord: jest.fn(async (record: PostpartumRecord) => {
      postpartumRecords.set(record.id, record);
    }),
    listScreeningResponses: jest.fn(async () => [...screeningResponses.values()]),
    writeScreeningResponse: jest.fn(async (response: ScreeningResponse) => {
      screeningResponses.set(response.id, response);
    }),
  });

  return {
    storage,
    dayLogs,
    symptoms,
    pregnancies,
    kickSessions,
    contractionSessions,
    postpartumRecords,
    screeningResponses,
    getProfile: () => profile,
  };
}

function envelope(
  overrides: Partial<ExportBackupEnvelope> = {},
): ExportBackupEnvelope {
  return {
    app: "ovumcy",
    formatVersion: 1,
    exportedAt: "2026-03-18T10:00:00.000Z",
    preset: "all",
    range: { fromDate: null, toDate: null },
    summary: { totalEntries: 0, hasData: false, dateFrom: null, dateTo: null },
    profile: createDefaultProfileRecord(),
    symptoms: [],
    dayLogs: [],
    ...overrides,
  } as ExportBackupEnvelope;
}

function dayLog(date: string, overrides: Partial<DayLogRecord> = {}): DayLogRecord {
  return { ...createEmptyDayLogRecord(date), ...overrides, date };
}

function pregnancyRecord(
  overrides: Partial<PregnancyRecord> = {},
): PregnancyRecord {
  return {
    id: "pregnancy_test",
    status: "active",
    edd: "2026-10-01",
    eddBasis: "lmp",
    lmpDate: "2026-01-01",
    schedulePreset: "who2016",
    startedAt: "2026-01-01",
    endedAt: null,
    endReason: null,
    modeOfDelivery: null,
    ...overrides,
  };
}

function kickSession(overrides: Partial<KickCountSession> = {}): KickCountSession {
  return {
    id: "kick_test",
    date: "2026-03-10",
    durationMinutes: 15,
    kickCount: 10,
    ...overrides,
  };
}

function contractionSession(
  overrides: Partial<ContractionSession> = {},
): ContractionSession {
  return {
    id: "contraction_test",
    date: "2026-03-10",
    startedAt: "2026-03-10T10:00:00.000Z",
    contractions: [],
    ...overrides,
  };
}

function postpartumRecord(
  overrides: Partial<PostpartumRecord> = {},
): PostpartumRecord {
  return {
    id: "postpartum_test",
    status: "active",
    startedAt: "2026-03-01",
    modeOfDelivery: "vaginal",
    endedAt: null,
    endReason: null,
    ...overrides,
  };
}

function screeningResponse(
  overrides: Partial<ScreeningResponse> = {},
): ScreeningResponse {
  return {
    id: "screening_test",
    date: "2026-03-05",
    instrument: "epds",
    answers: [1, 0, 2, 1, 0, 1, 0, 2, 1, 0],
    score: 8,
    selfHarmFlag: false,
    ...overrides,
  };
}

describe("import-service parse", () => {
  it("rejects non-JSON as malformed", () => {
    expect(parseImportEnvelope("{not json")).toEqual({
      ok: false,
      errorCode: "malformed",
    });
  });

  it("rejects a JSON payload that is not an object", () => {
    expect(parseImportEnvelope("[]")).toEqual({
      ok: false,
      errorCode: "malformed",
    });
    expect(parseImportEnvelope("42")).toEqual({
      ok: false,
      errorCode: "malformed",
    });
  });

  it("rejects a foreign app or an unknown format version (4)", () => {
    expect(
      parseImportEnvelope(JSON.stringify({ app: "other", formatVersion: 1 })),
    ).toEqual({ ok: false, errorCode: "unrecognized_format" });
    // 4 is one past the highest known version — still fail-closed.
    expect(
      parseImportEnvelope(JSON.stringify({ app: "ovumcy", formatVersion: 4 })),
    ).toEqual({ ok: false, errorCode: "unrecognized_format" });
  });

  it("accepts formatVersion 2 and defaults missing pregnancy-mode collections", () => {
    const result = parseImportEnvelope(
      JSON.stringify({ app: "ovumcy", formatVersion: 2 }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.dayLogs).toEqual([]);
      expect(result.envelope.symptoms).toEqual([]);
      expect(result.envelope.pregnancies).toEqual([]);
      expect(result.envelope.kickSessions).toEqual([]);
      expect(result.envelope.contractionSessions).toEqual([]);
    }
  });

  it("accepts formatVersion 3 and defaults missing postpartum + screening collections", () => {
    const result = parseImportEnvelope(
      JSON.stringify({ app: "ovumcy", formatVersion: 3 }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.postpartumRecords).toEqual([]);
      expect(result.envelope.screeningResponses).toEqual([]);
    }
  });

  it("rejects an oversized postpartum or screening collection", () => {
    const hugePostpartum = {
      app: "ovumcy",
      formatVersion: 3,
      postpartumRecords: new Array(201).fill({ id: "p", status: "active" }),
    };
    expect(parseImportEnvelope(JSON.stringify(hugePostpartum))).toEqual({
      ok: false,
      errorCode: "too_large",
    });

    const hugeScreening = {
      app: "ovumcy",
      formatVersion: 3,
      screeningResponses: new Array(20001).fill({ id: "s" }),
    };
    expect(parseImportEnvelope(JSON.stringify(hugeScreening))).toEqual({
      ok: false,
      errorCode: "too_large",
    });
  });

  it("rejects an oversized payload", () => {
    const huge = {
      app: "ovumcy",
      formatVersion: 1,
      dayLogs: new Array(20001).fill({ date: "2026-01-01" }),
    };
    expect(parseImportEnvelope(JSON.stringify(huge))).toEqual({
      ok: false,
      errorCode: "too_large",
    });
  });

  it("accepts a well-formed envelope and defaults missing collections", () => {
    const result = parseImportEnvelope(
      JSON.stringify({ app: "ovumcy", formatVersion: 1 }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope.dayLogs).toEqual([]);
      expect(result.envelope.symptoms).toEqual([]);
    }
  });
});

describe("import-service apply (additive merge)", () => {
  it("imports day logs onto empty dates", async () => {
    const { storage, dayLogs } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        dayLogs: [
          dayLog("2026-03-10", { isPeriod: true, flow: "medium" }),
          dayLog("2026-03-12", { mood: 4, notes: "ok" }),
        ],
      }),
    );

    expect(outcome).toMatchObject({
      dayLogsAdded: 2,
      dayLogsSkipped: 0,
      dayLogsRejected: 0,
    });
    expect(dayLogs.get("2026-03-10")).toMatchObject({
      isPeriod: true,
      flow: "medium",
    });
    expect(dayLogs.get("2026-03-12")).toMatchObject({ mood: 4, notes: "ok" });
  });

  it("never overwrites a date that already has data", async () => {
    const { storage, dayLogs } = createStatefulStorage();
    dayLogs.set(
      "2026-03-10",
      dayLog("2026-03-10", { notes: "original, keep me" }),
    );

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        dayLogs: [dayLog("2026-03-10", { notes: "incoming, drop me" })],
      }),
    );

    expect(outcome).toMatchObject({ dayLogsAdded: 0, dayLogsSkipped: 1 });
    expect(dayLogs.get("2026-03-10")?.notes).toBe("original, keep me");
  });

  it("rejects records with an unparseable date and keeps going", async () => {
    const { storage, dayLogs } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        dayLogs: [
          dayLog("not-a-date", { notes: "bad" }),
          dayLog("2026-13-40", { notes: "also bad" }),
          dayLog("2026-03-15", { mood: 2 }),
        ],
      }),
    );

    expect(outcome).toMatchObject({ dayLogsAdded: 1, dayLogsRejected: 2 });
    expect(dayLogs.has("2026-03-15")).toBe(true);
  });

  it("collapses unknown enum values to neutral defaults rather than failing", async () => {
    const { storage, dayLogs } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        dayLogs: [
          dayLog("2026-03-16", {
            // Deliberately invalid enum values.
            flow: "torrential" as never,
            cervicalMucus: "unknown" as never,
            mood: 3,
          }),
        ],
      }),
    );

    expect(outcome).toMatchObject({ dayLogsAdded: 1 });
    const stored = dayLogs.get("2026-03-16");
    expect(stored?.cervicalMucus).toBe("none");
    // flow is only kept when isPeriod; here it stays neutral.
    expect(stored?.flow).toBe("none");
    expect(stored?.mood).toBe(3);
  });

  it("imports new custom symptoms and skips ones that already exist", async () => {
    const { storage, symptoms } = createStatefulStorage();
    const before = symptoms.length;

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        symptoms: [
          {
            id: "custom_a",
            slug: "jaw-pain",
            label: "Jaw pain",
            icon: "🔥",
            color: "#E8799F",
            isArchived: false,
            sortOrder: 900,
            isDefault: false,
          },
          {
            // Built-in: must not be duplicated.
            id: "cramps",
            slug: "cramps",
            label: "Cramps",
            icon: "🩸",
            color: "#E8799F",
            isArchived: false,
            sortOrder: 0,
            isDefault: true,
          },
        ],
      }),
    );

    expect(outcome.symptomsAdded).toBe(1);
    expect(symptoms.length).toBe(before + 1);
    expect(symptoms.some((record) => record.label === "Jaw pain")).toBe(true);
  });
});

describe("import-service custom symptom id remap", () => {
  it("remaps a day log's symptomIDs from the backup file's custom-symptom id to the newly minted local id", async () => {
    const { storage, dayLogs, symptoms } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        symptoms: [
          {
            // The id the backup file carries for this symptom. It must be
            // discarded on import (createCustomSymptomRecord always mints a
            // fresh one), so this exact string must never appear anywhere in
            // the stored day log below.
            id: "custom_file_jaw_pain",
            slug: "jaw-pain",
            label: "Jaw pain",
            icon: "🔥",
            color: "#E8799F",
            isArchived: false,
            sortOrder: 900,
            isDefault: false,
          },
        ],
        dayLogs: [
          dayLog("2026-03-10", { symptomIDs: ["custom_file_jaw_pain"] }),
        ],
      }),
    );

    expect(outcome.symptomsAdded).toBe(1);
    expect(outcome.dayLogsAdded).toBe(1);

    const mintedRecord = symptoms.find((record) => record.label === "Jaw pain");
    expect(mintedRecord).toBeDefined();
    expect(mintedRecord?.id).not.toBe("custom_file_jaw_pain");

    const storedDayLog = dayLogs.get("2026-03-10");
    expect(storedDayLog?.symptomIDs).toEqual([mintedRecord?.id]);
    expect(storedDayLog?.symptomIDs).not.toContain("custom_file_jaw_pain");

    // This is the exact check every read path (dashboard/calendar/stats) runs
    // against stored day logs -- before the fix, the stale file id failed it
    // and the mark silently disappeared everywhere.
    expect(
      filterKnownSymptomIDs(symptoms, storedDayLog?.symptomIDs ?? []),
    ).toEqual([mintedRecord?.id]);
  });

  it("maps the file's id onto the EXISTING local record's id when the label already exists on-device", async () => {
    const { storage, dayLogs, symptoms } = createStatefulStorage();
    const preExisting = createCustomSymptomRecord(symptoms, {
      label: "Jaw pain",
      icon: "🔥",
    });
    if (!preExisting.ok) {
      throw new Error("Expected the pre-existing custom symptom to be created");
    }
    symptoms.push(preExisting.record);

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        symptoms: [
          {
            // Same label, a DIFFERENT id from the pre-existing local record --
            // this is what a second device's export of the "same" custom
            // symptom looks like.
            id: "custom_file_jaw_pain_2",
            slug: "jaw-pain",
            label: "Jaw pain",
            icon: "🔥",
            color: "#E8799F",
            isArchived: false,
            sortOrder: 900,
            isDefault: false,
          },
        ],
        dayLogs: [
          dayLog("2026-03-11", { symptomIDs: ["custom_file_jaw_pain_2"] }),
        ],
      }),
    );

    // Additive-merge semantics for the symptom itself are unchanged: a
    // duplicate label is skipped, never added or overwritten.
    expect(outcome.symptomsAdded).toBe(0);
    expect(outcome.dayLogsAdded).toBe(1);

    const storedDayLog = dayLogs.get("2026-03-11");
    expect(storedDayLog?.symptomIDs).toEqual([preExisting.record.id]);
    expect(
      filterKnownSymptomIDs(symptoms, storedDayLog?.symptomIDs ?? []),
    ).toEqual([preExisting.record.id]);
  });

  // A day log carrying no symptomIDs at all -- every entry written before
  // custom symptoms existed looks like this. The remap must decline to
  // override rather than substitute an array, leaving the record on exactly
  // the sanitize path it took before this feature.
  it("imports a day log that carries no symptomIDs field at all", async () => {
    const { storage, dayLogs } = createStatefulStorage();
    const { symptomIDs: _omitted, ...withoutSymptomIDs } = dayLog(
      "2026-03-12",
      { isPeriod: true },
    );

    const outcome = await importBackupEnvelope(
      storage,
      envelope({ dayLogs: [withoutSymptomIDs as DayLogRecord] }),
    );

    expect(outcome.dayLogsAdded).toBe(1);
    expect(outcome.dayLogsRejected).toBe(0);

    const storedDayLog = dayLogs.get("2026-03-12");
    expect(storedDayLog?.isPeriod).toBe(true);
    expect(storedDayLog?.symptomIDs).toEqual([]);
  });

  // Ids the map has nothing to say about pass through untouched: a built-in
  // id is a stable constant every install shares, so it already resolves.
  // Only the file's own custom ids are rewritten.
  it("leaves a built-in symptom id untouched when the file's custom symptom carries no id", async () => {
    const { storage, dayLogs, symptoms } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        symptoms: [
          {
            // No id at all -- an older export, or a hand-edited file.
            slug: "jaw-pain",
            label: "Jaw pain",
            icon: "🔥",
            color: "#E8799F",
            isArchived: false,
            sortOrder: 900,
            isDefault: false,
          } as unknown as SymptomRecord,
        ],
        dayLogs: [
          dayLog("2026-03-13", { symptomIDs: ["cramps"] }),
        ],
      }),
    );

    expect(outcome.symptomsAdded).toBe(1);
    expect(outcome.dayLogsAdded).toBe(1);

    // The symptom still imports; it simply cannot be referenced by id from
    // this file, because the file never gave it one.
    expect(symptoms.some((record) => record.label === "Jaw pain")).toBe(true);

    const storedDayLog = dayLogs.get("2026-03-13");
    expect(storedDayLog?.symptomIDs).toEqual(["cramps"]);
  });

  it("drops a symptom that fails validation for a reason other than a duplicate label", async () => {
    const { storage, symptoms } = createStatefulStorage();
    const before = symptoms.length;

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        symptoms: [
          {
            id: "custom_file_blank",
            slug: "blank",
            label: "   ",
            icon: "🔥",
            color: "#E8799F",
            isArchived: false,
            sortOrder: 900,
            isDefault: false,
          },
        ],
      }),
    );

    expect(outcome.symptomsAdded).toBe(0);
    expect(symptoms.length).toBe(before);
  });

  // Built-in labels are reserved in EVERY locale, while the seeded records
  // carry the English ones. A backup from a Russian-locale device therefore
  // collides with a built-in without any local record matching by label --
  // the symptom is skipped and, having nothing to point at, its id is left
  // unmapped rather than guessed.
  it("skips a symptom colliding with a built-in label from another locale without mapping its id", async () => {
    const { storage, dayLogs, symptoms } = createStatefulStorage();
    const before = symptoms.length;

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        symptoms: [
          {
            id: "custom_file_headache_ru",
            slug: "golovnaya-bol",
            label: "Головная боль",
            icon: "🤕",
            color: "#E8799F",
            isArchived: false,
            sortOrder: 900,
            isDefault: false,
          },
        ],
        dayLogs: [
          dayLog("2026-03-14", { symptomIDs: ["custom_file_headache_ru"] }),
        ],
      }),
    );

    expect(outcome.symptomsAdded).toBe(0);
    expect(symptoms.length).toBe(before);

    const storedDayLog = dayLogs.get("2026-03-14");
    expect(storedDayLog?.symptomIDs).toEqual(["custom_file_headache_ru"]);
    // Unmapped and unknown, so it is hidden on read exactly as it always was.
    expect(
      filterKnownSymptomIDs(symptoms, storedDayLog?.symptomIDs ?? []),
    ).toEqual([]);
  });
});

describe("import-service profile restore (pristine-only)", () => {
  function backupProfile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
    return {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-03-01",
      cycleLength: 31,
      periodLength: 6,
      trackBBT: true,
      ...overrides,
    };
  }

  it("restores the backup profile on a fresh install (pristine defaults)", async () => {
    const { storage, getProfile } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({ profile: backupProfile() }),
    );

    expect(outcome.profileRestored).toBe(true);
    expect(getProfile()).toMatchObject({
      lastPeriodStart: "2026-03-01",
      cycleLength: 31,
      periodLength: 6,
      trackBBT: true,
    });
  });

  it("never touches the profile on a configured device", async () => {
    const configured = {
      ...createDefaultProfileRecord(),
      lastPeriodStart: "2026-02-14",
      cycleLength: 27,
    };
    const { storage, getProfile } = createStatefulStorage(configured);

    const outcome = await importBackupEnvelope(
      storage,
      envelope({ profile: backupProfile() }),
    );

    expect(outcome.profileRestored).toBe(false);
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
    expect(getProfile()).toEqual(configured);
  });

  it("treats any single non-default field — even a language override — as configured", async () => {
    const { storage } = createStatefulStorage({
      ...createDefaultProfileRecord(),
      languageOverride: "it",
    });

    const outcome = await importBackupEnvelope(
      storage,
      envelope({ profile: backupProfile() }),
    );

    expect(outcome.profileRestored).toBe(false);
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
  });

  it("round-trips the crisis-support contact, trimming + capping it via the profile policy", async () => {
    const { storage, getProfile } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        profile: backupProfile({
          crisisContactName: "  Mum  ",
          crisisContactPhone: "07700 900000",
        }),
      }),
    );

    expect(outcome.profileRestored).toBe(true);
    expect(getProfile()).toMatchObject({
      // Trimmed by normalizeCrisisContactName in the policy layer.
      crisisContactName: "Mum",
      crisisContactPhone: "07700 900000",
    });
  });

  it("tolerates a backup that predates the crisis fields (absent → \"\")", async () => {
    const { storage, getProfile } = createStatefulStorage();
    // A v1 backup with no crisis keys at all still restores; the fields land on
    // the "" default via the normalizer's non-string guard.
    const legacy = envelope({ profile: backupProfile() });
    delete (legacy.profile as Record<string, unknown>).crisisContactName;
    delete (legacy.profile as Record<string, unknown>).crisisContactPhone;

    const outcome = await importBackupEnvelope(storage, legacy);

    expect(outcome.profileRestored).toBe(true);
    expect(getProfile()).toMatchObject({
      crisisContactName: "",
      crisisContactPhone: "",
    });
  });

  it("drops a managed reminder-email preference an older backup still carries", async () => {
    // Transition tolerance: reminder emails were a managed-cloud delivery
    // channel and the profile flag went with them. A backup written before the
    // removal still carries `managedReminderEmailsEnabled`; it must restore
    // like any other legacy backup, with the unknown field simply dropped
    // rather than smuggled back into the stored profile.
    const { storage, getProfile } = createStatefulStorage();
    const legacy = envelope({ profile: backupProfile() });
    (legacy.profile as unknown as Record<string, unknown>).managedReminderEmailsEnabled =
      true;

    const outcome = await importBackupEnvelope(storage, legacy);

    expect(outcome.profileRestored).toBe(true);
    expect(getProfile()).toMatchObject({
      lastPeriodStart: "2026-03-01",
      cycleLength: 31,
    });
    expect(getProfile()).not.toHaveProperty("managedReminderEmailsEnabled");
  });

  it("counts a crisis-contact-only backup as non-default, and never clobbers a device that already has one", async () => {
    // A crisis contact alone is a non-default field (it is enumerated by the
    // pristine comparison), so it restores onto a fresh device.
    const fresh = createStatefulStorage();
    const restored = await importBackupEnvelope(
      fresh.storage,
      envelope({
        profile: {
          ...createDefaultProfileRecord(),
          crisisContactName: "Mum",
          crisisContactPhone: "0123",
        },
      }),
    );
    expect(restored.profileRestored).toBe(true);
    expect(fresh.getProfile()).toMatchObject({
      crisisContactName: "Mum",
      crisisContactPhone: "0123",
    });

    // Conversely, a device that already has a crisis contact set is "configured"
    // — an import must never overwrite the owner's safety data.
    const configured = createStatefulStorage({
      ...createDefaultProfileRecord(),
      crisisContactName: "My person",
      crisisContactPhone: "0999",
    });
    const blocked = await importBackupEnvelope(
      configured.storage,
      envelope({ profile: backupProfile() }),
    );
    expect(blocked.profileRestored).toBe(false);
    expect(configured.storage.writeProfileRecord).not.toHaveBeenCalled();
  });

  it("collapses invalid backup profile values to safe defaults instead of failing", async () => {
    const { storage, getProfile } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        profile: {
          ...backupProfile(),
          cycleLength: 9000,
          periodLength: -3,
          lastPeriodStart: "not-a-date",
          temperatureUnit: "kelvin",
          languageOverride: "xx",
          reminderTime: "99:99",
        } as unknown as ProfileRecord,
      }),
    );

    expect(outcome.profileRestored).toBe(true);
    expect(getProfile()).toMatchObject({
      cycleLength: 90,
      periodLength: 1,
      lastPeriodStart: null,
      temperatureUnit: "c",
      languageOverride: null,
      reminderTime: "20:00",
    });
  });

  it("does not report a restore when the backup profile is missing or not an object", async () => {
    const { storage } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({ profile: undefined as unknown as ProfileRecord }),
    );

    expect(outcome.profileRestored).toBe(false);
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
  });

  it("does not report a restore when the backup profile only carries defaults", async () => {
    const { storage } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({ profile: createDefaultProfileRecord() }),
    );

    expect(outcome.profileRestored).toBe(false);
    expect(storage.writeProfileRecord).not.toHaveBeenCalled();
  });
});

describe("previewImportBackupEnvelope (dry-run)", () => {
  it("computes the same counts as the apply without writing anything", async () => {
    const seededEnvelope = envelope({
      profile: {
        ...createDefaultProfileRecord(),
        lastPeriodStart: "2026-03-01",
      },
      dayLogs: [
        dayLog("2026-03-10", { isPeriod: true, flow: "medium" }),
        dayLog("2026-03-11", { mood: 3 }),
        dayLog("not-a-date", { notes: "bad" }),
      ],
      symptoms: [
        {
          id: "custom_a",
          slug: "jaw-pain",
          label: "Jaw pain",
          icon: "🔥",
          color: "#E8799F",
          isArchived: false,
          sortOrder: 900,
          isDefault: false,
        },
      ],
    });

    const previewSide = createStatefulStorage();
    previewSide.dayLogs.set(
      "2026-03-11",
      dayLog("2026-03-11", { notes: "already here" }),
    );
    const preview = await previewImportBackupEnvelope(
      previewSide.storage,
      seededEnvelope,
    );

    expect(previewSide.storage.writeDayLogRecord).not.toHaveBeenCalled();
    expect(previewSide.storage.writeSymptomRecord).not.toHaveBeenCalled();
    expect(previewSide.storage.writeProfileRecord).not.toHaveBeenCalled();
    expect(previewSide.dayLogs.has("2026-03-10")).toBe(false);

    const applySide = createStatefulStorage();
    applySide.dayLogs.set(
      "2026-03-11",
      dayLog("2026-03-11", { notes: "already here" }),
    );
    const applied = await importBackupEnvelope(applySide.storage, seededEnvelope);

    expect(preview).toEqual(applied);
    expect(preview).toEqual({
      dayLogsAdded: 1,
      dayLogsSkipped: 1,
      dayLogsRejected: 1,
      symptomsAdded: 1,
      profileRestored: true,
      pregnanciesAdded: 0,
      pregnanciesSkipped: 0,
      kickSessionsAdded: 0,
      kickSessionsSkipped: 0,
      contractionSessionsAdded: 0,
      contractionSessionsSkipped: 0,
      postpartumRecordsAdded: 0,
      postpartumRecordsSkipped: 0,
      screeningResponsesAdded: 0,
      screeningResponsesSkipped: 0,
    });
  });
});

describe("import-service v1 compatibility", () => {
  it("imports a v1 file exactly as before: no pregnancy-mode keys touched, all new counts stay zero", async () => {
    const { storage, dayLogs } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 1,
        dayLogs: [dayLog("2026-03-10", { mood: 3 })],
      }),
    );

    expect(outcome).toEqual({
      dayLogsAdded: 1,
      dayLogsSkipped: 0,
      dayLogsRejected: 0,
      symptomsAdded: 0,
      profileRestored: false,
      pregnanciesAdded: 0,
      pregnanciesSkipped: 0,
      kickSessionsAdded: 0,
      kickSessionsSkipped: 0,
      contractionSessionsAdded: 0,
      contractionSessionsSkipped: 0,
      postpartumRecordsAdded: 0,
      postpartumRecordsSkipped: 0,
      screeningResponsesAdded: 0,
      screeningResponsesSkipped: 0,
    });
    expect(dayLogs.has("2026-03-10")).toBe(true);
    // A v1 file never carries pregnancy-mode keys, so the pregnancy repos are
    // not read or written at all -- not just "read and found empty".
    expect(storage.listPregnancyRecords).not.toHaveBeenCalled();
    expect(storage.listKickSessions).not.toHaveBeenCalled();
    expect(storage.listContractionSessions).not.toHaveBeenCalled();
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
    expect(storage.writeKickSession).not.toHaveBeenCalled();
    expect(storage.writeContractionSession).not.toHaveBeenCalled();
    // Likewise the postpartum/screening repos are untouched by a v1 file.
    expect(storage.listPostpartumRecords).not.toHaveBeenCalled();
    expect(storage.listScreeningResponses).not.toHaveBeenCalled();
    expect(storage.writePostpartumRecord).not.toHaveBeenCalled();
    expect(storage.writeScreeningResponse).not.toHaveBeenCalled();
  });
});

describe("import-service apply (pregnancy-mode collections, v2)", () => {
  it("imports pregnancy records, kick sessions, and contraction sessions additively onto a fresh install", async () => {
    const { storage, pregnancies, kickSessions, contractionSessions } =
      createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 2,
        pregnancies: [pregnancyRecord({ id: "p1", status: "active" })],
        kickSessions: [kickSession({ id: "k1", kickCount: 7 })],
        contractionSessions: [contractionSession({ id: "c1" })],
      }),
    );

    expect(outcome).toMatchObject({
      pregnanciesAdded: 1,
      pregnanciesSkipped: 0,
      kickSessionsAdded: 1,
      kickSessionsSkipped: 0,
      contractionSessionsAdded: 1,
      contractionSessionsSkipped: 0,
    });
    expect(pregnancies.get("p1")).toMatchObject({ id: "p1", status: "active" });
    expect(kickSessions.get("k1")).toMatchObject({ id: "k1", kickCount: 7 });
    expect(contractionSessions.get("c1")).toMatchObject({ id: "c1" });
  });

  it("never overwrites a pregnancy record, kick session, or contraction session whose id already exists on-device", async () => {
    const { storage, pregnancies, kickSessions, contractionSessions } =
      createStatefulStorage();
    pregnancies.set(
      "p1",
      pregnancyRecord({ id: "p1", status: "ended", endedAt: "2025-06-01" }),
    );
    kickSessions.set("k1", kickSession({ id: "k1", kickCount: 5 }));
    contractionSessions.set("c1", contractionSession({ id: "c1" }));

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 2,
        // Same ids, different payloads -- if additivity broke, these would
        // clobber the existing records.
        pregnancies: [pregnancyRecord({ id: "p1", status: "active" })],
        kickSessions: [kickSession({ id: "k1", kickCount: 99 })],
        contractionSessions: [contractionSession({ id: "c1", startedAt: "2026-03-10T23:00:00.000Z" })],
      }),
    );

    expect(outcome).toMatchObject({
      pregnanciesAdded: 0,
      pregnanciesSkipped: 1,
      kickSessionsAdded: 0,
      kickSessionsSkipped: 1,
      contractionSessionsAdded: 0,
      contractionSessionsSkipped: 1,
    });
    expect(pregnancies.get("p1")?.status).toBe("ended");
    expect(kickSessions.get("k1")?.kickCount).toBe(5);
    expect(contractionSessions.get("c1")?.startedAt).toBe("2026-03-10T10:00:00.000Z");
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
    expect(storage.writeKickSession).not.toHaveBeenCalled();
    expect(storage.writeContractionSession).not.toHaveBeenCalled();
  });

  it("skips an imported active pregnancy record when the device already has a DIFFERENT active record (never overwrites, never ends, never throws)", async () => {
    const { storage, pregnancies } = createStatefulStorage();
    pregnancies.set(
      "device-active",
      pregnancyRecord({ id: "device-active", status: "active" }),
    );

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 2,
        pregnancies: [pregnancyRecord({ id: "incoming-active", status: "active" })],
      }),
    );

    expect(outcome).toMatchObject({ pregnanciesAdded: 0, pregnanciesSkipped: 1 });
    expect(pregnancies.has("incoming-active")).toBe(false);
    expect(pregnancies.get("device-active")).toMatchObject({
      id: "device-active",
      status: "active",
    });
  });

  it("orders pregnancy-record imports ended-before-active so an ended+active pair from the same file both apply deterministically", async () => {
    const { storage, pregnancies } = createStatefulStorage();

    // Active listed first in the file; the ended record must still apply
    // (it never conflicts) and the active one must still win (nothing else
    // is active yet, on-device or earlier in this batch).
    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 2,
        pregnancies: [
          pregnancyRecord({ id: "new-active", status: "active" }),
          pregnancyRecord({ id: "old-ended", status: "ended", endedAt: "2025-06-01" }),
        ],
      }),
    );

    expect(outcome).toMatchObject({ pregnanciesAdded: 2, pregnanciesSkipped: 0 });
    expect(pregnancies.get("new-active")?.status).toBe("active");
    expect(pregnancies.get("old-ended")?.status).toBe("ended");
  });

  it("skips the second of two active pregnancy records in the same file, keeping the first", async () => {
    const { storage, pregnancies } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 2,
        pregnancies: [
          pregnancyRecord({ id: "first-active", status: "active" }),
          pregnancyRecord({ id: "second-active", status: "active" }),
        ],
      }),
    );

    expect(outcome).toMatchObject({ pregnanciesAdded: 1, pregnanciesSkipped: 1 });
    expect(pregnancies.has("first-active")).toBe(true);
    expect(pregnancies.has("second-active")).toBe(false);
  });

  it("counts a malformed pregnancy record, kick session, and contraction session as skipped without aborting the rest of the import", async () => {
    const { storage, pregnancies, kickSessions, contractionSessions } =
      createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 2,
        pregnancies: [
          { status: "active" } as unknown as PregnancyRecord, // missing id
          pregnancyRecord({ id: "valid-pregnancy" }),
        ],
        kickSessions: [
          { id: "bad-kick", date: "not-a-date" } as unknown as KickCountSession,
          kickSession({ id: "valid-kick" }),
        ],
        contractionSessions: [
          { id: "bad-contraction" } as unknown as ContractionSession, // missing date/startedAt
          contractionSession({ id: "valid-contraction" }),
        ],
      }),
    );

    expect(outcome).toMatchObject({
      pregnanciesAdded: 1,
      pregnanciesSkipped: 1,
      kickSessionsAdded: 1,
      kickSessionsSkipped: 1,
      contractionSessionsAdded: 1,
      contractionSessionsSkipped: 1,
    });
    expect(pregnancies.has("valid-pregnancy")).toBe(true);
    expect(kickSessions.has("valid-kick")).toBe(true);
    expect(contractionSessions.has("valid-contraction")).toBe(true);
  });

  it("restores pregnancies, kick sessions, and contraction sessions from a v2 JSON backup string on a fresh install (export -> import round trip)", async () => {
    const { storage, pregnancies, kickSessions, contractionSessions } =
      createStatefulStorage();

    const rawJson = JSON.stringify(
      envelope({
        formatVersion: 2,
        pregnancies: [
          pregnancyRecord({ id: "p1", status: "ended", endedAt: "2025-06-01", endReason: "birth" }),
        ],
        kickSessions: [kickSession({ id: "k1", date: "2026-03-05", kickCount: 12 })],
        contractionSessions: [
          contractionSession({
            id: "c1",
            date: "2026-01-01",
            // The entry's startedAt must fall within [session startedAt,
            // +24h) or sanitizeContractionSession's bounds check drops it.
            startedAt: "2026-01-01T10:00:00.000Z",
            contractions: [{ startedAt: "2026-01-01T10:05:00.000Z", durationSeconds: 45 }],
          }),
        ],
      }),
    );

    const result = await restoreFromJSONBackup(storage, rawJson);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome).toMatchObject({
        pregnanciesAdded: 1,
        kickSessionsAdded: 1,
        contractionSessionsAdded: 1,
      });
    }
    expect(pregnancies.get("p1")).toMatchObject({
      id: "p1",
      status: "ended",
      endReason: "birth",
    });
    expect(kickSessions.get("k1")).toMatchObject({ id: "k1", kickCount: 12 });
    expect(contractionSessions.get("c1")?.contractions).toEqual([
      { startedAt: "2026-01-01T10:05:00.000Z", durationSeconds: 45 },
    ]);
  });
});

describe("import-service apply (postpartum + screening collections, v3)", () => {
  it("imports postpartum records and screening responses additively onto a fresh install", async () => {
    const { storage, postpartumRecords, screeningResponses } =
      createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 3,
        postpartumRecords: [postpartumRecord({ id: "pp1", status: "active" })],
        screeningResponses: [screeningResponse({ id: "sc1" })],
      }),
    );

    expect(outcome).toMatchObject({
      postpartumRecordsAdded: 1,
      postpartumRecordsSkipped: 0,
      screeningResponsesAdded: 1,
      screeningResponsesSkipped: 0,
    });
    expect(postpartumRecords.get("pp1")).toMatchObject({
      id: "pp1",
      status: "active",
    });
    expect(screeningResponses.get("sc1")).toMatchObject({ id: "sc1", score: 8 });
  });

  it("never overwrites a postpartum record or screening response whose id already exists on-device", async () => {
    const { storage, postpartumRecords, screeningResponses } =
      createStatefulStorage();
    postpartumRecords.set(
      "pp1",
      postpartumRecord({ id: "pp1", status: "ended", endedAt: "2025-06-01", endReason: "manual" }),
    );
    screeningResponses.set("sc1", screeningResponse({ id: "sc1", answers: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], score: 0 }));

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 3,
        // Same ids, different payloads -- additivity must keep the existing rows.
        postpartumRecords: [postpartumRecord({ id: "pp1", status: "active" })],
        screeningResponses: [screeningResponse({ id: "sc1" })],
      }),
    );

    expect(outcome).toMatchObject({
      postpartumRecordsAdded: 0,
      postpartumRecordsSkipped: 1,
      screeningResponsesAdded: 0,
      screeningResponsesSkipped: 1,
    });
    expect(postpartumRecords.get("pp1")?.status).toBe("ended");
    expect(screeningResponses.get("sc1")?.score).toBe(0);
    expect(storage.writePostpartumRecord).not.toHaveBeenCalled();
    expect(storage.writeScreeningResponse).not.toHaveBeenCalled();
  });

  it("skips an imported active postpartum record when the device already has a DIFFERENT active record (never overwrites, never ends, never throws)", async () => {
    const { storage, postpartumRecords } = createStatefulStorage();
    postpartumRecords.set(
      "device-active",
      postpartumRecord({ id: "device-active", status: "active" }),
    );

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 3,
        postpartumRecords: [postpartumRecord({ id: "incoming-active", status: "active" })],
      }),
    );

    expect(outcome).toMatchObject({
      postpartumRecordsAdded: 0,
      postpartumRecordsSkipped: 1,
    });
    expect(postpartumRecords.has("incoming-active")).toBe(false);
    expect(postpartumRecords.get("device-active")).toMatchObject({
      id: "device-active",
      status: "active",
    });
  });

  it("orders postpartum imports ended-before-active so an ended+active pair from the same file both apply deterministically", async () => {
    const { storage, postpartumRecords } = createStatefulStorage();

    // Active listed first in the file; the ended record must still apply and
    // the active one must still win (nothing else is active yet).
    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 3,
        postpartumRecords: [
          postpartumRecord({ id: "new-active", status: "active" }),
          postpartumRecord({ id: "old-ended", status: "ended", endedAt: "2025-06-01", endReason: "cycle_returned" }),
        ],
      }),
    );

    expect(outcome).toMatchObject({
      postpartumRecordsAdded: 2,
      postpartumRecordsSkipped: 0,
    });
    expect(postpartumRecords.get("new-active")?.status).toBe("active");
    expect(postpartumRecords.get("old-ended")?.status).toBe("ended");
  });

  it("skips the second of two active postpartum records in the same file, keeping the first", async () => {
    const { storage, postpartumRecords } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 3,
        postpartumRecords: [
          postpartumRecord({ id: "first-active", status: "active" }),
          postpartumRecord({ id: "second-active", status: "active" }),
        ],
      }),
    );

    expect(outcome).toMatchObject({
      postpartumRecordsAdded: 1,
      postpartumRecordsSkipped: 1,
    });
    expect(postpartumRecords.has("first-active")).toBe(true);
    expect(postpartumRecords.has("second-active")).toBe(false);
  });

  it("recomputes an imported screening's score + selfHarmFlag from its answers (a drifted stored score is corrected, never trusted)", async () => {
    const { storage, screeningResponses } = createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 3,
        screeningResponses: [
          screeningResponse({
            id: "drifted",
            // Item 10 (self-harm) is non-zero, and the true sum is 4, but the
            // stored score/flag disagree -- the sanitizer must correct both.
            answers: [1, 0, 0, 0, 0, 0, 0, 0, 0, 3],
            score: 99,
            selfHarmFlag: false,
          }),
        ],
      }),
    );

    expect(outcome).toMatchObject({ screeningResponsesAdded: 1 });
    expect(screeningResponses.get("drifted")).toMatchObject({
      score: 4,
      selfHarmFlag: true,
    });
  });

  it("counts a malformed postpartum record and screening response as skipped without aborting the rest", async () => {
    const { storage, postpartumRecords, screeningResponses } =
      createStatefulStorage();

    const outcome = await importBackupEnvelope(
      storage,
      envelope({
        formatVersion: 3,
        postpartumRecords: [
          { status: "active" } as unknown as PostpartumRecord, // missing id
          postpartumRecord({ id: "valid-postpartum" }),
        ],
        screeningResponses: [
          // Wrong answer-vector length → rejected by sanitizeScreeningResponse.
          { id: "bad-screening", date: "2026-03-05", instrument: "epds", answers: [1, 2, 3] } as unknown as ScreeningResponse,
          screeningResponse({ id: "valid-screening" }),
        ],
      }),
    );

    expect(outcome).toMatchObject({
      postpartumRecordsAdded: 1,
      postpartumRecordsSkipped: 1,
      screeningResponsesAdded: 1,
      screeningResponsesSkipped: 1,
    });
    expect(postpartumRecords.has("valid-postpartum")).toBe(true);
    expect(screeningResponses.has("valid-screening")).toBe(true);
  });

  it("restores postpartum records and screening responses from a v3 JSON backup string on a fresh install (export -> import round trip)", async () => {
    const { storage, postpartumRecords, screeningResponses } =
      createStatefulStorage();

    const rawJson = JSON.stringify(
      envelope({
        formatVersion: 3,
        postpartumRecords: [
          postpartumRecord({ id: "pp1", status: "ended", endedAt: "2025-06-01", endReason: "manual" }),
        ],
        screeningResponses: [screeningResponse({ id: "sc1", date: "2026-02-20" })],
      }),
    );

    const result = await restoreFromJSONBackup(storage, rawJson);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome).toMatchObject({
        postpartumRecordsAdded: 1,
        screeningResponsesAdded: 1,
      });
    }
    expect(postpartumRecords.get("pp1")).toMatchObject({
      id: "pp1",
      status: "ended",
      endReason: "manual",
    });
    expect(screeningResponses.get("sc1")).toMatchObject({ id: "sc1", score: 8 });
  });
});

describe("restoreFromJSONBackup orchestration", () => {
  it("parses then applies in one call", async () => {
    const { storage, dayLogs } = createStatefulStorage();
    const raw = JSON.stringify(
      envelope({ dayLogs: [dayLog("2026-03-20", { mood: 5 })] }),
    );

    const result = await restoreFromJSONBackup(storage, raw);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outcome.dayLogsAdded).toBe(1);
    }
    expect(dayLogs.has("2026-03-20")).toBe(true);
  });

  it("surfaces a parse error without touching storage", async () => {
    const { storage, dayLogs } = createStatefulStorage();

    const result = await restoreFromJSONBackup(storage, "{broken");

    expect(result).toEqual({ ok: false, errorCode: "malformed" });
    expect(dayLogs.size).toBe(0);
  });
});

describe("previewImportBackupEnvelope (dry-run, v3 collections)", () => {
  it("counts every new collection without writing any of them", async () => {
    const { storage } = createStatefulStorage();

    const preview = await previewImportBackupEnvelope(
      storage,
      envelope({
        formatVersion: 3,
        pregnancies: [
          pregnancyRecord({
            id: "p_dry",
            status: "ended",
            endedAt: "2026-05-01",
            endReason: "birth",
          }),
        ],
        kickSessions: [kickSession({ id: "k_dry" })],
        contractionSessions: [contractionSession({ id: "c_dry" })],
        postpartumRecords: [
          postpartumRecord({
            id: "pp_dry",
            status: "ended",
            endedAt: "2026-06-15",
            endReason: "cycle_returned",
          }),
        ],
        screeningResponses: [screeningResponse({ id: "s_dry" })],
      }),
    );

    expect(preview.pregnanciesAdded).toBe(1);
    expect(preview.kickSessionsAdded).toBe(1);
    expect(preview.contractionSessionsAdded).toBe(1);
    expect(preview.postpartumRecordsAdded).toBe(1);
    expect(preview.screeningResponsesAdded).toBe(1);
    expect(storage.writePregnancyRecord).not.toHaveBeenCalled();
    expect(storage.writeKickSession).not.toHaveBeenCalled();
    expect(storage.writeContractionSession).not.toHaveBeenCalled();
    expect(storage.writePostpartumRecord).not.toHaveBeenCalled();
    expect(storage.writeScreeningResponse).not.toHaveBeenCalled();
  });
});
