# F7 — TLS Pinning for Sync + Managed Cloud — Status

Working draft. Delete or fold into the PR description once F7 work merges.

## What this is

Threat F7 from the red-team audit: sync transport has no certificate pinning.
An attacker able to mint a leaf cert (rogue intermediate, compromised CA,
captive-portal injected root, user-installed corporate root) MITMs the
traffic in the clear: bearer session tokens, ciphertext blobs, recovery-key
wrap material, and on register/login flows the cleartext password.

Decision recorded in chat: pin BOTH self-hosted community sync AND managed
cloud transport. The two have structurally different pin sources:

- **Self-hosted** (`ovumcy-sync-community` on the owner's server): owner
  enters the leaf SPKI fingerprint at sync setup, sourced out-of-band from
  the server admin (server-side `openssl` command, deployment runbook
  documentation). The native enforcement library blocks any handshake whose
  leaf SPKI doesn't match what the owner entered. No TOFU bootstrap window
  — protection is live from the very first connect.

- **Managed cloud** (`sync.ovumcy.cloud`, `managed.ovumcy.cloud`): the pin
  set is shipped in the app binary as a build-time constant. The ovumcy
  team owns the rotation schedule: every cert rotation must be preceded by
  at least one app release that adds the next pin to the constant set (so
  installs on the old release accept the new cert) followed by a release
  that drops the old pin after the rotation completes. Multi-pin support
  in the policy and the underlying library carries the rotation grace.

## What was done in the prep session (pure TypeScript scaffolding)

No build infrastructure or schema changes were made. Every change is
reversible by `git checkout` on the listed files and `rm` on the new
ones. None of the in-flight partner-share dirty files were touched.

### New files

- `src/security/cert-pin-store.ts`
  SecureStore-backed map (host → `{ host, fingerprint, pinnedAt }`) for
  the **self-hosted** owner-entered pin. Single storage key
  (`ovumcy.sync-cert-pins`), JSON payload. Wraps any backend matching the
  existing `SyncSecretStoreBackend` shape. Rejects malformed fingerprints
  (must be base64 SHA-256, 44 chars with `=` pad) and non-ISO timestamps
  at write time. Rejects stored records whose embedded `host` differs
  from their map key (defends against tamper-aliased pins). One pin per
  host in the store; the policy layer above accepts an array, so a future
  "owner adds backup pin before rotating" UX needs no store change — it
  just writes two records keyed by the same host with different
  timestamps, OR (cleaner) the store grows to a pin-list shape later.
  Today the simpler single-pin shape is enough.

- `src/security/cert-pin-store.test.ts` — 17 tests.

- `src/sync/cert-pin-policy.ts`
  Pure decision function `evaluateCertPin({ pinnedSPKIFingerprints,
  observedFingerprint })` → `no_pin_recorded | matches | mismatch`.
  Accepts an array of expected pins (covers both modes uniformly).
  Constant-time per-entry compare. Malformed observed fingerprint and
  malformed entries in the pin set are both handled safely (mismatch,
  skip respectively) so neither a buggy native bridge nor a typo in the
  constants file can silently let an unpinned connect through.

- `src/sync/cert-pin-policy.test.ts` — 8 tests including the multi-pin
  rotation-overlap case.

### Modified files (none of which were in the prior dirty list)

- `src/sync/sync-contract.ts`
  Added `pinnedSPKIFingerprints?: readonly string[] | null` to
  `NormalizedSyncEndpoint`. Documented semantics inline including the
  per-mode source split.

- `src/sync/sync-endpoint-policy.ts`
  Added optional third parameter `options?: { pinnedSPKIFingerprints }`.
  Self-hosted: filters the input list (rejects malformed entries,
  deduplicates, collapses to null if nothing survives) and threads it
  through. Managed: resolves the pin set from a build-time constant
  resolver (`resolveManagedPinSet`) and ignores caller options entirely.
  The resolver currently returns `null` as a placeholder — see open
  question below.

- `src/sync/sync-endpoint-policy.test.ts` — added 5 new cases covering
  default null, single pin pass-through, multi-pin pass-through,
  malformed-and-duplicate filtering, all-malformed collapse, and the
  managed override-resistance contract.

### Validation run

- `npx jest --runInBand src/security/cert-pin-store.test.ts src/sync/cert-pin-policy.test.ts src/sync/sync-endpoint-policy.test.ts` → 44/44 pass.
- `npm run typecheck`: errors only in `src/services/managed-partner-share-*`, `src/services/partner-shared-projection-service.test.ts`, `src/ui/screens/PartnerSharedScreen.test.tsx`. Every error file matches the pre-existing dirty tree from in-flight partner-share work, not regression from this scaffolding.

## What was deliberately NOT done in this session

Need either an approval gate, a clean working tree, or real fingerprint
inputs:

1. **`npx expo prebuild`** — generates `android/` and `ios/` native code,
   modifies `app.json` to canonical Expo shape. Contributors lose Expo Go
   (cannot scan QR + run — must install Expo Dev Client). Per
   `AGENTS.md` "App layering rules" and the global "destructive scripts"
   rule, needs explicit approval. Should run on a clean tree.

2. **`npx expo install react-native-ssl-public-key-pinning`** — adds the
   library (1.2.6, July 2025) that handles native enforcement on Android
   (OkHttp `CertificatePinner`) and iOS (TrustKit). Modifies
   `package.json`, `package-lock.json`, and likely auto-edits `app.json`
   to register its Expo config plugin.

3. **`eas.json`** — minimum config to run `eas build --profile
   development` for the new dev-client APK/IPA.

4. **Real managed pin constants** — the ovumcy team must extract current
   leaf SPKI for `sync.ovumcy.cloud` and `managed.ovumcy.cloud` and bake
   them into `MANAGED_SYNC_PINNED_SPKI_FINGERPRINTS` /
   `MANAGED_CLOUD_AUTH_PINNED_SPKI_FINGERPRINTS` (constants to be added
   in `sync-contract.ts` alongside the existing `MANAGED_SYNC_BASE_URL`
   pattern, with `EXPO_PUBLIC_*` env override). Today
   `resolveManagedPinSet` returns null as a placeholder.

5. **`sync-client-service.ts` wiring** — calling `evaluateCertPin` inside
   `connectSyncAccount` / `runSyncUpload` / `runSyncRestore` before any
   bearer-token handshake. Holding back deliberately: without the
   library-supplied observed-fingerprint hook, wiring would either no-op
   or block all connects.

6. **App-boot pin registration** — `initializeSslPinning` per host using
   the resolved pin set from `NormalizedSyncEndpoint`. This is the
   primary native-layer enforcement; the JS-layer `evaluateCertPin` is
   defense in depth.

7. **UX surface for mismatch** — sensitive-action-auth-gated reset flow
   for self-hosted, warning screen reuse of `ConfirmDialogProvider` per
   AI_CONTEXT rules.

8. **UX surface for setup** — second input field in the self-hosted setup
   form for the SPKI fingerprint, paste-from-clipboard helper, format
   validation (the same 44-char base64 regex used in `cert-pin-store`).

9. **`docs/sync-trust-model.md` update** — file is in the in-flight
   partner-share dirty set. Will be a separate commit on F7 branch after
   partner-share lands.

10. **Storage migration for `SyncPreferencesRecord`** — none needed. Pins
    live in their own SecureStore key.

## Open questions for the morning

1. **Real SPKI fingerprints for the managed cloud hosts.** I cannot bake
   placeholder values into a security-critical constant. Need either:
   - the current SPKI hash for `sync.ovumcy.cloud` and
     `managed.ovumcy.cloud` extracted via
     `openssl s_client -servername $HOST -connect $HOST:443 < /dev/null 2>/dev/null | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`
     (one per host), OR
   - confirmation that managed pinning launches with an empty constant
     and the ovumcy team will fill it in a follow-up PR before the
     enforcement layer flips on.

2. **Cert rotation calendar for managed.** Who owns it? Where is it
   documented? The release-coordination dance (ship new release with
   current+next → rotate → ship next release dropping old) needs an
   owner before the multi-pin scheme is operationally safe. Without this
   the first cert rotation will brick every install that didn't update
   in time.

3. **Self-hosted setup UX text** — the SPKI-fingerprint field needs
   localized copy in all five locales (en, ru, de, fr, es per
   `AI_CONTEXT.md`). Need approved copy or an i18n-team handoff. Same for
   the mismatch warning screen.

## Next-session execution order (after the two questions above are answered)

1. Clean tree (let partner-share work land first).
2. `npx expo prebuild` — single commit `feat(build): switch to bare-equivalent prebuild for native modules`.
3. `npx expo install react-native-ssl-public-key-pinning` — single commit.
4. `eas.json` + README dev-workflow update — single commit.
5. Add `MANAGED_SYNC_PINNED_SPKI_FINGERPRINTS` / `MANAGED_CLOUD_AUTH_PINNED_SPKI_FINGERPRINTS` constants in `sync-contract.ts` with real values + env override.
6. Update `resolveManagedPinSet` in `sync-endpoint-policy.ts` to return the new constant.
7. App-boot wiring: read every self-hosted pin from `cert-pin-store` + the resolved managed pin set, call `initializeSslPinning` per host before any sync request fires.
8. `sync-endpoint-policy` callers: read self-hosted pin from `cert-pin-store` and thread it through `normalizeSyncEndpoint` options at every call site.
9. `sync-client-service` defense-in-depth: pre-connect `evaluateCertPin` call, refuse on mismatch with a typed error code that the UX maps to the warning surface.
10. Settings UX: pin status row in self-hosted endpoint section, reset button gated by sensitive-action-auth.
11. Setup UX: SPKI fingerprint field next to endpoint URL, paste helper, format validation, locale copy.
12. `docs/sync-trust-model.md`: replace the "TLS pinning / TOFU is a planned follow-up" line with the actual posture, document the managed cert rotation runbook.
13. Delete this file.
