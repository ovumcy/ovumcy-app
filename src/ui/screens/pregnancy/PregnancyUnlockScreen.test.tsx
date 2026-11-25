import { fireEvent, render, screen } from "@testing-library/react-native";

import { getPregnancyCopy } from "../../../i18n/pregnancy-copy";
import type {
  PregnancyPurchaseResult,
  PregnancyRestoreResult,
  PregnancyUnlockOffer,
} from "../../../services/pregnancy-purchase-service";
import { AppPreferencesTestProvider } from "../../../test/AppPreferencesTestProvider";
import { PregnancyUnlockScreen } from "./PregnancyUnlockScreen";

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush, back: mockBack }),
}));

const copy = getPregnancyCopy("en").unlock;
const available: PregnancyUnlockOffer = {
  status: "available",
  displayPrice: "€4.99",
};

async function renderUnlock(
  options: {
    offers?: PregnancyUnlockOffer[];
    purchase?: PregnancyPurchaseResult;
    restore?: PregnancyRestoreResult;
  } = {},
) {
  const offers = options.offers ?? [available];
  const loadOffer = jest.fn(async () => offers.shift() ?? available);
  const purchase = jest.fn(async () => options.purchase ?? "owned");
  const restore = jest.fn(async () => options.restore ?? "not_found");

  await render(
    <AppPreferencesTestProvider languageOverride="en">
      <PregnancyUnlockScreen
        loadOffer={loadOffer}
        purchase={purchase}
        restore={restore}
      />
    </AppPreferencesTestProvider>,
  );

  return { loadOffer, purchase, restore };
}

describe("PregnancyUnlockScreen", () => {
  afterEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockBack.mockReset();
  });

  it("shows the store's price with buy and restore actions", async () => {
    await renderUnlock();

    expect(
      (await screen.findByTestId("pregnancy-unlock-price")).props.children,
    ).toBe("€4.99");
    expect(screen.getByTestId("pregnancy-unlock-buy-button")).toBeTruthy();
    expect(screen.getByTestId("pregnancy-unlock-restore-button")).toBeTruthy();
    expect(screen.getByText(copy.dataNote)).toBeTruthy();
  });

  it("unlocks after a completed purchase and continues to pregnancy setup, never to the subscription screen", async () => {
    const { purchase } = await renderUnlock({ purchase: "owned" });

    await fireEvent.press(await screen.findByTestId("pregnancy-unlock-buy-button"));

    expect(purchase).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId("pregnancy-unlock-owned")).toBeTruthy();
    expect(screen.queryByTestId("pregnancy-unlock-buy-button")).toBeNull();

    await fireEvent.press(screen.getByTestId("pregnancy-unlock-continue-button"));
    expect(mockReplace.mock.calls).toEqual([["/pregnancy-start"]]);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("keeps the module locked and says so when the purchase is cancelled", async () => {
    await renderUnlock({ purchase: "cancelled" });

    await fireEvent.press(await screen.findByTestId("pregnancy-unlock-buy-button"));

    expect(await screen.findByText(copy.cancelledNotice)).toBeTruthy();
    expect(screen.getByTestId("pregnancy-unlock-buy-button")).toBeTruthy();
    expect(screen.queryByTestId("pregnancy-unlock-owned")).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("shows a pending payment as pending, with no way into the module", async () => {
    const { loadOffer } = await renderUnlock({
      purchase: "pending",
      offers: [available, { status: "owned" }],
    });

    await fireEvent.press(await screen.findByTestId("pregnancy-unlock-buy-button"));

    expect(await screen.findByTestId("pregnancy-unlock-pending")).toBeTruthy();
    expect(screen.queryByTestId("pregnancy-unlock-continue-button")).toBeNull();
    expect(screen.queryByTestId("pregnancy-unlock-buy-button")).toBeNull();

    // "Check again" re-reads the store; here the payment has gone through.
    await fireEvent.press(screen.getByTestId("pregnancy-unlock-check-again-button"));
    expect(await screen.findByTestId("pregnancy-unlock-owned")).toBeTruthy();
    expect(loadOffer).toHaveBeenCalledTimes(2);
  });

  it("shows the store as unavailable and retries on request", async () => {
    const { loadOffer } = await renderUnlock({
      offers: [{ status: "unavailable" }, available],
    });

    expect(await screen.findByTestId("pregnancy-unlock-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("pregnancy-unlock-buy-button")).toBeNull();

    await fireEvent.press(screen.getByTestId("pregnancy-unlock-retry-button"));
    expect(await screen.findByTestId("pregnancy-unlock-buy-button")).toBeTruthy();
    expect(loadOffer).toHaveBeenCalledTimes(2);
  });

  it("falls back to unavailable when the purchase fails", async () => {
    await renderUnlock({ purchase: "unavailable" });

    await fireEvent.press(await screen.findByTestId("pregnancy-unlock-buy-button"));

    expect(await screen.findByTestId("pregnancy-unlock-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("pregnancy-unlock-owned")).toBeNull();
  });

  it("restores an earlier purchase", async () => {
    const { restore, purchase } = await renderUnlock({ restore: "owned" });

    await fireEvent.press(
      await screen.findByTestId("pregnancy-unlock-restore-button"),
    );

    expect(restore).toHaveBeenCalledTimes(1);
    expect(purchase).not.toHaveBeenCalled();
    expect(await screen.findByTestId("pregnancy-unlock-owned")).toBeTruthy();
  });

  it("says when there is nothing to restore and keeps the offer", async () => {
    await renderUnlock({ restore: "not_found" });

    await fireEvent.press(
      await screen.findByTestId("pregnancy-unlock-restore-button"),
    );

    expect(await screen.findByText(copy.restoreNotFoundNotice)).toBeTruthy();
    expect(screen.getByTestId("pregnancy-unlock-buy-button")).toBeTruthy();
  });

  it("offers restore while the store is unavailable", async () => {
    const { restore } = await renderUnlock({
      offers: [{ status: "unavailable" }],
      restore: "not_found",
    });

    await fireEvent.press(
      await screen.findByTestId("pregnancy-unlock-restore-button"),
    );

    expect(restore).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(copy.restoreNotFoundNotice)).toBeTruthy();
    expect(screen.getByTestId("pregnancy-unlock-unavailable")).toBeTruthy();
  });

  it("opens straight on the owned state for a module that is already unlocked", async () => {
    await renderUnlock({ offers: [{ status: "owned" }] });

    expect(await screen.findByTestId("pregnancy-unlock-owned")).toBeTruthy();
    expect(screen.queryByTestId("pregnancy-unlock-buy-button")).toBeNull();
  });

  it("drops a store answer that arrives after the screen has closed", async () => {
    // Closed while the offer is still loading.
    let finishLoad: (offer: PregnancyUnlockOffer) => void = () => undefined;
    const loading = await render(
      <AppPreferencesTestProvider languageOverride="en">
        <PregnancyUnlockScreen
          loadOffer={() =>
            new Promise<PregnancyUnlockOffer>((resolve) => {
              finishLoad = resolve;
            })
          }
        />
      </AppPreferencesTestProvider>,
    );
    await loading.unmount();
    finishLoad(available);
    await Promise.resolve();

    // Closed while the purchase sheet, then a restore, is still open: the
    // store call itself closes the screen before it answers.
    for (const press of [
      "pregnancy-unlock-buy-button",
      "pregnancy-unlock-restore-button",
    ]) {
      const closeThenAnswer = jest.fn(async () => {
        await view.unmount();
        return "owned" as const;
      });
      const view = await render(
        <AppPreferencesTestProvider languageOverride="en">
          <PregnancyUnlockScreen
            loadOffer={async () => available}
            purchase={closeThenAnswer}
            restore={closeThenAnswer}
          />
        </AppPreferencesTestProvider>,
      );
      await fireEvent.press(await screen.findByTestId(press));

      expect(closeThenAnswer).toHaveBeenCalledTimes(1);
    }

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders with the default services, which find no store under Jest", async () => {
    await render(
      <AppPreferencesTestProvider languageOverride="en">
        <PregnancyUnlockScreen />
      </AppPreferencesTestProvider>,
    );

    expect(await screen.findByTestId("pregnancy-unlock-unavailable")).toBeTruthy();
  });
});
