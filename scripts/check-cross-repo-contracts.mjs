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
 */

const LOG_PREFIX = "cross-repo-check:";
const PEER_OWNER = "ovumcy";
const APP_REPO = "ovumcy-app";
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

async function fetchRemoteFile(repo, filePath) {
  const url = `https://api.github.com/repos/${PEER_OWNER}/${repo}/contents/${filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}?ref=${encodeURIComponent(REF)}`;
  const headers = {
    Accept: "application/vnd.github.raw",
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
    throw new Error(`network error fetching ${repo}/${filePath}: ${cause.message}`);
  }
  if (!response.ok) {
    let hint = "";
    if (response.status === 404 || response.status === 403 || response.status === 401) {
      hint = TOKEN
        ? " (token present — confirm it has read access to this repo/path/ref)"
        : ` (no token set — a private peer needs OVUMCY_CONTRACTS_TOKEN with read access to ${PEER_OWNER}/${repo}; see docs/cross-repo-contracts.md)`;
    }
    throw new Error(`GitHub returned ${response.status} for ${repo}/${filePath}@${REF}${hint}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, text: buffer.toString("utf8") };
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
];

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
        status: "error",
        lines: [`    could not evaluate: ${cause.message}`],
      });
    }
  }

  for (const result of results) {
    const badge =
      result.status === "in-sync" ? "IN SYNC" : result.status === "drift" ? "DRIFT" : "ERROR";
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

  console.log(`${LOG_PREFIX} summary: ${inSync.length} in sync, ${drifted.length} diverged, ${errored.length} not evaluated`);
  for (const result of [...drifted, ...errored]) {
    console.log(`${LOG_PREFIX}   ${result.status === "drift" ? "DIVERGED" : "ERROR   "} ${result.contract.id}`);
  }
  if (drifted.length === 0 && errored.length === 0) {
    console.log(`${LOG_PREFIX} all cross-repo contracts are in sync.`);
  }

  return drifted.length === 0 && errored.length === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((cause) => {
    console.error(`${LOG_PREFIX} FATAL: ${cause.stack ?? cause.message}`);
    process.exitCode = 1;
  });
