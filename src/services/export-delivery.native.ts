import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import type {
  ExportDeliveryClient,
  ExportDeliveryResult,
} from "./export-delivery";
import type { ExportArtifact } from "./export-service";

export function createPlatformExportDeliveryClient(): ExportDeliveryClient {
  return {
    async deliver(artifact: ExportArtifact): Promise<ExportDeliveryResult> {
      if (!(await Sharing.isAvailableAsync())) {
        return {
          ok: false,
          errorCode: "delivery_unavailable",
        };
      }

      try {
        const file = new File(Paths.cache, artifact.filename);
        if (file.exists) {
          file.delete();
        }
        file.create({
          intermediates: true,
          overwrite: true,
        });
        file.write(artifact.content);

        await Sharing.shareAsync(file.uri, {
          mimeType: artifact.mimeType,
          dialogTitle: "Export Ovumcy data",
        });

        return { ok: true };
      } catch {
        return {
          ok: false,
          errorCode: "delivery_failed",
        };
      }
    },
  };
}
