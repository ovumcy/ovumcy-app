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
  mutate: [
    "src/services/cycle-history-service.ts",
    "src/services/cycle-prediction-policy.ts",
    "src/services/observed-ovulation-service.ts",
    "src/services/stats-premium-insights-service.ts",
    "src/services/export-service.ts",
    "src/services/symptom-policy.ts",
    "src/services/profile-settings-policy.ts",
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
