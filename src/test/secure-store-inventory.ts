import { readdirSync, readFileSync } from "fs";
import { join, relative, sep } from "path";

import { createCertPinStore } from "../security/cert-pin-store";
import { createEntitlementTokenStore } from "../security/entitlement-token-store";
import { createPartnerShareSecretStore } from "../security/partner-share-secret-store";
import { createSyncSecretStore, type SyncSecretStore } from "../security/sync-secret-store";
import type { WipeScopeSecretStores } from "../security/wipe-scope-secrets";

const SRC_DIR = join(__dirname, "..");
const SECURITY_DIR = join(SRC_DIR, "security");
const SECURE_STORE_IMPORT = /from\s+"expo-secure-store"/;
const STORE_MODULE_IMPORT = /import\s*\{\s*create\w+\s*\}\s*from\s*"\.\/([\w-]+)"/;
const OVUMCY_KEY_LITERAL = /"(ovumcy\.[a-z0-9.-]+)"/g;

export type SecureStoreKeyEntry = {
  // key is the SecureStore entry name the store module reads and writes.
  key: string;
  // storeModule is the src/security module basename that owns the key.
  storeModule: string;
};

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(path));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Lists every SecureStore key the app can write, derived from the source
 * rather than a hand-kept list: each production file importing
 * `expo-secure-store` is a platform store factory, the factory names the
 * store module it wraps, and that module declares exactly one `ovumcy.*` key.
 * Throws when a production file outside that shape imports
 * `expo-secure-store`, so a store added elsewhere cannot escape the list.
 */
export function listSecureStoreKeysFromSource(): SecureStoreKeyEntry[] {
  const entries: SecureStoreKeyEntry[] = [];

  for (const file of listSourceFiles(SRC_DIR)) {
    const source = readFileSync(file, "utf8");
    if (!SECURE_STORE_IMPORT.test(source)) {
      continue;
    }

    const relativePath = relative(SRC_DIR, file).split(sep).join("/");
    if (!/^security\/platform-[\w-]+\.native\.ts$/.test(relativePath)) {
      throw new Error(
        `${relativePath} imports expo-secure-store outside a src/security platform store factory`,
      );
    }

    const moduleMatch = STORE_MODULE_IMPORT.exec(source);
    if (!moduleMatch?.[1]) {
      throw new Error(`${relativePath} does not import a ./<store> factory`);
    }
    const storeModule = moduleMatch[1];
    const storeSource = readFileSync(join(SECURITY_DIR, `${storeModule}.ts`), "utf8");
    const keys = [...storeSource.matchAll(OVUMCY_KEY_LITERAL)].map(
      (match) => match[1] as string,
    );
    if (keys.length !== 1) {
      throw new Error(
        `${storeModule}.ts declares ${keys.length} ovumcy.* keys; expected exactly one`,
      );
    }
    entries.push({ key: keys[0] as string, storeModule });
  }

  return entries.sort((left, right) => left.key.localeCompare(right.key));
}

export type InMemorySecureStoreBackend = {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  keys(): string[];
};

// One shared in-memory map standing in for the platform SecureStore, seeded
// with a placeholder value under every given key.
export function createInMemorySecureStoreBackend(
  seedKeys: string[] = [],
): InMemorySecureStoreBackend {
  const entries = new Map<string, string>(
    seedKeys.map((key) => [key, `seeded-${key}`]),
  );

  return {
    async deleteItem(key) {
      entries.delete(key);
    },
    async getItem(key) {
      return entries.get(key) ?? null;
    },
    async setItem(key, value) {
      entries.set(key, value);
    },
    keys() {
      return [...entries.keys()].sort();
    },
  };
}

// The real store implementations, all over one backend, as the wipe paths
// receive them.
export function createSecretStoresOverBackend(
  backend: InMemorySecureStoreBackend,
): { syncSecretStore: SyncSecretStore; wipeScopeSecretStores: WipeScopeSecretStores } {
  return {
    syncSecretStore: createSyncSecretStore(backend),
    wipeScopeSecretStores: {
      certPinStore: createCertPinStore(backend),
      entitlementTokenStore: createEntitlementTokenStore(backend),
      partnerShareSecretStore: createPartnerShareSecretStore(backend),
    },
  };
}

// Wipe-scope stores over a private empty backend, for tests that do not
// inspect secret state.
export function createWipeScopeSecretStoresMock(): WipeScopeSecretStores {
  return createSecretStoresOverBackend(createInMemorySecureStoreBackend())
    .wipeScopeSecretStores;
}
