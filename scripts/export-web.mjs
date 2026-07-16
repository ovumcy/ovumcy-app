import { spawnSync } from "node:child_process";

/**
 * Deploy-time web export wrapper: runs `npx expo export -p web` with Expo's
 * dotenv loading disabled (`EXPO_NO_DOTENV=1`).
 *
 * Why: Expo loads `.env.local` for ANY build on the machine, including the
 * local web export inside `npm run deploy`. The release guards
 * (`scripts/verify-entitlement-pubkeys.mjs`, `scripts/verify-base-urls.mjs`)
 * run as separate plain-node processes ahead of the export, so they can only
 * validate the ambient process environment — they cannot see values that
 * exist only in dotenv files. Disabling dotenv for the export step closes
 * that gap: the artifact is built from exactly the environment the guards
 * just validated, so a developer's stray local override (e.g. sync/managed
 * base URLs pointed at a local Docker stack) cannot be baked into the
 * production web bundle. Anything a production export legitimately needs
 * (e.g. `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS`) must already be in the ambient
 * environment anyway — the pubkey guard fails the deploy otherwise.
 *
 * `--clear` is NOT an optimization knob: Metro's transform cache stores
 * modules with `process.env.EXPO_PUBLIC_*` values already inlined by
 * babel-preset-expo, and it does not reliably invalidate when those env
 * values change. A cache written by an earlier dotenv-loaded dev build can
 * therefore re-inject stale local URLs into a later clean export (observed
 * on a real machine). Clearing forces every module to be re-transformed
 * under the environment the guards just validated.
 *
 * This is a script rather than an env prefix in package.json because npm
 * runs scripts through cmd.exe on Windows, where `VAR=1 command` syntax
 * breaks. `shell: true` is required on Windows to resolve `npx` (npx.cmd);
 * the command is a fixed literal, so no untrusted text reaches the shell.
 *
 * Output hygiene: the log line names the env var it sets, never values.
 */

const LOG_PREFIX = "export-web:";
const EXPORT_COMMAND = "npx expo export -p web --clear";

console.log(
  `${LOG_PREFIX} running "${EXPORT_COMMAND}" with dotenv loading disabled (EXPO_NO_DOTENV=1) so local dotenv overrides cannot enter the production artifact.`,
);

const result = spawnSync(EXPORT_COMMAND, {
  env: { ...process.env, EXPO_NO_DOTENV: "1" },
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error(`${LOG_PREFIX} failed to launch the export process: ${result.error.message}`);
  process.exitCode = 1;
} else {
  // Null status means the child was killed by a signal; treat as failure.
  process.exitCode = result.status ?? 1;
}
