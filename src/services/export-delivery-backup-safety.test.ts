import { readFileSync } from "fs";
import { join } from "path";
import * as ts from "typescript";

// F10.c regression guard: privacy-sensitive export artifacts (cycle CSV/JSON,
// doctor PDF, recovery phrase) must be written under `Paths.cache`, never
// `Paths.document`. On both iOS (NSCachesDirectory) and Android
// (Context.getCacheDir()) the cache root is excluded from OS-level backup
// (iCloud / iTunes-Finder / Android Auto Backup) by default; the document
// root is NOT. A silent swap would re-introduce the backup-exfiltration path
// even though the in-flight cleanup and startup sweep would still look fine.
//
// Static source check via the TypeScript AST. A regex-only check is bypassed
// trivially (`Paths["document"]`, `const { document } = Paths`, etc.); the
// AST walker catches property-access, element-access with a string literal,
// and destructuring-from-`Paths`. Identifier rebinding of `Paths` itself
// (e.g. `import { Paths as P }`) is out of scope — flagged in the doc but
// would show up at code review.

const SERVICES_DIR = __dirname;

function parseSource(filename: string): ts.SourceFile {
  const source = readFileSync(join(SERVICES_DIR, filename), "utf8");
  return ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
}

function collectPathsMemberAccess(sourceFile: ts.SourceFile): {
  propertyAccessNames: Set<string>;
  elementAccessNames: Set<string>;
  destructuredNames: Set<string>;
} {
  const propertyAccessNames = new Set<string>();
  const elementAccessNames = new Set<string>();
  const destructuredNames = new Set<string>();

  function visit(node: ts.Node): void {
    // Paths.X
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Paths"
    ) {
      propertyAccessNames.add(node.name.text);
    }

    // Paths["X"]
    if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "Paths" &&
      ts.isStringLiteralLike(node.argumentExpression)
    ) {
      elementAccessNames.add(node.argumentExpression.text);
    }

    // const { X } = Paths  /  const { X: alias } = Paths
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isIdentifier(node.initializer) &&
      node.initializer.text === "Paths"
    ) {
      for (const element of node.name.elements) {
        const propertyName = element.propertyName ?? element.name;
        if (ts.isIdentifier(propertyName)) {
          destructuredNames.add(propertyName.text);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { propertyAccessNames, elementAccessNames, destructuredNames };
}

function collectImportedModules(sourceFile: ts.SourceFile): Set<string> {
  const modules = new Set<string>();
  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      modules.add(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      ((node.expression.kind === ts.SyntaxKind.ImportKeyword) ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const [arg] = node.arguments;
      if (arg && ts.isStringLiteralLike(arg)) {
        modules.add(arg.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return modules;
}

function unionPathsAccess(sourceFile: ts.SourceFile): Set<string> {
  const { propertyAccessNames, elementAccessNames, destructuredNames } =
    collectPathsMemberAccess(sourceFile);
  return new Set<string>([
    ...propertyAccessNames,
    ...elementAccessNames,
    ...destructuredNames,
  ]);
}

function parseInlineSource(source: string): ts.SourceFile {
  return ts.createSourceFile(
    "inline.ts",
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
}

describe("export delivery backup safety", () => {
  // Self-test the AST walker before relying on it. If a future TS version
  // changes the AST shape and the walker silently misses a form, every
  // production check below would pass vacuously. These self-tests fail
  // loudly in that case.
  describe("AST walker self-test", () => {
    it("detects Paths.document property access", () => {
      const sf = parseInlineSource(
        `import { Paths } from "expo-file-system"; const x = Paths.document;`,
      );
      expect(unionPathsAccess(sf).has("document")).toBe(true);
    });

    it("detects Paths[\"document\"] element access", () => {
      const sf = parseInlineSource(
        `import { Paths } from "expo-file-system"; const x = Paths["document"];`,
      );
      expect(unionPathsAccess(sf).has("document")).toBe(true);
    });

    it("detects `const { document } = Paths` destructuring", () => {
      const sf = parseInlineSource(
        `import { Paths } from "expo-file-system"; const { document } = Paths;`,
      );
      expect(unionPathsAccess(sf).has("document")).toBe(true);
    });

    it("detects `const { document: alias } = Paths` destructuring with rename", () => {
      const sf = parseInlineSource(
        `import { Paths } from "expo-file-system"; const { document: docDir } = Paths;`,
      );
      expect(unionPathsAccess(sf).has("document")).toBe(true);
    });

    it("does not flag `Paths.cache` as `document`", () => {
      const sf = parseInlineSource(
        `import { Paths } from "expo-file-system"; const x = Paths.cache;`,
      );
      const access = unionPathsAccess(sf);
      expect(access.has("cache")).toBe(true);
      expect(access.has("document")).toBe(false);
    });

    it("detects expo-file-system imports", () => {
      const sf = parseInlineSource(
        `import { File } from "expo-file-system";`,
      );
      expect(collectImportedModules(sf).has("expo-file-system")).toBe(true);
    });

    it("detects expo-file-system via require()", () => {
      const sf = parseInlineSource(
        `const { File } = require("expo-file-system");`,
      );
      expect(collectImportedModules(sf).has("expo-file-system")).toBe(true);
    });
  });

  describe.each([
    ["export-delivery.native.ts"],
    ["export-artifact-cleanup.native.ts"],
  ])("native file %s", (filename) => {
    const sourceFile = parseSource(filename);
    const pathsAccess = unionPathsAccess(sourceFile);

    it("reads from Paths.cache", () => {
      expect(pathsAccess.has("cache")).toBe(true);
    });

    it("never reads Paths.document via any access form", () => {
      // Covers Paths.document, Paths["document"], and `const { document } = Paths`.
      expect(pathsAccess.has("document")).toBe(false);
    });
  });

  describe("recovery-phrase-delivery-service.ts", () => {
    const sourceFile = parseSource("recovery-phrase-delivery-service.ts");
    const modules = collectImportedModules(sourceFile);

    it("does not import expo-file-system directly — it must go through ExportDeliveryClient so the cache-root invariant is enforced in one place", () => {
      // If recovery-phrase delivery starts writing files itself, the
      // backup-safety guards on export-delivery.native.ts no longer protect
      // it. Force the dependency to remain on the delivery client.
      expect(modules.has("expo-file-system")).toBe(false);
    });
  });

  describe.each([
    ["export-delivery.web.ts"],
    ["export-artifact-cleanup.web.ts"],
  ])("web file %s", (filename) => {
    const sourceFile = parseSource(filename);
    const modules = collectImportedModules(sourceFile);

    it("does not import expo-file-system — web delivery uses ephemeral Blob/objectURL, not the cache filesystem", () => {
      // Documents the architectural invariant: the F10.c threat model is
      // native-only because the web path never touches an on-disk file.
      expect(modules.has("expo-file-system")).toBe(false);
    });
  });
});
