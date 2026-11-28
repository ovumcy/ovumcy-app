const { withInfoPlist } = require('expo/config-plugins');
const { MANAGED_PINNED_HOSTS, MANAGED_ROOT_PINS } = require('./managed-cert-pins');

/**
 * Pins the managed hosts to the Let's Encrypt ISRG root keys through iOS App
 * Transport Security, at `expo prebuild` time: for each host in
 * managed-cert-pins.js, Info.plist gains
 *
 *   NSAppTransportSecurity.NSPinnedDomains[host] = {
 *     NSIncludesSubdomains: false,
 *     NSPinnedCAIdentities: [{ SPKI-SHA256-BASE64: <root pin> }, ...],
 *   }
 *
 * NSPinnedCAIdentities matches a CA certificate anywhere in the validated
 * chain, the trust anchor included, so a root pin holds whether the root is
 * sent by the server or supplied by the device trust store. No leaf identity
 * (NSPinnedLeafIdentities) is set — the leaf key changes on every ACME renewal.
 * ATS applies to URLSession, which the managed and sync clients reach through
 * expo/fetch.
 *
 * ATS has no expiration: unlike the Android <pin-set expiration>, these pins
 * are enforced for as long as the installed build runs. A stale pin set is
 * recovered only by an app update, which is why the set carries the next root
 * generation (YE, YR) ahead of the trust-store migration.
 *
 * The keys are MERGED into any existing NSAppTransportSecurity dictionary —
 * other ATS keys and other pinned domains set by Expo or another plugin are
 * kept; only the managed hosts' own entries are written, replacing any earlier
 * value for those hosts so the committed pin set stays authoritative.
 *
 * `ios/` is gitignored (nothing under it is committed), so this plugin is the
 * committed source of truth for the pinning keys in Info.plist. The Android
 * counterpart is withAndroidNetworkSecurityConfig.js. Expo SDK 58 has no
 * first-party ATS pinning option, which is why this is a local plugin.
 */

function buildPinnedDomainEntry() {
  return {
    NSIncludesSubdomains: false,
    NSPinnedCAIdentities: MANAGED_ROOT_PINS.map(({ spkiSha256 }) => ({
      'SPKI-SHA256-BASE64': spkiSha256,
    })),
  };
}

function applyPinnedDomains(infoPlist) {
  const ats = { ...(infoPlist.NSAppTransportSecurity ?? {}) };
  const pinnedDomains = { ...(ats.NSPinnedDomains ?? {}) };
  for (const host of MANAGED_PINNED_HOSTS) {
    pinnedDomains[host] = buildPinnedDomainEntry();
  }
  ats.NSPinnedDomains = pinnedDomains;
  return { ...infoPlist, NSAppTransportSecurity: ats };
}

function withIosPinnedDomains(config) {
  return withInfoPlist(config, (config) => {
    config.modResults = applyPinnedDomains(config.modResults);
    return config;
  });
}

module.exports = withIosPinnedDomains;
module.exports.applyPinnedDomains = applyPinnedDomains;
