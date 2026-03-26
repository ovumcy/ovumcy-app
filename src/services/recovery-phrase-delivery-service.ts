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

  return deliveryClient.deliver({
    filename: `${PRIVATE_EXPORT_FILENAME_PREFIX}-${formatLocalDate(now)}.txt`,
    mimeType: "text/plain",
    content: `Ovumcy recovery phrase\n\n${normalizedRecoveryPhrase}\n`,
  });
}
