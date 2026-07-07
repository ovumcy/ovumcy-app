import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Release guard: a production artifact must never ship the PLACEHOLDER
 * entitlement public key (see the signed-entitlement note in SECURITY.md and
 * the release checklist in issue #51).
 *
 * `decidePubkeyMap()` below is PINNED to `resolveEmbeddedEntitlementPublicKeys()`
 * in `src/security/entitlement-token.ts` and must stay in sync with it: the
 * `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS` env var wins only when it is a non-empty
 * string that parses to a JSON object whose values are all strings; every
 * other state (unset, blank, malformed JSON, wrong shape) makes the app fall
 * back to the embedded placeholder map. This script deliberately re-implements
 * that tiny check instead of importing the TypeScript module so it runs under
 * plain `node` with no dependencies (it is an `eas-build-pre-install` hook,
 * which executes before `npm install` on EAS build workers).
 *
 * Modes:
 *   --production  enforce the check (used at the start of `npm run deploy`);
 *                 also the default for a bare invocation, so the guard fails
 *                 closed when wired without an explicit mode.
 *   --eas-hook    enforce only when EAS_BUILD_PROFILE is the "production"
 *                 profile from eas.json; other profiles print a skip line and
 *                 exit 0 so development/preview/local builds are unaffected.
 *   --self-test   run the decision-table self-test (spawns this script).
 *
 * Output hygiene: messages name the env var, whether it is set, and kid
 * counts. They never echo the env value or any key hex — the only kid printed
 * is the placeholder's, which is already public in the app source.
 */

const ENV_VAR = "EXPO_PUBLIC_ENTITLEMENT_PUBKEYS";
// Kid of the golden-vector test key embedded as the documented placeholder in
// EMBEDDED_ENTITLEMENT_PUBLIC_KEYS (src/security/entitlement-token.ts).
const PLACEHOLDER_KID = "65b60673d6ed884b";
// Name of the production build profile in eas.json.
const PRODUCTION_EAS_BUILD_PROFILE = "production";
const LOG_PREFIX = "entitlement-pubkey-guard:";

/**
 * Decides whether the entitlement public-key map that the artifact would embed
 * is safe for production. Mirrors `resolveEmbeddedEntitlementPublicKeys()` in
 * `src/security/entitlement-token.ts` (see the pinning note above).
 *
 * Returns `{ ok, message }`; `message` never contains key material.
 */
function decidePubkeyMap(rawValue) {
  const fallbackNote = `the app would silently fall back to the embedded placeholder entitlement key (kid ${PLACEHOLDER_KID})`;

  if (rawValue === undefined) {
    return {
      ok: false,
      message: `${ENV_VAR} is not set; ${fallbackNote}. Set it to the production kid -> hex map before building.`,
    };
  }
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return {
      ok: false,
      message: `${ENV_VAR} is set but blank; ${fallbackNote}.`,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return {
      ok: false,
      message: `${ENV_VAR} is set but is not valid JSON; ${fallbackNote}.`,
    };
  }

  const isStringRecord =
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    Object.values(parsed).every((value) => typeof value === "string");
  if (!isStringRecord) {
    return {
      ok: false,
      message: `${ENV_VAR} is set but is not a JSON object of kid -> hex strings; ${fallbackNote}.`,
    };
  }

  const kids = Object.keys(parsed);
  if (kids.includes(PLACEHOLDER_KID)) {
    return {
      ok: false,
      message: `${ENV_VAR} is set but its key map includes the placeholder kid ${PLACEHOLDER_KID}; production artifacts must ship only production keys.`,
    };
  }

  // An explicit empty map ({}) passes: it contains no placeholder key and the
  // verifier then trusts nothing, which is strictly safer than the placeholder
  // (see the rollout note in src/security/entitlement-token.ts). The kid count
  // in the OK line keeps that state visible to the operator.
  return {
    ok: true,
    message: `OK: ${ENV_VAR} provides ${kids.length} production entitlement key(s); placeholder kid ${PLACEHOLDER_KID} absent.`,
  };
}

/** Runs the guard for a production context. Returns the process exit code. */
function runGuard() {
  const verdict = decidePubkeyMap(process.env[ENV_VAR]);
  if (verdict.ok) {
    console.log(`${LOG_PREFIX} ${verdict.message}`);
    return 0;
  }
  console.error(`${LOG_PREFIX} FAIL: ${verdict.message}`);
  return 1;
}

/**
 * EAS lifecycle-hook mode: EAS Build exports EAS_BUILD_PROFILE on the worker;
 * only the production profile is gated so dev/preview/local builds and a local
 * `npm run eas-build-pre-install` stay unaffected.
 */
function runEasHook() {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (profile !== PRODUCTION_EAS_BUILD_PROFILE) {
    console.log(
      `${LOG_PREFIX} skipped: EAS_BUILD_PROFILE=${profile ?? "<unset>"} is not the "${PRODUCTION_EAS_BUILD_PROFILE}" profile.`,
    );
    return 0;
  }
  return runGuard();
}

/**
 * Decision-table self-test: spawns this script with controlled env so the arg
 * parsing, context gating, and exit codes are exercised end to end.
 */
function runSelfTest() {
  const scriptPath = fileURLToPath(import.meta.url);
  // Fake production-shaped values, constructed (not literal) so no key-looking
  // hex blob appears in this file.
  const fakeKid = "a".repeat(16);
  const fakeHex = "a".repeat(64);
  const validMap = JSON.stringify({ [fakeKid]: fakeHex });
  const mapWithPlaceholder = JSON.stringify({
    [fakeKid]: fakeHex,
    [PLACEHOLDER_KID]: fakeHex,
  });

  const cases = [
    // --production: always a production context.
    { name: "[--production] env unset -> FAIL", args: ["--production"], env: {}, exit: 1, text: "is not set" },
    { name: "[--production] env blank -> FAIL", args: ["--production"], env: { [ENV_VAR]: "   " }, exit: 1, text: "set but blank" },
    { name: "[--production] valid production map -> OK", args: ["--production"], env: { [ENV_VAR]: validMap }, exit: 0, text: "OK:" },
    { name: "[--production] map includes placeholder kid -> FAIL", args: ["--production"], env: { [ENV_VAR]: mapWithPlaceholder }, exit: 1, text: "includes the placeholder kid" },
    { name: "[--production] malformed JSON -> FAIL", args: ["--production"], env: { [ENV_VAR]: "{not json" }, exit: 1, text: "not valid JSON" },
    { name: "[--production] JSON but wrong shape -> FAIL", args: ["--production"], env: { [ENV_VAR]: '{"kid":1}' }, exit: 1, text: "not a JSON object of" },
    { name: "[--production] empty JSON object -> OK (0 keys, verifier trusts nothing)", args: ["--production"], env: { [ENV_VAR]: "{}" }, exit: 0, text: "0 production entitlement key" },
    // --eas-hook: gated on EAS_BUILD_PROFILE === "production".
    { name: "[--eas-hook production] env unset -> FAIL", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "production" }, exit: 1, text: "is not set" },
    { name: "[--eas-hook production] valid production map -> OK", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "production", [ENV_VAR]: validMap }, exit: 0, text: "OK:" },
    { name: "[--eas-hook production] map includes placeholder kid -> FAIL", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "production", [ENV_VAR]: mapWithPlaceholder }, exit: 1, text: "includes the placeholder kid" },
    { name: "[--eas-hook production] malformed JSON -> FAIL", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "production", [ENV_VAR]: "{not json" }, exit: 1, text: "not valid JSON" },
    { name: "[--eas-hook preview] env unset -> skip", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "preview" }, exit: 0, text: "skipped" },
    { name: "[--eas-hook development] malformed JSON -> skip", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "development", [ENV_VAR]: "{not json" }, exit: 0, text: "skipped" },
    { name: "[--eas-hook local] map includes placeholder kid -> skip", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "local", [ENV_VAR]: mapWithPlaceholder }, exit: 0, text: "skipped" },
    { name: "[--eas-hook] profile unset -> skip", args: ["--eas-hook"], env: {}, exit: 0, text: "skipped" },
    // CLI stays fail-closed.
    { name: "[bare] no args, env unset -> FAIL (fail-closed default)", args: [], env: {}, exit: 1, text: "is not set" },
    { name: "[cli] unknown argument -> FAIL", args: ["--nope"], env: {}, exit: 1, text: "unknown argument" },
  ];

  for (const testCase of cases) {
    // Start from the parent env minus the two inputs under test, so a value
    // set in the surrounding shell/CI cannot leak into a case.
    const env = { ...process.env };
    delete env[ENV_VAR];
    delete env.EAS_BUILD_PROFILE;
    Object.assign(env, testCase.env);

    const result = spawnSync(process.execPath, [scriptPath, ...testCase.args], {
      env,
      encoding: "utf8",
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    assert.strictEqual(
      result.status,
      testCase.exit,
      `${testCase.name}: expected exit ${testCase.exit}, got ${result.status}. Output: ${output}`,
    );
    assert.ok(
      output.includes(testCase.text),
      `${testCase.name}: expected output to include "${testCase.text}". Output: ${output}`,
    );
    console.log(`self-test PASS ${testCase.name}`);
  }

  console.log(`${LOG_PREFIX} self-test passed (${cases.length} cases).`);
  return 0;
}

function main(argv) {
  const [mode, ...rest] = argv;
  if (rest.length > 0) {
    console.error(`${LOG_PREFIX} unknown argument "${rest[0]}" (expected a single --production, --eas-hook, or --self-test).`);
    return 1;
  }
  if (mode === "--self-test") {
    return runSelfTest();
  }
  if (mode === "--eas-hook") {
    return runEasHook();
  }
  if (mode === undefined || mode === "--production") {
    return runGuard();
  }
  console.error(`${LOG_PREFIX} unknown argument "${mode}" (expected --production, --eas-hook, or --self-test).`);
  return 1;
}

process.exitCode = main(process.argv.slice(2));
