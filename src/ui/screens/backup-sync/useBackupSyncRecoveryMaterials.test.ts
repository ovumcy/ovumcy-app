import { act, renderHook } from "@testing-library/react-native";

import { requestSensitiveActionChallenge } from "../../../security/sensitive-action-auth";
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
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
        state: createLoadedSettingsStateFixture({ hasStoredSyncSecrets: true }),
      });
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

      await act(async () => {
        await result.current.handlePrepareSyncSetup();
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        core.viewData.account.regeneratePrompt,
        core.viewData.account.regenerateAccept,
      );
      expect(mockRequestSensitiveActionChallenge).not.toHaveBeenCalled();
      expect(mockPrepareBackupSyncSetup).not.toHaveBeenCalled();
      expect(result.current.isPreparingSync).toBe(false);
    });

    it("surfaces deviceAuthUnavailable with local scope when the regenerate challenge is unavailable", async () => {
      const core = createBackupSyncSessionCoreMock({
        state: createLoadedSettingsStateFixture({ hasStoredSyncSecrets: true }),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "unavailable",
      });
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
        state: createLoadedSettingsStateFixture({ hasStoredSyncSecrets: true }),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "failed",
      });
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
        state: createLoadedSettingsStateFixture({ hasStoredSyncSecrets: true }),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({
        ok: false,
        reason: "cancelled",
      });
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
        state: createLoadedSettingsStateFixture({ hasStoredSyncSecrets: true }),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockPrepareBackupSyncSetup.mockResolvedValue({
        ok: false,
        errorCode: "guest_recovery_phrase_blocked",
      });
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
        state: createLoadedSettingsStateFixture({ hasStoredSyncSecrets: true }),
      });
      mockOpenConfirmation.mockResolvedValue(true);
      mockRequestSensitiveActionChallenge.mockResolvedValue({ ok: true });
      mockPrepareBackupSyncSetup.mockResolvedValue({
        ok: true,
        state: regeneratedState,
        recoveryPhrase: "fresh phrase words here now go",
        regenerated: true,
      });
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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

  describe("handleAcknowledgeRecoveryCode", () => {
    it("clears the generated recovery code", () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

      act(() => {
        result.current.handleAcknowledgeRecoveryCode();
      });

      expect(core.setGeneratedRecoveryCode).toHaveBeenCalledWith("");
    });
  });

  describe("handleExportRecoveryPhrase", () => {
    it("does nothing when there is no generated recovery phrase", async () => {
      const core = createBackupSyncSessionCoreMock({
        generatedRecoveryPhrase: "",
      });
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
      const { result } = renderHook(() => useBackupSyncRecoveryMaterials(core));

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
