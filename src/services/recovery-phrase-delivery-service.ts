import type {
  ExportDeliveryClient,
  ExportDeliveryResult,
} from "./export-delivery";
import { formatLocalDate } from "./profile-settings-policy";

const PRIVATE_EXPORT_FILENAME_PREFIX = "ovumcy-private-export";

export async function deliverRecoveryPhraseArtifact(
  deliveryClient: ExportDeliveryClient,
  recoveryPhrase: string,
  now: Date,
): Promise<ExportDeliveryResult> {
  const normalizedRecoveryPhrase = recoveryPhrase.trim();
  if (normalizedRecoveryPhrase.length === 0) {
    return {
      ok: false,
      errorCode: "delivery_failed",
    };
  }

  // Body intentionally carries no header / app name / context label. A
  // labeled "Ovumcy recovery phrase" string was preserved by OS share-sheet
  // recents and receiving-app caches independently of our own cleanup,
  // turning a misclick on the share dialog into a context-rich disclosure.
  // The artifact is sensitive even unlabeled, but the label was a multiplier.
  return deliveryClient.deliver({
    filename: `${PRIVATE_EXPORT_FILENAME_PREFIX}-${formatLocalDate(now)}.txt`,
    mimeType: "text/plain",
    content: `${normalizedRecoveryPhrase}\n`,
  });
}
