# Cross-repo contracts

`ovumcy-app` shares a small number of contracts with its peer repositories:

- **ovumcy-web** — the Go web tracker that defines the Free-tier functional baseline.
- **ovumcy-managed** — the managed Ovumcy Cloud accounts service (identity/auth/2FA, billing, partner invites). **Private repo.**
- **ovumcy-sync-community** — the self-hosted zero-knowledge sync transport.

These contracts are encoded as vendored golden fixtures, documented constants, and error-code / locale
sets. Each is deliberately kept identical on both sides, but nothing stops one side from being edited
alone — the drift then only surfaces at runtime (a mispredicted cycle, an invite that expires on the
wrong day, an unhandled TOTP error code, a missing translation).

This document is the register of those contracts. Its executable half is
[`scripts/check-cross-repo-contracts.mjs`](../scripts/check-cross-repo-contracts.mjs), run in CI by
[`.github/workflows/cross-repo-check.yml`](../.github/workflows/cross-repo-check.yml).

## How the automated check works

The guard compares the copy of each artifact **in this checkout** against the **authoritative peer copy**.
It never re-implements any peer's logic — it only compares vendored artifacts and declared constants
byte- or set-wise. It is orthogonal to the existing local-parity tests
(`src/services/cycle-prediction-reference.test.ts` and `cycle-projection-reference.test.ts`), which
assert that the local fixture matches the local TypeScript prediction code; this guard asserts that the
local fixture is still **fresh** relative to its peer source.

Two source modes, selected by environment so the guard is testable offline:

| Mode | Selected when | Peer files come from |
| --- | --- | --- |
| `local-peer` | `OVUMCY_PEER_ROOT` is set | `${OVUMCY_PEER_ROOT}/<peer-repo>/<path>` (sibling checkouts, e.g. `OVUMCY_PEER_ROOT=/path/to/ovumcy`) |
| `remote` (default, used in CI) | `OVUMCY_PEER_ROOT` is unset | GitHub Contents API with `Accept: application/vnd.github.raw` |

The app-side files are always read from the current checkout in both modes. Additional environment knobs:

- `OVUMCY_CONTRACTS_REF` — git ref to fetch peer files from in remote mode (default `main`).
- `OVUMCY_CONTRACTS_TOKEN` (falls back to `GH_TOKEN` / `GITHUB_TOKEN`) — read-only token for remote mode.

The script exits `0` when every automated contract is in sync and `1` on any drift or any source that
could not be evaluated (fail-closed).

### Required CI secret

Because **ovumcy-managed is private**, remote mode needs a token to read it. The workflow passes a repo
secret named **`CROSS_REPO_READ_TOKEN`** as `OVUMCY_CONTRACTS_TOKEN`.

- Create a **fine-grained personal access token** with **Contents: Read-only** on `ovumcy/ovumcy-managed`
  (and, for a single token covering all peers, also on `ovumcy/ovumcy-web` and `ovumcy/ovumcy-sync-community`).
- Store it as the `CROSS_REPO_READ_TOKEN` Actions secret. The token value is never printed by the script.
- The two public peers also resolve token-less; if `ovumcy-managed` ever becomes public, the secret can be
  dropped and the check runs unauthenticated.
- **Fork pull requests** do not receive repo secrets, so the private-peer contracts cannot be fetched
  there. Those runs report the managed contracts as `ERROR` (fail-closed). The push-to-`main` and weekly
  cron runs, which do have the secret, are the safety net for that case.

## Automated contracts

### 1. Cycle-prediction golden vectors — byte-identical fixture

- **Authoritative source:** `ovumcy-web` → `internal/services/testdata/cycle-prediction-golden-vectors.json`
- **Local copy:** `ovumcy-app` → `src/services/__fixtures__/cycle-prediction-golden-vectors.json`
- **How compared:** byte-for-byte (SHA-256 of the raw file). The whole fixture is compared, so both the
  `vectors` section (consumed by `cycle-prediction-reference.test.ts`) and the `projection` section
  (`cycle-projection-reference.test.ts`) are covered.
- **How vendored:** the file is copied verbatim between the two repos; `cycles.go` / `cycle-prediction-policy.ts`
  are hand-parallel ports and each repo's reference test consumes the shared file. See
  [`docs/cycle-prediction.md`](./cycle-prediction.md).
- **Impact of drift:** the app and ovumcy-web would predict different fertile windows / ovulation / next
  period for the same input, so the Free-tier parity guarantee breaks. A prediction-math change must
  update this fixture, `docs/cycle-prediction.md`, and both reference suites in the same change.

### 2. Partner-invite TTL — `defaultPartnerInviteTTL` vs README

- **Authoritative source:** `ovumcy-managed` → `internal/services/partner_service.go`
  (`const defaultPartnerInviteTTL`) — the server is the runtime authority for when an invite expires.
- **Local copy:** `ovumcy-app` → `README.md` (the "N-day invite token TTL" statement).
- **How compared:** the Go duration expression (e.g. `7 * 24 * time.Hour`) is reduced to a day count and
  compared against the number parsed from the README phrase.
- **Impact of drift:** the app's documentation would misstate when a shared invite link stops working,
  confusing owners who share access. Managed enforces the real lifetime regardless.

### 3. TOTP error-key set — app clients vs both backends

- **Authoritative sources:** the error codes each backend actually emits via its `mapTOTPError` sink —
  `ovumcy-managed` → `internal/api/totp_handlers.go` and `ovumcy-sync-community` → `internal/api/server.go`.
- **Local copies:** the `totp_*` members of the error-reason unions in `ovumcy-app` →
  `src/sync/managed-cloud-api-client.ts` and `src/sync/sync-api-client.ts`.
- **How compared:** the set of `totp_*` codes is extracted from each of the four sources (backends: only
  strings passed to `writeError(...)`, which excludes non-error values like `totp_enabled`; app clients:
  quoted `"totp_*"` literals) and all four must be identical.
- **Impact of drift:** a backend code the app does not know about falls through to a generic error message
  (worse UX during login/enrollment); an app code no backend emits is dead handling. The 2FA flow is
  described in [`docs/two-factor.md`](./two-factor.md).

### 4. Supported locale set — app `InterfaceLanguage` vs web `requiredLocales`

- **Authoritative source:** `ovumcy-web` → `internal/i18n/i18n.go` (`requiredLocales`), because web defines
  the Free-tier locale baseline.
- **Local copy:** `ovumcy-app` → `src/models/profile.ts` (`type InterfaceLanguage`).
- **How compared:** the set of locale codes is extracted from each side (resolving web's `Lang*` constants)
  and the two sets must be identical.
- **Impact of drift:** a locale offered in one repo but not the other ships partial translations for a
  language a user can select. The app's copy catalogs are compiler-enforced complete per locale; this guard
  keeps the *set of locales* aligned with web.

### 5. Managed client routes vs server route table — app calls ⊆ managed exposes

- **Authoritative source:** `ovumcy-managed` → `internal/api/server.go` (the `s.mux.HandleFunc("METHOD /path", …)`
  registration table) — the server is the authority for which method+path pairs exist.
- **Local copy:** `ovumcy-app` → `src/sync/managed-cloud-api-client.ts` (the routes the client actually calls
  through its `request*` helpers).
- **How compared:** each side is parsed into a set of `METHOD /normalized/path` pairs (template-literal
  params `${…}` and net/http wildcards `{id}` both normalize to `{}`), and every route the app calls must be
  registered by managed. Routes managed exposes but the app never calls (admin, webhooks, `/healthz`,
  checkout, `GET /entitlements/sync`) are intentionally not flagged.
- **Impact of drift:** the app calling a method+path managed does not register is a runtime 404 on a live
  account flow — the exact defect class this guard was widened to catch (a client call to a managed route a
  checkout branch didn't expose). This is a directional subset check, not a set-equality check.

### 6. Observed-ovulation detector rule — app vs ovumcy-web "3-over-6"

- **Authoritative source:** `ovumcy-web` → `internal/services/cycle_signals.go` (`bbtCoverlineWindow`,
  `bbtElevatedStreakDays`, `bbtThirdDayMarginCelsius`, and the `models.CycleFactor*` disturbance set resolved
  from `internal/models/cycle_factor.go`), because web defines the Free-tier detector.
- **Local copy:** `ovumcy-app` → `src/services/observed-ovulation-service.ts` (`BBT_COVERLINE_WINDOW`,
  `BBT_ELEVATED_STREAK_DAYS`, `BBT_THIRD_DAY_MARGIN_CELSIUS`, `BBT_DISTURBANCE_FACTORS`).
- **How compared:** the governing constants of the two hand-parallel detectors (coverline window, streak
  length, third-day margin, and the disturbance-factor set) must be identical. The output-level parity is
  additionally locked by the shared fixture
  `src/services/__fixtures__/bbt-observed-ovulation-vectors.json`: its `expectedObservedOvulationDate` values
  are authored from web's documented rule, and `src/services/bbt-observed-ovulation-reference.test.ts` asserts
  the app detector reproduces them. So the rule (this guard) and its output (the fixture + reference test)
  cannot drift on one side without failing CI.
- **How the expected values were derived:** from ovumcy-web's documented `cycle_signals.go` rule (coverline =
  max of the 6 preceding undisturbed readings; a shift is 3 calendar-consecutive elevated days, the first two
  strictly above the coverline and the third ≥ +0.2 °C above it; ovulation = the day before the first
  elevated day; egg-white fallback = last egg-white day + 1, clamped before the next cycle start; illness /
  sleep_disruption excluded). A direct execution of web's unexported Go detector against the fixtures was not
  wired here (it would require adding a harness file to ovumcy-web); the app reference test confirms the app
  side matches the derivation, and this guard keeps web's rule constants pinned to the app's.
- **Impact of drift:** the app and ovumcy-web would infer a different observed-ovulation date from the same
  BBT/mucus log — the shared fixture would no longer hold on both sides. A detector-rule change must update
  this file, both detectors, the fixture, and the reference test in the same change.

### 7. Signed-entitlement token contract — app verifier vs managed issuer

- **Authoritative sources:** `ovumcy-managed` → `internal/security/entitlement_token.go`
  (`EntitlementTokenIssuer`, `EntitlementTokenAudience`, `entitlementTokenAlg`, and `KidForPublicKey`) and
  `internal/services/entitlement_token_service.go` (`localPremiumEntitlements` — the token-gated feature keys
  the issuer mints).
- **Local copies:** `ovumcy-app` → `src/security/entitlement-token.ts` (`ENTITLEMENT_TOKEN_ISSUER`,
  `ENTITLEMENT_TOKEN_AUDIENCE`, the accepted `alg`, and the embedded `kid → pubkey` map) and
  `src/services/managed-premium-features-service.ts` (`TOKEN_GATED_FEATURE_BY_ENTITLEMENT`).
- **How compared:** the fixed `iss`/`aud`/`alg`, and the set of token-gated feature keys
  (`doctor_pdf`, `advanced_insights`), must agree between verifier and issuer. Additionally, every embedded
  `kid → pubkey` pair on the app side must satisfy managed's kid rule (`kid == sha256(pubkey)[:8]`) — the
  exact formula a mis-built `EXPO_PUBLIC_ENTITLEMENT_PUBKEYS` gets wrong (see
  `ovumcy-managed` `cmd/ovumcy-managed print-entitlement-kid`).
- **Impact of drift:** a divergence in `iss`/`aud`/`alg`, the gated feature set, or the kid derivation means
  the app either rejects every managed-issued token (premium silently stays locked, falling back to the
  billing-snapshot boolean) or would trust a token shape the issuer never mints. Note this is distinct from
  the entitlement *public-key placeholder* guard (`scripts/verify-entitlement-pubkeys.mjs`), which fails a
  release that ships the golden test key; this contract checks the token *shape* agreement.

## Manually-reviewed contracts (not automated)

Some cross-repo contracts exist but are intentionally **not** automated here because a byte/set comparison
would be brittle or would encode a false authority. They are reviewed by hand when the relevant code
changes, backed by each repo's own tests and the security documentation.

- **AEAD associated-data construction.** Both encrypt and decrypt sites — across the app,
  `ovumcy-sync-community`, and `ovumcy-managed` — must build identical AAD context so ciphertext cannot be
  swapped between rows or contexts (see `SECURITY.md` and [`docs/sync-trust-model.md`](./sync-trust-model.md)).
  There is no shared artifact to diff: the logic is expressed independently in TypeScript and Go. Parity is
  enforced by each repo's crypto round-trip tests plus live sync smokes, not by this script.
- **The broader sync / managed error-reason vocabulary.** Beyond the bounded TOTP subset, the API error
  codes (e.g. `sync_not_allowed`, `origin_not_allowed`, `stale_generation`, `blob_not_found`) form a larger,
  multi-file, still-evolving surface with no single authoritative sink to parse. TOTP is automated because
  it has a clean, bounded `mapTOTPError` sink on each backend; the rest is reviewed against the client
  unions when handlers change.
- **Managed billing / entitlement feature keys.** The full premium feature vocabulary in the managed billing
  snapshot (`advanced_fertility`, `extended_reports`, `partner_access`, `reminders`, …) is consumed by the
  app's premium surfaces, but it is a versioned server contract without a vendored file, and premium-authority
  rules are security-sensitive (see `SECURITY.md`). The two *token-gated* feature keys (`doctor_pdf`,
  `advanced_insights`) are now covered by automated contract 7; the remaining server-gated keys are reviewed
  manually. Entitlement *public keys* have their own guard (`scripts/verify-entitlement-pubkeys.mjs`).
- **Managed partner-invite link / deep-link token format.** Managed issues the canonical invite URL and the
  app parses the token from it (`docs/sync-trust-model.md`). This is a format/behavior contract, not a
  vendored artifact, and the token must never be persisted or logged — so it is reviewed by hand rather
  than fetched and diffed.

## When drift is reported

1. Read the failing contract's output: it names the source repo, the path, and (where feasible) the line
   on each side, plus the specific difference (mismatched SHA, differing value, or the missing/extra set
   members).
2. Decide which side is authoritative (listed per contract above) and bring the other side into line — for
   the golden fixture, re-vendor the ovumcy-web file verbatim; for the constants/sets, update the local
   copy (or open a change against the peer repo if the peer is the one that is stale).
3. Keep the paired tests and docs in the same change (for the prediction fixture: the two app reference
   suites, `docs/cycle-prediction.md`, and the ovumcy-web reference test).

## Compatibility manifest (release lock)

Green per-repo tests do not prove the *combination* of the four repos works. `cross-repo-manifest.json`
records the peer commit SHAs the contracts in this checkout were validated against, so "these four SHAs are
known-compatible" is explicit instead of implicit.

- **Fields:** each repo entry carries its `commit`, `branch`, `role`, and a `pin` mode.
- **Pin modes:** the three peers (`ovumcy-web`, `ovumcy-managed`, `ovumcy-sync-community`) are pinned
  **exactly** — a peer on any other commit is a drift. `ovumcy-app` is pinned by **ancestry** — its HEAD must
  be at or after the recorded base, so ongoing app development on the same line still validates.
- **Validate a workspace:** `node scripts/check-cross-repo-contracts.mjs --validate-manifest` (or
  `OVUMCY_VALIDATE_MANIFEST=1`). It reads each local checkout's HEAD via git — peers from
  `${OVUMCY_PEER_ROOT}/<repo>` when set, else from siblings of this checkout (`../<repo>`) — and compares.
  Fail-closed: any repo whose HEAD cannot be read is an ERROR, not a silent pass. This mode needs local
  checkouts and is a local/release step (the remote-mode CI run has no peer working trees to git-inspect).
- **Refresh** the peer SHAs when the contracts are re-validated against newer peer commits.

## Release smoke — account contour (P2.14)

`scripts/release-account-smoke.mjs` is a server-level smoke that exercises the end-to-end managed account
lifecycle at the HTTP/API level against a locally-run managed cloud started with a throwaway/test config:
**owner register → issue partner invite → guest partner-invite accept (unauthenticated) → guest upgrade
(`POST /account/upgrade`) → premium lapse (admin subscription grant then lapse, verified via
`/account/billing`) → account deletion (session no longer resolves).**

- **Honest by construction:** every step asserts a real HTTP status/payload; an unreachable server or a
  misbehaving step fails the smoke (exit 1) — it never fabricates a pass. Uses only Node built-ins.
- **Config (env):** `OVUMCY_MANAGED_SMOKE_BASE_URL` (default `http://127.0.0.1:8090`),
  `OVUMCY_SYNC_SMOKE_BASE_URL` (optional; health-checked when set), `OVUMCY_MANAGED_SMOKE_ADMIN_TOKEN`
  (optional — the premium-lapse step is reported as SKIPPED without it).
- **Standing up managed locally:** it uses pure-Go SQLite (no external DB). Build
  `go build -o ovumcy-managed ./cmd/ovumcy-managed` in `ovumcy-managed`, then run with a throwaway config:
  `BIND_ADDR=127.0.0.1:8090`, `DB_PATH=<temp>.sqlite`, a 64-hex `FIELD_ENCRYPTION_KEY`, a 64-hex
  `ENTITLEMENT_SIGNING_KEY` (Ed25519 seed), and a ≥32-char `ADMIN_TOKEN`. The account contour above is
  managed-only; `ovumcy-sync-community` is needed only when account deletion must purge a sync plane
  (`SYNC_BASE_URL` + `SYNC_PURGE_REQUIRED`).
- **Out of scope:** the RN-app-inclusive UI smoke is device-gated (Maestro + device) and not covered here.
