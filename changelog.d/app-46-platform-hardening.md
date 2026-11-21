### Security

- **Android device-to-device transfer no longer copies app data.** On Android 12 and later, turning off backup no longer stops a phone-to-phone transfer, so the app now ships rules that exclude all of its data from both cloud backup and device transfer. To move to a new phone, use JSON export/import or sync.
- **Release builds no longer allow unencrypted HTTP to emulator and loopback addresses.** Only debug builds and the `local` EAS profile keep that exception for development servers.
