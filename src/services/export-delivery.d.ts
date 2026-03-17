import type { ExportArtifact } from "./export-service";

export type ExportDeliveryErrorCode =
  | "delivery_unavailable"
  | "delivery_failed";

export type ExportDeliveryResult =
  | { ok: true }
  | {
      ok: false;
      errorCode: ExportDeliveryErrorCode;
    };

export interface ExportDeliveryClient {
  deliver(artifact: ExportArtifact): Promise<ExportDeliveryResult>;
}

export declare function createPlatformExportDeliveryClient(): ExportDeliveryClient;
