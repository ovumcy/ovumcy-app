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

// Every module each file of the purchase chain may load. An exact list, not a
// denylist: a new import — storage, a sync session, managed billing, anything
// — fails here until it is reviewed and added.
const PURCHASE_CHAIN_IMPORTS: Record<string, string[]> = {
  [ADAPTER]: ["expo-iap", "react-native", "./store-contract"],
  "src/billing/store-client.web.ts": ["./store-contract"],
  "src/billing/store-contract.ts": [],
  "src/services/pregnancy-store-entitlement-source.ts": [
    "../billing/store-client",
    "../billing/store-contract",
    "./pregnancy-entitlement-service",
  ],
  "src/services/pregnancy-purchase-service.ts": [
    "../billing/store-client",
    "../billing/store-contract",
    "./pregnancy-store-entitlement-source",
  ],
  "src/services/pregnancy-entitlement-service.ts": [
    "./pregnancy-store-entitlement-source",
  ],
};

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

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

// Static `from`, side-effect `import "x"`, dynamic `import("x")` and
// `require("x")`, in any quote style.
function importedModules(source: string): string[] {
  const code = withoutComments(source);
  const specifiers = [
    ...code.matchAll(/\bfrom\s*(["'`])([^"'`]+)\1/g),
    ...code.matchAll(/\bimport\s*(["'`])([^"'`]+)\1/g),
    ...code.matchAll(/\b(?:import|require)\s*\(\s*(["'`])([^"'`]+)\1/g),
  ].map((match) => match[2]!);
  return [...new Set(specifiers)].sort();
}

// Property and method names declared directly in an exported object type.
function typeMembers(source: string, typeName: string): string[] {
  const start = source.indexOf(`export type ${typeName} = {`);
  const body = source.slice(start, source.indexOf("\n};", start));
  return [...body.matchAll(/^ {2}(?:readonly\s+)?(\w+)\??\s*[(:]/gm)].map(
    (match) => match[1]!,
  );
}

function isTestFile(file: string): boolean {
  return /\.test\.tsx?$/.test(file);
}

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
    const importers = sources.filter((file) =>
      importedModules(read(file)).some(
        (specifier) => specifier === "expo-iap" || specifier.startsWith("expo-iap/"),
      ),
    );

    expect(importers).toEqual([ADAPTER]);
  });

  it("imports only the billing calls the adapter needs, never a network or verification helper", () => {
    const source = withoutComments(read(ADAPTER));
    const imports = [
      ...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']expo-iap["']/g),
    ];
    expect(imports).toHaveLength(1);
    // No namespace or default import, no re-export, no dynamic load.
    expect(source).not.toMatch(/import\s+(?:\*\s+as\s+\w+|\w+)\s*(?:,|from)/);
    expect(source).not.toMatch(/export\s*(?:\*|\{[^}]*\})\s*from/);
    expect(source).not.toMatch(/\b(?:require|import)\s*\(/);

    const valueImports = imports[0]![1]!
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "" && !name.startsWith("type "));

    expect(valueImports.sort()).toEqual(ALLOWED_VALUE_IMPORTS);
  });

  it("has no consume call anywhere in the adapter", () => {
    const source = withoutComments(read(ADAPTER));

    expect(source).not.toMatch(/isConsumable:\s*true/);
    expect(source).not.toMatch(/consume/i);
    expect([...source.matchAll(/isConsumable:\s*false/g)]).toHaveLength(1);
    expect([...source.matchAll(/isConsumable/g)]).toHaveLength(1);
  });

  it("keeps consume and the purchase token out of the store contract", () => {
    const contract = withoutComments(read("src/billing/store-contract.ts"));

    expect(typeMembers(contract, "StoreClient")).toEqual([
      "supported",
      "loadProduct",
      "listPurchases",
      "purchase",
      "acknowledge",
    ]);
    expect(typeMembers(contract, "StorePurchase")).toEqual([
      "productId",
      "state",
      "acknowledged",
    ]);
    expect(typeMembers(contract, "StoreProduct")).toEqual([
      "productId",
      "displayPrice",
    ]);
    // Whatever the syntax, neither word appears in the contract's code.
    expect(contract).not.toMatch(/token|consum|receipt|signature/i);
  });

  it("keeps managed billing, sync and storage out of the pregnancy purchase chain", () => {
    const actual = Object.fromEntries(
      Object.keys(PURCHASE_CHAIN_IMPORTS).map((file) => [
        file,
        importedModules(read(file)),
      ]),
    );
    const allowed = Object.fromEntries(
      Object.entries(PURCHASE_CHAIN_IMPORTS).map(([file, modules]) => [
        file,
        [...modules].sort(),
      ]),
    );

    expect(actual).toEqual(allowed);
  });

  it("contacts the store only from the pregnancy surfaces, never from the launch tasks", () => {
    // Starting the store's billing client also starts the store vendor's own
    // diagnostics, so who can reach the store is an exact, reviewed list. A
    // platform-suffixed path (`store-client.native`) counts as the module.
    const importersOf = (moduleName: string) =>
      sources
        .filter((file) =>
          importedModules(read(file)).some((specifier) =>
            new RegExp(`/${moduleName}(?:\\.(?:native|web|android|ios))?$`).test(
              specifier,
            ),
          ),
        )
        .sort();

    expect(importersOf("store-client")).toEqual([
      "src/services/pregnancy-purchase-service.ts",
      "src/services/pregnancy-store-entitlement-source.ts",
    ]);
    expect(importersOf("pregnancy-store-entitlement-source")).toEqual([
      "src/services/pregnancy-entitlement-service.ts",
      "src/services/pregnancy-purchase-service.ts",
    ]);
    expect(importersOf("pregnancy-purchase-service")).toEqual([
      "src/ui/screens/DashboardScreen.tsx",
      "src/ui/screens/pregnancy/PregnancyStartScreen.tsx",
      "src/ui/screens/pregnancy/PregnancyUnlockScreen.tsx",
    ]);
    expect(importersOf("pregnancy-entitlement-service")).toEqual([
      "src/services/dashboard-view-service.ts",
      "src/services/pregnancy-store-entitlement-source.ts",
      "src/ui/screens/pregnancy/PregnancyEndScreen.tsx",
      "src/ui/screens/pregnancy/PregnancyStartScreen.tsx",
    ]);

    for (const launchFile of ["app/_layout.tsx", "src/services/app-launch-tasks.ts"]) {
      expect(
        importedModules(read(launchFile)).filter((specifier) =>
          /pregnancy|billing|store-client/i.test(specifier),
        ),
      ).toEqual([]);
    }
  });

  it("leaves the store library's native module out of the iOS build", () => {
    // No App Store product exists and the adapter never calls the store on
    // iOS, so its StoreKit bridge is not linked there until that path is built.
    const manifest = JSON.parse(read("package.json")) as {
      expo?: { autolinking?: { exclude?: string[]; ios?: { exclude?: string[] } } };
    };

    expect(manifest.expo?.autolinking?.ios?.exclude).toEqual(["expo-iap"]);
    // Android must keep it: a top-level exclude would drop it everywhere.
    expect(manifest.expo?.autolinking?.exclude).toBeUndefined();
  });

  it("keeps the unlock screen on the purchase service: no store client, storage, sync or billing import", () => {
    const screenImports = importedModules(
      read("src/ui/screens/pregnancy/PregnancyUnlockScreen.tsx"),
    );

    expect(
      screenImports.filter(
        (specifier) =>
          specifier.includes("/services/") || specifier.includes("/billing/"),
      ),
    ).toEqual(["../../../services/pregnancy-purchase-service"]);
    expect(
      screenImports.filter((specifier) =>
        /storage|sync|managed|premium|security|sqlite|secure-store/i.test(specifier),
      ),
    ).toEqual([]);
  });
});
