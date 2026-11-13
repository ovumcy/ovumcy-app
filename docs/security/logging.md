# Logging Policy

_Part of the [Ovumcy security policy](../../SECURITY.md)._

## What the App Logs

Nothing. The application code under `src/`, `app/` and `index.js` contains no `console.*` call, no logging helper and no log persistence. There is no analytics, crash-reporting or diagnostics SDK in the dependency list, and no network channel carries diagnostics; the no-telemetry posture is stated in [SECURITY.md](../../SECURITY.md) (*Data Boundary / Threat Model*, and *Policy / Planned*) and is a dependency- and code-review invariant, not a single test.

- **Where:** there is no sink. No log file, no SQLite table, no SecureStore entry and no AsyncStorage key holds log output, and nothing is sent off the device.
- **Console only?** The only output surface is whatever the React Native runtime itself writes to the platform console. App code does not add to it.
- **Build scripts:** the Node scripts under `scripts/` (dependency audit, cross-repo contract check, web export, release smoke) print progress and failures to stdout/stderr. They run on a developer or CI machine, never inside the app, and print no user data.

## Error Messages

Failures are returned as typed error codes (for example `invalid_payload`, `unauthorized`, `totp_invalid_code`) or thrown as `Error` values that screens map to localized copy. Messages are built from operation labels and error classes, not from record contents:

- storage errors are wrapped as `<operation label>: <underlying message>` (`withStorageOperationLabel` in `src/storage/local/sqlite-schema-migrations.ts`), where the label is a fixed string such as `sqlite/localDataKey/canaryDecrypt`;
- crypto failures throw fixed codes (`invalid_recovery_phrase`, `invalid_wrapped_key_metadata`, `invalid_partner_invite`, `invalid_partner_projection`) or the cipher's authentication failure, which carries no plaintext;
- the entitlement verifier returns a short reason code (`bad_signature`, `expired`, ...) and never throws on malformed input.

Because there is no log sink, an error that reaches the runtime's own error handling is the only way such a message can be printed; code that catches an error must not interpolate secrets or record values into a message it rethrows.

## Redaction Rules

Since nothing is logged, the rules constrain what any future log line, error message or diagnostic may contain. They follow the no-secret-or-PII-in-transport invariant in [SECURITY.md](../../SECURITY.md).

Never log, or place in an error message, route parameter, notification payload, clipboard or export filename:

- the local-data key, sync master key, device secret, recovery phrase, wrapped-key material, or any partner-share key (`K_invite`, `K_grant`);
- bearer, session or refresh tokens, entitlement tokens, and TOTP secrets, provisioning URIs and codes;
- partner invite tokens (the managed invite token is held only briefly in memory and scrubbed from route state after capture);
- any decrypted record: day logs, symptoms, notes, pregnancy, postpartum or screening content, weight and blood-pressure values, or screening outcomes and answers;
- ciphertext blobs, nonces and AAD strings beyond their length or a fixed label.

Allowed in a message: fixed operation labels, stable error codes, schema versions and counts that do not identify a person.

## Production Builds

Production behaves the same as development with respect to app logging: the app emits none. Development-only behaviour in the code is limited to `__DEV__` checks, for example screen-capture protection is disabled in development (`src/security/app-screen-protection.ts`) and enabled in production native builds. No code reads a verbose or debug flag to switch logging on, and the app has no build-time log stripping to rely on, which is why the rule is that app code does not write logs at all.

Debug logs from a development machine are still sensitive: they can contain on-device data surfaced by the runtime. Do not share them with unreviewed parties.
