import { fontScale } from "../theme/tokens";
import {
  resolveTabBarContentHeight,
  resolveTabBarFontScale,
  TAB_BAR_BASE_CONTENT_HEIGHT,
  TAB_BAR_LABEL_LINE_HEIGHT,
} from "./tab-bar-metrics";

describe("resolveTabBarFontScale", () => {
  it("keeps the default scale when the OS asks for no enlargement", () => {
    expect(resolveTabBarFontScale(1)).toBe(1);
    expect(resolveTabBarFontScale(0.85)).toBe(1);
  });

  it("passes through a moderate OS font scale", () => {
    expect(resolveTabBarFontScale(1.2)).toBe(1.2);
  });

  it("caps at the dense tier so four destinations still fit the band", () => {
    expect(resolveTabBarFontScale(3)).toBe(fontScale.dense);
  });

  it("ignores a nonsense scale rather than collapsing the tab bar", () => {
    expect(resolveTabBarFontScale(Number.NaN)).toBe(1);
    expect(resolveTabBarFontScale(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("resolveTabBarContentHeight", () => {
  it("leaves the band at its base height where the label does not scale (iOS)", () => {
    expect(resolveTabBarContentHeight(2, false)).toBe(
      TAB_BAR_BASE_CONTENT_HEIGHT,
    );
  });

  it("grows the band by the extra line height the scaled label needs", () => {
    expect(resolveTabBarContentHeight(1, true)).toBe(
      TAB_BAR_BASE_CONTENT_HEIGHT,
    );
    expect(resolveTabBarContentHeight(1.5, true)).toBe(
      TAB_BAR_BASE_CONTENT_HEIGHT +
        Math.round(TAB_BAR_LABEL_LINE_HEIGHT * (fontScale.dense - 1)),
    );
  });

  it("stops growing once the cap is reached", () => {
    expect(resolveTabBarContentHeight(1.3, true)).toBe(
      resolveTabBarContentHeight(4, true),
    );
  });
});
