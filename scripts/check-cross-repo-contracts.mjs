import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Cross-repo contract freshness guard.
 *
 * Ovumcy-app shares a handful of contracts with its peer repos (ovumcy-web,
 * ovumcy-managed, ovumcy-sync-community). They are encoded as vendored golden
 * fixtures, documented constants, and error-code / locale sets. Each is kept
 * deliberately identical on both sides, but nothing stops one side from being
 * edited alone — the drift then only surfaces at runtime (a mispredicted cycle,
 * an invite that expires on the wrong day, an unhandled TOTP error code, a
 * missing translation). `docs/cross-repo-contracts.md` is the human-readable
 * register; this script is its executable half.
 *
 * The existing `cycle-prediction-reference.test.ts` asserts LOCAL parity (the
 * fixture matches the TS prediction code). This guard is orthogonal: it asserts
 * CROSS-REPO freshness (the local copy still matches the authoritative peer
 * copy). It never re-implements any peer's logic — it only compares vendored
 * artifacts / declared constants byte- or set-wise.
 *
 * Two source modes, selected by environment so the guard is testable offline:
 *   - local-peer mode  (OVUMCY_PEER_ROOT is set): peer files are read from
 *                       `${OVUMCY_PEER_ROOT}/<peer-repo>/<path>`. Used by the
 *                       offline proof and by anyone with the sibling repos
 *                       checked out (e.g. OVUMCY_PEER_ROOT=D:\ovumcy).
 *   - remote mode      (default, used in CI): peer files are fetched from the
 *                       GitHub Contents API with `Accept: application/vnd.github.raw`.
 *
 * The app-side ("local copy") files are ALWAYS read from this checkout, in both
 * modes — the whole point is to validate the files in the current tree, so an
 * OVUMCY_PEER_ROOT override never redirects the app side.
 *
 * Remote auth: ovumcy-managed is a private repo, so CI must supply a read-only
 * token. It is read from OVUMCY_CONTRACTS_TOKEN (falling back to GH_TOKEN /
 * GITHUB_TOKEN) and sent as a Bearer credential; the token value is never
 * logged. The required CI secret is documented in `docs/cross-repo-contracts.md`.
 * The public peers (ovumcy-web, ovumcy-sync-community) also work token-less.
 *
 * Exit code: 0 when every automated contract is in sync; 1 on any drift or any
 * source that could not be evaluated (fail-closed). Manually-reviewed contracts
 * are listed in the doc, not enforced here.
 *
 * Two side modes operate on `cross-repo-manifest.json`, the compatibility lock:
 *   --validate-manifest   compares the recorded SHAs against LOCAL checkouts
 *                         (git HEADs); a workspace/release step, not a CI one.
 *   --check-manifest-refs validates the file's shape and re-resolves every
 *                         recorded branch/commit pair against the GitHub API.
 *                         Remote-only, so CI can run it; this is the mode the
 *                         Cross-repo contracts workflow uses.
 */

const LOG_PREFIX = "cross-repo-check:";
const PEER_OWNER = "ovumcy";
const APP_REPO = "ovumcy-app";
// The peers the automated contracts above read from. The manifest must carry an
// entry for each of them plus the app itself.
const PEER_REPOS = ["ovumcy-web", "ovumcy-managed", "ovumcy-sync-community"];
const DEFAULT_REF = "main";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(scriptDir, "..");

const PEER_ROOT = process.env.OVUMCY_PEER_ROOT?.trim() || null;
const MODE = PEER_ROOT ? "local-peer" : "remote";
const REF = process.env.OVUMCY_CONTRACTS_REF?.trim() || DEFAULT_REF;
const TOKEN =
  process.env.OVUMCY_CONTRACTS_TOKEN?.trim() ||
  process.env.GH_TOKEN?.trim() ||
  process.env.GITHUB_TOKEN?.trim() ||
  null;

// -- source loading ---------------------------------------------------------

/** Short, stable digest used only to make byte-comparison output legible. */
function shortSha(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 12);
}

/**
 * Loads one source file as { buffer, text }. App-side sources always come from
 * this checkout; peer-side sources come from OVUMCY_PEER_ROOT (local mode) or
 * the GitHub Contents API (remote mode). Results are cached per logical ref so
 * a file used by two contracts is fetched once. Throws a descriptive Error the
 * caller turns into an "error" verdict.
 */
const sourceCache = new Map();
async function loadSource(ref) {
  const isApp = ref.repo === APP_REPO;
  const cacheKey = `${isApp ? "app" : MODE}:${ref.repo}:${ref.path}`;
  if (sourceCache.has(cacheKey)) {
    return sourceCache.get(cacheKey);
  }
  const promise = isApp
    ? readLocalFile(path.join(REPO_ROOT, ref.path))
    : MODE === "local-peer"
      ? readLocalFile(path.join(PEER_ROOT, ref.repo, ref.path))
      : fetchRemoteFile(ref.repo, ref.path);
  sourceCache.set(cacheKey, promise);
  return promise;
}

async function readLocalFile(absPath) {
  let buffer;
  try {
    buffer = await readFile(absPath);
  } catch (cause) {
    throw new Error(`cannot read ${absPath}: ${cause.code ?? cause.message}`);
  }
  return { buffer, text: buffer.toString("utf8") };
}

/**
 * One GitHub API GET with the shared auth and failure semantics. `subject` is
 * the human-readable thing being read; it appears in every error message. The
 * token value is never logged.
 */
async function githubGet(url, accept, repo, subject) {
  const headers = {
    Accept: accept,
    "User-Agent": "ovumcy-cross-repo-check",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (TOKEN) {
    headers.Authorization = `Bearer ${TOKEN}`;
  }
  let response;
  try {
    response = await fetch(url, { headers, redirect: "error" });
  } catch (cause) {
    throw new Error(`network error fetching ${subject}: ${cause.message}`);
  }
  if (!response.ok) {
    const denied =
      response.status === 404 || response.status === 403 || response.status === 401;
    let hint = "";
    if (denied) {
      hint = TOKEN
        ? " (token present — confirm it has read access to this repo/path/ref)"
        : ` (no token set — a private peer needs OVUMCY_CONTRACTS_TOKEN with read access to ${PEER_OWNER}/${repo}; see docs/cross-repo-contracts.md)`;
    }
    const error = new Error(`GitHub returned ${response.status} for ${subject}${hint}`);
    if (!TOKEN && denied) {
      // No credentials at all: a private peer is unreadable by construction,
      // and a public peer answering 401/403/404 without a token is the same
      // shape. This run cannot see the peer, which is not the same finding as
      // "the contract diverged" — mark it so the caller can skip rather than
      // report drift it never observed. Dependabot and fork pull requests take
      // this path: they receive no repository secrets.
      error.unreadablePeer = true;
    }
    throw error;
  }
  return response;
}

async function fetchRemoteFile(repo, filePath) {
  const url = `https://api.github.com/repos/${PEER_OWNER}/${repo}/contents/${filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?ref=${encodeURIComponent(REF)}`;
  const response = await githubGet(
    url,
    "application/vnd.github.raw",
    repo,
    `${repo}/${filePath}@${REF}`,
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, text: buffer.toString("utf8") };
}

/**
 * Resolves a recorded (branch, commit) pair against a repo. Returns the branch
 * tip, the merge base with the recorded commit, and how far the commit sits
 * behind the tip. A branch that no longer exists answers 404, which is how a
 * pin left on a deleted feature branch surfaces.
 */
async function fetchRefRelation(repo, branch, commit) {
  const encodedBranch = branch.split("/").map(encodeURIComponent).join("/");
  const url = `https://api.github.com/repos/${PEER_OWNER}/${repo}/compare/${encodedBranch}...${encodeURIComponent(commit)}`;
  const response = await githubGet(
    url,
    "application/vnd.github+json",
    repo,
    `${repo}/compare/${branch}...${commit.slice(0, 12)}`,
  );
  const payload = await response.json();
  return {
    tip: payload.base_commit?.sha ?? null,
    mergeBase: payload.merge_base_commit?.sha ?? null,
    behindBy: typeof payload.behind_by === "number" ? payload.behind_by : null,
  };
}

// -- text helpers -----------------------------------------------------------

/** 1-based line number of the first regex match, or null. */
function lineOf(text, regex) {
  const match = regex.exec(text);
  if (!match) return null;
  return text.slice(0, match.index).split(/\r\n|\r|\n/).length;
}

function locate(ref, text, regex) {
  const line = regex ? lineOf(text, regex) : null;
  return `${ref.repo}/${ref.path}${line ? `:${line}` : ""}`;
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

function sortedList(iterable) {
  return [...iterable].sort();
}

// -- extractors -------------------------------------------------------------

const GO_UNIT_HOURS = { Hour: 1, Minute: 1 / 60, Second: 1 / 3600 };

/**
 * Evaluates a restricted Go duration expression of integer literals times a
 * single time.<Unit> factor (e.g. "7 * 24 * time.Hour") to a day count. Throws
 * on any shape it does not recognise so an unexpected refactor fails loudly
 * rather than silently mis-reading the TTL.
 */
function goDurationToDays(expr) {
  const cleaned = expr.replace(/\/\/.*$/, "").trim();
  const factors = cleaned.split("*").map((token) => token.trim());
  let scalar = 1;
  let unitHours = null;
  for (const factor of factors) {
    if (/^\d+$/.test(factor)) {
      scalar *= Number(factor);
      continue;
    }
    const unit = /^time\.(Hour|Minute|Second)$/.exec(factor);
    if (unit) {
      if (unitHours !== null) {
        throw new Error(`multiple time units in "${cleaned}"`);
      }
      unitHours = GO_UNIT_HOURS[unit[1]];
      continue;
    }
    throw new Error(`unrecognised factor "${factor}" in "${cleaned}"`);
  }
  if (unitHours === null) {
    throw new Error(`no time.<Unit> factor in "${cleaned}"`);
  }
  return (scalar * unitHours) / 24;
}

function extractManagedInviteTtlDays(text) {
  const match = /defaultPartnerInviteTTL\s*=\s*([^\r\n]+)/.exec(text);
  if (!match) {
    throw new Error("defaultPartnerInviteTTL declaration not found");
  }
  return goDurationToDays(match[1]);
}

function extractReadmeInviteTtlDays(text) {
  const match = /(\d+)\s*-?\s*day\s+invite\s+token\s+TTL/i.exec(text);
  if (!match) {
    throw new Error('"<N>-day invite token TTL" phrase not found in README');
  }
  return Number(match[1]);
}

/** TOTP error codes the app declares, scoped to one sync API client file. */
function extractAppTotpKeys(text) {
  const keys = new Set();
  for (const match of text.matchAll(/"(totp_[a-z_]+)"/g)) {
    keys.add(match[1]);
  }
  if (keys.size === 0) {
    throw new Error("no quoted totp_* error keys found");
  }
  return keys;
}

/** TOTP error codes a Go backend actually emits (writeError sink only). */
function extractBackendTotpKeys(text) {
  const keys = new Set();
  for (const match of text.matchAll(/writeError\([^)]*"(totp_[a-z_]+)"/g)) {
    keys.add(match[1]);
  }
  if (keys.size === 0) {
    throw new Error("no writeError(...\"totp_*\") sinks found");
  }
  return keys;
}

function extractAppLocales(text) {
  const decl = /InterfaceLanguage\s*=\s*([^;]+);/.exec(text);
  if (!decl) {
    throw new Error("InterfaceLanguage type alias not found");
  }
  const locales = new Set();
  for (const match of decl[1].matchAll(/"([a-z]{2})"/g)) {
    locales.add(match[1]);
  }
  if (locales.size === 0) {
    throw new Error("InterfaceLanguage union has no string members");
  }
  return locales;
}

function extractWebLocales(text) {
  const constants = new Map();
  for (const match of text.matchAll(/\b(Lang[A-Za-z]+)\s*=\s*"([a-z]{2})"/g)) {
    constants.set(match[1], match[2]);
  }
  const decl = /requiredLocales\s*=\s*\[\]string\{([^}]*)\}/.exec(text);
  if (!decl) {
    throw new Error("requiredLocales declaration not found");
  }
  const locales = new Set();
  for (const token of decl[1].split(",")) {
    const name = token.trim();
    if (name.length === 0) continue;
    const value = constants.get(name);
    if (!value) {
      throw new Error(`requiredLocales references unknown constant "${name}"`);
    }
    locales.add(value);
  }
  if (locales.size === 0) {
    throw new Error("requiredLocales is empty");
  }
  return locales;
}

// -- route-table extractors -------------------------------------------------

/**
 * Normalises a route path so an app template-literal segment and a managed
 * net/http wildcard segment compare equal: `${encodeURIComponent(grantID)}` and
 * `{grant_id}` both collapse to `{}`. Method and the fixed segments are what the
 * contract turns on; the parameter name is not.
 */
function normalizeRoutePath(rawPath) {
  return rawPath
    .replace(/\$\{[^}]*\}/g, "{}") // app template-literal params
    .replace(/\{[^}]*\}/g, "{}"); // managed net/http wildcard params
}

/**
 * The set of managed routes the app client actually calls. Every request goes
 * through one of the request* helpers shaped
 * `request<Kind>(fetchImpl, <baseURL>, <path>, <opts-or-input>)`: the path is a
 * string or template literal, and the method is the `{ method: "..." }` of the
 * options object, or POST for the `requestAuthResult` wrapper (register/login),
 * whose fourth argument is the bare `input`. The `requestAuthResult` body itself
 * calls `requestJSON(..., path, ...)` with a non-literal `path`, so it is
 * skipped and each endpoint is captured exactly once at its literal call site.
 * Returns a Set of "METHOD /normalized/path".
 */
function extractAppManagedRoutes(text) {
  const routes = new Set();
  const callRe =
    /request(?:AuthResult|JSON|NoPayload)\s*(?:<[^>]*>)?\s*\(\s*fetchImpl\s*,\s*(?:normalizedBaseURL|baseURL)\s*,\s*(`[^`]*`|"[^"]*")\s*,\s*(input\b|\{\s*method\s*:\s*"(GET|POST|PUT|DELETE)")/g;
  for (const match of text.matchAll(callRe)) {
    const rawPath = match[1].slice(1, -1); // strip the surrounding quote/backtick
    const method = match[3] ?? "POST"; // the requestAuthResult (input) wrapper is always POST
    routes.add(`${method} ${normalizeRoutePath(rawPath)}`);
  }
  if (routes.size === 0) {
    throw new Error(
      "no request*(fetchImpl, baseURL, path, ...) calls found in the managed client",
    );
  }
  return routes;
}

/** The set of routes the managed server registers in its mux (method + path). */
function extractManagedServerRoutes(text) {
  const routes = new Set();
  for (const match of text.matchAll(
    /HandleFunc\(\s*"(GET|POST|PUT|DELETE)\s+([^"]+)"/g,
  )) {
    routes.add(`${match[1]} ${normalizeRoutePath(match[2])}`);
  }
  if (routes.size === 0) {
    throw new Error(
      'no s.mux.HandleFunc("METHOD /path", ...) registrations found in server.go',
    );
  }
  return routes;
}

// -- BBT detector-rule extractors -------------------------------------------

/**
 * The governing constants of the app's "3-over-6" observed-ovulation detector:
 * the coverline window, the elevated-streak length, the third-day margin, and
 * the set of cycle factors that remove a day from the detection series.
 */
function extractAppBBTRuleConstants(text) {
  const window = /BBT_COVERLINE_WINDOW\s*=\s*(\d+)/.exec(text);
  const streak = /BBT_ELEVATED_STREAK_DAYS\s*=\s*(\d+)/.exec(text);
  const margin = /BBT_THIRD_DAY_MARGIN_CELSIUS\s*=\s*([\d.]+)/.exec(text);
  const factorsDecl = /BBT_DISTURBANCE_FACTORS[^=]*=\s*\[([^\]]*)\]/.exec(text);
  if (!window || !streak || !margin || !factorsDecl) {
    throw new Error("app BBT detector-rule constants not found");
  }
  const disturbanceFactors = new Set();
  for (const m of factorsDecl[1].matchAll(/"([a-z_]+)"/g)) {
    disturbanceFactors.add(m[1]);
  }
  return {
    coverlineWindow: Number(window[1]),
    streakDays: Number(streak[1]),
    thirdDayMargin: Number(margin[1]),
    disturbanceFactors,
  };
}

/**
 * The same governing constants on ovumcy-web's detector. The disturbance set is
 * expressed in `isBBTDisturbedLog` as `models.CycleFactor*` names, so each name
 * is resolved to its string value from `internal/models/cycle_factor.go`
 * (mirroring how the locale contract resolves web's `Lang*` constants).
 */
function extractWebBBTRuleConstants(signalsText, factorText) {
  const window = /bbtCoverlineWindow\s*=\s*(\d+)/.exec(signalsText);
  const streak = /bbtElevatedStreakDays\s*=\s*(\d+)/.exec(signalsText);
  const margin = /bbtThirdDayMarginCelsius\s*=\s*([\d.]+)/.exec(signalsText);
  if (!window || !streak || !margin) {
    throw new Error("web BBT detector-rule constants not found");
  }
  const disturbedFn = /func isBBTDisturbedLog[\s\S]*?\n\}/.exec(signalsText);
  const scope = disturbedFn ? disturbedFn[0] : signalsText;
  const factorNames = new Set();
  for (const m of scope.matchAll(/models\.(CycleFactor[A-Za-z]+)/g)) {
    factorNames.add(m[1]);
  }
  if (factorNames.size === 0) {
    throw new Error("web isBBTDisturbedLog references no models.CycleFactor* constants");
  }
  const disturbanceFactors = new Set();
  for (const name of factorNames) {
    const decl = new RegExp(`${name}\\s*=\\s*"([a-z_]+)"`).exec(factorText);
    if (!decl) {
      throw new Error(`web cycle-factor constant ${name} not found in cycle_factor.go`);
    }
    disturbanceFactors.add(decl[1]);
  }
  return {
    coverlineWindow: Number(window[1]),
    streakDays: Number(streak[1]),
    thirdDayMargin: Number(margin[1]),
    disturbanceFactors,
  };
}

// -- entitlement-token extractors -------------------------------------------

/**
 * The app side of the signed-entitlement contract: the fixed iss/aud/alg the
 * verifier enforces, the two token-gated feature keys it overlays, and the
 * embedded kid -> public-key map (for the kid-derivation self-check).
 */
function extractAppEntitlementContract(tokenText, featuresText) {
  const iss = /ENTITLEMENT_TOKEN_ISSUER\s*=\s*"([^"]+)"/.exec(tokenText);
  const aud = /ENTITLEMENT_TOKEN_AUDIENCE\s*=\s*"([^"]+)"/.exec(tokenText);
  // The accepted algorithm is the one the verifier rejects everything else
  // against (`header.alg !== "EdDSA"`). Skip the earlier structural guard
  // `typeof header.alg !== "string"`, which is not the algorithm comparison.
  const alg = /(?<!typeof\s{0,8})header\.alg\s*!==\s*"([^"]+)"/.exec(tokenText);
  if (!iss || !aud || !alg) {
    throw new Error("app entitlement iss/aud/alg constants not found");
  }
  const featuresDecl =
    /TOKEN_GATED_FEATURE_BY_ENTITLEMENT[\s\S]*?\{([\s\S]*?)\}/.exec(featuresText);
  if (!featuresDecl) {
    throw new Error("app TOKEN_GATED_FEATURE_BY_ENTITLEMENT map not found");
  }
  const features = new Set();
  for (const m of featuresDecl[1].matchAll(/([a-z_]+)\s*:/g)) {
    features.add(m[1]);
  }
  const keys = new Map();
  for (const m of tokenText.matchAll(/"([0-9a-f]{16})"\s*:\s*"([0-9a-f]{64})"/g)) {
    keys.set(m[1], m[2]);
  }
  return { iss: iss[1], aud: aud[1], alg: alg[1], features, keys };
}

/**
 * The managed (issuer) side: the fixed iss/aud/alg the signer stamps, and the
 * ordered token-gated feature keys `localPremiumEntitlements` mints. `key:` only
 * appears in that slice literal (the struct field is `key<spaces>string`), so a
 * whole-file scan is unambiguous.
 */
function extractManagedEntitlementContract(securityText, serviceText) {
  const iss = /EntitlementTokenIssuer\s*=\s*"([^"]+)"/.exec(securityText);
  const aud = /EntitlementTokenAudience\s*=\s*"([^"]+)"/.exec(securityText);
  const alg = /entitlementTokenAlg\s*=\s*"([^"]+)"/.exec(securityText);
  if (!iss || !aud || !alg) {
    throw new Error("managed entitlement iss/aud/alg constants not found");
  }
  const features = new Set();
  for (const m of serviceText.matchAll(/\bkey:\s*"([a-z_]+)"/g)) {
    features.add(m[1]);
  }
  if (features.size === 0) {
    throw new Error("managed localPremiumEntitlements keys not found");
  }
  return { iss: iss[1], aud: aud[1], alg: alg[1], features };
}

/**
 * Managed's kid derivation (security.KidForPublicKey): the lowercase hex of the
 * first 8 bytes of sha256(pubkey32). The app embeds (kid -> pubkey) pairs, so
 * re-deriving the kid from each embedded pubkey proves the app's map follows the
 * managed rule — the exact formula a mis-built EXPO_PUBLIC_ENTITLEMENT_PUBKEYS
 * would get wrong (unknown_kid at runtime; see print_entitlement_kid.go).
 */
function deriveEntitlementKid(pubkeyHex) {
  const digest = createHash("sha256").update(Buffer.from(pubkeyHex, "hex")).digest();
  return digest.subarray(0, 8).toString("hex");
}

// -- set-parity comparison --------------------------------------------------

/**
 * Compares named sets that must all be identical (no single authority — every
 * source is peer to the others). Returns { inSync, lines } where lines explain
 * per-source membership on drift.
 */
function compareParitySets(entries) {
  const union = new Set();
  for (const entry of entries) {
    for (const value of entry.set) union.add(value);
  }
  const reference = entries[0].set;
  const inSync = entries.every((entry) => setsEqual(entry.set, reference));

  const lines = [];
  if (inSync) {
    lines.push(`    all ${entries.length} sources agree: ${sortedList(reference).join(", ")}`);
    for (const entry of entries) {
      lines.push(`      - ${entry.where}`);
    }
    return { inSync, lines };
  }

  lines.push(`    union across sources: ${sortedList(union).join(", ")}`);
  for (const entry of entries) {
    const missing = sortedList(union).filter((value) => !entry.set.has(value));
    const suffix = missing.length ? `  MISSING: ${missing.join(", ")}` : "  (has all)";
    lines.push(`      - ${entry.where}: ${sortedList(entry.set).join(", ")}${suffix}`);
  }
  return { inSync, lines };
}

// -- contracts --------------------------------------------------------------

const CONTRACTS = [
  {
    id: "cycle-prediction-golden-vectors",
    title: "Cycle-prediction golden vectors (byte-identical fixture)",
    impact:
      "diverging vectors mean the app and ovumcy-web predict cycles differently for the same input.",
    async evaluate(load) {
      const appRef = {
        repo: APP_REPO,
        path: "src/services/__fixtures__/cycle-prediction-golden-vectors.json",
      };
      const webRef = {
        repo: "ovumcy-web",
        path: "internal/services/testdata/cycle-prediction-golden-vectors.json",
      };
      const app = await load(appRef);
      const web = await load(webRef);
      const appSha = shortSha(app.buffer);
      const webSha = shortSha(web.buffer);
      const inSync = app.buffer.equals(web.buffer);
      const lines = [
        `    app copy:           ${appRef.repo}/${appRef.path} (${app.buffer.length} B, sha ${appSha})`,
        `    authoritative copy: ${webRef.repo}/${webRef.path} (${web.buffer.length} B, sha ${webSha})`,
      ];
      if (!inSync) {
        lines.push("    -> byte mismatch: re-vendor the ovumcy-web fixture into the app fixture verbatim.");
      }
      return { status: inSync ? "in-sync" : "drift", lines };
    },
  },
  {
    id: "partner-invite-ttl",
    title: "Partner-invite TTL (defaultPartnerInviteTTL vs README)",
    impact:
      "a stale README TTL misstates when a shared invite link expires; managed Go is the runtime authority.",
    async evaluate(load) {
      const managedRef = {
        repo: "ovumcy-managed",
        path: "internal/services/partner_service.go",
      };
      const appRef = { repo: APP_REPO, path: "README.md" };
      const managed = await load(managedRef);
      const app = await load(appRef);
      const managedDays = extractManagedInviteTtlDays(managed.text);
      const readmeDays = extractReadmeInviteTtlDays(app.text);
      const inSync = managedDays === readmeDays;
      const lines = [
        `    authority: ${locate(managedRef, managed.text, /defaultPartnerInviteTTL/)} = ${managedDays} day(s)`,
        `    app doc:   ${locate(appRef, app.text, /(\d+)\s*-?\s*day\s+invite\s+token\s+TTL/i)} = ${readmeDays} day(s)`,
      ];
      if (!inSync) {
        lines.push(`    -> mismatch: README states ${readmeDays}d but managed enforces ${managedDays}d.`);
      }
      return { status: inSync ? "in-sync" : "drift", lines };
    },
  },
  {
    id: "totp-error-keys",
    title: "TOTP error-key set (app clients vs both backends)",
    impact:
      "a backend key the app does not handle degrades to a generic error; an app key no backend emits is dead UX.",
    async evaluate(load) {
      const refs = {
        appManaged: { repo: APP_REPO, path: "src/sync/managed-cloud-api-client.ts" },
        appSync: { repo: APP_REPO, path: "src/sync/sync-api-client.ts" },
        managed: { repo: "ovumcy-managed", path: "internal/api/totp_handlers.go" },
        sync: { repo: "ovumcy-sync-community", path: "internal/api/server.go" },
      };
      const [appManaged, appSync, managed, sync] = await Promise.all([
        load(refs.appManaged),
        load(refs.appSync),
        load(refs.managed),
        load(refs.sync),
      ]);
      const entries = [
        {
          set: extractAppTotpKeys(appManaged.text),
          where: locate(refs.appManaged, appManaged.text, /"totp_/),
        },
        {
          set: extractAppTotpKeys(appSync.text),
          where: locate(refs.appSync, appSync.text, /"totp_/),
        },
        {
          set: extractBackendTotpKeys(managed.text),
          where: locate(refs.managed, managed.text, /mapTOTPError/),
        },
        {
          set: extractBackendTotpKeys(sync.text),
          where: locate(refs.sync, sync.text, /mapTOTPError/),
        },
      ];
      const { inSync, lines } = compareParitySets(entries);
      return { status: inSync ? "in-sync" : "drift", lines };
    },
  },
  {
    id: "supported-locales",
    title: "Supported locale set (app InterfaceLanguage vs ovumcy-web requiredLocales)",
    impact:
      "web is the Free-tier locale baseline; a locale in one repo but not the other ships partial translations.",
    async evaluate(load) {
      const appRef = { repo: APP_REPO, path: "src/models/profile.ts" };
      const webRef = { repo: "ovumcy-web", path: "internal/i18n/i18n.go" };
      const app = await load(appRef);
      const web = await load(webRef);
      const entries = [
        {
          set: extractAppLocales(app.text),
          where: locate(appRef, app.text, /InterfaceLanguage\s*=/),
        },
        {
          set: extractWebLocales(web.text),
          where: locate(webRef, web.text, /requiredLocales\s*=/),
        },
      ];
      const { inSync, lines } = compareParitySets(entries);
      return { status: inSync ? "in-sync" : "drift", lines };
    },
  },
  {
    id: "client-routes-vs-server",
    title: "Managed client routes vs server route table (app calls vs managed exposes)",
    impact:
      "an app call to a method+path the managed server does not register is a runtime 404 on a live account flow — the exact defect class this guard was widened to catch.",
    async evaluate(load) {
      const appRef = { repo: APP_REPO, path: "src/sync/managed-cloud-api-client.ts" };
      const managedRef = { repo: "ovumcy-managed", path: "internal/api/server.go" };
      const app = await load(appRef);
      const managed = await load(managedRef);
      const appRoutes = extractAppManagedRoutes(app.text);
      const managedRoutes = extractManagedServerRoutes(managed.text);
      const missing = sortedList(
        [...appRoutes].filter((route) => !managedRoutes.has(route)),
      );
      const inSync = missing.length === 0;
      const lines = [
        `    app client:  ${locate(appRef, app.text, /request(?:AuthResult|JSON|NoPayload)/)} calls ${appRoutes.size} managed route(s)`,
        `    managed mux: ${locate(managedRef, managed.text, /HandleFunc\(/)} registers ${managedRoutes.size} route(s)`,
      ];
      if (inSync) {
        lines.push(`    all client routes are served: ${sortedList(appRoutes).join(", ")}`);
      } else {
        lines.push(`    -> app calls ${missing.length} route(s) managed does NOT expose:`);
        for (const route of missing) {
          lines.push(`         ${route}`);
        }
      }
      return { status: inSync ? "in-sync" : "drift", lines };
    },
  },
  {
    id: "bbt-observed-ovulation-rule",
    title: "Observed-ovulation detector rule (app observed-ovulation-service vs ovumcy-web cycle_signals)",
    impact:
      "the '3-over-6' constants drifting on one side means the app and ovumcy-web infer a different observed-ovulation date from the same BBT/mucus log — the shared bbt-observed-ovulation-vectors fixture would no longer hold on both sides.",
    async evaluate(load) {
      const appRef = {
        repo: APP_REPO,
        path: "src/services/observed-ovulation-service.ts",
      };
      const webSignalsRef = {
        repo: "ovumcy-web",
        path: "internal/services/cycle_signals.go",
      };
      const webFactorRef = {
        repo: "ovumcy-web",
        path: "internal/models/cycle_factor.go",
      };
      const [app, webSignals, webFactor] = await Promise.all([
        load(appRef),
        load(webSignalsRef),
        load(webFactorRef),
      ]);
      const appRule = extractAppBBTRuleConstants(app.text);
      const webRule = extractWebBBTRuleConstants(webSignals.text, webFactor.text);
      const diffs = [];
      if (appRule.coverlineWindow !== webRule.coverlineWindow) {
        diffs.push(`coverline window: app ${appRule.coverlineWindow} vs web ${webRule.coverlineWindow}`);
      }
      if (appRule.streakDays !== webRule.streakDays) {
        diffs.push(`elevated-streak days: app ${appRule.streakDays} vs web ${webRule.streakDays}`);
      }
      if (appRule.thirdDayMargin !== webRule.thirdDayMargin) {
        diffs.push(`third-day margin: app ${appRule.thirdDayMargin} vs web ${webRule.thirdDayMargin}`);
      }
      if (!setsEqual(appRule.disturbanceFactors, webRule.disturbanceFactors)) {
        diffs.push(
          `disturbance factors: app {${sortedList(appRule.disturbanceFactors).join(", ")}} vs web {${sortedList(webRule.disturbanceFactors).join(", ")}}`,
        );
      }
      const inSync = diffs.length === 0;
      const lines = [
        `    app rule: ${locate(appRef, app.text, /BBT_COVERLINE_WINDOW/)} = coverline ${appRule.coverlineWindow} / streak ${appRule.streakDays} / margin ${appRule.thirdDayMargin} / exclude {${sortedList(appRule.disturbanceFactors).join(", ")}}`,
        `    web rule: ${locate(webSignalsRef, webSignals.text, /bbtCoverlineWindow/)} = coverline ${webRule.coverlineWindow} / streak ${webRule.streakDays} / margin ${webRule.thirdDayMargin} / exclude {${sortedList(webRule.disturbanceFactors).join(", ")}}`,
      ];
      if (inSync) {
        lines.push(
          "    both detectors share the rule; the shared bbt-observed-ovulation-vectors fixture (app reference test) holds on both sides.",
        );
      } else {
        for (const diff of diffs) {
          lines.push(`    -> ${diff}`);
        }
      }
      return { status: inSync ? "in-sync" : "drift", lines };
    },
  },
  {
    id: "entitlement-token-lifecycle",
    title: "Signed-entitlement token contract (app verifier vs managed issuer)",
    impact:
      "a divergence in iss/aud/alg, the token-gated feature set, or the kid-derivation rule means the app either rejects every managed-issued token (premium silently stays locked) or trusts a token the issuer never mints.",
    async evaluate(load) {
      const appTokenRef = { repo: APP_REPO, path: "src/security/entitlement-token.ts" };
      const appFeaturesRef = {
        repo: APP_REPO,
        path: "src/services/managed-premium-features-service.ts",
      };
      const managedSecurityRef = {
        repo: "ovumcy-managed",
        path: "internal/security/entitlement_token.go",
      };
      const managedServiceRef = {
        repo: "ovumcy-managed",
        path: "internal/services/entitlement_token_service.go",
      };
      const [appToken, appFeatures, managedSecurity, managedService] =
        await Promise.all([
          load(appTokenRef),
          load(appFeaturesRef),
          load(managedSecurityRef),
          load(managedServiceRef),
        ]);
      const appContract = extractAppEntitlementContract(
        appToken.text,
        appFeatures.text,
      );
      const managedContract = extractManagedEntitlementContract(
        managedSecurity.text,
        managedService.text,
      );

      const diffs = [];
      if (appContract.iss !== managedContract.iss) {
        diffs.push(`issuer (iss): app "${appContract.iss}" vs managed "${managedContract.iss}"`);
      }
      if (appContract.aud !== managedContract.aud) {
        diffs.push(`audience (aud): app "${appContract.aud}" vs managed "${managedContract.aud}"`);
      }
      if (appContract.alg !== managedContract.alg) {
        diffs.push(`algorithm (alg): app "${appContract.alg}" vs managed "${managedContract.alg}"`);
      }
      if (!setsEqual(appContract.features, managedContract.features)) {
        diffs.push(
          `token-gated features: app {${sortedList(appContract.features).join(", ")}} vs managed {${sortedList(managedContract.features).join(", ")}}`,
        );
      }
      // kid-derivation self-check: every embedded (kid -> pubkey) pair must
      // satisfy managed's KidForPublicKey rule (sha256(pubkey)[:8]).
      const kidErrors = [];
      for (const [kid, pubkeyHex] of appContract.keys) {
        const derived = deriveEntitlementKid(pubkeyHex);
        if (derived !== kid) {
          kidErrors.push(`embedded kid ${kid} != sha256(pubkey)[:8] ${derived}`);
        }
      }
      if (appContract.keys.size === 0) {
        kidErrors.push("no embedded (kid -> pubkey) pairs found to verify");
      }

      const inSync = diffs.length === 0 && kidErrors.length === 0;
      const lines = [
        `    app verifier: ${locate(appTokenRef, appToken.text, /ENTITLEMENT_TOKEN_ISSUER/)} iss="${appContract.iss}" aud="${appContract.aud}" alg="${appContract.alg}" gated {${sortedList(appContract.features).join(", ")}}`,
        `    managed issuer: ${locate(managedSecurityRef, managedSecurity.text, /EntitlementTokenIssuer/)} iss="${managedContract.iss}" aud="${managedContract.aud}" alg="${managedContract.alg}" mints {${sortedList(managedContract.features).join(", ")}}`,
        `    kid derivation: ${appContract.keys.size} embedded key(s) checked against sha256(pubkey)[:8]`,
      ];
      if (inSync) {
        lines.push("    verifier and issuer agree on the full token contract.");
      } else {
        for (const diff of diffs) {
          lines.push(`    -> ${diff}`);
        }
        for (const kidError of kidErrors) {
          lines.push(`    -> ${kidError}`);
        }
      }
      return { status: inSync ? "in-sync" : "drift", lines };
    },
  },
];

// -- compatibility manifest -------------------------------------------------

const MANIFEST_PATH = path.join(REPO_ROOT, "cross-repo-manifest.json");

/** Reads a repo's current HEAD, or null when git/the repo is unavailable. */
function gitHead(repoDir) {
  try {
    return execFileSync("git", ["-C", repoDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/** True when `ancestor` is an ancestor of (or equal to) `head` in repoDir. */
function gitIsAncestor(repoDir, ancestor, head) {
  try {
    execFileSync(
      "git",
      ["-C", repoDir, "merge-base", "--is-ancestor", ancestor, head],
      { stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Release lock: validate the four local checkouts against the recorded
 * known-compatible SHAs in cross-repo-manifest.json. Peers are pinned EXACTLY
 * (a peer on any other commit is drift); the app is pinned by ANCESTRY (the
 * recorded base must be an ancestor of, or equal to, the app HEAD) so ongoing
 * app development on the same line still validates.
 *
 * Needs local checkouts: peers are read from `${OVUMCY_PEER_ROOT}/<repo>` when
 * set, else from siblings of this checkout (`../<repo>`). Fail-closed: any repo
 * whose HEAD cannot be read is an ERROR, not a silent pass. Returns 0 when every
 * repo matches, 1 on any drift or unreadable repo.
 */
async function validateManifest() {
  let manifest;
  try {
    const raw = await readFile(MANIFEST_PATH, "utf8");
    manifest = JSON.parse(raw);
  } catch (cause) {
    console.error(`${LOG_PREFIX} cannot read ${MANIFEST_PATH}: ${cause.message}`);
    return 1;
  }

  const peerBase = PEER_ROOT ?? path.resolve(REPO_ROOT, "..");
  console.log(`${LOG_PREFIX} validating workspace against ${path.basename(MANIFEST_PATH)}`);
  console.log(`${LOG_PREFIX} app root=${REPO_ROOT}  peer base=${peerBase}`);
  console.log("");

  const repos = manifest.repos ?? {};
  const rows = [];
  for (const [repo, entry] of Object.entries(repos)) {
    const isApp = repo === APP_REPO;
    const repoDir = isApp ? REPO_ROOT : path.join(peerBase, repo);
    const recorded = String(entry.commit ?? "");
    const head = gitHead(repoDir);
    let status;
    let detail;
    if (!head) {
      status = "error";
      detail = `HEAD unreadable at ${repoDir}`;
    } else if (isApp) {
      const ok = head === recorded || gitIsAncestor(repoDir, recorded, head);
      status = ok ? "match" : "drift";
      detail = ok
        ? `HEAD ${head.slice(0, 12)} is at/after locked base ${recorded.slice(0, 12)}`
        : `HEAD ${head.slice(0, 12)} is NOT a descendant of locked base ${recorded.slice(0, 12)}`;
    } else {
      const ok = head === recorded;
      status = ok ? "match" : "drift";
      detail = ok
        ? `HEAD ${head.slice(0, 12)} == pinned ${recorded.slice(0, 12)}`
        : `HEAD ${head.slice(0, 12)} != pinned ${recorded.slice(0, 12)}`;
    }
    rows.push({ repo, status, detail, pin: isApp ? "ancestor" : "exact" });
  }

  for (const row of rows) {
    const badge = row.status === "match" ? "MATCH" : row.status === "drift" ? "DRIFT" : "ERROR";
    console.log(`[${badge}] ${row.repo} (pin: ${row.pin})`);
    console.log(`    ${row.detail}`);
  }
  console.log("");

  const drift = rows.filter((row) => row.status !== "match");
  if (drift.length === 0) {
    console.log(`${LOG_PREFIX} workspace matches the compatibility manifest (${rows.length} repos).`);
    return 0;
  }
  console.log(`${LOG_PREFIX} ${drift.length} repo(s) diverge from the manifest:`);
  for (const row of drift) {
    console.log(`${LOG_PREFIX}   ${row.status.toUpperCase()} ${row.repo}`);
  }
  return 1;
}

/**
 * The manifest's static shape — every field both manifest modes rely on. An
 * entry that is structurally wrong (a short SHA, a missing branch, a pin mode
 * the validator does not implement) silently degrades `--validate-manifest`
 * into a pass, so the shape is checked before anything is resolved remotely.
 */
function collectManifestShapeProblems(manifest) {
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["the manifest is not a JSON object"];
  }
  const problems = [];
  if (manifest.schemaVersion !== 1) {
    problems.push(
      `schemaVersion must be 1, found ${JSON.stringify(manifest.schemaVersion)}`,
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(manifest.generatedAt ?? ""))) {
    problems.push(
      `generatedAt must be a YYYY-MM-DD date, found ${JSON.stringify(manifest.generatedAt)}`,
    );
  }
  const repos = manifest.repos;
  if (repos === null || typeof repos !== "object" || Array.isArray(repos)) {
    problems.push("repos must be an object keyed by repository name");
    return problems;
  }
  const expected = [APP_REPO, ...PEER_REPOS];
  for (const repo of expected) {
    if (!Object.hasOwn(repos, repo)) {
      problems.push(`repos is missing the ${repo} entry`);
    }
  }
  for (const repo of Object.keys(repos)) {
    if (!expected.includes(repo)) {
      problems.push(`repos carries an entry for unknown repository ${repo}`);
    }
  }
  for (const repo of expected) {
    const entry = repos[repo];
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      if (Object.hasOwn(repos, repo)) {
        problems.push(`${repo} must be an object`);
      }
      continue;
    }
    for (const field of ["role", "branch"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        problems.push(`${repo}.${field} must be a non-empty string`);
      }
    }
    // The branch value flows into a GitHub API request path. Segment-wise
    // encodeURIComponent keeps `/` and `.` intact by design (branch names
    // contain both), so shape validation is what rules out values a URL
    // normalizer could fold into a different endpoint: no `..` segments, no
    // leading dash, git-ref-plausible characters only.
    if (typeof entry.branch === "string" && entry.branch.trim() !== "") {
      const branchOK =
        /^[A-Za-z0-9](?:[A-Za-z0-9._/-]*[A-Za-z0-9])?$/.test(entry.branch) &&
        !entry.branch.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
      if (!branchOK) {
        problems.push(
          `${repo}.branch must look like a git branch name (no empty, "." or ".." path segments, no leading/trailing separators), found ${JSON.stringify(entry.branch)}`,
        );
      }
    }
    if (!/^[0-9a-f]{40}$/.test(String(entry.commit ?? ""))) {
      problems.push(
        `${repo}.commit must be a full 40-hex SHA, found ${JSON.stringify(entry.commit)}`,
      );
    }
    // The app is pinned by ancestry so ongoing app work still validates; the
    // peers are pinned exactly. validateManifest implements exactly these two.
    const expectedPin = repo === APP_REPO ? "ancestor" : "exact";
    if (entry.pin !== expectedPin) {
      problems.push(
        `${repo}.pin must be "${expectedPin}", found ${JSON.stringify(entry.pin)}`,
      );
    }
  }
  return problems;
}

/**
 * Remote-mode manifest verification, the half CI can run: the file's shape, and
 * whether every recorded (branch, commit) pair still resolves on its repository.
 * A pin left on a deleted feature branch, or on a commit that a squash-merge
 * orphaned off that branch, is drift — the record no longer describes anything
 * a reader can check out. Being BEHIND the branch tip is not drift: the manifest
 * records what the contracts were last validated against, so currency stays a
 * refresh decision and is reported as a count, never as a failure.
 *
 * Skipped-vs-error follows the same rule as the contract run: with no token at
 * all an unreadable peer is SKIPPED (dependabot and fork runs receive no repo
 * secrets, so a private peer is invisible by construction); with a token present
 * every failure stays an ERROR, because a token that exists and does not work is
 * a misconfiguration and must stay loud.
 */
async function checkManifestRefs() {
  if (MODE !== "remote") {
    console.error(
      `${LOG_PREFIX} --check-manifest-refs resolves refs through the GitHub API; unset OVUMCY_PEER_ROOT to use it.`,
    );
    return 1;
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch (cause) {
    console.error(`${LOG_PREFIX} cannot read ${MANIFEST_PATH}: ${cause.message}`);
    return 1;
  }

  console.log(
    `${LOG_PREFIX} verifying ${path.basename(MANIFEST_PATH)} (token=${TOKEN ? "present" : "none"})`,
  );
  console.log("");

  const shapeProblems = collectManifestShapeProblems(manifest);
  if (shapeProblems.length > 0) {
    console.log(`[INVALID] manifest shape`);
    for (const problem of shapeProblems) {
      console.log(`    -> ${problem}`);
    }
    console.log("");
    console.log(
      `${LOG_PREFIX} ${shapeProblems.length} shape problem(s); recorded refs not resolved.`,
    );
    return 1;
  }
  const repos = manifest.repos;
  console.log(
    `[VALID] manifest shape: schemaVersion ${manifest.schemaVersion}, generated ${manifest.generatedAt}, ${Object.keys(repos).length} repo entries`,
  );
  console.log("");

  const rows = await Promise.all(
    [APP_REPO, ...PEER_REPOS].map(async (repo) => {
      const entry = repos[repo];
      try {
        const relation = await fetchRefRelation(repo, entry.branch, entry.commit);
        if (relation.mergeBase === entry.commit) {
          const behind =
            relation.behindBy === null
              ? ""
              : `, ${relation.behindBy} commit(s) behind the tip`;
          return {
            repo,
            status: "resolved",
            lines: [
              `    ${entry.commit.slice(0, 12)} is on ${entry.branch} (tip ${String(relation.tip).slice(0, 12)}${behind})`,
            ],
          };
        }
        return {
          repo,
          status: "drift",
          lines: [
            `    ${entry.commit.slice(0, 12)} is NOT reachable from ${entry.branch} (tip ${String(relation.tip).slice(0, 12)})`,
            `    -> the recorded pin no longer describes a commit on the recorded branch; re-record it.`,
          ],
        };
      } catch (cause) {
        const lines = [`    could not resolve: ${cause.message}`];
        if (/GitHub returned 404/.test(cause.message)) {
          // The compare endpoint answers 404 for a ref it cannot resolve, so a
          // deleted branch and an unreadable repository look alike here.
          lines.push(
            `    -> a 404 also covers "branch ${entry.branch} no longer exists"; check that before assuming an access problem.`,
          );
        }
        return {
          repo,
          status: cause.unreadablePeer ? "unreadable" : "error",
          lines,
        };
      }
    }),
  );

  for (const row of rows) {
    const badge =
      row.status === "resolved"
        ? "RESOLVED"
        : row.status === "drift"
          ? "DRIFT   "
          : row.status === "unreadable"
            ? "SKIPPED "
            : "ERROR   ";
    console.log(`[${badge}] ${row.repo} @ ${repos[row.repo].branch}`);
    for (const line of row.lines) {
      console.log(line);
    }
  }
  console.log("");

  const drifted = rows.filter((row) => row.status === "drift");
  const errored = rows.filter((row) => row.status === "error");
  const unreadable = rows.filter((row) => row.status === "unreadable");
  console.log(
    `${LOG_PREFIX} manifest summary: ${rows.length - drifted.length - errored.length - unreadable.length} resolved, ${drifted.length} stale, ${errored.length} not resolved, ${unreadable.length} skipped (repo unreadable)`,
  );
  if (unreadable.length > 0) {
    console.log(
      `${LOG_PREFIX} ${unreadable.length} entr(y/ies) skipped: no OVUMCY_CONTRACTS_TOKEN, so the repository could not be read at all.`,
    );
  }
  return drifted.length === 0 && errored.length === 0 ? 0 : 1;
}

// -- runner -----------------------------------------------------------------

async function main() {
  console.log(`${LOG_PREFIX} mode=${MODE}${MODE === "remote" ? ` ref=${REF} token=${TOKEN ? "present" : "none"}` : ` root=${PEER_ROOT}`}`);
  console.log(`${LOG_PREFIX} checking ${CONTRACTS.length} automated contracts against peer authorities`);
  console.log("");

  const results = [];
  for (const contract of CONTRACTS) {
    try {
      const result = await contract.evaluate(loadSource);
      results.push({ contract, ...result });
    } catch (cause) {
      results.push({
        contract,
        status: cause.unreadablePeer ? "unreadable" : "error",
        lines: [`    could not evaluate: ${cause.message}`],
      });
    }
  }

  for (const result of results) {
    const badge =
      result.status === "in-sync"
        ? "IN SYNC"
        : result.status === "drift"
          ? "DRIFT"
          : result.status === "unreadable"
            ? "SKIPPED"
            : "ERROR";
    console.log(`[${badge}] ${result.contract.title}`);
    for (const line of result.lines) {
      console.log(line);
    }
    if (result.status !== "in-sync") {
      console.log(`    impact: ${result.contract.impact}`);
    }
    console.log("");
  }

  const inSync = results.filter((result) => result.status === "in-sync");
  const drifted = results.filter((result) => result.status === "drift");
  const errored = results.filter((result) => result.status === "error");
  const unreadable = results.filter((result) => result.status === "unreadable");

  console.log(
    `${LOG_PREFIX} summary: ${inSync.length} in sync, ${drifted.length} diverged, ${errored.length} not evaluated, ${unreadable.length} skipped (peer unreadable)`,
  );
  for (const result of [...drifted, ...errored, ...unreadable]) {
    const label =
      result.status === "drift" ? "DIVERGED" : result.status === "error" ? "ERROR   " : "SKIPPED ";
    console.log(`${LOG_PREFIX}   ${label} ${result.contract.id}`);
  }
  if (unreadable.length > 0) {
    // Reporting these as failures would announce drift this run never
    // observed. They stay covered by the push-to-main and scheduled runs,
    // which do carry the token.
    console.log(
      `${LOG_PREFIX} ${unreadable.length} contract(s) skipped: no OVUMCY_CONTRACTS_TOKEN, so the peer could not be read at all.`,
    );
  }
  if (drifted.length === 0 && errored.length === 0) {
    console.log(
      `${LOG_PREFIX} every cross-repo contract this run could evaluate is in sync.`,
    );
  }

  return drifted.length === 0 && errored.length === 0 ? 0 : 1;
}

const VALIDATE_MANIFEST =
  process.argv.includes("--validate-manifest") ||
  /^(1|true)$/i.test(process.env.OVUMCY_VALIDATE_MANIFEST?.trim() ?? "");

const CHECK_MANIFEST_REFS =
  process.argv.includes("--check-manifest-refs") ||
  /^(1|true)$/i.test(process.env.OVUMCY_CHECK_MANIFEST_REFS?.trim() ?? "");

const selected = CHECK_MANIFEST_REFS
  ? checkManifestRefs
  : VALIDATE_MANIFEST
    ? validateManifest
    : main;

selected()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((cause) => {
    console.error(`${LOG_PREFIX} FATAL: ${cause.stack ?? cause.message}`);
    process.exitCode = 1;
  });
