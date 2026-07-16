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
- **Managed billing / entitlement feature keys.** The premium feature vocabulary in the managed billing
  snapshot is consumed by the app's premium surfaces, but it is a versioned server contract without a
  vendored file, and premium-authority rules are security-sensitive (see `SECURITY.md`). Entitlement
  *public keys* already have their own guard (`scripts/verify-entitlement-pubkeys.mjs`); the feature-key set
  is reviewed manually.
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
