/**
 * Web export delivery uses ephemeral blob URLs that are revoked
 * immediately after the share dialog returns; there's no on-disk
 * artifact to sweep. No-op for type-contract parity.
 */
export async function cleanupStaleExportArtifacts(): Promise<void> {
  return;
}
