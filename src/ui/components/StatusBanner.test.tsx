import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { StatusBanner } from "./StatusBanner";

async function renderBanner(languageOverride: "en" | "ru" = "en") {
  return await render(
    <AppPreferencesTestProvider languageOverride={languageOverride}>
      <StatusBanner message="Saved locally" onDismiss={jest.fn()} tone="success" />
    </AppPreferencesTestProvider>,
  );
}

describe("StatusBanner", () => {
  it("renders localized default tone and dismiss labels", async () => {
    await renderBanner("ru");

    await waitFor(() => expect(screen.getByText("Готово")).toBeTruthy());
    expect(screen.getByLabelText("Закрыть")).toBeTruthy();
  });

  it("lets callers override the localized dismiss label", async () => {
    const onDismiss = jest.fn();

    await render(
      <AppPreferencesTestProvider>
        <StatusBanner
          dismissLabel="Dismiss error"
          message="Could not save"
          onDismiss={onDismiss}
          tone="error"
        />
      </AppPreferencesTestProvider>,
    );

    await waitFor(() => expect(screen.getByText("Error")).toBeTruthy());
    await fireEvent.press(screen.getByLabelText("Dismiss error"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
