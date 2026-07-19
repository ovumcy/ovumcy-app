import { act, renderHook, waitFor } from "@testing-library/react-native";

import { clearManagedPartnerInviteToken } from "../../../security/managed-partner-invite-token-buffer";
import {
  createBackupSyncSessionCoreMock,
  createLoadedSettingsStateFixture,
} from "../../../test/create-backup-sync-session-core-mock";
import { openLeaveConfirmation } from "../../confirm/open-confirmation";
import type { BackupSyncSessionCore } from "./useBackupSyncSessionCore";
import { useBackupSyncSessionCore } from "./useBackupSyncSessionCore";
import { useBackupSyncRecoveryMaterials } from "./useBackupSyncRecoveryMaterials";
import { useBackupSyncAccountConnection } from "./useBackupSyncAccountConnection";
import { useBackupSyncActions } from "./useBackupSyncActions";
import { useBackupSyncManagedPlan } from "./useBackupSyncManagedPlan";
import { useBackupSyncPartnerAccess } from "./useBackupSyncPartnerAccess";
import { useBackupSyncAccountDeletion } from "./useBackupSyncAccountDeletion";
import { useBackupSyncDeviceManagement } from "./useBackupSyncDeviceManagement";
import { useBackupSyncGuestUpgrade } from "./useBackupSyncGuestUpgrade";
import { useBackupSyncScreenController } from "./useBackupSyncScreenController";

// "mock"-prefixed names are required here: babel-plugin-jest-hoist only
// allows references inside a jest.mock(...) factory when the identifier
// starts with "mock" (the factory is hoisted above these declarations).
let mockPreventRemoveCallback:
  | ((options: { data: { action: { type: string } } }) => void)
  | null = null;

jest.mock("@react-navigation/native", () => ({
  usePreventRemove: (
    preventRemove: boolean,
    callback: (options: { data: { action: { type: string } } }) => void,
  ) => {
    mockPreventRemoveCallback = preventRemove ? callback : null;
  },
}));

jest.mock("../../confirm/open-confirmation", () => ({
  openLeaveConfirmation: jest.fn(),
}));

jest.mock(
  "../../../security/managed-partner-invite-token-buffer",
  () => ({
    clearManagedPartnerInviteToken: jest.fn(),
  }),
);

// An explicit factory (rather than a bare jest.mock(path) automock) avoids
// Jest ever loading the real module -- which transitively imports
// expo-router, and expo-router's own internals need more of
// @react-navigation/native than the lightweight mock below provides.
jest.mock("./useBackupSyncSessionCore", () => ({
  useBackupSyncSessionCore: jest.fn(),
}));
jest.mock("./useBackupSyncRecoveryMaterials");
jest.mock("./useBackupSyncAccountConnection");
jest.mock("./useBackupSyncActions");
jest.mock("./useBackupSyncManagedPlan");
jest.mock("./useBackupSyncPartnerAccess");
jest.mock("./useBackupSyncAccountDeletion");
jest.mock("./useBackupSyncDeviceManagement");
jest.mock("./useBackupSyncGuestUpgrade");

const mockUseBackupSyncSessionCore = jest.mocked(useBackupSyncSessionCore);
const mockUseBackupSyncRecoveryMaterials = jest.mocked(
  useBackupSyncRecoveryMaterials,
);
const mockUseBackupSyncAccountConnection = jest.mocked(
  useBackupSyncAccountConnection,
);
const mockUseBackupSyncActions = jest.mocked(useBackupSyncActions);
const mockUseBackupSyncManagedPlan = jest.mocked(useBackupSyncManagedPlan);
const mockUseBackupSyncPartnerAccess = jest.mocked(useBackupSyncPartnerAccess);
const mockUseBackupSyncAccountDeletion = jest.mocked(
  useBackupSyncAccountDeletion,
);
const mockUseBackupSyncDeviceManagement = jest.mocked(
  useBackupSyncDeviceManagement,
);
const mockUseBackupSyncGuestUpgrade = jest.mocked(useBackupSyncGuestUpgrade);
const mockOpenLeaveConfirmation = jest.mocked(openLeaveConfirmation);
const mockClearManagedPartnerInviteToken = jest.mocked(
  clearManagedPartnerInviteToken,
);

function createRecoveryMaterialsFixture(
  overrides: Partial<ReturnType<typeof useBackupSyncRecoveryMaterials>> = {},
): ReturnType<typeof useBackupSyncRecoveryMaterials> {
  return {
    isPreparingSync: false,
    isExportingRecoveryPhrase: false,
    handlePrepareSyncSetup: jest.fn(),
    handleAcknowledgeRecoveryCode: jest.fn(),
    handleExportRecoveryPhrase: jest.fn(),
    ...overrides,
  };
}

function createAccountConnectionFixture(
  overrides: Partial<ReturnType<typeof useBackupSyncAccountConnection>> = {},
): ReturnType<typeof useBackupSyncAccountConnection> {
  return {
    accountLoginValue: "",
    setAccountLoginValue: jest.fn(),
    accountPasswordValue: "",
    setAccountPasswordValue: jest.fn(),
    isAuthenticatingSync: false,
    isRecoveringSync: false,
    pendingTOTPChallenge: null,
    totpChallengeCode: "",
    setTotpChallengeCode: jest.fn(),
    handleConnectSync: jest.fn(),
    handleSubmitTOTPChallenge: jest.fn(),
    handleCancelTOTPChallenge: jest.fn(),
    handleRecoverSync: jest.fn(),
    handleDisconnectSync: jest.fn(),
    ...overrides,
  };
}

function createActionsFixture(
  overrides: Partial<ReturnType<typeof useBackupSyncActions>> = {},
): ReturnType<typeof useBackupSyncActions> {
  return {
    isRestoringSync: false,
    isSyncingNow: false,
    handleSyncNow: jest.fn(),
    handleRestoreSync: jest.fn(),
    ...overrides,
  };
}

function createManagedPlanFixture(
  overrides: Partial<ReturnType<typeof useBackupSyncManagedPlan>> = {},
): ReturnType<typeof useBackupSyncManagedPlan> {
  return {
    isUpdatingRenewal: false,
    handleRetryPlanCheck: jest.fn(),
    handleUpdateRenewal: jest.fn(),
    handleDismissOffer: jest.fn(),
    handleOfferCTAPress: jest.fn(),
    ...overrides,
  };
}

function createPartnerAccessFixture(
  overrides: Partial<ReturnType<typeof useBackupSyncPartnerAccess>> = {},
): ReturnType<typeof useBackupSyncPartnerAccess> {
  return {
    partnerInviteAccessLevel: "summary",
    setPartnerInviteAccessLevel: jest.fn(),
    partnerInviteLink: "",
    setPartnerInviteLink: jest.fn(),
    isPartnerBusy: false,
    handleIssuePartnerInvite: jest.fn(),
    handleAcceptPartnerInvite: jest.fn(),
    handleAcceptPartnerInviteAsGuest: jest.fn(),
    handleChoosePartnerSignIn: jest.fn(),
    handleRevokePartnerInvite: jest.fn(),
    handleRevokePartnerGrant: jest.fn(),
    handleOpenPartnerGrant: jest.fn(),
    ...overrides,
  };
}

function createAccountDeletionFixture(
  overrides: Partial<ReturnType<typeof useBackupSyncAccountDeletion>> = {},
): ReturnType<typeof useBackupSyncAccountDeletion> {
  return {
    isDeletingAccount: false,
    handleDeleteAccount: jest.fn(),
    ...overrides,
  };
}

function createDeviceManagementFixture(
  overrides: Partial<ReturnType<typeof useBackupSyncDeviceManagement>> = {},
): ReturnType<typeof useBackupSyncDeviceManagement> {
  return {
    deviceListItems: [],
    isDeviceBusy: false,
    deviceErrorMessage: "",
    deviceStatusMessage: "",
    handleLoadDevices: jest.fn(),
    handleRemoveDevice: jest.fn(),
    ...overrides,
  };
}

function createGuestUpgradeFixture(
  overrides: Partial<ReturnType<typeof useBackupSyncGuestUpgrade>> = {},
): ReturnType<typeof useBackupSyncGuestUpgrade> {
  return {
    isGuestPartner: false,
    nudgeMessage: "",
    isFormOpen: false,
    emailValue: "",
    setEmailValue: jest.fn(),
    passwordValue: "",
    setPasswordValue: jest.fn(),
    isSubmitting: false,
    formErrorMessage: "",
    generatedRecoveryCode: "",
    handleTapKeepAccess: jest.fn(),
    handleCancelForm: jest.fn(),
    handleSubmitUpgrade: jest.fn(),
    handleAcknowledgeUpgradeRecoveryCode: jest.fn(),
    ...overrides,
  };
}

/** Wires every concern-hook mock to a sensible default and returns the
 * session-core mock so a test can override just the pieces it cares about. */
function setUpLoadedController(
  coreOverrides: Partial<BackupSyncSessionCore> = {},
): BackupSyncSessionCore {
  const core = createBackupSyncSessionCoreMock(coreOverrides);
  mockUseBackupSyncSessionCore.mockReturnValue(core);
  mockUseBackupSyncRecoveryMaterials.mockReturnValue(
    createRecoveryMaterialsFixture(),
  );
  mockUseBackupSyncAccountConnection.mockReturnValue(
    createAccountConnectionFixture(),
  );
  mockUseBackupSyncActions.mockReturnValue(createActionsFixture());
  mockUseBackupSyncManagedPlan.mockReturnValue(createManagedPlanFixture());
  mockUseBackupSyncPartnerAccess.mockReturnValue(createPartnerAccessFixture());
  mockUseBackupSyncAccountDeletion.mockReturnValue(
    createAccountDeletionFixture(),
  );
  mockUseBackupSyncDeviceManagement.mockReturnValue(
    createDeviceManagementFixture(),
  );
  mockUseBackupSyncGuestUpgrade.mockReturnValue(createGuestUpgradeFixture());
  return core;
}

describe("useBackupSyncScreenController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPreventRemoveCallback = null;
    if (!global.requestAnimationFrame) {
      global.requestAnimationFrame = ((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      }) as typeof requestAnimationFrame;
    }
  });

  // ---------------------------------------------------------------------
  // The three-way usePreventRemove leave guard. This is the controller's
  // own cross-hook orchestration -- every concern hook is stubbed out so
  // only the guard's decision logic (dismiss / discard / save) is under
  // test. Security constitution: a dialog dismissal must resolve to
  // keep-editing, never the destructive (discard) answer.
  // ---------------------------------------------------------------------
  describe("usePreventRemove leave guard", () => {
    it("registers the guard only while the sync draft is dirty", () => {
      setUpLoadedController({ isSyncDirty: true });
      renderHook(() => useBackupSyncScreenController({}));
      expect(mockPreventRemoveCallback).toEqual(expect.any(Function));
    });

    it("does not register the guard when the draft is clean", () => {
      setUpLoadedController({ isSyncDirty: false });
      renderHook(() => useBackupSyncScreenController({}));
      expect(mockPreventRemoveCallback).toBeNull();
    });

    it("SECURITY: dismissing the leave confirmation resolves to keep-editing -- no revert, no save, no navigation", async () => {
      mockOpenLeaveConfirmation.mockResolvedValue("dismiss");
      const core = setUpLoadedController({ isSyncDirty: true });
      renderHook(() => useBackupSyncScreenController({}));
      expect(mockPreventRemoveCallback).toEqual(expect.any(Function));

      await act(async () => {
        mockPreventRemoveCallback?.({ data: { action: { type: "GO_BACK" } } });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(core.revertUnsavedSync).not.toHaveBeenCalled();
      expect(core.saveSyncDraftIfNeeded).not.toHaveBeenCalled();
      expect(core.navigation.dispatch).not.toHaveBeenCalled();
    });

    it("discards the draft and then navigates away when the owner picks discard", async () => {
      mockOpenLeaveConfirmation.mockResolvedValue("reject");
      const core = setUpLoadedController({ isSyncDirty: true });
      renderHook(() => useBackupSyncScreenController({}));

      await act(async () => {
        mockPreventRemoveCallback?.({ data: { action: { type: "GO_BACK" } } });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(core.revertUnsavedSync).toHaveBeenCalledTimes(1);
      expect(core.saveSyncDraftIfNeeded).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(core.navigation.dispatch).toHaveBeenCalledWith(
          expect.objectContaining({ type: "GO_BACK" }),
        ),
      );
    });

    it("saves the draft and then navigates away when the owner picks save and the save succeeds", async () => {
      mockOpenLeaveConfirmation.mockResolvedValue("accept");
      const savedState = createLoadedSettingsStateFixture();
      const core = setUpLoadedController({
        isSyncDirty: true,
        saveSyncDraftIfNeeded: jest.fn().mockResolvedValue(savedState),
      });
      renderHook(() => useBackupSyncScreenController({}));

      await act(async () => {
        mockPreventRemoveCallback?.({ data: { action: { type: "GO_BACK" } } });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(core.saveSyncDraftIfNeeded).toHaveBeenCalledWith("local");
      expect(core.revertUnsavedSync).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(core.navigation.dispatch).toHaveBeenCalledWith(
          expect.objectContaining({ type: "GO_BACK" }),
        ),
      );
    });

    it("stays on the screen (no navigation) when the owner picks save but the save fails", async () => {
      mockOpenLeaveConfirmation.mockResolvedValue("accept");
      const core = setUpLoadedController({
        isSyncDirty: true,
        saveSyncDraftIfNeeded: jest.fn().mockResolvedValue(null),
      });
      renderHook(() => useBackupSyncScreenController({}));

      await act(async () => {
        mockPreventRemoveCallback?.({ data: { action: { type: "GO_BACK" } } });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(core.saveSyncDraftIfNeeded).toHaveBeenCalledWith("local");
      expect(core.navigation.dispatch).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // Simple pass-through action handlers: each just forwards to one concern
  // hook's own (already independently-tested) handler. The controller's own
  // job here is only the wiring, so the concern hooks stay mocked.
  // ---------------------------------------------------------------------
  it("wires each simple pass-through action to its concern-hook handler", () => {
    setUpLoadedController();
    const { result } = renderHook(() => useBackupSyncScreenController({}));
    const flowProps = result.current.flowProps!;
    const recovery = mockUseBackupSyncRecoveryMaterials.mock.results[0]!.value;
    const connection = mockUseBackupSyncAccountConnection.mock.results[0]!.value;
    const actions = mockUseBackupSyncActions.mock.results[0]!.value;
    const managedPlan = mockUseBackupSyncManagedPlan.mock.results[0]!.value;
    const partner = mockUseBackupSyncPartnerAccess.mock.results[0]!.value;

    void flowProps.onExportRecoveryPhrase();
    expect(recovery.handleExportRecoveryPhrase).toHaveBeenCalledTimes(1);

    void flowProps.onResumeRenewal();
    expect(managedPlan.handleUpdateRenewal).toHaveBeenCalledWith("resume");

    void flowProps.onRetryPlanCheck();
    expect(managedPlan.handleRetryPlanCheck).toHaveBeenCalledTimes(1);

    void flowProps.onRegister();
    expect(connection.handleConnectSync).toHaveBeenCalledWith("register");

    void flowProps.onRestore();
    expect(actions.handleRestoreSync).toHaveBeenCalledTimes(1);

    void flowProps.onSyncNow();
    expect(actions.handleSyncNow).toHaveBeenCalledTimes(1);

    void flowProps.onPartnerOpenGrant("grant-1");
    expect(partner.handleOpenPartnerGrant).toHaveBeenCalledWith("grant-1");

    void flowProps.onPartnerRevokeGrant("grant-2");
    expect(partner.handleRevokePartnerGrant).toHaveBeenCalledWith("grant-2");

    void flowProps.onPartnerRevokeInvite("invite-3");
    expect(partner.handleRevokePartnerInvite).toHaveBeenCalledWith("invite-3");
  });

  // ---------------------------------------------------------------------
  // State-updater handlers: each resets feedback and writes through a
  // null-safe setState((current) => current ? {...} : current) updater.
  // Since core.setState is a jest.fn() here (not real React state), the
  // updater function itself is extracted from the mock call and invoked
  // directly with both a realistic current state and null -- the only way
  // to deterministically drive the "current is null" defensive branch,
  // which the loading gate makes unreachable through the real UI.
  // ---------------------------------------------------------------------
  describe("state-updater handlers", () => {
    it("onDeviceLabelChange resets feedback and updates only the device label, guarding a null current state", () => {
      const core = setUpLoadedController();
      const { result } = renderHook(() => useBackupSyncScreenController({}));

      result.current.flowProps!.onDeviceLabelChange("Pixel 9");

      expect(core.resetFeedbackMessages).toHaveBeenCalledTimes(1);
      const updater = (core.setState as jest.Mock).mock.calls[0][0] as (
        current: ReturnType<typeof createLoadedSettingsStateFixture> | null,
      ) => unknown;
      const currentState = createLoadedSettingsStateFixture();
      expect(updater(currentState)).toEqual({
        ...currentState,
        syncPreferences: {
          ...currentState.syncPreferences,
          deviceLabel: "Pixel 9",
        },
      });
      expect(updater(null)).toBeNull();
    });

    it("onEndpointChange resets feedback and updates only the endpoint input, guarding a null current state", () => {
      const core = setUpLoadedController();
      const { result } = renderHook(() => useBackupSyncScreenController({}));

      result.current.flowProps!.onEndpointChange("192.168.1.50:8080");

      expect(core.resetFeedbackMessages).toHaveBeenCalledTimes(1);
      const updater = (core.setState as jest.Mock).mock.calls[0][0] as (
        current: ReturnType<typeof createLoadedSettingsStateFixture> | null,
      ) => unknown;
      const currentState = createLoadedSettingsStateFixture();
      expect(updater(currentState)).toEqual({
        ...currentState,
        syncPreferences: {
          ...currentState.syncPreferences,
          endpointInput: "192.168.1.50:8080",
        },
      });
      expect(updater(null)).toBeNull();
    });

    it("onModeSelect resets partner state, clears the pending invite buffer, and preserves the endpoint for a non-managed mode", () => {
      const partner = createPartnerAccessFixture();
      const core = createBackupSyncSessionCoreMock();
      mockUseBackupSyncSessionCore.mockReturnValue(core);
      mockUseBackupSyncRecoveryMaterials.mockReturnValue(
        createRecoveryMaterialsFixture(),
      );
      mockUseBackupSyncAccountConnection.mockReturnValue(
        createAccountConnectionFixture(),
      );
      mockUseBackupSyncActions.mockReturnValue(createActionsFixture());
      mockUseBackupSyncManagedPlan.mockReturnValue(createManagedPlanFixture());
      mockUseBackupSyncPartnerAccess.mockReturnValue(partner);
      mockUseBackupSyncAccountDeletion.mockReturnValue(
        createAccountDeletionFixture(),
      );
      mockUseBackupSyncDeviceManagement.mockReturnValue(
        createDeviceManagementFixture(),
      );
      mockUseBackupSyncGuestUpgrade.mockReturnValue(
        createGuestUpgradeFixture(),
      );
      const { result } = renderHook(() => useBackupSyncScreenController({}));

      result.current.flowProps!.onModeSelect("self_hosted");

      expect(core.resetFeedbackMessages).toHaveBeenCalledTimes(1);
      expect(core.resetPartnerFeedback).toHaveBeenCalledTimes(1);
      expect(partner.setPartnerInviteLink).toHaveBeenCalledWith("");
      expect(core.setPartnerOverview).toHaveBeenCalledWith(null);
      expect(core.setShowPartnerOwnerControls).toHaveBeenCalledWith(false);
      expect(mockClearManagedPartnerInviteToken).toHaveBeenCalledTimes(1);
      expect(core.setPendingPartnerInviteToken).toHaveBeenCalledWith("");

      const updater = (core.setState as jest.Mock).mock.calls[0][0] as (
        current: ReturnType<typeof createLoadedSettingsStateFixture> | null,
      ) => { syncPreferences: { mode: string; endpointInput: string } } | null;
      const currentState = createLoadedSettingsStateFixture({
        syncPreferences: {
          ...createLoadedSettingsStateFixture().syncPreferences,
          endpointInput: "leftover-endpoint",
        },
      });
      const nextState = updater(currentState);
      expect(nextState?.syncPreferences.mode).toBe("self_hosted");
      // Only switching TO managed clears the endpoint; other modes keep it.
      expect(nextState?.syncPreferences.endpointInput).toBe(
        "leftover-endpoint",
      );
      expect(updater(null)).toBeNull();
    });

    it("onModeSelect clears a leftover endpoint input when switching to managed mode", () => {
      const core = setUpLoadedController();
      const { result } = renderHook(() => useBackupSyncScreenController({}));

      result.current.flowProps!.onModeSelect("managed");

      const updater = (core.setState as jest.Mock).mock.calls[0][0] as (
        current: ReturnType<typeof createLoadedSettingsStateFixture> | null,
      ) => { syncPreferences: { mode: string; endpointInput: string } } | null;
      const currentState = createLoadedSettingsStateFixture({
        syncPreferences: {
          ...createLoadedSettingsStateFixture().syncPreferences,
          mode: "self_hosted",
          endpointInput: "leftover-endpoint",
        },
      });
      const nextState = updater(currentState);
      expect(nextState?.syncPreferences.mode).toBe("managed");
      expect(nextState?.syncPreferences.endpointInput).toBe("");
    });
  });
});
