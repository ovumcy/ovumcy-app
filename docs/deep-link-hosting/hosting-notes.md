# Deep-link hosting bundle — `invite.ovumcy.cloud`

Ready-to-upload files for the verified invite host. Full rationale, checklist, and the
implementation order live in [`docs/deep-links.md`](../deep-links.md) (§6–§7); this folder only
packages the artifacts so deploying them is copy-paste.

The [`site/`](site/) subfolder is the same content pre-arranged in upload-ready shape — the
fallback page placed at `backup-sync/index.html` plus a `_headers` file (Cloudflare
Pages/Netlify) forcing `Content-Type: application/json` on both well-known files. Fill in the
placeholders below, then drag `site/` to the static host as-is.

| File | Serve at | Requirements |
| --- | --- | --- |
| `assetlinks.json` | `https://invite.ovumcy.cloud/.well-known/assetlinks.json` | `Content-Type: application/json`, HTTP 200, no redirect |
| `apple-app-site-association` | `https://invite.ovumcy.cloud/.well-known/apple-app-site-association` | same as above; **no `.json` extension** |
| `fallback.html` | `https://invite.ovumcy.cloud/backup-sync` | static only; must never log/echo/persist the `invite_token` query value |

Deployment shape (2026-07-23): DNS for `invite.ovumcy.cloud` already points at the VPS, and the
files are served at deploy time by a Traefik static route — companion infrastructure, not app
code (`docs/deep-links.md` §6–§7). The `_headers` file encodes the contract for
Pages/Netlify-style static hosts; on Traefik the same contract is enforced at the route level:
`Content-Type: application/json` on both well-known paths, direct `200`s, no redirect, no auth
wall, and the AASA file served without a `.json` extension.

Fill in before uploading:

1. **`assetlinks.json`** — replace both placeholders with SHA-256 signing-cert fingerprints
   (colon-separated hex pairs):
   - `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`: Play Console → Test and release → App integrity →
     App signing.
   - `REPLACE_WITH_UPLOAD_KEY_SHA256`: `eas credentials` → Android (or `keytool -list -v`).
   - Keep every certificate that may sign an installed build; drop the second entry if only one
     signing certificate exists yet.
2. **`apple-app-site-association`** — replace `REPLACE_WITH_TEAM_ID` with the Apple Team ID
   (Apple Developer → Membership). The bundle id `app.ovumcy.mobile` is already correct.
3. **`fallback.html`** — add app-store links once the app is published; keep the page fully static.

Only after both well-known files verify on production builds, flip the managed-side
`PARTNER_INVITE_BASE_URL` to `https://invite.ovumcy.cloud/backup-sync` — the last step of
`docs/deep-links.md` §7, and the only one that changes user-visible behavior. Rollback is
reverting that variable.
