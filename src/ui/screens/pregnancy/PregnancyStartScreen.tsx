import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import type { Chorionicity, EddBasis, FetusCount } from "../../../models/pregnancy";
import { appStorage } from "../../../services/app-bootstrap-service";
import { loadPregnancyModuleOwned } from "../../../services/pregnancy-entitlement-service";
import {
  buildPregnancyStartDefaults,
  buildPregnancyStartPreview,
  startPregnancy,
  type StartPregnancyErrorCode,
  type StartPregnancyInput,
} from "../../../services/pregnancy-mode-service";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { ScreenScaffold } from "../../components/ScreenScaffold";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import { PregnancyStartFlowScreen } from "./PregnancyStartFlowScreen";

type PregnancyStartScreenProps = {
  storage?: LocalAppStorage;
  now?: Date;
};

type LoadStatus = "loading" | "locked" | "ready";

export function PregnancyStartScreen({
  storage = appStorage,
  now,
}: PregnancyStartScreenProps) {
  const router = useRouter();
  const { colors, language } = useAppPreferences();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [basis, setBasis] = useState<EddBasis>("lmp");
  const [lmpDate, setLmpDate] = useState("");
  const [eddInput, setEddInput] = useState("");
  // Multiples(education-only). Both start undefined -- never touching
  // either selector yields a plain singleton record identical to today's.
  const [fetusCount, setFetusCount] = useState<FetusCount | undefined>(undefined);
  const [chorionicity, setChorionicity] = useState<Chorionicity | undefined>(
    undefined,
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const copy = getPregnancyCopy(language);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const [profile, unlocked] = await Promise.all([
        storage.readProfileRecord(),
        loadPregnancyModuleOwned(),
      ]);
      if (!isMounted) {
        return;
      }

      if (!unlocked) {
        setStatus("locked");
        return;
      }

      const defaults = buildPregnancyStartDefaults(profile);
      setLmpDate(defaults.defaultLmp ?? "");
      setEddInput(defaults.defaultEdd ?? "");
      setStatus("ready");
    })();

    return () => {
      isMounted = false;
    };
  }, [storage]);

  const currentInput = useMemo<StartPregnancyInput>(
    () => ({
      eddBasis: basis,
      lmpDate,
      edd: eddInput,
      ...(fetusCount !== undefined ? { fetusCount } : {}),
      ...(chorionicity !== undefined ? { chorionicity } : {}),
    }),
    [basis, chorionicity, eddInput, fetusCount, lmpDate],
  );

  const preview = useMemo(
    () => buildPregnancyStartPreview(currentInput, effectiveNow, language),
    [currentInput, effectiveNow, language],
  );

  if (status === "loading") {
    return (
      <ScreenScaffold
        description={copy.wizard.subtitle}
        eyebrow={copy.entryCard.eyebrow}
        title={copy.wizard.title}
      >
        <View style={{ alignItems: "center", paddingVertical: 24 }}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </ScreenScaffold>
    );
  }

  function handleBasisSelect(value: EddBasis) {
    setError("");
    setBasis(value);
  }

  function handleDateChange(value: string) {
    setError("");
    if (basis === "lmp") {
      setLmpDate(value);
    } else {
      setEddInput(value);
    }
  }

  // "One" always resolves to undefined (identical to skipping the question
  // entirely, per FetusCount's own "absent == 1 == singleton" contract) and
  // clears any chosen chorionicity, since that sub-question only applies to
  // twins+. Twins/Triplets set the real value.
  function handleFetusCountSelect(value: FetusCount) {
    setError("");
    if (value === 1) {
      setFetusCount(undefined);
      setChorionicity(undefined);
      return;
    }
    setFetusCount(value);
  }

  function handleChorionicitySelect(value: Chorionicity) {
    setError("");
    setChorionicity(value);
  }

  function handleNext() {
    if (step === 1) {
      setError("");
      setStep(2);
      return;
    }

    // Step 2 -> 3: gate advance on a valid, in-range date so the user gets
    // immediate feedback before the confirm step (startPregnancy re-validates).
    if (!preview.edd) {
      const raw = basis === "lmp" ? lmpDate : eddInput;
      setError(
        raw.trim() === ""
          ? copy.wizard.validation.missingDate
          : copy.wizard.validation.invalidDate,
      );
      return;
    }
    if (preview.weeks === null) {
      setError(copy.wizard.validation.outOfRange);
      return;
    }
    setError("");
    setStep(3);
  }

  function handleBack() {
    setError("");
    setStep((current) => (current === 3 ? 2 : 1));
  }

  function handleCancel() {
    router.back();
  }

  async function handleConfirm() {
    setIsSaving(true);
    setError("");

    const result = await startPregnancy(storage, currentInput, effectiveNow);
    if (!result.ok) {
      setError(resolveStartError(result.errorCode, copy));
      setIsSaving(false);
      return;
    }

    router.replace("/(tabs)/dashboard");
  }

  return (
    <PregnancyStartFlowScreen
      basis={basis}
      chorionicity={chorionicity}
      dateValue={basis === "lmp" ? lmpDate : eddInput}
      error={error}
      fetusCount={fetusCount}
      isSaving={isSaving}
      language={language}
      locked={status === "locked"}
      onBack={handleBack}
      onBasisSelect={handleBasisSelect}
      onCancel={handleCancel}
      onChorionicitySelect={handleChorionicitySelect}
      onConfirm={handleConfirm}
      onDateChange={handleDateChange}
      onFetusCountSelect={handleFetusCountSelect}
      onNext={handleNext}
      // Info-only until the purchase flow ships: module ownership is a
      // one-time on-device unlock, never a subscription upsell, so routing to
      // plan options would point at the wrong door. The CTA appears when the
      // store-receipt purchase path lands.
      onPremiumCTAPress={undefined}
      preview={preview}
      step={step}
    />
  );
}

function resolveStartError(
  code: StartPregnancyErrorCode,
  copy: ReturnType<typeof getPregnancyCopy>,
): string {
  switch (code) {
    case "active_pregnancy_exists":
      return copy.wizard.validation.activeExists;
    case "missing_date":
      return copy.wizard.validation.missingDate;
    case "invalid_date":
      return copy.wizard.validation.invalidDate;
    case "out_of_range":
      return copy.wizard.validation.outOfRange;
    case "save_failed":
      return copy.wizard.validation.saveFailed;
  }
}
