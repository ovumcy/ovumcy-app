// cert-pin-policy encapsulates the pure decision logic that compares an
// expected pin set for a host against the SPKI fingerprint observed by the
// native bridge at connect time. Keeping this layer free of I/O lets the
// sync-client orchestration and the UX warning surface share the same
// canonical comparison without each re-deriving the matching rules.
//
// The expected pin set is sourced differently by endpoint mode, and the two
// modes deliberately pin at different depths of the chain:
//   - self_hosted: the leaf, Trust On First Use. The caller reads the
//     owner-entered pin from `cert-pin-store` and wraps it into a
//     single-element array. A self-hoster may use a private CA or a
//     self-signed cert, so no public root is a meaningful anchor there.
//   - managed: the CA. The caller reads the build-time pin constants from
//     `sync-contract` — the Let's Encrypt ISRG root keys, multi-pin so the
//     pin survives ACME renewal (which mints a new leaf key) and the
//     announced root-generation migration. See the TLS Pinning Posture
//     section in docs/sync-trust-model.md for the pin set and the rationale.
//
// Because the managed pin is a CA pin, the observed fingerprint compared here
// is whichever certificate in the validated chain the enforcement layer
// matched — not necessarily the leaf. Both TrustKit (iOS) and OkHttp's
// CertificatePinner (Android) match against every certificate in the
// validated chain, anchor included, which is what makes a root pin work.
//
// The native enforcement layer (`react-native-ssl-public-key-pinning`) blocks
// a TLS handshake when no certificate in the validated chain is in its
// registered pin set. This JS-layer policy backs that with a defensive check
// at the sync-connect boundary so a regression in pin-set registration cannot
// silently let an unpinned connect through.

export type CertPinEvaluationResult =
  | {
      // no_pin_recorded means no pins are registered for this host — either
      // self-hosted has not been set up yet (TOFU bootstrap window) or the
      // managed pin constants are intentionally empty during local
      // development. Callers MUST treat this as "pinning is disabled for
      // this host" and decide policy based on mode (self-hosted: prompt the
      // owner to enter a fingerprint; managed: refuse if pinning is meant
      // to be live, or continue under standard CA chain trust during dev).
      status: "no_pin_recorded";
      observedFingerprint: string;
    }
  | {
      // matches means the observed fingerprint equals one of the expected
      // pins. Caller may proceed with the connect.
      status: "matches";
      matchedFingerprint: string;
    }
  | {
      // mismatch means at least one pin was registered for this host but
      // the observed leaf does not match any of them. Caller MUST refuse
      // the connect and surface a UX warning that names this as either
      // operator-initiated cert rotation (self-hosted) or active MITM.
      // The owner reset path (sensitive-action-auth gated) is the only
      // legitimate way to change the self-hosted pin set; managed pins
      // can only be updated by a new app release.
      status: "mismatch";
      expectedFingerprints: readonly string[];
      observedFingerprint: string;
    };

export function evaluateCertPin(input: {
  pinnedSPKIFingerprints: readonly string[] | null | undefined;
  observedFingerprint: string;
}): CertPinEvaluationResult {
  const { pinnedSPKIFingerprints, observedFingerprint } = input;

  if (!isWellFormedFingerprint(observedFingerprint)) {
    // A malformed fingerprint from the native bridge is itself suspicious:
    // either the bridge regressed or something is tampering with the
    // observed value. Fold into mismatch so the caller refuses; never let
    // garbage become a fresh pin.
    return {
      status: "mismatch",
      expectedFingerprints: pinnedSPKIFingerprints ?? [],
      observedFingerprint,
    };
  }

  if (!pinnedSPKIFingerprints || pinnedSPKIFingerprints.length === 0) {
    return {
      status: "no_pin_recorded",
      observedFingerprint,
    };
  }

  for (const expected of pinnedSPKIFingerprints) {
    if (
      isWellFormedFingerprint(expected) &&
      constantTimeEqual(expected, observedFingerprint)
    ) {
      return {
        status: "matches",
        matchedFingerprint: expected,
      };
    }
  }

  return {
    status: "mismatch",
    expectedFingerprints: pinnedSPKIFingerprints,
    observedFingerprint,
  };
}

function constantTimeEqual(a: string, b: string): boolean {
  // Fingerprint strings are public values once observed; a timing
  // side-channel here would not leak high-entropy material on its own. The
  // constant-time compare is cheap hygiene — both inputs are already
  // length-bounded by the well-formed check, so the loop runs at most 44
  // iterations and avoids early-exit on the first differing byte.
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function isWellFormedFingerprint(fingerprint: string): boolean {
  return /^[A-Za-z0-9+/]{43}=$/.test(fingerprint);
}
