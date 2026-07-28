// @ts-check
/**
 * Stryker mutation testing — ADVISORY lane.
 *
 * This mirrors the Go `gremlins` discipline used elsewhere in the ecosystem:
 * we do NOT mutate the whole app. We point the mutator at a focused set of
 * pure domain/policy modules that already carry strong, deterministic unit
 * tests (the TS analogue of targeting `internal/services` + `internal/security`).
 *
 * It is intentionally non-gating: there is no `thresholds.break`, so a low
 * mutation score never fails CI. The weekly workflow surfaces the score as a
 * signal for test-suite quality, nothing more.
 *
 * Run locally with: `npm run mutation`
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  packageManager: "npm",
  testRunner: "jest",
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "perTest",

  // Focused, high-signal pure-logic targets only — keep the blast radius small
  // and the run tractable. These are the policy/service files with the
  // strongest behavioural unit coverage.
  //
  // Scope rationale: this list is deliberately a curated handful, not the whole
  // service tree. A file earns a slot only if it is (a) pure/deterministic logic
  // (no storage, native, or I/O deps), (b) already backed by a strong sibling
  // unit test, and (c) guarding a correctness or privacy invariant where a
  // silent mutation would be materially harmful. Broad expansion is intentionally
  // avoided — it inflates a weekly advisory run without adding signal.
  mutate: [
    "src/services/cycle-history-service.ts",
    "src/services/cycle-prediction-policy.ts",
    "src/services/observed-ovulation-service.ts",
    "src/services/stats-premium-insights-service.ts",
    "src/services/export-service.ts",
    "src/services/symptom-policy.ts",
    "src/services/profile-settings-policy.ts",
    // BBT unit conversion + sustained-thermal-shift detection: pure math whose
    // off-by-one/offset errors would silently corrupt temperature readings.
    "src/services/temperature-policy.ts",
    // Period auto-fill: the "observed days up to today only" guard that keeps
    // predicted/future days out of exports, stats, and sync. Pure and testable.
    "src/services/period-auto-fill-service.ts",
    // Pregnancy dating: LMP/ultrasound anchor -> gestational age, EDD, trimester
    // and week boundaries. Pure calendar math over `profile-settings-policy`
    // helpers, backed by a unit suite and a property suite. An off-by-one here
    // misstates gestational age on every pregnancy surface at once.
    "src/services/pregnancy-timeline-service.ts",
    // Pregnancy module ownership: the one-time on-device unlock predicate. It
    // gates starting pregnancy data and rendering pregnancy surfaces, and must
    // never gate reading or exporting already-logged data (local-first privacy
    // boundary). Dependency-free and fully deterministic.
    "src/services/pregnancy-entitlement-service.ts",
    // Deliberately NOT in scope: `pregnancy-mode-service.ts`. It orchestrates
    // `LocalAppStorage` reads/writes rather than computing, so it fails the
    // purity criterion above; its dating and ownership invariants are already
    // covered here through the two services it delegates to.
  ],

  jest: {
    projectType: "custom",
    configFile: "jest.config.js",
    enableFindRelatedTests: true,
  },

  // Be gentle on CI runners; this is a background-quality job, not a fast gate.
  concurrency: 2,
  timeoutMS: 60000,
  timeoutFactor: 2,

  // Static mutants (those executed once at module load rather than per test)
  // force a full test-runner restart each time. Stryker measured them at 21% of
  // the mutants but ~71% of the wall time on this suite, because the jest-expo
  // preset pays a heavy transform cost on every restart. Dropping them is what
  // keeps a weekly advisory run inside a bounded budget; module-load constants
  // are the lowest-signal mutants in these files anyway.
  ignoreStatic: true,

  // ADVISORY: report-only. `high`/`low` colour the report; `break` is
  // deliberately unset so the run never exits non-zero on a low score.
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },

  tempDirName: ".stryker-tmp",
  cleanTempDir: true,
};

export default config;
