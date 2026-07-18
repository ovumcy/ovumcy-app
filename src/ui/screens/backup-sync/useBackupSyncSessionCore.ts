import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";

import { getShellCopy } from "../../../i18n/shell-copy";
import { getPartnerCopy } from "../../../i18n/partner-copy";
import { appStorage, readHasCompletedOnboarding } from "../../../services/app-bootstrap-service";
import {
  buildBackupSyncDirtyState,
  revertBackupSyncDraftState,
  type BackupSyncErrorScope,
} from "../../../services/backup-sync-view-service";
import { loadManagedPartnerAccess } from "../../../services/managed-partner-access-service";
import {
  reconcileManagedPartnerShareKeys,
} from "../../../services/managed-partner-share-service";
import { syncManagedPartnerSharedProjections } from "../../../services/managed-partner-share-sync-service";
import { loadManagedPremiumFeatures } from "../../../services/managed-premium-features-service";
import { readDismissedBillingOfferIDs } from "../../../services/offers-service";
import {
  saveBackupSyncDraft,
} from "../../../services/backup-sync-screen-service";
import {
  createPlatformExportDeliveryClient,
  type ExportDeliveryClient,
} from "../../../services/export-delivery";
import { loadSettingsScreenState } from "../../../services/settings-state-service";
import {
  buildSettingsViewData,
  type LoadedSettingsState,
} from "../../../services/settings-view-service";
import {
  readManagedPartnerInviteToken,
  stashManagedPartnerInviteToken,
} from "../../../security/managed-partner-invite-token-buffer";
import type { SyncSecretStore } from "../../../security/sync-secret-store";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import type { PartnerShareSecretStore } from "../../../security/partner-share-secret-store";
import { partnerShareSecretStore as defaultPartnerShareSecretStore } from "../../../sync/app-partner-share-service";
import { syncSecretStore as defaultSyncSecretStore } from "../../../sync/app-sync-service";
import { loadSyncSetupState } from "../../../sync/sync-setup-service";
import { useAppPreferences } from "../../providers/AppPreferencesProvider";
import type {
  ManagedCloudPartnerAccessOverview,
} from "../../../sync/managed-cloud-api-client";
import { resolvePartnerErrorMessage } from "./backup-sync-partner-errors";

// A route param that expo-router may hand back as a single string or (if the
// query key ever repeats) as an array — both the token-capture effect below
// and the onboarding-bypass check in the focus-load effect need the same
// single trimmed value.
function resolveRouteInviteToken(
  rawInviteToken: string | string[] | undefined,
): string {
  const value = Array.isArray(rawInviteToken)
    ? rawInviteToken[0] ?? ""
    : rawInviteToken ?? "";
  return String(value).trim();
}

export type BackupSyncSessionCoreOptions = {
  exportDeliveryClient?: ExportDeliveryClient | undefined;
  now?: Date | undefined;
  partnerShareSecretStore?: PartnerShareSecretStore | undefined;
  storage?: LocalAppStorage | undefined;
  syncSecretStore?: SyncSecretStore | undefined;
};

/**
 * Shared state and orchestration primitives that the backup-sync concern hooks
 * (recovery materials, account connection, sync actions, managed plan, partner
 * access, account deletion) all depend on. Everything here is genuinely
 * cross-concern: the single loaded settings `state`, the on-focus load effect
 * that resets recovery/partner/offer state atomically, the draft-save that also
 * clears the revealed recovery phrase, the partner-access reload called from
 * almost every mutation, and the pending partner-invite buffer. Splitting these
 * into per-concern islands would reorder effects and duplicate resets, so they
 * stay in one core hook the concern hooks receive by reference.
 */
export type BackupSyncSessionCore = ReturnType<typeof useBackupSyncSessionCore>;

export function useBackupSyncSessionCore({
  exportDeliveryClient = createPlatformExportDeliveryClient(),
  now,
  partnerShareSecretStore = defaultPartnerShareSecretStore,
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
}: BackupSyncSessionCoreOptions) {
  const { colors, language, syncProfilePreferences } = useAppPreferences();
  const navigation = useNavigation();
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ invite_token?: string | string[] }>();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<LoadedSettingsState | null>(null);
  const [errorState, setErrorState] = useState<{
    code: string;
    scope: BackupSyncErrorScope;
  } | null>(null);
  const [accountStatusMessage, setAccountStatusMessage] = useState("");
  const [generatedRecoveryPhrase, setGeneratedRecoveryPhrase] = useState("");
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState("");
  const [recoveryPhraseInputValue, setRecoveryPhraseInputValue] = useState("");
  const [partnerOverview, setPartnerOverview] =
    useState<ManagedCloudPartnerAccessOverview | null>(null);
  const [partnerStatusMessage, setPartnerStatusMessage] = useState("");
  const [partnerErrorMessage, setPartnerErrorMessage] = useState("");
  const [pendingPartnerInviteToken, setPendingPartnerInviteToken] = useState(() =>
    readManagedPartnerInviteToken(),
  );
  const [showPartnerOwnerControls, setShowPartnerOwnerControls] = useState(false);
  const [isSavingSyncDraft, setIsSavingSyncDraft] = useState(false);
  const [dismissedOfferIDs, setDismissedOfferIDs] = useState<string[]>([]);
  const shellCopy = getShellCopy(language);
  const partnerCopy = getPartnerCopy(language);
  const viewData = buildSettingsViewData(effectiveNow, language);
  const isSyncDirty = buildBackupSyncDirtyState(state);

  useEffect(() => {
    const trimmedInviteToken = resolveRouteInviteToken(searchParams.invite_token);
    if (trimmedInviteToken.length === 0) {
      return;
    }

    stashManagedPartnerInviteToken(trimmedInviteToken);
    setPendingPartnerInviteToken(trimmedInviteToken);
    router.replace("/backup-sync");
  }, [router, searchParams.invite_token]);

  const resetPartnerFeedback = useCallback(() => {
    setPartnerErrorMessage("");
    setPartnerStatusMessage("");
  }, []);

  const loadPartnerState = useCallback(
    async (loadedState: LoadedSettingsState) => {
      if (
        loadedState.syncPreferences.mode !== "managed" ||
        !loadedState.hasSyncSession
      ) {
        return {
          errorMessage: "",
          overview: null as ManagedCloudPartnerAccessOverview | null,
          showOwnerControls: false,
        };
      }

      const premiumFeatures = await loadManagedPremiumFeatures(
        storage,
        syncSecretStore,
        loadedState.syncPreferences.mode,
      );

      const partnerResult = await loadManagedPartnerAccess(
        syncSecretStore,
        loadedState.syncPreferences.mode,
      );
      if (!partnerResult.ok) {
        return {
          errorMessage: resolvePartnerErrorMessage(
            partnerResult.errorCode,
            partnerCopy,
          ),
          overview: null as ManagedCloudPartnerAccessOverview | null,
          showOwnerControls: premiumFeatures.partnerAccess,
        };
      }

      await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        partnerResult.value,
        effectiveNow,
      );
      if (partnerResult.value.owned.grants.length > 0) {
        await syncManagedPartnerSharedProjections(
          storage,
          syncSecretStore,
          partnerShareSecretStore,
          effectiveNow,
        );
      }

      return {
        errorMessage: "",
        overview: partnerResult.value,
        showOwnerControls: premiumFeatures.partnerAccess,
      };
    },
    [effectiveNow, partnerCopy, partnerShareSecretStore, storage, syncSecretStore],
  );

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function load() {
        const hasCompletedOnboarding = await readHasCompletedOnboarding(storage);
        if (!isMounted) {
          return;
        }

        if (!hasCompletedOnboarding) {
          // A guest partner (issue #118) never runs the owner's cycle-tracking
          // wizard — `hasCompletedOnboarding` stays false for them by design
          // (docs/sync-trust-model.md, "Guest Partner Access"). Two arrivals
          // must both reach the accept/shared UI instead of the wizard:
          // - carrying a token to redeem right now (buffered on web via the
          //   pre-render URL scrub, or still in the route param on native
          //   before the sibling effect above has stashed it — check both,
          //   the buffer alone would race the capture effect on native);
          // - refocusing this screen after already redeeming one earlier in
          //   the same visit (e.g. back from the read-only shared view, or a
          //   web reload while sitting on that view) — by then the
          //   single-use token is spent and cleared, so the only signal left
          //   is the live guest session `persistGuestPartnerSession` created.
          const hasPendingInviteToken =
            readManagedPartnerInviteToken().length > 0 ||
            resolveRouteInviteToken(searchParams.invite_token).length > 0;

          let hasExistingSyncSession = false;
          if (!hasPendingInviteToken) {
            const syncSetupState = await loadSyncSetupState(storage, syncSecretStore);
            if (!isMounted) {
              return;
            }
            hasExistingSyncSession = syncSetupState.hasAuthSession;
          }

          if (!hasPendingInviteToken && !hasExistingSyncSession) {
            router.replace("/onboarding");
            return;
          }
        }

        const loadedState = await loadSettingsScreenState(
          storage,
          syncSecretStore,
          effectiveNow,
        );
        if (!isMounted) {
          return;
        }

        setState(loadedState);
        setGeneratedRecoveryPhrase("");
        setGeneratedRecoveryCode("");
        setRecoveryPhraseInputValue("");
        resetPartnerFeedback();
        const [partnerState, dismissedIDs] = await Promise.all([
          loadPartnerState(loadedState),
          readDismissedBillingOfferIDs(storage),
        ]);
        if (!isMounted) {
          return;
        }
        setShowPartnerOwnerControls(partnerState.showOwnerControls);
        setPartnerOverview(partnerState.overview);
        setPartnerErrorMessage(partnerState.errorMessage);
        setDismissedOfferIDs(dismissedIDs);
        setIsLoading(false);
      }

      setIsLoading(true);
      void load();

      return () => {
        isMounted = false;
      };
      // searchParams.invite_token is intentionally left out below: the
      // sibling capture effect above strips it from the URL via
      // router.replace("/backup-sync") moments after mount, and reacting to
      // that change would re-run this entire load a second time for that
      // alone. The onboarding-bypass check inside load() also falls back to
      // the still-buffered token and, once it is redeemed, the live sync
      // session — so the decision stays correct without depending on this
      // array.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      effectiveNow,
      loadPartnerState,
      resetPartnerFeedback,
      router,
      storage,
      syncSecretStore,
    ]),
  );

  const resetFeedbackMessages = useCallback(() => {
    setErrorState(null);
    setAccountStatusMessage("");
  }, []);

  const revertUnsavedSync = useCallback(() => {
    resetFeedbackMessages();
    setState((current) =>
      current ? revertBackupSyncDraftState(current) : current,
    );
  }, [resetFeedbackMessages]);

  async function reloadPartnerAccess(nextState: LoadedSettingsState) {
    const partnerState = await loadPartnerState(nextState);
    setShowPartnerOwnerControls(partnerState.showOwnerControls);
    setPartnerOverview(partnerState.overview);
    setPartnerErrorMessage(partnerState.errorMessage);
  }

  async function saveSyncDraftIfNeeded(scope: BackupSyncErrorScope) {
    if (!state) {
      return null;
    }
    if (!buildBackupSyncDirtyState(state)) {
      return state;
    }

    setIsSavingSyncDraft(true);
    const syncResult = await saveBackupSyncDraft(storage, syncSecretStore, state);
    setIsSavingSyncDraft(false);
    if (!syncResult.ok) {
      setErrorState({
        code: syncResult.errorCode,
        scope,
      });
      return null;
    }

    if (!syncResult.state.hasStoredSyncSecrets) {
      setGeneratedRecoveryPhrase("");
      setGeneratedRecoveryCode("");
    }
    setState(syncResult.state);
    return syncResult.state;
  }

  return {
    // Resolved dependencies
    exportDeliveryClient,
    partnerShareSecretStore,
    storage,
    syncSecretStore,
    // Preferences + copy + derived view data
    colors,
    language,
    syncProfilePreferences,
    shellCopy,
    partnerCopy,
    viewData,
    // Navigation
    navigation,
    router,
    // Root state
    effectiveNow,
    isLoading,
    state,
    setState,
    isSyncDirty,
    // Feedback
    errorState,
    setErrorState,
    accountStatusMessage,
    setAccountStatusMessage,
    resetFeedbackMessages,
    revertUnsavedSync,
    // Recovery-phrase state (shared: focus-load reset + draft-save clear + recovery hook)
    generatedRecoveryPhrase,
    setGeneratedRecoveryPhrase,
    generatedRecoveryCode,
    setGeneratedRecoveryCode,
    recoveryPhraseInputValue,
    setRecoveryPhraseInputValue,
    // Partner buffer + partner-access snapshot
    pendingPartnerInviteToken,
    setPendingPartnerInviteToken,
    partnerOverview,
    setPartnerOverview,
    partnerStatusMessage,
    setPartnerStatusMessage,
    partnerErrorMessage,
    setPartnerErrorMessage,
    showPartnerOwnerControls,
    setShowPartnerOwnerControls,
    resetPartnerFeedback,
    loadPartnerState,
    reloadPartnerAccess,
    // Offers
    dismissedOfferIDs,
    setDismissedOfferIDs,
    // Sync-draft
    isSavingSyncDraft,
    saveSyncDraftIfNeeded,
  };
}
