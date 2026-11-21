import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// SECURITY.md's Test Enforcement Matrix binds each claim to named tests. A
// citation is either backticked titles followed by `in [path](path)` (one or
// more links), or the whole-file form `every case in [path](path)`. Every cited
// title must be the first argument of a test or describe call in a cited file,
// so renaming or deleting a test without updating its claim fails here.

const repoRoot = join(__dirname, "..", "..");

type Citation = {
  line: number;
  segment: string;
  files: string[];
  titles: string[];
  wholeFile: boolean;
};

function readMatrixRows(): { line: number; enforcedBy: string }[] {
  const lines = readFileSync(join(repoRoot, "SECURITY.md"), "utf8").split("\n");
  const start = lines.findIndex((line) => line.startsWith("## Test Enforcement Matrix"));
  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith("### Policy / Planned"),
  );
  if (start < 0 || end < 0) {
    throw new Error("SECURITY.md has no Test Enforcement Matrix section");
  }

  const rows: { line: number; enforcedBy: string }[] = [];
  for (let index = start; index < end; index += 1) {
    const line = lines[index]!;
    if (!line.startsWith("| ") || line.startsWith("| Claim |") || line.startsWith("| ---")) {
      continue;
    }
    const cells = line.replace(/\s*\|\s*$/, "").split(" | ");
    rows.push({ line: index + 1, enforcedBy: cells.at(-1)! });
  }
  return rows;
}

function parseCitations(): Citation[] {
  return readMatrixRows().flatMap(({ line, enforcedBy }) =>
    enforcedBy.split(/;\s+/).map((segment) => {
      const files = [...segment.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]!);
      const head = segment.split(" in [")[0]!;
      return {
        line,
        segment,
        files,
        titles: [...head.matchAll(/`([^`]+)`/g)].map((match) => match[1]!),
        wholeFile: /^every case in \[/.test(segment.trim()),
      };
    }),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCalledWithTitle(source: string, title: string): boolean {
  return new RegExp(`\\(\\s*(["'\`])${escapeRegExp(title)}\\1`).test(source);
}

const citations = parseCitations();
const sources = new Map<string, string | null>();
function readCited(file: string): string | null {
  if (!sources.has(file)) {
    const path = join(repoRoot, file);
    sources.set(file, existsSync(path) ? readFileSync(path, "utf8") : null);
  }
  return sources.get(file)!;
}

describe("SECURITY.md test enforcement matrix", () => {
  it("reads the matrix citations", () => {
    expect(citations.length).toBeGreaterThan(100);
  });

  it("cites only files that exist", () => {
    const missing = citations.flatMap(({ line, files }) =>
      files.filter((file) => readCited(file) === null).map((file) => `${line}: ${file}`),
    );
    expect(missing).toEqual([]);
  });

  it("names test titles or the whole-file form in every citation", () => {
    const malformed = citations
      .filter(({ files, titles, wholeFile }) =>
        files.length === 0 || (wholeFile ? titles.length > 0 : titles.length === 0),
      )
      .map(({ line, segment }) => `${line}: ${segment.slice(0, 120)}`);
    expect(malformed).toEqual([]);
  });

  it("finds every cited title as a test or describe title in a cited file", () => {
    const unbound = citations.flatMap(({ line, files, titles }) =>
      titles
        .filter(
          (title) =>
            !files.some((file) => {
              const source = readCited(file);
              return source !== null && isCalledWithTitle(source, title);
            }),
        )
        .map((title) => `${line}: ${title}`),
    );
    expect(unbound).toEqual([]);
  });

  it("finds tests in every whole-file citation", () => {
    const empty = citations
      .filter(({ wholeFile }) => wholeFile)
      .flatMap(({ line, files }) =>
        files
          .filter((file) => !/\b(?:it|test)(?:\.each\([\s\S]*?\))?\(/.test(readCited(file) ?? ""))
          .map((file) => `${line}: ${file}`),
      );
    expect(empty).toEqual([]);
  });
});
