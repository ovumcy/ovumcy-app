import { useEffect } from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import * as appBootstrapService from "../../../services/app-bootstrap-service";
import * as backupSyncScreenService from "../../../services/backup-sync-screen-service";
import * as offersService from "../../../services/offers-service";
import * as settingsStateService from "../../../services/settings-state-service";
import * as syncSetupService from "../../../sync/sync-setup-service";
import {
  clearManagedPartnerInviteToken,
  readManagedPartnerInviteToken,
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
let mockSearchParams: { invite_token?: string | string[] } = {};
const mockNavigationDispatch = jest.fn();

jest.mock("expo-router", () => {
  return {
    useFocusEffect: (effect: () => void | (() => void)) => {
      mockUseEffect(effect, [effect]);
    },
    useLocalSearchParams: () => mockSearchParams,
    useRouter: () => mockRouter,
  };
});

jest.mock("@react-navigation/native", () => {
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

      const { unmount } = renderHook(() =>
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
      unmount();
    });

    it("treats an empty array as no token at all (nullish fallback)", async () => {
      mockSearchParams = { invite_token: [] };
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();

      const { unmount } = renderHook(() =>
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
      unmount();
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

      const { result, unmount } = renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore }),
      );

      const after = Date.now();
      expect(result.current.effectiveNow).toBeInstanceOf(Date);
      expect(result.current.effectiveNow.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.current.effectiveNow.getTime()).toBeLessThanOrEqual(after);

      // Both defaults are read synchronously off the initializer -- no need
      // for the background focus-load to settle before tearing down.
      unmount();
      await act(async () => {
        await Promise.resolve();
      });
    });

    it("constructs the platform export-delivery client when none is supplied", async () => {
      const storage = createSettingsStorageMock();
      const syncSecretStore = createSyncSecretStoreMock();

      const { result, unmount } = renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );

      expect(result.current.exportDeliveryClient).toBeTruthy();
      expect(typeof result.current.exportDeliveryClient.deliver).toBe("function");

      unmount();
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

      const { unmount } = renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );
      unmount();

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

      const { unmount } = renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );

      // Let the flow genuinely reach (and suspend inside) loadSyncSetupState
      // before tearing down -- unmounting any earlier would only re-exercise
      // the readHasCompletedOnboarding guard above, not this one.
      await waitFor(() => expect(loadSyncSetupSpy).toHaveBeenCalled());
      unmount();

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

      const { unmount } = renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );

      // Let the flow genuinely reach (and suspend inside) loadSettingsScreenState
      // before tearing down -- unmounting any earlier would only re-exercise
      // an upstream guard, not this one.
      await waitFor(() => expect(loadSettingsSpy).toHaveBeenCalled());
      unmount();

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

      const { result, rerender } = renderHook(
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
        rerender({ storage: storageGen2 });
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

      const { result } = renderHook(() =>
        useBackupSyncSessionCore({ storage, syncSecretStore, now: FIXED_NOW }),
      );
      expect(result.current.state).toBeNull();

      act(() => {
        result.current.setErrorState({ code: "generic", scope: "local" });
        result.current.setAccountStatusMessage("stale status");
      });
      expect(result.current.errorState).not.toBeNull();

      act(() => {
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
      const rendered = renderHook(() =>
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
      const { result } = renderHook(() =>
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
        await flushMicrotasks();
      });
      expect(result.current.state).toEqual(dirtyState);

      let savePromise!: Promise<unknown>;
      act(() => {
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
      expect(result.current.state).toEqual(savedState);
    });

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
});
