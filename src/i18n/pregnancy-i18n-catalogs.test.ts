import { SUPPORTED_INTERFACE_LANGUAGES } from "../models/profile";
import { getBabyWeekCopy } from "./baby-week-copy";
import { getContractionTimerCopy } from "./contraction-timer-copy";
import { getCrisisCopy } from "./crisis-copy";
import { getKickCounterCopy } from "./kick-counter-copy";
import { getPostpartumCopy } from "./postpartum-copy";
import { getPregnancyCopy } from "./pregnancy-copy";
import { getPregnancyEndCopy } from "./pregnancy-end-copy";
import { getRedFlagCopy } from "./red-flag-copy";
import { getScreeningCopy } from "./screening-copy";

// Every pregnancy-epic catalog resolves through the same locale-getter shape,
// and every function-valued field is a template lambda producing a rendered
// string. TypeScript already enforces catalog completeness per locale (typed
// Record catalogs); this walker enforces the runtime half for the template
// lambdas the screen-level tests only exercise in one or two locales: every
// lambda in every locale must produce a non-empty string. Without this, a
// locale's template can silently degrade (e.g. an empty interpolation) behind
// a green suite.
const CATALOG_GETTERS = {
  babyWeek: getBabyWeekCopy,
  contractionTimer: getContractionTimerCopy,
  crisis: getCrisisCopy,
  kickCounter: getKickCounterCopy,
  postpartum: getPostpartumCopy,
  pregnancy: getPregnancyCopy,
  pregnancyEnd: getPregnancyEndCopy,
  redFlag: getRedFlagCopy,
  screening: getScreeningCopy,
} as const;

// Plausible arguments for any template lambda in these catalogs: counts,
// week/day numbers, or a preformatted string — a number renders fine in
// either position. Extra arguments beyond a lambda's arity are ignored.
const TEMPLATE_ARGS: readonly unknown[] = [2, 3];

function walkStrings(value: unknown, path: string, failures: string[]): void {
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      failures.push(`${path}: empty string`);
    }
    return;
  }
  if (typeof value === "function") {
    const rendered: unknown = (value as (...args: unknown[]) => unknown)(
      ...TEMPLATE_ARGS,
    );
    if (typeof rendered !== "string" || rendered.trim().length === 0) {
      failures.push(`${path}: template did not render a non-empty string`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      walkStrings(entry, `${path}[${index}]`, failures),
    );
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      walkStrings(entry, `${path}.${key}`, failures);
    }
  }
}

describe("pregnancy-epic i18n catalogs", () => {
  for (const [name, getter] of Object.entries(CATALOG_GETTERS)) {
    it(`renders every ${name} string and template in every locale`, () => {
      for (const language of SUPPORTED_INTERFACE_LANGUAGES) {
        const failures: string[] = [];
        walkStrings(getter(language), `${name}/${language}`, failures);
        expect(failures).toEqual([]);
      }
    });
  }
});
