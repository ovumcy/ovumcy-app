// Enforces the "every modified, coverable line is covered by tests" policy
// locally in CI, without depending on an external coverage service (which can
// stall and deadlock a required status check — the managed repo replaced its
// external gate for exactly that failure on 2026-07-20, and this script is the
// TypeScript/istanbul port of the Go original both backend repos carry in
// scripts/patchcov).
//
// It reads Jest's istanbul JSON coverage (--coverageReporters=json →
// coverage/coverage-final.json) and the git diff of the current branch against
// a base ref, then fails when any added or modified line in gated files is not
// fully covered. "Fully" matches the strictness of the codecov patch status
// this gate replaces, which scored BRANCHES, not just lines (a 100%-lines
// patch once read 75% there): a changed line fails when a statement starting
// on it never executed, and also when a branch location on it was never taken.
// Lines with no statement or branch mapped to them are non-coverable
// (comments, types, imports erased at compile time) and are ignored, matching
// codecov's "coverable lines" semantics. `/* istanbul ignore ... */` removes
// entries from the coverage maps entirely, so it remains the escape hatch and
// needs no support here.
//
// Gated files mirror jest.config.js collectCoverageFrom: src/**/*.ts(x) minus
// *.test.* and *.d.ts. Everything else (app/ routes, scripts/, e2e/, plugins/,
// config) is outside the coverage universe and outside this gate, exactly as
// it was outside the external one.
//
// Usage (env): COVERAGE_FILE (default coverage/coverage-final.json), BASE_REF
// (default origin/main). Exit 0 when clean, 1 when violations exist.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const coverageFile = process.env.COVERAGE_FILE ?? "coverage/coverage-final.json";
const baseRef = process.env.BASE_REF ?? "origin/main";

export function isGatedFile(file) {
  if (!file.startsWith("src/")) return false;
  if (/\.test\.tsx?$/.test(file)) return false;
  if (file.endsWith(".d.ts")) return false;
  return /\.tsx?$/.test(file);
}

// Parses `git diff --unified=0` output into a map of repo-relative file path →
// Set of added/modified line numbers (new-side numbering).
export function parseDiffAddedLines(diffText) {
  const changed = new Map();
  let currentFile = null;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ ")) {
      const target = line.slice(4).trim();
      currentFile = target.startsWith("b/") ? target.slice(2) : null;
      continue;
    }
    if (!currentFile || !line.startsWith("@@")) continue;
    const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!m) continue;
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    if (count === 0) continue; // pure deletion
    let lines = changed.get(currentFile);
    if (!lines) {
      lines = new Set();
      changed.set(currentFile, lines);
    }
    for (let i = 0; i < count; i++) lines.add(start + i);
  }
  return changed;
}

// Normalizes istanbul's absolute path keys to repo-relative posix paths.
export function relativizeCoverage(coverage, cwd) {
  const byFile = new Map();
  for (const [key, entry] of Object.entries(coverage)) {
    const rel = path.relative(cwd, key).split(path.sep).join("/");
    if (rel.startsWith("..")) continue;
    byFile.set(rel, entry);
  }
  return byFile;
}

// Evaluates one file's changed lines against its istanbul entry.
// Returns an array of { line, reason } violations. Mirrors lcov line
// semantics: a line is statement-coverable when a statement STARTS on it
// (continuation lines are not separately scored), and branch-scored when a
// branch location starts on it.
export function evaluateFile(entry, changedLines) {
  const statementsByLine = new Map();
  for (const [id, loc] of Object.entries(entry.statementMap ?? {})) {
    const line = loc?.start?.line;
    if (!line) continue;
    const hits = entry.s?.[id] ?? 0;
    const agg = statementsByLine.get(line);
    if (agg === undefined) {
      statementsByLine.set(line, hits > 0);
    } else if (!agg && hits > 0) {
      statementsByLine.set(line, true);
    }
  }

  const partialBranchLines = new Map();
  for (const [id, branch] of Object.entries(entry.branchMap ?? {})) {
    const counts = entry.b?.[id] ?? [];
    const locations = branch.locations?.length ? branch.locations : [branch.loc];
    locations.forEach((loc, index) => {
      const line = loc?.start?.line ?? branch.loc?.start?.line;
      if (!line) return;
      if ((counts[index] ?? 0) === 0) {
        partialBranchLines.set(
          line,
          (partialBranchLines.get(line) ?? 0) + 1,
        );
      }
    });
  }

  const violations = [];
  for (const line of [...changedLines].sort((a, b) => a - b)) {
    const stmtCovered = statementsByLine.get(line);
    if (stmtCovered === false) {
      violations.push({ line, reason: "statement never executed" });
      continue;
    }
    const missedBranches = partialBranchLines.get(line);
    if (missedBranches) {
      violations.push({
        line,
        reason: `partially covered branch (${missedBranches} outcome${missedBranches > 1 ? "s" : ""} never taken)`,
      });
    }
  }
  return violations;
}

function main() {
  let coverageRaw;
  try {
    coverageRaw = readFileSync(coverageFile, "utf8");
  } catch (error) {
    console.error(`patchcov: cannot read coverage file ${coverageFile}: ${error.message}`);
    process.exit(1);
  }
  const coverage = relativizeCoverage(JSON.parse(coverageRaw), process.cwd());

  const diffText = execFileSync(
    "git",
    ["diff", "--unified=0", "--no-color", `${baseRef}...HEAD`, "--", "*.ts", "*.tsx"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const changed = parseDiffAddedLines(diffText);

  let gatedFiles = 0;
  let gatedLines = 0;
  const failures = [];
  for (const [file, lines] of [...changed.entries()].sort()) {
    if (!isGatedFile(file)) continue;
    gatedFiles += 1;
    gatedLines += lines.size;
    const entry = coverage.get(file);
    if (!entry) {
      // Inside the collectCoverageFrom universe but absent from the report:
      // the coverage run did not see this file at all, so nothing vouches for
      // it. Fail loudly rather than treating absence as non-coverable.
      failures.push(`${file}: present in the diff but absent from ${coverageFile} (coverage run out of date?)`);
      continue;
    }
    for (const { line, reason } of evaluateFile(entry, lines)) {
      failures.push(`${file}:${line} ${reason}`);
    }
  }

  if (failures.length > 0) {
    console.error(`patchcov: ${failures.length} uncovered change(s) against ${baseRef}:`);
    for (const failure of failures) console.error(`  ${failure}`);
    console.error(
      "patchcov: every added or modified src/ line must be executed by tests, with every branch outcome on it taken (same bar as the codecov patch status this gate replaces).",
    );
    process.exit(1);
  }
  console.log(
    `patchcov: clean — ${gatedLines} changed line(s) across ${gatedFiles} gated file(s), statements and branches covered against ${baseRef}.`,
  );
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
