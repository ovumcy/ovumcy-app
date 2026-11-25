import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// The store library ships more than billing: purchase verification against a
// third-party endpoint, an app-ownership check, alternative stores. None of it
// runs unless the app imports and calls it, so the boundary is the import
// list: one adapter file, five functions, nothing else.

const repoRoot = join(__dirname, "..", "..");
const ADAPTER = "src/billing/store-client.native.ts";
const ALLOWED_VALUE_IMPORTS = [
  "fetchProducts",
  "finishTransaction",
  "getAvailablePurchases",
  "initConnection",
  "requestPurchase",
];

function listSourceFiles(directory: string): string[] {
  return readdirSync(join(repoRoot, directory), { withFileTypes: true }).flatMap(
    (entry) => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        return listSourceFiles(path);
      }
      return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? [path] : [];
    },
  );
}

function read(file: string): string {
  return readFileSync(join(repoRoot, file), "utf8");
}

function isTestFile(file: string): boolean {
  return /\.test\.tsx?$/.test(file);
}

// Any static, dynamic or require() reference to the package or a subpath.
const LIBRARY_REFERENCE = /["'`]expo-iap(?:\/[^"'`]*)?["'`]/;

describe("store library import boundary", () => {
  const sources = [
    ...listSourceFiles("src"),
    ...listSourceFiles("app"),
    ...listSourceFiles("plugins"),
    "index.js",
  ].filter((file) => !isTestFile(file));

  it("scans the app sources", () => {
    expect(sources.length).toBeGreaterThan(300);
    expect(sources).toContain(ADAPTER);
  });

  it("imports the store library in the one adapter file only", () => {
    const importers = sources.filter((file) => LIBRARY_REFERENCE.test(read(file)));

    expect(importers).toEqual([ADAPTER]);
  });

  it("imports only the billing calls the adapter needs, never a network or verification helper", () => {
    const source = read(ADAPTER);
    const imports = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"expo-iap"/g)];
    expect(imports).toHaveLength(1);
    expect(source).not.toMatch(/import\s+(?:\*\s+as\s+\w+|\w+)\s+from\s*"expo-iap"/);
    expect(source).not.toMatch(/require\(|import\(/);

    const valueImports = imports[0]![1]!
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "" && !name.startsWith("type "));

    expect(valueImports.sort()).toEqual(ALLOWED_VALUE_IMPORTS);
  });

  it("has no consume call anywhere in the adapter", () => {
    const source = read(ADAPTER);

    expect(source).not.toMatch(/isConsumable:\s*true/);
    expect(source).not.toMatch(/consumePurchase/);
    expect([...source.matchAll(/isConsumable:/g)]).toHaveLength(1);
  });

  it("keeps consume and the purchase token out of the store contract", () => {
    const contract = read("src/billing/store-contract.ts");
    const clientType = contract.slice(contract.indexOf("export type StoreClient"));
    const members = [...clientType.matchAll(/^ {2}(\w+)\(/gm)].map(
      (match) => match[1],
    );

    expect(members).toEqual([
      "loadProduct",
      "listPurchases",
      "purchase",
      "acknowledge",
    ]);

    const purchaseType = contract.slice(
      contract.indexOf("export type StorePurchase = {"),
      contract.indexOf("export type StorePurchaseOutcome"),
    );
    const fields = [...purchaseType.matchAll(/^ {2}(\w+)\??:/gm)].map(
      (match) => match[1],
    );
    expect(fields).toEqual(["productId", "state", "acknowledged"]);
  });

  it("keeps managed billing, sync and storage out of the pregnancy purchase chain", () => {
    const chain = [
      ADAPTER,
      "src/billing/store-client.web.ts",
      "src/billing/store-contract.ts",
      "src/services/pregnancy-store-entitlement-source.ts",
      "src/services/pregnancy-purchase-service.ts",
      "src/services/pregnancy-entitlement-service.ts",
    ];

    for (const file of chain) {
      const importPaths = [...read(file).matchAll(/from\s+"([^"]+)"/g)].map(
        (match) => match[1]!,
      );
      const foreign = importPaths.filter(
        (path) =>
          /managed|billing-snapshot|premium|sync|storage|secure-store|async-storage/i.test(
            path,
          ),
      );
      expect({ file, foreign }).toEqual({ file, foreign: [] });
    }
  });
});
