import { act, renderHook } from "@testing-library/react-native";

import * as backupSyncScreenService from "../../../services/backup-sync-screen-service";
import * as offersService from "../../../services/offers-service";
import type { ResolvedBillingOffer } from "../../../services/offers-service";
import * as settingsStateService from "../../../services/settings-state-service";
import {
  createBackupSyncSessionCoreMock,
  createLoadedSettingsStateFixture,
} from "../../../test/create-backup-sync-session-core-mock";
import { openConfirmation } from "../../confirm/open-confirmation";
import { useBackupSyncManagedPlan } from "./useBackupSyncManagedPlan";

jest.mock("../../confirm/open-confirmation", () => ({
  openConfirmation: jest.fn(),
  openLeaveConfirmation: jest.fn(),
}));

jest.mock("../../../services/backup-sync-screen-service");
jest.mock("../../../services/offers-service");
jest.mock("../../../services/settings-state-service");

const mockOpenConfirmation = jest.mocked(openConfirmation);
const mockLoadSettingsScreenState = jest.mocked(
  settingsStateService.loadSettingsScreenState,
);
const mockUpdateBackupSyncRenewal = jest.mocked(
  backupSyncScreenService.updateBackupSyncRenewal,
);
const mockDismissBillingOffer = jest.mocked(offersService.dismissBillingOffer);

function buildOffer(
  action: ResolvedBillingOffer["action"],
): ResolvedBillingOffer {
  return {
    id: "offer-1",
    kind: "subscription_promo",
    title: "Offer title",
    body: "Offer body",
    cta: "Offer CTA",
    action,
  };
}

describe("useBackupSyncManagedPlan", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleRetryPlanCheck", () => {
    it("reloads the settings state and refreshes partner access", async () => {
      const refreshedState = createLoadedSettingsStateFixture();
      const core = createBackupSyncSessionCoreMock();
      mockLoadSettingsScreenState.mockResolvedValue(refreshedState);
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));

      await act(async () => {
        await result.current.handleRetryPlanCheck();
      });

      expect(core.resetFeedbackMessages).toHaveBeenCalledTimes(1);
      expect(mockLoadSettingsScreenState).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.effectiveNow,
      );
      expect(core.setState).toHaveBeenCalledWith(refreshedState);
      expect(core.reloadPartnerAccess).toHaveBeenCalledWith(refreshedState);
    });
  });

  describe("handleUpdateRenewal", () => {
    it("does nothing when there is no loaded state", async () => {
      const core = createBackupSyncSessionCoreMock({ state: null });
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));

      await act(async () => {
        await result.current.handleUpdateRenewal("resume");
      });

      expect(core.resetFeedbackMessages).not.toHaveBeenCalled();
      expect(mockUpdateBackupSyncRenewal).not.toHaveBeenCalled();
      expect(result.current.isUpdatingRenewal).toBe(false);
    });

    it("does not update when the cancel confirm is dismissed (dismissal is keep)", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(false);
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));

      await act(async () => {
        await result.current.handleUpdateRenewal("cancel_at_period_end");
      });

      expect(mockUpdateBackupSyncRenewal).not.toHaveBeenCalled();
      expect(result.current.isUpdatingRenewal).toBe(false);
    });

    it("requests the cancel confirm with the expected copy before updating", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(true);
      mockUpdateBackupSyncRenewal.mockResolvedValue({
        ok: true,
        state: core.state!,
      });
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));

      await act(async () => {
        await result.current.handleUpdateRenewal("cancel_at_period_end");
      });

      expect(mockOpenConfirmation).toHaveBeenCalledWith(
        core.viewData.account.renewalCancelPrompt,
        core.viewData.account.renewalCancelAccept,
        core.viewData.common.cancelAction,
      );
    });

    it("skips the confirm entirely for resume", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockUpdateBackupSyncRenewal.mockResolvedValue({
        ok: true,
        state: core.state!,
      });
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));

      await act(async () => {
        await result.current.handleUpdateRenewal("resume");
      });

      expect(mockOpenConfirmation).not.toHaveBeenCalled();
      expect(mockUpdateBackupSyncRenewal).toHaveBeenCalledWith(
        core.storage,
        core.syncSecretStore,
        core.state,
        "resume",
        core.effectiveNow,
      );
    });

    it("surfaces a renewal-update failure with account scope", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockUpdateBackupSyncRenewal.mockResolvedValue({
        ok: false,
        errorCode: "not_connected",
      });
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));

      await act(async () => {
        await result.current.handleUpdateRenewal("resume");
      });

      expect(core.setErrorState).toHaveBeenCalledWith({
        code: "not_connected",
        scope: "account",
      });
      expect(core.setState).not.toHaveBeenCalled();
      expect(result.current.isUpdatingRenewal).toBe(false);
    });

    it("cancels successfully and reports renewalCancelled", async () => {
      const updatedState = createLoadedSettingsStateFixture();
      const core = createBackupSyncSessionCoreMock();
      mockOpenConfirmation.mockResolvedValue(true);
      mockUpdateBackupSyncRenewal.mockResolvedValue({
        ok: true,
        state: updatedState,
      });
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));

      await act(async () => {
        await result.current.handleUpdateRenewal("cancel_at_period_end");
      });

      expect(core.setErrorState).toHaveBeenCalledWith(null);
      expect(core.setState).toHaveBeenCalledWith(updatedState);
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        core.viewData.account.status.renewalCancelled,
      );
      expect(result.current.isUpdatingRenewal).toBe(false);
    });

    it("resumes successfully and reports renewalResumed", async () => {
      const updatedState = createLoadedSettingsStateFixture();
      const core = createBackupSyncSessionCoreMock();
      mockUpdateBackupSyncRenewal.mockResolvedValue({
        ok: true,
        state: updatedState,
      });
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));

      await act(async () => {
        await result.current.handleUpdateRenewal("resume");
      });

      expect(core.setState).toHaveBeenCalledWith(updatedState);
      expect(core.setAccountStatusMessage).toHaveBeenCalledWith(
        core.viewData.account.status.renewalResumed,
      );
      expect(result.current.isUpdatingRenewal).toBe(false);
    });
  });

  describe("handleDismissOffer", () => {
    it("dismisses an offer and stores the updated dismissed-id list", async () => {
      const core = createBackupSyncSessionCoreMock();
      mockDismissBillingOffer.mockResolvedValue(["offer-1"]);
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));

      await act(async () => {
        await result.current.handleDismissOffer("offer-1");
      });

      expect(mockDismissBillingOffer).toHaveBeenCalledWith(
        core.storage,
        "offer-1",
      );
      expect(core.setDismissedOfferIDs).toHaveBeenCalledWith(["offer-1"]);
    });
  });

  describe("handleOfferCTAPress", () => {
    it("is a no-op for a screen-target offer (v1 renders offers only on this screen already)", () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));
      const offer = buildOffer({ type: "screen", screen: "backup-sync" });

      act(() => {
        result.current.handleOfferCTAPress(offer);
      });

      expect(core.setState).not.toHaveBeenCalled();
      expect(core.router.push).not.toHaveBeenCalled();
    });

    it("is a no-op for a play_checkout offer (inert until Play Billing lands)", () => {
      const core = createBackupSyncSessionCoreMock();
      const { result } = renderHook(() => useBackupSyncManagedPlan(core));
      const offer = buildOffer({
        type: "play_checkout",
        productId: "product-1",
        basePlanId: null,
        offerId: null,
      });

      act(() => {
        result.current.handleOfferCTAPress(offer);
      });

      expect(core.setState).not.toHaveBeenCalled();
      expect(core.router.push).not.toHaveBeenCalled();
    });
  });
});
