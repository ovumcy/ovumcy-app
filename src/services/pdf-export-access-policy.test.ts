import { resolvePDFExportAccessState } from "./pdf-export-access-policy";

describe("resolvePDFExportAccessState", () => {
  it("locks with cloud_only for self-hosted sync even with a session and an allowed plan", () => {
    expect(
      resolvePDFExportAccessState({
        hasSyncSession: true,
        managedDoctorPDFAllowed: true,
        syncMode: "self_hosted",
      }),
    ).toEqual({ enabled: false, reason: "cloud_only" });
  });

  it("locks with cloud_only when managed mode has no active session", () => {
    expect(
      resolvePDFExportAccessState({
        hasSyncSession: false,
        managedDoctorPDFAllowed: true,
        syncMode: "managed",
      }),
    ).toEqual({ enabled: false, reason: "cloud_only" });
  });

  it("locks with plan_required for a managed session without the doctorPDF entitlement", () => {
    expect(
      resolvePDFExportAccessState({
        hasSyncSession: true,
        managedDoctorPDFAllowed: false,
        syncMode: "managed",
      }),
    ).toEqual({ enabled: false, reason: "plan_required" });
  });

  it("enables only for a managed session with the doctorPDF entitlement", () => {
    expect(
      resolvePDFExportAccessState({
        hasSyncSession: true,
        managedDoctorPDFAllowed: true,
        syncMode: "managed",
      }),
    ).toEqual({ enabled: true, reason: null });
  });

  it("never grants access without a session regardless of the other inputs", () => {
    for (const syncMode of ["managed", "self_hosted"] as const) {
      for (const managedDoctorPDFAllowed of [true, false]) {
        const state = resolvePDFExportAccessState({
          hasSyncSession: false,
          managedDoctorPDFAllowed,
          syncMode,
        });
        expect(state.enabled).toBe(false);
        expect(state.reason).toBe("cloud_only");
      }
    }
  });
});
