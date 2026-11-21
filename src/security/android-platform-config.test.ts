import fs from "fs";
import os from "os";
import path from "path";

import appJson from "../../app.json";
import {
  BACKUP_DOMAINS,
  applyBackupRulesToManifest,
  writeBackupRules,
} from "../../plugins/withAndroidExcludeDataFromBackup";
import { writeNetworkSecurityConfigs } from "../../plugins/withAndroidNetworkSecurityConfig";

const DEV_HOSTS = ["10.0.2.2", "127.0.0.1", "localhost"];

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
      const domains = [...xml.matchAll(/<domain [^>]*>([^<]+)<\/domain>/g)].map((m) => m[1]);
      expect(domains).toEqual(DEV_HOSTS);
      expect(xml).not.toContain('includeSubdomains="true"');
    }
  });

  it("is wired into the app config", () => {
    expect(pluginEntries()).toContain("./plugins/withAndroidNetworkSecurityConfig");
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
