import { act, renderHook } from "@testing-library/react-native";

import * as offersService from "../../../services/offers-service";
import type { ResolvedBillingOffer } from "../../../services/offers-service";
import * as settingsStateService from "../../../services/settings-state-service";
import {
  createBackupSyncSessionCoreMock,
  createLoadedSettingsStateFixture,
} from "../../../test/create-backup-sync-session-core-mock";
import { useBackupSyncManagedPlan } from "./useBackupSyncManagedPlan";

jest.mock("../../../services/offers-service");
jest.mock("../../../services/settings-state-service");

const mockLoadSettingsScreenState = jest.mocked(
  settingsStateService.loadSettingsScreenState,
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
