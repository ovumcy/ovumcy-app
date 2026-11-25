### Internal

- **Android build declares the Google Play billing permission.** The manifest now carries
  `com.android.vending.BILLING`, so Play Console accepts in-app products for the package. No
  purchase flow ships with it and no existing permission changes.
