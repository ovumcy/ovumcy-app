### Security

- **Ovumcy Cloud connections are pinned to the Let's Encrypt root keys.** On Android and iOS,
  `managed.ovumcy.cloud` and `sync.ovumcy.cloud` now accept only a certificate chain that runs to
  one of the four ISRG roots (X1, X2, YR, YE), so a valid certificate from any other CA is
  refused before a request is sent. The pins use the platforms' own TLS configuration — the
  Android network security config, with a pin-set expiry one year after the build, and iOS App
  Transport Security — with no new dependency. Self-hosted sync and the web build are unchanged.
