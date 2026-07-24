import * as fc from "fast-check";

import {
  EDD_BASIS_VALUES,
  GESTATION_DAYS,
  MODE_OF_DELIVERY_VALUES,
  PREGNANCY_END_REASON_VALUES,
  PREGNANCY_SCHEDULE_PRESET_VALUES,
  PREGNANCY_STATUS_VALUES,
  type PregnancyRecord,
  sanitizePregnancyRecord,
} from "../models/pregnancy";
import {
  MAX_GESTATIONAL_AGE_DAYS,
  calcEddFromLmp,
  calcGestationalAge,
} from "./pregnancy-timeline-service";
import { addDays, formatLocalDate, parseLocalDate } from "./profile-settings-policy";

// Mirrors the isoDateArb technique in profile-settings-date-diff.test.ts:
// derive the ISO string from an already-valid Date's own UTC Y/M/D so every
// generated value is guaranteed calendar-valid (no invented Feb 30 etc.).
const localDateISOArb = fc
  .date({
    min: new Date(Date.UTC(2000, 0, 1)),
    max: new Date(Date.UTC(2100, 0, 1)),
    noInvalidDate: true,
  })
  .map((value) => {
    const year = String(value.getUTCFullYear()).padStart(4, "0");
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

const nullableLocalDateISOArb = fc.option(localDateISOArb, { nil: null });

// Non-empty, whitespace-free identifier: guarantees sanitizePregnancyRecord's
// `id.trim()` is a no-op, so the round-trip identity property holds exactly.
const idArb = fc
  .array(
    fc.constantFrom(
      ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-".split(
        "",
      ),
    ),
    { minLength: 1, maxLength: 24 },
  )
  .map((chars) => chars.join(""));

// An arbitrary PregnancyRecord that is already field-valid, drawn from the
// exact same enum catalogs sanitizePregnancyRecord validates against, so
// sanitize is expected to be the identity on it.
const pregnancyRecordArb: fc.Arbitrary<PregnancyRecord> = fc.record({
  id: idArb,
  status: fc.constantFrom(...PREGNANCY_STATUS_VALUES),
  edd: localDateISOArb,
  eddBasis: fc.constantFrom(...EDD_BASIS_VALUES),
  lmpDate: nullableLocalDateISOArb,
  schedulePreset: fc.constantFrom(...PREGNANCY_SCHEDULE_PRESET_VALUES),
  startedAt: localDateISOArb,
  endedAt: nullableLocalDateISOArb,
  endReason: fc.option(fc.constantFrom(...PREGNANCY_END_REASON_VALUES), {
    nil: null,
  }),
  modeOfDelivery: fc.option(fc.constantFrom(...MODE_OF_DELIVERY_VALUES), {
    nil: null,
  }),
});

describe("pregnancy-timeline-service (property)", () => {
  it("GA at the LMP date itself is always 0 days / week 0 / trimester 1", () => {
    fc.assert(
      fc.property(localDateISOArb, (lmp) => {
        const edd = calcEddFromLmp(lmp);
        expect(calcGestationalAge(edd, lmp)).toEqual({
          gaDays: 0,
          weeks: 0,
          days: 0,
          trimester: 1,
        });
      }),
    );
  });

  it("advancing today by 1 calendar day increases gaDays by exactly 1, within the valid window", () => {
    fc.assert(
      fc.property(
        localDateISOArb,
        // Leaves room for the +1 day step to stay inside the valid window.
        fc.integer({ min: 0, max: MAX_GESTATIONAL_AGE_DAYS - 1 }),
        (edd, gaDaysTarget) => {
          const eddDate = parseLocalDate(edd)!;
          const today = formatLocalDate(
            addDays(eddDate, gaDaysTarget - GESTATION_DAYS),
          );
          const tomorrow = formatLocalDate(
            addDays(eddDate, gaDaysTarget + 1 - GESTATION_DAYS),
          );

          const current = calcGestationalAge(edd, today);
          const next = calcGestationalAge(edd, tomorrow);

          expect(current).not.toBeNull();
          expect(next).not.toBeNull();
          expect(next!.gaDays).toBe(current!.gaDays + 1);
        },
      ),
    );
  });

  it("sanitizePregnancyRecord is the identity for an already-valid record", () => {
    fc.assert(
      fc.property(pregnancyRecordArb, (record) => {
        expect(sanitizePregnancyRecord(record)).toEqual(record);
      }),
    );
  });
});
