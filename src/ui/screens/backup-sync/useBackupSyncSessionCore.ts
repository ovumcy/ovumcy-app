import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useNavigation } from "expo-router/react-navigation";

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
  listManagedPartnerGrantsNeedingReshare,
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
import { takeUnrevealedManagedRecoveryPhrase } from "../../../sync/managed-recovery-rotation-service";
import {
  buildSettingsViewData,
  type LoadedSettingsState,
} from "../../../services/settings-view-service";
import {
  attachManagedPartnerInviteSecret,
  managedPartnerInviteTokenRemainingMs,
  readManagedPartnerInviteToken,
  stashManagedPartnerInviteToken,
  takeManagedPartnerInviteReplacedNotice,
} from "../../../security/managed-partner-invite-token-buffer";
import {
  parsePartnerInviteLink,
  parsePartnerInviteSecretFromFragment,
} from "../../../security/partner-invite-link";
import type { SyncSecretStore } from "../../../security/sync-secret-store";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import type { PartnerShareSecretStore } from "../../../security/partner-share-secret-store";
import type { WipeScopeSecretStores } from "../../../security/wipe-scope-secrets";
import { partnerShareSecretStore as defaultPartnerShareSecretStore } from "../../../sync/app-partner-share-service";
import { syncSecretStore as defaultSyncSecretStore } from "../../../sync/app-sync-service";
import {
  certPinStore as defaultCertPinStore,
  entitlementTokenStore as defaultEntitlementTokenStore,
} from "../../../sync/app-wipe-scope-secret-stores";
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
function resolveSingleRouteParam(
  rawInviteToken: string | string[] | undefined,
): string {
  const value = Array.isArray(rawInviteToken)
    ? rawInviteToken[0] ?? ""
    : rawInviteToken ?? "";
  return String(value).trim();
}

export type BackupSyncSessionCoreOptions = {
  certPinStore?: WipeScopeSecretStores["certPinStore"] | undefined;
  entitlementTokenStore?: WipeScopeSecretStores["entitlementTokenStore"] | undefined;
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
  certPinStore = defaultCertPinStore,
  entitlementTokenStore = defaultEntitlementTokenStore,
  exportDeliveryClient = createPlatformExportDeliveryClient(),
  now,
  partnerShareSecretStore = defaultPartnerShareSecretStore,
  storage = appStorage,
  syncSecretStore = defaultSyncSecretStore,
}: BackupSyncSessionCoreOptions) {
  const { colors, language, syncProfilePreferences } = useAppPreferences();
  const navigation = useNavigation();
  const router = useRouter();
  const searchParams = useLocalSearchParams<{
    invite_token?: string | string[];
    "#"?: string | string[];
  }>();
  const [effectiveNow] = useState(() => now ?? new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<LoadedSettingsState | null>(null);
  const [errorState, setErrorState] = useState<{
    code: string;
    scope: BackupSyncErrorScope;
    retryAfterSeconds?: number | undefined;
  } | null>(null);
  const [accountStatusMessage, setAccountStatusMessage] = useState("");
  const [generatedRecoveryPhrase, setGeneratedRecoveryPhrase] = useState("");
  const [generatedRecoveryCode, setGeneratedRecoveryCode] = useState("");
  const [recoveryPhraseInputValue, setRecoveryPhraseInputValue] = useState("");
  const [partnerOverview, setPartnerOverview] =
    useState<ManagedCloudPartnerAccessOverview | null>(null);
  const [partnerReshareRequiredGrantIDs, setPartnerReshareRequiredGrantIDs] = useState<
    string[]
  >([]);
  const [partnerStatusMessage, setPartnerStatusMessage] = useState("");
  const [partnerErrorMessage, setPartnerErrorMessage] = useState("");
  const [pendingPartnerInviteToken, setPendingPartnerInviteToken] = useState(() =>
    readManagedPartnerInviteToken(),
  );
  // The web pre-render scrub can already have replaced a pending invite
  // before this screen mounts.
  const [isPartnerInviteReplaced, setIsPartnerInviteReplaced] = useState(() =>
    takeManagedPartnerInviteReplacedNotice(),
  );
  const [showPartnerOwnerControls, setShowPartnerOwnerControls] = useState(false);
  const [isSavingSyncDraft, setIsSavingSyncDraft] = useState(false);
  const [dismissedOfferIDs, setDismissedOfferIDs] = useState<string[]>([]);
  const shellCopy = getShellCopy(language);
  const partnerCopy = getPartnerCopy(language);
  const viewData = buildSettingsViewData(effectiveNow, language);
  const isSyncDirty = buildBackupSyncDirtyState(state);

  function captureInboundInvite(inviteToken: string, inviteSecretHex: string) {
    stashManagedPartnerInviteToken(inviteToken, inviteSecretHex);
    if (takeManagedPartnerInviteReplacedNotice()) {
      setIsPartnerInviteReplaced(true);
    }
    setPendingPartnerInviteToken(inviteToken);
  }

  const routeInviteToken = searchParams.invite_token;
  const routeFragment = searchParams["#"];
  useEffect(() => {
    const trimmedInviteToken = resolveSingleRouteParam(routeInviteToken);
    if (trimmedInviteToken.length === 0) {
      return;
    }

    captureInboundInvite(
      trimmedInviteToken,
      parsePartnerInviteSecretFromFragment(resolveSingleRouteParam(routeFragment)),
    );
    router.replace("/backup-sync");
  }, [router, routeInviteToken, routeFragment]);

  // The raw link and the route params can update in either order. The link
  // that launched the app is read once per buffered token and its secret
  // attaches only to the invite already buffered under that token, so it can
  // never resurrect a redeemed invite. A link arriving while the app runs is
  // a fresh capture of its own. Neither is kept in hook state: expo-router
  // drops the fragment of custom-scheme links, so the secret is read from the
  // raw link here and the link is dropped after parsing.
  useEffect(() => {
    let isActive = true;
    void Linking.getInitialURL()
      .then((initialURL) => {
        if (!isActive) {
          return;
        }
        const { inviteToken, inviteSecretHex } = parsePartnerInviteLink(initialURL);
        attachManagedPartnerInviteSecret(inviteToken, inviteSecretHex);
      })
      .catch(() => {});
    return () => {
      isActive = false;
    };
  }, [pendingPartnerInviteToken]);

  useEffect(() => {
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const { inviteToken, inviteSecretHex } = parsePartnerInviteLink(url);
      if (inviteToken.length > 0) {
        captureInboundInvite(inviteToken, inviteSecretHex);
      }
    });
    return () => {
      subscription.remove();
    };
    // captureInboundInvite only calls stable state setters.
  }, []);

  // The notice describes the pending invite, so it ends with it.
  useEffect(() => {
    if (pendingPartnerInviteToken.length === 0) {
      setIsPartnerInviteReplaced(false);
    }
  }, [pendingPartnerInviteToken]);

  // The state copy expires with the buffer, so a screen left open cannot
  // redeem a token past its TTL.
  useEffect(() => {
    if (pendingPartnerInviteToken.length === 0) {
      return;
    }
    const timer = setTimeout(() => {
      setPendingPartnerInviteToken(readManagedPartnerInviteToken());
    }, managedPartnerInviteTokenRemainingMs());
    return () => clearTimeout(timer);
  }, [pendingPartnerInviteToken]);

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
          reshareRequiredGrantIDs: [] as string[],
          showOwnerControls: false,
        };
      }

      const premiumFeatures = await loadManagedPremiumFeatures(
        storage,
        syncSecretStore,
        loadedState.syncPreferences.mode,
        undefined,
        undefined,
        { liveOnly: true },
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
          reshareRequiredGrantIDs: [] as string[],
          showOwnerControls: premiumFeatures.partnerAccess,
        };
      }

      const partnerShareSecrets = await reconcileManagedPartnerShareKeys(
        partnerShareSecretStore,
        partnerResult.value,
        effectiveNow,
      );
      // The push re-lists grants and may meet a re-share this listing missed.
      let pushedReshareGrantIDs: string[] = [];
      if (partnerResult.value.owned.grants.length > 0) {
        const pushResult = await syncManagedPartnerSharedProjections(
          storage,
          syncSecretStore,
          partnerShareSecretStore,
          effectiveNow,
        );
        pushedReshareGrantIDs = pushResult.reshareRequiredGrantIDs;
      }

      return {
        errorMessage: "",
        overview: partnerResult.value,
        reshareRequiredGrantIDs: [
          ...new Set([
            ...listManagedPartnerGrantsNeedingReshare(partnerResult.value, partnerShareSecrets),
            ...pushedReshareGrantIDs,
          ]),
        ],
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
            resolveSingleRouteParam(searchParams.invite_token).length > 0;

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
        // A managed rotation confirmed while this screen was away is shown
        // now: the server already retired the old phrase.
        setGeneratedRecoveryPhrase(takeUnrevealedManagedRecoveryPhrase() ?? "");
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
        setPartnerReshareRequiredGrantIDs(partnerState.reshareRequiredGrantIDs);
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
    setPartnerReshareRequiredGrantIDs(partnerState.reshareRequiredGrantIDs);
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
    certPinStore,
    entitlementTokenStore,
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
    isPartnerInviteReplaced,
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
    partnerReshareRequiredGrantIDs,
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
