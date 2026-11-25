import { useEffect } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import * as appBootstrapService from "../../../services/app-bootstrap-service";
import * as backupSyncScreenService from "../../../services/backup-sync-screen-service";
import * as offersService from "../../../services/offers-service";
import * as settingsStateService from "../../../services/settings-state-service";
import * as accountChangeRecoveryPhrase from "../../../sync/account-change-recovery-phrase";
import * as managedRecoveryRotationService from "../../../sync/managed-recovery-rotation-service";
import * as syncSetupService from "../../../sync/sync-setup-service";
import {
  MANAGED_PARTNER_INVITE_TOKEN_TTL_MS,
  clearManagedPartnerInviteToken,
  readManagedPartnerInviteSecret,
  readManagedPartnerInviteToken,
  stashManagedPartnerInviteToken,
} from "../../../security/managed-partner-invite-token-buffer";
import { createLoadedSettingsStateFixture } from "../../../test/create-backup-sync-session-core-mock";
import { createSettingsStorageMock } from "../../../test/create-settings-storage-mock";
import { createSyncSecretStoreMock } from "../../../test/create-sync-secret-store-mock";
import type { LocalAppStorage } from "../../../storage/local/storage-contract";
import { useBackupSyncSessionCore } from "./useBackupSyncSessionCore";

// "mock"-prefixed names are required here: babel-plugin-jest-hoist only
// allows references inside a jest.mock(...) factory when the identifier
// starts with "mock" (the factory is hoisted above these declarations).
const mockUseEffect = useEffect;
const mockReplace = jest.fn();
const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: mockReplace,
};
let mockSearchParams: { invite_token?: string | string[]; "#"?: string } = {};
let mockLinkingURL: string | null = null;
const mockNavigationDispatch = jest.fn();

const mockLinkingListeners = new Set<(event: { url: string }) => void>();

jest.mock("expo-linking", () => {
  return {
    getInitialURL: () => Promise.resolve(mockLinkingURL),
    addEventListener: (_type: string, listener: (event: { url: string }) => void) => {
      mockLinkingListeners.add(listener);
      return { remove: () => mockLinkingListeners.delete(listener) };
    },
  };
});

function emitLinkingURL(url: string) {
  for (const listener of [...mockLinkingListeners]) {
    listener({ url });
  }
}

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
    useLocalSearchParams: () => mockSearchParams,
    useRouter: () => mockRouter,
  };
});

jest.mock("expo-router/react-navigation", () => {
  return {
    useNavigation: () => ({ dispatch: mockNavigationDispatch }),
  };
});

const FIXED_NOW = new Date("2026-03-20T08:00:00.000Z");

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useBackupSyncSessionCore", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    clearManagedPartnerInviteToken();
    mockReplace.mockReset();
    mockNavigationDispatch.mockReset();
    mockSearchParams = {};
    mockLinkingURL = null;
    mockLinkingListeners.clear();
  });

  afterEach(async () => {
    // Belt-and-suspenders: several tests below deliberately leave a
    // focus-load in-flight (or intentionally unresolved) to exercise the
    // isMounted guard. RNTL's auto-cleanup unmounts any still-mounted hook
    // after each test, but drain one more microtask turn so a promise that
    // settles right at teardown can't spill an unwrapped act() update into
    // the next test.
    await act(async () => {
      await Promise.resolve();
    });
  });

  // ---------------------------------------------------------------------
  // resolveRouteInviteToken: the route param may come back as an array if
  // the invite_token query key ever repeats (expo-router behavior). Both
  // sides of that array-handling branch are otherwise never exercised --
  // every screen-level test only ever supplies a plain string or omits it.
  // ---------------------------------------------------------------------
  describe("route invite_token captured as an array", () => {
    it("captures only the first element and ignores the rest", async () => {
      mockSearchParams = {
        invite_token: ["array-token-first", "array-token-second"],
      };
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();

      const { unmount } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );

      await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith("/backup-sync"),
      );
      expect(readManagedPartnerInviteToken()).toBe("array-token-first");

      // Let the (fast, hasCompletedOnboarding: true default) focus-load
      // settle before tearing down, so no dangling promise from this test's
      // storage mock resolves during a later test.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      await unmount();
    });

    it("treats an empty array as no token at all (nullish fallback)", async () => {
      mockSearchParams = { invite_token: [] };
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();

      const { unmount } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockReplace).not.toHaveBeenCalledWith("/backup-sync");
      expect(readManagedPartnerInviteToken()).toBe("");
      await unmount();
    });
  });

  describe("invite secret capture", () => {
    const TOKEN = "invite-token-1-fixture-padding";
    const SECRET = "11".repeat(32);

    async function renderAndSettle() {
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();
      const rendered = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      return rendered;
    }

    it("buffers the secret expo-router exposes from an https link fragment", async () => {
      mockSearchParams = { invite_token: TOKEN, "#": `k=${SECRET}` };

      const { unmount } = await renderAndSettle();

      expect(readManagedPartnerInviteToken()).toBe(TOKEN);
      expect(readManagedPartnerInviteSecret()).toBe(SECRET);
      expect(mockReplace).toHaveBeenCalledWith("/backup-sync");
      await unmount();
    });

    it("reads the secret from the raw link when the route drops a custom-scheme fragment", async () => {
      mockSearchParams = { invite_token: TOKEN };
      mockLinkingURL = `ovumcy://backup-sync?invite_token=${TOKEN}#k=${SECRET}`;

      const { unmount } = await renderAndSettle();

      expect(readManagedPartnerInviteSecret()).toBe(SECRET);
      await unmount();
    });

    it("attaches the secret when the raw link arrives after the route capture", async () => {
      mockSearchParams = { invite_token: TOKEN };

      const { unmount } = await renderAndSettle();
      expect(readManagedPartnerInviteSecret()).toBe("");

      await act(async () => {
        emitLinkingURL(`ovumcy://backup-sync?invite_token=${TOKEN}#k=${SECRET}`);
      });

      expect(readManagedPartnerInviteSecret()).toBe(SECRET);
      await unmount();
    });

    it("captures a link that arrives while the app runs before any route param does", async () => {
      const { result, unmount } = await renderAndSettle();

      await act(async () => {
        emitLinkingURL(`ovumcy://backup-sync?invite_token=${TOKEN}#k=${SECRET}`);
      });

      expect(readManagedPartnerInviteToken()).toBe(TOKEN);
      expect(readManagedPartnerInviteSecret()).toBe(SECRET);
      expect(result.current.pendingPartnerInviteToken).toBe(TOKEN);
      await unmount();
    });

    it("ignores an inbound link that carries no invite", async () => {
      const { result, unmount } = await renderAndSettle();

      await act(async () => {
        emitLinkingURL("ovumcy://settings");
      });

      expect(readManagedPartnerInviteToken()).toBe("");
      expect(result.current.pendingPartnerInviteToken).toBe("");
      await unmount();
    });

    it("does not retain the raw link or its secret in the returned hook state", async () => {
      mockSearchParams = { invite_token: TOKEN };
      mockLinkingURL = `ovumcy://backup-sync?invite_token=${TOKEN}#k=${SECRET}`;
      const { result, unmount } = await renderAndSettle();
      await act(async () => {
        emitLinkingURL(`ovumcy://backup-sync?invite_token=${TOKEN}#k=${SECRET}`);
      });

      expect(JSON.stringify(result.current, (_key, value) =>
        typeof value === "function" ? undefined : value,
      )).not.toContain(SECRET);
      await unmount();
    });

    it("does not revive a redeemed invite from the link that launched the app", async () => {
      mockLinkingURL = `ovumcy://backup-sync?invite_token=${TOKEN}#k=${SECRET}`;
      const { unmount } = await renderAndSettle();

      expect(readManagedPartnerInviteToken()).toBe("");
      expect(readManagedPartnerInviteSecret()).toBe("");
      await unmount();
    });

    it("flags a newer inbound link that replaces a pending invite, and clears the flag with the invite", async () => {
      stashManagedPartnerInviteToken(TOKEN, SECRET);
      const { result, unmount } = await renderAndSettle();
      expect(result.current.isPartnerInviteReplaced).toBe(false);

      await act(async () => {
        emitLinkingURL(
          `ovumcy://backup-sync?invite_token=newer-token-fixture-padding-01#k=${SECRET}`,
        );
      });
      expect(result.current.isPartnerInviteReplaced).toBe(true);
      expect(readManagedPartnerInviteToken()).toBe("newer-token-fixture-padding-01");

      await act(async () => {
        result.current.setPendingPartnerInviteToken("");
      });
      expect(result.current.isPartnerInviteReplaced).toBe(false);
      await unmount();
    });

    it("flags a replacement the web pre-render scrub made before the screen mounted", async () => {
      stashManagedPartnerInviteToken(TOKEN, SECRET);
      stashManagedPartnerInviteToken("newer-token-fixture-padding-01", SECRET);

      const { result, unmount } = await renderAndSettle();

      expect(result.current.isPartnerInviteReplaced).toBe(true);
      await unmount();
    });

    it("never pairs a raw link's secret with a different buffered invite", async () => {
      mockSearchParams = { invite_token: TOKEN };
      mockLinkingURL = `ovumcy://backup-sync?invite_token=other-token-fixture-padding#k=${SECRET}`;

      const { unmount } = await renderAndSettle();

      expect(readManagedPartnerInviteToken()).toBe(TOKEN);
      expect(readManagedPartnerInviteSecret()).toBe("");
      await unmount();
    });
  });

  describe("pending invite token TTL", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("drops the screen's copy of the token when the buffer TTL runs out", async () => {
      jest.useFakeTimers();
      stashManagedPartnerInviteToken("buffered-token");
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();

      const { result, unmount } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );
      expect(result.current.pendingPartnerInviteToken).toBe("buffered-token");

      await act(async () => {
        jest.advanceTimersByTime(MANAGED_PARTNER_INVITE_TOKEN_TTL_MS - 1);
      });
      expect(result.current.pendingPartnerInviteToken).toBe("buffered-token");

      await act(async () => {
        jest.advanceTimersByTime(1);
      });
      expect(result.current.pendingPartnerInviteToken).toBe("");
      expect(readManagedPartnerInviteToken()).toBe("");
      await unmount();
    });
  });

  // ---------------------------------------------------------------------
  // Constructor defaults. storage/syncSecretStore are deliberately NOT
  // exercised here in their default (appStorage / real sync secret store)
  // form -- see the report for why that branch is a documented residual
  // rather than forced.
  // ---------------------------------------------------------------------
  describe("option defaults", () => {
    it("falls back to the current wall-clock time when now is omitted", async () => {
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();
      const before = Date.now();

      const { result, unmount } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore }),
      );

      const after = Date.now();
      expect(result.current.effectiveNow).toBeInstanceOf(Date);
      expect(result.current.effectiveNow.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.current.effectiveNow.getTime()).toBeLessThanOrEqual(after);

      // Both defaults are read synchronously off the initializer -- no need
      // for the background focus-load to settle before tearing down.
      await unmount();
      await act(async () => {
        await Promise.resolve();
      });
    });

    it("constructs the platform export-delivery client when none is supplied", async () => {
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();

      const { result, unmount } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );

      expect(result.current.exportDeliveryClient).toBeTruthy();
      expect(typeof result.current.exportDeliveryClient.deliver).toBe("function");

      await unmount();
      await act(async () => {
        await Promise.resolve();
      });
    });
  });

  // ---------------------------------------------------------------------
  // The focus-load effect's isMounted guard: a refocus can start a new load
  // while a screen is torn down (or a stale prior load is still in flight)
  // mid-await. Each of the four internal awaits has its own early-return
  // guard; none of the four is exercised by the full-screen integration
  // suite because every awaited call there resolves before the next
  // refocus/unmount.
  // ---------------------------------------------------------------------
  describe("focus-load effect stops when torn down mid-flight", () => {
    it("applies no loaded state when unmounted while the account-change phrase state loads", async () => {
      const deferred = createDeferred<
        Awaited<ReturnType<typeof accountChangeRecoveryPhrase.loadAccountChangeRecoveryPhraseState>>
      >();
      const phraseStateSpy = jest
        .spyOn(accountChangeRecoveryPhrase, "loadAccountChangeRecoveryPhraseState")
        .mockReturnValue(deferred.promise);
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();

      const { result, unmount } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );
      await waitFor(() => expect(phraseStateSpy).toHaveBeenCalled());
      await unmount();

      await act(async () => {
        deferred.resolve("reveal");
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.state).toBeNull();
    });

    it("does not continue past readHasCompletedOnboarding once unmounted", async () => {
      const deferred = createDeferred<boolean>();
      jest
        .spyOn(appBootstrapService, "readHasCompletedOnboarding")
        .mockReturnValue(deferred.promise);
      const loadSettingsSpy = jest.spyOn(
        settingsStateService,
        "loadSettingsScreenState",
      );
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();

      const { unmount } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );
      await unmount();

      await act(async () => {
        deferred.resolve(false);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(loadSettingsSpy).not.toHaveBeenCalled();
    });

    it("does not continue past loadSyncSetupState (guest-bypass check) once unmounted", async () => {
      const storage = createSettingsStorageMock({
        readBootstrapState: jest.fn().mockResolvedValue({
          hasCompletedOnboarding: false,
          profileVersion: 2,
          incompleteOnboardingStep: 1,
        }),
      });
      const syncSecretStore = createSyncSecretStoreMock();
      const deferred = createDeferred<
        Awaited<ReturnType<typeof syncSetupService.loadSyncSetupState>>
      >();
      const loadSyncSetupSpy = jest
        .spyOn(syncSetupService, "loadSyncSetupState")
        .mockReturnValue(deferred.promise);
      const loadSettingsSpy = jest.spyOn(
        settingsStateService,
        "loadSettingsScreenState",
      );
      // No pending invite token: the gate must actually reach
      // loadSyncSetupState instead of short-circuiting past it.
      mockSearchParams = {};

      const { unmount } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );

      // Let the flow genuinely reach (and suspend inside) loadSyncSetupState
      // before tearing down -- unmounting any earlier would only re-exercise
      // the readHasCompletedOnboarding guard above, not this one.
      await waitFor(() => expect(loadSyncSetupSpy).toHaveBeenCalled());
      await unmount();

      await act(async () => {
        deferred.resolve({
          hasAuthSession: false,
          hasStoredSecrets: false,
          preferences: createLoadedSettingsStateFixture().savedSyncPreferences,
        });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(loadSettingsSpy).not.toHaveBeenCalled();
    });

    it("does not continue past loadSettingsScreenState once unmounted", async () => {
      const storage = createSettingsStorageMock(); // hasCompletedOnboarding: true (fast path)
      const syncSecretStore = createSyncSecretStoreMock();
      const deferred = createDeferred<ReturnType<
        typeof createLoadedSettingsStateFixture
      >>();
      const loadSettingsSpy = jest
        .spyOn(settingsStateService, "loadSettingsScreenState")
        .mockReturnValue(deferred.promise as never);
      const readDismissedSpy = jest.spyOn(
        offersService,
        "readDismissedBillingOfferIDs",
      );

      const { unmount } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );

      // Let the flow genuinely reach (and suspend inside) loadSettingsScreenState
      // before tearing down -- unmounting any earlier would only re-exercise
      // an upstream guard, not this one.
      await waitFor(() => expect(loadSettingsSpy).toHaveBeenCalled());
      await unmount();

      await act(async () => {
        deferred.resolve(createLoadedSettingsStateFixture());
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(readDismissedSpy).not.toHaveBeenCalled();
    });

    it("does not let a stale in-flight refocus clobber a fresher reload's already-settled result", async () => {
      const staleDeferred = createDeferred<string[]>();
      const syncSecretStore = createSyncSecretStoreMock();
      const storageGen1 = createSettingsStorageMock({
        readManagedBillingCacheRecord: jest
          .fn()
          .mockReturnValue(
            staleDeferred.promise.then((dismissedOfferIDs) => ({
              snapshot: null,
              dismissedOfferIDs,
            })),
          ),
      });
      const storageGen2 = createSettingsStorageMock();

      const { result, rerender } = await renderHook(
        ({ storage }: { storage: LocalAppStorage }) =>
          useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
        { initialProps: { storage: storageGen1 } },
      );

      // Let generation 1 run up to (and hang on) the final Promise.all.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.isLoading).toBe(true);

      // Refocus with a different storage instance: the effect's cleanup
      // marks generation 1's closure unmounted, and generation 2 (fast
      // defaults) starts fresh and settles completely.
      await act(async () => {
        await rerender({ storage: storageGen2 });
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.dismissedOfferIDs).toEqual([]);

      // Generation 1's deferred settles only now, long after generation 2
      // already committed -- the isMounted guard must keep this stale
      // result from clobbering the fresher one.
      await act(async () => {
        staleDeferred.resolve(["stale-offer-should-never-appear"]);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.dismissedOfferIDs).toEqual([]);
    });
  });

  describe("revertUnsavedSync", () => {
    it("resets feedback but is a safe no-op on state when called before the initial load settles", async () => {
      const deferred = createDeferred<boolean>();
      jest
        .spyOn(appBootstrapService, "readHasCompletedOnboarding")
        .mockReturnValue(deferred.promise);
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();

      const { result } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );
      expect(result.current.state).toBeNull();

      await act(() => {
        result.current.setErrorState({ code: "generic", scope: "local" });
        result.current.setAccountStatusMessage("stale status");
      });
      expect(result.current.errorState).not.toBeNull();

      await act(() => {
        result.current.revertUnsavedSync();
      });

      expect(result.current.state).toBeNull();
      expect(result.current.errorState).toBeNull();
      expect(result.current.accountStatusMessage).toBe("");

      await act(async () => {
        deferred.resolve(true);
        await Promise.resolve();
      });
    });
  });

  describe("saveSyncDraftIfNeeded", () => {
    async function flushMicrotasks(times = 6) {
      for (let i = 0; i < times; i += 1) {
        await Promise.resolve();
      }
    }

    async function renderLoadedCore(storageOverrides: Partial<LocalAppStorage> = {}) {
      const storage = createSettingsStorageMock(storageOverrides);
      const syncSecretStore = createSyncSecretStoreMock();
      const rendered = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );
      await act(async () => {
        await flushMicrotasks();
      });
      expect(rendered.result.current.isLoading).toBe(false);
      return rendered;
    }

    it("returns null immediately and never calls the save service when there is no loaded state yet", async () => {
      const deferred = createDeferred<boolean>();
      jest
        .spyOn(appBootstrapService, "readHasCompletedOnboarding")
        .mockReturnValue(deferred.promise);
      const saveSpy = jest.spyOn(backupSyncScreenService, "saveBackupSyncDraft");
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();
      const { result } = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );
      expect(result.current.state).toBeNull();

      let outcome: unknown = "not-set";
      await act(async () => {
        outcome = await result.current.saveSyncDraftIfNeeded("local");
      });

      expect(outcome).toBeNull();
      expect(saveSpy).not.toHaveBeenCalled();

      await act(async () => {
        deferred.resolve(true);
        await flushMicrotasks();
      });
    });

    it("saves a dirty draft: busy flag toggles, and a still-stored-secrets result keeps the revealed phrase", async () => {
      const saveDeferred = createDeferred<
        Awaited<ReturnType<typeof backupSyncScreenService.saveBackupSyncDraft>>
      >();
      const saveSpy = jest
        .spyOn(backupSyncScreenService, "saveBackupSyncDraft")
        .mockReturnValue(saveDeferred.promise);

      const { result } = await renderLoadedCore();

      const dirtyState = createLoadedSettingsStateFixture({
        syncPreferences: {
          ...result.current.state!.savedSyncPreferences,
          deviceLabel: "Changed label",
        },
      });
      await act(async () => {
        result.current.setState(dirtyState);
        result.current.setGeneratedRecoveryPhrase("existing phrase");
        result.current.setGeneratedRecoveryCode("existing code");
        result.current.setGeneratedAccountLogin("a3f9-0c12-77be-4d01");
        await flushMicrotasks();
      });
      expect(result.current.state).toEqual(dirtyState);

      let savePromise!: Promise<unknown>;
      await act(() => {
        savePromise = result.current.saveSyncDraftIfNeeded("sync");
      });
      // setIsSavingSyncDraft(true) runs synchronously before the awaited
      // save call, so this is already observable without waiting.
      expect(result.current.isSavingSyncDraft).toBe(true);

      const savedState = createLoadedSettingsStateFixture({
        syncPreferences: dirtyState.syncPreferences,
        savedSyncPreferences: dirtyState.syncPreferences,
        hasStoredSyncSecrets: true,
      });
      await act(async () => {
        saveDeferred.resolve({ ok: true, state: savedState });
        await savePromise;
      });

      expect(saveSpy).toHaveBeenCalledWith(
        result.current.storage,
        result.current.syncSecretStore,
        dirtyState,
      );
      expect(result.current.isSavingSyncDraft).toBe(false);
      expect(result.current.state).toEqual(savedState);
      // hasStoredSyncSecrets stayed true on the returned state -- the
      // already-revealed recovery phrase/code must be left alone.
      expect(result.current.generatedRecoveryPhrase).toBe("existing phrase");
      expect(result.current.generatedRecoveryCode).toBe("existing code");
      expect(result.current.generatedAccountLogin).toBe("a3f9-0c12-77be-4d01");
    });

    it("clears the revealed recovery phrase and code when the saved result no longer has stored secrets", async () => {
      const { result } = await renderLoadedCore();

      const dirtyState = createLoadedSettingsStateFixture({
        syncPreferences: {
          ...result.current.state!.savedSyncPreferences,
          deviceLabel: "Changed label",
        },
      });
      await act(async () => {
        result.current.setState(dirtyState);
        result.current.setGeneratedRecoveryPhrase("existing phrase");
        result.current.setGeneratedRecoveryCode("existing code");
        result.current.setGeneratedAccountLogin("a3f9-0c12-77be-4d01");
        await flushMicrotasks();
      });
      expect(result.current.state).toEqual(dirtyState);

      const savedState = createLoadedSettingsStateFixture({
        syncPreferences: dirtyState.syncPreferences,
        savedSyncPreferences: dirtyState.syncPreferences,
        hasStoredSyncSecrets: false,
      });
      jest
        .spyOn(backupSyncScreenService, "saveBackupSyncDraft")
        .mockResolvedValue({ ok: true, state: savedState });

      await act(async () => {
        await result.current.saveSyncDraftIfNeeded("account");
      });

      expect(result.current.generatedRecoveryPhrase).toBe("");
      expect(result.current.generatedRecoveryCode).toBe("");
      expect(result.current.generatedAccountLogin).toBe("");
      expect(result.current.state).toEqual(savedState);
    });

    it("shows an unacknowledged managed phrase again on every load until it is acknowledged", async () => {
      const peekSpy = jest
        .spyOn(managedRecoveryRotationService, "peekUnacknowledgedManagedRecoveryPhrase")
        .mockReturnValue("rotated phrase");

      const first = await renderLoadedCore();
      expect(first.result.current.generatedRecoveryPhrase).toBe("rotated phrase");
      await first.unmount();

      const second = await renderLoadedCore();
      expect(second.result.current.generatedRecoveryPhrase).toBe("rotated phrase");
      expect(peekSpy).toHaveBeenCalledTimes(2);
    });

    it.each(["reveal", "replace"] as const)(
      "restores the %s offer for a replaced sync key on every load, never the phrase itself",
      async (offer) => {
        jest
          .spyOn(accountChangeRecoveryPhrase, "loadAccountChangeRecoveryPhraseState")
          .mockResolvedValue(offer);

        const { result } = await renderLoadedCore();

        expect(result.current.accountChangeRecoveryPhrase).toBe(offer);
        expect(result.current.generatedRecoveryPhrase).toBe("");
      },
    );

    it("surfaces a failed save as errorState scoped to the caller and leaves the draft state untouched", async () => {
      const { result } = await renderLoadedCore();

      const dirtyState = createLoadedSettingsStateFixture({
        syncPreferences: {
          ...result.current.state!.savedSyncPreferences,
          deviceLabel: "Changed label",
        },
      });
      await act(async () => {
        result.current.setState(dirtyState);
        await flushMicrotasks();
      });
      expect(result.current.state).toEqual(dirtyState);

      jest
        .spyOn(backupSyncScreenService, "saveBackupSyncDraft")
        .mockResolvedValue({ ok: false, errorCode: "generic" });

      let outcome: unknown = "not-set";
      await act(async () => {
        outcome = await result.current.saveSyncDraftIfNeeded("account");
      });

      expect(outcome).toBeNull();
      expect(result.current.errorState).toEqual({
        code: "generic",
        scope: "account",
      });
      expect(result.current.isSavingSyncDraft).toBe(false);
      // The rejected save must not silently mutate the pending draft.
      expect(result.current.state).toEqual(dirtyState);
    });
  });

  describe("ensureDataSharingConsent", () => {
    async function renderConsentCore(
      storageOverrides: Partial<LocalAppStorage> = {},
      withFixedNow = true,
    ) {
      const storage = createSettingsStorageMock(storageOverrides);
      const syncSecretStore = createSyncSecretStoreMock();
      const now = withFixedNow ? FIXED_NOW : undefined;
      const rendered = await renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now }),
      );
      await act(async () => {
        for (let index = 0; index < 6; index += 1) {
          await Promise.resolve();
        }
      });
      return { ...rendered, storage };
    }

    it("drops a second request while the first is pending and records the first acceptance with the current date", async () => {
      const { result, storage, unmount } = await renderConsentCore({}, false);

      let first!: Promise<boolean>;
      await act(async () => {
        first = result.current.ensureDataSharingConsent("managed_sync");
        await Promise.resolve();
      });
      let second = true;
      await act(async () => {
        second = await result.current.ensureDataSharingConsent("partner_share");
      });
      expect(second).toBe(false);
      await waitFor(() =>
        expect(result.current.pendingDataSharingConsent).toBe("managed_sync"),
      );

      await act(async () => {
        result.current.answerDataSharingConsent(true);
      });
      expect(await first).toBe(true);
      const options = jest.mocked(storage.writeSyncPreferencesRecord).mock.calls.at(-1)?.[1];
      expect(options?.dataSharingConsent?.managed_sync?.givenAt).toEqual(expect.any(String));
      await unmount();
    });

    it("answers false when the acceptance cannot be recorded", async () => {
      const { result, unmount } = await renderConsentCore({
        writeSyncPreferencesRecord: jest.fn().mockRejectedValue(new Error("disk full")),
      });

      let pending!: Promise<boolean>;
      await act(async () => {
        pending = result.current.ensureDataSharingConsent("self_hosted_sync");
        await Promise.resolve();
      });
      await waitFor(() =>
        expect(result.current.pendingDataSharingConsent).toBe("self_hosted_sync"),
      );
      await act(async () => {
        result.current.answerDataSharingConsent(true);
      });
      expect(await pending).toBe(false);
      await unmount();
    });
  });
});
