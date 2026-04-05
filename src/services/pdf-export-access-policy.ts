import type { SyncMode } from "../sync/sync-contract";

export type PDFExportAccessReason = "cloud_only" | "plan_required" | null;

export function resolvePDFExportAccessState(input: {
  hasSyncSession: boolean;
  managedDoctorPDFAllowed: boolean;
  syncMode: SyncMode;
}): {
  enabled: boolean;
  reason: PDFExportAccessReason;
} {
  if (input.syncMode !== "managed" || !input.hasSyncSession) {
    return {
      enabled: false,
      reason: "cloud_only",
    };
  }

  if (input.managedDoctorPDFAllowed) {
    return {
      enabled: true,
      reason: null,
    };
  }

  return {
    enabled: false,
    reason: "plan_required",
  };
}
