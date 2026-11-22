### Security

- **The managed account connection refuses an insecure server address.** A build whose managed cloud address is plain http to a public host, another scheme, or not a URL at all now sends no request to it — sign-in, billing and partner calls fail as unreachable instead of putting passwords or session tokens on the wire unencrypted. Plain http stays allowed only to a local-network development server.
