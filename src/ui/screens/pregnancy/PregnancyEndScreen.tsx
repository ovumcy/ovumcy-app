import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { getPostpartumCopy } from "../../../i18n/postpartum-copy";
import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import { getPregnancyEndCopy } from "../../../i18n/pregnancy-end-copy";
import { getScreeningCopy } from "../../../i18n/screening-copy";
import {
  PREGNANCY_END_REASON_VALUES,
  type ModeOfDelivery,
  type PregnancyEndReason,
  type PregnancyRecord,
} from "../../../models/pregnancy";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import { appStorage } from "../../../services/app-bootstrap-service";
import { loadPregnancyModuleOwned } from "../../../services/pregnancy-entitlement-service";
import {
  deleteAllPostpartumData,
  endPostpartum,
  hasRecentEndedBirthPregnancy,
  startPostpartumFromBirth,
} from "../../../services/postpartum-mode-service";
import { deleteAllScreeningData } from "../../../services/screening-service";
import {
  buildPregnancyStartPreview,
  deleteAllPregnancyData,
  endPregnancy,
  updateEddForActivePregnancy,
  type UpdateEddErrorCode,
  type UpdateEddInput,
} from "../../../services/pregnancy-mode-service";
import { resolveBirthOptionVisible } from "../../../services/pregnancy-timeline-service";
import { formatLocalDate } from "../../../services/profile-settings-policy";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { openConfirmation } from "../../confirm/open-confirmation";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import {
  PregnancyEndFlowScreen,
  type UpdateDueDateBasis,
} from "./PregnancyEndFlowScreen";

type PregnancyEndScreenProps = {
  // Coarse intent from the route (?reason=birth). No health data rides the
  // param, and even this is tolerated missing — everything else is re-derived
  // from storage/service.
  reasonParam?: string | undefined;
  storage?: LocalAppStorage;
  now?: Date;
  // Postpartum-mode ownership gate. Starting postpartum — both the
  // after-birth offer and the manage-screen delayed start — is a module
  // new-start, gated by the same on-device ownership check as the
  // pregnancy-mode entry card. Rendering an existing postpartum record is
  // never gated (lapse posture mirrors pregnancy). Injectable so tests can
  // drive locked/unlocked directly.
  loadPostpartumUnlocked?: () => Promise<boolean>;
};

function resolveInitialReason(
  value: string | undefined,
): PregnancyEndReason | null {
  return PREGNANCY_END_REASON_VALUES.includes(value as PregnancyEndReason)
    ? (value as PregnancyEndReason)
    : null;
}

export function PregnancyEndScreen({
  reasonParam,
  storage = appStorage,
  now,
  loadPostpartumUnlocked = loadPregnancyModuleOwned,
}: PregnancyEndScreenProps) {
  const router = useRouter();
  const { language } = useAppPreferences();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [hasActive, setHasActive] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  // Defaults visible so nothing flashes hidden before the load resolves;
  // status stays "loading" until this is settled, so the default is never
  // actually rendered to the choice screen.
  const [birthOptionVisible, setBirthOptionVisible] = useState(true);
  const [reason, setReason] = useState<PregnancyEndReason | null>(() =>
    resolveInitialReason(reasonParam),
  );
  const [modeOfDelivery, setModeOfDelivery] = useState<ModeOfDelivery | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  // Update due date (clinician re-dating, X14). The active record itself is
  // kept (not just the `hasActive` flag) so the row's step can prefill from
  // its current edd/basis; updateEddForActivePregnancy re-reads the active
  // record itself, so this copy is only ever used for prefill/display.
  const [activePregnancyRecord, setActivePregnancyRecord] =
    useState<PregnancyRecord | null>(null);
  const [updateDueDateActive, setUpdateDueDateActive] = useState(false);
  const [updateDueDateBasis, setUpdateDueDateBasis] =
    useState<UpdateDueDateBasis>("ultrasound");
  const [updateDueDateValue, setUpdateDueDateValue] = useState("");
  const [isUpdatingDueDate, setIsUpdatingDueDate] = useState(false);
  const [updateDueDateError, setUpdateDueDateError] = useState("");
  // Postpartum. `postpartumOfferActive` is the one-time after-birth offer
  // step; the manage flags drive the End / delayed-Start / Delete rows shown
  // only when no pregnancy is active.
  const [postpartumOfferActive, setPostpartumOfferActive] = useState(false);
  const [hasActivePostpartum, setHasActivePostpartum] = useState(false);
  const [hasPostpartumData, setHasPostpartumData] = useState(false);
  const [postpartumStartOfferVisible, setPostpartumStartOfferVisible] =
    useState(false);
  const [isStartingPostpartum, setIsStartingPostpartum] = useState(false);
  const [isEndingPostpartum, setIsEndingPostpartum] = useState(false);
  const [isDeletingPostpartum, setIsDeletingPostpartum] = useState(false);
  const [postpartumError, setPostpartumError] = useState("");
  const [postpartumDeleteError, setPostpartumDeleteError] = useState("");
  // Screening. A "Delete check-in data" row appears when any screening
  // response exists — its own device-auth + confirm delete, independent of the
  // postpartum delete (separate sensitive class, explicit consent per class).
  const [hasScreeningData, setHasScreeningData] = useState(false);
  const [isDeletingScreening, setIsDeletingScreening] = useState(false);
  const [screeningDeleteError, setScreeningDeleteError] = useState("");
  const copy = getPregnancyEndCopy(language);
  const pregnancyCopy = getPregnancyCopy(language);
  const postpartumCopy = getPostpartumCopy(language);
  const screeningCopy = getScreeningCopy(language);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      // One batch derives every flag; the end/delete services re-read the
      // active record themselves, so the screen never threads records into
      // them.
      const [records, activePostpartum, postpartumRecords, screeningResponses] =
        await Promise.all([
          storage.listPregnancyRecords(),
          storage.readActivePostpartum(),
          storage.listPostpartumRecords(),
          storage.listScreeningResponses(),
        ]);
      if (!isMounted) {
        return;
      }
      const active = records.find((record) => record.status === "active") ?? null;
      // No active record: the birth choice is moot (this screen shows the
      // manage/empty state instead), so default visible rather than hidden.
      const visible = active
        ? resolveBirthOptionVisible(active.edd, formatLocalDate(effectiveNow))
        : true;

      // Delayed postpartum-start offer: only when nothing is active and a
      // recent ended-birth pregnancy exists (within the delayed-start window)
      // AND premium is unlocked — starting postpartum is a premium new-start,
      // so a lapsed plan blocks the delayed start just like the after-birth
      // offer. The unlock call runs only in that narrow state.
      const today = formatLocalDate(effectiveNow);
      let startOfferVisible = false;
      if (
        !active &&
        !activePostpartum &&
        hasRecentEndedBirthPregnancy(records, today)
      ) {
        startOfferVisible = await loadPostpartumUnlocked();
        if (!isMounted) {
          return;
        }
      }

      setHasActive(active !== null);
      setHasEnded(records.some((record) => record.status === "ended"));
      setBirthOptionVisible(visible);
      setActivePregnancyRecord(active);
      setHasActivePostpartum(activePostpartum !== null);
      setHasPostpartumData(postpartumRecords.length > 0);
      setHasScreeningData(screeningResponses.length > 0);
      setPostpartumStartOfferVisible(startOfferVisible);
      // A deep link's ?reason=birth pre-selects the birth step synchronously,
      // before this load resolves. If the gate turns out closed, fall back to
      // the choice screen -- never flash the congratulations card for a
      // below-threshold GA.
      setReason((current) => (current === "birth" && !visible ? null : current));
      setStatus("ready");
    })();

    return () => {
      isMounted = false;
    };
  }, [storage, effectiveNow, loadPostpartumUnlocked]);

  const currentUpdateInput = useMemo<UpdateEddInput>(
    () => ({ eddBasis: updateDueDateBasis, edd: updateDueDateValue }),
    [updateDueDateBasis, updateDueDateValue],
  );

  // Multiples: plural congratulations/mode-of-delivery copy is decided
  // off the ACTIVE record (already loaded for the update-due-date prefill),
  // never off a route param or any per-baby detail this screen doesn't have.
  const isMultiples = (activePregnancyRecord?.fetusCount ?? 1) >= 2;

  const updateDueDatePreview = useMemo(
    () => buildPregnancyStartPreview(currentUpdateInput, effectiveNow, language),
    [currentUpdateInput, effectiveNow, language],
  );

  function handleSelectReason(next: PregnancyEndReason) {
    setError("");
    setReason(next);
  }

  function handleBack() {
    // Return to the choice screen (does not leave the route).
    setError("");
    setReason(null);
  }

  function handleCancel() {
    router.back();
  }

  async function handleConfirmEnd() {
    if (!reason) {
      return;
    }

    const dialog =
      reason === "birth"
        ? copy.birth.dialog
        : reason === "loss"
          ? copy.loss.dialog
          : copy.other.dialog;

    // Two-button destructive confirm. openConfirmation resolves false for BOTH
    // the cancel button and a dismissal (backdrop/Back/Escape), so ending only
    // happens on an explicit accept — a dismissal always keeps tracking.
    const confirmed = await openConfirmation(
      `${dialog.title}\n\n${dialog.body}`,
      dialog.confirm,
      dialog.cancel,
    );
    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError("");

    const result = await endPregnancy(
      storage,
      {
        reason,
        // modeOfDelivery is only meaningful (and only offered) for a birth; the
        // service also forces it to null for other reasons as defense in depth.
        ...(reason === "birth" && modeOfDelivery ? { modeOfDelivery } : {}),
      },
      effectiveNow,
    );
    if (!result.ok) {
      setError(copy.status.endFailed);
      setIsSaving(false);
      return;
    }

    // After a confirmed BIRTH only (never loss/other — domain rule B8), offer
    // postpartum tracking, but only when the premium capability is unlocked
    // (starting postpartum is a premium new-start). Locked, or a loss/other
    // ending, goes straight to the dashboard exactly as before. The offer step
    // is reachable ONLY from this just-confirmed-birth path — a bare deep link
    // never sets postpartumOfferActive.
    if (reason === "birth") {
      const unlocked = await loadPostpartumUnlocked();
      if (unlocked) {
        setIsSaving(false);
        setPostpartumOfferActive(true);
        return;
      }
    }

    router.replace("/(tabs)/dashboard");
  }

  async function handleStartPostpartum() {
    setPostpartumError("");
    setIsStartingPostpartum(true);

    const result = await startPostpartumFromBirth(storage, {
      now: effectiveNow,
    });
    if (!result.ok) {
      setPostpartumError(postpartumCopy.status.startFailed);
      setIsStartingPostpartum(false);
      return;
    }

    router.replace("/(tabs)/dashboard");
  }

  function handleDeclinePostpartum() {
    // "Not now": leave no postpartum record, go to the dashboard exactly as a
    // birth ending did before the offer existed.
    router.replace("/(tabs)/dashboard");
  }

  async function handleEndPostpartum() {
    // Two-button destructive confirm; a dismissal keeps tracking (openConfirmation
    // resolves false for both cancel and dismissal).
    const confirmed = await openConfirmation(
      `${postpartumCopy.manage.endDialog.title}\n\n${postpartumCopy.manage.endDialog.body}`,
      postpartumCopy.manage.endDialog.confirm,
      postpartumCopy.manage.endDialog.cancel,
    );
    if (!confirmed) {
      return;
    }

    setPostpartumError("");
    setIsEndingPostpartum(true);

    const result = await endPostpartum(
      storage,
      { reason: "manual" },
      effectiveNow,
    );
    if (!result.ok) {
      setPostpartumError(postpartumCopy.status.endFailed);
      setIsEndingPostpartum(false);
      return;
    }

    router.replace("/(tabs)/dashboard");
  }

  async function handleDeletePostpartum() {
    setPostpartumDeleteError("");

    // Destructive hard delete: device-auth gate first, then an explicit confirm
    // dialog — the same pattern as the pregnancy delete, but its own action
    // clearing only postpartum data.
    const challenge = await requestSensitiveActionChallenge(
      postpartumCopy.delete.deviceAuthPrompt,
      { allowWebBypass: true },
    );
    if (!challenge.ok) {
      if (challenge.reason === "unavailable") {
        setPostpartumDeleteError(postpartumCopy.delete.status.deviceAuthUnavailable);
      } else if (challenge.reason === "failed") {
        setPostpartumDeleteError(postpartumCopy.delete.status.deviceAuthFailed);
      }
      return;
    }

    const confirmed = await openConfirmation(
      `${postpartumCopy.delete.dialog.title}\n\n${postpartumCopy.delete.dialog.body}`,
      postpartumCopy.delete.dialog.confirm,
      postpartumCopy.delete.dialog.cancel,
    );
    if (!confirmed) {
      return;
    }

    setIsDeletingPostpartum(true);
    const result = await deleteAllPostpartumData(storage);
    if (!result.ok) {
      setPostpartumDeleteError(postpartumCopy.delete.status.failed);
      setIsDeletingPostpartum(false);
      return;
    }

    router.back();
  }

  async function handleDeleteScreening() {
    setScreeningDeleteError("");

    // Destructive hard delete of the screening data class: device-auth gate
    // first, then an explicit confirm dialog — the SAME pattern as the
    // pregnancy/postpartum deletes, but its own action removing only screening
    // data (never coupled to the postpartum delete — separate sensitive class).
    const challenge = await requestSensitiveActionChallenge(
      screeningCopy.delete.deviceAuthPrompt,
      { allowWebBypass: true },
    );
    if (!challenge.ok) {
      if (challenge.reason === "unavailable") {
        setScreeningDeleteError(
          screeningCopy.delete.status.deviceAuthUnavailable,
        );
      } else if (challenge.reason === "failed") {
        setScreeningDeleteError(screeningCopy.delete.status.deviceAuthFailed);
      }
      return;
    }

    const confirmed = await openConfirmation(
      `${screeningCopy.delete.dialog.title}\n\n${screeningCopy.delete.dialog.body}`,
      screeningCopy.delete.dialog.confirm,
      screeningCopy.delete.dialog.cancel,
    );
    if (!confirmed) {
      return;
    }

    setIsDeletingScreening(true);
    const result = await deleteAllScreeningData(storage);
    if (!result.ok) {
      setScreeningDeleteError(screeningCopy.delete.status.failed);
      setIsDeletingScreening(false);
      return;
    }

    router.back();
  }

  function handleUpdateDueDatePress() {
    setUpdateDueDateError("");
    // Prefill from the currently active record so the step edits the current
    // value rather than opening blank. "lmp" is never offered here (see
    // UpdateDueDateBasis), so a record that was originally LMP-based falls
    // back to "ultrasound" as a reasonable default starting toggle.
    setUpdateDueDateBasis(
      activePregnancyRecord && activePregnancyRecord.eddBasis !== "lmp"
        ? activePregnancyRecord.eddBasis
        : "ultrasound",
    );
    setUpdateDueDateValue(activePregnancyRecord?.edd ?? "");
    setUpdateDueDateActive(true);
  }

  function handleUpdateDueDateBasisSelect(value: UpdateDueDateBasis) {
    setUpdateDueDateError("");
    setUpdateDueDateBasis(value);
  }

  function handleUpdateDueDateChange(value: string) {
    setUpdateDueDateError("");
    setUpdateDueDateValue(value);
  }

  function handleCancelUpdateDueDate() {
    setUpdateDueDateError("");
    setUpdateDueDateActive(false);
  }

  async function handleConfirmUpdateDueDate() {
    setIsUpdatingDueDate(true);
    setUpdateDueDateError("");

    const result = await updateEddForActivePregnancy(
      storage,
      currentUpdateInput,
      effectiveNow,
    );
    if (!result.ok) {
      setUpdateDueDateError(resolveUpdateEddError(result.errorCode, pregnancyCopy));
      setIsUpdatingDueDate(false);
      return;
    }

    // Success-free (no celebratory copy) -- the dashboard simply renders the
    // updated W+D, same direct navigation as startPregnancy/endPregnancy.
    router.replace("/(tabs)/dashboard");
  }

  async function handleDelete() {
    setDeleteError("");

    // Destructive hard delete: device-auth gate first, then an explicit confirm
    // dialog — mirroring the settings/account danger-zone flows.
    const challenge = await requestSensitiveActionChallenge(
      copy.delete.deviceAuthPrompt,
      { allowWebBypass: true },
    );
    if (!challenge.ok) {
      if (challenge.reason === "unavailable") {
        setDeleteError(copy.delete.status.deviceAuthUnavailable);
      } else if (challenge.reason === "failed") {
        setDeleteError(copy.delete.status.deviceAuthFailed);
      }
      return;
    }

    const confirmed = await openConfirmation(
      `${copy.delete.dialog.title}\n\n${copy.delete.dialog.body}`,
      copy.delete.dialog.confirm,
      copy.delete.dialog.cancel,
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    const result = await deleteAllPregnancyData(storage);
    if (!result.ok) {
      setDeleteError(copy.delete.status.failed);
      setIsDeleting(false);
      return;
    }

    router.back();
  }

  return (
    <PregnancyEndFlowScreen
      birthOptionVisible={birthOptionVisible}
      deleteError={deleteError}
      error={error}
      hasActivePregnancy={hasActive}
      hasEndedRecords={hasEnded}
      isDeleting={isDeleting}
      isMultiples={isMultiples}
      isSaving={isSaving}
      isUpdatingDueDate={isUpdatingDueDate}
      language={language}
      modeOfDelivery={modeOfDelivery}
      onBack={handleBack}
      onCancel={handleCancel}
      onCancelUpdateDueDate={handleCancelUpdateDueDate}
      onConfirmEnd={handleConfirmEnd}
      onConfirmUpdateDueDate={handleConfirmUpdateDueDate}
      onDeletePress={handleDelete}
      onSelectModeOfDelivery={setModeOfDelivery}
      onSelectReason={handleSelectReason}
      onUpdateDueDateBasisSelect={handleUpdateDueDateBasisSelect}
      onUpdateDueDateChange={handleUpdateDueDateChange}
      onUpdateDueDatePress={handleUpdateDueDatePress}
      reason={reason}
      status={status}
      updateDueDateActive={updateDueDateActive}
      updateDueDateBasis={updateDueDateBasis}
      updateDueDateError={updateDueDateError}
      updateDueDatePreview={updateDueDatePreview}
      updateDueDateValue={updateDueDateValue}
      postpartumOfferActive={postpartumOfferActive}
      hasActivePostpartum={hasActivePostpartum}
      hasPostpartumData={hasPostpartumData}
      postpartumStartOfferVisible={postpartumStartOfferVisible}
      isStartingPostpartum={isStartingPostpartum}
      isEndingPostpartum={isEndingPostpartum}
      isDeletingPostpartum={isDeletingPostpartum}
      postpartumError={postpartumError}
      postpartumDeleteError={postpartumDeleteError}
      onStartPostpartum={handleStartPostpartum}
      onDeclinePostpartum={handleDeclinePostpartum}
      onEndPostpartum={handleEndPostpartum}
      onDeletePostpartum={handleDeletePostpartum}
      hasScreeningData={hasScreeningData}
      isDeletingScreening={isDeletingScreening}
      screeningDeleteError={screeningDeleteError}
      onDeleteScreening={handleDeleteScreening}
    />
  );
}

function resolveUpdateEddError(
  code: UpdateEddErrorCode,
  pregnancyCopy: ReturnType<typeof getPregnancyCopy>,
): string {
  switch (code) {
    case "no_active_pregnancy":
      return pregnancyCopy.wizard.validation.saveFailed;
    case "missing_date":
      return pregnancyCopy.wizard.validation.missingDate;
    case "invalid_date":
      return pregnancyCopy.wizard.validation.invalidDate;
    case "out_of_range":
      return pregnancyCopy.wizard.validation.outOfRange;
    case "save_failed":
      return pregnancyCopy.wizard.validation.saveFailed;
  }
}
