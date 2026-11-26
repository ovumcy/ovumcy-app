import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { getCloudPlanCopy } from "../../../i18n/cloud-plan-copy";
import {
  loadCloudSubscriptionPlans,
  purchaseCloudSubscription,
} from "../../../services/cloud-subscription-service";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { CloudPlanPicker } from "./CloudPlanPicker";

jest.mock("../../../services/cloud-subscription-service", () => ({
  ...jest.requireActual("../../../services/cloud-subscription-service"),
  loadCloudSubscriptionPlans: jest.fn(),
  purchaseCloudSubscription: jest.fn(),
}));

const mockLoadPlans = jest.mocked(loadCloudSubscriptionPlans);
const mockPurchase = jest.mocked(purchaseCloudSubscription);
const copy = getCloudPlanCopy("en");

async function renderPicker() {
  const onPurchaseCompleted = jest.fn();
  await render(
    <AppPreferencesTestProvider languageOverride="en">
      <CloudPlanPicker onPurchaseCompleted={onPurchaseCompleted} />
    </AppPreferencesTestProvider>,
  );
  await act(async () => {});
  return { onPurchaseCompleted };
}

describe("CloudPlanPicker", () => {
  beforeEach(() => {
    mockLoadPlans.mockReset();
    mockPurchase.mockReset();
  });

  it("renders nothing while the store offers no plan, as while purchases are switched off", async () => {
    mockLoadPlans.mockResolvedValue([]);

    await renderPicker();

    expect(screen.queryByTestId("settings-sync-cloud-plan-picker")).toBeNull();
  });

  it("labels each plan with the store's price and notes a trial only when the store returned one", async () => {
    mockLoadPlans.mockResolvedValue([
      { basePlanId: "monthly", displayPrice: "€3.99", freeTrial: false },
      { basePlanId: "yearly", displayPrice: "€34.99", freeTrial: false },
    ]);

    await renderPicker();

    expect(screen.getByText(copy.monthlyLabel("€3.99"))).toBeTruthy();
    expect(screen.getByText(copy.yearlyLabel("€34.99"))).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-cloud-plan-trial")).toBeNull();
  });

  it("shows the trial note when the store returned a free-trial offer", async () => {
    mockLoadPlans.mockResolvedValue([
      { basePlanId: "yearly", displayPrice: "€34.99", freeTrial: true },
    ]);

    await renderPicker();

    expect(screen.getByText(copy.freeTrialNote)).toBeTruthy();
    expect(screen.queryByTestId("settings-sync-cloud-plan-monthly")).toBeNull();
  });

  it("re-reads the billing snapshot after a completed sheet instead of granting anything itself", async () => {
    mockLoadPlans.mockResolvedValue([
      { basePlanId: "yearly", displayPrice: "€34.99", freeTrial: true },
    ]);
    mockPurchase.mockResolvedValue("completed");
    const { onPurchaseCompleted } = await renderPicker();

    await act(async () => {
      await fireEvent.press(screen.getByTestId("settings-sync-cloud-plan-yearly"));
    });

    expect(mockPurchase).toHaveBeenCalledWith("yearly");
    expect(onPurchaseCompleted).toHaveBeenCalledTimes(1);
    expect(screen.getByText(copy.purchaseCompleted)).toBeTruthy();
  });

  it("says nothing on a cancelled sheet and reports an unavailable store", async () => {
    mockLoadPlans.mockResolvedValue([
      { basePlanId: "monthly", displayPrice: "€3.99", freeTrial: false },
    ]);
    mockPurchase.mockResolvedValueOnce("cancelled").mockResolvedValueOnce("unavailable");
    const { onPurchaseCompleted } = await renderPicker();

    await act(async () => {
      await fireEvent.press(screen.getByTestId("settings-sync-cloud-plan-monthly"));
    });
    expect(screen.queryByTestId("settings-sync-cloud-plan-feedback")).toBeNull();

    await act(async () => {
      await fireEvent.press(screen.getByTestId("settings-sync-cloud-plan-monthly"));
    });
    expect(screen.getByText(copy.purchaseUnavailable)).toBeTruthy();
    expect(onPurchaseCompleted).not.toHaveBeenCalled();
  });
});
