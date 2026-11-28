const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');
const {
  ANDROID_PIN_SET_VALIDITY_DAYS,
  MANAGED_PINNED_HOSTS,
  MANAGED_ROOT_PINS,
} = require('./managed-cert-pins');

/**
 * Generates the Android native network-security config at `expo prebuild` time.
 * `android/` is gitignored (nothing under it is committed), so this plugin —
 * not a checked-in native file — is the actual committed source of truth:
 * 1. writes android/app/src/main/res/xml/network_security_config.xml (every
 *    variant) and android/app/src/debug/res/xml/network_security_config.xml
 *    (debug variant only — Android resource merging lets the debug source set
 *    override main);
 * 2. sets android:networkSecurityConfig="@xml/network_security_config" on the
 *    <application> tag of the main AndroidManifest.xml.
 *
 * Policy: cleartext HTTP is blocked everywhere. The emulator-host/loopback dev
 * addresses (10.0.2.2, 127.0.0.1, localhost) are exempted only where a dev
 * server actually needs them: in the debug variant (Metro) and in the main
 * config of an EAS build for a profile listed in DEV_CLEARTEXT_PROFILES (the
 * eas.json "local" profile, a release-type APK whose sync endpoints are
 * http://10.0.2.2). Release builds for every other profile ship no exception;
 * a release build made outside EAS against a local stack needs
 * EAS_BUILD_PROFILE=local set at prebuild.
 *
 * Pinning: both configs (main and debug) pin each managed host from
 * managed-cert-pins.js to the Let's Encrypt ISRG root keys — one
 * <domain-config> per host, no subdomains, with a <pin-set> of the four root
 * SPKI SHA-256 digests. Android matches a pin against the validated chain
 * including its trust anchor, so a root pin is honoured; no leaf or
 * intermediate is pinned. The <pin-set expiration> is the build date (UTC, at
 * prebuild) plus ANDROID_PIN_SET_VALIDITY_DAYS: past it Android stops
 * enforcing the pins and falls back to CA-chain trust rather than refusing to
 * connect, which bounds the damage of a stale pin set on an un-updated install.
 * The iOS counterpart is withIosPinnedDomains.js.
 *
 * This local plugin exists because the installed expo-build-properties
 * (SDK 58) exposes only a boolean `android.usesCleartextTraffic` and has no
 * networkSecurityConfig passthrough. If a later expo-build-properties version
 * adds one, this plugin can be replaced by it.
 */

const RESOURCE_NAME = 'network_security_config';
const DEV_CLEARTEXT_HOSTS = ['10.0.2.2', '127.0.0.1', 'localhost'];
const DEV_CLEARTEXT_PROFILES = ['local'];
const DAY_MS = 24 * 60 * 60 * 1000;

// The <pin-set expiration> value: `now` plus the validity window, as the UTC
// calendar date Android expects (yyyy-MM-dd). `now` is injected so a test can
// fix the clock; an invalid date fails the prebuild instead of writing a
// malformed attribute.
function pinSetExpiration(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('withAndroidNetworkSecurityConfig: pin-set expiration needs a valid build date');
  }
  return new Date(now.getTime() + ANDROID_PIN_SET_VALIDITY_DAYS * DAY_MS).toISOString().slice(0, 10);
}

function buildPinnedDomainsXml(pinExpiration) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pinExpiration)) {
    throw new Error(`withAndroidNetworkSecurityConfig: malformed pin-set expiration "${pinExpiration}"`);
  }
  const pins = MANAGED_ROOT_PINS.map(
    ({ spkiSha256 }) => `            <pin digest="SHA-256">${spkiSha256}</pin>`
  ).join('\n');
  return MANAGED_PINNED_HOSTS.map(
    (host) => `    <domain-config>
        <domain includeSubdomains="false">${host}</domain>
        <pin-set expiration="${pinExpiration}">
${pins}
        </pin-set>
    </domain-config>
`
  ).join('');
}

function buildNetworkSecurityConfigXml({ allowDevCleartext, pinExpiration }) {
  const pinnedDomains = buildPinnedDomainsXml(pinExpiration);
  const devDomains = allowDevCleartext
    ? `    <domain-config cleartextTrafficPermitted="true">
${DEV_CLEARTEXT_HOSTS.map(
  (host) => `        <domain includeSubdomains="false">${host}</domain>`
).join('\n')}
    </domain-config>
`
    : '';
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
${pinnedDomains}${devDomains}</network-security-config>
`;
}

function releaseAllowsDevCleartext(env) {
  return DEV_CLEARTEXT_PROFILES.includes(env.EAS_BUILD_PROFILE);
}

async function writeNetworkSecurityConfigs(platformProjectRoot, env, now = new Date()) {
  const pinExpiration = pinSetExpiration(now);
  const variants = [
    { sourceSet: 'main', allowDevCleartext: releaseAllowsDevCleartext(env) },
    { sourceSet: 'debug', allowDevCleartext: true },
  ];
  for (const { sourceSet, allowDevCleartext } of variants) {
    const xmlDir = path.join(platformProjectRoot, 'app', 'src', sourceSet, 'res', 'xml');
    await fs.promises.mkdir(xmlDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(xmlDir, `${RESOURCE_NAME}.xml`),
      buildNetworkSecurityConfigXml({ allowDevCleartext, pinExpiration }),
      'utf8'
    );
  }
}

function withNetworkSecurityConfigResource(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      await writeNetworkSecurityConfigs(config.modRequest.platformProjectRoot, process.env);
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

function withAndroidNetworkSecurityConfig(config) {
  config = withNetworkSecurityConfigResource(config);
  config = withNetworkSecurityConfigManifest(config);
  return config;
}

module.exports = withAndroidNetworkSecurityConfig;
module.exports.buildNetworkSecurityConfigXml = buildNetworkSecurityConfigXml;
module.exports.writeNetworkSecurityConfigs = writeNetworkSecurityConfigs;
module.exports.pinSetExpiration = pinSetExpiration;
