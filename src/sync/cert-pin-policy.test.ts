import { evaluateCertPin } from "./cert-pin-policy";

const FINGERPRINT_A = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
const FINGERPRINT_B = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=";
const FINGERPRINT_C = "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=";

describe("cert-pin-policy", () => {
  it("reports no_pin_recorded when the host has no registered pins", () => {
    const result = evaluateCertPin({
      pinnedSPKIFingerprints: null,
      observedFingerprint: FINGERPRINT_A,
    });

    expect(result).toEqual({
      status: "no_pin_recorded",
      observedFingerprint: FINGERPRINT_A,
    });
  });

  it("reports no_pin_recorded when the pin set is empty", () => {
    const result = evaluateCertPin({
      pinnedSPKIFingerprints: [],
      observedFingerprint: FINGERPRINT_A,
    });

    expect(result.status).toBe("no_pin_recorded");
  });

  it("reports matches when the observed leaf is the only registered pin", () => {
    const result = evaluateCertPin({
      pinnedSPKIFingerprints: [FINGERPRINT_A],
      observedFingerprint: FINGERPRINT_A,
    });

    expect(result).toEqual({
      status: "matches",
      matchedFingerprint: FINGERPRINT_A,
    });
  });

  it("reports matches when the observed leaf matches one of multiple pins (rotation overlap)", () => {
    // Managed cert rotation: app ships with current + next. During the
    // cutover window the server may serve either; the connect must accept
    // both.
    const result = evaluateCertPin({
      pinnedSPKIFingerprints: [FINGERPRINT_A, FINGERPRINT_B, FINGERPRINT_C],
      observedFingerprint: FINGERPRINT_B,
    });

    expect(result).toEqual({
      status: "matches",
      matchedFingerprint: FINGERPRINT_B,
    });
  });

  it("reports mismatch when the observed leaf is in none of the registered pins", () => {
    const result = evaluateCertPin({
      pinnedSPKIFingerprints: [FINGERPRINT_A, FINGERPRINT_B],
      observedFingerprint: FINGERPRINT_C,
    });

    expect(result).toEqual({
      status: "mismatch",
      expectedFingerprints: [FINGERPRINT_A, FINGERPRINT_B],
      observedFingerprint: FINGERPRINT_C,
    });
  });

  it("treats a malformed observed fingerprint as a mismatch", () => {
    // A native bridge regression or active tampering with the observed
    // value must never be persisted as a fresh pin or treated as a match.
    const result = evaluateCertPin({
      pinnedSPKIFingerprints: [FINGERPRINT_A],
      observedFingerprint: "not-a-valid-fingerprint",
    });

    expect(result.status).toBe("mismatch");
  });

  it("treats a malformed observed fingerprint as a mismatch even without registered pins", () => {
    const result = evaluateCertPin({
      pinnedSPKIFingerprints: null,
      observedFingerprint: "",
    });

    expect(result.status).toBe("mismatch");
  });

  it("skips malformed entries in the pin set when scanning for a match", () => {
    // Defends against a corrupted store record or a hand-rolled constants
    // file with a typo: a single bad entry must not prevent a valid pin
    // further down the list from matching.
    const result = evaluateCertPin({
      pinnedSPKIFingerprints: ["malformed", FINGERPRINT_A],
      observedFingerprint: FINGERPRINT_A,
    });

    expect(result.status).toBe("matches");
  });
});
