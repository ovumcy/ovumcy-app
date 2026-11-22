import { useCallback, useEffect, useRef } from "react";

import type { ManagedCloudPremiumFeatures } from "../../sync/managed-cloud-api-client";
import { EMPTY_MANAGED_PREMIUM_FEATURES } from "../../services/managed-premium-features-service";

export type LocalFirstPremiumPass<S> = {
  loadLocal: (premiumFeatures: ManagedCloudPremiumFeatures) => Promise<S>;
  loadPremium: () => Promise<ManagedCloudPremiumFeatures>;
  // "premium" marks the reload that applies a changed premium answer; it can
  // land after the user started editing the "local" state.
  apply: (state: S, phase: "local" | "premium") => void;
};

function samePremiumFeatures(
  left: ManagedCloudPremiumFeatures,
  right: ManagedCloudPremiumFeatures,
): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (
      left[key as keyof ManagedCloudPremiumFeatures] !==
      right[key as keyof ManagedCloudPremiumFeatures]
    ) {
      return false;
    }
  }
  return true;
}

// Managed unlocks never gate baseline local rendering: each pass renders local
// state first, with the premium answer this mount last resolved (none on the
// first pass), then resolves premium and reloads only when the answer differs.
// Only the latest pass may apply; a premium load that throws resolves locked.
export function useLocalFirstPremium() {
  const lastPremiumRef = useRef<ManagedCloudPremiumFeatures>(
    EMPTY_MANAGED_PREMIUM_FEATURES,
  );
  const generationRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      generationRef.current += 1;
    };
  }, []);

  return useCallback(
    async <S,>({ loadLocal, loadPremium, apply }: LocalFirstPremiumPass<S>): Promise<S> => {
      generationRef.current += 1;
      const generation = generationRef.current;
      const isCurrent = () =>
        isMountedRef.current && generation === generationRef.current;

      const usedPremium = lastPremiumRef.current;
      const localState = await loadLocal(usedPremium);
      if (!isCurrent()) {
        return localState;
      }
      apply(localState, "local");

      void (async () => {
        let premium: ManagedCloudPremiumFeatures;
        try {
          premium = await loadPremium();
        } catch {
          premium = EMPTY_MANAGED_PREMIUM_FEATURES;
        }
        if (!isCurrent()) {
          return;
        }
        lastPremiumRef.current = premium;
        if (samePremiumFeatures(premium, usedPremium)) {
          return;
        }
        try {
          const upgradedState = await loadLocal(premium);
          if (isCurrent()) {
            apply(upgradedState, "premium");
          }
        } catch {
          // The local render above stands; the next pass retries.
        }
      })();

      return localState;
    },
    [],
  );
}
