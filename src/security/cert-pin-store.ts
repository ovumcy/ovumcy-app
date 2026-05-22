// cert-pin-store owns the per-host TLS leaf-certificate SPKI fingerprints the
// device has previously observed and elected to trust under the Trust On First
// Use (TOFU) model documented in `docs/sync-trust-model.md`.
//
// The store deliberately keeps a host -> record map in a single SecureStore
// entry rather than one entry per host: pins are integrity-critical (an
// attacker that can write pins can pre-pin a rogue cert) so they belong in
// secure storage, but they are NOT confidentiality-critical, and a single
// JSON-encoded record keeps SecureStore key sprawl bounded.
//
// Pin format is the base64-encoded SHA-256 hash of the leaf certificate
// Subject Public Key Info (SPKI), matching the wire format consumed by
// `react-native-ssl-public-key-pinning`. Other formats are rejected at write
// time so a malformed pin can never reach the enforcement layer.

const CERT_PIN_STORE_KEY = "ovumcy.sync-cert-pins";

export type CertPinRecord = {
  // host is the lowercase canonical hostname for which the pin applies.
  // Matches `NormalizedSyncEndpoint.host` so the policy layer can index by it
  // without an additional normalization pass.
  host: string;
  // fingerprint is the base64-encoded SHA-256 hash of the leaf certificate
  // Subject Public Key Info (SPKI). 44 chars including the single `=` pad.
  fingerprint: string;
  // pinnedAt is the ISO-8601 timestamp of the first authenticated handshake
  // that produced this pin. Surfaced in UX so the owner can sanity-check
  // pin age before approving a reset.
  pinnedAt: string;
};

export interface CertPinStoreBackend {
  deleteItem(key: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface CertPinStore {
  // clearAll removes every recorded pin. Reserved for destructive reset
  // flows (`disconnectSyncAccount`, factory reset). Not part of the cert
  // rotation path — that's per-host via `clearPin`.
  clearAll(): Promise<void>;
  clearPin(host: string): Promise<void>;
  readPin(host: string): Promise<CertPinRecord | null>;
  writePin(record: CertPinRecord): Promise<void>;
}

export function createCertPinStore(
  backend: CertPinStoreBackend,
): CertPinStore {
  return {
    async clearAll(): Promise<void> {
      await backend.deleteItem(CERT_PIN_STORE_KEY);
    },

    async clearPin(host: string): Promise<void> {
      const normalizedHost = normalizeHost(host);
      if (!normalizedHost) {
        return;
      }

      const map = await readMap(backend);
      if (!(normalizedHost in map)) {
        return;
      }
      delete map[normalizedHost];

      if (Object.keys(map).length === 0) {
        // Avoid leaving an empty `{}` in SecureStore: clearAll-after-clearPin
        // should be indistinguishable from never-having-pinned.
        await backend.deleteItem(CERT_PIN_STORE_KEY);
        return;
      }

      await backend.setItem(CERT_PIN_STORE_KEY, JSON.stringify(map));
    },

    async readPin(host: string): Promise<CertPinRecord | null> {
      const normalizedHost = normalizeHost(host);
      if (!normalizedHost) {
        return null;
      }

      const map = await readMap(backend);
      const record = map[normalizedHost];
      return record ?? null;
    },

    async writePin(record: CertPinRecord): Promise<void> {
      const normalizedHost = normalizeHost(record.host);
      if (!normalizedHost) {
        throw new Error("invalid_host");
      }
      if (!isValidFingerprint(record.fingerprint)) {
        throw new Error("invalid_fingerprint");
      }
      if (!isValidISO8601(record.pinnedAt)) {
        throw new Error("invalid_pinned_at");
      }

      const map = await readMap(backend);
      map[normalizedHost] = {
        host: normalizedHost,
        fingerprint: record.fingerprint,
        pinnedAt: record.pinnedAt,
      };

      await backend.setItem(CERT_PIN_STORE_KEY, JSON.stringify(map));
    },
  };
}

async function readMap(
  backend: CertPinStoreBackend,
): Promise<Record<string, CertPinRecord>> {
  const rawValue = await backend.getItem(CERT_PIN_STORE_KEY);
  if (!rawValue) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    // Corrupted payload — treat as empty rather than throwing. The next
    // write fully replaces the entry so a single bad parse cannot wedge
    // the store.
    return {};
  }

  if (!isObject(parsed)) {
    return {};
  }

  const result: Record<string, CertPinRecord> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const normalizedKey = normalizeHost(key);
    if (!normalizedKey) {
      continue;
    }
    if (!isCertPinRecord(value)) {
      continue;
    }
    // Reject records whose embedded host doesn't match their map key: an
    // attacker with arbitrary-write to SecureStore could otherwise alias a
    // pin under a different host's key.
    if (value.host !== normalizedKey) {
      continue;
    }
    result[normalizedKey] = {
      host: normalizedKey,
      fingerprint: value.fingerprint,
      pinnedAt: value.pinnedAt,
    };
  }
  return result;
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCertPinRecord(value: unknown): value is CertPinRecord {
  return (
    isObject(value) &&
    typeof value.host === "string" &&
    typeof value.fingerprint === "string" &&
    typeof value.pinnedAt === "string" &&
    isValidFingerprint(value.fingerprint) &&
    isValidISO8601(value.pinnedAt)
  );
}

function isValidFingerprint(fingerprint: string): boolean {
  // base64-encoded SHA-256 = 32 bytes = 44 chars including a single `=` pad.
  // `react-native-ssl-public-key-pinning` consumes this exact shape. Reject
  // anything else at write time so the enforcement layer never sees garbage.
  return /^[A-Za-z0-9+/]{43}=$/.test(fingerprint);
}

function isValidISO8601(value: string): boolean {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp);
}
