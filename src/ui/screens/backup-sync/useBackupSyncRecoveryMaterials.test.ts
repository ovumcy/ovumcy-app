import { act, renderHook } from "@testing-library/react-native";

import { selectManagedRecoveryRotationCopy } from "../../../i18n/managed-recovery-rotation-copy";
import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
import * as managedRecoveryRotationService from "../../../sync/managed-recovery-rotation-service";
import * as syncAccountSessionService from "../../../sync/sync-account-session-service";
import * as backupSyncScreenService from "../../../services/backup-sync-screen-service";
import * as recoveryPhraseDeliveryService from "../../../services/recovery-phrase-delivery-service";
import {
  createBackupSyncSessionCoreMock,
  createLoadedSettingsStateFixture,
} from "../../../test/create-backup-sync-session-core-mock";
import { openConfirmation } from "../../confirm/open-confirmation";
import { useBackupSyncRecoveryMaterials } from "./useBackupSyncRecoveryMaterials";

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

jest.mock("../../../security/sensitive-action-auth", () => ({
  requestSensitiveActionChallenge: jest.fn(),
}));

jest.mock("../../../services/backup-sync-screen-service");
jest.mock("../../../services/recovery-phrase-delivery-service");
jest.mock("../../../sync/managed-recovery-rotation-service");
jest.mock("../../../sync/sync-account-session-service");

const mockRotateManagedRecoveryPhrase = jest.mocked(
  managedRecoveryRotationService.rotateManagedRecoveryPhrase,
);
const mockDescribeSyncAccountTwoFactor = jest.mocked(
  syncAccountSessionService.describeSyncAccountTwoFactor,
);
const rotationCopy = selectManagedRecoveryRotationCopy("en");

function createConnectedManagedState() {
  const base = createLoadedSettingsStateFixture({
    hasStoredSyncSecrets: true,
    hasSyncSession: true,
  });
  // Rotation needs a rollback floor raised under this account's key.
  return {
    ...base,
    savedSyncPreferences: {
      ...base.savedSyncPreferences,
      accountId: "acct-1",
      lastRemoteGeneration: 7,
    },
  };
}

const mockOpenConfirmation = jest.mocked(openConfirmation);
const mockRequestSensitiveActionChallenge = jest.mocked(
  requestSensitiveActionChallenge,
);
const mockPrepareBackupSyncSetup = jest.mocked(
  backupSyncScreenService.prepareBackupSyncSetup,
);
const mockDeliverRecoveryPhraseArtifact = jest.mocked(
  recoveryPhraseDeliveryService.deliverRecoveryPhraseArtifact,
);

describe("useBackupSyncRecoveryMaterials", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handlePrepareSyncSetup", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(core.resetFeedbackMessages).not.toHaveBeenCalled();
      expect(mockPrepareBackupSyncSetup).not.toHaveBeenCalled();
      expect(result.current.isPreparingSync).toBe(false);
    });

    it("skips the confirm and device-auth gate on first-time setup (no stored secrets yet) and reports 'prepared'", async () => {
      const preparedState = createLoadedSettingsStateFixture({
        hasStoredSyncSecrets: true,
      });
      const core = createBackupSyncSessionCoreMock({
        state: createLoadedSettingsStateFixture({ hasStoredSyncSecrets: false }),
      });
      mockPrepareBackupSyncSetup.mockResolvedValue({
        ok: true,
        state: preparedState,
        recoveryPhrase: "alpha beta gamma delta epsilon zeta",
        regenerated: false,
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockRequestSensitiveActionChallenge).not.toHaveBeenCalled();
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        core.viewData.account.status.prepared,
      );
      expect(core.setGeneratedRecoveryPhrase).toHaveBeenCalledWith(
        "alpha beta gamma delta epsilon zeta",
      );
      expect(result.current.isPreparingSync).toBe(false);
    });

    it("does not prepare when the regenerate confirm is dismissed (existing secrets)", async () => {
      const core = createBackupSyncSessionCoreMock({
        state: createLoadedSettingsStateFixture({
          hasStoredSyncSecrets: true,
          hasSyncSession: false,
        }),
      });
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        core.viewData.account.regeneratePrompt,
        core.viewData.account.regenerateAccept,
        core.viewData.common.cancelAction,
      );
      expect(mockRequestSensitiveActionChallenge).not.toHaveBeenCalled();
      expect(mockPrepareBackupSyncSetup).not.toHaveBeenCalled();
      expect(result.current.isPreparingSync).toBe(false);
    });

    it("surfaces deviceAuthUnavailable with local scope when the regenerate challenge is unavailable", async () => {
      const core = createBackupSyncSessionCoreMock({
        state: createLoadedSettingsStateFixture({
          hasStoredSyncSecrets: true,
          hasSyncSession: false,
        }),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "unavailable",
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledWith(
        core.viewData.account.regenerateDeviceAuthPrompt,
      );
      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "deviceAuthUnavailable",
        scope: "local",
      });
      expect(mockPrepareBackupSyncSetup).not.toHaveBeenCalled();
    });

    it("surfaces deviceAuthFailed with local scope when the regenerate challenge fails", async () => {
      const core = createBackupSyncSessionCoreMock({
        state: createLoadedSettingsStateFixture({
          hasStoredSyncSecrets: true,
          hasSyncSession: false,
        }),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "failed",
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "deviceAuthFailed",
        scope: "local",
      });
      expect(mockPrepareBackupSyncSetup).not.toHaveBeenCalled();
    });

    it("stays silent when the regenerate device-auth challenge is cancelled", async () => {
      const core = createBackupSyncSessionCoreMock({
        state: createLoadedSettingsStateFixture({
          hasStoredSyncSecrets: true,
          hasSyncSession: false,
        }),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "cancelled",
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(core.setErrorState).not.toHaveBeenCalled();
      expect(mockPrepareBackupSyncSetup).not.toHaveBeenCalled();
      expect(result.current.isPreparingSync).toBe(false);
    });

    // Security constitution / #129: guest sessions already have local secrets
    // (hasStoredSyncSecrets true), so they take the confirm+device-auth path
    // like an owner -- but prepareBackupSyncSetup independently refuses to
    // mint a phrase for a guest (guest_recovery_phrase_blocked). This proves
    // the hook has no bypass: the error surfaces like any other and a guest
    // never receives a phrase through this code path.
    it("never sets a recovery phrase when the service refuses with guest_recovery_phrase_blocked (guest gate stays enforced)", async () => {
      const core = createBackupSyncSessionCoreMock({
        state: createLoadedSettingsStateFixture({
          hasStoredSyncSecrets: true,
          hasSyncSession: false,
        }),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockPrepareBackupSyncSetup.mockResolvedValue({
        ok: false,
        errorCode: "guest_recovery_phrase_blocked",
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "guest_recovery_phrase_blocked",
        scope: "local",
      });
      expect(core.setGeneratedRecoveryPhrase).not.toHaveBeenCalled();
      expect(core.setState).not.toHaveBeenCalled();
      expect(core.reloadPartnerAccess).not.toHaveBeenCalled();
      expect(core.setAccountStatusMessage).not.toHaveBeenCalled();
      expect(result.current.isPreparingSync).toBe(false);
    });

    it("surfaces a non-guest prepare-service failure with local scope", async () => {
      const core = createBackupSyncSessionCoreMock({
        state: createLoadedSettingsStateFixture({ hasStoredSyncSecrets: false }),
      });
      mockPrepareBackupSyncSetup.mockResolvedValue({
        ok: false,
        errorCode: "insecure_public_http",
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "insecure_public_http",
        scope: "local",
      });
      expect(core.setGeneratedRecoveryPhrase).not.toHaveBeenCalled();
      expect(result.current.isPreparingSync).toBe(false);
    });

    it("regenerates successfully after confirm + device-auth and reports 'regenerated'", async () => {
      const regeneratedState = createLoadedSettingsStateFixture({
        hasStoredSyncSecrets: true,
      });
      const core = createBackupSyncSessionCoreMock({
        state: createLoadedSettingsStateFixture({
          hasStoredSyncSecrets: true,
          hasSyncSession: false,
        }),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockPrepareBackupSyncSetup.mockResolvedValue({
        ok: true,
        state: regeneratedState,
        recoveryPhrase: "fresh phrase words here now go",
        regenerated: true,
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(core.setErrorState).toHaveBeenCalledWith(null);
      expect(core.setState).toHaveBeenCalledWith(regeneratedState);
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(regeneratedState);
      expect(core.setGeneratedRecoveryPhrase).toHaveBeenCalledWith(
        "fresh phrase words here now go",
      );
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        core.viewData.account.status.regenerated,
      );
      expect(result.current.isPreparingSync).toBe(false);
    });
  });

  describe("managed recovery-phrase rotation", () => {
    async function openRotationCard(twoFactorEnabled: boolean | null) {
      const core = createBackupSyncSessionCoreMock({
        state: createConnectedManagedState(),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockDescribeSyncAccountTwoFactor.mockResolvedValue(
        twoFactorEnabled === null
          ? null
          : ({ twoFactorEnabled } as Awaited<
              ReturnType<typeof syncAccountSessionService.describeSyncAccountTwoFactor>
            >),
      );
      const hook = await renderHook(() => useBackupSyncRecoveryMaterials(core));
      await act(async () => {
        await hook.result.current.handlePrepareSyncSetup();
      });
      return { core, result: hook.result, unmount: hook.unmount };
    }

    it("rotates instead of regenerating: rotation confirm, device-auth, then the step-up card", async () => {
      const { core, result } = await openRotationCard(true);

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        rotationCopy.confirmPrompt,
        rotationCopy.confirmAccept,
        core.viewData.common.cancelAction,
      );
      expect(mockRequestSensitiveActionChallenge).toHaveBeenCalledWith(
        rotationCopy.deviceAuthPrompt,
      );
      expect(mockPrepareBackupSyncSetup).not.toHaveBeenCalled();
      expect(mockRotateManagedRecoveryPhrase).not.toHaveBeenCalled();
      expect(core.setGeneratedRecoveryPhrase).not.toHaveBeenCalled();
      expect(result.current.managedRecoveryRotationStepUpPrompt).toEqual({
        codeRequired: true,
        errorCode: null,
      });
    });

    it("hides the code field only when two-factor is known to be off", async () => {
      const { result } = await openRotationCard(false);
      expect(result.current.managedRecoveryRotationStepUpPrompt?.codeRequired).toBe(false);
    });

    it("shows the code field when the two-factor status is unknown or its lookup throws", async () => {
      const unknown = await openRotationCard(null);
      expect(unknown.result.current.managedRecoveryRotationStepUpPrompt?.codeRequired).toBe(
        true,
      );

      mockDescribeSyncAccountTwoFactor.mockRejectedValueOnce(new Error("offline"));
      const core = createBackupSyncSessionCoreMock({ state: createConnectedManagedState() });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));
      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });
      expect(result.current.managedRecoveryRotationStepUpPrompt?.codeRequired).toBe(true);
    });

    it("ignores a submit when no card is open", async () => {
      const core = createBackupSyncSessionCoreMock({ state: createConnectedManagedState() });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handleSubmitManagedRecoveryRotationStepUp({
          currentPassword: "pw",
        });
      });

      expect(mockRotateManagedRecoveryPhrase).not.toHaveBeenCalled();
    });

    it("closes the card on cancel", async () => {
      const { result } = await openRotationCard(false);

      await act(() => {
        result.current.handleCancelManagedRecoveryRotationStepUp();
      });

      expect(result.current.managedRecoveryRotationStepUpPrompt).toBeNull();
    });

    it.each(["totp_invalid_code", "totp_replayed"] as const)(
      "forces the code field on %s",
      async (errorCode) => {
        const { result } = await openRotationCard(false);
        mockRotateManagedRecoveryPhrase.mockResolvedValue({ ok: false, errorCode });

        await act(async () => {
          await result.current.handleSubmitManagedRecoveryRotationStepUp({
            currentPassword: "pw",
          });
        });

        expect(result.current.managedRecoveryRotationStepUpPrompt).toEqual({
          codeRequired: true,
          errorCode,
        });
      },
    );

    it("treats a thrown rotation as a failed change and keeps the card", async () => {
      const { core, result } = await openRotationCard(false);
      mockRotateManagedRecoveryPhrase.mockRejectedValue(new Error("boom"));

      await act(async () => {
        await result.current.handleSubmitManagedRecoveryRotationStepUp({
          currentPassword: "pw",
        });
      });

      expect(core.setGeneratedRecoveryPhrase).not.toHaveBeenCalled();
      expect(result.current.managedRecoveryRotationStepUpPrompt).toEqual({
        codeRequired: false,
        errorCode: "generic",
      });
      expect(result.current.isRotatingRecoveryPhrase).toBe(false);
    });

    it("closes the card and reports not_connected without a managed session", async () => {
      const { core, result } = await openRotationCard(false);
      mockRotateManagedRecoveryPhrase.mockResolvedValue({
        ok: false,
        errorCode: "not_connected",
      });

      await act(async () => {
        await result.current.handleSubmitManagedRecoveryRotationStepUp({
          currentPassword: "pw",
        });
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "not_connected",
        scope: "local",
      });
      expect(result.current.managedRecoveryRotationStepUpPrompt).toBeNull();
    });

    it("opens no card when the rotation confirm is dismissed", async () => {
      const core = createBackupSyncSessionCoreMock({
        state: createConnectedManagedState(),
      });
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(mockRequestSensitiveActionChallenge).not.toHaveBeenCalled();
      expect(result.current.managedRecoveryRotationStepUpPrompt).toBeNull();
    });

    it("opens no card when device auth fails", async () => {
      const core = createBackupSyncSessionCoreMock({
        state: createConnectedManagedState(),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "failed",
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "deviceAuthFailed",
        scope: "local",
      });
      expect(result.current.managedRecoveryRotationStepUpPrompt).toBeNull();
    });

    it("reveals the new phrase only after the rotation is confirmed", async () => {
      const { core, result } = await openRotationCard(true);
      mockRotateManagedRecoveryPhrase.mockResolvedValue({
        ok: true,
        recoveryPhrase: "new phrase words",
      });

      await act(async () => {
        await result.current.handleSubmitManagedRecoveryRotationStepUp({
          currentPassword: "pw",
          code: "123456",
        });
      });

      expect(mockRotateManagedRecoveryPhrase).toHaveBeenCalledWith(
        core.syncSecretStore,
        { currentPassword: "pw", code: "123456" },
        core.effectiveNow,
      );
      expect(core.setGeneratedRecoveryPhrase).toHaveBeenCalledWith("new phrase words");
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(rotationCopy.rotatedStatus);
      expect(result.current.managedRecoveryRotationStepUpPrompt).toBeNull();
      expect(result.current.isRotatingRecoveryPhrase).toBe(false);
    });

    it("flags the rotation in flight without the key-preparation state", async () => {
      const { result } = await openRotationCard(false);
      let settle: (value: { ok: false; errorCode: "generic" }) => void = () => undefined;
      mockRotateManagedRecoveryPhrase.mockReturnValue(
        new Promise((resolve) => {
          settle = resolve;
        }),
      );

      let submitted: Promise<void> = Promise.resolve();
      await act(async () => {
        submitted = result.current.handleSubmitManagedRecoveryRotationStepUp({
          currentPassword: "pw",
        });
      });

      expect(result.current.isRotatingRecoveryPhrase).toBe(true);
      expect(result.current.isPreparingSync).toBe(false);

      await act(async () => {
        settle({ ok: false, errorCode: "generic" });
        await submitted;
      });

      expect(result.current.isRotatingRecoveryPhrase).toBe(false);
    });

    it.each([
      "rotation_unconfirmed",
      "invalid_current_password",
      "rate_limited",
      "totp_not_configured",
      "generic",
    ] as const)(
      "keeps the card open and shows no phrase on %s",
      async (errorCode) => {
        const { core, result } = await openRotationCard(true);
        mockRotateManagedRecoveryPhrase.mockResolvedValue({ ok: false, errorCode });

        await act(async () => {
          await result.current.handleSubmitManagedRecoveryRotationStepUp({
            currentPassword: "pw",
            code: "123456",
          });
        });

        expect(core.setGeneratedRecoveryPhrase).not.toHaveBeenCalled();
        expect(result.current.managedRecoveryRotationStepUpPrompt).toEqual({
          codeRequired: true,
          errorCode,
        });
      },
    );

    it("closes the card and reports not-connected when the session is gone", async () => {
      const { core, result } = await openRotationCard(false);
      mockRotateManagedRecoveryPhrase.mockResolvedValue({
        ok: false,
        errorCode: "unauthorized",
      });

      await act(async () => {
        await result.current.handleSubmitManagedRecoveryRotationStepUp({
          currentPassword: "pw",
        });
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "unauthorized",
        scope: "local",
      });
      expect(result.current.managedRecoveryRotationStepUpPrompt).toBeNull();
    });

    it("never acknowledges the stashed phrase, so the next load can show it after an unmount", async () => {
      const { result, unmount } = await openRotationCard(false);
      let resolveRotation: (value: { ok: true; recoveryPhrase: string }) => void = () => {};
      mockRotateManagedRecoveryPhrase.mockReturnValue(
        new Promise((resolve) => {
          resolveRotation = resolve;
        }),
      );

      let pending: Promise<void> = Promise.resolve();
      await act(async () => {
        pending = result.current.handleSubmitManagedRecoveryRotationStepUp({
          currentPassword: "pw",
        });
      });
      await unmount();
      resolveRotation({ ok: true, recoveryPhrase: "late phrase" });
      await pending;

      expect(
        managedRecoveryRotationService.acknowledgeManagedRecoveryPhrase,
      ).not.toHaveBeenCalled();
    });

    it("sends one request for a double submit", async () => {
      const { result } = await openRotationCard(false);
      let resolveRotation: (value: { ok: true; recoveryPhrase: string }) => void = () => {};
      mockRotateManagedRecoveryPhrase.mockReturnValue(
        new Promise((resolve) => {
          resolveRotation = resolve;
        }),
      );

      await act(async () => {
        const first = result.current.handleSubmitManagedRecoveryRotationStepUp({
          currentPassword: "pw",
        });
        const second = result.current.handleSubmitManagedRecoveryRotationStepUp({
          currentPassword: "pw",
        });
        resolveRotation({ ok: true, recoveryPhrase: "p" });
        await Promise.all([first, second]);
      });

      expect(mockRotateManagedRecoveryPhrase).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleAcknowledgeRecoveryCode", () => {
    it("clears the generated recovery code", async () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(() => {
        result.current.handleAcknowledgeRecoveryCode();
      });

      expect(core.setGeneratedRecoveryCode).toHaveBeenCalledWith("");
    });
  });

  describe("handleAcknowledgeRecoveryPhrase", () => {
    it("clears the shown phrase and the rotation stash, so no later load shows it again", async () => {
      const core = createBackupSyncSessionCoreMock({
        generatedRecoveryPhrase: "alpha beta gamma",
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(() => {
        result.current.handleAcknowledgeRecoveryPhrase();
      });

      expect(core.setGeneratedRecoveryPhrase).toHaveBeenCalledWith("");
      expect(
        managedRecoveryRotationService.acknowledgeManagedRecoveryPhrase,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe("handleExportRecoveryPhrase", () => {
    it("does nothing when there is no generated recovery phrase", async () => {
      const core = createBackupSyncSessionCoreMock({
        generatedRecoveryPhrase: "",
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handleExportRecoveryPhrase();
      });

      expect(core.resetFeedbackMessages).not.toHaveBeenCalled();
      expect(mockDeliverRecoveryPhraseArtifact).not.toHaveBeenCalled();
      expect(result.current.isExportingRecoveryPhrase).toBe(false);
    });

    it("delivers the generated recovery phrase and clears the busy flag on success", async () => {
      const core = createBackupSyncSessionCoreMock({
        generatedRecoveryPhrase: "alpha beta gamma delta epsilon zeta",
      });
      mockDeliverRecoveryPhraseArtifact.mockResolvedValue({ ok: true });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handleExportRecoveryPhrase();
      });

      expect(core.resetFeedbackMessages).toHaveBeenCalledTimes(1);
      expect(mockDeliverRecoveryPhraseArtifact).toHaveBeenCalledWith(
        core.exportDeliveryClient,
        "alpha beta gamma delta epsilon zeta",
        core.effectiveNow,
      );
      expect(core.setErrorState).not.toHaveBeenCalled();
      expect(result.current.isExportingRecoveryPhrase).toBe(false);
    });

    it("maps delivery_unavailable to recovery_export_unavailable with local scope", async () => {
      const core = createBackupSyncSessionCoreMock({
        generatedRecoveryPhrase: "alpha beta gamma delta epsilon zeta",
      });
      mockDeliverRecoveryPhraseArtifact.mockResolvedValue({
        ok: false,
        errorCode: "delivery_unavailable",
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handleExportRecoveryPhrase();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "recovery_export_unavailable",
        scope: "local",
      });
      expect(result.current.isExportingRecoveryPhrase).toBe(false);
    });

    it("maps delivery_failed to recovery_export_failed with local scope", async () => {
      const core = createBackupSyncSessionCoreMock({
        generatedRecoveryPhrase: "alpha beta gamma delta epsilon zeta",
      });
      mockDeliverRecoveryPhraseArtifact.mockResolvedValue({
        ok: false,
        errorCode: "delivery_failed",
      });
      const { result } = await renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handleExportRecoveryPhrase();
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "recovery_export_failed",
        scope: "local",
      });
      expect(result.current.isExportingRecoveryPhrase).toBe(false);
    });
  });
});
