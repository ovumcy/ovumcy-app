// Import the public config-plugins API through Expo's re-export (`expo` is a
// declared direct dependency). `mergeContents` is published on the
// `CodeGenerator` namespace — reaching for the internal
// `@expo/config-plugins/build/utils/generateCode` path instead couples this
// plugin to a transitive package's private layout, which a routine Expo bump
// can move without notice.
const { withAppDelegate, CodeGenerator } = require('expo/config-plugins');
const { mergeContents } = CodeGenerator;

/**
 * Excludes the app's on-device data stores from iOS iCloud / iTunes / device-transfer
 * backups at `expo prebuild` time by injecting a launch-time hook into the Swift
 * `AppDelegate`. This is the iOS mirror of `android.allowBackup=false` (app.json):
 * local-first health data must never leave the device through an OS-managed backup.
 *
 * Why a runtime hook and not a static setting:
 * - iOS has no Info.plist equivalent to Android's `allowBackup`. The only per-file
 *   control is the runtime resource value `NSURLIsExcludedFromBackupKey`, which must
 *   be set on a URL that exists on the device — it cannot be baked in at build time.
 * - Expo SDK 54 exposes no JS API for it: neither `expo-file-system` (v19) nor
 *   `expo-sqlite` (v16) surfaces `isExcludedFromBackup`, and `expo-build-properties`
 *   has no iOS backup option. So the exclusion cannot live in the storage layer as
 *   pure JS; it has to run in native code, which in the managed workflow means a
 *   config plugin. This local plugin exists for the same reason as
 *   `withAndroidNetworkSecurityConfig.js` — the managed toolchain has no first-party
 *   passthrough for it. If a future Expo release adds one, replace this plugin by it.
 *
 * What it excludes and why the two directories cover the at-rest data:
 * - `Documents/` — expo-sqlite's default database directory is `Documents/SQLite`
 *   (`SQLiteModule.swift`), holding `ovumcy-local.db` and its `-wal` / `-shm` sidecars
 *   (encrypted health data).
 * - `Library/Application Support/` — the current `@react-native-async-storage`
 *   backend stores under `Application Support/<bundleId>/RCTAsyncLocalStorage_V1`
 *   (`RNCAsyncStorage.mm`), holding bootstrap/profile/pref rows.
 * Both are backed up to iCloud by default (only `Library/Caches` and `tmp` are not).
 * Excluding a directory also excludes files created inside it later, so the SQLite
 * files and AsyncStorage rows are covered even though they are created after launch.
 * The hook runs on every launch, is idempotent, and never throws into app startup:
 * a failure to set the flag is logged, not fatal.
 *
 * `ios/` is gitignored (nothing under it is committed), so this plugin — not a
 * checked-in AppDelegate — is the committed source of truth. Secrets stay in the
 * Keychain via expo-secure-store with device-only accessibility and are governed
 * separately; this plugin covers the on-disk SQLite + AsyncStorage stores only.
 */

const TAG = 'ovumcy-exclude-icloud-backup';

// Inserted verbatim (indentation included) immediately before the AppDelegate's
// `return super.application(...)`. Must be valid statements inside that method body.
const EXCLUDE_BACKUP_SNIPPET = `    // Ovumcy privacy: keep on-device data stores out of iCloud/iTunes/device-transfer
    // backups (iOS mirror of Android allowBackup=false). Idempotent, runs each launch;
    // directory-level exclusion also covers files created later (SQLite WAL/SHM,
    // AsyncStorage). See SECURITY.md.
    do {
      let ovumcyFileManager = FileManager.default
      let ovumcyDataDirectories: [FileManager.SearchPathDirectory] = [.documentDirectory, .applicationSupportDirectory]
      for ovumcyDirectory in ovumcyDataDirectories {
        guard var ovumcyDataURL = ovumcyFileManager.urls(for: ovumcyDirectory, in: .userDomainMask).first else {
          continue
        }
        do {
          if !ovumcyFileManager.fileExists(atPath: ovumcyDataURL.path) {
            try ovumcyFileManager.createDirectory(at: ovumcyDataURL, withIntermediateDirectories: true)
          }
          var ovumcyResourceValues = URLResourceValues()
          ovumcyResourceValues.isExcludedFromBackup = true
          try ovumcyDataURL.setResourceValues(ovumcyResourceValues)
        } catch {
          NSLog("[ovumcy] Failed to exclude %@ from iCloud backup: %@", ovumcyDataURL.path, error.localizedDescription)
        }
      }
    }`;

function withIosExcludeDataFromICloudBackup(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error(
        `withIosExcludeDataFromICloudBackup expected a Swift AppDelegate but found ` +
          `"${config.modResults.language}". Update this plugin for the current template.`
      );
    }

    // mergeContents throws ERR_NO_MATCH if the anchor is missing — fail the build
    // loudly rather than silently shipping without the backup exclusion.
    const result = mergeContents({
      tag: TAG,
      src: config.modResults.contents,
      newSrc: EXCLUDE_BACKUP_SNIPPET,
      anchor: /return super\.application\(/,
      offset: 0,
      comment: '//',
    });

    config.modResults.contents = result.contents;
    return config;
  });
}

module.exports = withIosExcludeDataFromICloudBackup;
