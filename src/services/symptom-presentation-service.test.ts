import { createEmptyDayLogRecord, type DayLogRecord } from "../models/day-log";
import {
  buildLocalizedEntryPickerSymptoms,
  buildPersonalizedSymptomOrder,
} from "./symptom-presentation-service";
import { createDefaultSymptomRecords } from "../models/symptom";

function recordWithSymptoms(
  date: string,
  symptomIDs: readonly string[],
): DayLogRecord {
  return {
    ...createEmptyDayLogRecord(date),
    symptomIDs: [...symptomIDs],
  };
}

const REFERENCE_NOW = new Date(2026, 4, 18);

describe("buildPersonalizedSymptomOrder", () => {
  const defaultOrdered = [
    { value: "cramps" },
    { value: "headache" },
    { value: "bloating" },
    { value: "back_pain" },
  ] as const;

  it("returns the default order when there are no records in the window", () => {
    const result = buildPersonalizedSymptomOrder(defaultOrdered, [], {
      now: REFERENCE_NOW,
    });
    expect(result.map((option) => option.value)).toEqual(
      defaultOrdered.map((option) => option.value),
    );
  });

  it("returns the default order when total selections stay below the threshold", () => {
    const records = [
      recordWithSymptoms("2026-05-10", ["headache"]),
      recordWithSymptoms("2026-05-12", ["headache"]),
    ];
    const result = buildPersonalizedSymptomOrder(defaultOrdered, records, {
      now: REFERENCE_NOW,
    });
    expect(result.map((option) => option.value)).toEqual([
      "cramps",
      "headache",
      "bloating",
      "back_pain",
    ]);
  });

  it("reorders by descending frequency once enough selections exist", () => {
    const records = [
      ...Array.from({ length: 6 }, (_, index) =>
        recordWithSymptoms(`2026-05-${String(index + 1).padStart(2, "0")}`, [
          "headache",
        ]),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        recordWithSymptoms(`2026-04-${String(index + 20).padStart(2, "0")}`, [
          "back_pain",
        ]),
      ),
      recordWithSymptoms("2026-05-15", ["bloating"]),
    ];
    const result = buildPersonalizedSymptomOrder(defaultOrdered, records, {
      now: REFERENCE_NOW,
    });
    expect(result.map((option) => option.value)).toEqual([
      "headache",
      "back_pain",
      "bloating",
      "cramps",
    ]);
  });

  it("ignores selections outside of the 60-day window", () => {
    const records = [
      ...Array.from({ length: 12 }, (_, index) =>
        recordWithSymptoms(`2025-01-${String(index + 1).padStart(2, "0")}`, [
          "back_pain",
        ]),
      ),
    ];
    const result = buildPersonalizedSymptomOrder(defaultOrdered, records, {
      now: REFERENCE_NOW,
    });
    expect(result.map((option) => option.value)).toEqual([
      "cramps",
      "headache",
      "bloating",
      "back_pain",
    ]);
  });

  it("ignores selections for unknown symptom ids", () => {
    const records = Array.from({ length: 12 }, (_, index) =>
      recordWithSymptoms(`2026-05-${String(index + 1).padStart(2, "0")}`, [
        "ghost_symptom",
      ]),
    );
    const result = buildPersonalizedSymptomOrder(defaultOrdered, records, {
      now: REFERENCE_NOW,
    });
    expect(result.map((option) => option.value)).toEqual(
      defaultOrdered.map((option) => option.value),
    );
  });
});

describe("buildLocalizedEntryPickerSymptoms with history", () => {
  it("keeps the default order when no history is supplied", () => {
    const baseline = buildLocalizedEntryPickerSymptoms(
      createDefaultSymptomRecords(),
      [],
      "en",
    );
    const fallback = buildLocalizedEntryPickerSymptoms(
      createDefaultSymptomRecords(),
      [],
      "en",
      { historyRecords: [], now: REFERENCE_NOW },
    );
    expect(fallback.map((option) => option.value)).toEqual(
      baseline.map((option) => option.value),
    );
  });

  it("bubbles the user's most-frequent symptoms to the top once the threshold is met", () => {
    const symptomRecords = createDefaultSymptomRecords();
    const baseline = buildLocalizedEntryPickerSymptoms(
      symptomRecords,
      [],
      "en",
    );
    const targetID = baseline.at(-1)!.value;
    const history = Array.from({ length: 12 }, (_, index) =>
      recordWithSymptoms(
        `2026-05-${String(index + 1).padStart(2, "0")}`,
        [targetID],
      ),
    );
    const personalized = buildLocalizedEntryPickerSymptoms(
      symptomRecords,
      [],
      "en",
      { historyRecords: history, now: REFERENCE_NOW },
    );
    expect(personalized[0]?.value).toBe(targetID);
  });
});
