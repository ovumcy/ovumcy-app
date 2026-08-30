// Production dependency-advisory gate.
//
// Replaces a bare `npm audit --omit=dev --audit-level=high` in the required
// security lane, for one reason: that command is all-or-nothing. A single
// advisory with no published fix blocks every merge into main indefinitely,
// and the only ways out of it are a major upgrade on someone else's schedule
// or lowering the severity threshold for everything at once. Neither is a
// decision the gate should force.
//
// So the threshold stays where it was — any HIGH or CRITICAL advisory in the
// production tree fails the build — and the escape hatch is narrow, named and
// dated instead: an entry in ALLOWLIST below excuses exactly one advisory on
// exactly one package, carries the reasoning in the file, and expires. Three
// rules keep it from rotting into a blanket suppression:
//
//   1. an advisory not matched by an entry fails, as before;
//   2. an entry past its reviewBy date fails, so an exception cannot outlive
//      the judgement behind it without someone renewing that judgement;
//   3. an entry that matches nothing fails, so an exception cannot outlive the
//      advisory it was written for and silently cover a future one.
//
// Rules 2 and 3 are the point. An allowlist that only ever grows is how a
// security gate stops being one.
//
// The gate reads a report rather than producing one, so it spawns nothing at
// all — appropriate for a security check, and it makes the whole thing a pure
// function over JSON that can be exercised without a network.
//
// Usage:
//   npm audit --omit=dev --json > audit-report.json || true
//   node scripts/audit-production.mjs audit-report.json
//
// (npm exits non-zero whenever it finds anything, hence the `|| true`: its exit
// code is not the verdict here, this script's is.) The path may also come from
// AUDIT_REPORT_FILE. Exit 0 when clean, 1 when a violation exists.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Severities this gate fails on, matching the `--audit-level=high` it replaces.
const GATED_SEVERITIES = new Set(["high", "critical"]);

// Zero-padded YYYY-MM-DD, the only shape the string comparison in evaluate()
// orders correctly.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when the text is a zero-padded YYYY-MM-DD naming a date that exists.
 *
 * The shape alone is not enough. `2026-13-45` matches the pattern and sorts
 * above every real date in its year, so an exception written that way outlives
 * its intended expiry by more than a year — the exact decay the expiry rule is
 * there to stop, arriving through the typo the rule does not see. Round-tripping
 * through Date rejects both the impossible month and the impossible day, since
 * Date normalises out-of-range components and the result no longer matches.
 */
function isRealISODate(text) {
  if (!ISO_DATE.test(text ?? "")) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === text;
}

/**
 * Each entry excuses ONE advisory on ONE package. `reason` states why the
 * advisory does not reach this product, not merely that it is inconvenient;
 * `reviewBy` is the date the judgement has to be made again.
 */
export const ALLOWLIST = [
  {
    package: "image-size",
    advisory: "GHSA-w3rx-r6r6-pgpr",
    reason:
      "Infinite loop in the ICNS parser. image-size is reached only through metro and the @expo build tooling: it runs on a developer machine or a CI runner while bundling, is not part of the shipped bundle, and never executes on a user's device or touches health data. Triggering it means getting a crafted image into the build inputs, which requires write access to this repository. No published version of image-size is unaffected (the advisory range is `*`), so the only upstream fix is a major Expo SDK upgrade, tracked separately.",
    reviewBy: "2026-11-30",
  },
  {
    package: "image-size",
    advisory: "GHSA-5p2g-fcmc-qvqq",
    reason:
      "Infinite loops in the JXL and HEIF parsers. Same package, same reachability and same absence of a fixed version as the ICNS advisory above.",
    reviewBy: "2026-11-30",
  },
];

/**
 * Reads and parses an `npm audit --omit=dev --json` report from disk.
 */
export function readAuditReport(reportFile) {
  if (!reportFile) {
    throw new Error(
      "audit-production: no report path given — run `npm audit --omit=dev --json > audit-report.json || true` first, then pass that file as an argument or in AUDIT_REPORT_FILE.",
    );
  }
  return JSON.parse(readFileSync(reportFile, "utf8"));
}

/**
 * Walks a package's `via` chain and returns the advisories it ultimately rests
 * on.
 *
 * npm's `via` array holds either an object (this package is where the advisory
 * itself lives) or a string naming another vulnerable package it depends on.
 * Following the strings is what makes the gate complete: on the live report
 * seven of the nine gated packages, the whole metro and @expo chain, carry no
 * object via at all and inherit everything from image-size. Reading only the
 * objects would leave those seven unexamined, and the gate would be resting on
 * the accident that their root happens to be listed.
 */
function rootAdvisoriesFor(report, packageName, seen) {
  if (seen.has(packageName)) return [];
  seen.add(packageName);

  const entry = report.vulnerabilities?.[packageName];
  if (!entry) return [];

  const roots = [];
  for (const via of entry.via ?? []) {
    if (typeof via === "object" && via !== null) {
      roots.push({
        package: via.name ?? entry.name ?? packageName,
        advisory: advisoryIdFromURL(via.url),
        severity: via.severity ?? entry.severity,
        title: via.title ?? "",
      });
      continue;
    }
    if (typeof via === "string") {
      roots.push(...rootAdvisoriesFor(report, via, seen));
    }
  }
  return roots;
}

/**
 * Returns one requirement per package the gate must account for: the package,
 * and the distinct advisories its `via` chain ultimately rests on. A package
 * whose chain yields nothing is returned with an empty list rather than
 * skipped, because the gate has to refuse what it cannot explain.
 */
export function collectGatedPackages(report) {
  const requirements = [];
  for (const [packageName, entry] of Object.entries(
    report.vulnerabilities ?? {},
  )) {
    if (!GATED_SEVERITIES.has(entry.severity)) continue;

    const byKey = new Map();
    for (const root of rootAdvisoriesFor(report, packageName, new Set())) {
      byKey.set(`${root.package} ${root.advisory}`, root);
    }
    requirements.push({ package: packageName, roots: [...byKey.values()] });
  }
  return requirements;
}

// Advisory URLs look like https://github.com/advisories/GHSA-xxxx-yyyy-zzzz.
// npm has always populated this, but an id is what a refusal has to name for
// anyone to act on it, so an absent one says so instead of leaving a blank in
// the middle of the message.
const UNKNOWN_ADVISORY = "(no advisory id in the report)";

function advisoryIdFromURL(url) {
  if (typeof url !== "string") return UNKNOWN_ADVISORY;
  const id = url.split("/").pop();
  return id && id.length > 0 ? id : UNKNOWN_ADVISORY;
}

/**
 * Fails when the parsed JSON is not a usable npm audit report.
 *
 * The workflow writes the report with `|| true`, because npm exits non-zero on
 * any finding — which means a registry outage or an npm error object also
 * leaves a file this script would happily parse. Without this check the result
 * is the one direction a security gate must never fail in: `vulnerabilities`
 * reads as empty, no advisory is found, and a lane that never audited anything
 * prints "clean". The stale-entry rule masks that only while the allowlist is
 * non-empty, and every entry is dated to be deleted.
 *
 * The counts npm computes itself are the cross-check: they must agree with the
 * gated entries actually present, or the report is internally inconsistent and
 * cannot be reasoned about.
 */
export function assertUsableReport(report) {
  if (typeof report?.auditReportVersion !== "number") {
    throw new Error(
      "audit-production: the report carries no auditReportVersion — it is not an `npm audit --json` report (a failed audit whose non-zero exit was swallowed?).",
    );
  }

  const counts = report?.metadata?.vulnerabilities;
  if (typeof counts?.high !== "number" || typeof counts?.critical !== "number") {
    throw new Error(
      "audit-production: the report carries no metadata.vulnerabilities counts — it is truncated or not an npm audit report.",
    );
  }

  const gatedEntries = Object.values(report.vulnerabilities ?? {}).filter(
    (entry) => GATED_SEVERITIES.has(entry.severity),
  ).length;
  const expected = counts.high + counts.critical;
  if (gatedEntries !== expected) {
    throw new Error(
      `audit-production: the report is inconsistent — metadata counts ${expected} high/critical package(s) but the vulnerabilities map holds ${gatedEntries}.`,
    );
  }
}

/**
 * Fails on an allowlist entry that cannot be enforced as written.
 *
 * reviewBy is compared as a plain ISO string, so an unpadded or reordered date
 * ("2026-9-30", "30-11-2026") would sort above every real date and the entry
 * would never expire — the exact decay the dated allowlist exists to prevent,
 * and invisible without this check.
 */
export function assertWellFormedAllowlist(allowlist) {
  for (const entry of allowlist) {
    if (!entry.package || !entry.advisory) {
      throw new Error(
        "audit-production: an allowlist entry is missing its package or advisory id.",
      );
    }
    if (!isRealISODate(entry.reviewBy)) {
      throw new Error(
        `audit-production: the exception for ${entry.package} ${entry.advisory} has reviewBy "${entry.reviewBy}", which is not a real zero-padded YYYY-MM-DD date and so would expire late or never.`,
      );
    }
    if (!entry.reason || entry.reason.trim().length === 0) {
      throw new Error(
        `audit-production: the exception for ${entry.package} ${entry.advisory} carries no reason.`,
      );
    }
  }
}

/**
 * Returns the reasons the gate must refuse, empty when it may pass.
 *
 * Every gated package has to be explained: its chain must rest on at least one
 * advisory, and every advisory it rests on must carry a current exception. The
 * unmatched-entry sweep at the end is the other direction — an exception that
 * covers nothing is stale and has to go, or the list quietly outlives what it
 * was written for.
 */
export function evaluate(requirements, allowlist, today) {
  const failures = [];
  const matched = new Set();

  for (const requirement of requirements) {
    if (requirement.roots.length === 0) {
      failures.push(
        `${requirement.package}: flagged high or critical, but its via chain names no advisory — the gate cannot tell what it is being asked to excuse`,
      );
      continue;
    }

    for (const root of requirement.roots) {
      const index = allowlist.findIndex(
        (entry) =>
          entry.package === root.package && entry.advisory === root.advisory,
      );
      if (index === -1) {
        const inherited =
          root.package === requirement.package
            ? ""
            : ` (inherited by ${requirement.package})`;
        failures.push(
          `${root.package}: ${root.severity} advisory ${root.advisory} is not allowlisted${inherited} — ${root.title}`,
        );
        continue;
      }

      matched.add(index);
      const entry = allowlist[index];
      if (entry.reviewBy < today) {
        failures.push(
          `${root.package}: the exception for ${root.advisory} was due for review on ${entry.reviewBy} (today is ${today}) — renew the judgement or remove the entry`,
        );
      }
    }
  }

  allowlist.forEach((entry, index) => {
    if (matched.has(index)) return;
    failures.push(
      `${entry.package}: the exception for ${entry.advisory} matched no advisory — it is stale and must be deleted`,
    );
  });

  return [...new Set(failures)];
}

function main() {
  const reportFile = process.argv[2] ?? process.env.AUDIT_REPORT_FILE;
  const report = readAuditReport(reportFile);
  assertUsableReport(report);
  assertWellFormedAllowlist(ALLOWLIST);
  const requirements = collectGatedPackages(report);
  const today = new Date().toISOString().slice(0, 10);
  const failures = evaluate(requirements, ALLOWLIST, today);

  if (failures.length > 0) {
    console.error(`audit-production: ${failures.length} violation(s):`);
    for (const failure of failures) console.error(`  ${failure}`);
    console.error(
      "audit-production: every high or critical advisory in the production tree must be fixed, or excused by a dated entry in scripts/audit-production.mjs that says why it does not reach this product.",
    );
    process.exit(1);
  }

  console.log(
    `audit-production: clean — ${requirements.length} high/critical package(s) in the production tree, every one traced to an advisory with a current, matching exception.`,
  );
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    // A gate's refusal should read as a verdict, not as a stack trace: the
    // message already says what is wrong and what to do about it.
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
