/**
 * The managed-cloud TLS pin set: the one committed source of truth for which
 * hosts are pinned and to which keys. Both platform config plugins read it —
 * `withAndroidNetworkSecurityConfig.js` (Android network security config
 * `<pin-set>`) and `withIosPinnedDomains.js` (iOS App Transport Security
 * `NSPinnedDomains`) — so the two platforms cannot drift apart.
 *
 * Shape of the pin: the Let's Encrypt ISRG **root** keys only. No leaf and no
 * intermediate is pinned anywhere: ACME renewal mints a new leaf key roughly
 * every 60 days and Let's Encrypt rotates its intermediates without notice,
 * while a root key survives every renewal beneath it. Both platforms match a
 * pin against the validated chain including its trust anchor, so a root pin
 * holds whether the root is sent by the server or supplied by the device trust
 * store.
 *
 * Why four: X1 anchors the RSA chain and X2 the ECDSA chain, and either may be
 * served without an app release. YR and YE are the next root generation,
 * today cross-signed by X1 and X2 and present in the served chain; once they
 * land in platform trust stores the validated chain ends at them and contains
 * neither X1 nor X2. Shipping all four covers both sides of that migration.
 *
 * A pin is the base64 SHA-256 of the certificate's SubjectPublicKeyInfo. It
 * follows the key, so a root and its cross-signed re-issuance share one pin.
 * Rationale, derivation commands, rotation rule and rollback:
 * docs/sync-trust-model.md, "TLS Pinning Posture".
 *
 * Changing this file is an infrastructure contract: moving a pinned host off
 * Let's Encrypt, or behind a TLS-terminating CDN/WAF/proxy, breaks every
 * install carrying the old set. A release with the new set ships first.
 */

const MANAGED_PINNED_HOSTS = Object.freeze(['managed.ovumcy.cloud', 'sync.ovumcy.cloud']);

const MANAGED_ROOT_PINS = Object.freeze([
  // Re-derived 2026-11-28 from the Windows, Node and Git root stores and from
  // the live chains of both pinned hosts.
  Object.freeze({ ca: 'ISRG Root X1', spkiSha256: 'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=' }),
  // Re-derived 2026-11-28 from the Windows, Node and Git root stores.
  Object.freeze({ ca: 'ISRG Root X2', spkiSha256: 'diGVwiVYbubAI3RW4hB9xU8e/CH2GnkuvVFZE8zmgzI=' }),
  // Re-derived 2026-11-28 from the live chains of both pinned hosts
  // (leaf <- YR1/YR2 <- Root YR cross-signed by X1).
  Object.freeze({ ca: 'ISRG Root YR', spkiSha256: 'fk6IOKit1ild5647BH06ujSIq5XbCgqlbYl6ANhhi88=' }),
  // Not re-derived on 2026-11-28 (no store or live chain on hand carries it);
  // value as derived 2026-07-23 from letsencrypt.org/certs/gen-y/root-ye.der
  // and cross-checked against the live chain of letsencrypt.org.
  Object.freeze({ ca: 'ISRG Root YE', spkiSha256: 'sCkq5UWXjg+7mKu9lMhhYF5bGLsy7VI/UNW3tccdR7w=' }),
]);

// Android only: the network security config `<pin-set expiration>` is set this
// many days after the build date. Past it Android stops enforcing the pins and
// falls back to CA-chain trust, so an install nobody updates for a year
// degrades to the pre-pinning posture instead of refusing to connect. iOS ATS
// has no equivalent.
const ANDROID_PIN_SET_VALIDITY_DAYS = 365;

module.exports = {
  MANAGED_PINNED_HOSTS,
  MANAGED_ROOT_PINS,
  ANDROID_PIN_SET_VALIDITY_DAYS,
};
