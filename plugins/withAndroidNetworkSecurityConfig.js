const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Generates the Android native network-security config at `expo prebuild` time.
 * `android/` is gitignored (nothing under it is committed), so this plugin —
 * not a checked-in native file — is the actual committed source of truth:
 * 1. writes android/app/src/main/res/xml/network_security_config.xml;
 * 2. sets android:networkSecurityConfig="@xml/network_security_config" on the
 *    <application> tag of the main AndroidManifest.xml.
 *
 * Policy: cleartext HTTP is blocked everywhere except emulator-host/loopback
 * dev addresses (10.0.2.2, 127.0.0.1, localhost), which serve Metro in debug
 * builds and the eas.json "local" profile sync endpoints on the emulator.
 *
 * This local plugin exists because the installed expo-build-properties
 * (SDK 54) exposes only a boolean `android.usesCleartextTraffic` and has no
 * networkSecurityConfig passthrough. If a later expo-build-properties version
 * adds one, this plugin can be replaced by it.
 */

const RESOURCE_NAME = 'network_security_config';

const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
`;

function withNetworkSecurityConfigResource(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      await fs.promises.mkdir(xmlDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(xmlDir, `${RESOURCE_NAME}.xml`),
        NETWORK_SECURITY_CONFIG_XML,
        'utf8'
      );
      return config;
    },
  ]);
}

function withNetworkSecurityConfigManifest(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    mainApplication.$['android:networkSecurityConfig'] = `@xml/${RESOURCE_NAME}`;
    return config;
  });
}

module.exports = function withAndroidNetworkSecurityConfig(config) {
  config = withNetworkSecurityConfigResource(config);
  config = withNetworkSecurityConfigManifest(config);
  return config;
};
