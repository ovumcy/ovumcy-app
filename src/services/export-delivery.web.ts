import type {
  ExportDeliveryClient,
  ExportDeliveryResult,
} from "./export-delivery";
import type { ExportArtifact } from "./export-service";

export function createPlatformExportDeliveryClient(): ExportDeliveryClient {
  return {
    async deliver(artifact: ExportArtifact): Promise<ExportDeliveryResult> {
      if (
        typeof window === "undefined" ||
        typeof document === "undefined" ||
        typeof URL === "undefined" ||
        typeof Blob === "undefined"
      ) {
        return {
          ok: false,
          errorCode: "delivery_unavailable",
        };
      }

      try {
        const blob = new Blob([artifact.content], { type: artifact.mimeType });
        const objectURL = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectURL;
        link.download = artifact.filename;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => {
          URL.revokeObjectURL(objectURL);
        }, 500);

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
