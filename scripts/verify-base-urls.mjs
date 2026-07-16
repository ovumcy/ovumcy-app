import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Release guard: a production artifact must never ship a non-canonical sync /
 * managed-cloud base URL (see the release-guard note in `SECURITY.md` and
 * `resolvePublicBaseURL()` in `src/sync/sync-contract.ts`).
 *
 * `decideBaseURL()` below is PINNED to `resolvePublicBaseURL()` in
 * `src/sync/sync-contract.ts` and must stay in sync with it: an env var wins
 * only when it is set to a non-blank (post-trim) string; unset or blank falls
 * back to the embedded canonical default. This script deliberately
 * re-implements that tiny check instead of importing the TypeScript module so
 * it runs under plain `node` with no dependencies (it is an
 * `eas-build-pre-install` hook, which executes before `npm install` on EAS
 * build workers).
 *
 * Unlike the entitlement-pubkey guard (which accepts any well-formed
 * production key map), each base URL has exactly one correct production
 * value: the canonical `https://sync.ovumcy.cloud` / `https://managed.ovumcy.cloud`
 * hosts. Anything else is rejected outright — most commonly a developer's
 * `.env.local` pointing at a local Docker stack, since Expo SDK 54 loads
 * `.env.local` for ANY build on the machine, including a local
 * `expo export -p web` run from `npm run deploy`.
 *
 * Modes:
 *   --production  enforce the check (used at the start of `npm run deploy`);
 *                 also the default for a bare invocation, so the guard fails
 *                 closed when wired without an explicit mode.
 *   --eas-hook    enforce only when EAS_BUILD_PROFILE is the "production"
 *                 profile from eas.json; other profiles print a skip line and
 *                 exit 0 so development/preview/local builds are unaffected
 *                 (the "local" profile in eas.json intentionally points both
 *                 vars at an Android-emulator loopback host).
 *   --self-test   run the decision-table self-test (spawns this script).
 *
 * Output hygiene: messages name the env var and whether it is set. On
 * failure they print only the offending URL's `host` (hostname[:port], via
 * `new URL().host`) — never the scheme, path, query string, or credentials.
 */

const CANONICAL_DEFAULTS = {
  EXPO_PUBLIC_OVUMCY_SYNC_BASE_URL: "https://sync.ovumcy.cloud",
  EXPO_PUBLIC_OVUMCY_MANAGED_BASE_URL: "https://managed.ovumcy.cloud",
};
const ENV_VARS = Object.keys(CANONICAL_DEFAULTS);
// Name of the production build profile in eas.json.
const PRODUCTION_EAS_BUILD_PROFILE = "production";
const LOG_PREFIX = "base-url-guard:";

/**
 * Returns the URL's host (hostname[:port]) for log hygiene, or a fixed
 * placeholder when the value does not parse as a URL at all. Never returns
 * the scheme, path, query string, or credentials.
 */
function safeHostForLog(rawValue) {
  try {
    const host = new URL(rawValue).host;
    return host.length > 0 ? host : "<no-host>";
  } catch {
    return "<unparseable-url>";
  }
}

/**
 * Decides whether a single base-URL env var is safe for production. Mirrors
 * `resolvePublicBaseURL()` in `src/sync/sync-contract.ts` (see the pinning
 * note above): unset or blank (post-trim) is fine because the app falls back
 * to the embedded canonical default; anything else must match that default
 * exactly.
 *
 * Returns `{ ok, message }`; `message` never contains more than the env var
 * name and (on failure) the offending host.
 */
function decideBaseURL(varName, rawValue) {
  const canonical = CANONICAL_DEFAULTS[varName];

  if (rawValue === undefined) {
    return {
      ok: true,
      message: `OK: ${varName} is not set; the build falls back to the canonical default.`,
    };
  }

  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    return {
      ok: true,
      message: `OK: ${varName} is set but blank; the build falls back to the canonical default.`,
    };
  }

  if (trimmed === canonical) {
    return {
      ok: true,
      message: `OK: ${varName} is set to the canonical default.`,
    };
  }

  return {
    ok: false,
    message: `${varName} is set to a non-canonical URL (host: ${safeHostForLog(trimmed)}); production artifacts must use ${canonical} exactly.`,
  };
}

/** Runs the guard for a production context. Returns the process exit code. */
function runGuard() {
  let allOk = true;
  for (const varName of ENV_VARS) {
    const verdict = decideBaseURL(varName, process.env[varName]);
    if (verdict.ok) {
      console.log(`${LOG_PREFIX} ${verdict.message}`);
    } else {
      console.error(`${LOG_PREFIX} FAIL: ${verdict.message}`);
      allOk = false;
    }
  }
  return allOk ? 0 : 1;
}

/**
 * EAS lifecycle-hook mode: EAS Build exports EAS_BUILD_PROFILE on the worker;
 * only the production profile is gated so dev/preview/local builds and a
 * local `npm run eas-build-pre-install` stay unaffected.
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
  const [syncVar, managedVar] = ENV_VARS;
  const syncCanonical = CANONICAL_DEFAULTS[syncVar];
  const managedCanonical = CANONICAL_DEFAULTS[managedVar];
  const localhostSyncURL = "http://127.0.0.1:8080";
  const localhostManagedURL = "http://127.0.0.1:8090";

  const cases = [
    // --production: always a production context.
    { name: "[--production] both unset -> OK", args: ["--production"], env: {}, exit: 0, text: "falls back to the canonical default" },
    { name: "[--production] both blank -> OK", args: ["--production"], env: { [syncVar]: "  ", [managedVar]: "\t" }, exit: 0, text: "falls back to the canonical default" },
    { name: "[--production] both canonical -> OK", args: ["--production"], env: { [syncVar]: syncCanonical, [managedVar]: managedCanonical }, exit: 0, text: "is set to the canonical default" },
    { name: "[--production] canonical with surrounding whitespace -> OK", args: ["--production"], env: { [syncVar]: ` ${syncCanonical} ` }, exit: 0, text: "is set to the canonical default" },
    { name: "[--production] sync var overridden to localhost -> FAIL (host only, no scheme)", args: ["--production"], env: { [syncVar]: localhostSyncURL }, exit: 1, text: "host: 127.0.0.1:8080" },
    { name: "[--production] managed var overridden to localhost -> FAIL", args: ["--production"], env: { [managedVar]: localhostManagedURL }, exit: 1, text: "host: 127.0.0.1:8090" },
    { name: "[--production] both overridden -> FAIL naming the canonical target", args: ["--production"], env: { [syncVar]: localhostSyncURL, [managedVar]: localhostManagedURL }, exit: 1, text: "must use https://sync.ovumcy.cloud exactly" },
    { name: "[--production] trailing slash is not an exact match -> FAIL", args: ["--production"], env: { [syncVar]: `${syncCanonical}/` }, exit: 1, text: "non-canonical URL" },
    { name: "[--production] scheme downgrade is not an exact match -> FAIL", args: ["--production"], env: { [syncVar]: syncCanonical.replace("https://", "http://") }, exit: 1, text: "non-canonical URL" },
    { name: "[--production] malformed URL -> FAIL without echoing the raw value", args: ["--production"], env: { [syncVar]: "not a url" }, exit: 1, text: "host: <unparseable-url>" },
    // --eas-hook: gated on EAS_BUILD_PROFILE === "production".
    { name: "[--eas-hook production] localhost override -> FAIL", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "production", [syncVar]: localhostSyncURL }, exit: 1, text: "host: 127.0.0.1:8080" },
    { name: "[--eas-hook production] both canonical -> OK", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "production", [syncVar]: syncCanonical, [managedVar]: managedCanonical }, exit: 0, text: "is set to the canonical default" },
    { name: "[--eas-hook local] emulator loopback is intentionally unguarded -> skip", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "local", [syncVar]: "http://10.0.2.2:8080", [managedVar]: "http://10.0.2.2:8090" }, exit: 0, text: "skipped" },
    { name: "[--eas-hook preview] unset -> skip", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "preview" }, exit: 0, text: "skipped" },
    { name: "[--eas-hook development] localhost override -> skip", args: ["--eas-hook"], env: { EAS_BUILD_PROFILE: "development", [syncVar]: localhostSyncURL }, exit: 0, text: "skipped" },
    { name: "[--eas-hook] profile unset -> skip", args: ["--eas-hook"], env: {}, exit: 0, text: "skipped" },
    // CLI stays fail-closed on mode dispatch (bare invocation still runs the
    // check, unlike silently no-op-ing), even though "unset" itself is a safe
    // verdict for base URLs.
    { name: "[bare] no args, both canonical -> OK", args: [], env: { [syncVar]: syncCanonical, [managedVar]: managedCanonical }, exit: 0, text: "is set to the canonical default" },
    { name: "[bare] no args, localhost override -> FAIL (fail-closed default still checks)", args: [], env: { [syncVar]: localhostSyncURL }, exit: 1, text: "host: 127.0.0.1:8080" },
    { name: "[cli] unknown argument -> FAIL", args: ["--nope"], env: {}, exit: 1, text: "unknown argument" },
  ];

  for (const testCase of cases) {
    // Start from the parent env minus the inputs under test, so a value set
    // in the surrounding shell/CI (or a developer's real .env.local, which
    // Expo/EAS never feeds into a plain `node` spawn like this one) cannot
    // leak into a case.
    const env = { ...process.env };
    for (const varName of ENV_VARS) {
      delete env[varName];
    }
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
