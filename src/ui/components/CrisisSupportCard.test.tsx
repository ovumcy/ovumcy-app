import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { buildCrisisSupportViewData } from "../../i18n/crisis-copy";
import { loadManagedPremiumFeaturesForCurrentSession } from "../../services/managed-premium-features-service";
import { AppPreferencesTestProvider } from "../../test/AppPreferencesTestProvider";
import { CrisisSupportCard } from "./CrisisSupportCard";

// The crisis block must NEVER consult premium/plan state. The component imports
// no entitlement code, so mocking the premium loader and asserting it is never
// called pins that invariant against a future accidental gate.
jest.mock("../../services/managed-premium-features-service", () => ({
  loadManagedPremiumFeaturesForCurrentSession: jest.fn(),
}));

const mockLoadPremium = jest.mocked(loadManagedPremiumFeaturesForCurrentSession);

function renderCard(
  contact: { name?: string; phone?: string } = {},
  onSaveContact: (c: { name: string; phone: string }) => void | Promise<void> =
    jest.fn(),
) {
  const viewData = buildCrisisSupportViewData(
    "en",
    contact.name ?? "",
    contact.phone ?? "",
  );
  render(
    <AppPreferencesTestProvider languageOverride="en">
      <CrisisSupportCard onSaveContact={onSaveContact} viewData={viewData} />
    </AppPreferencesTestProvider>,
  );
  return { onSaveContact };
}

describe("CrisisSupportCard", () => {
  afterEach(() => {
    mockLoadPremium.mockReset();
  });

  it("always renders the fixed guidance and an edit affordance, with no contact line when none is set", () => {
    renderCard();

    expect(
      screen.getByTestId("crisis-support-card-guidance").props.children,
    ).toContain("immediate support");
    expect(screen.getByTestId("crisis-support-card-edit-button")).toBeTruthy();
    expect(screen.queryByTestId("crisis-support-card-contact")).toBeNull();
  });

  it("shows the personal contact line as plain text when a contact is set", () => {
    renderCard({ name: "Mum", phone: "07700 900000" });

    expect(
      screen.getByTestId("crisis-support-card-contact").props.children,
    ).toBe("Your support contact: Mum — 07700 900000");
  });

  it("saves an inline edit through the profile-update path with the typed values", async () => {
    const onSaveContact = jest.fn();
    renderCard({}, onSaveContact);

    fireEvent.press(screen.getByTestId("crisis-support-card-edit-button"));

    // The one-line privacy note is visible while editing.
    expect(
      screen.getByTestId("crisis-support-card-privacy-note").props.children,
    ).toContain("encrypted");

    fireEvent.changeText(
      screen.getByTestId("crisis-support-card-name-input"),
      "Mum",
    );
    fireEvent.changeText(
      screen.getByTestId("crisis-support-card-phone-input"),
      "07700 900000",
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId("crisis-support-card-save-button"));
      await Promise.resolve();
    });

    expect(onSaveContact).toHaveBeenCalledWith({
      name: "Mum",
      phone: "07700 900000",
    });
  });

  it("never consults the premium loader while rendering or saving (never plan-gated)", async () => {
    const onSaveContact = jest.fn();
    renderCard({ name: "Mum", phone: "555" }, onSaveContact);

    fireEvent.press(screen.getByTestId("crisis-support-card-edit-button"));
    fireEvent.changeText(
      screen.getByTestId("crisis-support-card-name-input"),
      "Dad",
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId("crisis-support-card-save-button"));
      await Promise.resolve();
    });

    expect(mockLoadPremium).not.toHaveBeenCalled();
  });

  it("discards a cancelled edit and leaves the saved contact untouched", async () => {
    const onSaveContact = jest.fn();
    renderCard({ name: "Aunt Jo", phone: "0123 456" }, onSaveContact);

    fireEvent.press(screen.getByTestId("crisis-support-card-edit-button"));
    fireEvent.changeText(
      screen.getByTestId("crisis-support-card-name-input"),
      "Someone Else",
    );
    fireEvent.press(screen.getByTestId("crisis-support-card-cancel-button"));

    // Edit UI is gone, nothing was persisted, and reopening the editor shows
    // the SAVED value again — a cancelled draft never leaks into the next edit.
    expect(screen.queryByTestId("crisis-support-card-edit")).toBeNull();
    expect(onSaveContact).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId("crisis-support-card-edit-button"));
    expect(screen.getByTestId("crisis-support-card-name-input").props.value).toBe(
      "Aunt Jo",
    );
  });
});
