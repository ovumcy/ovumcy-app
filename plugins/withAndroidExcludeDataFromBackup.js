const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Keeps every on-device data store out of Android's OS-managed backup and
 * device-to-device transfer, at `expo prebuild` time. `android.allowBackup=false`
 * (app.json) alone does not do this on Android 12+: there it still disables
 * cloud backup but no longer disables device-to-device transfer, which only
 * the `android:dataExtractionRules` file governs. This plugin:
 * 1. writes android/app/src/main/res/xml/ovumcy_data_extraction_rules.xml
 *    (Android 12+) and ovumcy_full_backup_content.xml (Android 11 and lower),
 *    both excluding every backup domain from every channel;
 * 2. points android:dataExtractionRules and android:fullBackupContent on the
 *    <application> tag at them, overwriting whatever another plugin set
 *    (expo-secure-store's own rules transfer every shared-preferences file
 *    except its own, which is why its `configureAndroidBackup` is off).
 *
 * `android/` is gitignored, so this plugin is the committed source of truth —
 * the Android mirror of withIosExcludeDataFromICloudBackup.js.
 */

const DATA_EXTRACTION_RULES = 'ovumcy_data_extraction_rules';
const FULL_BACKUP_CONTENT = 'ovumcy_full_backup_content';

// Credential-protected and device-protected storage, plus app-specific external
// storage: every domain the backup schemes accept.
const BACKUP_DOMAINS = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];

function excludeAll(indent) {
  return BACKUP_DOMAINS.map((domain) => `${indent}<exclude domain="${domain}" path="." />`).join(
    '\n'
  );
}

function buildDataExtractionRulesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
${excludeAll('        ')}
    </cloud-backup>
    <device-transfer>
${excludeAll('        ')}
    </device-transfer>
</data-extraction-rules>
`;
}

function buildFullBackupContentXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${excludeAll('    ')}
</full-backup-content>
`;
}

async function writeBackupRules(platformProjectRoot) {
  const xmlDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
  await fs.promises.mkdir(xmlDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(xmlDir, `${DATA_EXTRACTION_RULES}.xml`),
    buildDataExtractionRulesXml(),
    'utf8'
  );
  await fs.promises.writeFile(
    path.join(xmlDir, `${FULL_BACKUP_CONTENT}.xml`),
    buildFullBackupContentXml(),
    'utf8'
  );
}

function applyBackupRulesToManifest(androidManifest) {
  const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);
  mainApplication.$['android:dataExtractionRules'] = `@xml/${DATA_EXTRACTION_RULES}`;
  mainApplication.$['android:fullBackupContent'] = `@xml/${FULL_BACKUP_CONTENT}`;
  return androidManifest;
}

function withAndroidExcludeDataFromBackup(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      await writeBackupRules(config.modRequest.platformProjectRoot);
      return config;
    },
  ]);
  config = withAndroidManifest(config, (config) => {
    config.modResults = applyBackupRulesToManifest(config.modResults);
    return config;
  });
  return config;
}

module.exports = withAndroidExcludeDataFromBackup;
module.exports.BACKUP_DOMAINS = BACKUP_DOMAINS;
module.exports.applyBackupRulesToManifest = applyBackupRulesToManifest;
module.exports.writeBackupRules = writeBackupRules;
