import { fireEvent, render, screen } from "@testing-library/react-native";

import { getErrorCopy } from "../../i18n/error-copy";
import { resolveDeviceLanguage } from "../../i18n/runtime";
import { AppErrorScreen } from "./AppErrorScreen";

// AppErrorScreen resolves copy from the device locale (not from a provider),
// so expectations are derived the same way rather than hardcoded to "en" —
// the host/CI Intl locale is not guaranteed to be English.
const deviceCopy = getErrorCopy(resolveDeviceLanguage());

describe("AppErrorScreen", () => {
  it("renders copy for the device locale", () => {
    render(<AppErrorScreen message="boom" onRetry={jest.fn()} />);

    expect(screen.getByText(deviceCopy.title)).toBeTruthy();
    expect(screen.getByText(deviceCopy.description)).toBeTruthy();
    expect(screen.getByText(deviceCopy.retryAction)).toBeTruthy();
  });

  it("shows the error message", () => {
    render(<AppErrorScreen message="Cannot read property 'x' of undefined" onRetry={jest.fn()} />);

    expect(
      screen.getByText("Cannot read property 'x' of undefined"),
    ).toBeTruthy();
  });

  it("fires the retry callback when pressed", () => {
    const onRetry = jest.fn();

    render(<AppErrorScreen message="boom" onRetry={onRetry} />);
    fireEvent.press(screen.getByText(deviceCopy.retryAction));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("exposes the retry control with accessibilityRole button", () => {
    render(<AppErrorScreen message="boom" onRetry={jest.fn()} />);

    expect(
      screen.getByRole("button", { name: deviceCopy.retryAction }),
    ).toBeTruthy();
  });
});

describe("getErrorCopy", () => {
  it("returns distinct, non-empty strings for all five locales", () => {
    const locales = ["en", "ru", "de", "fr", "es"] as const;
    const seenTitles = new Set<string>();

    for (const locale of locales) {
      const copy = getErrorCopy(locale);

      expect(copy.title.trim().length).toBeGreaterThan(0);
      expect(copy.description.trim().length).toBeGreaterThan(0);
      expect(copy.retryAction.trim().length).toBeGreaterThan(0);
      expect(copy.detailsLabel.trim().length).toBeGreaterThan(0);

      seenTitles.add(copy.title);
    }

    expect(seenTitles.size).toBe(locales.length);
  });
});
