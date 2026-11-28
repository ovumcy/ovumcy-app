import fs from "fs";
import os from "os";
import path from "path";

import appJson from "../../app.json";
import {
  BACKUP_DOMAINS,
  applyBackupRulesToManifest,
  writeBackupRules,
} from "../../plugins/withAndroidExcludeDataFromBackup";
import {
  ANDROID_PIN_SET_VALIDITY_DAYS,
  MANAGED_PINNED_HOSTS,
  MANAGED_ROOT_PINS,
} from "../../plugins/managed-cert-pins";
import {
  pinSetExpiration,
  writeNetworkSecurityConfigs,
} from "../../plugins/withAndroidNetworkSecurityConfig";
import {
  MANAGED_CLOUD_AUTH_BASE_URL,
  MANAGED_SYNC_BASE_URL,
} from "../sync/sync-contract";

const DEV_HOSTS = ["10.0.2.2", "127.0.0.1", "localhost"];

// An independent copy of the pin table in docs/sync-trust-model.md, so a change
// to the shared pin module is a visible test change, never a silent one.
const MANAGED_HOSTS = ["managed.ovumcy.cloud", "sync.ovumcy.cloud"];
const ISRG_ROOT_PINS = [
  "C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=", // ISRG Root X1
  "diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=", // ISRG Root X2
  "fk6IOKit1ild5647BH06ujSIq5XbCgqlbYl6ANhhi88=", // ISRG Root YR
  "sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=", // ISRG Root YE
];

let projectRoot: string;

beforeEach(() => {
  projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ovumcy-android-"));
});

afterEach(() => {
  fs.rmSync(projectRoot, { recursive: true, force: true });
});

function readXml(sourceSet: string, name: string): string {
  return fs.readFileSync(
    path.join(projectRoot, "app", "src", sourceSet, "res", "xml", `${name}.xml`),
    "utf8",
  );
}

function pluginEntries(): unknown[] {
  return appJson.expo.plugins.map((entry) => (Array.isArray(entry) ? entry[0] : entry));
}

describe("Android network security config", () => {
  it.each([undefined, "production", "preview", "development"])(
    "ships no cleartext exception in the main config for EAS profile %s",
    async (profile) => {
      await writeNetworkSecurityConfigs(projectRoot, { EAS_BUILD_PROFILE: profile });

      const main = readXml("main", "network_security_config");
      expect(main).toContain('<base-config cleartextTrafficPermitted="false" />');
      expect(main).not.toContain('cleartextTrafficPermitted="true"');
      for (const host of DEV_HOSTS) {
        expect(main).not.toContain(host);
      }
    },
  );

  it("exempts only the emulator-host/loopback dev addresses in the debug variant and the local profile", async () => {
    await writeNetworkSecurityConfigs(projectRoot, { EAS_BUILD_PROFILE: "local" });

    for (const sourceSet of ["main", "debug"]) {
      const xml = readXml(sourceSet, "network_security_config");
      expect(xml).toContain('<base-config cleartextTrafficPermitted="false" />');
      const cleartextConfigs = [
        ...xml.matchAll(/<domain-config cleartextTrafficPermitted="true">([\s\S]*?)<\/domain-config>/g),
      ];
      expect(cleartextConfigs).toHaveLength(1);
      const domains = [
        ...(cleartextConfigs[0]?.[1] ?? "").matchAll(/<domain [^>]*>([^<]+)<\/domain>/g),
      ].map((m) => m[1]);
      expect(domains).toEqual(DEV_HOSTS);
      expect(xml).not.toContain('includeSubdomains="true"');
    }
  });

  it("is wired into the app config", () => {
    expect(pluginEntries()).toContain("./plugins/withAndroidNetworkSecurityConfig");
  });
});

describe("Android managed-host root pinning", () => {
  // A fixed build clock: 2026-11-28T23:30Z plus 365 days is 2027-11-28 in UTC.
  const BUILD_DATE = new Date("2026-11-28T23:30:00Z");
  const EXPECTED_EXPIRATION = "2027-11-28";

  function pinnedDomainConfigs(xml: string): { host: string; expiration: string; pins: string[] }[] {
    return [...xml.matchAll(/<domain-config>([\s\S]*?)<\/domain-config>/g)].map(([, body = ""]) => ({
      host: /<domain includeSubdomains="false">([^<]+)<\/domain>/.exec(body)?.[1] ?? "",
      expiration: /<pin-set expiration="([^"]+)">/.exec(body)?.[1] ?? "",
      pins: [...body.matchAll(/<pin digest="SHA-256">([^<]+)<\/pin>/g)].map((m) => m[1] ?? ""),
    }));
  }

  it.each([
    ["main", undefined],
    ["main", "production"],
    ["main", "local"],
    ["debug", "production"],
  ])(
    "pins both managed hosts to exactly the four ISRG root keys in the %s config (EAS profile %s)",
    async (sourceSet, profile) => {
      await writeNetworkSecurityConfigs(projectRoot, { EAS_BUILD_PROFILE: profile }, BUILD_DATE);

      const xml = readXml(sourceSet, "network_security_config");
      const configs = pinnedDomainConfigs(xml);
      expect(configs.map((c) => c.host)).toEqual(MANAGED_HOSTS);
      for (const config of configs) {
        expect(config.pins).toEqual(ISRG_ROOT_PINS);
        expect(config.expiration).toBe(EXPECTED_EXPIRATION);
      }
      // Every pin in the file is one of the roots: no leaf or intermediate pin anywhere.
      const allPins = [...xml.matchAll(/<pin digest="SHA-256">([^<]+)<\/pin>/g)].map((m) => m[1]);
      expect(allPins).toHaveLength(MANAGED_HOSTS.length * ISRG_ROOT_PINS.length);
      expect(new Set(allPins)).toEqual(new Set(ISRG_ROOT_PINS));
      expect(xml).toContain('<base-config cleartextTrafficPermitted="false" />');
    },
  );

  it("keeps the release main config free of cleartext with pinning added", async () => {
    await writeNetworkSecurityConfigs(projectRoot, { EAS_BUILD_PROFILE: "production" }, BUILD_DATE);

    const main = readXml("main", "network_security_config");
    expect(main).not.toContain('cleartextTrafficPermitted="true"');
    for (const host of DEV_HOSTS) {
      expect(main).not.toContain(host);
    }
  });

  it("sets the pin-set expiration to the UTC build date plus 365 days", () => {
    expect(pinSetExpiration(BUILD_DATE)).toBe(EXPECTED_EXPIRATION);
    expect(pinSetExpiration(new Date("2027-03-01T00:00:00Z"))).toBe("2028-02-29");
  });

  it("fails the prebuild on an invalid build date instead of writing a malformed expiration", async () => {
    expect(() => pinSetExpiration(new Date("not a date"))).toThrow(/valid build date/);
    await expect(
      writeNetworkSecurityConfigs(projectRoot, {}, new Date(Number.NaN)),
    ).rejects.toThrow(/valid build date/);
  });

  it("holds the documented hosts and root pins in the shared pin module", () => {
    expect([...MANAGED_PINNED_HOSTS]).toEqual(MANAGED_HOSTS);
    expect(MANAGED_ROOT_PINS.map((pin: { spkiSha256: string }) => pin.spkiSha256)).toEqual(
      ISRG_ROOT_PINS,
    );
    expect(ANDROID_PIN_SET_VALIDITY_DAYS).toBe(365);
  });

  it("pins every host the managed clients connect to by default", () => {
    for (const baseURL of [MANAGED_SYNC_BASE_URL, MANAGED_CLOUD_AUTH_BASE_URL]) {
      expect(MANAGED_PINNED_HOSTS).toContain(new URL(baseURL).hostname);
    }
  });
});

describe("Android backup and device-to-device transfer exclusion", () => {
  it("excludes every backup domain from cloud backup and device-to-device transfer", async () => {
    await writeBackupRules(projectRoot);

    const rules = readXml("main", "ovumcy_data_extraction_rules");
    const channels = [...rules.matchAll(/<(cloud-backup|device-transfer)>([\s\S]*?)<\/\1>/g)];
    expect(channels.map((m) => m[1])).toEqual(["cloud-backup", "device-transfer"]);
    for (const [, , body] of channels) {
      expect(body).not.toContain("<include");
      for (const domain of BACKUP_DOMAINS) {
        expect(body).toContain(`<exclude domain="${domain}" path="." />`);
      }
    }

    const legacy = readXml("main", "ovumcy_full_backup_content");
    expect(legacy).not.toContain("<include");
    for (const domain of BACKUP_DOMAINS) {
      expect(legacy).toContain(`<exclude domain="${domain}" path="." />`);
    }
  });

  it("points the manifest at its own rules, replacing expo-secure-store's partial ones", () => {
    const manifest = {
      manifest: {
        $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
        application: [
          {
            $: {
              "android:name": ".MainApplication",
              "android:dataExtractionRules": "@xml/secure_store_data_extraction_rules",
              "android:fullBackupContent": "@xml/secure_store_backup_rules",
            },
          },
        ],
      },
    };

    const result = applyBackupRulesToManifest(manifest as never) as typeof manifest;

    const attrs = result.manifest.application[0]?.$;
    expect(attrs?.["android:dataExtractionRules"]).toBe("@xml/ovumcy_data_extraction_rules");
    expect(attrs?.["android:fullBackupContent"]).toBe("@xml/ovumcy_full_backup_content");
  });

  it("keeps allowBackup off, the exclusion plugin wired, and expo-secure-store's own backup rules disabled", () => {
    expect(appJson.expo.android.allowBackup).toBe(false);
    expect(pluginEntries()).toContain("./plugins/withAndroidExcludeDataFromBackup");
    expect(appJson.expo.plugins).toContainEqual([
      "expo-secure-store",
      { configureAndroidBackup: false },
    ]);
  });
});
