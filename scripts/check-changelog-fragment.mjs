// Changelog-fragment gate: a pull request adds one changelog.d/<slug>.md, where
// the slug is the head branch name without its type prefix (fix/foo-bar ->
// foo-bar). The fragment is either `none` on its first line (no user-visible
// change; anything below is the reason) or one or more Keep a Changelog
// section headers each followed by at least one list entry. See
// changelog.d/README.md for the format.
//
// Usage (env): BASE_REF (default origin/main), HEAD_REF (branch name; empty
// skips the naming rule). Exit 0 when clean, 1 when a problem is reported.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const FRAGMENT_DIR = "changelog.d";
const SECTIONS = new Set([
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
  "Internal",
  "Dependencies",
]);

export function fragmentPathForBranch(headRef) {
  const slash = headRef.indexOf("/");
  const slug = slash >= 0 ? headRef.slice(slash + 1) : headRef;
  return slug ? `${FRAGMENT_DIR}/${slug}.md` : "";
}

// Returns a problem description, or "" when the fragment is valid.
export function validateFragment(name, content) {
  const lines = content.split(/\r?\n/);
  if (lines[0].trim() === "none") return "";
  let section = null;
  const entries = new Map();
  for (const line of lines) {
    const header = /^### (.+?)\s*$/.exec(line);
    if (header) {
      if (!SECTIONS.has(header[1])) {
        return `${name}: unknown section "### ${header[1]}" (valid: ${[...SECTIONS].join(", ")})`;
      }
      section = header[1];
      entries.set(section, entries.get(section) ?? false);
    } else if (section && /^\s*- \S/.test(line)) {
      entries.set(section, true);
    }
  }
  if (entries.size === 0) {
    return `${name}: no "### <Section>" header; write "none" on the first line when the change is not user-visible`;
  }
  for (const [s, hasEntry] of entries) {
    if (!hasEntry) return `${name}: section "### ${s}" has no "- " entry`;
  }
  return "";
}

// Added fragment paths (A, or the destination of a rename) from
// `git diff --name-status` output, README excluded.
export function addedFragments(nameStatus) {
  const added = [];
  for (const row of nameStatus.split("\n")) {
    const cols = row.split("\t");
    const status = cols[0] ?? "";
    const target = status.startsWith("R") || status.startsWith("C") ? cols[2] : cols[1];
    if (!(status.startsWith("A") || status.startsWith("R") || status.startsWith("C"))) continue;
    if (!target?.startsWith(`${FRAGMENT_DIR}/`) || !target.endsWith(".md")) continue;
    if (target === `${FRAGMENT_DIR}/README.md`) continue;
    if (target.slice(FRAGMENT_DIR.length + 1).includes("/")) continue;
    added.push(target);
  }
  return added;
}

export function check(added, headRef, readFragment) {
  if (added.length === 0) {
    return [
      `no changelog fragment added: create ${fragmentPathForBranch(headRef) || `${FRAGMENT_DIR}/<slug>.md`} (format: ${FRAGMENT_DIR}/README.md)`,
    ];
  }
  const want = fragmentPathForBranch(headRef);
  if (want && !added.includes(want)) {
    return [`the fragment must be named ${want} (branch ${headRef}); added: ${added.join(", ")}`];
  }
  const problems = [];
  for (const file of added) {
    const problem = validateFragment(file, readFragment(file));
    if (problem) problems.push(problem);
  }
  return problems;
}

function main() {
  const baseRef = process.env.BASE_REF ?? "origin/main";
  const headRef = process.env.HEAD_REF ?? "";
  const nameStatus = execFileSync(
    "git",
    ["diff", "--name-status", "--find-renames", `${baseRef}...HEAD`, "--", FRAGMENT_DIR],
    { encoding: "utf8" },
  );
  const problems = check(addedFragments(nameStatus), headRef, (file) => readFileSync(file, "utf8"));
  for (const problem of problems) console.error(`::error::${problem}`);
  process.exit(problems.length === 0 ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
